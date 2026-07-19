import { describe, expect, it, vi } from "vitest";
import { createBlankCampaignDocument, type CampaignDocumentV1 } from "../domain/campaign-document";
import { AccountAssetClientError, type AccountAssetClient } from "./account-asset-client";
import {
  CloudAssetAdapterError,
  CloudProgressAssetAdapter,
  CloudProgressAssetRestore
} from "./cloud-asset-adapter";

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
]);

const digest = async (bytes: Uint8Array): Promise<string> => {
  const value = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

function documentWithLocalBlob(): CampaignDocumentV1 {
  const document = createBlankCampaignDocument({
    documentId: "campaign-main",
    sessionId: "practice-session",
    mode: "offline"
  });
  document.revision = 3;
  document.assetReferences = [
    { kind: "local-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png" },
    { kind: "local-blob", objectId: "image-two", blobKey: "photo-copy", mimeType: "image/png" },
    { kind: "generated", objectId: "image-one", model: "kept-local" },
    { kind: "cloud-blob", objectId: "image-one", blobKey: "old", mimeType: "image/png", byteLength: 1, sha256: "0".repeat(64) }
  ];
  return document;
}

function source(document: CampaignDocumentV1, blobs: ReadonlyMap<string, Blob>) {
  return {
    loadRevision: vi.fn().mockResolvedValue({ document: structuredClone(document), blobs: new Map(blobs) })
  };
}

function assetClient(): AccountAssetClient {
  return {
    put: vi.fn(async (blob: Blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return { sha256: await digest(bytes), contentType: "image/png" as const, byteLength: bytes.byteLength };
    }),
    get: vi.fn()
  };
}

describe("CloudProgressAssetAdapter", () => {
  it("preserves asset authentication expiry from upload", async () => {
    const document = documentWithLocalBlob();
    const expired = new AccountAssetClientError("AUTHENTICATION_REQUIRED");
    const client: AccountAssetClient = { put: vi.fn().mockRejectedValue(expired), get: vi.fn() };
    const adapter = new CloudProgressAssetAdapter({
      revisionSource: source(document, new Map([["photo", new Blob([png], { type: "image/png" })]])),
      client
    });

    await expect(adapter.prepare(document)).rejects.toBe(expired);
  });

  it("loads the exact local revision, uploads each body once, and replaces stale cloud references", async () => {
    const document = documentWithLocalBlob();
    const body = new Blob([png], { type: "image/png" });
    const revisionSource = source(document, new Map([["photo", body], ["photo-copy", body]]));
    const client = assetClient();
    const adapter = new CloudProgressAssetAdapter({ revisionSource, client });

    const prepared = await adapter.prepare(document);
    const sha256 = await digest(png);
    expect(revisionSource.loadRevision).toHaveBeenCalledWith("campaign-main", 3);
    expect(client.put).toHaveBeenCalledOnce();
    expect(prepared).not.toBe(document);
    expect(prepared.assetReferences).toEqual([
      { kind: "local-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png" },
      { kind: "local-blob", objectId: "image-two", blobKey: "photo-copy", mimeType: "image/png" },
      { kind: "generated", objectId: "image-one", model: "kept-local" },
      { kind: "cloud-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png", byteLength: png.byteLength, sha256 },
      { kind: "cloud-blob", objectId: "image-two", blobKey: "photo-copy", mimeType: "image/png", byteLength: png.byteLength, sha256 }
    ]);
    expect(JSON.stringify(prepared)).not.toContain("blob:");
  });

  it("returns an equivalent clone without uploading when there are no local blobs", async () => {
    const document = createBlankCampaignDocument({
      documentId: "campaign-empty", sessionId: "practice-session", mode: "offline"
    });
    const revisionSource = source(document, new Map());
    const client = assetClient();
    const adapter = new CloudProgressAssetAdapter({ revisionSource, client });

    await expect(adapter.prepare(document)).resolves.toEqual(document);
    expect(revisionSource.loadRevision).toHaveBeenCalledWith("campaign-empty", 0);
    expect(client.put).not.toHaveBeenCalled();
  });

  it.each([
    ["missing revision", null, new Map([["photo", new Blob([png], { type: "image/png" })]])],
    ["missing body", documentWithLocalBlob(), new Map<string, Blob>()],
    ["mismatched MIME", documentWithLocalBlob(), new Map([["photo", new Blob([png], { type: "image/jpeg" })]])]
  ])("fails closed for %s local data", async (_name, loaded, blobs) => {
    const document = documentWithLocalBlob();
    const revisionSource = { loadRevision: vi.fn().mockResolvedValue(loaded === null ? null : {
      document: loaded, blobs
    }) };
    const client = assetClient();
    const adapter = new CloudProgressAssetAdapter({ revisionSource, client });

    await expect(adapter.prepare(document)).rejects.toBeInstanceOf(CloudAssetAdapterError);
    expect(client.put).not.toHaveBeenCalled();
  });

  it("fails when the exact loaded identity or uploaded descriptor is inconsistent", async () => {
    const document = documentWithLocalBlob();
    const wrongRevision = structuredClone(document);
    wrongRevision.revision = 4;
    const revisionSource = source(wrongRevision, new Map([["photo", new Blob([png], { type: "image/png" })]]));
    const client = assetClient();
    const adapter = new CloudProgressAssetAdapter({ revisionSource, client });

    await expect(adapter.prepare(document)).rejects.toBeInstanceOf(CloudAssetAdapterError);
    expect(client.put).not.toHaveBeenCalled();

    const correctSource = source(document, new Map([["photo", new Blob([png], { type: "image/png" })]]));
    const inconsistentClient: AccountAssetClient = {
      put: vi.fn().mockResolvedValue({ sha256: "0".repeat(64), contentType: "image/png", byteLength: png.byteLength }),
      get: vi.fn()
    };
    const inconsistentAdapter = new CloudProgressAssetAdapter({ revisionSource: correctSource, client: inconsistentClient });
    await expect(inconsistentAdapter.prepare(document)).rejects.toBeInstanceOf(CloudAssetAdapterError);
  });

  it("does not reuse a content hash across incompatible local MIME declarations", async () => {
    const document = documentWithLocalBlob();
    document.assetReferences = document.assetReferences.map((reference) =>
      reference.kind === "local-blob" && reference.objectId === "image-two"
        ? { ...reference, mimeType: "image/jpeg" }
        : reference
    );
    const client = assetClient();
    const adapter = new CloudProgressAssetAdapter({
      revisionSource: source(document, new Map([
        ["photo", new Blob([png], { type: "image/png" })],
        ["photo-copy", new Blob([png], { type: "image/jpeg" })]
      ])),
      client
    });

    await expect(adapter.prepare(document)).rejects.toBeInstanceOf(CloudAssetAdapterError);
    expect(client.put).toHaveBeenCalledOnce();
  });
});

describe("CloudProgressAssetRestore", () => {
  it("preserves asset authentication expiry from download", async () => {
    const document = documentWithLocalBlob();
    const expired = new AccountAssetClientError("AUTHENTICATION_REQUIRED");
    document.assetReferences = [
      { kind: "local-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png" },
      { kind: "cloud-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png", byteLength: png.byteLength, sha256: "a".repeat(64) }
    ];
    const restore = new CloudProgressAssetRestore({
      client: { put: vi.fn(), get: vi.fn().mockRejectedValue(expired) }
    });

    await expect(restore.restore(document)).rejects.toBe(expired);
  });

  it("rebinds validated cloud descriptors to local blob references with one download per hash", async () => {
    const document = documentWithLocalBlob();
    const sha256 = await digest(png);
    document.assetReferences = document.assetReferences.filter((reference) => reference.kind !== "cloud-blob");
    document.assetReferences.push(
      { kind: "cloud-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png", byteLength: png.byteLength, sha256 },
      { kind: "cloud-blob", objectId: "image-two", blobKey: "photo-copy", mimeType: "image/png", byteLength: png.byteLength, sha256 }
    );
    const client: AccountAssetClient = {
      put: vi.fn(),
      get: vi.fn().mockResolvedValue({
        sha256,
        contentType: "image/png",
        byteLength: png.byteLength,
        blob: new Blob([png], { type: "image/png" })
      })
    };
    const restore = new CloudProgressAssetRestore({ client });

    const restored = await restore.restore(document);

    expect(client.get).toHaveBeenCalledOnce();
    expect(client.get).toHaveBeenCalledWith(sha256);
    expect(restored.document).toEqual(document);
    expect(restored.document).not.toBe(document);
    expect(restored.blobs).toBeInstanceOf(Map);
    expect([...restored.blobs.keys()]).toEqual(["photo", "photo-copy"]);
    expect(await restored.blobs.get("photo")?.arrayBuffer()).toEqual(await new Blob([png]).arrayBuffer());
  });

  it("returns cloned offline documents with no downloads when no local references exist", async () => {
    const document = createBlankCampaignDocument({
      documentId: "campaign-empty", sessionId: "practice-session", mode: "offline"
    });
    const client = assetClient();
    const restore = new CloudProgressAssetRestore({ client });

    const restored = await restore.restore(document);

    expect(restored.document).toEqual(document);
    expect(restored.document).not.toBe(document);
    expect(restored.blobs).toEqual(new Map());
    expect(client.get).not.toHaveBeenCalled();
  });

  it("restores shared local blob keys once when every cloud binding agrees", async () => {
    const document = createBlankCampaignDocument({
      documentId: "campaign-shared", sessionId: "practice-session", mode: "offline"
    });
    const sha256 = await digest(png);
    document.assetReferences = [
      { kind: "local-blob", objectId: "image-one", blobKey: "shared-photo", mimeType: "image/png" },
      { kind: "local-blob", objectId: "image-two", blobKey: "shared-photo", mimeType: "image/png" },
      { kind: "cloud-blob", objectId: "image-one", blobKey: "shared-photo", mimeType: "image/png", byteLength: png.byteLength, sha256 },
      { kind: "cloud-blob", objectId: "image-two", blobKey: "shared-photo", mimeType: "image/png", byteLength: png.byteLength, sha256 }
    ];
    const client: AccountAssetClient = {
      put: vi.fn(),
      get: vi.fn().mockResolvedValue({
        sha256, contentType: "image/png", byteLength: png.byteLength,
        blob: new Blob([png], { type: "image/png" })
      })
    };

    const restored = await new CloudProgressAssetRestore({ client }).restore(document);

    expect(client.get).toHaveBeenCalledOnce();
    expect([...restored.blobs.keys()]).toEqual(["shared-photo"]);
  });

  it("rejects conflicting MIME or length descriptors before deduplicating a shared hash", async () => {
    const sha256 = await digest(png);
    const client = assetClient();
    const restore = new CloudProgressAssetRestore({ client });
    for (const [mimeType, byteLength] of [["image/jpeg", png.byteLength], ["image/png", png.byteLength + 1]] as const) {
      const document = createBlankCampaignDocument({
        documentId: "campaign-hash-conflict", sessionId: "practice-session", mode: "offline"
      });
      document.assetReferences = [
        { kind: "local-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png" },
        { kind: "local-blob", objectId: "image-two", blobKey: "photo-copy", mimeType },
        { kind: "cloud-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png", byteLength: png.byteLength, sha256 },
        { kind: "cloud-blob", objectId: "image-two", blobKey: "photo-copy", mimeType, byteLength, sha256 }
      ];
      await expect(restore.restore(document)).rejects.toBeInstanceOf(CloudAssetAdapterError);
    }
    expect(client.get).not.toHaveBeenCalled();
  });

  it("fails closed for incomplete, duplicate, malformed, or inconsistent cloud asset bindings", async () => {
    const document = documentWithLocalBlob();
    const sha256 = await digest(png);
    document.assetReferences = [
      { kind: "local-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png" },
      { kind: "cloud-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png", byteLength: png.byteLength, sha256 },
      { kind: "cloud-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png", byteLength: png.byteLength, sha256 }
    ];
    const client = assetClient();
    const restore = new CloudProgressAssetRestore({ client });

    await expect(restore.restore(document)).rejects.toBeInstanceOf(CloudAssetAdapterError);
    expect(client.get).not.toHaveBeenCalled();

    const conflictingReuse = createBlankCampaignDocument({
      documentId: "campaign-conflict", sessionId: "practice-session", mode: "offline"
    });
    conflictingReuse.assetReferences = [
      { kind: "local-blob", objectId: "image-one", blobKey: "shared-photo", mimeType: "image/png" },
      { kind: "local-blob", objectId: "image-two", blobKey: "shared-photo", mimeType: "image/png" },
      { kind: "cloud-blob", objectId: "image-one", blobKey: "shared-photo", mimeType: "image/png", byteLength: png.byteLength, sha256 },
      { kind: "cloud-blob", objectId: "image-two", blobKey: "shared-photo", mimeType: "image/png", byteLength: png.byteLength, sha256: "0".repeat(64) }
    ];
    await expect(restore.restore(conflictingReuse)).rejects.toBeInstanceOf(CloudAssetAdapterError);
    expect(client.get).not.toHaveBeenCalled();

    const malformed = structuredClone(document);
    malformed.assetReferences = [
      { kind: "local-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png" },
      {
        kind: "cloud-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png",
        byteLength: png.byteLength, sha256, surprise: true
      }
    ];
    await expect(restore.restore(malformed)).rejects.toBeInstanceOf(CloudAssetAdapterError);

    const oversized = structuredClone(document);
    oversized.assetReferences = [
      { kind: "local-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png" },
      {
        kind: "cloud-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png",
        byteLength: 4 * 1_024 * 1_024 + 1, sha256
      }
    ];
    await expect(restore.restore(oversized)).rejects.toBeInstanceOf(CloudAssetAdapterError);
    expect(client.get).not.toHaveBeenCalled();

    const inconsistent = structuredClone(malformed);
    inconsistent.assetReferences = inconsistent.assetReferences.map((reference) => reference.kind === "cloud-blob"
      ? { kind: "cloud-blob", objectId: "image-one", blobKey: "photo", mimeType: "image/png", byteLength: png.byteLength, sha256 }
      : reference);
    const inconsistentClient: AccountAssetClient = {
      put: vi.fn(),
      get: vi.fn().mockResolvedValue({
        sha256: "0".repeat(64), contentType: "image/png", byteLength: png.byteLength,
        blob: new Blob([png], { type: "image/png" })
      })
    };
    await expect(new CloudProgressAssetRestore({ client: inconsistentClient }).restore(inconsistent))
      .rejects.toBeInstanceOf(CloudAssetAdapterError);
  });
});
