// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { SupabaseAccountError } from "./account-backend";
import {
  TeacherAccountService,
  TeacherAccountServiceError,
  type TeacherAccountOperationRecord,
  type TeacherAccountOperationStore
} from "./teacher-account-service";

const operationId = "2d90c112-4de8-4e7b-92d2-0d655738987f";
const secondOperationId = "7440e792-3ddc-4484-ae32-a53088d0d679";
const userId = "b9b32e20-0ba8-4896-b89f-44efdfc52942";
const userRecord = {
  userId,
  username: "team-one",
  createdAt: "2026-07-20T01:02:03.000Z",
  lastSignInAt: null
};

class MemoryOperationStore implements TeacherAccountOperationStore {
  private readonly entries = new Map<string, {
    value: TeacherAccountOperationRecord;
    etag: string;
  }>();
  private version = 0;

  async read(key: string) {
    const entry = this.entries.get(key);
    return entry === undefined
      ? null
      : { value: structuredClone(entry.value), etag: entry.etag };
  }

  async create(key: string, value: TeacherAccountOperationRecord) {
    if (this.entries.has(key)) return false;
    this.entries.set(key, {
      value: structuredClone(value),
      etag: String(++this.version)
    });
    return true;
  }

  async compareAndSwap(
    key: string,
    value: TeacherAccountOperationRecord,
    etag: string
  ) {
    const current = this.entries.get(key);
    if (current?.etag !== etag) return false;
    this.entries.set(key, {
      value: structuredClone(value),
      etag: String(++this.version)
    });
    return true;
  }
}

const dependencies = () => {
  const events: string[] = [];
  const client = {
    listAdvertisingGameUsers: vi.fn().mockResolvedValue([userRecord]),
    findAdvertisingGameUser: vi.fn().mockImplementation(async () => {
      events.push("find");
      return userRecord;
    }),
    createConfirmedUser: vi.fn().mockImplementation(async () => {
      events.push("create");
    }),
    replaceAdvertisingGamePassword: vi.fn().mockImplementation(async () => {
      events.push("password");
    }),
    progressRpc: vi.fn().mockImplementation(async () => {
      events.push("progress");
      return { status: "reset" };
    })
  };
  const assets = {
    planReset: vi.fn().mockImplementation(async () => {
      events.push("plan");
      return { namespace: "a".repeat(64), objectDigests: ["b".repeat(64)] };
    }),
    executeReset: vi.fn().mockImplementation(async () => {
      events.push("assets");
    })
  };
  return {
    events,
    client,
    assets,
    operations: new MemoryOperationStore()
  };
};

