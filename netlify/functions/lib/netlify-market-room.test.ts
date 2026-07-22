import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createMarketRoom, joinTeam, registerArtworkUpload } from "./market-state";
import {
  MarketRoomService,
  MarketRoomServiceError,
  createNetlifyMarketRoomRepository,
  marketArtworkKey,
  marketArtworkPrefix,
  marketStateKey,
  type MarketRoomEnvelope,
  type MarketRoomRepository
} from "./netlify-market-room";
import type { MarketRoom } from "./market-contracts";

const initialRoom = (): MarketRoom => createMarketRoom({
  roomId: "room-server-id",
  openingWallet: 10_000,
  now: 1_000
});

const legacyInitialRoom = (): unknown => {
  const state = initialRoom();
  const {
    marketMode: _marketMode,
    marketCohort: _marketCohort,
    commandReceipts: _commandReceipts,
    sessionBindings: _sessionBindings,
    ...legacy
  } = state;
  return { ...legacy, schemaVersion: 1 };
};

class MemoryRepository implements MarketRoomRepository {
  entry: { value: MarketRoomEnvelope; etag: number } | null = null;
  readonly artwork = new Map<string, Uint8Array>();
  writeConflicts = 0;
  beforeConflict?: (repository: MemoryRepository) => void;

  seed(value: unknown): void {
    this.entry = { value: structuredClone(value) as MarketRoomEnvelope, etag: 1 };
  }

  async read(): Promise<{ value: unknown; etag: string } | null> {
    return this.entry
      ? { value: structuredClone(this.entry.value), etag: String(this.entry.etag) }
      : null;
  }

  async create(_roomCode: string, value: MarketRoomEnvelope): Promise<boolean> {
    if (this.entry) return false;
    this.entry = { value: structuredClone(value), etag: 1 };
    return true;
  }

  async compareAndSwap(
    _roomCode: string,
    value: MarketRoomEnvelope,
    etag: string
  ): Promise<boolean> {
    if (this.writeConflicts > 0) {
      this.writeConflicts -= 1;
      this.beforeConflict?.(this);
      return false;
    }
    if (!this.entry || String(this.entry.etag) !== etag) return false;
    this.entry = { value: structuredClone(value), etag: this.entry.etag + 1 };
    return true;
  }

  async putArtwork(key: string, bytes: Uint8Array): Promise<boolean> {
    if (this.artwork.has(key)) return false;
    this.artwork.set(key, bytes.slice());
    return true;
  }

  async getArtwork(key: string): Promise<Uint8Array | null> {
    return this.artwork.get(key)?.slice() ?? null;
  }
}

describe("market Blob keys and adapter", () => {
  it("uses hashed room state and hashed room/team/content artwork keys", () => {
    const roomHash = createHash("sha256").update("ABC-234", "utf8").digest("hex");
    const teamHash = createHash("sha256").update("team-1", "utf8").digest("hex");
    const contentHash = createHash("sha256").update(Uint8Array.of(1, 2, 3)).digest("hex");

    expect(marketStateKey("ABC-234")).toBe(`rooms/${roomHash}/state`);
    expect(marketArtworkPrefix("ABC-234", "team-1"))
      .toBe(`rooms/${roomHash}/artwork/${teamHash}/`);
    expect(marketArtworkKey("ABC-234", "team-1", Uint8Array.of(1, 2, 3)))
      .toBe(`rooms/${roomHash}/artwork/${teamHash}/${contentHash}.png`);
  });

  it("preserves ETag conditions, strong-store values and immutable PNG metadata", async () => {
    const envelope = { version: 1 as const, expiresAt: 2_000, state: initialRoom() };
    const png = Uint8Array.of(137, 80, 78, 71);
    const store = {
      getWithMetadata: vi.fn()
        .mockResolvedValueOnce({ data: envelope, etag: '"etag-1"' })
        .mockResolvedValueOnce({ data: png.buffer }),
      setJSON: vi.fn().mockResolvedValue({ modified: true }),
      set: vi.fn().mockResolvedValue({ modified: true })
    };
    const repository = createNetlifyMarketRoomRepository(store);

    await expect(repository.read("ABC-234")).resolves.toEqual({
      value: envelope,
      etag: '"etag-1"'
    });
    await expect(repository.create("ABC-234", envelope)).resolves.toBe(true);
    await expect(repository.compareAndSwap("ABC-234", envelope, '"etag-1"'))
      .resolves.toBe(true);
    await expect(repository.putArtwork("asset.png", png)).resolves.toBe(true);
    await expect(repository.getArtwork("asset.png")).resolves.toEqual(png);

    expect(store.setJSON).toHaveBeenNthCalledWith(
      1,
      marketStateKey("ABC-234"),
      envelope,
      { onlyIfNew: true }
    );
    expect(store.setJSON).toHaveBeenNthCalledWith(
      2,
      marketStateKey("ABC-234"),
      envelope,
      { onlyIfMatch: '"etag-1"' }
    );
    expect(store.set).toHaveBeenCalledWith("asset.png", png, {
      onlyIfNew: true,
      metadata: { contentType: "image/png" }
    });
  });

  it("fails closed when state metadata has no ETag", async () => {
    const repository = createNetlifyMarketRoomRepository({
      getWithMetadata: vi.fn().mockResolvedValue({ data: { version: 1 } }),
      setJSON: vi.fn(),
      set: vi.fn()
    });
    await expect(repository.read("ABC-234")).rejects.toThrow("ETag");
  });
});

