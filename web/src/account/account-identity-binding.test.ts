import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_IDENTITY_HEADER,
  ACCOUNT_MUTATION_STORAGE_KEY,
  BrowserAccountIdentityBinding,
  BrowserAccountMutationBus
} from "./account-identity-binding";

describe("BrowserAccountIdentityBinding", () => {
  it("holds only one canonical account identity in memory", () => {
    const binding = new BrowserAccountIdentityBinding();

    expect(binding.current()).toBeNull();
    binding.activate("team-one");
    expect(binding.current()).toBe("team-one");
    binding.deactivate();
    expect(binding.current()).toBeNull();

    expect(() => binding.activate("Team-One")).toThrow(TypeError);
    expect(() => binding.activate("ab")).toThrow(TypeError);
    expect(ACCOUNT_IDENTITY_HEADER).toBe("x-admarket-account");
  });
});

describe("BrowserAccountMutationBus", () => {
  it("publishes a nonce without persisting an account identity", () => {
    const storage = { setItem: vi.fn() };
    const bus = new BrowserAccountMutationBus(
      storage,
      window,
      () => "nonce-7"
    );

    bus.publish();

    expect(storage.setItem).toHaveBeenCalledWith(ACCOUNT_MUTATION_STORAGE_KEY, "nonce-7");
    expect(JSON.stringify(storage.setItem.mock.calls)).not.toContain("team-one");
  });

  it("notifies only for a valid mutation event and can unsubscribe", () => {
    const listener = vi.fn();
    const bus = new BrowserAccountMutationBus(
      { setItem: vi.fn() },
      window,
      () => "unused"
    );
    const unsubscribe = bus.subscribe(listener);

    window.dispatchEvent(new StorageEvent("storage", {
      key: "unrelated",
      newValue: "nonce-1"
    }));
    window.dispatchEvent(new StorageEvent("storage", {
      key: ACCOUNT_MUTATION_STORAGE_KEY,
      newValue: null
    }));
    expect(listener).not.toHaveBeenCalled();

    window.dispatchEvent(new StorageEvent("storage", {
      key: ACCOUNT_MUTATION_STORAGE_KEY,
      newValue: "nonce-2"
    }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(new StorageEvent("storage", {
      key: ACCOUNT_MUTATION_STORAGE_KEY,
      newValue: "nonce-3"
    }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("publishes and parses exact same-account reset events", () => {
    const storage = { setItem: vi.fn() };
    const bus = new BrowserAccountMutationBus(storage, window, () => "nonce-reset");
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(listener);
    const mutation = {
      kind: "reset-pending",
      username: "team-one",
      operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    } as const;

    bus.publish(mutation);
    const stored = storage.setItem.mock.calls[0]?.[1] ?? "";
    expect(JSON.parse(stored)).toEqual({ ...mutation, nonce: "nonce-reset" });

    window.dispatchEvent(new StorageEvent("storage", {
      key: ACCOUNT_MUTATION_STORAGE_KEY,
      newValue: stored
    }));
    expect(listener).toHaveBeenCalledWith(mutation);

    window.dispatchEvent(new StorageEvent("storage", {
      key: ACCOUNT_MUTATION_STORAGE_KEY,
      newValue: JSON.stringify({
        ...mutation,
        username: "Team-One",
        nonce: "bad"
      })
    }));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
