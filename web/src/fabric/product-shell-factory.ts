import {
  ClipPathLayout,
  Color,
  FabricObject,
  FixedLayout,
  Group,
  LayoutManager,
  loadSVGFromString,
  util
} from "fabric";
import { CREATOR_CONFIG } from "../config";
import {
  composeProductVariantSvg,
  type ProductSvgCompositionInput
} from "../product-builder/product-svg-composer";
import type { NewProductShellInput } from "./canvas-port";
import { FABRIC_SELECTION_STYLE } from "./object-factory";
import "./fabric-custom-properties";

const MAX_SHELL_WIDTH = 720;
const MAX_SHELL_HEIGHT = 620;

export interface NewProductVariantShellInput extends ProductSvgCompositionInput {
  readonly id: string;
  readonly accessibleName: string;
}

function nearestAttribute(element: Element, name: string): string | null {
  return element.closest(`[${name}]`)?.getAttribute(name) ?? null;
}

function descendants(root: FabricObject): FabricObject[] {
  if (!(root instanceof Group)) return [root];
  return [root, ...root.getObjects().flatMap(descendants)];
}

function nestArtworkSurface(objects: readonly FabricObject[]): FabricObject[] {
  const artworkObjects = objects.filter((object) => object.artworkId !== undefined);
  const artworkSlots = objects.filter((object) =>
    object.productLayer === "artwork-slot" || object.artworkSlotId !== undefined
  );
  if (artworkObjects.length === 0 && artworkSlots.length === 0) return [...objects];
  const artwork = artworkObjects[0];
  const artworkSlot = artworkSlots[0];
  if (artworkObjects.length !== 1 || artworkSlots.length !== 1 || artwork !== artworkSlot) {
    throw new Error("Product variant requires exactly one artwork slot and student artwork object");
  }
  if (!artwork) throw new Error("Product variant artwork is missing");
  const slotId = artwork.artworkSlotId;
  const clipPath = artwork.clipPath;
  if (!slotId?.trim() || !clipPath) {
    throw new Error("Product variant artwork requires one named clipped slot");
  }
  const index = objects.indexOf(artwork);
  artwork.set({ productLayer: "student-artwork" });
  Reflect.set(artwork, "clipPath", undefined);
  artwork.dirty = true;
  const surface = new Group([artwork], {
    clipPath,
    productLayer: "artwork-slot",
    artworkSlotId: slotId,
    selectable: false,
    evented: false,
    layoutManager: new LayoutManager(new ClipPathLayout())
  });
  surface.setCoords();
  return [...objects.slice(0, index), surface, ...objects.slice(index + 1)];
}

interface ObjectBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
}

function unionBounds(objects: readonly FabricObject[]): ObjectBounds {
  if (objects.length === 0) throw new Error("Product shell has no visible geometry");
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const object of objects) {
    const bounds = object.getBoundingRect();
    if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite)) {
      throw new Error("Product shell geometry bounds are invalid");
    }
    left = Math.min(left, bounds.left);
    top = Math.min(top, bounds.top);
    right = Math.max(right, bounds.left + bounds.width);
    bottom = Math.max(bottom, bounds.top + bounds.height);
  }
  const width = right - left;
  const height = bottom - top;
  if (!(width > 0) || !(height > 0)) {
    throw new Error("Product shell geometry bounds are invalid");
  }
  return {
    left,
    top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2
  };
}

