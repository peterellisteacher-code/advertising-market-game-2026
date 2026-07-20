import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "web", "src", "styles", "editor.css"), "utf8");

describe("Fabric canvas layer styling", () => {
  it("keeps stage-gated creator sections visually hidden even when their component styles set display", () => {
    expect(css).toMatch(
      /#creator-root\s+\[hidden\]\s*\{[^}]*display:\s*none\s*!important\s*;?[^}]*\}/i
    );
  });

  it("uses the warm game-studio identity instead of browser-default chrome", () => {
    expect(css).toMatch(
      /#creator-root\s*\{[^}]*--ink:\s*#172033\b[^}]*--paper:\s*#f6f1e7\b[^}]*--coral:\s*#f25f5c\b[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator\s*\{[^}]*font-family:\s*"Trebuchet MS"[^;}]*;[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__topbar\s*\{[^}]*background:\s*var\(--ink\)\s*;[^}]*\}/i
    );
    expect(css).toMatch(/\.creator__brand\s*\{[^}]*display:\s*flex[^}]*\}/i);
  });

  it("reserves only compact chrome above a canvas-first workspace", () => {
    expect(css).toMatch(
      /\.creator\s*\{[^}]*grid-template-rows:\s*52px\s+56px\s+minmax\(0,\s*1fr\)[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__workspace\s*\{[^}]*grid-template-columns:\s*64px\s+288px\s+minmax\(0,\s*1fr\)[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator\[data-studio-drawer-open="false"\]\s+\.creator__workspace\s*\{[^}]*grid-template-columns:\s*64px\s+0\s+minmax\(0,\s*1fr\)[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__canvas\s+\.canvas-container\s*\{[^}]*width:\s*min\(100%,\s*calc\(\(100vh\s*-\s*[^)]*\)\s*\*\s*16\s*\/\s*9\)\)\s*!important[^}]*max-width:\s*1280px[^}]*aspect-ratio:\s*16\s*\/\s*9[^}]*\}/i
    );
  });

  it("turns pre-placement whitespace into a bounded purposeful empty state", () => {
    expect(css).toMatch(
      /\.creator__canvas-empty\s*\{[^}]*position:\s*absolute[^}]*width:\s*min\(calc\(100%\s*-\s*32px\),\s*1280px\)[^}]*aspect-ratio:\s*16\s*\/\s*9[^}]*place-items:\s*center[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__canvas-empty-card\s*\{[^}]*max-width:\s*26rem[^}]*border:\s*2px\s+dashed[^}]*\}/i
    );
  });

  it("uses distinct semantic rail glyphs and a deliberate wide-screen composition", () => {
    expect(css).toMatch(
      /\.creator__tool-rail\s+\[role="tab"\]::before\s*\{[^}]*content:\s*attr\(data-glyph\)[^}]*display:\s*grid[^}]*place-items:\s*center[^}]*\}/i
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1600px\)\s*\{[^}]*\.creator__workspace\s*\{[^}]*grid-template-columns:\s*72px\s+344px\s+minmax\(0,\s*1fr\)[^}]*\}/is
    );
  });

  it("keeps the 900px launch path compact and expands it only with spare height", () => {
    expect(css).toMatch(
      /\.creator__launch-path\s*\{[^}]*display:\s*none[^}]*\}/i
    );
    expect(css).toMatch(
      /@media\s*\(min-height:\s*900px\)\s+and\s+\(min-width:\s*1201px\)\s*\{[^}]*\.creator__launch-path\s*\{[^}]*margin-top:\s*auto[^}]*display:\s*grid[^}]*min-height:\s*7rem[^}]*\}/is
    );
    expect(css).toMatch(
      /\.creator__launch-path\s*>\s*p:last-child\s*\{[^}]*display:\s*none[^}]*\}/i
    );
    expect(css).toMatch(
      /@media\s*\(min-height:\s*1000px\)\s+and\s+\(min-width:\s*1201px\)\s*\{.*?\.creator__launch-path\s*\{[^}]*min-height:\s*12\.5rem[^}]*\}.*?\.creator__launch-path\s*>\s*p:last-child\s*\{[^}]*display:\s*block[^}]*\}/is
    );
  });

  it("keeps Product Kit controls ahead of the launch path instead of shrinking underneath it", () => {
    expect(css).toMatch(
      /\.creator__tool-panel\.creator__product-builder\s*>\s*\[data-product-builder-panel\]\s*\{[^}]*flex:\s*0\s+0\s+auto\s*;?[^}]*\}/i
    );
  });

  it("gives each drawer mode exactly one vertical scroll owner", () => {
    expect(css).toMatch(
      /\.creator__tool-drawer\s*\{[^}]*overflow:\s*hidden[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__tool-panel\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto[^}]*overscroll-behavior:\s*contain[^}]*\}/i
    );
    expect(css).toMatch(
      /:is\(\[data-product-builder-panel\][^}]*\.creator__library-results[^}]*\)\s*\{[^}]*overflow:\s*visible[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__tool-panel\.creator__assets\s*\{[^}]*display:\s*grid[^}]*overflow:\s*hidden[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__assets\s+\.creator__library-results\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto[^}]*\}/i
    );
  });

  it("shows a larger assembled-product preview and a two-column asset shelf", () => {
    expect(css).toMatch(
      /\.product-kit__preview-frame\s*\{[^}]*width:\s*12rem[^}]*aspect-ratio:\s*4\s*\/\s*5[^}]*\}/i
    );
    expect(css).toMatch(
      /\.product-kit__preview-canvas\s*\{[^}]*inset:\s*0[^}]*width:\s*100%[^}]*height:\s*100%[^}]*\}/i
    );
    expect(css).not.toMatch(/\.product-kit__artwork\s*\{/i);
    expect(css).toMatch(
      /\.creator__library-results\s+\[role="list"\]\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*\}/i
    );
  });

  it("widens only the active asset drawer and compacts its controls on classroom screens", () => {
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1201px\)[\s\S]*?\.creator:not\(\[data-studio-drawer-open="false"\]\):has\(\.creator__assets:not\(\[hidden\]\)\)\s+\.creator__workspace\s*\{[^}]*grid-template-columns:\s*64px\s+416px\s+minmax\(0,\s*1fr\)[^}]*\}/i
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1600px\)[\s\S]*?\.creator:not\(\[data-studio-drawer-open="false"\]\):has\(\.creator__assets:not\(\[hidden\]\)\)\s+\.creator__workspace\s*\{[^}]*grid-template-columns:\s*72px\s+500px\s+minmax\(0,\s*1fr\)[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__assets\s+\.creator__asset-controls\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*\}/i
    );
  });

  it("wraps long logo names instead of clipping them in the narrow drawer", () => {
    expect(css).toMatch(
      /\.logo-lab__symbol\s*>\s*span:last-child\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere[^}]*\}/i
    );
    expect(css).toMatch(
      /\.logo-lab__symbols\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*\}/i
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1600px\)[\s\S]*?\.logo-lab__symbols\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*\}/i
    );
  });

  it("uses an on-demand overlay inspector instead of a permanent column", () => {
    expect(css).toMatch(
      /\.creator__inspector\s*\{[^}]*position:\s*absolute[^}]*right:[^}]*top:[^}]*width:\s*min\(20rem,[^}]*\}/i
    );
  });

  it("keeps the complete studio chrome inside a 320-pixel viewport", () => {
    const mobile = css.match(/@media\s*\(max-width:\s*520px\)\s*\{([\s\S]*)\}\s*$/i)?.[1] ?? "";
    expect(mobile).toMatch(
      /\.creator\s*\{[^}]*grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)[^}]*\}/i
    );
    expect(mobile).toMatch(
      /\.creator__topbar\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+auto[^}]*\}/i
    );
    expect(mobile).toMatch(
      /\.creator__topbar\s+\[data-command="return"\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*\}/i
    );
    expect(mobile).toMatch(
      /\.creator__pair-strip:has\(\.creator__checklist\[hidden\]\)\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*\}/i
    );
    expect(mobile).toMatch(
      /\.creator__tool-rail\s*\{[^}]*grid-auto-flow:\s*column[^}]*grid-auto-columns:\s*minmax\(48px,\s*1fr\)[^}]*overflow-x:\s*auto[^}]*\}/i
    );
    expect(mobile).toMatch(
      /\.creator__tool-rail\s+\[role="tab"\]\s*\{[^}]*min-width:\s*48px[^}]*font-size:\s*\.875rem[^}]*\}/i
    );
    expect(mobile).toMatch(
      /\.creator__tool-rail\s+\[role="tab"\]::before\s*\{[^}]*display:\s*grid[^}]*font-size:\s*\.875rem[^}]*\}/i
    );
  });

  it("never sets rem-based interface text below 14 pixels", () => {
    const remSizes = [...css.matchAll(/font-size:\s*(0?\.\d+)rem/gi)]
      .map((match) => Number(match[1]));
    expect(remSizes.length).toBeGreaterThan(0);
    expect(Math.min(...remSizes)).toBeGreaterThanOrEqual(0.875);
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
