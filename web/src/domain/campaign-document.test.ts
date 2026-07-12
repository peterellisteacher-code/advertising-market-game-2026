import { describe, expect, it } from "vitest";
import { createBlankCampaignDocument, parseCampaignDocument } from "./campaign-document";

describe("CampaignDocumentV1", () => {
  it("creates a blank 1600 by 900 revision-zero document", () => {
    const doc = createBlankCampaignDocument({
      documentId: "doc-1",
      sessionId: "local-1",
      mode: "offline"
    });

    expect(doc.canvas).toEqual({ width: 1600, height: 900, background: "#ffffff" });
    expect(doc.revision).toBe(0);
    expect(doc.fabricState).toEqual({ version: "7.4.0", objects: [] });
    expect(doc.evidence).toEqual({
      price: [], attention: [], interest: [], desire: [], action: []
    });
    expect(doc.brief).toEqual({
      targetAudienceId: "",
      contextId: "",
      purpose: "persuade",
      audienceNeeds: [],
      audienceValues: [],
      intendedEffects: [],
      techniques: []
    });
  });

  it("rejects a malformed document", () => {
    expect(() => parseCampaignDocument({ schemaVersion: 1, canvas: { width: 99 } })).toThrow();
  });

  it("rejects a saved Fabric object without application metadata", () => {
    const doc = createBlankCampaignDocument({
      documentId: "doc-1",
      sessionId: "local-1",
      mode: "offline"
    });

    expect(() => parseCampaignDocument({
      ...doc,
      fabricState: { version: "7.4.0", objects: [{ type: "rect" }] }
    })).toThrow();
  });

  it("requires room and team identifiers in room mode", () => {
    expect(() => createBlankCampaignDocument({
      documentId: "doc-1",
      sessionId: "room-session",
      mode: "room"
    })).toThrow();
  });
});
