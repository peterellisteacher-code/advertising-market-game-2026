// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const runbookPath = resolve(repoRoot, "docs/operations/live-market.md");

describe("live market operations artifact", () => {
  it("records the isolated Netlify activation and staged classroom checks", () => {
    const runbook = readFileSync(runbookPath, "utf8");
    expect(runbook).toContain("advertising-market-game-2026");
    expect(runbook).toContain("fffc6f57-3fd2-44e3-9247-05a5f746351d");
    expect(runbook).toContain("MARKET_CLASSROOM_CODE=<");
    expect(runbook).toContain("MARKET_SIGNING_SECRET=<");
    expect(runbook).toContain("MARKET_NOT_CONFIGURED");
    expect(runbook).toContain("six hours");
    expect(runbook).toContain("15 teams");
    expect(runbook).toContain("same-origin");
    expect(runbook).toContain("Netlify Blobs");
    expect(runbook).toContain("preview deploy");
    expect(runbook).toContain("No secret value belongs");
    expect(runbook).not.toContain(secretSentinel);
  });
});

const secretSentinel = `market_${"secret"}_${"x".repeat(24)}`;
