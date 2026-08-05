import { Group, Textbox } from "fabric";
import { describe, expect, it, vi } from "vitest";
import type { LogoIconRecord } from "../logo-lab/logo-icon-catalogue";
import { createBlankCampaignDocument, parseCampaignDocument } from "../domain/campaign-document";
import {
  LOGO_RECIPES,
  createLogoMarkDesign,
  type LogoRecipeId
} from "../logo-lab/logo-mark-model";
import { FABRIC_CONTROL_SIZE } from "./object-factory";
import { FabricLogoMarkFactory, waitForLogoTypeface } from "./logo-mark-factory";

const icon: LogoIconRecord = Object.freeze({
  id: "paw",
  title: "Paw",
  body: '<path fill="none" stroke="currentColor" stroke-width="2" d="M4 12h16"/>',
  width: 24,
  height: 24,
  categories: Object.freeze(["pets-animals"])
});

function design(recipe: LogoRecipeId) {
  return createLogoMarkDesign({
    recipe,
    text: "Nova Pet",
    iconId: icon.id,
    primary: "#0B6E99",
    secondary: "#F6C85F",
    typeface: "Trebuchet MS",
    seed: 41,
    revision: 2
  });
}

describe("FabricLogoMarkFactory", () => {
  it("stops waiting when a bundled typeface never settles", async () => {
    vi.useFakeTimers();
    try {
      const load = vi.fn(() => new Promise<FontFace[]>(() => undefined));
      Object.defineProperty(document, "fonts", { configurable: true, value: { load } });
      let settled = false;
      void waitForLogoTypeface("Lilita One").then(() => { settled = true; });

      await vi.advanceTimersByTimeAsync(3_000);

      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(LOGO_RECIPES)("creates an editable semantic $label group", async ({ id: recipe }) => {
    const factory = new FabricLogoMarkFactory();

    const mark = await factory.create({ id: `logo-${recipe}`, design: design(recipe), icon });

    expect(mark).toBeInstanceOf(Group);
    expect(mark).toMatchObject({
      objectId: `logo-${recipe}`,
      elementKind: "logo-mark",
      accessibleName: "Nova Pet logo",
      logoRecipe: recipe,
      logoSeed: 41,
      logoRevision: 2,
      logoIconId: "paw",
      logoText: "Nova Pet",
      logoPrimary: "#0B6E99",
      logoSecondary: "#F6C85F",
      logoTypeface: "Trebuchet MS",
      originX: "center",
      originY: "center",
      cornerSize: FABRIC_CONTROL_SIZE,
      touchCornerSize: FABRIC_CONTROL_SIZE
    });
    expect(mark.getObjects().map((child) => [child.logoLayer, child.objectId])).toEqual([
      ["container", `logo-${recipe}:container`],
      ["symbol", `logo-${recipe}:symbol`],
      ["wordmark", `logo-${recipe}:wordmark`]
    ]);
    expect(mark.getObjects().every((child) => child.selectable === false)).toBe(true);
    expect(mark.getObjects().some((child) => child instanceof Textbox)).toBe(true);
    expect(mark.width).toBeGreaterThan(100);
    expect(mark.height).toBeGreaterThan(80);
  }, 15_000);

  it("rejects icon/design mismatches before parsing SVG", async () => {
    const factory = new FabricLogoMarkFactory();
    await expect(factory.create({
      id: "logo-1",
      design: createLogoMarkDesign({ ...design("icon-wordmark"), iconId: "rocket" }),
      icon
    })).rejects.toThrow(/icon.*match/i);
  });

  it("serialises root and nested editing metadata", async () => {
    const factory = new FabricLogoMarkFactory();
    const mark = await factory.create({ id: "logo-1", design: design("badge-seal"), icon });

    const state = mark.toObject();

    expect(state).toMatchObject({
      type: "Group",
      objectId: "logo-1",
      elementKind: "logo-mark",
      logoRecipe: "badge-seal",
      logoIconId: "paw",
      objects: [
        expect.objectContaining({ logoLayer: "container", objectId: "logo-1:container" }),
        expect.objectContaining({ logoLayer: "symbol", objectId: "logo-1:symbol" }),
        expect.objectContaining({ logoLayer: "wordmark", objectId: "logo-1:wordmark" })
      ]
    });

    const document = createBlankCampaignDocument({
      documentId: "logo-doc",
      sessionId: "logo-session",
      mode: "offline"
    });
    expect(parseCampaignDocument({
      ...document,
      fabricState: { version: "7.4.0", objects: [state] }
    }).fabricState.objects[0]).toMatchObject({ objectId: "logo-1", elementKind: "logo-mark" });
  });
});
