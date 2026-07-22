import { describe, expect, it } from "vitest";
import { applyCreatorLevelAccess, creatorStageAllows } from "./creator-level-access";

function fixture(): HTMLElement {
  document.body.innerHTML = `
    <main data-creator-root>
      <p data-creator-level-label></p>
      <nav data-creator-checklist>
        <button data-slot="price">Price</button>
        <button data-slot="attention">Attention</button>
        <button data-slot="interest">Interest</button>
        <button data-slot="desire">Desire</button>
        <button data-slot="action">Action</button>
      </nav>
      <section data-creator-feature="product"></section>
      <section data-creator-feature="aida"></section>
      <section data-creator-feature="price"></section>
      <section data-creator-feature="route"></section>
      <section data-creator-feature="coach"></section>
    </main>`;
  return document.querySelector<HTMLElement>("[data-creator-root]")!;
}

function feature(root: HTMLElement, name: string): HTMLElement {
  return root.querySelector<HTMLElement>(`[data-creator-feature="${name}"]`)!;
}

describe("creator level access", () => {
  it("reveals only product invention tools in Level 1", () => {
    const root = fixture();

    applyCreatorLevelAccess(root, "invent");

    expect(feature(root, "product").hidden).toBe(false);
    expect(feature(root, "price").hidden).toBe(true);
    expect(feature(root, "aida").hidden).toBe(true);
    expect(feature(root, "route").hidden).toBe(true);
    expect(feature(root, "coach").hidden).toBe(true);
    expect(root.querySelector<HTMLElement>("[data-creator-checklist]")!.hidden).toBe(true);
    expect(root.querySelector("[data-creator-level-label]")?.textContent).toContain("LEVEL 1");
  });

  it("unlocks AIDA in Level 2 but keeps price and route for Level 3", () => {
    const root = fixture();

    applyCreatorLevelAccess(root, "sell");

    expect(feature(root, "product").hidden).toBe(false);
    expect(feature(root, "price").hidden).toBe(true);
    expect(feature(root, "aida").hidden).toBe(false);
    expect(feature(root, "route").hidden).toBe(true);
    expect(feature(root, "coach").hidden).toBe(false);
    expect(root.querySelector<HTMLElement>("[data-creator-checklist]")!.hidden).toBe(false);
    expect(root.querySelector<HTMLButtonElement>("[data-slot=price]")!.hidden).toBe(true);
    expect(root.querySelector<HTMLButtonElement>("[data-slot=price]")!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>("[data-slot=attention]")!.hidden).toBe(false);
    expect(root.querySelector("[data-creator-level-label]")?.textContent).toContain("LEVEL 2");
  });

  it("unlocks the complete market finish in Level 3 and the final look", () => {
    for (const stage of ["irresistible", "publish-check"] as const) {
      const root = fixture();

      applyCreatorLevelAccess(root, stage);

      for (const name of ["product", "price", "aida", "route", "coach"]) {
        expect(feature(root, name).hidden).toBe(false);
      }
      for (const tab of root.querySelectorAll<HTMLButtonElement>("[data-slot]")) {
        expect(tab.hidden).toBe(false);
        expect(tab.disabled).toBe(false);
      }
    }
  });

  it("does not open an inactive studio drawer panel merely because its level is unlocked", () => {
    const root = fixture();
    const aida = feature(root, "aida");
    aida.dataset.studioPanel = "aida";
    aida.hidden = true;

    applyCreatorLevelAccess(root, "sell");

    expect(aida.hidden).toBe(true);
    expect(aida.dataset.creatorFeatureAvailable).toBe("true");
  });

  it("keeps later-level commands locked even while cost clues remain visible", () => {
    expect(creatorStageAllows("invent", "aida")).toBe(false);
    expect(creatorStageAllows("invent", "price")).toBe(false);
    expect(creatorStageAllows("sell", "aida")).toBe(true);
    expect(creatorStageAllows("sell", "price")).toBe(false);
    expect(creatorStageAllows("irresistible", "price")).toBe(true);
    expect(creatorStageAllows("irresistible", "route")).toBe(true);
  });
});
