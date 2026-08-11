import { describe, expect, it } from "vitest";
import { applyCreatorLevelAccess, creatorStageAllows } from "./creator-level-access";
import { STUDENT_COPY } from "./student-copy";

function fixture(): HTMLElement {
  document.body.innerHTML = `
    <main data-creator-root>
      <p data-creator-level-label></p>
      <p data-sandbox-only hidden inert>${STUDENT_COPY.assignmentSandbox.label}</p>
      <section data-guided-only></section>
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

  it("unlocks every creator feature and removes campaign-only chrome in assignment sandbox", () => {
    const root = fixture();

    applyCreatorLevelAccess(root, "invent", "assignment-sandbox");

    expect(root.dataset.workspaceMode).toBe("assignment-sandbox");
    for (const name of ["product", "price", "aida", "route", "coach"]) {
      expect(feature(root, name).dataset.creatorFeatureAvailable).toBe("true");
    }
    expect(root.querySelector<HTMLElement>("[data-guided-only]")!.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>("[data-guided-only]")!.inert).toBe(true);
    expect(root.querySelector<HTMLElement>("[data-sandbox-only]")!.hidden).toBe(false);
    expect(root.querySelector("[data-creator-level-label]")?.textContent)
      .toBe(STUDENT_COPY.assignmentSandbox.label);
    expect(creatorStageAllows("invent", "aida", "assignment-sandbox")).toBe(true);
    expect(creatorStageAllows("invent", "price", "assignment-sandbox")).toBe(true);
    expect(creatorStageAllows("invent", "route", "assignment-sandbox")).toBe(true);
  });

  it("switches hidden and inert mode regions in both directions", () => {
    const root = fixture();
    const guided = root.querySelector<HTMLElement>("[data-guided-only]")!;
    const sandbox = root.querySelector<HTMLElement>("[data-sandbox-only]")!;

    applyCreatorLevelAccess(root, "invent", "assignment-sandbox");

    expect(guided.hidden).toBe(true);
    expect(guided.hasAttribute("inert")).toBe(true);
    expect(sandbox.hidden).toBe(false);
    expect(sandbox.hasAttribute("inert")).toBe(false);

    applyCreatorLevelAccess(root, "invent", "guided");

    expect(guided.hidden).toBe(false);
    expect(guided.hasAttribute("inert")).toBe(false);
    expect(sandbox.hidden).toBe(true);
    expect(sandbox.hasAttribute("inert")).toBe(true);
  });
});
