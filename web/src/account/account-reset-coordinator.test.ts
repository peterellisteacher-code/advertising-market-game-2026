import { describe, expect, it, vi } from "vitest";
import type { AccountIdentityBinding, AccountMutation } from "./account-identity-binding";
import type { AccountResetClient } from "./account-client";
import { AccountResetCoordinator } from "./account-reset-coordinator";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const identity = (username = "team-one"): AccountIdentityBinding => ({
  current: () => username,
  activate: vi.fn(),
  deactivate: vi.fn()
});

describe("AccountResetCoordinator", () => {
  it("persists and broadcasts pending before quiescing and calling the server", async () => {
    const order: string[] = [];
    const storage = new MemoryStorage();
    const mutations: AccountMutation[] = [];
    const client: AccountResetClient = {
      reset: vi.fn(async () => {
        order.push("server");
        return "reset" as const;
      })
    };
    const firstStore = {
      resetAccount: vi.fn(async () => { order.push("local-one"); })
    };
    const secondStore = {
      resetAccount: vi.fn(async () => { order.push("local-two"); })
    };
    const reload = vi.fn(() => { order.push("reload"); });
    const coordinator = new AccountResetCoordinator({
      client,
      identity: identity(),
      mutations: {
        publish: (mutation) => {
          if (mutation) mutations.push(mutation);
          order.push(mutation?.kind ?? "session");
        }
      },
      stores: [firstStore, secondStore],
      storage,
      createOperationId: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      quiesce: async () => {
        expect([...storage.values.values()].join(" ")).toContain(
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        );
        order.push("quiesce");
      },
      reload
    });

    await coordinator.reset("RESET");

    expect(order).toEqual([
      "reset-pending",
      "quiesce",
      "server",
      "local-one",
      "local-two",
      "reset-complete",
      "reload"
    ]);
    expect(client.reset).toHaveBeenCalledWith({
      operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      confirmation: "RESET"
    });
    expect(mutations).toEqual([
      {
        kind: "reset-pending",
        username: "team-one",
        operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      },
      {
        kind: "reset-complete",
        username: "team-one",
        operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      }
    ]);
    expect(storage.values.size).toBe(0);
  });

  it("retains local data and reuses the same operation ID after failure", async () => {
    const storage = new MemoryStorage();
    const reset = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("reset");
    const local = { resetAccount: vi.fn().mockResolvedValue(undefined) };
    const coordinator = new AccountResetCoordinator({
      client: { reset },
      identity: identity(),
      mutations: { publish: vi.fn() },
      stores: [local],
      storage,
      createOperationId: () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      quiesce: vi.fn(),
      reload: vi.fn()
    });

    await expect(coordinator.reset("RESET")).rejects.toThrow("offline");
    expect(local.resetAccount).not.toHaveBeenCalled();
    expect([...storage.values.values()].join(" ")).toContain(
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    );

    await coordinator.retry();

    expect(reset).toHaveBeenCalledTimes(2);
    expect(reset.mock.calls.map(([input]) => input.operationId)).toEqual([
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    ]);
    expect(local.resetAccount).toHaveBeenCalledWith("team-one");
  });

  it("rejects reset outside an authenticated account or without exact confirmation", async () => {
    const common = {
      client: { reset: vi.fn() } satisfies AccountResetClient,
      mutations: { publish: vi.fn() },
      stores: [],
      storage: new MemoryStorage(),
      quiesce: vi.fn(),
      reload: vi.fn()
    };
    const signedOut = new AccountResetCoordinator({
      ...common,
      identity: identity("")
    });
    const signedIn = new AccountResetCoordinator({
      ...common,
      identity: identity()
    });

    await expect(signedOut.reset("RESET")).rejects.toThrow(/authenticated/i);
    await expect(signedIn.reset("reset" as "RESET")).rejects.toThrow(/type RESET/i);
    expect(common.client.reset).not.toHaveBeenCalled();
  });
});
