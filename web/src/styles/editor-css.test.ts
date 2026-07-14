import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "web", "src", "styles", "editor.css"), "utf8");

describe("Fabric canvas layer styling", () => {
  it("uses the approved warm studio theme instead of browser-default chrome", () => {
    expect(css).toMatch(
      /#creator-root\s*\{[^}]*--ink:\s*#172033\b[^}]*--paper:\s*#f6f1e7\b[^}]*--coral:\s*#f25f5c\b[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator\s*\{[^}]*font-family:\s*"Trebuchet MS"[^;}]*;[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__topbar\s*\{[^}]*background:\s*var\(--ink\)\s*;[^}]*\}/i
    );
    expect(css).toMatch(
      /\[role="tab"\]\[aria-selected="true"\]\s*\{[^}]*background:\s*var\(--ink\)\s*;[^}]*color:\s*#fff\b[^}]*\}/i
    );
  });

  it("allows the canvas grid track to shrink without pushing the inspector off-screen", () => {
    expect(css).toMatch(
      /\.creator\s*\{[^}]*grid-template:[^;}]*\/[^;}]*minmax\(0,\s*1fr\)[^;}]*;[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__canvas\s*\{[^}]*min-width:\s*0\b[^}]*min-height:\s*0\b[^}]*overflow:\s*auto\b[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__canvas\s+\.canvas-container\s*\{[^}]*width:\s*100%\s*!important[^}]*max-width:\s*1600px[^}]*height:\s*auto\s*!important[^}]*aspect-ratio:\s*16\s*\/\s*9[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__canvas\s+canvas\s*\{[^}]*width:\s*100%\s*!important[^}]*height:\s*auto\s*!important[^}]*\}/i
    );
  });

  it("compacts text-only artwork choices at a 720p classroom viewport", () => {
    expect(css).toMatch(
      /@media\s*\(max-height:\s*820px\)[\s\S]*\.creator__product-builder\s*\{[^}]*max-height:\s*48vh\b[^}]*\}[\s\S]*\.product-maker__choice-grid:has\(input\[name="product-art"\]\)\s+\.product-maker__choice\s*\{[^}]*min-height:\s*48px\b[^}]*\}/i
    );
  });

  it("bounds Logo Lab and keeps its symbol choices scrollable in two columns", () => {
    expect(css).toMatch(
      /\.creator__logo-lab\s*\{[^}]*max-height:\s*min\(34vh,\s*22rem\)[^}]*overflow:\s*hidden[^}]*\}/i
    );
    expect(css).toMatch(
      /\.logo-lab__symbols\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*overflow:\s*auto[^}]*overscroll-behavior:\s*contain[^}]*\}/i
    );
    expect(css).toMatch(
      /\.logo-lab__symbol\s*\{[^}]*min-height:\s*44px[^}]*\}/i
    );
    expect(css).toMatch(
      /@media\s*\(max-height:\s*820px\)[\s\S]*\.logo-lab\s+details\s*\{[^}]*max-height:[^}]*\}/i
    );
  });

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
