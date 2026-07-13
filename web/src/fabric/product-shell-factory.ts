import {
  Color,
  FabricObject,
  Group,
  loadSVGFromString,
  util
} from "fabric";
import { CREATOR_CONFIG } from "../config";
import {
  composeProductVariantSvg,
  type ProductSvgCompositionInput
} from "../product-builder/product-svg-composer";
import type { NewProductShellInput } from "./canvas-port";
import { FABRIC_CONTROL_SIZE } from "./object-factory";
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
      const productLayer = element.closest('[data-layer="selected-component"]')
        ? "selected-component"
        : nearestAttribute(element, "data-layer");
      const componentSlotId = nearestAttribute(element, "data-slot-id");
      const editorGuide = nearestAttribute(element, "data-print-area") !== null ||
        nearestAttribute(element, "data-safe-area") !== null ||
        nearestAttribute(element, "data-editor-only") !== null;
      object.set({
        ...(shellRegion ?? componentColourZone ? {
          shellRegion: shellRegion ?? componentColourZone ?? undefined
        } : {}),
        ...(productLayer ? { productLayer } : {}),
        ...(componentSlotId ? { componentSlotId } : {}),
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
    const grouped = util.groupSVGElements(objects, parsed.options);
    const shell = grouped instanceof Group ? grouped : new Group([grouped]);
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
      cornerSize: FABRIC_CONTROL_SIZE,
      touchCornerSize: FABRIC_CONTROL_SIZE,
      transparentCorners: false,
      borderScaleFactor: 2
    });
    shell.setCoords();
    return shell;
  }
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