describe("teacher account service", () => {
  it("lists sorted browser-safe summaries without IDs or synthetic emails", async () => {
    const setup = dependencies();
    setup.client.listAdvertisingGameUsers.mockResolvedValue([
      { ...userRecord, username: "team-zed" },
      {
        userId: "99250725-52e0-44c9-b569-593167786eaf",
        username: "team-alpha",
        createdAt: "2026-07-19T01:02:03.000Z",
        lastSignInAt: "2026-07-21T01:02:03.000Z"
      }
    ]);
    const service = new TeacherAccountService({
      ...setup,
      usernameHmacSecret: "h".repeat(32),
      operationSecret: "o".repeat(32)
    });

    const result = await service.listAccounts();

    expect(result).toEqual([
      {
        username: "team-alpha",
        createdAt: "2026-07-19T01:02:03.000Z",
        lastSignInAt: "2026-07-21T01:02:03.000Z"
      },
      {
        username: "team-zed",
        createdAt: "2026-07-20T01:02:03.000Z",
        lastSignInAt: null
      }
    ]);
    expect(JSON.stringify(result)).not.toContain(userId);
    expect(JSON.stringify(result)).not.toContain("accounts.admarket.invalid");
  });

  it("creates a chosen username and password once and replays the completed result", async () => {
    const setup = dependencies();
    setup.client.findAdvertisingGameUser
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(userRecord);
    const service = new TeacherAccountService({
      ...setup,
      usernameHmacSecret: "h".repeat(32),
      operationSecret: "o".repeat(32)
    });
    const input = {
      operationId,
      username: "team-one",
      password: "chosen-password"
    };

    const first = await service.createAccount(input);
    const replay = await service.createAccount(input);

    expect(first).toEqual({
      status: "created",
      operationId,
      account: {
        username: "team-one",
        createdAt: userRecord.createdAt,
        lastSignInAt: null
      }
    });
    expect(replay).toEqual(first);
    expect(setup.client.createConfirmedUser).toHaveBeenCalledTimes(1);
    const [email, password, username] = setup.client.createConfirmedUser.mock.calls[0]!;
    expect(email).toMatch(/^[a-f0-9]{64}@accounts\.admarket\.invalid$/u);
    expect(email).not.toContain("team-one");
    expect([password, username]).toEqual(["chosen-password", "team-one"]);
  });

  it("replaces a password once and does not expose the password in its result", async () => {
    const setup = dependencies();
    const service = new TeacherAccountService({
      ...setup,
      usernameHmacSecret: "h".repeat(32),
      operationSecret: "o".repeat(32)
    });
    const input = {
      operationId,
      username: "team-one",
      password: "replacement-password"
    };

    const first = await service.replacePassword(input);
    const replay = await service.replacePassword(input);

    expect(replay).toEqual(first);
    expect(first).toEqual({
      status: "password-replaced",
      operationId,
      username: "team-one"
    });
    expect(JSON.stringify(first)).not.toContain("replacement-password");
    expect(setup.client.replaceAdvertisingGamePassword)
      .toHaveBeenCalledTimes(1);
  });

  it("resets only the resolved account in plan-progress-assets order and replays completion", async () => {
    const setup = dependencies();
    const service = new TeacherAccountService({
      ...setup,
      usernameHmacSecret: "h".repeat(32),
      operationSecret: "o".repeat(32)
    });
    const input = { operationId, username: "team-one" };

    const first = await service.resetAccount(input);
    const replay = await service.resetAccount(input);

    expect(first).toEqual({
      status: "reset",
      operationId,
      username: "team-one"
    });
    expect(replay).toEqual(first);
    expect(setup.events).toEqual(["find", "plan", "progress", "assets"]);
    expect(setup.assets.planReset).toHaveBeenCalledWith(userId);
    expect(setup.client.progressRpc).toHaveBeenCalledWith({
      userId,
      operation: "reset",
      schema: "advertising-game-progress",
      version: 1
    });
    expect(setup.client.replaceAdvertisingGamePassword).not.toHaveBeenCalled();
    expect(setup.client.createConfirmedUser).not.toHaveBeenCalled();
  });

  it("marks an uncertain reset incomplete and never automatically repeats it", async () => {
    const setup = dependencies();
    setup.assets.executeReset.mockRejectedValueOnce(new Error("uncertain"));
    const service = new TeacherAccountService({
      ...setup,
      usernameHmacSecret: "h".repeat(32),
      operationSecret: "o".repeat(32)
    });
    const input = { operationId: secondOperationId, username: "team-one" };

    await expect(service.resetAccount(input)).rejects.toMatchObject({
      code: "RESET_INCOMPLETE",
      status: 409,
      retryable: false
    });
    await expect(service.resetAccount(input)).rejects.toMatchObject({
      code: "RESET_INCOMPLETE",
      status: 409,
      retryable: false
    });
    expect(setup.client.progressRpc).toHaveBeenCalledTimes(1);
    expect(setup.assets.executeReset).toHaveBeenCalledTimes(1);
  });

  it("rejects a reused operation with different input instead of applying another mutation", async () => {
    const setup = dependencies();
    const service = new TeacherAccountService({
      ...setup,
      usernameHmacSecret: "h".repeat(32),
      operationSecret: "o".repeat(32)
    });
    await service.replacePassword({
      operationId,
      username: "team-one",
      password: "first-password"
    });

    const caught = await service.replacePassword({
      operationId,
      username: "team-one",
      password: "second-password"
    }).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(TeacherAccountServiceError);
    expect(caught).toMatchObject({ code: "IDEMPOTENCY_CONFLICT", status: 409 });
    expect(setup.client.replaceAdvertisingGamePassword).toHaveBeenCalledTimes(1);
  });

  it("maps a concurrent Supabase duplicate to the stable username error", async () => {
    const setup = dependencies();
    setup.client.findAdvertisingGameUser.mockResolvedValueOnce(null);
    setup.client.createConfirmedUser.mockRejectedValueOnce(
      new SupabaseAccountError("duplicate_user")
    );
    const service = new TeacherAccountService({
      ...setup,
      usernameHmacSecret: "h".repeat(32),
      operationSecret: "o".repeat(32)
    });

    await expect(service.createAccount({
      operationId,
      username: "team-one",
      password: "chosen-password"
    })).rejects.toMatchObject({
      code: "USERNAME_UNAVAILABLE",
      status: 409
    });
  });
});
