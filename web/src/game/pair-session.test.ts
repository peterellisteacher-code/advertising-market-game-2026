import { describe, expect, it } from "vitest";
import {
  bothRolesHaveActed,
  createEmptyRoleProgress,
  createPairSession,
  recordProductiveAction,
  swapActiveRole
} from "./pair-session";
import { AUDIENCE_BRIEFS, getAudienceBrief } from "./audience-briefs";
import {
  CREATOR_COMMANDS,
  ROUND_ZERO_COMMANDS,
  isCreatorCommand
} from "./round-zero";

describe("pair session", () => {
  const startedAt = "2026-07-14T03:30:00.000Z";

  it("starts with the Art Director in Round 0 and no handoffs", () => {
    expect(createPairSession({
      sessionId: "session-1",
      audienceBriefId: "careful-spenders",
      startedAt
    })).toEqual({
      sessionId: "session-1",
      activeRole: "art-director",
      phase: "round-zero",
      audienceBriefId: "careful-spenders",
      handoffCount: 0,
      startedAt
    });
  });

  it("rejects blank IDs and invalid ISO timestamps with clear errors", () => {
    expect(() => createPairSession({
      sessionId: " ",
      audienceBriefId: "careful-spenders",
      startedAt
    })).toThrow("sessionId must be non-blank");
    expect(() => createPairSession({
      sessionId: "session-1",
      audienceBriefId: "\t",
      startedAt
    })).toThrow("audienceBriefId must be non-blank");
    expect(() => createPairSession({
      sessionId: "session-1",
      audienceBriefId: "careful-spenders",
      startedAt: "not-an-iso-timestamp"
    })).toThrow("startedAt must be a valid ISO timestamp");
    expect(() => createPairSession({
      sessionId: "session-1",
      audienceBriefId: "careful-spenders",
      startedAt: "2026-02-30T03:30:00.000Z"
    })).toThrow("startedAt must be a valid ISO timestamp");
  });

  it("swaps only the active role and handoff count without mutation", () => {
    const session = createPairSession({
      sessionId: "session-1",
      audienceBriefId: "careful-spenders",
      startedAt
    });
    const original = structuredClone(session);

    const swapped = swapActiveRole(session);

    expect(swapped).toEqual({
      ...session,
      activeRole: "strategist",
      handoffCount: 1
    });
    expect(session).toEqual(original);
    expect(swapActiveRole(swapped)).toEqual({
      ...session,
      activeRole: "art-director",
      handoffCount: 2
    });
  });

  it("records productive actions immutably and requires both roles", () => {
    const empty = createEmptyRoleProgress();
    expect(empty).toEqual({ "art-director": 0, strategist: 0 });
    expect(bothRolesHaveActed(empty)).toBe(false);

    const artDirectorActed = recordProductiveAction(empty, "art-director");
    expect(artDirectorActed).toEqual({ "art-director": 1, strategist: 0 });
    expect(empty).toEqual({ "art-director": 0, strategist: 0 });
    expect(bothRolesHaveActed(artDirectorActed)).toBe(false);

    const bothActed = recordProductiveAction(artDirectorActed, "strategist");
    expect(bothActed).toEqual({ "art-director": 1, strategist: 1 });
    expect(artDirectorActed).toEqual({ "art-director": 1, strategist: 0 });
    expect(bothRolesHaveActed(bothActed)).toBe(true);
  });
});

describe("audience briefs", () => {
  it("provides at least three immutable, complete, non-prescriptive briefs", () => {
    expect(AUDIENCE_BRIEFS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(AUDIENCE_BRIEFS.map((brief) => brief.id)).size).toBe(AUDIENCE_BRIEFS.length);
    expect(Object.isFrozen(AUDIENCE_BRIEFS)).toBe(true);

    for (const brief of AUDIENCE_BRIEFS) {
      expect(Object.keys(brief).sort()).toEqual([
        "context",
        "id",
        "intendedEffect",
        "need",
        "signal",
        "values"
      ]);
      expect([
        brief.id,
        brief.signal,
        brief.context,
        brief.need,
        brief.intendedEffect
      ].every((value) => value.trim().length > 0)).toBe(true);
      expect(brief.values.length).toBeGreaterThanOrEqual(1);
      expect(brief.values.length).toBeLessThanOrEqual(2);
      expect(brief.values.every((value) => value.trim().length > 0)).toBe(true);
      expect(Object.isFrozen(brief)).toBe(true);
      expect(Object.isFrozen(brief.values)).toBe(true);
    }
  });

  it("looks up a stable brief and rejects an unknown ID", () => {
    const brief = AUDIENCE_BRIEFS[0];
    expect(getAudienceBrief(brief.id)).toBe(brief);
    expect(() => getAudienceBrief("missing-brief")).toThrow("Unknown audience brief: missing-brief");
  });
});

describe("Round 0 commands", () => {
  it("exposes the exact immutable starting commands and only four later commands", () => {
    expect(ROUND_ZERO_COMMANDS).toEqual([
      "search",
      "add",
      "move",
      "resize",
      "text",
      "undo"
    ]);
    expect(CREATOR_COMMANDS).toEqual([
      "search",
      "add",
      "move",
      "resize",
      "text",
      "undo",
      "crop",
      "drawing",
      "recolour",
      "layers"
    ]);
    expect(Object.isFrozen(ROUND_ZERO_COMMANDS)).toBe(true);
    expect(Object.isFrozen(CREATOR_COMMANDS)).toBe(true);
  });

  it("recognises every command ID and rejects other strings", () => {
    for (const command of CREATOR_COMMANDS) {
      expect(isCreatorCommand(command)).toBe(true);
    }
    expect(isCreatorCommand("publish")).toBe(false);
    expect(isCreatorCommand(42)).toBe(false);
  });
});
