import { describe, expect, it, vi } from "vitest";
import {
  MarketSessionStore,
  type StoragePort
} from "./market-session-store";
import type { MarketTabCoordinationPort } from "./market-tab-coordinator";
import { isJoinOperationIdForRoom } from "../../../shared/market-operation-id";

const UUID_1 = "11111111-1111-4111-8111-111111111111";
const UUID_2 = "22222222-2222-4222-8222-222222222222";
const UUID_3 = "33333333-3333-4333-8333-333333333333";
const UUID_4 = "44444444-4444-4444-8444-444444444444";
const FINGERPRINT = "a".repeat(64);
const ROOM_CODE = "ABC-234";

class MemoryStorage implements StoragePort {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const makeStore = (storage: StoragePort, ids = [UUID_1, UUID_2]) => {
  let index = 0;
  return new MarketSessionStore({
    storage,
    nowSeconds: () => 1_000,
    randomUUID: () => ids[index++] ?? UUID_2
  });
};

describe("MarketSessionStore", () => {
  it("persists one crypto-generated client id per tab", () => {
    const storage = new MemoryStorage();
    expect(makeStore(storage).getClientId()).toBe(UUID_1);
    expect(makeStore(storage).getClientId()).toBe(UUID_1);
  });

  it("keeps create ids ordinary and scopes join ids to the supplied room", () => {
    const store = makeStore(new MemoryStorage(), [UUID_1, UUID_2, UUID_3, UUID_4]);
    const create = store.beginIntent("create", FINGERPRINT);
    expect(create.operationId).toBe(UUID_2);
    expect(store.beginIntent("create", FINGERPRINT)).toEqual(create);

    const join = store.beginIntent("join", FINGERPRINT, ROOM_CODE);
    expect(join.operationId).not.toBe(UUID_3);
    expect(isJoinOperationIdForRoom(join.operationId, ROOM_CODE)).toBe(true);
    expect(store.beginIntent("join", FINGERPRINT, ROOM_CODE)).toEqual(join);

    const changedRoom = store.beginIntent("join", FINGERPRINT, "DEF-567");
    expect(changedRoom.operationId).not.toBe(join.operationId);
    expect(isJoinOperationIdForRoom(changedRoom.operationId, "DEF-567")).toBe(true);
    expect(isJoinOperationIdForRoom(changedRoom.operationId, ROOM_CODE)).toBe(false);
  });

  it("fails closed when a join intent omits its room scope", () => {
    const store = makeStore(new MemoryStorage());
    expect(() => Reflect.apply(store.beginIntent, store, ["join", FINGERPRINT])).toThrow(RangeError);
  });

  it("restores only an exact version-one envelope", () => {
    const storage = new MemoryStorage();
    storage.setItem("advertising-market:tab-session@1", JSON.stringify({
      version: 1,
      clientId: UUID_1,
      active: {
        scheme: "Bearer", token: "secret", role: "teacher", roomCode: ROOM_CODE, expiresAt: 2_000
      },
      unexpected: true
    }));

    const store = makeStore(storage, [UUID_2]);
    expect(store.readActive()).toBeNull();
    expect(store.getClientId()).toBe(UUID_2);
  });

  it("rejects malformed stored members and expired active sessions without throwing", () => {
    const storage = new MemoryStorage();
    storage.setItem("advertising-market:tab-session@1", JSON.stringify({
      version: 1,
      clientId: UUID_1,
      active: {
        scheme: "Bearer", token: "secret", role: "teacher", roomCode: "abc-234", expiresAt: 2_000
      }
    }));
    expect(() => makeStore(storage).readActive()).not.toThrow();
    expect(makeStore(storage).readActive()).toBeNull();

    const fresh = makeStore(new MemoryStorage());
    fresh.activate({
      scheme: "Bearer", token: "payload.signature", role: "team", roomCode: ROOM_CODE, expiresAt: 1_001
    });
    expect(fresh.readActive()).not.toBeNull();
    expect(() => fresh.activate({
      scheme: "Bearer", token: "not a token", role: "team", roomCode: ROOM_CODE, expiresAt: 2_000
    })).toThrow(RangeError);
  });

  it("compares server expiry seconds with a seconds-based default clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_000_000));
    try {
      const store = new MarketSessionStore({
        storage: new MemoryStorage(),
        randomUUID: () => UUID_1
      });
      store.activate({
        scheme: "Bearer", token: "payload.signature", role: "teacher",
        roomCode: ROOM_CODE, expiresAt: 1_001
      });
      expect(store.readActive()).toMatchObject({ expiresAt: 1_001 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears retained state only when its conditional identity matches", () => {
    const store = makeStore(new MemoryStorage());
    const intent = store.beginIntent("create", FINGERPRINT);
    store.activate({
      scheme: "Bearer", token: "payload.signature", role: "teacher", roomCode: ROOM_CODE, expiresAt: 2_000
    });
    expect(store.clearIntent(UUID_3)).toBe(false);
    expect(store.clearIntent(intent.operationId)).toBe(true);
    expect(store.clearActive({ roomCode: "MINT7K" })).toBe(false);
    expect(store.clearActive({ roomCode: ROOM_CODE, role: "teacher" })).toBe(true);
  });

  it("increments a persisted active identity generation across A to B to A", () => {
    const storage = new MemoryStorage();
    const store = makeStore(storage);
    const sessionA = {
      scheme: "Bearer" as const,
      token: "payload.signature",
      role: "teacher" as const,
      roomCode: ROOM_CODE,
      expiresAt: 2_000
    };
    store.activate(sessionA);
    const firstA = store.readActiveIdentity();
    expect(firstA).toMatchObject({ generation: 1, session: sessionA });

    store.activate({ ...sessionA, token: "different.signature" });
    expect(store.readActiveIdentity()?.generation).toBe(2);
    store.activate(sessionA);
    const secondA = store.readActiveIdentity();
    expect(secondA).toMatchObject({ generation: 3, session: sessionA });
    expect(secondA?.generation).not.toBe(firstA?.generation);

    expect(store.clearActive({
      roomCode: ROOM_CODE,
      role: "teacher",
      generation: firstA?.generation ?? -1
    })).toBe(false);
    expect(store.readActive()).toEqual(sessionA);
    expect(JSON.parse(String(storage.getItem("advertising-market:tab-session@1"))))
      .toMatchObject({ activeGeneration: 3 });
  });

  it("keeps working in memory when storage access or quota writes fail", () => {
    const broken: StoragePort = {
      getItem: () => { throw new DOMException("blocked", "SecurityError"); },
      setItem: () => { throw new DOMException("full", "QuotaExceededError"); },
      removeItem: () => { throw new DOMException("blocked", "SecurityError"); }
    };
    const store = makeStore(broken);
    expect(store.getClientId()).toBe(UUID_1);
    expect(store.beginIntent("create", FINGERPRINT).operationId).toBe(UUID_2);
    expect(() => store.activate({
      scheme: "Bearer", token: "payload.signature", role: "teacher", roomCode: ROOM_CODE, expiresAt: 2_000
    })).not.toThrow();
    expect(store.readActive()?.roomCode).toBe(ROOM_CODE);
  });

  it("rotates a copied client id and clears copied intent and bearer before readiness", async () => {
    const storage = new MemoryStorage();
    storage.setItem("advertising-market:tab-session@1", JSON.stringify({
      version: 1,
      clientId: UUID_1,
      intent: { kind: "join", operationId: UUID_2, fingerprint: FINGERPRINT },
      active: {
        scheme: "Bearer", token: "payload.signature", role: "team",
        roomCode: ROOM_CODE, expiresAt: 2_000
      }
    }));
    const claims: string[] = [];
    const coordinator: MarketTabCoordinationPort = {
      coordinate(clientId, rotate) {
        claims.push(clientId);
        rotate();
        return Promise.resolve();
      },
      close() {}
    };
    const store = new MarketSessionStore({
      storage,
      coordinator,
      nowSeconds: () => 1_000,
      randomUUID: () => UUID_3
    });

    await store.ensureReady();

    expect(claims).toEqual([UUID_1]);
    expect(store.getClientId()).toBe(UUID_3);
    expect(store.readIntent()).toBeNull();
    expect(store.readActive()).toBeNull();
    expect(String(storage.getItem("advertising-market:tab-session@1"))).not.toMatch(
      /payload\.signature|"intent"|"active"/
    );
  });

  it("rechecks coordinator health on readiness and forwards teardown", async () => {
    let calls = 0;
    let closed = false;
    const coordinator: MarketTabCoordinationPort = {
      coordinate() {
        calls += 1;
        return calls === 1
          ? Promise.resolve()
          : Promise.reject(new Error("coordination lost"));
      },
      close() { closed = true; }
    };
    const store = new MarketSessionStore({
      storage: new MemoryStorage(), coordinator, randomUUID: () => UUID_1
    });

    await expect(store.ensureReady()).resolves.toBeUndefined();
    await expect(store.ensureReady()).rejects.toThrow("coordination lost");
    store.close();
    expect(closed).toBe(true);
  });
});
