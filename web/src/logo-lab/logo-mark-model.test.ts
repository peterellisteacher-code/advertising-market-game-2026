import { describe, expect, it } from "vitest";
import {
  LOGO_RECIPES,
  createLogoMarkDesign,
  remixLogoColours,
  remixLogoSymbol,
  remixLogoType,
  surpriseLogoMark
} from "./logo-mark-model";

function baseDesign() {
  return createLogoMarkDesign({
    recipe: "icon-wordmark",
    text: "Nova",
    iconId: "paw",
    primary: "#0B6E99",
    secondary: "#F6C85F",
    typeface: "Trebuchet MS",
    seed: 41,
    revision: 0
  });
}

describe("Logo Lab design kernel", () => {
  it("offers exactly the four approved editable recipes", () => {
    expect(LOGO_RECIPES).toEqual([
      { id: "icon-wordmark", label: "Icon + Wordmark" },
      { id: "badge-seal", label: "Badge / Seal" },
      { id: "monogram", label: "Monogram" },
      { id: "mascot-emblem", label: "Mascot / Emblem" }
    ]);
    expect(Object.isFrozen(LOGO_RECIPES)).toBe(true);
  });

  it("normalises and freezes a valid design without mutating its input", () => {
    const input = {
      recipe: "badge-seal" as const,
      text: "  Moon Club  ",
      iconId: " moon-stars ",
      primary: "#123abc",
      secondary: "#f0e68c",
      typeface: "Georgia" as const,
      seed: 7,
      revision: 2
    };
    const original = structuredClone(input);

    const design = createLogoMarkDesign(input);

    expect(design).toStrictEqual({
      recipe: "badge-seal",
      text: "Moon Club",
      iconId: "moon-stars",
      primary: "#123ABC",
      secondary: "#F0E68C",
      typeface: "Georgia",
      seed: 7,
      revision: 2
    });
    expect(Object.isFrozen(design)).toBe(true);
    expect(input).toStrictEqual(original);
  });

  it("rejects unsafe or incomplete editable state", () => {
    const valid = baseDesign();
    expect(() => createLogoMarkDesign({ ...valid, text: " " })).toThrow(/text/i);
    expect(() => createLogoMarkDesign({ ...valid, iconId: "Brand Logo" })).toThrow(/icon/i);
    expect(() => createLogoMarkDesign({ ...valid, primary: "red" })).toThrow(/colour/i);
    expect(() => createLogoMarkDesign({ ...valid, typeface: "Comic Sans MS" as never }))
      .toThrow(/typeface/i);
    expect(() => createLogoMarkDesign({ ...valid, seed: -1 })).toThrow(/seed/i);
  });

  it("remixes symbol, type and colours deterministically while changing one layer", () => {
    const base = baseDesign();
    const original = structuredClone(base);
    const iconIds = ["paw", "rocket", "leaf", "fish"];

    const symbol = remixLogoSymbol(base, iconIds, 17);
    const type = remixLogoType(base, 17);
    const colours = remixLogoColours(base, 17);

    expect(remixLogoSymbol(base, iconIds, 17)).toStrictEqual(symbol);
    expect(remixLogoType(base, 17)).toStrictEqual(type);
    expect(remixLogoColours(base, 17)).toStrictEqual(colours);
    expect(symbol.iconId).not.toBe(base.iconId);
    expect(symbol).toMatchObject({
      text: base.text,
      primary: base.primary,
      secondary: base.secondary,
      typeface: base.typeface,
      revision: 1
    });
    expect(type.typeface).not.toBe(base.typeface);
    expect(type).toMatchObject({ iconId: base.iconId, primary: base.primary, secondary: base.secondary });
    expect([colours.primary, colours.secondary]).not.toEqual([base.primary, base.secondary]);
    expect(colours).toMatchObject({ iconId: base.iconId, typeface: base.typeface });
    expect(base).toStrictEqual(original);
  });

  it("creates a coherent deterministic surprise in one revision", () => {
    const base = baseDesign();
    const iconIds = ["paw", "rocket", "leaf", "fish"];

    const first = surpriseLogoMark(base, iconIds, 99);
    const second = surpriseLogoMark(base, iconIds, 99);

    expect(second).toStrictEqual(first);
    expect(first.revision).toBe(base.revision + 1);
    expect(first.seed).toBe(99);
    expect(first.iconId).not.toBe(base.iconId);
    expect(first.typeface).not.toBe(base.typeface);
    expect([first.primary, first.secondary]).not.toEqual([base.primary, base.secondary]);
    expect(() => surpriseLogoMark(base, [], 4)).toThrow(/icon candidate/i);
  });
});
