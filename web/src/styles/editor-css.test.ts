import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "web", "src", "styles", "editor.css"), "utf8");

describe("Fabric canvas layer styling", () => {
  it("keeps the upper interaction canvas transparent above the painted lower canvas", () => {
    expect(css).toMatch(
      /\.creator__canvas\s+canvas\.lower-canvas\s*\{[^}]*background:\s*white\b[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__canvas\s+canvas\.upper-canvas\s*\{[^}]*background:\s*transparent\b[^}]*\}/i
    );
    expect(css).not.toMatch(
      /\.creator__canvas\s+canvas\s*\{[^}]*background:\s*white\b[^}]*\}/i
    );
  });
});
