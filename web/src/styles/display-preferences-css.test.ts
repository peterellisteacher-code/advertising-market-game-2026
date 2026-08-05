import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "web", "src", "styles", "editor.css"), "utf8");

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

it("keeps display-preference labels and actions legible in high-contrast mode", () => {
  document.head.innerHTML = `<style>${css}</style>`;
  document.body.innerHTML = `
    <div id="creator-root">
      <section class="creator" data-display-colours="high-contrast">
        <header class="creator__topbar">
          <section class="creator__display-panel">
            <label>Large</label>
            <button type="button">Close display preferences</button>
          </section>
        </header>
      </section>
    </div>`;

  const label = document.querySelector<HTMLElement>(".creator__display-panel label")!;
  const button = document.querySelector<HTMLButtonElement>(".creator__display-panel button")!;
  const creator = document.querySelector<HTMLElement>(".creator")!;

  expect(getComputedStyle(creator).getPropertyValue("--ink").trim()).toBe("#000");
  expect(getComputedStyle(label).color).toBe("var(--ink)");
  expect(getComputedStyle(button).color).toBe("var(--ink)");
});

it("keeps laptop-width asset filters compact enough to leave a results viewport", () => {
  document.head.innerHTML = `<style>${css}</style>`;
  const mediaRule = [...document.styleSheets[0]!.cssRules].find((rule) =>
    "conditionText" in rule && String((rule as CSSMediaRule).conditionText).includes("min-width: 1201px")
  ) as CSSMediaRule | undefined;
  expect(mediaRule).toBeDefined();
  const laptopRules = [...mediaRule!.cssRules].map((rule) => rule.cssText).join("\n");
  document.head.innerHTML = `<style>${laptopRules}</style>`;
  document.body.innerHTML = `
    <section class="creator__assets">
      <div class="creator__asset-controls">
        <label class="creator__library-view">Library view</label>
        <label class="creator__asset-search">Search assets</label>
        <label class="creator__asset-category">Product category</label>
        <label class="creator__asset-colour">Colour</label>
        <label class="creator__live-photos">Show photo products</label>
        <p class="creator__library-status">6 of 6 backgrounds</p>
      </div>
    </section>`;

  const controls = document.querySelector<HTMLElement>(".creator__asset-controls")!;
  const search = document.querySelector<HTMLElement>(".creator__asset-search")!;
  const status = document.querySelector<HTMLElement>(".creator__library-status")!;

  expect(getComputedStyle(controls).gridTemplateColumns).toBe("repeat(2, minmax(0, 1fr))");
  expect(getComputedStyle(search).gridColumn).toBe("");
  expect(getComputedStyle(status).gridColumn).toBe("");
});
