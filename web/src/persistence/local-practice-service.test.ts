import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { checkpointToken } from "../bridge/practice-contracts";
import { IndexedDbDraftStore } from "./draft-store";
import { LocalPracticeService } from "./local-practice-service";

describe("LocalPracticeService", () => {
  it("begins, locks, advances and replays only the active atomic result", async () => {
    let tick = 0;
    const service = new LocalPracticeService(new IndexedDbDraftStore({
      databaseName: "local-practice-service-lifecycle",
      factory: new IDBFactory()
    }), {
      now: () => new Date(Date.UTC(2026, 6, 17, 4, 0, tick++))
    });

    const begun = await service.begin("Neon Narwhals", "operation-begin-1");
    expect(begun.checkpoint).toMatchObject({
      teamAlias: "Neon Narwhals",
      stage: "invent",
      levelLocked: false,
      documentRevision: 0,
      sequence: 0,
      operationId: "operation-begin-1"
    });
    expect(begun.document.documentId).not.toBe("classroom-campaign");
    expect(begun.document.teamId).toBe(begun.checkpoint.teamId);

    const lockInput = {
      checkpoint: checkpointToken(begun),
      levelLocked: true,
      operationId: "operation-lock-1"
    } as const;
    const locked = await service.setLock(lockInput);
    expect(locked.checkpoint).toMatchObject({
      stage: "invent",
      levelLocked: true,
      documentRevision: 1,
      sequence: 1,
      operationId: "operation-lock-1"
    });
    expect(locked.document.revision).toBe(1);
    expect(await service.setLock(lockInput)).toEqual(locked);

    const advanced = await service.advance({
      checkpoint: checkpointToken(locked),
      nextStage: "sell",
      operationId: "operation-advance-1"
    });
    expect(advanced.checkpoint).toMatchObject({
      stage: "sell",
      levelLocked: false,
      documentRevision: 2,
      sequence: 2,
      operationId: "operation-advance-1"
    });
    expect(advanced.document.gameplay.stage).toBe("sell");

    await expect(service.setLock(lockInput)).rejects.toThrow(/stale/i);
    expect((await service.resume())?.checkpoint).toEqual(advanced.checkpoint);
  });

  it("commits an editor snapshot as the next exact revision", async () => {
    const service = new LocalPracticeService(new IndexedDbDraftStore({
      databaseName: "local-practice-service-editor",
      factory: new IDBFactory()
    }), {
      now: () => new Date("2026-07-17T04:00:00.000Z")
    });
    const begun = await service.begin("Signal Foxes", "operation-begin-editor");
    const snapshot = structuredClone(begun.document);
    snapshot.product.name = "Glow Cup";
    snapshot.gameplay.pair = {
      activeRole: "strategist",
      handoffCount: 1,
      artDirectorActions: 1,
      strategistActions: 1
    };

    const saved = await service.commitEditorSnapshot(
      snapshot,
      new Map(),
      "operation-editor-1"
    );
    expect(saved?.checkpoint).toMatchObject({
      documentRevision: 1,
      sequence: 1,
      stage: "invent",
      levelLocked: false,
      operationId: "operation-editor-1"
    });
    expect(saved?.document.product.name).toBe("Glow Cup");
    expect(saved?.document.gameplay.pair.activeRole).toBe("strategist");
  });

  it("rejects a stale editor snapshot without overwriting the active checkpoint", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "local-practice-service-stale-editor",
      factory: new IDBFactory()
    });
    const service = new LocalPracticeService(store, {
      now: () => new Date("2026-07-17T04:30:00.000Z")
    });
    const begun = await service.begin("Snapshot Owls", "operation-begin-stale-editor");
    const snapshotA = structuredClone(begun.document);
    snapshotA.product.name = "Committed A";
    const snapshotB = structuredClone(begun.document);
    snapshotB.product.name = "Stale B";

    const savedA = await service.commitEditorSnapshot(
      snapshotA,
      new Map(),
      "operation-editor-a"
    );
    await expect(service.commitEditorSnapshot(
      snapshotB,
      new Map(),
      "operation-editor-b"
    )).rejects.toThrow(/snapshot revision.*stale/i);

    expect(savedA?.document.product.name).toBe("Committed A");
    expect((await service.resume())?.document).toMatchObject({
      revision: 1,
      product: { name: "Committed A" }
    });
    expect(await store.loadRevision(begun.document.documentId, 2)).toBeNull();
  });
});
