import { getByRole } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatorSpikeApi } from "./main";

describe("AdMarketCreatorSpike", () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="creator-root"></div>';
  });

  it("routes the Return to game control back to Godot", async () => {
    await import("./main");
    const api = (window as Window & { AdMarketCreatorSpike: CreatorSpikeApi }).AdMarketCreatorSpike;
    const events: string[] = [];
    api.setEventCallback((payloadJson) => events.push(payloadJson));

    api.open(JSON.stringify({ contract: "creator-spike@1" }));
    getByRole(document.body, "button", { name: "Return to game" }).click();

    expect(events.map((value) => JSON.parse(value))).toEqual([
      { contract: "creator-spike@1", event: "closeRequested" }
    ]);
  });
});
