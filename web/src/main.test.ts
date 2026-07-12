import { getByRole } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatorPublicApi } from "./bridge/creator-public-api";
import {
  CREATOR_BRIDGE_CONTRACT,
  CreatorResponseSchema,
  type CreatorMethod,
  type CreatorResponse
} from "./bridge/contracts";
import { createBlankCampaignDocument } from "./domain/campaign-document";

const runtime = vi.hoisted(() => ({
  adapterConstructed: vi.fn(),
  adapterDisposed: vi.fn(),
  canvasConstructed: vi.fn(),
  canvasDisposed: vi.fn(),
  exporterConstructed: vi.fn(),
  publish: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  state: { version: "7.4.0", objects: [] } as Record<string, unknown>
}));

vi.mock("fabric", () => ({
  Canvas: class {
    constructor(element: HTMLCanvasElement) {
      runtime.canvasConstructed(element);
    }

    dispose(): void {
      runtime.canvasDisposed();
    }
  }
}));

vi.mock("./fabric/fabric-canvas-adapter", () => ({
  FabricCanvasAdapter: class {
    constructor(canvas: unknown) {
      runtime.adapterConstructed(canvas);
    }

    async load(value: Record<string, unknown>): Promise<void> {
      runtime.state = structuredClone(value);
      runtime.load(value);
    }

    serialize(): Record<string, unknown> {
      return structuredClone(runtime.state);
    }

    exportCleanPngDataUrl(): string {
      return "data:image/png;base64,AA==";
    }

    dispose(): void {
      runtime.adapterDisposed();
    }
  }
}));

vi.mock("./persistence/draft-store", () => ({
  IndexedDbDraftStore: class {
    save(document: unknown, blobs: unknown): Promise<void> {
      runtime.save(document, blobs);
      return Promise.resolve();
    }
  }
}));

vi.mock("./export/campaign-exporter", () => ({
  CampaignExporter: class {
    constructor(port: unknown, ownedUrls: unknown) {
      runtime.exporterConstructed(port, ownedUrls);
    }

    publish(document: ReturnType<typeof createBlankCampaignDocument>) {
      runtime.publish(document);
      return {
        contract: "published-campaign@1" as const,
        documentId: document.documentId,
        revision: document.revision,
        pngBytes: Uint8Array.from([0, 1, 2]),
        metadata: {
          productName: document.product.name,
          priceCents: 0,
          brief: structuredClone(document.brief),
          evidence: structuredClone(document.evidence),
          assetReferences: structuredClone(document.assetReferences)
        }
      };
    }
  }
}));

const blankDocument = createBlankCampaignDocument({
  documentId: "main-document",
  sessionId: "main-session",
  mode: "offline"
});

function request(requestId: string, method: CreatorMethod, payload: unknown): string {
  return JSON.stringify({ contract: CREATOR_BRIDGE_CONTRACT, requestId, method, payload });
}

async function parsed(
  api: CreatorPublicApi,
  requestId: string,
  method: CreatorMethod,
  payload: unknown
): Promise<CreatorResponse> {
  return CreatorResponseSchema.parse(JSON.parse(await api.handle(request(requestId, method, payload))));
}

describe("window.AdMarketCreator", () => {
  beforeEach(() => {
    vi.resetModules();
    runtime.state = { version: "7.4.0", objects: [] };
    Reflect.deleteProperty(window, "AdMarketCreator");
    Reflect.deleteProperty(window, "AdMarketCreatorSpike");
    document.body.innerHTML = `
      <main aria-label="Advertising Market Game">
        <canvas id="canvas" tabindex="0"></canvas>
      </main>
      <div id="creator-root"></div>`;
  });

  it("installs one frozen method and keeps Fabric lazy until a valid open request", async () => {
    await import("./main");
    const api = (window as Window & { AdMarketCreator: CreatorPublicApi }).AdMarketCreator;

    expect(Object.isFrozen(api)).toBe(true);
    expect(Reflect.ownKeys(api)).toEqual(["handle"]);
    expect("AdMarketCreatorSpike" in window).toBe(false);
    expect(runtime.canvasConstructed).not.toHaveBeenCalled();

    const opened = await parsed(api, "open", "open", blankDocument);

    expect(opened).toEqual({ contract: CREATOR_BRIDGE_CONTRACT, requestId: "open", ok: true });
    expect(runtime.canvasConstructed).toHaveBeenCalledTimes(1);
    expect(runtime.adapterConstructed).toHaveBeenCalledTimes(1);
    expect(runtime.load).toHaveBeenCalledWith(blankDocument.fabricState);
    expect(document.querySelector("main")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelector<HTMLElement>("main")?.inert).toBe(true);
    expect(document.querySelector("#creator-root")?.hasAttribute("hidden")).toBe(false);
    expect(document.activeElement).toBe(getByRole(document.body, "region", { name: "Campaign canvas" }));

    const state = await parsed(api, "state", "getState", null);
    const saved = await parsed(api, "save", "save", null);
    const published = await parsed(api, "publish", "publish", null);

    expect(state).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "state",
      ok: true,
      payload: blankDocument
    });
    expect(saved).toEqual({ contract: CREATOR_BRIDGE_CONTRACT, requestId: "save", ok: true });
    expect(runtime.save).toHaveBeenCalledWith(blankDocument, new Map());
    expect(published).toMatchObject({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "publish",
      ok: true,
      payload: { contract: "published-campaign@1", pngBase64: "AAEC" }
    });
    expect(runtime.publish).toHaveBeenCalledWith(blankDocument);
  });

  it("emits a private Return-to-game event and restores the game surface on close", async () => {
    await import("./main");
    const api = (window as Window & { AdMarketCreator: CreatorPublicApi }).AdMarketCreator;
    await parsed(api, "open", "open", blankDocument);
    const returnEvents: Event[] = [];
    window.addEventListener("ad-market-creator:return-to-game", (event) => returnEvents.push(event), {
      once: true
    });

    getByRole(document.body, "button", { name: "Return to game" }).click();

    expect(returnEvents).toHaveLength(1);
    expect((returnEvents[0] as CustomEvent).detail).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      event: "closeRequested"
    });
    expect(document.querySelector("#creator-root")?.hasAttribute("hidden")).toBe(false);

    const closed = await parsed(api, "close", "close", null);

    expect(closed).toEqual({ contract: CREATOR_BRIDGE_CONTRACT, requestId: "close", ok: true });
    expect(document.querySelector("#creator-root")?.hasAttribute("hidden")).toBe(true);
    expect(document.querySelector("main")?.hasAttribute("aria-hidden")).toBe(false);
    expect(document.querySelector<HTMLElement>("main")?.inert).toBe(false);
    expect(document.activeElement).toBe(document.querySelector("#canvas"));
    expect(runtime.adapterDisposed).toHaveBeenCalledTimes(1);
    expect(runtime.canvasDisposed).toHaveBeenCalledTimes(1);
  });
});
