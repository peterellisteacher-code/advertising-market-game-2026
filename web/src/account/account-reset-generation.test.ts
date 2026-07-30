import { describe, expect, it, vi } from "vitest";
import { BrowserAccountResetGenerationGuard } from "./account-reset-generation";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("BrowserAccountResetGenerationGuard", () => {
  it("purges every account store before recording a new server generation", async () => {
    const order: string[] = [];
    const storage = new MemoryStorage();
    const first = {
      resetAccount: vi.fn(async (username: string) => {
        order.push(`first:${username}`);
      })
    };
    const second = {
      resetAccount: vi.fn(async (username: string) => {
        order.push(`second:${username}`);
      })
    };
    const guard = new BrowserAccountResetGenerationGuard([first, second], storage);
    const generation = "7440e792-3ddc-4484-ae32-a53088d0d679";

    await expect(guard.reconcile("team-one", generation)).resolves.toBe(true);

    expect(order).toEqual(["first:team-one", "second:team-one"]);
    expect([...storage.values.values()]).toEqual([generation]);
    await expect(guard.reconcile("team-one", generation)).resolves.toBe(false);
    expect(first.resetAccount).toHaveBeenCalledOnce();
    expect(second.resetAccount).toHaveBeenCalledOnce();
  });

  it("keeps the previous marker when a purge fails so the next login retries", async () => {
    const storage = new MemoryStorage();
    const failure = new Error("indexeddb unavailable");
    const store = {
      resetAccount: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(undefined)
    };
    const guard = new BrowserAccountResetGenerationGuard([store], storage);
    const first = "7440e792-3ddc-4484-ae32-a53088d0d679";
    const second = "7f977c9a-c73c-47c7-93ee-5a40ce302415";

    await guard.reconcile("team-one", first);
    await expect(guard.reconcile("team-one", second)).rejects.toBe(failure);
    expect([...storage.values.values()]).toEqual([first]);

    await expect(guard.reconcile("team-one", second)).resolves.toBe(true);
    expect([...storage.values.values()]).toEqual([second]);
  });

  it("leaves legacy accounts untouched and rejects malformed generations", async () => {
    const resetAccount = vi.fn();
    const guard = new BrowserAccountResetGenerationGuard(
      [{ resetAccount }],
      new MemoryStorage()
    );

    await expect(guard.reconcile("team-one", null)).resolves.toBe(false);
    await expect(guard.reconcile("team-one", "not-a-generation"))
      .rejects.toThrow("reset generation");
    expect(resetAccount).not.toHaveBeenCalled();
  });

  it("uses a volatile marker when localStorage is unavailable", async () => {
    const resetAccount = vi.fn(async () => undefined);
    const guard = new BrowserAccountResetGenerationGuard(
      [{ resetAccount }],
      null
    );
    const generation = "7440e792-3ddc-4484-ae32-a53088d0d679";

    await expect(guard.reconcile("team-one", generation)).resolves.toBe(true);
    await expect(guard.reconcile("team-one", generation)).resolves.toBe(false);
    expect(resetAccount).toHaveBeenCalledOnce();
  });
});
