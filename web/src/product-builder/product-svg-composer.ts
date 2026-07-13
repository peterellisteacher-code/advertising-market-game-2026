import { MATERIAL_PRESET_IDS } from "../tools/material-presets";
import type { ResolvedProductVariant } from "./virtual-product-variant";

const SVG_NS = "http://www.w3.org/2000/svg";
const PACK_ID = "product-builder-pilot-v1";
const MAX_SVG_BYTES = 128 * 1024;
const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOUR = /^#[0-9A-F]{6}$/;
const SAFE_TAGS = new Set([
  "circle",
  "clipPath",
  "defs",
  "ellipse",
  "g",
  "path",
  "rect",
  "svg"
]);
const SAFE_ATTRIBUTES = new Set([
  "clip-path",
  "color",
  "cx",
  "cy",
  "d",
  "data-artwork-bounds",
  "data-artwork-slot",
  "data-artwork-surface",
  "data-body-id",
  "data-bounds",
  "data-colour-zone",
  "data-component-slot-id",
  "data-editor-only",
  "data-export",
  "data-family-id",
  "data-geometry-id",
  "data-layer",
  "data-light-direction",
  "data-material-id",
  "data-palette-id",
  "data-part-id",
  "data-product-shell",
  "data-region",
  "data-selection-outline",
  "data-slot-id",
  "data-structural-details",
  "data-tone",
  "data-view",
  "fill",
  "fill-opacity",
  "height",
  "id",
  "opacity",
  "r",
  "rx",
  "ry",
  "stroke",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-width",
  "viewBox",
  "width",
  "x",
  "xmlns",
  "y"
]);
const ACTIVE_OR_EXTERNAL = /(?:javascript:|data:|blob:|file:|https?:|\/\/)/i;
const LOCAL_URL_REFERENCE = /^url\(#[A-Za-z][A-Za-z0-9_.:-]*\)$/;

interface BodyIdentity {
  readonly familyId: string;
  readonly geometryId: string;
  readonly slotId: string;
  readonly anchor: readonly [number, number];
  readonly artwork: readonly [number, number, number, number];
  readonly componentScale: number;
}

interface PartIdentity {
  readonly familyId: string;
  readonly geometryId: string;
  readonly slotId: string;
}

function frozenBodyIdentity(
  familyId: string,
  geometryId: string,
  slotId: string,
  anchor: readonly [number, number],
  artwork: readonly [number, number, number, number],
  componentScale: number
): Readonly<BodyIdentity> {
  return Object.freeze({
    familyId,
    geometryId,
    slotId,
    anchor: Object.freeze(anchor),
    artwork: Object.freeze(artwork),
    componentScale
  });
}

const BODY_IDENTITIES = Object.freeze({
  "bags-backpack": frozenBodyIdentity(
    "bags", "body-backpack", "carry-system", [0.5, 0.18], [0.23, 0.3, 0.54, 0.48], 440
  ),
  "bags-carry-bag": frozenBodyIdentity(
    "bags", "body-carry-bag", "carry-system", [0.5, 0.18], [0.18, 0.28, 0.64, 0.52], 440
  ),
  "bags-tote": frozenBodyIdentity(
    "bags", "body-tote", "carry-system", [0.5, 0.18], [0.2, 0.3, 0.6, 0.5], 440
  ),
  "bags-weekender": frozenBodyIdentity(
    "bags", "body-weekender", "carry-system", [0.5, 0.22], [0.22, 0.34, 0.56, 0.4], 440
  ),
  "drinkware-classic-can": frozenBodyIdentity(
    "drinkware", "body-classic-can", "top", [0.5, 0.08], [0.23, 0.22, 0.54, 0.56], 260
  ),
  "drinkware-slim-can": frozenBodyIdentity(
    "drinkware", "body-slim-can", "top", [0.5, 0.08], [0.25, 0.2, 0.5, 0.6], 260
  ),
  "drinkware-sports-bottle": frozenBodyIdentity(
    "drinkware", "body-sports-bottle", "top", [0.5, 0.12], [0.24, 0.3, 0.52, 0.48], 260
  ),
  "drinkware-takeaway-cup": frozenBodyIdentity(
    "drinkware", "body-takeaway-cup", "top", [0.5, 0.1], [0.24, 0.24, 0.52, 0.56], 260
  ),
  "food-packaging-burger-box": frozenBodyIdentity(
    "food-packaging", "body-burger-box", "closure", [0.5, 0.16], [0.18, 0.32, 0.64, 0.46], 440
  ),
  "food-packaging-meal-box": frozenBodyIdentity(
    "food-packaging", "body-meal-box", "closure", [0.5, 0.15], [0.16, 0.3, 0.68, 0.5], 440
  ),
  "food-packaging-noodle-tub": frozenBodyIdentity(
    "food-packaging", "body-noodle-tub", "closure", [0.5, 0.12], [0.23, 0.3, 0.54, 0.48], 440
  ),
  "food-packaging-snack-pouch": frozenBodyIdentity(
    "food-packaging", "body-snack-pouch", "closure", [0.5, 0.12], [0.2, 0.24, 0.6, 0.58], 440
  )
} satisfies Record<string, Readonly<BodyIdentity>>);

const PART_IDENTITIES = Object.freeze({
  "bags-carry-cutout": Object.freeze({
    familyId: "bags", geometryId: "part-carry-cutout", slotId: "carry-system"
  }),
  "bags-carry-long-straps": Object.freeze({
    familyId: "bags", geometryId: "part-carry-long-straps", slotId: "carry-system"
  }),
  "bags-carry-loop": Object.freeze({
    familyId: "bags", geometryId: "part-carry-loop", slotId: "carry-system"
  }),
  "bags-carry-short-straps": Object.freeze({
    familyId: "bags", geometryId: "part-carry-short-straps", slotId: "carry-system"
  }),
  "drinkware-top-flat": Object.freeze({
    familyId: "drinkware", geometryId: "part-top-flat", slotId: "top"
  }),
  "drinkware-top-ring": Object.freeze({
    familyId: "drinkware", geometryId: "part-top-ring", slotId: "top"
  }),
  "drinkware-top-spout": Object.freeze({
    familyId: "drinkware", geometryId: "part-top-spout", slotId: "top"
  }),
  "drinkware-top-straw": Object.freeze({
    familyId: "drinkware", geometryId: "part-top-straw", slotId: "top"
  }),
  "food-packaging-closure-folded": Object.freeze({
    familyId: "food-packaging", geometryId: "part-closure-folded", slotId: "closure"
  }),
  "food-packaging-closure-sleeved": Object.freeze({
    familyId: "food-packaging", geometryId: "part-closure-sleeved", slotId: "closure"
  }),
  "food-packaging-closure-tabbed": Object.freeze({
    familyId: "food-packaging", geometryId: "part-closure-tabbed", slotId: "closure"
  }),
  "food-packaging-closure-zip": Object.freeze({
    familyId: "food-packaging", geometryId: "part-closure-zip", slotId: "closure"
  })
} satisfies Record<string, Readonly<PartIdentity>>);

const PALETTE_IDS = new Set([
  "alpine-mint", "apricot-ink", "berry-cream", "cobalt-citrus",
  "coral-navy", "dusk-lilac", "forest-sun", "glacier-blue",
  "grape-lime", "ink-rose", "mango-aqua", "olive-clay", "plum-gold",
  "scarlet-ice", "sky-tangerine", "teal-raspberry"
]);
const VARIANT_KEYS = [
  "artworkBounds", "authoringUrl", "bodyId", "bodyTitle", "colours",
  "componentAnchor", "componentSlotId", "componentUrl", "familyId", "id",
  "materialId", "materialTitle", "packId", "paletteId", "paletteTitle",
  "partId", "partTitle", "previewUrl", "schema"
].sort();

export interface ProductArtwork {
  readonly id: string;
  readonly colour: string;
}

export type ProductSvgCompositionMode = "editor" | "clean";

export interface ProductSvgCompositionInput {
  readonly variant: ResolvedProductVariant;
  readonly authoringSvg: string;
  readonly componentSvg: string;
  readonly artwork?: ProductArtwork;
  readonly mode?: ProductSvgCompositionMode;
}

export interface ComposedProductSvg {
  readonly svg: string;
  readonly namespace: string;
}

function svgElement(document: XMLDocument, tag: string): SVGElement {
  return document.createElementNS(SVG_NS, tag) as SVGElement;
}

function exactStrings(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function numericTuple(value: string | null, length: number): number[] | null {
  if (value === null) return null;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== length) return null;
  const numbers = parts.map(Number);
  return numbers.every(Number.isFinite) ? numbers : null;
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function exactRootAttributes(root: Element, names: readonly string[]): boolean {
  const actual = Array.from(root.attributes, ({ name }) => name).sort();
  const expected = [...names].sort();
  return actual.length === expected.length && actual.every((name, index) => name === expected[index]);
}

function assertTrustedAssetUrl(value: string, expectedPath: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Product variant contains an untrusted asset URL");
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username || url.password || url.search || url.hash || url.pathname !== expectedPath) {
    throw new Error("Product variant contains an untrusted asset URL");
  }
  return url;
}

function requireImmutableVariant(variant: ResolvedProductVariant): {
  readonly body: Readonly<BodyIdentity>;
  readonly part: Readonly<PartIdentity>;
} {
  if (!variant || typeof variant !== "object" || !Object.isFrozen(variant) ||
    !Object.isFrozen(variant.componentAnchor) || !Object.isFrozen(variant.artworkBounds) ||
    !Object.isFrozen(variant.colours) || !exactKeys(variant, VARIANT_KEYS)) {
    throw new Error("Product variant identity must be immutable");
  }
  const body = BODY_IDENTITIES[variant.bodyId as keyof typeof BODY_IDENTITIES];
  const part = PART_IDENTITIES[variant.partId as keyof typeof PART_IDENTITIES];
  const canonicalId = [
    "product-builder-variant@1", variant.packId, variant.bodyId, variant.partId,
    variant.paletteId, variant.materialId
  ].join(":");
  const anchor = [variant.componentAnchor.x, variant.componentAnchor.y];
  const artwork = [
    variant.artworkBounds.x, variant.artworkBounds.y,
    variant.artworkBounds.width, variant.artworkBounds.height
  ];
  const colours = Object.values(variant.colours);
  if (variant.schema !== "product-builder-variant@1" || variant.packId !== PACK_ID ||
    variant.id !== canonicalId || !body || !part ||
    body.familyId !== variant.familyId || part.familyId !== variant.familyId ||
    body.slotId !== variant.componentSlotId || part.slotId !== variant.componentSlotId ||
    !exactStrings(anchor, body.anchor) || !exactStrings(artwork, body.artwork) ||
    !PALETTE_IDS.has(variant.paletteId) ||
    !(MATERIAL_PRESET_IDS as readonly string[]).includes(variant.materialId) ||
    colours.length !== 4 || !colours.every((colour) => HEX_COLOUR.test(colour)) ||
    new Set(colours).size !== 4) {
    throw new Error("Product variant identity is incompatible with the trusted pilot pack");
  }
  const basePath = `/catalog/generated/${PACK_ID}`;
  const authoring = assertTrustedAssetUrl(
    variant.authoringUrl,
    `${basePath}/bodies/${variant.bodyId}/authoring.svg`
  );
  const preview = assertTrustedAssetUrl(
    variant.previewUrl,
    `${basePath}/bodies/${variant.bodyId}/preview.svg`
  );
  const component = assertTrustedAssetUrl(
    variant.componentUrl,
    `${basePath}/components/${variant.partId}.svg`
  );
  if (authoring.origin !== preview.origin || authoring.origin !== component.origin) {
    throw new Error("Product variant assets must share one trusted local pack origin");
  }
  return { body, part };
}

function parseSafeSvg(value: string, label: string): XMLDocument {
  if (!value.trim() || new TextEncoder().encode(value).byteLength > MAX_SVG_BYTES ||
    /<!DOCTYPE|<!ENTITY/i.test(value)) {
    throw new Error(`${label} must be a safe passive SVG`);
  }
  const document = new DOMParser().parseFromString(value, "image/svg+xml");
  const root = document.documentElement;
  if (document.querySelector("parsererror") || root.tagName !== "svg" || document.doctype) {
    throw new Error(`${label} must be a safe passive SVG`);
  }
  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (!SAFE_TAGS.has(element.tagName)) {
      throw new Error(`${label} must be a safe passive SVG`);
    }
    for (const attribute of Array.from(element.attributes)) {
      const namespaceDeclaration = attribute.name === "xmlns" && attribute.value === SVG_NS;
      if (!SAFE_ATTRIBUTES.has(attribute.name) || attribute.name.toLowerCase().startsWith("on") ||
        (!namespaceDeclaration && ACTIVE_OR_EXTERNAL.test(attribute.value)) ||
        attribute.value.length > 16_384 ||
        (attribute.value.includes("url(") && !LOCAL_URL_REFERENCE.test(attribute.value))) {
        throw new Error(`${label} must be a safe passive SVG`);
      }
    }
  }
  return document;
}

