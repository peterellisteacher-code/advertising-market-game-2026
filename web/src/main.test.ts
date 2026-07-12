import { getByRole } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatorSpikeApi } from "./main";

describe("AdMarketCreatorSpike", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `
      <main aria-label="Advertising Market Game">
        <canvas id="canvas" tabindex="0"></canvas>
      </main>
      <div id="creator-root"></div>`;
  });

  it("routes the Return to game control back to Godot", async () => {
    await import("./main");
    const api = (window as Window & { AdMarketCreatorSpike: CreatorSpikeApi }).AdMarketCreatorSpike;
    const events: string[] = [];
    api.setEventCallback((payloadJson) => {
      events.push(payloadJson);
      api.close();
    });

    api.open(JSON.stringify({ contract: "creator-spike@1" }));
    expect(document.querySelector("main")?.getAttribute("aria-hidden")).toBe("true");
    getByRole(document.body, "button", { name: "Return to game" }).click();

    expect(events.map((value) => JSON.parse(value))).toEqual([
      { contract: "creator-spike@1", event: "closeRequested" }
    ]);
    expect(document.querySelector("#creator-root")?.hasAttribute("hidden")).toBe(true);
    expect(document.querySelector("main")?.hasAttribute("aria-hidden")).toBe(false);
    expect(document.activeElement).toBe(document.querySelector("#canvas"));
  });
});
