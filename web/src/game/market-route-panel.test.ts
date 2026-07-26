import { fireEvent, getByRole, getAllByRole, waitFor } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import type { CampaignDocumentV1 } from "../domain/campaign-document";
import type { MarketRouteFeedback } from "./market-route";
import { MarketRoutePanel } from "./market-route-panel";

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
      hasProduct: false,
      priceCents: 3_500,
      pricePosition: "everyday",
      audienceBriefId: "after-school-wanderers",
      strategy: blankStrategy,
      feedback: null
    });

    expect(host.textContent).toContain("Add a product before continuing.");
    expect(host.textContent).not.toMatch(/\b(?:assignment|unit|task|budget cap)\b/i);
  });

  it("requires the audience-led price decision before route choices", () => {
    const host = document.createElement("div");
    const panel = new MarketRoutePanel(host, vi.fn());
    panel.setState({
      hasProduct: true,
      priceCents: null,
      pricePosition: null,
      audienceBriefId: "after-school-wanderers",
      strategy: blankStrategy,
      feedback: null
    });

    expect(host.textContent).toContain("Choose the audience price position and selling price");
    expect(host.querySelector("form")).toBeNull();
  });

  it("commits product strengths, a zone and media before showing feedback", async () => {
    const host = document.createElement("div");
    const commit = vi.fn().mockResolvedValue(strongFeedback);
    const panel = new MarketRoutePanel(host, commit);
    panel.setState({
      hasProduct: true,
      priceCents: 3_500,
      pricePosition: "everyday",
      audienceBriefId: "after-school-wanderers",
      strategy: blankStrategy,
      feedback: null
    });

    expect(getByRole(host, "group", { name: "Product strengths" })).toBeTruthy();
    expect(host.querySelectorAll('input[name="product-trait"]')).toHaveLength(5);
    fireEvent.click(getByRole(host, "button", { name: "Show all product strengths" }));
    expect(host.querySelectorAll('input[name="product-trait"]')).toHaveLength(12);
    const steps = [...host.querySelectorAll<HTMLFieldSetElement>("fieldset")];
    expect(steps.map(({ hidden }) => hidden)).toEqual([false, true, true]);
    expect(host.textContent).not.toContain("Strong route");

    const portability = getByRole<HTMLInputElement>(host, "checkbox", { name: /Portability/ });
    fireEvent.click(portability);
    expect(steps.map(({ hidden }) => hidden)).toEqual([false, false, true]);
    const marketZone = steps[1]!.querySelector<HTMLSelectElement>('select[name="market-zone"]')!;
    fireEvent.change(marketZone, {
      target: { value: "city" }
    });
    expect(steps.map(({ hidden }) => hidden)).toEqual([false, false, false]);
    expect(host.querySelectorAll('input[name="advertising-medium"]')).toHaveLength(5);
    const showMedia = host.querySelector<HTMLButtonElement>(
      ".market-route__step .market-route__more"
    );
    expect(showMedia?.textContent).toBe("Show all advertising media");
    expect(showMedia?.closest("fieldset")?.hidden).toBe(false);
    fireEvent.click(showMedia!);
    expect(host.querySelectorAll('input[name="advertising-medium"]')).toHaveLength(11);
    const transit = steps[2]!.querySelector<HTMLInputElement>(
      'input[name="advertising-medium"][value="transit"]'
    )!;
    fireEvent.click(transit);
    expect(portability.checked).toBe(true);
    expect(marketZone.value).toBe("city");
    expect(transit.checked).toBe(true);
    const proofPoint = getByRole<HTMLTextAreaElement>(host, "textbox", { name: "Proof point" });
    expect(host.textContent).toContain(
      "It must remain accurate for the selected audience and market scale."
    );
    const launch = getByRole<HTMLButtonElement>(host, "button", { name: "Submit this route" });
    expect(launch.disabled).toBe(true);
    fireEvent.input(proofPoint, {
      target: { value: "  The carry loop fits around one hand.  " }
    });
    expect(launch.disabled).toBe(false);
    fireEvent.click(launch);

    await waitFor(() => expect(commit).toHaveBeenCalledWith({
      audienceBriefId: "after-school-wanderers",
      productTraitIds: ["portability"],
      zoneId: "city",
      mediaIds: ["transit"],
      proofPoint: "The carry loop fits around one hand."
    }));
    await waitFor(() => expect(getByRole(host, "region", { name: "Route report" }).textContent)
      .toContain("Strong route"));
    expect(getByRole(host, "region", { name: "Route report" }).textContent)
      .toContain("Show one proof point");
    expect(getByRole<HTMLButtonElement>(host, "button", { name: "Route submitted" }).disabled)
      .toBe(true);
    expect(getByRole(host, "status").textContent)
      .toBe("Route submitted. Review the route report, then return to the game.");
  });

  it("restores a saved route without hiding unusual product choices", () => {
    const host = document.createElement("div");
    const panel = new MarketRoutePanel(host, vi.fn());
    panel.setState({
      hasProduct: true,
      priceCents: 50_000_000,
      pricePosition: "premium",
      audienceBriefId: "after-school-wanderers",
      strategy: {
        ...blankStrategy,
        productTraitIds: ["space-property"],
        marketedChoiceIds: [],
        marketRoute: {
          audienceBriefId: "after-school-wanderers",
          zoneId: "destination",
          mediaIds: ["cinema", "search"],
          proofPoint: "The courtyard receives direct morning light.",
          committed: true
        }
      },
      feedback: strongFeedback
    });

    expect(getByRole<HTMLSelectElement>(host, "combobox", { name: "Market zone" }).value)
      .toBe("destination");
    expect(getAllByRole<HTMLInputElement>(host, "checkbox")
      .filter(({ checked }) => checked).map(({ value }) => value))
      .toEqual(["space-property", "search", "cinema"]);
    expect(getByRole<HTMLTextAreaElement>(host, "textbox", { name: "Proof point" }).value)
      .toBe("The courtyard receives direct morning light.");
    expect(getAllByRole(host, "checkbox").every((input) => !input.hasAttribute("disabled")))
      .toBe(true);
    expect(host.textContent).not.toContain("$500,000.00");
  });
});
