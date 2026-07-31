import { getStore } from "@netlify/blobs";
import { normaliseAccountUsername } from "./account-primitives";

const STORE_NAME = "advertising-game-pair-registrations-v1";
const INDEX_KEY = "registrations";
const INDEX_SCHEMA = "ad-market-pair-registration-index";
const MAX_REGISTRATIONS = 1_000;
const MAX_WRITE_ATTEMPTS = 8;

export interface PairRegistrationRecord {
  readonly username: string;
  readonly password: string;
  readonly status: "pending" | "approved";
  readonly requestedAt: string;
  readonly approvedAt: string | null;
}

export class PairRegistrationStoreError extends Error {
  constructor(
    readonly code:
      | "REGISTRATION_NOT_FOUND"
      | "REGISTRATION_UNAVAILABLE"
      | "USERNAME_UNAVAILABLE"
  ) {
    super(code);
    this.name = "PairRegistrationStoreError";
  }
}

export interface PairRegistrationStore {
  request(input: {
    readonly username: string;
    readonly password: string;
    readonly requestedAt: string;
  }): Promise<PairRegistrationRecord>;
  pending(username: string): Promise<PairRegistrationRecord | null>;
  list(): Promise<readonly PairRegistrationRecord[]>;
  recordApproved(input: {
    readonly username: string;
    readonly password: string;
    readonly approvedAt: string;
  }): Promise<PairRegistrationRecord>;
}

interface RegistrationIndex {
  readonly schema: typeof INDEX_SCHEMA;
  readonly version: 1;
  readonly registrations: Readonly<Record<string, PairRegistrationRecord>>;
}

interface NetlifyRegistrationBlobStore {
  getWithMetadata(
    key: string,
    options: { type: "json" }
  ): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(
    key: string,
    value: RegistrationIndex,
    options: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<{ modified: boolean }>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
};

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value) &&
  Number.isFinite(Date.parse(value));

const validPassword = (value: unknown): value is string =>
  typeof value === "string" &&
  !value.includes("\0") &&
  Buffer.byteLength(value, "utf8") >= 8 &&
  Buffer.byteLength(value, "utf8") <= 128;

const parseUsername = (value: unknown): string => {
  let username: string;
  try {
    username = normaliseAccountUsername(value);
  } catch {
    throw new PairRegistrationStoreError("REGISTRATION_UNAVAILABLE");
  }
  if (username !== value || username === "teacher-playtest") {
    throw new PairRegistrationStoreError("REGISTRATION_UNAVAILABLE");
  }
  return username;
};

const parseRegistration = (value: unknown): PairRegistrationRecord => {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "approvedAt",
      "password",
      "requestedAt",
      "status",
      "username"
    ]) ||
    (value.status !== "pending" && value.status !== "approved") ||
    !validPassword(value.password) ||
    !validTimestamp(value.requestedAt) ||
    (
      value.approvedAt !== null &&
      !validTimestamp(value.approvedAt)
    ) ||
    (value.status === "pending") !== (value.approvedAt === null)
  ) {
    throw new PairRegistrationStoreError("REGISTRATION_UNAVAILABLE");
  }
  return {
    username: parseUsername(value.username),
    password: value.password,
    status: value.status,
    requestedAt: value.requestedAt,
    approvedAt: value.approvedAt
  };
};

const emptyIndex = (): RegistrationIndex => ({
  schema: INDEX_SCHEMA,
  version: 1,
  registrations: {}
});

const parseIndex = (value: unknown): RegistrationIndex => {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["registrations", "schema", "version"]) ||
    value.schema !== INDEX_SCHEMA ||
    value.version !== 1 ||
    !isRecord(value.registrations) ||
    Object.keys(value.registrations).length > MAX_REGISTRATIONS
  ) {
    throw new PairRegistrationStoreError("REGISTRATION_UNAVAILABLE");
  }
  const registrations: Record<string, PairRegistrationRecord> = {};
  for (const [key, candidate] of Object.entries(value.registrations)) {
    const registration = parseRegistration(candidate);
    if (key !== registration.username) {
      throw new PairRegistrationStoreError("REGISTRATION_UNAVAILABLE");
    }
    registrations[key] = registration;
  }
  return { schema: INDEX_SCHEMA, version: 1, registrations };
};

