import { describe, expect, it } from "vitest";
import { cloudStatusMessage } from "./account-bootstrap";

describe("cloudStatusMessage", () => {
  it("keeps internal cloud revisions out of student status copy", () => {
    const message = cloudStatusMessage({
      phase: "synced",
      documentId: "campaign-1",
      revision: 17
    });

    expect(message).toBe("Saved on this device and cloud.");
    expect(message).not.toContain("17");
    expect(message).not.toMatch(/revision/i);
  });
});