function requireBodyIdentity(
  document: XMLDocument,
  variant: ResolvedProductVariant,
  expected: Readonly<BodyIdentity>
): void {
  const root = document.documentElement;
  const attributes = [
    "data-artwork-bounds", "data-body-id", "data-component-slot-id",
    "data-family-id", "data-geometry-id", "data-light-direction", "data-material-id",
    "data-palette-id", "data-view", "viewBox", "xmlns"
  ];
  const artwork = numericTuple(root.getAttribute("data-artwork-bounds"), 4);
  const directLayers = Array.from(root.children)
    .map((child) => child.getAttribute("data-layer"))
    .filter((layer): layer is string => layer !== null);
  const regions = Array.from(root.querySelectorAll("[data-region]"), (node) =>
    node.getAttribute("data-region")
  ).sort();
  const artworkSlot = root.querySelector('[data-layer="artwork-slot"]');
  if (!exactRootAttributes(root, attributes) || root.getAttribute("viewBox") !== "0 0 1000 1000" ||
    root.getAttribute("data-view") !== "authoring" ||
    root.getAttribute("data-body-id") !== variant.bodyId ||
    root.getAttribute("data-family-id") !== expected.familyId ||
    root.getAttribute("data-geometry-id") !== expected.geometryId ||
    root.getAttribute("data-component-slot-id") !== expected.slotId ||
    root.getAttribute("data-palette-id") !== "alpine-mint" ||
    root.getAttribute("data-material-id") !== "brushed-metal" ||
    root.getAttribute("data-light-direction") !== "top-left" || !artwork ||
    !exactStrings(artwork, expected.artwork) ||
    directLayers.join("|") !== "base-shell|artwork-slot|tone-detail|editor-guides" ||
    regions.join("|") !== "accent|body|label|trim" ||
    root.querySelectorAll('[data-layer="base-shell"]').length !== 1 ||
    root.querySelectorAll('[data-layer="tone-detail"]').length !== 1 ||
    root.querySelectorAll('[data-layer="editor-guides"]').length !== 1 ||
    !artworkSlot || artworkSlot.children.length !== 0 ||
    !artworkSlot.getAttribute("clip-path")?.startsWith("url(#")) {
    throw new Error("Product body identity does not match the trusted variant");
  }
}