describe("MarketRoomService", () => {
  it("normalizes a legacy read in memory without rewriting storage", async () => {
    const repository = new MemoryRepository();
    repository.seed({ version: 1, expiresAt: 2_000, state: legacyInitialRoom() });
    const service = new MarketRoomService(repository);
    const write = vi.spyOn(repository, "compareAndSwap");

    const result = await service.read("ABC-234", 1_500);

    expect(result.state).toMatchObject({
      schemaVersion: 2,
      marketCohort: null,
      commandReceipts: {},
      sessionBindings: { createdBy: null, joins: {} }
    });
    expect(repository.entry?.value.state.schemaVersion).toBe(1);
    expect(write).not.toHaveBeenCalled();
  });

  it("persists normalized v2 state on the next successful CAS and preserves expiry", async () => {
    const repository = new MemoryRepository();
    repository.seed({ version: 1, expiresAt: 2_000, state: legacyInitialRoom() });
    const service = new MarketRoomService(repository);

    const result = await service.mutate("ABC-234", 1_200, (state) => ({
      state: joinTeam(state, {
        expectedRevision: state.revision,
        teamId: "team-1",
        alias: "Pixel Pirates",
        now: 1_200
      }),
      result: "joined"
    }));

    expect(result.state.schemaVersion).toBe(2);
    expect(repository.entry?.value).toMatchObject({
      version: 1,
      expiresAt: 2_000,
      state: { schemaVersion: 2, teams: { "team-1": { alias: "Pixel Pirates" } } }
    });
  });

  it("fails closed for malformed legacy and v2 envelopes", async () => {
    const repository = new MemoryRepository();
    const service = new MarketRoomService(repository);
    repository.seed({
      version: 1,
      expiresAt: 2_000,
      state: { ...(legacyInitialRoom() as Record<string, unknown>), extra: true }
    });
    await expect(service.read("ABC-234", 1_500)).rejects.toMatchObject({
      code: "STATE_UNAVAILABLE"
    });

    repository.seed({
      version: 1,
      expiresAt: 2_000,
      state: { ...initialRoom(), schemaVersion: 2, sessionBindings: { createdBy: null, joins: {}, extra: true } }
    });
    await expect(service.read("ABC-234", 1_500)).rejects.toMatchObject({
      code: "STATE_UNAVAILABLE"
    });
  });

  it("creates once, reads strongly consistent state, and rejects expiry without deletion", async () => {
    const repository = new MemoryRepository();
    const service = new MarketRoomService(repository);
    const state = initialRoom();

    await expect(service.create("ABC-234", state, 2_000)).resolves.toBe(true);
    await expect(service.create("ABC-234", state, 2_000)).resolves.toBe(false);
    await expect(service.read("ABC-234", 1_500)).resolves.toEqual({ state, expiresAt: 2_000 });
    await expect(service.read("ABC-234", 2_000)).rejects.toMatchObject({ code: "ROOM_EXPIRED" });
    expect(repository.entry).not.toBeNull();
  });

  it("re-reads and reapplies a pure mutation after an ETag conflict", async () => {
    const repository = new MemoryRepository();
    const service = new MarketRoomService(repository);
    await service.create("ABC-234", initialRoom(), 2_000);
    repository.writeConflicts = 1;
    repository.beforeConflict = (current) => {
      const stored = current.entry!;
      const externalState = joinTeam(stored.value.state, {
        expectedRevision: stored.value.state.revision,
        teamId: "team-external",
        alias: "External Owls",
        now: 1_100
      });
      stored.value = { ...stored.value, state: externalState };
      stored.etag += 1;
    };
    let calls = 0;

    const result = await service.mutate("ABC-234", 1_200, (state) => {
      calls += 1;
      const next = joinTeam(state, {
        expectedRevision: state.revision,
        teamId: "team-local",
        alias: "Local Sparks",
        now: 1_200
      });
      return { state: next, result: next.teams["team-local"]! };
    });

    expect(calls).toBe(2);
    expect(result.state.teams).toMatchObject({
      "team-external": { alias: "External Owls" },
      "team-local": { alias: "Local Sparks" }
    });
  });

  it("reapplies an artwork-ledger registration against a competing CAS write", async () => {
    const repository = new MemoryRepository();
    const service = new MarketRoomService(repository);
    const joined = joinTeam(initialRoom(), {
      expectedRevision: 0,
      teamId: "team-1",
      alias: "Pixel Pirates",
      now: 1_050
    });
    await service.create("ABC-234", joined, 2_000);
    const externalBytes = Uint8Array.of(1, 2, 3);
    const localBytes = Uint8Array.of(4, 5, 6);
    repository.writeConflicts = 1;
    repository.beforeConflict = (current) => {
      const stored = current.entry!;
      const contentHash = createHash("sha256").update(externalBytes).digest("hex");
      const external = registerArtworkUpload(stored.value.state, {
        expectedRevision: stored.value.state.revision,
        teamId: "team-1",
        contentHash,
        artworkKey: marketArtworkKey("ABC-234", "team-1", externalBytes),
        byteLength: externalBytes.byteLength,
        now: 1_100
      });
      stored.value = { ...stored.value, state: external.state };
      stored.etag += 1;
    };
    let calls = 0;

    const result = await service.mutate("ABC-234", 1_200, (state) => {
      calls += 1;
      const contentHash = createHash("sha256").update(localBytes).digest("hex");
      const local = registerArtworkUpload(state, {
        expectedRevision: state.revision,
        teamId: "team-1",
        contentHash,
        artworkKey: marketArtworkKey("ABC-234", "team-1", localBytes),
        byteLength: localBytes.byteLength,
        now: 1_200
      });
      return { state: local.state, result: local.upload };
    });

    expect(calls).toBe(2);
    expect(Object.keys(result.state.artworkUploadsByTeam["team-1"]!)).toHaveLength(2);
    expect(result.result.artworkKey).toBe(marketArtworkKey("ABC-234", "team-1", localBytes));
  });

  it("returns an idempotent no-change result without a Blob write", async () => {
    const repository = new MemoryRepository();
    const service = new MarketRoomService(repository);
    await service.create("ABC-234", initialRoom(), 2_000);
    const write = vi.spyOn(repository, "compareAndSwap");

    const result = await service.mutate("ABC-234", 1_200, (state) => ({
      state,
      result: "original"
    }));

    expect(result.result).toBe("original");
    expect(write).not.toHaveBeenCalled();
  });

  it("stores identical artwork idempotently and reads it by its immutable key", async () => {
    const repository = new MemoryRepository();
    const service = new MarketRoomService(repository);
    const bytes = Uint8Array.of(1, 2, 3);

    const first = await service.storeArtwork("ABC-234", "team-1", bytes);
    const second = await service.storeArtwork("ABC-234", "team-1", bytes);

    expect(first).toBe(second);
    await expect(service.readArtwork(first)).resolves.toEqual(bytes);
    await expect(service.readArtwork("missing.png")).rejects.toBeInstanceOf(MarketRoomServiceError);
  });
});
