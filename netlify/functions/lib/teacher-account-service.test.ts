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
const counts = (granted: number, consumed = 0, reserved = 0) => ({
  granted,
  consumed,
  reserved,
  remaining: granted - consumed - reserved
});
const allowanceSnapshot = {
  status: "available" as const,
  enabled: true,
  object: counts(2),
  realise: counts(1)
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
  const allowances = {
    status: vi.fn().mockResolvedValue(allowanceSnapshot),
    globalStatus: vi.fn().mockResolvedValue(allowanceSnapshot),
    list: vi.fn().mockResolvedValue([{
      alias: "team-one",
      object: counts(2),
      realise: counts(1)
    }]),
    setGlobal: vi.fn().mockResolvedValue(allowanceSnapshot),
    set: vi.fn().mockResolvedValue(allowanceSnapshot),
    add: vi.fn().mockResolvedValue(allowanceSnapshot),
    revoke: vi.fn().mockResolvedValue(allowanceSnapshot),
    reserve: vi.fn(),
    complete: vi.fn(),
    refund: vi.fn(),
    markUncertain: vi.fn()
  };
  return {
    events,
    client,
    assets,
    allowances,
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
    expect(setup.allowances.globalStatus).toHaveBeenCalledOnce();
    expect(setup.allowances.set).toHaveBeenCalledTimes(2);
    expect(setup.allowances.set).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      stage: "object",
      amount: 2
    }));
    expect(setup.allowances.set).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      stage: "realise",
      amount: 1
    }));
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

  it("lists global defaults and browser-safe per-pair allowance counts", async () => {
    const setup = dependencies();
    const service = new TeacherAccountService({
      ...setup,
      usernameHmacSecret: "h".repeat(32),
      operationSecret: "o".repeat(32)
    });

    const result = await service.imageLabStatus();

    expect(result).toEqual({
      enabled: true,
      defaults: { object: 2, realise: 1 },
      accounts: [{
        alias: "team-one",
        object: counts(2),
        realise: counts(1)
      }]
    });
    expect(JSON.stringify(result)).not.toContain(userId);
  });

  it("updates global state and both future-account defaults with deterministic replay identities", async () => {
    const setup = dependencies();
    let enabled = true;
    let objectDefault = 2;
    let realiseDefault = 1;
    setup.allowances.setGlobal.mockImplementation(async (input) => {
      if (input.target === "enabled") enabled = input.enabled;
      else if (input.stage === "object") objectDefault = input.amount;
      else realiseDefault = input.amount;
      return {
        status: enabled ? "available" as const : "disabled" as const,
        enabled,
        object: counts(objectDefault),
        realise: counts(realiseDefault)
      };
    });
    const service = new TeacherAccountService({
      ...setup,
      usernameHmacSecret: "h".repeat(32),
      operationSecret: "o".repeat(32)
    });
    const input = {
      operationId,
      enabled: false,
      objectDefault: 4,
      realiseDefault: 2
    };

    const first = await service.setImageLabGlobal(input);
    const firstCalls = structuredClone(setup.allowances.setGlobal.mock.calls);
    const replay = await service.setImageLabGlobal(input);

    expect(first).toMatchObject({
      status: "updated",
      operationId,
      operation: "global",
      enabled: false,
      defaults: { object: 4, realise: 2 }
    });
    expect(replay).toEqual(first);
    expect(firstCalls).toHaveLength(3);
    expect(firstCalls.map(([call]) => call)).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: "enabled", enabled: false }),
      expect.objectContaining({ target: "default", stage: "object", amount: 4 }),
      expect.objectContaining({ target: "default", stage: "realise", amount: 2 })
    ]));
    expect(setup.allowances.setGlobal.mock.calls.slice(3)).toEqual(firstCalls);
  });

  it.each(["set", "add", "revoke"] as const)(
    "resolves the alias server-side and applies %s to separate draft and final counts",
    async (operation) => {
      const setup = dependencies();
      const service = new TeacherAccountService({
        ...setup,
        usernameHmacSecret: "h".repeat(32),
        operationSecret: "o".repeat(32)
      });

      const result = await service.mutateImageLabAccount(operation, {
        operationId,
        alias: "team-one",
        object: operation === "set" ? 0 : 2,
        realise: 1
      });

      expect(setup.client.findAdvertisingGameUser).toHaveBeenCalledWith("team-one");
      expect(setup.allowances[operation]).toHaveBeenCalledWith(expect.objectContaining({
        userId,
        stage: "realise",
        amount: 1,
        operationId: expect.not.stringContaining(userId),
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
      }));
      expect(result).toMatchObject({
        status: "updated",
        operationId,
        operation,
        alias: "team-one",
        account: { alias: "team-one" }
      });
    }
  );

  it("grants a batch only to the selected aliases with no browser user IDs", async () => {
    const setup = dependencies();
    const secondUser = {
      ...userRecord,
      userId: "99250725-52e0-44c9-b569-593167786eaf",
      username: "team-two"
    };
    setup.client.findAdvertisingGameUser.mockImplementation(async (alias: string) =>
      alias === "team-one" ? userRecord : alias === "team-two" ? secondUser : null);
    const service = new TeacherAccountService({
      ...setup,
      usernameHmacSecret: "h".repeat(32),
      operationSecret: "o".repeat(32)
    });

    const result = await service.batchAddImageLab({
      operationId,
      aliases: ["team-one", "team-two"],
      object: 1,
      realise: 0
    });

    expect(setup.allowances.add).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      status: "updated",
      operationId,
      operation: "batch-add",
      aliases: ["team-one", "team-two"]
    });
    expect(JSON.stringify(result)).not.toContain(userId);
    expect(JSON.stringify(result)).not.toContain(secondUser.userId);
  });

  it("reports an unknown allowance outcome as refresh-required and does not retry it", async () => {
    const setup = dependencies();
    setup.allowances.add.mockRejectedValueOnce(new SupabaseAccountError("upstream"));
    const service = new TeacherAccountService({
      ...setup,
      usernameHmacSecret: "h".repeat(32),
      operationSecret: "o".repeat(32)
    });

    await expect(service.mutateImageLabAccount("add", {
      operationId,
      alias: "team-one",
      object: 1,
      realise: 0
    })).rejects.toMatchObject({
      code: "IMAGE_LAB_MUTATION_UNCERTAIN",
      status: 409,
      retryable: false
    });
    expect(setup.allowances.add).toHaveBeenCalledOnce();
  });
});