function requireComponentIdentity(
  document: XMLDocument,
  variant: ResolvedProductVariant,
  expected: Readonly<PartIdentity>
): void {
  const root = document.documentElement;
  const attributes = [
    "data-bounds", "data-family-id", "data-geometry-id", "data-part-id",
    "data-slot-id", "viewBox", "xmlns"
  ];
  const bounds = numericTuple(root.getAttribute("data-bounds"), 4);
  const structure = root.querySelector('[data-layer="component-structure"]');
  if (!exactRootAttributes(root, attributes) || root.getAttribute("viewBox") !== "0 0 1 1" ||
    root.getAttribute("data-part-id") !== variant.partId ||
    root.getAttribute("data-family-id") !== expected.familyId ||
    root.getAttribute("data-geometry-id") !== expected.geometryId ||
    root.getAttribute("data-slot-id") !== expected.slotId || !bounds ||
    bounds.some((value) => value < 0 || value > 1) ||
    bounds[2]! <= 0 || bounds[3]! <= 0 ||
    bounds[0]! + bounds[2]! > 1 || bounds[1]! + bounds[3]! > 1 ||
    root.children.length !== 1 || !structure ||
    structure.getAttribute("data-colour-zone") !== "trim") {
    throw new Error("Product component identity does not match the trusted variant");
  }
}

