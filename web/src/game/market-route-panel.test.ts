import { fireEvent, getByRole, getAllByRole, waitFor } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import type { CampaignDocumentV1, ProductBuildSnapshotV1 } from "../domain/campaign-document";
import type { MarketRouteFeedback } from "./market-route";
import { MarketRoutePanel } from "./market-route-panel";

const build: ProductBuildSnapshotV1 = {
  schema: "product-build@1",
  primaryObjectId: "product-1",
  packId: "product-builder-pilot-v1",
  pricingVersion: 1,
  blueprintId: "drinkware-classic-can",
  selections: [{ groupId: "shape", choiceIds: ["classic-can"] }, {
    groupId: "feature",
    choiceIds: ["easy-carry-loop"]
  }],
  costLines: [{
    groupId: "shape",
    groupLabel: "Shape",
    kind: "base",
    choiceId: "classic-can",
    label: "Classic can",
    costCents: 2_600
  }, {
    groupId: "feature",
    groupLabel: "Feature",
    kind: "feature",
    choiceId: "easy-carry-loop",
    label: "Easy-carry loop",
    costCents: 950
  }],
  unitCostCents: 3_550
};

const blankStrategy: CampaignDocumentV1["strategy"] = {
  productTraitIds: [],
  marketedChoiceIds: [],
  marketRoute: null,
  aidaPlan: { attention: "", interest: "", desire: "", action: "" }
};

const strongFeedback: MarketRouteFeedback = {
  outcome: "strong",
  headline: "Strong route",
  evidence: [{
    kind: "audience",
    fit: "supports",
    reason: "Portability answers the spare-hour need."
  }, {
    kind: "zone",
    fit: "supports",
    reason: "City Pulse meets people while they move."
  }, {
    kind: "media",
    fit: "supports",
    reason: "Transit can show the easy-carry loop."
  }],
  nextMove: "Show one proof point in the first glance."
};

describe("MarketRoutePanel", () => {
  it("keeps the route locked until a product is placed", () => {
    const host = document.createElement("div");
    const panel = new MarketRoutePanel(host, vi.fn());

    panel.setState({
      build: null,
      audienceBriefId: "after-school-wanderers",
      strategy: blankStrategy,
      feedback: null
    });

    expect(host.textContent).toContain("Cost is a clue, never a gate");
    expect(host.textContent).toContain("Build and place a product to plot its route");
    expect(host.textContent).not.toMatch(/\b(?:assignment|unit|task|budget cap)\b/i);
  });

  it("commits product strengths, priced choices, a zone and media before showing feedback", async () => {
    const host = document.createElement("div");
    const commit = vi.fn().mockResolvedValue(strongFeedback);
    const panel = new MarketRoutePanel(host, commit);
    panel.setState({
      build,
      audienceBriefId: "after-school-wanderers",
      strategy: blankStrategy,
      feedback: null
    });

    expect(getByRole(host, "group", { name: "Product strengths" })).toBeTruthy();
    expect(getByRole(host, "group", { name: "Priced product choices" }).textContent)
      .toContain("Easy-carry loop · Feature · $9.50");
    expect(getByRole(host, "combobox", { name: "Market zone" })).toBeTruthy();
    expect(getByRole(host, "group", { name: "Advertising media" })).toBeTruthy();
    expect(host.textContent).not.toContain("Strong route");

    const portability = getByRole<HTMLInputElement>(host, "checkbox", { name: /Portability/ });
    const carryLoop = getByRole<HTMLInputElement>(host, "checkbox", { name: /Easy-carry loop/ });
    const marketZone = getByRole<HTMLSelectElement>(host, "combobox", { name: "Market zone" });
    const transit = getByRole<HTMLInputElement>(host, "checkbox", { name: /Transit/ });
    fireEvent.click(portability);
    fireEvent.click(carryLoop);
    fireEvent.change(marketZone, {
      target: { value: "city" }
    });
    fireEvent.click(transit);
    expect(portability.checked).toBe(true);
    expect(carryLoop.checked).toBe(true);
    expect(marketZone.value).toBe("city");
    expect(transit.checked).toBe(true);
    const launch = getByRole<HTMLButtonElement>(host, "button", { name: "Launch this route" });
    expect(launch.disabled).toBe(false);
    fireEvent.click(launch);

    await waitFor(() => expect(commit).toHaveBeenCalledWith({
      audienceBriefId: "after-school-wanderers",
      productTraitIds: ["portability"],
      marketedChoiceIds: ["easy-carry-loop"],
      zoneId: "city",
      mediaIds: ["transit"]
    }));
    await waitFor(() => expect(getByRole(host, "region", { name: "Route report" }).textContent)
      .toContain("Strong route"));
    expect(getByRole(host, "region", { name: "Route report" }).textContent)
      .toContain("Show one proof point");
  });

  it("restores a saved route without disabling expensive or unusual choices", () => {
    const host = document.createElement("div");
    const panel = new MarketRoutePanel(host, vi.fn());
    panel.setState({
      build: { ...build, unitCostCents: 32_500_000 },
      audienceBriefId: "after-school-wanderers",
      strategy: {
        ...blankStrategy,
        productTraitIds: ["space-property"],
        marketedChoiceIds: ["classic-can"],
        marketRoute: {
          audienceBriefId: "after-school-wanderers",
          zoneId: "destination",
          mediaIds: ["cinema", "search"],
          committed: true
        }
      },
      feedback: strongFeedback
    });

    expect(getByRole<HTMLSelectElement>(host, "combobox", { name: "Market zone" }).value)
      .toBe("destination");
    expect(getAllByRole<HTMLInputElement>(host, "checkbox")
      .filter(({ checked }) => checked).map(({ value }) => value))
      .toEqual(["space-property", "classic-can", "search", "cinema"]);
    expect(getAllByRole(host, "checkbox").every((input) => !input.hasAttribute("disabled")))
      .toBe(true);
    expect(host.textContent).toContain("$325,000.00");
  });
});
