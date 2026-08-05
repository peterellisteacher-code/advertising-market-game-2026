import {
  Circle,
  FabricObject,
  Group,
  Rect,
  Textbox,
  loadSVGFromString,
  util
} from "fabric";
import { CREATOR_CONFIG } from "../config";
import type { LogoIconRecord } from "../logo-lab/logo-icon-catalogue";
import {
  createLogoMarkDesign,
  type LogoMarkDesign
} from "../logo-lab/logo-mark-model";
import type { ElementKind } from "../domain/editor-object";
import { waitForFontReadiness } from "../font-readiness";
import type { LogoLayer } from "./fabric-custom-properties";
import type { NewLogoMarkInput } from "./canvas-port";
import { FABRIC_SELECTION_STYLE } from "./object-factory";
import "./fabric-custom-properties";

interface ChildMeta {
  readonly objectId: string;
  readonly layer: LogoLayer;
  readonly kind: ElementKind;
  readonly accessibleName: string;
}

function requiredId(value: string): string {
  const id = value.trim();
  if (!id) throw new Error("Logo object id must not be empty");
  return id;
}

function monogram(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 3).map((word) => word[0]!.toUpperCase()).join("");
  return initials || value.slice(0, 2).toUpperCase();
}

function child<T extends FabricObject>(object: T, meta: ChildMeta): T {
  object.set({
    objectId: meta.objectId,
    logoLayer: meta.layer,
    elementKind: meta.kind,
    accessibleName: meta.accessibleName,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false
  });
  object.setCoords();
  return object;
}

function containerFor(design: LogoMarkDesign): FabricObject {
  switch (design.recipe) {
    case "icon-wordmark":
      return new Rect({
        width: 600,
        height: 190,
        rx: 38,
        ry: 38,
        fill: design.secondary,
        stroke: design.primary,
        strokeWidth: 10
      });
    case "badge-seal":
      return new Circle({
        radius: 178,
        fill: design.secondary,
        stroke: design.primary,
        strokeWidth: 14
      });
    case "monogram":
      return new Rect({
        width: 380,
        height: 300,
        rx: 74,
        ry: 74,
        fill: design.primary,
        stroke: design.secondary,
        strokeWidth: 12
      });
    case "mascot-emblem":
      return new Rect({
        width: 520,
        height: 350,
        rx: 86,
        ry: 86,
        fill: design.secondary,
        stroke: design.primary,
        strokeWidth: 12
      });
  }
}

async function vectorSymbol(icon: LogoIconRecord, colour: string): Promise<FabricObject> {
  const body = icon.body.replaceAll("currentColor", colour);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width} ${icon.height}">${body}</svg>`;
  const parsed = await loadSVGFromString(svg);
  const objects = parsed.objects.filter((object): object is FabricObject => object !== null);
  if (objects.length === 0) throw new Error(`Logo icon ${icon.id} produced no vector objects`);
  return util.groupSVGElements(objects, parsed.options);
}

function configureSymbolSize(symbol: FabricObject, target: number): void {
  const width = Math.max(1, symbol.width || 1);
  const height = Math.max(1, symbol.height || 1);
  symbol.scale(Math.min(target / width, target / height));
}

function wordmarkFor(design: LogoMarkDesign, width: number, fontSize: number): Textbox {
  return new Textbox(design.text, {
    width,
    fontFamily: design.typeface,
    fontSize,
    fontWeight: 800,
    fill: design.primary,
    textAlign: "center",
    splitByGrapheme: false
  });
}

export async function waitForLogoTypeface(typeface: string): Promise<void> {
  await waitForFontReadiness(document.fonts, `800 48px "${typeface}"`);
}

export class FabricLogoMarkFactory {
  async create(input: NewLogoMarkInput): Promise<Group> {
    const id = requiredId(input.id);
    const design = createLogoMarkDesign(input.design);
    await waitForLogoTypeface(design.typeface);
    if (input.icon.id !== design.iconId) {
      throw new Error("Logo icon must match the editable design icon id");
    }

    const container = child(containerFor(design), {
      objectId: `${id}:container`,
      layer: "container",
      kind: "shape",
      accessibleName: `${design.text} logo container`
    });
    let symbol: FabricObject;
    let wordmark: Textbox;

    if (design.recipe === "monogram") {
      symbol = new Textbox(monogram(design.text), {
        width: 300,
        fontFamily: design.typeface,
        fontSize: 142,
        fontWeight: 900,
        fill: design.secondary,
        textAlign: "center",
        left: 0,
        top: -22
      });
      wordmark = wordmarkFor(design, 310, 34);
      wordmark.set({ left: 0, top: 102, fill: design.secondary });
    } else {
      symbol = await vectorSymbol(input.icon, design.primary);
      if (design.recipe === "icon-wordmark") {
        configureSymbolSize(symbol, 118);
        symbol.set({ left: -205, top: 0 });
        wordmark = wordmarkFor(design, 360, 58);
        wordmark.set({ left: 92, top: 0 });
      } else if (design.recipe === "badge-seal") {
        configureSymbolSize(symbol, 142);
        symbol.set({ left: 0, top: -40 });
        wordmark = wordmarkFor(design, 290, 43);
        wordmark.set({ left: 0, top: 112 });
      } else {
        configureSymbolSize(symbol, 180);
        symbol.set({ left: 0, top: -55 });
        wordmark = wordmarkFor(design, 420, 46);
        wordmark.set({ left: 0, top: 112 });
      }
    }

    child(symbol, {
      objectId: `${id}:symbol`,
      layer: "symbol",
      kind: design.recipe === "monogram" ? "text" : "shape",
      accessibleName: `${design.text} logo symbol`
    });
    child(wordmark, {
      objectId: `${id}:wordmark`,
      layer: "wordmark",
      kind: "text",
      accessibleName: `${design.text} wordmark`
    });

    const mark = new Group([container, symbol, wordmark], {
      subTargetCheck: false,
      interactive: false
    });
    mark.set({
      objectId: id,
      elementKind: "logo-mark",
      accessibleName: `${design.text} logo`,
      logoRecipe: design.recipe,
      logoSeed: design.seed,
      logoRevision: design.revision,
      logoIconId: design.iconId,
      logoText: design.text,
      logoPrimary: design.primary,
      logoSecondary: design.secondary,
      logoTypeface: design.typeface,
      originX: "center",
      originY: "center",
      left: CREATOR_CONFIG.canvasWidth / 2,
      top: CREATOR_CONFIG.canvasHeight / 2,
      ...FABRIC_SELECTION_STYLE
    });
    const scale = Math.min(1, 640 / Math.max(1, mark.width), 360 / Math.max(1, mark.height));
    mark.scale(scale);
    mark.setCoords();
    return mark;
  }
}
