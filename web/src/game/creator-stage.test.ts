import { describe, expect, it } from "vitest";
import { createBlankCampaignDocument, type CampaignDocumentV1 } from "../domain/campaign-document";
import { AUDIENCE_BRIEFS } from "./audience-briefs";
import {
  CREATOR_STAGES,
  PUBLICATION_MISSING_CODES,
  advanceCreatorPhase,
  evaluatePublicationReadiness,
  getAvailableCommands,
  getCreatorStage
} from "./creator-stage";
import { buildMarketCardPreview } from "./market-card-preview";
import {
  createEmptyRoleProgress,
  createPairSession,
  type PairRoleProgress,
  type PairSession
} from "./pair-session";

const startedAt = "2026-07-14T03:30:00.000Z";

function campaignFixture(): CampaignDocumentV1 {
  return createBlankCampaignDocument({
    documentId: "campaign-1",
    sessionId: "session-1",
    mode: "offline"
  });
}

function readySession(): PairSession {
  return {
    ...createPairSession({
      sessionId: "session-1",
      audienceBriefId: AUDIENCE_BRIEFS[0].id,
      startedAt
    }),
    handoffCount: 1
  };
}

function readyProgress(): PairRoleProgress {
  return { "art-director": 1, strategist: 1 };
}

function readyCampaign(): CampaignDocumentV1 {
  const campaign = campaignFixture();
  campaign.product.name = "Pocket Telescope";
  campaign.product.priceCents = 0;
  campaign.evidence.price = ["object-price"];
  campaign.evidence.attention = ["object-attention"];
  campaign.evidence.interest = ["object-interest"];
  campaign.evidence.desire = ["object-desire"];
  campaign.evidence.action = ["object-action"];
  return campaign;
}

