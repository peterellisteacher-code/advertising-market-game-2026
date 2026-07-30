import { describe, expect, it, vi } from "vitest";
import {
  MarketTabCoordinationError,
  MarketTabCoordinator,
  type MarketCoordinationChannel,
  type MarketCoordinationMessageListener,
  type MarketCoordinationLock,
  type MarketCoordinationLockManager
} from "./market-tab-coordinator";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const ROTATED_ID = "22222222-2222-4222-8222-222222222222";
const NONCE_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NONCE_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

class FakeLockHub {
  readonly held = new Set<string>();
  readonly requestedNames: string[] = [];

  manager(): MarketCoordinationLockManager {
    return {
      request: async <T>(
        name: string,
        _options: { readonly mode: "exclusive"; readonly ifAvailable: true },
        callback: (lock: MarketCoordinationLock | null) => T | PromiseLike<T>
      ): Promise<T> => {
        this.requestedNames.push(name);
        if (this.held.has(name)) return await callback(null);
        this.held.add(name);
        try {
          return await callback({ name, mode: "exclusive" });
        } finally {
          this.held.delete(name);
        }
      }
    };
  }
}

class FakeChannel implements MarketCoordinationChannel {
  readonly listeners = new Set<MarketCoordinationMessageListener>();
  closed = false;

  constructor(private readonly hub: FakeHub) {}

  postMessage(message: unknown): void { this.hub.post(this, message); }
  addEventListener(_type: "message", listener: MarketCoordinationMessageListener): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: "message", listener: MarketCoordinationMessageListener): void {
    this.listeners.delete(listener);
  }
  close(): void {
    this.closed = true;
    this.listeners.clear();
    this.hub.channels.delete(this);
  }
}

class FakeHub {
  readonly channels = new Set<FakeChannel>();
  readonly messages: unknown[] = [];

  open(): FakeChannel {
    const channel = new FakeChannel(this);
    this.channels.add(channel);
    return channel;
  }

  post(sender: FakeChannel, message: unknown): void {
    this.messages.push(structuredClone(message));
    for (const channel of this.channels) {
      if (channel === sender || channel.closed) continue;
      for (const listener of channel.listeners) listener({ data: structuredClone(message) });
    }
  }
}

describe("MarketTabCoordinator", () => {
  it("provides a dedicated duplicate-tab coordination module", async () => {
    const modulePath = "./market-tab-coordinator";
    const loaded = await import(/* @vite-ignore */ modulePath).catch(() => null);
    expect(loaded).not.toBeNull();
    expect(loaded).toHaveProperty("MarketTabCoordinator");
  });

  it("fails explicitly when platform coordination is unavailable", async () => {
    const coordinator = new MarketTabCoordinator({ channel: null, lockManager: null });
    await expect(coordinator.coordinate(CLIENT_ID, () => ROTATED_ID)).rejects.toEqual(
      expect.objectContaining<Partial<MarketTabCoordinationError>>({
        code: "TAB_COORDINATION_UNAVAILABLE"
      })
    );
  });

  it("arbitrates simultaneous cloned identities with held exclusive leases", async () => {
    const locks = new FakeLockHub();
    let firstRotations = 0;
    let secondRotations = 0;
    const first = new MarketTabCoordinator({ channel: null, lockManager: locks.manager() });
    const second = new MarketTabCoordinator({ channel: null, lockManager: locks.manager() });

    await first.coordinate(CLIENT_ID, () => {
      firstRotations += 1;
      return ROTATED_ID;
    });
    await second.coordinate(CLIENT_ID, () => {
      secondRotations += 1;
      return ROTATED_ID;
    });

    expect(firstRotations).toBe(0);
    expect(secondRotations).toBe(1);
    expect(locks.held.size).toBe(2);
    expect(JSON.stringify(locks.requestedNames)).not.toMatch(
      /bearer|session|token|authorization|cookie/i
    );
    first.close();
    second.close();
  });

  it("rotates a delayed or suspended duplicate without treating channel silence as ownership", async () => {
    const locks = new FakeLockHub();
    let establishedRotations = 0;
    let duplicateRotations = 0;
    const established = new MarketTabCoordinator({
      channel: null,
      lockManager: locks.manager()
    });
    await established.coordinate(CLIENT_ID, () => {
      establishedRotations += 1;
      return ROTATED_ID;
    });

    // No BroadcastChannel messages are delivered at all: the held lock remains authoritative.
    const delayedDuplicate = new MarketTabCoordinator({
      channel: null,
      lockManager: locks.manager()
    });
    await delayedDuplicate.coordinate(CLIENT_ID, () => {
      duplicateRotations += 1;
      return ROTATED_ID;
    });

    expect(establishedRotations).toBe(0);
    expect(duplicateRotations).toBe(1);
    expect(locks.held.size).toBe(2);
    established.close();
    delayedDuplicate.close();
  });

  it("preserves a normal single-tab reload after the prior coordinator closes", async () => {
    const locks = new FakeLockHub();
    let rotations = 0;
    const first = new MarketTabCoordinator({ channel: null, lockManager: locks.manager() });
    await first.coordinate(CLIENT_ID, () => {
      rotations += 1;
      return ROTATED_ID;
    });
    first.close();
    await Promise.resolve();

    const reload = new MarketTabCoordinator({ channel: null, lockManager: locks.manager() });
    await reload.coordinate(CLIENT_ID, () => {
      rotations += 1;
      return ROTATED_ID;
    });

    expect(rotations).toBe(0);
    reload.close();
  });
});