function namespaceIds(root: Element, namespace: string): void {
  const remap = new Map<string, string>();
  for (const element of Array.from(root.querySelectorAll("[id]"))) {
    const id = element.id;
    if (!id || remap.has(id)) throw new Error("Trusted product SVG IDs must be unique");
    const namespaced = `${namespace}-${id}`;
    remap.set(id, namespaced);
    element.id = namespaced;
  }
  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    for (const attribute of Array.from(element.attributes)) {
      let next = attribute.value;
      for (const [before, after] of remap) {
        next = next.replaceAll(`url(#${before})`, `url(#${after})`)
          .replaceAll(`#${before}`, `#${after}`);
      }
      if (next !== attribute.value) element.setAttribute(attribute.name, next);
    }
  }
}

function applyPalette(document: XMLDocument, variant: ResolvedProductVariant): void {
  for (const [region, colour] of Object.entries(variant.colours)) {
    const elements = document.querySelectorAll(`[data-region="${region}"]`);
    if (elements.length !== 1) throw new Error(`Product body is missing declared ${region} region`);
    elements[0]!.setAttribute("fill", colour);
  }
}

function addMaterialTreatment(
  document: XMLDocument,
  variant: ResolvedProductVariant,
  namespace: string
): void {
  const defs = document.querySelector("defs");
  const base = document.querySelector('[data-layer="base-shell"]');
  if (!defs || !base) throw new Error("Product body is missing material composition layers");
  const clipId = `${namespace}-material-clip`;
  const clip = svgElement(document, "clipPath");
  clip.id = clipId;
  for (const region of Array.from(base.querySelectorAll("[data-region]"))) {
    const clone = region.cloneNode(true) as Element;
    for (const node of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
      for (const attribute of Array.from(node.attributes)) {
        if (attribute.name.startsWith("data-") || attribute.name === "id" ||
          attribute.name === "clip-path" || attribute.name === "opacity" ||
          attribute.name === "fill-opacity") node.removeAttribute(attribute.name);
      }
    }
    clone.setAttribute("fill", "#000000");
    clone.setAttribute("stroke", "none");
    clip.append(clone);
  }
  defs.append(clip);

  const treatment = svgElement(document, "g");
  treatment.setAttribute("data-material-treatment", variant.materialId);
  treatment.setAttribute("clip-path", `url(#${clipId})`);
  treatment.setAttribute("pointer-events", "none");
  const addRect = (x: number, y: number, width: number, height: number,
    fill: string, opacity: number): void => {
    const rect = svgElement(document, "rect");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("fill", fill);
    rect.setAttribute("opacity", String(opacity));
    treatment.append(rect);
  };
  const addPath = (d: string, stroke: string, width: number, opacity: number): void => {
    const path = svgElement(document, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", stroke);
    path.setAttribute("stroke-width", String(width));
    path.setAttribute("opacity", String(opacity));
    treatment.append(path);
  };
  switch (variant.materialId) {
    case "matte-plastic":
      addRect(0, 0, 1000, 1000, "#000000", 0.025);
      break;
    case "gloss-plastic":
      addPath("M120 880L520 80M360 980L760 180", "#FFFFFF", 72, 0.14);
      break;
    case "rubber":
      for (let x = 80; x < 1000; x += 120) {
        for (let y = 80; y < 1000; y += 120) {
          const circle = svgElement(document, "circle");
          circle.setAttribute("cx", String(x));
          circle.setAttribute("cy", String(y));
          circle.setAttribute("r", "10");
          circle.setAttribute("fill", "#000000");
          circle.setAttribute("opacity", "0.08");
          treatment.append(circle);
        }
      }
      break;
    case "cardboard":
      for (let y = 80; y < 1000; y += 130) {
        addPath(`M0 ${y}Q250 ${y - 20} 500 ${y}T1000 ${y}`, "#4D321F", 5, 0.09);
      }
      break;
    case "fabric":
      for (let offset = 0; offset <= 1000; offset += 90) {
        addPath(`M${offset} 0V1000M0 ${offset}H1000`, "#FFFFFF", 3, 0.11);
      }
      break;
    case "glass":
      addRect(140, 0, 90, 1000, "#FFFFFF", 0.2);
      addRect(300, 0, 28, 1000, "#FFFFFF", 0.12);
      addRect(760, 0, 48, 1000, "#FFFFFF", 0.1);
      break;
    case "brushed-metal":
      for (let y = 35; y < 1000; y += 45) {
        addPath(`M0 ${y}H1000`, y % 90 === 35 ? "#FFFFFF" : "#000000", 3, 0.09);
      }
      break;
    case "wood":
      for (let y = 100; y < 1000; y += 170) {
        addPath(`M0 ${y}Q180 ${y - 55} 360 ${y}T720 ${y}T1080 ${y}`, "#4A2D1C", 8, 0.13);
      }
      break;
  }
  base.append(treatment);
}

function addArtwork(
  document: XMLDocument,
  variant: ResolvedProductVariant,
  artwork: ProductArtwork | undefined
): void {
  const target = document.querySelector('[data-layer="artwork-slot"]');
  if (!target) throw new Error("Product body is missing its artwork slot");
  const selected = artwork ?? { id: "product-artwork-placeholder", colour: variant.colours.label };
  if (!PORTABLE_ID.test(selected.id) || !HEX_COLOUR.test(selected.colour)) {
    throw new Error("Product artwork must use a portable ID and opaque hex colour");
  }
  const bounds = variant.artworkBounds;
  const rect = svgElement(document, "rect");
  rect.setAttribute("data-student-artwork", selected.id);
  rect.setAttribute("x", String(bounds.x * 1000));
  rect.setAttribute("y", String(bounds.y * 1000));
  rect.setAttribute("width", String(bounds.width * 1000));
  rect.setAttribute("height", String(bounds.height * 1000));
  rect.setAttribute("fill", selected.colour);
  rect.setAttribute("opacity", "1");
  target.append(rect);
}

function addComponent(
  bodyDocument: XMLDocument,
  componentDocument: XMLDocument,
  variant: ResolvedProductVariant,
  bodyIdentity: Readonly<BodyIdentity>,
  namespace: string
): void {
  namespaceIds(componentDocument.documentElement, `${namespace}-component`);
  const tone = bodyDocument.querySelector('[data-layer="tone-detail"]');
  if (!tone?.parentElement) throw new Error("Product body is missing its fixed detail layer");
  const component = svgElement(bodyDocument, "g");
  const [anchorX, anchorY] = bodyIdentity.anchor;
  const scale = bodyIdentity.componentScale;
  component.setAttribute("data-layer", "selected-component");
  component.setAttribute("data-part-id", variant.partId);
  component.setAttribute("data-slot-id", variant.componentSlotId);
  component.setAttribute("data-anchor", `${anchorX} ${anchorY}`);
  component.setAttribute("data-rendered-stroke-width", "6");
  component.setAttribute(
    "transform",
    `translate(${anchorX * 1000} ${anchorY * 1000}) scale(${scale}) translate(-0.5 -0.5)`
  );
  for (const child of Array.from(componentDocument.documentElement.children)) {
    const imported = bodyDocument.importNode(child, true) as Element;
    for (const strokeElement of [imported, ...Array.from(imported.querySelectorAll("[stroke-width]"))]) {
      if (strokeElement.hasAttribute("stroke-width")) {
        strokeElement.setAttribute("stroke-width", String(6 / scale));
      }
    }
    for (const zone of [imported, ...Array.from(imported.querySelectorAll('[data-colour-zone="trim"]'))]) {
      if (zone.getAttribute("data-colour-zone") === "trim") {
        zone.setAttribute("color", variant.colours.trim);
        zone.setAttribute("stroke", variant.colours.trim);
      }
    }
    component.append(imported);
  }
  tone.parentElement.insertBefore(component, tone);
}

export function composeProductVariantSvg(
  input: ProductSvgCompositionInput
): ComposedProductSvg {
  const identities = requireImmutableVariant(input.variant);
  if (input.mode !== undefined && input.mode !== "editor" && input.mode !== "clean") {
    throw new Error("Product composition mode must be editor or clean");
  }
  const bodyDocument = parseSafeSvg(input.authoringSvg, "Product body");
  const componentDocument = parseSafeSvg(input.componentSvg, "Product component");
  requireBodyIdentity(bodyDocument, input.variant, identities.body);
  requireComponentIdentity(componentDocument, input.variant, identities.part);

  const namespace = [
    "pbv", input.variant.packId, input.variant.bodyId, input.variant.partId,
    input.variant.paletteId, input.variant.materialId
  ].join("-");
  namespaceIds(bodyDocument.documentElement, namespace);
  applyPalette(bodyDocument, input.variant);
  addMaterialTreatment(bodyDocument, input.variant, namespace);
  addArtwork(bodyDocument, input.variant, input.artwork);
  addComponent(bodyDocument, componentDocument, input.variant, identities.body, namespace);
  if ((input.mode ?? "editor") === "clean") {
    bodyDocument.querySelector('[data-layer="editor-guides"]')?.remove();
  }
  const root = bodyDocument.documentElement;
  root.setAttribute("data-pack-id", input.variant.packId);
  root.setAttribute("data-variant-id", input.variant.id);
  root.setAttribute("data-part-id", input.variant.partId);
  root.setAttribute("data-palette-id", input.variant.paletteId);
  root.setAttribute("data-material-id", input.variant.materialId);
  return Object.freeze({
    svg: new XMLSerializer().serializeToString(bodyDocument),
    namespace
  });
}