const validatedInput = (
  usernameValue: unknown,
  password: unknown,
  timestamp: unknown
): { username: string; password: string; timestamp: string } => {
  const username = parseUsername(usernameValue);
  if (!validPassword(password) || !validTimestamp(timestamp)) {
    throw new PairRegistrationStoreError("REGISTRATION_UNAVAILABLE");
  }
  return { username, password, timestamp };
};

export function createNetlifyPairRegistrationStore(
  blobs: NetlifyRegistrationBlobStore
): PairRegistrationStore {
  const read = async (): Promise<{ index: RegistrationIndex; etag: string | null }> => {
    const entry = await blobs.getWithMetadata(INDEX_KEY, { type: "json" });
    if (entry === null) return { index: emptyIndex(), etag: null };
    if (typeof entry.etag !== "string") {
      throw new PairRegistrationStoreError("REGISTRATION_UNAVAILABLE");
    }
    return { index: parseIndex(entry.data), etag: entry.etag };
  };

  const mutate = async <T>(
    operation: (index: RegistrationIndex) => { index: RegistrationIndex; result: T }
  ): Promise<T> => {
    for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
      const current = await read();
      const next = operation(current.index);
      const write = await blobs.setJSON(
        INDEX_KEY,
        next.index,
        current.etag === null
          ? { onlyIfNew: true }
          : { onlyIfMatch: current.etag }
      );
      if (write.modified) return next.result;
    }
    throw new PairRegistrationStoreError("REGISTRATION_UNAVAILABLE");
  };

  return {
    async request(input) {
      const parsed = validatedInput(input.username, input.password, input.requestedAt);
      return mutate((index) => {
        const existing = index.registrations[parsed.username];
        if (existing !== undefined) {
          if (existing.status === "pending" && existing.password === parsed.password) {
            return { index, result: existing };
          }
          throw new PairRegistrationStoreError("USERNAME_UNAVAILABLE");
        }
        if (Object.keys(index.registrations).length >= MAX_REGISTRATIONS) {
          throw new PairRegistrationStoreError("REGISTRATION_UNAVAILABLE");
        }
        const registration: PairRegistrationRecord = {
          username: parsed.username,
          password: parsed.password,
          status: "pending",
          requestedAt: parsed.timestamp,
          approvedAt: null
        };
        return {
          index: {
            ...index,
            registrations: {
              ...index.registrations,
              [parsed.username]: registration
            }
          },
          result: registration
        };
      });
    },

    async pending(usernameValue) {
      const username = parseUsername(usernameValue);
      const registration = (await read()).index.registrations[username];
      return registration?.status === "pending" ? registration : null;
    },

    async list() {
      return Object.values((await read()).index.registrations)
        .sort((left, right) => left.username.localeCompare(right.username));
    },

    async recordApproved(input) {
      const parsed = validatedInput(input.username, input.password, input.approvedAt);
      return mutate((index) => {
        const existing = index.registrations[parsed.username];
        const registration: PairRegistrationRecord = {
          username: parsed.username,
          password: parsed.password,
          status: "approved",
          requestedAt: existing?.requestedAt ?? parsed.timestamp,
          approvedAt: parsed.timestamp
        };
        return {
          index: {
            ...index,
            registrations: {
              ...index.registrations,
              [parsed.username]: registration
            }
          },
          result: registration
        };
      });
    }
  };
}

let sharedStore: PairRegistrationStore | null = null;

export function defaultPairRegistrationStore(): PairRegistrationStore {
  sharedStore ??= createNetlifyPairRegistrationStore(
    getStore({ name: STORE_NAME, consistency: "strong" }) as unknown as
      NetlifyRegistrationBlobStore
  );
  return sharedStore;
}
