// @vitest-environment jsdom
import { fireEvent, getByRole, getByText, queryByRole } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBlankCampaignDocument,
  parseCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import {
  assembleWritersStatement,
  createWritersStatementView
} from "./writers-statement";

function campaignFixture(): CampaignDocumentV1 {
  const blank = createBlankCampaignDocument({
    documentId: "statement-doc",
    sessionId: "statement-session",
    mode: "offline"
  });
  return parseCampaignDocument({
    ...blank,
    product: { ...blank.product, name: "Trail Kit" },
    brief: { ...blank.brief, targetAudienceId: "careful-spenders" },
    fabricState: {
      version: "7.4.0",
      objects: [
        {
          objectId: "headline-1",
          elementKind: "text",
          accessibleName: "Headline: Built to last"
        },
        {
          objectId: "photo-1",
          elementKind: "image",
          assetId: "asset-1",
          accessibleName: "Photograph of the trail kit in use"
        }
      ]
    },
    evidence: {
      price: [],
      attention: ["headline-1"],
      interest: [],
      desire: ["photo-1"],
      action: []
    },
    strategy: {
      ...blank.strategy,
      marketRoute: {
        audienceBriefId: "careful-spenders",
        zoneId: "neighbourhood",
        mediaIds: ["storefront"],
        proofPoint: "The kit carries a two-year repair guarantee.",
        committed: true
      },
      aidaPlan: {
        attention: "The headline names the guarantee first.",
        interest: "",
        desire: "The photograph shows the kit in use on a real trail.",
        action: "The final line states the store and the price."
      }
    },
    missionEvidence: [
      {
        missionId: "salience",
        title: "Control what the audience notices first",
        decisionId: "largest-contrast",
        effectText: "The headline holds the largest contrast so the audience reads the offer first."
      },
      {
        missionId: "claim-proof",
        title: "Make a claim the advertisement can support",
        decisionId: "qualified-supported",
        effectText: "The guarantee supports the durability claim for careful spenders."
      },
      {
        missionId: "future-mission",
        title: "A mission this build does not know",
        decisionId: "some-choice",
        effectText: "An unmapped mission sentence still appears in the statement."
      }
    ]
  });
}

describe("assembleWritersStatement", () => {
  it("groups the campaign record under the four rubric headings", () => {
    const content = assembleWritersStatement(campaignFixture());

    expect(content.productName).toBe("Trail Kit");
    expect(content.audienceSignal).toBe("Worth the spend.");
    expect(content.sections.map(({ id }) => id)).toEqual([
      "audience-purpose",
      "visual-choices",
      "language-choices",
      "evidence"
    ]);

    const sectionById = new Map(content.sections.map((section) => [section.id, section]));
    const audience = sectionById.get("audience-purpose")!;
    const visual = sectionById.get("visual-choices")!;
    const language = sectionById.get("language-choices")!;
    const evidence = sectionById.get("evidence")!;
    expect(audience.facts.map(({ label }) => label)).toEqual([
      "Context",
      "Need",
      "Values",
      "Intended audience response"
    ]);
    expect(visual.missionSentences).toEqual([{
      title: "Control what the audience notices first",
      effectText: "The headline holds the largest contrast so the audience reads the offer first."
    }]);
    expect(language.facts).toEqual([
      { label: "Attention", text: "The headline names the guarantee first." },
      { label: "Desire", text: "The photograph shows the kit in use on a real trail." },
      { label: "Action", text: "The final line states the store and the price." }
    ]);
    expect(evidence.facts).toEqual([
      { label: "Proof point", text: "The kit carries a two-year repair guarantee." },
      { label: "Attention evidence", text: "Headline: Built to last" },
      { label: "Desire evidence", text: "Photograph of the trail kit in use" }
    ]);
    expect(evidence.missionSentences.map(({ title }) => title)).toEqual([
      "Make a claim the advertisement can support",
      "A mission this build does not know"
    ]);
  });

  it("assembles an empty campaign without inventing content", () => {
    const content = assembleWritersStatement(createBlankCampaignDocument({
      documentId: "blank",
      sessionId: "blank-session",
      mode: "offline"
    }));

    expect(content.productName).toBe("");
    expect(content.audienceSignal).toBeNull();
    for (const section of content.sections) {
      expect(section.facts).toEqual([]);
      expect(section.missionSentences).toEqual([]);
    }
  });
});

describe("createWritersStatementView", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.body.removeAttribute("data-writers-statement-open");
  });

  it("opens as a printable dialog, moves focus in, and restores it on close", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const onOpened = vi.fn();
    const view = createWritersStatementView(host, { onOpened });

    view.open(campaignFixture());

    const dialog = getByRole(document.body, "dialog", { name: "Writer's statement" });
    expect(onOpened).toHaveBeenCalledTimes(1);
    expect(document.body.hasAttribute("data-writers-statement-open")).toBe(true);
    expect(document.activeElement?.textContent).toBe("Writer's statement");
    expect(getByText(dialog, "Audience and purpose")).toBeTruthy();
    expect(dialog.textContent)
      .toContain("The guarantee supports the durability claim for careful spenders.");
    expect(getByText(dialog, /Product: Trail Kit/)).toBeTruthy();

    fireEvent.click(getByRole(dialog, "button", { name: "Close" }));
    expect(view.isOpen()).toBe(false);
    expect(document.body.hasAttribute("data-writers-statement-open")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("labels headings with nothing recorded instead of dropping them", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const view = createWritersStatementView(host);

    view.open(createBlankCampaignDocument({
      documentId: "blank",
      sessionId: "blank-session",
      mode: "offline"
    }), { focus: false });

    const dialog = getByRole(document.body, "dialog", { name: "Writer's statement" });
    expect(dialog.querySelectorAll("[data-statement-section]")).toHaveLength(4);
    expect(dialog.textContent).toContain("Nothing recorded for this heading yet.");
  });

  it("prints through the injected print hook", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const print = vi.fn();
    const view = createWritersStatementView(host, { print });

    view.open(campaignFixture(), { focus: false });
    fireEvent.click(getByRole(view.layer, "button", { name: "Print" }));

    expect(print).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const view = createWritersStatementView(host);

    view.open(campaignFixture());
    fireEvent.keyDown(view.layer, { key: "Escape" });

    expect(view.isOpen()).toBe(false);
  });

  it("offers the statement after publish without stealing focus, then opens on request", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const view = createWritersStatementView(host);

    view.offerAfterPublish(campaignFixture());

    const offer = getByRole(document.body, "status");
    expect(offer.hidden).toBe(false);
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(getByRole(offer, "button", { name: "Open writer's statement" }));
    expect(view.isOpen()).toBe(true);
    expect(offer.hidden).toBe(true);
    expect(getByText(view.layer, /Product: Trail Kit/)).toBeTruthy();
  });

  it("dismisses the offer and clears everything on reset", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const view = createWritersStatementView(host);

    view.offerAfterPublish(campaignFixture());
    fireEvent.click(getByRole(document.body, "button", { name: "Not now" }));
    expect(queryByRole(document.body, "status", { hidden: false })).toBeNull();

    view.open(campaignFixture(), { focus: false });
    view.reset();
    expect(view.isOpen()).toBe(false);
    expect(document.body.hasAttribute("data-writers-statement-open")).toBe(false);
  });
});
