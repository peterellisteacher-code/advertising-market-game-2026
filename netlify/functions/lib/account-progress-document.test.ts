// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../../../web/src/domain/campaign-document";
import { parseCloudProgressDocument } from "./account-progress-document";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

const nestedRecord = (depth: number): Record<string, unknown> => {
  let value: Record<string, unknown> = { leaf: true };
  for (let index = 0; index < depth; index += 1) value = { child: value };
  return value;
};

const validDocument = (): CampaignDocumentV1 => {
  const document = createBlankCampaignDocument({
    documentId: "campaign-main",
    sessionId: "practice-session",
    teamId: "practice-team",
    mode: "offline"
  });
  document.revision = 3;
  return document;
};

const withLocalAsset = (): CampaignDocumentV1 => {
  const document = validDocument();
  document.fabricState.objects = [{
    type: "image",
    objectId: "image-one",
    elementKind: "image",
    accessibleName: "Uploaded image",
    src: "local-blob:photo"
  }];
  document.assetReferences = [
    { kind: "generated", objectId: "image-one", model: "kept" },
    {
      kind: "local-blob",
      objectId: "image-one",
      blobKey: "photo",
      mimeType: "image/png"
    },
    {
      kind: "cloud-blob",
      objectId: "image-one",
      blobKey: "photo",
      mimeType: "image/png",
      byteLength: 1_024,
      sha256: SHA_A
    }
  ];
  return document;
};

