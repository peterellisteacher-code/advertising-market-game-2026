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
      /#creator-root\s*\{[^}]*--ink:\s*var\(--aa-ink\)[^}]*--paper:\s*var\(--aa-surface-muted\)[^}]*--coral:\s*#f25f5c\b[^}]*\}/i
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
      /\.creator\s*\{[^}]*grid-template-rows:\s*var\(--aa-header-height\)\s+auto\s+auto\s+minmax\(0,\s*1fr\)[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__workspace\s*\{[^}]*--studio-rail-width:\s*72px[^}]*--studio-browse-percent:\s*40%[^}]*--studio-browse-width:\s*\.666667fr[^}]*--studio-canvas-share:\s*70%[^}]*grid-template-columns:\s*var\(--studio-rail-width\)\s+minmax\(18rem,\s*var\(--studio-browse-width\)\)\s+var\(--studio-separator-width\)\s+minmax\(var\(--studio-canvas-share\),\s*1fr\)[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__canvas\s+\.canvas-container\s*\{[^}]*width:\s*min\(100%,\s*var\(--studio-canvas-display-width,\s*calc\(\(100vh\s*-\s*[^)]*\)\s*\*\s*16\s*\/\s*9\)\)\)\s*!important[^}]*max-width:\s*1280px[^}]*aspect-ratio:\s*16\s*\/\s*9[^}]*\}/i
    );
    expect(css).toMatch(/\.creator__academy-header\s*\{[^}]*height:\s*var\(--aa-header-height\)[^}]*\}/i);
    expect(css).toMatch(/\.creator__canvas\s*\{[^}]*min-width:\s*var\(--studio-canvas-share\)[^}]*\}/i);
    expect(css).toMatch(/\.creator__canvas-size\s*\{[^}]*height:\s*var\(--aa-dock-height\)[^}]*\}/i);
  });

  it("keeps the journey bar as a slim always-visible strip that hides with the tuck tabs during the tour", () => {
    expect(css).toMatch(
      /\.creator__journey-bar\s*\{[^}]*min-height:\s*44px[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator:has\(\[data-studio-onboarding-layer\]:not\(\[hidden\]\)\)\s*\.creator__journey-bar\s*\{[^}]*visibility:\s*hidden[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__journey-bar-body\s+p\s*\{[^}]*white-space:\s*nowrap[^}]*overflow:\s*hidden[^}]*text-overflow:\s*ellipsis[^}]*\}/i
    );
  });

  it("keeps the role card a compact functional row with no standing copy", () => {
    expect(css).toMatch(
      /\.creator__role-card\s*\{[^}]*display:\s*flex[^}]*\}/i
    );
    expect(css).not.toMatch(/\.creator__next-action/i);
    expect(css).not.toMatch(/\.creator__partner-action/i);
    expect(css).not.toMatch(/\.creator__round-progress/i);
    expect(css).toMatch(
      /\.creator__audience-brief\s*\{[^}]*top:\s*calc\(100%\s*\+\s*4px\)[^}]*\}/i
    );
  });

  it("keeps the Studio tour as a bounded, keyboard-friendly overlay", () => {
    expect(css).toMatch(
      /\.creator__studio-onboarding-layer\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*display:\s*grid[^}]*place-items:\s*center[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__studio-onboarding\s*\{[^}]*width:\s*min\(42rem,\s*100%\)[^}]*max-height:[^}]*overflow:\s*auto[^}]*\}/i
    );
  });

  it("dims the Studio behind a single raised tour target", () => {
    expect(css).toMatch(
      /\.creator__studio-onboarding-spotlight\s*\{[^}]*position:\s*fixed[^}]*border:[^}]*box-shadow:\s*0\s+0\s+0\s+100vmax\s+rgb\(10\s+22\s+36\s*\/\s*\.76\)[^}]*pointer-events:\s*none[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__studio-onboarding\s*\{[^}]*position:\s*relative[^}]*z-index:\s*1[^}]*\}/i
    );
  });

  it("keeps the writer's statement as a bounded overlay that prints alone", () => {
    expect(css).toMatch(
      /\.creator__writers-statement\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*place-items:\s*center[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__writers-statement-page\s*\{[^}]*max-height:[^}]*overflow:\s*auto[^}]*\}/i
    );
    expect(css).toMatch(
      /@media print\s*\{[^]*body\[data-writers-statement-open\]\s*\*\s*\{[^}]*visibility:\s*hidden[^}]*\}/i
    );
    expect(css).toMatch(
      /body\[data-writers-statement-open\]\s*\.creator__writers-statement-actions\s*\{[^}]*display:\s*none[^}]*\}/i
    );
  });

  it("has no floating or absolute drawer-collapse control", () => {
    expect(css).not.toMatch(/creator__drawer-collapse/i);
    expect(css).toMatch(
      /\.creator__workspace-separator:focus-visible\s*\{[^}]*outline:[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__workspace-separator-hint\s*\{[^}]*opacity:\s*0[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__workspace-separator:focus-visible\s*\+\s*\.creator__workspace-separator-hint\s*\{[^}]*opacity:\s*1[^}]*\}/i
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
      /@media\s*\(min-width:\s*1600px\)\s*\{[^}]*\.creator__workspace\s*\{[^}]*--studio-rail-width:\s*72px[^}]*\}/is
    );
  });

  it("keeps the launch path visible on a 720px-high MacBook viewport and expands it with spare height", () => {
    expect(css).toMatch(
      /\.creator__launch-path\s*\{[^}]*display:\s*none[^}]*\}/i
    );
    expect(css).toMatch(
      /@media\s*\(min-height:\s*720px\)\s+and\s+\(min-width:\s*1201px\)\s*\{[^}]*\.creator__launch-path\s*\{[^}]*margin-top:\s*auto[^}]*display:\s*grid[^}]*min-height:\s*4\.75rem[^}]*\}/is
    );
    expect(css).toMatch(
      /\.creator__launch-path\s*>\s*p:last-child\s*\{[^}]*display:\s*none[^}]*\}/i
    );
    expect(css).toMatch(
      /@media\s*\(min-height:\s*900px\)\s+and\s+\(min-width:\s*1201px\)\s*\{.*?\.creator__launch-path\s*\{[^}]*min-height:\s*7rem[^}]*\}/is
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

  it("shows the complete current instruction and keeps canvas-layer controls unobscured", () => {
    expect(css).toMatch(
      /\.creator__guide\s*\{[^}]*max-height:\s*22rem[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__canvas-size\s*\{[^}]*z-index:\s*11[^}]*\}/i
    );
  });

  it("keeps every canvas command reachable in one compact row at the widest library split", () => {
    expect(css).toMatch(
      /\.creator__workspace\s*\{[^}]*--canvas-command-dock-bottom:\s*12px[^}]*--canvas-command-dock-height:\s*var\(--aa-dock-height\)[^}]*--canvas-command-dock-clearance:\s*calc\(var\(--canvas-command-dock-bottom\)\s*\+\s*var\(--canvas-command-dock-height\)\s*\+\s*12px\)[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__canvas-size\s*\{[^}]*left:\s*50%[^}]*bottom:\s*var\(--canvas-command-dock-bottom\)[^}]*width:\s*max-content[^}]*max-width:\s*calc\(100%\s*-\s*24px\)[^}]*display:\s*flex[^}]*flex-wrap:\s*nowrap[^}]*justify-content:\s*flex-start[^}]*overflow-x:\s*auto[^}]*scrollbar-width:\s*thin[^}]*transform:\s*translateX\(-50%\)[^}]*\}/i
    );
    expect(css).not.toMatch(
      /\.creator__canvas-size\s*\{[^}]*grid-template-areas/i
    );
    expect(css).toMatch(
      /\.creator__canvas-size\s+button\s*\{[^}]*width:\s*max-content[^}]*flex:\s*0\s+0\s+auto[^}]*white-space:\s*nowrap[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__layers\s*\{[^}]*bottom:\s*var\(--canvas-command-dock-clearance\)[^}]*max-height:\s*calc\(100%\s*-\s*var\(--canvas-command-dock-clearance\)\s*-\s*16px\)[^}]*overflow:\s*auto[^}]*\}/i
    );
  });

  it("opens Items upward inside the canvas and scrolls internally", () => {
    expect(css).toMatch(
      /\.creator__layers\s*\{[^}]*top:\s*auto[^}]*bottom:\s*var\(--canvas-command-dock-clearance\)[^}]*max-height:\s*calc\(100%\s*-\s*var\(--canvas-command-dock-clearance\)\s*-\s*16px\)[^}]*overflow:\s*auto[^}]*\}/i
    );
  });

  it("separates every observed-price source from its amount", () => {
    expect(css).toMatch(
      /\.money-check__evidence\s+li\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+max-content[^}]*gap:\s*\.5rem[^}]*\}/i
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
      /@media\s*\(min-width:\s*1201px\)[\s\S]*?\.creator__assets\s+\.creator__asset-controls\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator__workspace-separator\s*\{[^}]*cursor:\s*col-resize[^}]*touch-action:\s*none[^}]*\}/i
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

  it("gives the pair roles a full second row on school MacBook widths", () => {
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1201px\)\s*and\s*\(max-width:\s*1599px\)[\s\S]*?\.creator__pair-strip(?:\s*,\s*\.creator__pair-strip:has\([^)]*\))?\s*\{[^}]*grid-template-rows:\s*44px\s+minmax\(56px,\s*1fr\)[^}]*\}/i
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1201px\)\s*and\s*\(max-width:\s*1599px\)[\s\S]*?\.creator__pair-strip(?:\s*,\s*\.creator__pair-strip:has\([^)]*\))?\s*\{[^}]*grid-template-areas:\s*"level audience checklist"\s*"role role role"[^}]*\}/i
    );
    expect(css).toMatch(
      /@media\s*\(min-width:\s*1201px\)\s*and\s*\(max-width:\s*1599px\)[\s\S]*?\.creator__role-card\s*\{[^}]*grid-area:\s*role[^}]*\}/i
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
    expect(css).toMatch(
      /@media\s*\(max-width:\s*900px\)[\s\S]*?\.creator__pane-tabs\s*\{[^}]*display:\s*grid[^}]*\}[\s\S]*?\.creator__workspace-separator\s*\{[^}]*display:\s*none[^}]*\}/i
    );
  });

  it("never sets rem-based interface text below 14 pixels", () => {
    const remSizes = [...css.matchAll(/font-size:\s*(0?\.\d+)rem/gi)]
      .map((match) => Number(match[1]));
    expect(remSizes.length).toBeGreaterThan(0);
    expect(Math.min(...remSizes)).toBeGreaterThanOrEqual(0.875);
  });

  it("scales creator chrome through one token without styling the Fabric canvases", () => {
    expect(css).toMatch(
      /\.creator\s*\{[^}]*--creator-chrome-font-size:\s*1rem[^}]*font-size:\s*var\(--creator-chrome-font-size\)[^}]*\}/i
    );
    expect(css).toMatch(
      /\.creator\[data-display-text="large"\]\s*\{[^}]*--creator-chrome-font-size:\s*1\.125rem[^}]*\}/i
    );
    const largeTextRules = [...css.matchAll(
      /\.creator\[data-display-text="large"\][^{]*\{[^}]*\}/gi
    )].map((match) => match[0]).join("\n");
    expect(largeTextRules).toMatch(/button/);
    expect(largeTextRules).toMatch(/dialog|legend|summary/);
    expect(largeTextRules).not.toMatch(/\bcanvas\b/i);
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