describe("creator stages", () => {
  it("uses the exact phase order and cumulative one-cluster unlock sequence", () => {
    expect(CREATOR_STAGES.map((stage) => stage.phase)).toEqual([
      "round-zero",
      "invent",
      "sell",
      "refine",
      "preview"
    ]);
    expect(CREATOR_STAGES.map((stage) => stage.newlyUnlockedCommands)).toEqual([
      ["search", "add", "move", "resize", "text", "undo"],
      ["crop"],
      ["drawing"],
      ["recolour"],
      ["layers"]
    ]);
    expect(getAvailableCommands("round-zero")).toEqual([
      "search", "add", "move", "resize", "text", "undo"
    ]);
    expect(getAvailableCommands("invent")).toEqual([
      "search", "add", "move", "resize", "text", "undo", "crop"
    ]);
    expect(getAvailableCommands("sell")).toEqual([
      "search", "add", "move", "resize", "text", "undo", "crop", "drawing"
    ]);
    expect(getAvailableCommands("refine")).toEqual([
      "search", "add", "move", "resize", "text", "undo", "crop", "drawing", "recolour"
    ]);
    expect(getAvailableCommands("preview")).toEqual([
      "search", "add", "move", "resize", "text", "undo", "crop", "drawing", "recolour", "layers"
    ]);
  });

  it("keeps stage data immutable with no more than two hints and 140 tooltip characters", () => {
    expect(Object.isFrozen(CREATOR_STAGES)).toBe(true);
    for (const stage of CREATOR_STAGES) {
      expect(getCreatorStage(stage.phase)).toBe(stage);
      expect(Object.isFrozen(stage)).toBe(true);
      expect(Object.isFrozen(stage.newlyUnlockedCommands)).toBe(true);
      expect(Object.isFrozen(stage.availableCommands)).toBe(true);
      expect(Object.isFrozen(stage.hintKeywords)).toBe(true);
      expect(stage.hintKeywords.length).toBeLessThanOrEqual(2);
      if (stage.tooltip !== undefined) {
        expect(stage.tooltip.length).toBeLessThanOrEqual(140);
      }
    }
  });

  it("advances exactly one phase without mutation and treats preview as terminal", () => {
    const start = createPairSession({
      sessionId: "session-1",
      audienceBriefId: AUDIENCE_BRIEFS[0].id,
      startedAt
    });
    const original = structuredClone(start);

    const invent = advanceCreatorPhase(start);
    const sell = advanceCreatorPhase(invent);
    const refine = advanceCreatorPhase(sell);
    const preview = advanceCreatorPhase(refine);

    expect(start).toEqual(original);
    expect([invent.phase, sell.phase, refine.phase, preview.phase]).toEqual([
      "invent",
      "sell",
      "refine",
      "preview"
    ]);
    expect(invent).toEqual({ ...start, phase: "invent" });
    expect(() => advanceCreatorPhase(preview)).toThrow("Cannot advance beyond preview");
  });

  it("rejects an unknown runtime phase instead of resetting to Round 0", () => {
    const invalidSession = {
      ...createPairSession({
        sessionId: "session-1",
        audienceBriefId: AUDIENCE_BRIEFS[0].id,
        startedAt
      }),
      phase: "bonus-round"
    } as unknown as PairSession;

    expect(() => advanceCreatorPhase(invalidSession)).toThrow(
      "Unknown creator phase: bonus-round"
    );
  });
});
describe("publication readiness", () => {
  it("returns every missing code in exact order for a blank campaign", () => {
    const session: PairSession = {
      sessionId: "session-1",
      activeRole: "art-director",
      phase: "round-zero",
      audienceBriefId: "",
      handoffCount: 0,
      startedAt
    };
    const progress = createEmptyRoleProgress();
    const campaign = campaignFixture();
    const sessionSnapshot = structuredClone(session);
    const progressSnapshot = structuredClone(progress);
    const campaignSnapshot = structuredClone(campaign);

    expect(evaluatePublicationReadiness(session, progress, campaign)).toEqual({
      ready: false,
      missing: [
        "audience-brief",
        "product-name",
        "price",
        "attention",
        "interest",
        "desire",
        "action",
        "role-handoff",
        "art-director-action",
        "strategist-action"
      ]
    });
    expect(PUBLICATION_MISSING_CODES).toEqual([
      "audience-brief",
      "product-name",
      "price",
      "attention",
      "interest",
      "desire",
      "action",
      "role-handoff",
      "art-director-action",
      "strategist-action"
    ]);
    expect(session).toEqual(sessionSnapshot);
    expect(progress).toEqual(progressSnapshot);
    expect(campaign).toEqual(campaignSnapshot);
  });

  it("is ready only when every publication requirement is present", () => {
    expect(evaluatePublicationReadiness(
      readySession(),
      readyProgress(),
      readyCampaign()
    )).toEqual({ ready: true, missing: [] });

    const cases: ReadonlyArray<readonly [string, PairSession, PairRoleProgress, CampaignDocumentV1]> = [
      ["audience-brief", { ...readySession(), audienceBriefId: " " }, readyProgress(), readyCampaign()],
      ["product-name", readySession(), readyProgress(), {
        ...readyCampaign(),
        product: { ...readyCampaign().product, name: " ", priceCents: 0 }
      }],
      ["price", readySession(), readyProgress(), {
        ...readyCampaign(),
        product: { ...readyCampaign().product, name: "Pocket Telescope", priceCents: null }
      }],
      ["attention", readySession(), readyProgress(), { ...readyCampaign(), evidence: { ...readyCampaign().evidence, attention: [] } }],
      ["interest", readySession(), readyProgress(), { ...readyCampaign(), evidence: { ...readyCampaign().evidence, interest: [] } }],
      ["desire", readySession(), readyProgress(), { ...readyCampaign(), evidence: { ...readyCampaign().evidence, desire: [] } }],
      ["action", readySession(), readyProgress(), { ...readyCampaign(), evidence: { ...readyCampaign().evidence, action: [] } }],
      ["role-handoff", { ...readySession(), handoffCount: 0 }, readyProgress(), readyCampaign()],
      ["art-director-action", readySession(), { "art-director": 0, strategist: 1 }, readyCampaign()],
      ["strategist-action", readySession(), { "art-director": 1, strategist: 0 }, readyCampaign()]
    ];

    for (const [missingCode, session, progress, campaign] of cases) {
      expect(evaluatePublicationReadiness(session, progress, campaign)).toEqual({
        ready: false,
        missing: [missingCode]
      });
    }
  });

  it.each(["attention", "interest", "desire", "action"] as const)(
    "treats blank %s evidence IDs as missing",
    (slot) => {
      const campaign = readyCampaign();
      campaign.evidence[slot] = ["", " \t "];

      expect(evaluatePublicationReadiness(
        readySession(),
        readyProgress(),
        campaign
      )).toEqual({ ready: false, missing: [slot] });
    }
  );

  it("requires the price to be visible on the canvas, not merely calculated", () => {
    const campaign = readyCampaign();
    campaign.evidence.price = [];

    expect(evaluatePublicationReadiness(
      readySession(),
      readyProgress(),
      campaign
    )).toEqual({ ready: false, missing: ["price"] });
  });

  it("does not treat a written AIDA plan as canvas evidence", () => {
    const campaign = readyCampaign();
    campaign.evidence.attention = [];
    campaign.evidence.interest = [];
    campaign.evidence.desire = [];
    campaign.evidence.action = [];
    campaign.strategy.aidaPlan = {
      attention: "Break the opening pattern.",
      interest: "Demonstrate the carry loop.",
      desire: "Make the spare hour feel open.",
      action: "Invite a try at Harbourlight Station."
    };

    expect(evaluatePublicationReadiness(
      readySession(),
      readyProgress(),
      campaign
    )).toEqual({
      ready: false,
      missing: ["attention", "interest", "desire", "action"]
    });
  });
});