export class FabricProductShellFactory {
  async create(input: NewProductShellInput): Promise<Group> {
    if (!input.id.trim() || !input.shellId.trim() || !input.accessibleName.trim()) {
      throw new Error("Product shell metadata must not be empty");
    }
    if (!input.svg.trim()) throw new Error("Product shell SVG must not be empty");

    return this.#createGroup(input.svg, {
      objectId: input.id,
      shellId: input.shellId,
      accessibleName: input.accessibleName
    });
  }

  async createVariant(input: NewProductVariantShellInput): Promise<Group> {
    if (!input.id.trim() || !input.accessibleName.trim()) {
      throw new Error("Product variant metadata must not be empty");
    }
    const composed = composeProductVariantSvg({
      variant: input.variant,
      authoringSvg: input.authoringSvg,
      componentSvg: input.componentSvg,
      ...(input.artwork === undefined ? {} : { artwork: input.artwork }),
      ...(input.mode === undefined ? {} : { mode: input.mode })
    });
    return this.#createGroup(composed.svg, {
      objectId: input.id,
      shellId: input.variant.bodyId,
      accessibleName: input.accessibleName,
      packId: input.variant.packId,
      variantId: input.variant.id,
      bodyId: input.variant.bodyId,
      partId: input.variant.partId,
      paletteId: input.variant.paletteId,
      materialId: input.variant.materialId
    });
  }

  async #createGroup(
    svg: string,
    metadata: {
      readonly objectId: string;
      readonly shellId: string;
      readonly accessibleName: string;
      readonly packId?: string;
      readonly variantId?: string;
      readonly bodyId?: string;
      readonly partId?: string;
      readonly paletteId?: string;
      readonly materialId?: string;
    }
  ): Promise<Group> {
    const parsed = await loadSVGFromString(svg, (element, object) => {
      const shellRegion = nearestAttribute(element, "data-region");
      const componentColourZone = nearestAttribute(element, "data-colour-zone");
      const materialTreatment = element.closest("[data-material-treatment]") !== null;
      const productLayer = materialTreatment
        ? "material-treatment"
        : element.closest('[data-layer="selected-component"]')
          ? "selected-component"
          : nearestAttribute(element, "data-layer");
      const componentSlotId = nearestAttribute(element, "data-slot-id");
      const artworkSlotId = nearestAttribute(element, "data-artwork-slot");
      const artworkId = nearestAttribute(element, "data-student-artwork");
      const editorGuide = nearestAttribute(element, "data-print-area") !== null ||
        nearestAttribute(element, "data-safe-area") !== null ||
        nearestAttribute(element, "data-editor-only") !== null;
      object.set({
        ...(shellRegion ?? componentColourZone ? {
          shellRegion: shellRegion ?? componentColourZone ?? undefined
        } : {}),
        ...(productLayer ? { productLayer } : {}),
        ...(componentSlotId ? { componentSlotId } : {}),
        ...(artworkSlotId ? { artworkSlotId } : {}),
        ...(artworkId ? { artworkId } : {}),
        ...(editorGuide ? {
          editorGuide: true,
          selectable: false,
          evented: false
        } : {})
      });
    });
    const objects = parsed.objects.filter(
      (object): object is FabricObject => object !== null
    );
    if (objects.length === 0) throw new Error("Product shell SVG has no drawable objects");
    const nestedObjects = nestArtworkSurface(objects);
    const material = nestedObjects.filter((object) => object.productLayer === "material-treatment");
    let shell: Group;
    if (material.length === 0) {
      const grouped = util.groupSVGElements(nestedObjects, parsed.options);
      shell = grouped instanceof Group ? grouped : new Group([grouped]);
    } else {
      const visualBounds = unionBounds(
        nestedObjects.filter((object) =>
          object.productLayer !== "material-treatment" && object.productLayer !== "artwork-slot"
        )
      );
      const allBounds = unionBounds(nestedObjects);
      shell = new Group(nestedObjects, {
        width: visualBounds.width,
        height: visualBounds.height,
        layoutManager: new LayoutManager(new FixedLayout())
      });
      const dx = allBounds.centerX - visualBounds.centerX;
      const dy = allBounds.centerY - visualBounds.centerY;
      for (const child of shell.getObjects()) {
        child.set({ left: child.left + dx, top: child.top + dy });
        child.setCoords();
      }
      shell.dirty = true;
      shell.setCoords();
    }
    const width = Math.max(1, shell.getScaledWidth());
    const height = Math.max(1, shell.getScaledHeight());
    shell.scale(Math.min(1, MAX_SHELL_WIDTH / width, MAX_SHELL_HEIGHT / height));
    shell.set({
      ...metadata,
      elementKind: "product-shell",
      originX: "center",
      originY: "center",
      left: CREATOR_CONFIG.canvasWidth / 2,
      top: CREATOR_CONFIG.canvasHeight / 2,
      ...FABRIC_SELECTION_STYLE
    });
    shell.setCoords();
    return shell;
  }
}

export function productArtworkSurface(
  shell: FabricObject,
  slotId = "primary"
): Group {
  if (shell.elementKind !== "product-shell" || !slotId.trim()) {
    throw new Error("Artwork surface lookup requires a product shell and named slot");
  }
  const matches = descendants(shell).filter(
    (object): object is Group => object instanceof Group &&
      object.productLayer === "artwork-slot" && object.artworkSlotId === slotId
  );
  if (matches.length !== 1 || !matches[0]?.clipPath ||
      !(matches[0].layoutManager.strategy instanceof ClipPathLayout)) {
    throw new Error(`Product shell has invalid artwork slot ${slotId}`);
  }
  return matches[0];
}

export function recolourProductShellRegion(
  shell: FabricObject,
  region: string,
  colour: string
): number {
  if (shell.elementKind !== "product-shell" || !shell.shellId) {
    throw new Error("Object is not a product shell");
  }
  if (!region.trim()) throw new Error("Product shell region must not be empty");
  const parsedColour = new Color(colour);
  if (parsedColour.isUnrecognised) throw new Error("Product shell colour is invalid");
  const targets = descendants(shell).filter((object) => object.shellRegion === region);
  if (targets.length === 0) throw new Error(`Product shell has missing region ${region}`);
  let changed = 0;
  for (const target of targets) {
    const patch: Record<string, string> = {};
    if (typeof target.fill === "string" && target.fill !== "none") patch.fill = colour;
    if (typeof target.stroke === "string" && target.stroke !== "none") patch.stroke = colour;
    if (Object.keys(patch).length === 0) continue;
    target.set(patch);
    target.dirty = true;
    changed += 1;
  }
  if (changed === 0) throw new Error(`Product shell has missing region ${region}`);
  shell.dirty = true;
  shell.setCoords();
  return changed;
}

export function productShellRegionColours(
  shell: FabricObject
): Readonly<Record<string, string>> {
  if (shell.elementKind !== "product-shell" || !shell.shellId) {
    throw new Error("Object is not a product shell");
  }
  const colours: Record<string, string> = {};
  for (const object of descendants(shell)) {
    if (!object.shellRegion || colours[object.shellRegion] !== undefined ||
      typeof object.fill !== "string" || object.fill === "none") continue;
    colours[object.shellRegion] = object.fill;
  }
  return Object.freeze(colours);
}
