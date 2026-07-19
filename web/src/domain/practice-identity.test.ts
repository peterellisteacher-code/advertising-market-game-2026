import { describe, expect, it } from "vitest";
import {
  hasCloudProgressPracticeDocumentIdentities,
  hasRecoverablePracticeDocumentIdentities,
  selectDistinctPracticeRunIdentity
} from "./practice-identity";

describe("practice identity invariants", () => {
  it("accepts only safe, non-reserved, pairwise-distinct document identities", () => {
    const valid = {
      documentId: "practice-document",
      sessionId: "practice-session",
      teamId: "practice-team"
    };
    expect(hasRecoverablePracticeDocumentIdentities(valid)).toBe(true);

    for (const invalid of [
      { ...valid, sessionId: valid.documentId },
      { ...valid, teamId: "classroom-campaign" },
      { ...valid, sessionId: "invalid identity" },
      { ...valid, teamId: `t${"x".repeat(128)}` },
      { ...valid, teamId: undefined }
    ]) {
      expect(hasRecoverablePracticeDocumentIdentities(invalid)).toBe(false);
    }
  });

  it("adds the narrower lowercase 64-character document key only at the cloud boundary", () => {
    const localOnly = {
      documentId: "Practice:Document",
      sessionId: "practice-session",
      teamId: "practice-team"
    };
    expect(hasRecoverablePracticeDocumentIdentities(localOnly)).toBe(true);
    expect(hasCloudProgressPracticeDocumentIdentities(localOnly)).toBe(false);
    expect(hasCloudProgressPracticeDocumentIdentities({
      ...localOnly,
      documentId: "practice-document"
    })).toBe(true);
  });

  it("selects the first safe run identity outside all three occupied identities", () => {
    const base = "cloud-recovery-run:seed";
    expect(selectDistinctPracticeRunIdentity(base, {
      documentId: base,
      sessionId: `${base}:1`,
      teamId: `${base}:2`
    })).toBe(`${base}:3`);
  });
});
