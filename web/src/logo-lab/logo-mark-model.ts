export type LogoRecipeId =
  | "icon-wordmark"
  | "badge-seal"
  | "monogram"
  | "mascot-emblem";

export type LogoTypeface = "Arial" | "Georgia" | "Trebuchet MS" | "Verdana" | "Lilita One" | "Bebas Neue" | "Russo One";

export interface LogoRecipeDefinition {
  readonly id: LogoRecipeId;
  readonly label: string;
}

export interface LogoMarkDesign {
  readonly recipe: LogoRecipeId;
  readonly text: string;
  readonly iconId: string;
  readonly primary: string;
  readonly secondary: string;
  readonly typeface: LogoTypeface;
  readonly seed: number;
  readonly revision: number;
}

export const LOGO_RECIPES: readonly LogoRecipeDefinition[] = Object.freeze([
  Object.freeze({ id: "icon-wordmark", label: "Icon + Wordmark" }),
  Object.freeze({ id: "badge-seal", label: "Badge / Seal" }),
  Object.freeze({ id: "monogram", label: "Monogram" }),
  Object.freeze({ id: "mascot-emblem", label: "Mascot / Emblem" })
]);

export const LOGO_TYPEFACES: readonly LogoTypeface[] = Object.freeze([
  "Arial",
  "Georgia",
  "Trebuchet MS",
  "Verdana",
  "Lilita One",
  "Bebas Neue",
  "Russo One"
]);

const LOGO_PALETTES: readonly (readonly [string, string])[] = Object.freeze([
  Object.freeze(["#0B6E99", "#F6C85F"] as const),
  Object.freeze(["#172033", "#F25F5C"] as const),
  Object.freeze(["#0F766E", "#FDE68A"] as const),
  Object.freeze(["#7C3AED", "#FDE047"] as const),
  Object.freeze(["#9F1239", "#FBCFE8"] as const),
  Object.freeze(["#1D4ED8", "#DBEAFE"] as const),
  Object.freeze(["#3F6212", "#ECFCCB"] as const),
  Object.freeze(["#7C2D12", "#FED7AA"] as const),
  Object.freeze(["#155E75", "#CFFAFE"] as const),
  Object.freeze(["#4C1D95", "#EDE9FE"] as const),
  Object.freeze(["#374151", "#F9FAFB"] as const),
  Object.freeze(["#111827", "#34D399"] as const)
]);

const RECIPE_IDS = new Set(LOGO_RECIPES.map(({ id }) => id));
const TYPEFACE_SET = new Set<string>(LOGO_TYPEFACES);
const ICON_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOUR = /^#[0-9A-F]{6}$/;
const MAX_UINT32 = 0xFFFF_FFFF;

function nonBlank(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) {
    throw new Error(`${label} must contain 1 to ${maxLength} characters`);
  }
  return trimmed;
}

function iconId(value: unknown): string {
  const parsed = nonBlank(value, "Logo icon id", 100);
  if (!ICON_ID.test(parsed)) throw new Error("Logo icon id is invalid");
  return parsed;
}

function colour(value: unknown): string {
  if (typeof value !== "string") throw new Error("Logo colour must be a string");
  const parsed = value.trim().toUpperCase();
  if (!HEX_COLOUR.test(parsed)) throw new Error("Logo colour must be a six-digit hex colour");
  return parsed;
}

function uint32(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_UINT32) {
    throw new Error(`${label} must be an unsigned 32-bit integer`);
  }
  return value;
}

function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Logo revision must be a non-negative safe integer");
  }
  return value;
}

export function createLogoMarkDesign(input: LogoMarkDesign): LogoMarkDesign {
  if (!RECIPE_IDS.has(input.recipe)) throw new Error("Logo recipe is unsupported");
  if (!TYPEFACE_SET.has(input.typeface)) throw new Error("Logo typeface is unsupported");
  return Object.freeze({
    recipe: input.recipe,
    text: nonBlank(input.text, "Logo text", 48),
    iconId: iconId(input.iconId),
    primary: colour(input.primary),
    secondary: colour(input.secondary),
    typeface: input.typeface,
    seed: uint32(input.seed, "Logo seed"),
    revision: revision(input.revision)
  });
}

function mixedSeed(seed: number, salt: number): number {
  let value = (uint32(seed, "Logo seed") ^ salt ^ 0x9E37_79B9) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

function differentChoice<T>(
  values: readonly T[],
  current: T,
  seed: number,
  salt: number
): T {
  const alternatives = values.filter((value) => value !== current);
  const choices = alternatives.length > 0 ? alternatives : values;
  if (choices.length === 0) throw new Error("Logo remix has no choices");
  return choices[mixedSeed(seed, salt) % choices.length]!;
}

function candidateIconIds(values: readonly string[]): readonly string[] {
  const unique = [...new Set(values.map(iconId))];
  if (unique.length === 0) throw new Error("Logo remix needs at least one icon candidate");
  return Object.freeze(unique);
}

function revised(
  design: LogoMarkDesign,
  patch: Partial<Omit<LogoMarkDesign, "revision">>,
  seed: number
): LogoMarkDesign {
  return createLogoMarkDesign({
    ...createLogoMarkDesign(design),
    ...patch,
    seed: uint32(seed, "Logo seed"),
    revision: design.revision + 1
  });
}

export function remixLogoSymbol(
  design: LogoMarkDesign,
  iconIds: readonly string[],
  seed: number
): LogoMarkDesign {
  const current = createLogoMarkDesign(design);
  const candidates = candidateIconIds(iconIds);
  return revised(current, {
    iconId: differentChoice(candidates, current.iconId, seed, 0x51_4D_42_4C)
  }, seed);
}

export function remixLogoType(design: LogoMarkDesign, seed: number): LogoMarkDesign {
  const current = createLogoMarkDesign(design);
  return revised(current, {
    typeface: differentChoice(LOGO_TYPEFACES, current.typeface, seed, 0x54_59_50_45)
  }, seed);
}

export function remixLogoColours(design: LogoMarkDesign, seed: number): LogoMarkDesign {
  const current = createLogoMarkDesign(design);
  const currentKey = `${current.primary}|${current.secondary}`;
  const palette = differentChoice(
    LOGO_PALETTES,
    LOGO_PALETTES.find(([primary, secondary]) => `${primary}|${secondary}` === currentKey) ??
      ([current.primary, current.secondary] as const),
    seed,
    0x43_4F_4C_52
  );
  return revised(current, { primary: palette[0], secondary: palette[1] }, seed);
}

export function surpriseLogoMark(
  design: LogoMarkDesign,
  iconIds: readonly string[],
  seed: number
): LogoMarkDesign {
  const current = createLogoMarkDesign(design);
  const candidates = candidateIconIds(iconIds);
  const currentPalette = LOGO_PALETTES.find(([primary, secondary]) =>
    primary === current.primary && secondary === current.secondary) ??
    ([current.primary, current.secondary] as const);
  const palette = differentChoice(LOGO_PALETTES, currentPalette, seed, 0x53_55_52_50);
  return revised(current, {
    iconId: differentChoice(candidates, current.iconId, seed, 0x53_59_4D_42),
    typeface: differentChoice(LOGO_TYPEFACES, current.typeface, seed, 0x53_54_59_50),
    primary: palette[0],
    secondary: palette[1]
  }, seed);
}
