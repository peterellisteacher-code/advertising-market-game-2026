import { describe, expect, it } from "vitest";
import type { LogoIconRecord } from "../logo-lab/logo-icon-catalogue";
import { createLogoMarkDesign } from "../logo-lab/logo-mark-model";
import type {
  CanvasPoint,
  CanvasSize,
  CanvasMutationListener,
  CanvasPort,
  CropState,
  DrawingToolSettings,
  NewProductVariantInput,
  NewProductShellInput,
  NewRasterInput,
  NewShapeInput,
  NewTextInput,
  NewLogoMarkInput,
  LogoMarkSource,
  LogoMarkSnapshot,
  ObjectTransform,
  ArtworkSurfaceAddress,
  ShapeKind,
  StackDirection
} from "./canvas-port";
import { ObjectCommandService } from "./object-command-service";

type ArtworkCall =
  | { type: "text:add"; target: ArtworkSurfaceAddress; id: string; value: string }
  | { type: "shape:add"; target: ArtworkSurfaceAddress; id: string; kind: ShapeKind }
  | { type: "raster:add"; target: ArtworkSurfaceAddress; id: string; assetId: string }
  | { type: "text:set"; target: ArtworkSurfaceAddress; id: string; value: string }
  | { type: "remove"; target: ArtworkSurfaceAddress; id: string };

interface MemoryObject extends ObjectTransform {
  id: string;
  kind: string;
  locked: boolean;
  visible: boolean;
  [key: string]: unknown;
}

class MemoryCanvasPort implements CanvasPort {
  readonly objects: MemoryObject[] = [];
  readonly moves: StackDirection[] = [];
  readonly artworkCalls: ArtworkCall[] = [];
  selectedId: string | null = null;
  drawingTool: DrawingToolSettings = { mode: "select" };

