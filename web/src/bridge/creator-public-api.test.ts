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
  opened: CampaignDocumentV1[] = [];
  saveCount = 0;
  closeCount = 0;

  async open(document: CampaignDocumentV1): Promise<void> {
    this.document = structuredClone(document);
    this.opened.push(structuredClone(document));
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
  it("is a frozen one-method JSON boundary", () => {
    const api = createCreatorPublicApi(new HandlerHarness());

    expect(Object.isFrozen(api)).toBe(true);
    expect(Reflect.ownKeys(api)).toEqual(["handle"]);
    expect(typeof api.handle).toBe("function");
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

  it("returns parsed versioned errors for invalid JSON and every invalid request shape", async () => {
    const api = createCreatorPublicApi(new HandlerHarness());
    const invalidRequests: Array<{ input: CreatorRequest | string; requestId: string }> = [
      { input: "{", requestId: "" },
      {
        input: JSON.stringify({
          contract: "creator-bridge@999",
          requestId: "bad-contract",
          method: "open",
          payload: blankDocument
        }),
        requestId: "bad-contract"
      },
      {
        input: JSON.stringify({
          contract: CREATOR_BRIDGE_CONTRACT,
          requestId: "bad-method",
          method: "launch",
          payload: null
        }),
        requestId: "bad-method"
      },
      {
        input: JSON.stringify({
          contract: CREATOR_BRIDGE_CONTRACT,
          requestId: "extra-field",
          method: "close",
          payload: null,
          extra: true
        }),
        requestId: "extra-field"
      },
      {
        input: JSON.stringify({
          contract: CREATOR_BRIDGE_CONTRACT,
          requestId: "bad-payload",
          method: "getState",
          payload: {}
        }),
        requestId: "bad-payload"
      },
      {
        input: JSON.stringify({
          contract: CREATOR_BRIDGE_CONTRACT,
          requestId: "bad-document",
          method: "open",
          payload: { schemaVersion: 1 }
        }),
        requestId: "bad-document"
      }
    ];

    for (const example of invalidRequests) {
      const { parsed } = await parseResponse(api, example.input);
      expect(parsed).toMatchObject({
        contract: CREATOR_BRIDGE_CONTRACT,
        requestId: example.requestId,
        ok: false,
        error: { code: "INVALID_REQUEST" }
      });
      expect(parsed.error?.message).toEqual(expect.any(String));
    }
  });

  it("serialises handler failures instead of rejecting across the public boundary", async () => {
    const handler = new HandlerHarness();
    handler.save = async () => {
      throw new Error("IndexedDB unavailable");
    };
    const api = createCreatorPublicApi(handler);

    const { parsed } = await parseResponse(api, request("save-failed", "save", null));

    expect(parsed).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "save-failed",
      ok: false,
      error: { code: "HANDLER_ERROR", message: "IndexedDB unavailable" }
    });
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