describe("market card preview", () => {
  it("builds an immutable anonymous 1600 x 900 contain preview without identity or ranking", () => {
    const campaign = campaignFixture();
    campaign.product.name = "  Pocket Telescope  ";
    campaign.product.priceCents = 1299;
    campaign.revision = 7;
    const brief = AUDIENCE_BRIEFS[0];
    const campaignSnapshot = structuredClone(campaign);
    const briefSnapshot = structuredClone(brief);

    const preview = buildMarketCardPreview(campaign, brief, "blob:campaign-image");

    expect(preview).toEqual({
      campaignImage: {
        src: "blob:campaign-image",
        width: 1600,
        height: 900,
        fit: "contain"
      },
      productName: "Pocket Telescope",
      priceCents: 1299,
      sellerLabel: "Anonymous seller",
      audienceSignals: {
        signal: brief.signal,
        context: brief.context,
        need: brief.need,
        values: [...brief.values],
        intendedEffect: brief.intendedEffect
      },
      editReturn: {
        documentId: "campaign-1",
        revision: 7
      }
    });
    expect(Object.isFrozen(preview)).toBe(true);
    expect(Object.isFrozen(preview.campaignImage)).toBe(true);
    expect(Object.isFrozen(preview.audienceSignals)).toBe(true);
    expect(Object.isFrozen(preview.audienceSignals.values)).toBe(true);
    expect(Object.isFrozen(preview.editReturn)).toBe(true);
    expect(preview).not.toHaveProperty("rank");
    expect(preview).not.toHaveProperty("score");
    expect(preview).not.toHaveProperty("teamId");
    expect(preview).not.toHaveProperty("sellerId");
    expect(campaign).toEqual(campaignSnapshot);
    expect(brief).toEqual(briefSnapshot);
  });

  it.each([
    ["relative", "images/campaign.png"],
    ["root-relative", "/images/campaign.png"],
    ["blob", "blob:campaign-image"],
    ["data image", "data:image/png;base64,AA=="]
  ])("keeps the three-argument form for %s image sources", (_kind, source) => {
    const preview = buildMarketCardPreview(readyCampaign(), AUDIENCE_BRIEFS[0], source);

    expect(preview.campaignImage.src).toBe(source);
  });

  it("accepts absolute and protocol-relative sources only with a matching explicit origin", () => {
    const absolute = buildMarketCardPreview(
      readyCampaign(),
      AUDIENCE_BRIEFS[0],
      "https://game.example/images/campaign.png",
      "https://game.example"
    );
    const protocolRelative = buildMarketCardPreview(
      readyCampaign(),
      AUDIENCE_BRIEFS[0],
      "//game.example/images/campaign.png",
      "https://game.example"
    );

    expect(absolute.campaignImage.src).toBe("https://game.example/images/campaign.png");
    expect(protocolRelative.campaignImage.src).toBe("//game.example/images/campaign.png");
  });

  it.each([
    "http:evil.example/x",
    "http:/evil.example/x",
    "http:\\evil.example/x"
  ])("rejects parser-normalized cross-origin source %s", (source) => {
    expect(() => buildMarketCardPreview(
      readyCampaign(),
      AUDIENCE_BRIEFS[0],
      source,
      "https://game.example"
    )).toThrow("campaign image source must be same-origin or local");
  });

  it.each([
    ["cross-origin blob", "blob:https://evil.example/id", "https://game.example"],
    ["blob without explicit origin", "blob:https://game.example/id", undefined],
    ["malformed blob origin", "blob:https://[bad/id", "https://game.example"]
  ] as const)("rejects %s", (_case, source, currentOrigin) => {
    expect(() => buildMarketCardPreview(
      readyCampaign(),
      AUDIENCE_BRIEFS[0],
      source,
      currentOrigin
    )).toThrow("campaign image source must be same-origin or local");
  });

  it("accepts a matching-origin blob and retains the opaque three-argument blob form", () => {
    const sameOrigin = buildMarketCardPreview(
      readyCampaign(),
      AUDIENCE_BRIEFS[0],
      "blob:https://game.example/id",
      "https://game.example"
    );
    const opaque = buildMarketCardPreview(
      readyCampaign(),
      AUDIENCE_BRIEFS[0],
      "blob:campaign-image"
    );

    expect(sameOrigin.campaignImage.src).toBe("blob:https://game.example/id");
    expect(opaque.campaignImage.src).toBe("blob:campaign-image");
  });

  it("rejects network sources without a matching explicit origin", () => {
    const valid = readyCampaign();
    const brief = AUDIENCE_BRIEFS[0];

    expect(() => buildMarketCardPreview(valid, brief, "https://example.com/campaign.png")).toThrow(
      "campaign image source must be same-origin or local"
    );
    expect(() => buildMarketCardPreview(
      valid,
      brief,
      "https://cdn.example/campaign.png",
      "https://game.example"
    )).toThrow("campaign image source must be same-origin or local");
    expect(() => buildMarketCardPreview(
      valid,
      brief,
      "//cdn.example/campaign.png",
      "https://game.example"
    )).toThrow("campaign image source must be same-origin or local");
  });

  it("rejects malformed, unsupported, and backslash-normalized network sources", () => {
    const valid = readyCampaign();
    const brief = AUDIENCE_BRIEFS[0];

    for (const source of [
      "https://[bad",
      "ftp://game.example/campaign.png",
      "javascript:alert(1)",
      "\\\\game.example\\campaign.png",
      "https:\\\\game.example\\campaign.png"
    ]) {
      expect(() => buildMarketCardPreview(
        valid,
        brief,
        source,
        "https://game.example"
      )).toThrow("campaign image source must be same-origin or local");
    }
    expect(() => buildMarketCardPreview(
      valid,
      brief,
      "https://game.example/campaign.png",
      "not-an-origin"
    )).toThrow("current origin must be a valid HTTP(S) origin");
  });

  it("rejects blank image sources, blank names, and null prices", () => {
    const valid = readyCampaign();
    const brief = AUDIENCE_BRIEFS[0];

    expect(() => buildMarketCardPreview(valid, brief, " ")).toThrow(
      "campaign image source must be non-blank"
    );
    expect(() => buildMarketCardPreview(
      { ...valid, product: { ...valid.product, name: "\t", priceCents: 100 } },
      brief,
      "/campaign.png"
    )).toThrow("product name must be non-blank");
    expect(() => buildMarketCardPreview(
      { ...valid, product: { ...valid.product, name: "Pocket Telescope", priceCents: null } },
      brief,
      "/campaign.png"
    )).toThrow("price must be present");
  });
});
