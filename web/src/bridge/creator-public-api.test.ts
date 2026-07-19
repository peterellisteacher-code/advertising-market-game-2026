import { describe, expect, it } from "vitest";
import {
  CREATOR_BRIDGE_CONTRACT,
  CreatorResponseSchema,
  type CreatorBridgeHandler,
  type CreatorRequest,
  type CreatorResponse
} from "./contracts";
import { createCreatorPublicApi } from "./creator-public-api";
import {
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";

const blankDocument = createBlankCampaignDocument({
  documentId: "bridge-document",
  sessionId: "bridge-session",
  mode: "offline"
});

class HandlerHarness implements CreatorBridgeHandler {
  document: CampaignDocumentV1 = structuredClone(blankDocument);
  latestDocument: CampaignDocumentV1 | null = structuredClone(blankDocument);
  opened: CampaignDocumentV1[] = [];
  saveCount = 0;
  closeCount = 0;

  async open(document: CampaignDocumentV1): Promise<void> {
    this.document = structuredClone(document);
    this.opened.push(structuredClone(document));
  }

  async loadLatest(documentId: string): Promise<CampaignDocumentV1 | null> {
    if (this.latestDocument?.documentId !== documentId) return null;
    return structuredClone(this.latestDocument);
  }

  async getState(): Promise<CampaignDocumentV1> {
    return structuredClone(this.document);
  }

  async save(): Promise<void> {
    this.saveCount += 1;
  }

  async publish() {
    return {
      contract: "published-campaign@1" as const,
      documentId: this.document.documentId,
      revision: this.document.revision,
      pngBytes: Uint8Array.from([0, 1, 2, 253, 254, 255]),
      metadata: {
        productName: this.document.product.name,
        priceCents: 0,
        brief: structuredClone(this.document.brief),
        evidence: structuredClone(this.document.evidence),
        assetReferences: structuredClone(this.document.assetReferences)
      }
    };
  }

  async close(): Promise<void> {
    this.closeCount += 1;
  }
}

function request(
  requestId: string,
  method: CreatorRequest["method"],
  payload: unknown
): CreatorRequest {
  return { contract: CREATOR_BRIDGE_CONTRACT, requestId, method, payload };
}

async function parseResponse(
  api: { handle(requestJson: string): Promise<string> },
  value: CreatorRequest | string
): Promise<{ raw: string; parsed: CreatorResponse }> {
  const raw = await api.handle(typeof value === "string" ? value : JSON.stringify(value));
  return { raw, parsed: CreatorResponseSchema.parse(JSON.parse(raw)) };
}

describe("AdMarketCreator public API", () => {
  it("is a frozen JSON boundary with a bounded in-studio message seam", () => {
    const messages: string[] = [];
    const api = createCreatorPublicApi(new HandlerHarness(), (message) => messages.push(message));

    expect(Object.isFrozen(api)).toBe(true);
    expect(Reflect.ownKeys(api)).toEqual(["handle", "showMessage"]);
    expect(typeof api.handle).toBe("function");
    expect(api.showMessage("Draft kept open. Try Return again.")).toBe(true);
    expect(messages).toEqual(["Draft kept open. Try Return again."]);
    expect(api.showMessage(" ")).toBe(false);
    expect(api.showMessage("x".repeat(281))).toBe(false);
    expect(messages).toHaveLength(1);
  });

  it("opens a valid document, gets current state, saves, publishes canonical base64 and closes", async () => {
    const handler = new HandlerHarness();
    const api = createCreatorPublicApi(handler);

    const opened = await parseResponse(api, request("r1", "open", blankDocument));
    const state = await parseResponse(api, request("r2", "getState", null));
    const saved = await parseResponse(api, request("r3", "save", null));
    const published = await parseResponse(api, request("r4", "publish", null));
    const closed = await parseResponse(api, request("r5", "close", null));

    expect([opened.parsed, state.parsed, saved.parsed, published.parsed, closed.parsed])
      .toEqual([
        { contract: CREATOR_BRIDGE_CONTRACT, requestId: "r1", ok: true },
        {
          contract: CREATOR_BRIDGE_CONTRACT,
          requestId: "r2",
          ok: true,
          payload: blankDocument
        },
        { contract: CREATOR_BRIDGE_CONTRACT, requestId: "r3", ok: true },
        {
          contract: CREATOR_BRIDGE_CONTRACT,
          requestId: "r4",
          ok: true,
          payload: {
            contract: "published-campaign@1",
            documentId: blankDocument.documentId,
            revision: blankDocument.revision,
            pngBase64: "AAEC/f7/",
            metadata: {
              productName: "",
              priceCents: 0,
              brief: blankDocument.brief,
              evidence: blankDocument.evidence,
              assetReferences: blankDocument.assetReferences
            }
          }
        },
        { contract: CREATOR_BRIDGE_CONTRACT, requestId: "r5", ok: true }
      ]);
    expect(handler.opened).toEqual([blankDocument]);
    expect(handler.saveCount).toBe(1);
    expect(handler.closeCount).toBe(1);
    expect(published.raw).not.toContain("pngBytes");
    expect(published.raw).not.toContain("Uint8Array");
    expect(published.raw).not.toContain("Blob");
    expect(published.raw).not.toContain("Fabric");
  });

  it("loads the latest durable document by identity without opening the editor", async () => {
    const handler = new HandlerHarness();
    const api = createCreatorPublicApi(handler);
    const found = await parseResponse(api, JSON.stringify({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "latest-found",
      method: "loadLatest",
      payload: { documentId: blankDocument.documentId }
    }));
    handler.latestDocument = null;
    const missing = await parseResponse(api, JSON.stringify({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "latest-missing",
      method: "loadLatest",
      payload: { documentId: blankDocument.documentId }
    }));

    expect(found.parsed).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "latest-found",
      ok: true,
      payload: blankDocument
    });
    expect(missing.parsed).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "latest-missing",
      ok: true,
      payload: null
    });
    expect(handler.opened).toEqual([]);
  });

  it("returns parsed versioned errors for invalid JSON and every invalid request shape", async () => {
    const api = createCreatorPublicApi(new HandlerHarness());
    const invalidRequests: Array<{
      input: CreatorRequest | string;
      requestId: string;
      code: "INVALID_REQUEST" | "UNSUPPORTED_CONTRACT";
    }> = [
      { input: "{", requestId: "", code: "INVALID_REQUEST" },
      {
        input: JSON.stringify({
          contract: "creator-bridge@999",
          requestId: "bad-contract",
          method: "open",
          payload: blankDocument
        }),
        requestId: "bad-contract",
        code: "UNSUPPORTED_CONTRACT"
      },
      {
        input: JSON.stringify({
          contract: CREATOR_BRIDGE_CONTRACT,
          requestId: "bad-method",
          method: "launch",
          payload: null
        }),
        requestId: "bad-method",
        code: "INVALID_REQUEST"
      },
      {
        input: JSON.stringify({
          contract: CREATOR_BRIDGE_CONTRACT,
          requestId: "extra-field",
          method: "close",
          payload: null,
          extra: true
        }),
        requestId: "extra-field",
        code: "INVALID_REQUEST"
      },
      {
        input: JSON.stringify({
          contract: CREATOR_BRIDGE_CONTRACT,
          requestId: "bad-payload",
          method: "getState",
          payload: {}
        }),
        requestId: "bad-payload",
        code: "INVALID_REQUEST"
      },
      {
        input: JSON.stringify({
          contract: CREATOR_BRIDGE_CONTRACT,
          requestId: "bad-document",
          method: "open",
          payload: { schemaVersion: 1 }
        }),
        requestId: "bad-document",
        code: "INVALID_REQUEST"
      },
      {
        input: JSON.stringify({
          contract: CREATOR_BRIDGE_CONTRACT,
          requestId: "bad-latest-id",
          method: "loadLatest",
          payload: { documentId: "" }
        }),
        requestId: "bad-latest-id",
        code: "INVALID_REQUEST"
      }
    ];

    for (const example of invalidRequests) {
      const { parsed } = await parseResponse(api, example.input);
      expect(parsed).toMatchObject({
        contract: CREATOR_BRIDGE_CONTRACT,
        requestId: example.requestId,
        ok: false,
        error: { code: example.code }
      });
      expect(parsed.error?.message).toEqual(expect.any(String));
    }
  });

  it("serialises handler failures instead of rejecting across the public boundary", async () => {
    const handler = new HandlerHarness();
    const api = createCreatorPublicApi(handler);
    const failures = [
      {
        requestId: "save-failed",
        method: "save" as const,
        message: "IndexedDB unavailable",
        install: () => {
          handler.save = async () => { throw new Error("IndexedDB unavailable"); };
        }
      },
      {
        requestId: "publish-failed",
        method: "publish" as const,
        message: "Fabric export failed",
        install: () => {
          handler.publish = async () => { throw new Error("Fabric export failed"); };
        }
      }
    ];

    for (const failure of failures) {
      failure.install();
      const { parsed } = await parseResponse(api, request(failure.requestId, failure.method, null));
      expect(parsed).toEqual({
        contract: CREATOR_BRIDGE_CONTRACT,
        requestId: failure.requestId,
        ok: false,
        error: { code: "HANDLER_ERROR", message: failure.message }
      });
    }
  });

  it("rejects non-JSON handler values instead of silently leaking them across the boundary", async () => {
    const handler = new HandlerHarness();
    handler.document.fabricState.runtimeBytes = Uint8Array.from([1, 2, 3]);
    const api = createCreatorPublicApi(handler);

    const { parsed } = await parseResponse(api, request("unsafe-state", "getState", null));

    expect(parsed).toMatchObject({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "unsafe-state",
      ok: false,
      error: { code: "HANDLER_ERROR" }
    });
    expect(parsed).not.toHaveProperty("payload");
  });
});