describe("cloud progress campaign document", () => {
  it("rejects excessive nesting outside Fabric before admitting cloud progress", () => {
    const document = validDocument();
    document.drawingLayers = [{ settings: nestedRecord(140) }];

    expect(() => parseCloudProgressDocument(document, "campaign-main"))
      .toThrow("INVALID_CLOUD_PROGRESS_DOCUMENT");
  });

  it("applies the same nesting bound to generic asset metadata", () => {
    const document = validDocument();
    document.assetReferences = [{
      kind: "generated",
      objectId: "generated-one",
      settings: nestedRecord(140)
    }];

    expect(() => parseCloudProgressDocument(document, "campaign-main"))
      .toThrow("INVALID_CLOUD_PROGRESS_DOCUMENT");
  });

  it("rejects cycles and aliases outside Fabric before schema parsing", () => {
    const cyclic = validDocument();
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    cyclic.drawingLayers = [{ settings: cycle }];

    const aliased = validDocument();
    const shared = { value: true };
    aliased.drawingLayers = [{ left: shared, right: shared }];

    for (const document of [cyclic, aliased]) {
      expect(() => parseCloudProgressDocument(document, "campaign-main"))
        .toThrow("INVALID_CLOUD_PROGRESS_DOCUMENT");
    }
  });

  it("admits valid non-Fabric metadata near the shared depth boundary", () => {
    const document = validDocument();
    document.drawingLayers = [{ settings: nestedRecord(120) }];

    expect(parseCloudProgressDocument(document, "campaign-main")).toEqual(document);
  });

  it("parses a canonical offline snapshot and preserves legitimate non-blob references", () => {
    const document = withLocalAsset();

    const parsed = parseCloudProgressDocument(document, "campaign-main");

    expect(parsed).toEqual(document);
    expect(parsed).not.toBe(document);
    expect(parsed.assetReferences[0]).toEqual({
      kind: "generated",
      objectId: "image-one",
      model: "kept"
    });
  });

  it("accepts the catalogue asset identity carried by a local blob reference", () => {
    const document = withLocalAsset();
    document.assetReferences[1] = {
      ...document.assetReferences[1]!,
      assetId: "catalogue-product-one"
    };

    expect(parseCloudProgressDocument(document, "campaign-main")).toEqual(document);
  });

  it("rejects malformed, room-mode, room-bound, or envelope-mismatched snapshots", () => {
    const room = createBlankCampaignDocument({
      documentId: "campaign-main",
      sessionId: "room-session",
      mode: "room",
      roomId: "room-one",
      teamId: "team-one"
    });
    const roomBound = { ...validDocument(), roomId: "stale-room" };

    for (const [value, documentId] of [
      [{ headline: "not a campaign" }, "campaign-main"],
      [room, "campaign-main"],
      [roomBound, "campaign-main"],
      [validDocument(), "different-document"]
    ] as const) {
      expect(() => parseCloudProgressDocument(value, documentId)).toThrow();
    }
  });

  it("requires every local blob to have one exact matching bounded cloud descriptor", () => {
    const mutations: Array<(document: CampaignDocumentV1) => void> = [
      (document) => { document.assetReferences.pop(); },
      (document) => { document.assetReferences[2] = { ...document.assetReferences[2]!, objectId: "other" }; },
      (document) => { document.assetReferences.push(structuredClone(document.assetReferences[1]!)); },
      (document) => { document.assetReferences.push(structuredClone(document.assetReferences[2]!)); },
      (document) => { document.assetReferences[2] = { ...document.assetReferences[2]!, mimeType: "image/jpeg" }; },
      (document) => { document.assetReferences[2] = { ...document.assetReferences[2]!, byteLength: 0 }; },
      (document) => { document.assetReferences[2] = { ...document.assetReferences[2]!, byteLength: 4 * 1_024 * 1_024 + 1 }; },
      (document) => { document.assetReferences[2] = { ...document.assetReferences[2]!, sha256: SHA_A.toUpperCase() }; },
      (document) => { document.assetReferences[2] = { ...document.assetReferences[2]!, extra: true }; },
      (document) => { document.assetReferences[1] = { ...document.assetReferences[1]!, assetId: "" }; },
      (document) => {
        document.assetReferences[1] = {
          ...document.assetReferences[1]!,
          assetId: "x".repeat(257)
        };
      },
      (document) => {
        document.assetReferences[1] = {
          ...document.assetReferences[1]!,
          assetId: "catalogue-product-one",
          extra: true
        };
      }
    ];

    for (const mutate of mutations) {
      const document = withLocalAsset();
      mutate(document);
      expect(() => parseCloudProgressDocument(document, "campaign-main")).toThrow();
    }
  });

  it("rejects conflicting descriptors that alias one blob key or digest", () => {
    const blobKeyConflict = withLocalAsset();
    blobKeyConflict.fabricState.objects.push({
      type: "image",
      objectId: "image-two",
      elementKind: "image",
      accessibleName: "Second image",
      src: "local-blob:photo"
    });
    blobKeyConflict.assetReferences.push(
      { kind: "local-blob", objectId: "image-two", blobKey: "photo", mimeType: "image/png" },
      {
        kind: "cloud-blob",
        objectId: "image-two",
        blobKey: "photo",
        mimeType: "image/png",
        byteLength: 1_024,
        sha256: SHA_B
      }
    );

    const digestConflict = withLocalAsset();
    digestConflict.fabricState.objects.push({
      type: "image",
      objectId: "image-two",
      elementKind: "image",
      accessibleName: "Second image",
      src: "local-blob:second"
    });
    digestConflict.assetReferences.push(
      { kind: "local-blob", objectId: "image-two", blobKey: "second", mimeType: "image/jpeg" },
      {
        kind: "cloud-blob",
        objectId: "image-two",
        blobKey: "second",
        mimeType: "image/jpeg",
        byteLength: 2_048,
        sha256: SHA_A
      }
    );

    expect(() => parseCloudProgressDocument(blobKeyConflict, "campaign-main")).toThrow();
    expect(() => parseCloudProgressDocument(digestConflict, "campaign-main")).toThrow();
  });

  it("requires each locally referenced Fabric source to use its exact durable blob key", () => {
    for (const source of [
      "blob:https://game.example/temporary",
      "https://game.example/object-url",
      "local-blob:other"
    ]) {
      const document = withLocalAsset();
      (document.fabricState.objects[0] as Record<string, unknown>).src = source;
      expect(() => parseCloudProgressDocument(document, "campaign-main")).toThrow();
    }
  });

  it("rejects a transient Fabric blob URL even when its local asset metadata was omitted", () => {
    const document = validDocument();
    document.fabricState.objects = [{
      type: "image",
      objectId: "untracked-image",
      elementKind: "image",
      accessibleName: "Untracked image",
      src: "blob:https://game.example/temporary"
    }];

    expect(() => parseCloudProgressDocument(document, "campaign-main")).toThrow();
  });

  it("rejects blob Fabric sources using URL protocol parsing, including case and leading C0 controls", () => {
    for (const source of [
      "blob:https://game.example/temporary",
      "BLOB:https://game.example/temporary",
      "\u001fblob:https://game.example/temporary"
    ]) {
      const document = validDocument();
      document.fabricState.objects = [{
        type: "image",
        objectId: "untracked-image",
        elementKind: "image",
        accessibleName: "Untracked image",
        src: source
      }];
      expect(() => parseCloudProgressDocument(document, "campaign-main")).toThrow();
    }
  });

  it("rejects blob URLs nested in non-semantic Fabric decorations", () => {
    for (const source of [
      "blob:https://game.example/temporary",
      "BLOB:https://game.example/temporary",
      "\u001fblob:https://game.example/temporary"
    ]) {
      const document = validDocument();
      document.fabricState.objects = [{
        type: "rect",
        objectId: "poster-background",
        elementKind: "shape",
        accessibleName: "Poster background",
        decoration: {
          productLayer: "base-shell",
          src: source
        }
      }];

      expect(() => parseCloudProgressDocument(document, "campaign-main")).toThrow();
    }
  });

  it("rejects blob URLs in top-level Fabric passthrough nodes", () => {
    for (const source of [
      "blob:https://game.example/temporary",
      "BLOB:https://game.example/temporary",
      "\u001fblob:https://game.example/temporary"
    ]) {
      const document = validDocument();
      (document.fabricState as Record<string, unknown>).backgroundImage = {
        type: "image",
        src: source
      };

      expect(() => parseCloudProgressDocument(document, "campaign-main")).toThrow();
    }
  });

  it("rejects cyclic top-level Fabric passthrough graphs before schema refinement", () => {
    const document = validDocument();
    const fabricState = document.fabricState as Record<string, unknown>;
    fabricState.backgroundImage = fabricState;

    expect(() => parseCloudProgressDocument(document, "campaign-main"))
      .toThrow("INVALID_CLOUD_PROGRESS_DOCUMENT");
  });

  it("rejects aliased top-level Fabric passthrough objects before schema refinement", () => {
    const document = validDocument();
    const shared = { type: "image", src: "https://game.example/shared.png" };
    const fabricState = document.fabricState as Record<string, unknown>;
    fabricState.backgroundImage = shared;
    fabricState.overlayImage = shared;

    expect(() => parseCloudProgressDocument(document, "campaign-main"))
      .toThrow("INVALID_CLOUD_PROGRESS_DOCUMENT");
  });

  it("rejects every untracked local-blob Fabric source", () => {
    const document = validDocument();
    document.fabricState.objects = [{
      type: "image",
      objectId: "untracked-image",
      elementKind: "image",
      accessibleName: "Untracked local image",
      src: "local-blob:photo"
    }];
    document.assetReferences = [];

    expect(() => parseCloudProgressDocument(document, "campaign-main"))
      .toThrow("INVALID_CLOUD_PROGRESS_DOCUMENT");
  });

  it("rejects a passthrough local source that reuses a tracked descriptor pair", () => {
    const document = withLocalAsset();
    (document.fabricState as Record<string, unknown>).overlayImage = {
      type: "image",
      objectId: "image-one",
      src: "local-blob:photo"
    };

    expect(() => parseCloudProgressDocument(document, "campaign-main"))
      .toThrow("INVALID_CLOUD_PROGRESS_DOCUMENT");
  });

  it("permits durable HTTPS and data Fabric sources without local asset metadata", () => {
    for (const source of [
      "https://game.example/assets/durable-image.png",
      "data:image/png;base64,iVBORw0KGgo="
    ]) {
      const document = validDocument();
      document.fabricState.objects = [{
        type: "image",
        objectId: "durable-image",
        elementKind: "image",
        accessibleName: "Durable image",
        src: source
      }];
      expect(parseCloudProgressDocument(document, "campaign-main")).toEqual(document);
    }
  });

  it("requires a nonempty team identity on every cloud progress document", () => {
    for (const teamId of [undefined, ""]) {
      const document = validDocument();
      document.teamId = teamId;
      expect(() => parseCloudProgressDocument(document, "campaign-main")).toThrow();
    }
  });

  it("rejects document identities that the local cloud importer cannot recover", () => {
    const invalidDocuments: CampaignDocumentV1[] = [];
    for (const mutate of [
      (document: CampaignDocumentV1) => { document.sessionId = document.documentId; },
      (document: CampaignDocumentV1) => { document.teamId = document.sessionId; },
      (document: CampaignDocumentV1) => { document.sessionId = "classroom-campaign"; },
      (document: CampaignDocumentV1) => { document.teamId = "classroom-campaign"; },
      (document: CampaignDocumentV1) => { document.sessionId = "invalid identity"; },
      (document: CampaignDocumentV1) => { document.teamId = `t${"x".repeat(128)}`; }
    ]) {
      const document = validDocument();
      mutate(document);
      invalidDocuments.push(document);
    }
    const reservedDocument = validDocument();
    reservedDocument.documentId = "classroom-campaign";
    const nonCloudDocument = validDocument();
    nonCloudDocument.documentId = "Practice:Document";

    for (const document of invalidDocuments) {
      expect(() => parseCloudProgressDocument(document, document.documentId))
        .toThrow("INVALID_CLOUD_PROGRESS_DOCUMENT");
    }
    expect(() => parseCloudProgressDocument(reservedDocument, "classroom-campaign"))
      .toThrow("INVALID_CLOUD_PROGRESS_DOCUMENT");
    expect(() => parseCloudProgressDocument(nonCloudDocument, "Practice:Document"))
      .toThrow("INVALID_CLOUD_PROGRESS_DOCUMENT");
  });
});