  async addText(input: NewTextInput): Promise<void> { this.#add(input.id, "text", input); }
  async addShape(input: NewShapeInput): Promise<void> { this.#add(input.id, input.kind, input); }
  async addRaster(input: NewRasterInput): Promise<void> { this.#add(input.id, "image", input); }
  async addLogoMark(input: NewLogoMarkInput): Promise<void> {
    this.#add(input.id, "logo-mark", input);
  }
  async replaceLogoMark(id: string, input: LogoMarkSource): Promise<void> {
    Object.assign(this.#get(id), input);
  }
  listLogoMarks(): readonly LogoMarkSnapshot[] {
    return this.objects
      .filter((object) => object.kind === "logo-mark")
      .map((object) => ({ id: object.id, design: object.design as LogoMarkSnapshot["design"] }));
  }
  async addProductShell(input: NewProductShellInput): Promise<void> {
    this.#add(input.id, "product-shell", input);
  }
  async addProductVariant(input: NewProductVariantInput): Promise<void> {
    this.#add(input.id, "product-builder-variant", input);
  }
  async addArtworkText(target: ArtworkSurfaceAddress, input: NewTextInput): Promise<void> {
    this.artworkCalls.push({ type: "text:add", target: { ...target }, id: input.id, value: input.value });
  }
  async addArtworkShape(target: ArtworkSurfaceAddress, input: NewShapeInput): Promise<void> {
    this.artworkCalls.push({ type: "shape:add", target: { ...target }, id: input.id, kind: input.kind });
  }
  async addArtworkRaster(target: ArtworkSurfaceAddress, input: NewRasterInput): Promise<void> {
    this.artworkCalls.push({ type: "raster:add", target: { ...target }, id: input.id, assetId: input.assetId });
  }
  setArtworkText(target: ArtworkSurfaceAddress, id: string, value: string): void {
    this.artworkCalls.push({ type: "text:set", target: { ...target }, id, value });
  }
  removeArtwork(target: ArtworkSurfaceAddress, id: string): void {
    this.artworkCalls.push({ type: "remove", target: { ...target }, id });
  }
  setProductShellRegion(id: string, region: string, colour: string): void {
    Object.assign(this.#get(id), { [region]: colour });
  }
  getProductShellRegionColours(): Readonly<Record<string, string>> { return {}; }

  setText(id: string, value: string): void {
    const object = this.#get(id);
    if (object.kind !== "text") throw new Error(`${id} is not text`);
    object.value = value;
  }

  transform(id: string, patch: Partial<ObjectTransform>): void {
    Object.assign(this.#get(id), patch);
  }

  async duplicate(id: string, newId: string): Promise<void> {
    this.objects.push({ ...this.#get(id), id: newId });
  }

  remove(id: string): void {
    const index = this.objects.findIndex((object) => object.id === id);
    if (index < 0) throw new Error(`Missing object ${id}`);
    this.objects.splice(index, 1);
    if (this.selectedId === id) this.selectedId = null;
  }

  move(_id: string, direction: StackDirection): void { this.moves.push(direction); }
  setLocked(id: string, locked: boolean): void { this.#get(id).locked = locked; }
  setVisible(id: string, visible: boolean): void { this.#get(id).visible = visible; }
  setSelected(id: string | null): void { this.selectedId = id; }
  getCropSourceSize(id: string): CanvasSize {
    const object = this.#get(id);
    return {
      width: Number(object.sourceWidth ?? 640),
      height: Number(object.sourceHeight ?? 480)
    };
  }
  setCrop(id: string, crop: CropState): void { Object.assign(this.#get(id), crop); }
  setDrawingTool(settings: DrawingToolSettings): void { this.drawingTool = structuredClone(settings); }
  eraseTopmostDrawing(point: CanvasPoint, radius: number): boolean {
    for (let index = this.objects.length - 1; index >= 0; index -= 1) {
      const object = this.objects[index]!;
      if (object.kind !== "drawing" ||
        Math.hypot(Number(object.x) - point.x, Number(object.y) - point.y) > radius) continue;
      this.objects.splice(index, 1);
      return true;
    }
    return false;
  }
  serialize(): Record<string, unknown> { return { objects: structuredClone(this.objects) }; }
  exportCleanPngDataUrl(): string { return "data:image/png;base64,"; }

  async load(value: Record<string, unknown>): Promise<void> {
    this.objects.splice(0, this.objects.length, ...structuredClone(value.objects as MemoryObject[]));
  }

  subscribe(_listener: CanvasMutationListener): () => void { return () => undefined; }
  has(id: string): boolean { return this.objects.some((object) => object.id === id); }
  snapshot(): { selectedId: string | null; objects: MemoryObject[]; moves: StackDirection[] } {
    return { selectedId: this.selectedId, objects: this.objects, moves: this.moves };
  }

  #add(
    id: string,
    kind: string,
    extra: NewTextInput | NewShapeInput | NewRasterInput | NewProductShellInput |
      NewProductVariantInput | NewLogoMarkInput
  ): void {
    const { id: _inputId, ...metadata } = extra;
    this.objects.push({
      id,
      kind,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      flipX: false,
      flipY: false,
      locked: false,
      visible: true,
      ...metadata
    });
  }

  #get(id: string): MemoryObject {
    const object = this.objects.find((candidate) => candidate.id === id);
    if (!object) throw new Error(`Missing object ${id}`);
    return object;
  }
}

const idFactory = (...ids: string[]): (() => string) => {
  let index = 0;
  return () => ids[index++] ?? `extra-${index}`;
};

const COMMAND_ICON: LogoIconRecord = Object.freeze({
  id: "paw",
  title: "Paw",
  body: '<path d="M4 12h16"/>',
  width: 24,
  height: 24,
  categories: Object.freeze(["pets-animals"])
});

const commandLogoDesign = createLogoMarkDesign({
  recipe: "icon-wordmark",
  text: "Nova Pet",
  iconId: COMMAND_ICON.id,
  primary: "#0B6E99",
  secondary: "#F6C85F",
  typeface: "Trebuchet MS",
  seed: 41,
  revision: 0
});

describe("ObjectCommandService", () => {
  it("adds, replaces and reselects one editable logo mark", async () => {
    const port = new MemoryCanvasPort();
    const commands = new ObjectCommandService(port, idFactory("logo-1"));

    const id = await commands.addLogoMark({ design: commandLogoDesign, icon: COMMAND_ICON });
    port.selectedId = "previous-selection";
    const revised = createLogoMarkDesign({
      ...commandLogoDesign,
      recipe: "badge-seal",
      revision: 1
    });
    await commands.replaceLogoMark(id, { design: revised, icon: COMMAND_ICON });

    expect(id).toBe("logo-1");
    expect(port.selectedId).toBe(id);
    expect(port.listLogoMarks()).toEqual([{ id, design: revised }]);
  });

  it("performs every required object command through the Fabric-free port", async () => {
    const port = new MemoryCanvasPort();
    const commands = new ObjectCommandService(port, idFactory("shape-1", "copy-1"));
    const id = await commands.addShape({ kind: "rect", fill: "#e11d48" });

    commands.transform(id, {
      x: 140,
      y: 90,
      scaleX: 1.5,
      scaleY: 0.75,
      angle: 18,
      flipX: true
    });
    const copyId = await commands.duplicate(id);
    commands.moveToFront(copyId);
    commands.moveForward(copyId);
    commands.moveBackward(copyId);
    commands.moveToBack(copyId);
    commands.setLocked(id, true);
    commands.setHidden(id, true);

    expect(port.snapshot()).toMatchObject({
      selectedId: id,
      moves: ["front", "forward", "backward", "back"],
      objects: expect.arrayContaining([
        expect.objectContaining({
          id,
          x: 140,
          y: 90,
          scaleX: 1.5,
          scaleY: 0.75,
          angle: 18,
          flipX: true,
          locked: true,
          visible: false
        }),
        expect.objectContaining({ id: copyId })
      ])
    });

    commands.remove(copyId);
    expect(port.has(copyId)).toBe(false);
  });

  it("round-trips serialized state through the port", async () => {
    const source = new MemoryCanvasPort();
    const sourceCommands = new ObjectCommandService(source, idFactory("text-1"));
    await sourceCommands.addText("Try something new");
    const saved = sourceCommands.serialize();
    const restored = new MemoryCanvasPort();

    await new ObjectCommandService(restored).load(saved);

    expect(restored.has("text-1")).toBe(true);
  });

  it("adds, selects and recolours a semantic product shell", async () => {
    const port = new MemoryCanvasPort();
    const commands = new ObjectCommandService(port, idFactory("shell-1"));

    const id = await commands.addProductShell({
      shellId: "drinks-classic-can",
      svg: "<svg></svg>",
      accessibleName: "Classic Soft Drink Can"
    });
    commands.setProductShellRegion(id, "accent", "#157A6E");

    expect(port.selectedId).toBe(id);
    expect(port.objects).toContainEqual(expect.objectContaining({
      id,
      kind: "product-shell",
      shellId: "drinks-classic-can",
      accent: "#157A6E"
    }));
  });

  it("adds and selects one resolved product look", async () => {
    const port = new MemoryCanvasPort();
    const commands = new ObjectCommandService(port, idFactory("look-1"));
    const variant = Object.freeze({
      id: "product-builder-variant@1:product-builder-pilot-v1:drinkware-classic-can:drinkware-top-ring:cobalt-citrus:fabric",
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-ring",
      paletteId: "cobalt-citrus",
      materialId: "fabric"
    }) as NewProductVariantInput["variant"];

    const id = await commands.addProductVariant({
      accessibleName: "Cobalt Citrus Classic Can",
      variant,
      authoringSvg: "<svg></svg>",
      componentSvg: "<svg></svg>",
      artwork: { id: "front-art", colour: "#F2385A" }
    });

    expect(id).toBe("look-1");
    expect(port.selectedId).toBe(id);
    expect(port.objects).toContainEqual(expect.objectContaining({
      id,
      kind: "product-builder-variant",
      variant,
      artwork: { id: "front-art", colour: "#F2385A" }
    }));
  });

  it("routes artwork commands to one named product surface and keeps the product selected", async () => {
    const port = new MemoryCanvasPort();
    const commands = new ObjectCommandService(
      port,
      idFactory("art-text-1", "art-shape-1", "art-image-1")
    );
    const target = { productId: "product-1", slotId: "primary" };

    const textId = await commands.addArtworkText(target, "Fizz first", "Front headline");
    const shapeId = await commands.addArtworkShape(target, {
      kind: "ellipse",
      fill: "#F2385A",
      accessibleName: "Front burst"
    });
    const imageId = await commands.addArtworkRaster(target, {
      assetId: "fruit-1",
      sameOriginUrl: `${window.location.origin}/catalog/fruit.png`,
      accessibleName: "Sliced citrus"
    });
    commands.setArtworkText(target, textId, "Fizz together");

    expect([textId, shapeId, imageId]).toEqual([
      "art-text-1",
      "art-shape-1",
      "art-image-1"
    ]);
    expect(port.selectedId).toBe("product-1");
    expect(port.artworkCalls).toEqual([
      expect.objectContaining({ type: "text:add", target, id: "art-text-1" }),
      expect.objectContaining({ type: "shape:add", target, id: "art-shape-1" }),
      expect.objectContaining({ type: "raster:add", target, id: "art-image-1" }),
      expect.objectContaining({
        type: "text:set",
        target,
        id: "art-text-1",
        value: "Fizz together"
      })
    ]);
  });

  it("routes one artwork removal and reselects its product", () => {
    const port = new MemoryCanvasPort();
    const commands = new ObjectCommandService(port);
    const target = { productId: "product-1", slotId: "primary" };
    port.selectedId = "previous-selection";

    commands.removeArtwork(target, "art-text-1");

    expect(port.artworkCalls).toEqual([{
      type: "remove",
      target,
      id: "art-text-1"
    }]);
    expect(port.selectedId).toBe("product-1");
  });

  it("reselects the product only after artwork removal succeeds", () => {
    class FailingArtworkRemovalPort extends MemoryCanvasPort {
      attempts = 0;
      override removeArtwork(): void {
        this.attempts += 1;
        throw new Error("Synthetic artwork removal failure");
      }
    }
    const port = new FailingArtworkRemovalPort();
    const commands = new ObjectCommandService(port);
    port.selectedId = "previous-selection";

    expect(() => commands.removeArtwork(
      { productId: "product-1", slotId: "primary" },
      "art-text-1"
    )).toThrow("Synthetic artwork removal failure");

    expect(port.attempts).toBe(1);
    expect(port.selectedId).toBe("previous-selection");
  });

  it("rejects empty artwork removal identifiers before delegating", () => {
    const port = new MemoryCanvasPort();
    const commands = new ObjectCommandService(port);
    port.selectedId = "previous-selection";

    expect(() => commands.removeArtwork(
      { productId: " ", slotId: "primary" },
      "art-text-1"
    )).toThrow("product id must not be empty");
    expect(() => commands.removeArtwork(
      { productId: "product-1", slotId: " " },
      "art-text-1"
    )).toThrow("artwork slot must not be empty");
    expect(() => commands.removeArtwork(
      { productId: "product-1", slotId: "primary" },
      " "
    )).toThrow("artwork object id must not be empty");

    expect(port.artworkCalls).toEqual([]);
    expect(port.selectedId).toBe("previous-selection");
  });

  it("rejects invalid transform numbers before they reach the port", async () => {
    const port = new MemoryCanvasPort();
    const commands = new ObjectCommandService(port, idFactory("shape-1"));
    const id = await commands.addShape({ kind: "rect", fill: "#000000" });

    expect(() => commands.transform(id, { x: Number.NaN })).toThrow("finite");
    expect(() => commands.transform(id, { scaleX: 0 })).toThrow("greater than zero");
  });
});
