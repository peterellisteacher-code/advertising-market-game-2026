import { describe, expect, it } from "vitest";
import { createBlankCampaignDocument } from "../domain/campaign-document";
import { migrateCampaignDocument } from "./draft-migrations";

describe("migrateCampaignDocument assignment sandbox defaults", () => {
  it("adds guided assignment defaults without changing legacy campaign evidence", () => {
    const current = createBlankCampaignDocument({
      documentId: "legacy-migration-doc",
      sessionId: "legacy-migration-session",
      mode: "offline"
    });
    current.evidence.attention = ["headline-1"];
    const legacy = structuredClone(current) as unknown as Record<string, unknown>;
    delete legacy.workspaceMode;
    delete legacy.assignmentPlan;

    const migrated = migrateCampaignDocument(legacy);

    expect(migrated.workspaceMode).toBe("guided");
    expect(migrated.assignmentPlan.productFunction).toBe("");
    expect(migrated.evidence.attention).toEqual(["headline-1"]);
  });
});
