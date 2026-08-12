import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const tokens = readFileSync(
  join(process.cwd(), "web", "src", "styles", "agency-academy-tokens.css"),
  "utf8"
);
const editor = readFileSync(
  join(process.cwd(), "web", "src", "styles", "editor.css"),
  "utf8"
);
const main = readFileSync(join(process.cwd(), "web", "src", "main.ts"), "utf8");

describe("Agency Academy studio tokens", () => {
  it("defines the one shared live-DOM game shell palette and geometry", () => {
    for (const token of [
      "--aa-frame", "--aa-surface", "--aa-ink", "--aa-gold",
      "--aa-success", "--aa-coaching", "--aa-focus", "--aa-space-1",
      "--aa-space-2", "--aa-space-3", "--aa-header-height"
    ]) {
      expect(tokens, token).toContain(token);
    }
    expect(main.match(/agency-academy-tokens\.css/g)).toHaveLength(1);
    expect(editor).not.toMatch(/\b(?:score|points?|pts)\b/i);
  });

  it("keeps the 1280 by 800 studio canvas-first", () => {
    expect(tokens).toMatch(/--aa-header-height:\s*88px/);
    expect(tokens).toMatch(/--aa-dock-height:\s*60px/);
    expect(editor).toMatch(/--studio-canvas-share:\s*70%/);
    expect(editor).toMatch(/min-width:\s*var\(--studio-canvas-share\)/);
  });
});
