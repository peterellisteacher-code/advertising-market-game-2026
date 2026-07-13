import { describe, expect, it } from "vitest";
import type {
  CanvasPoint,
  CanvasSize,
  CanvasMutationListener,
  CanvasPort,
  CropState,
  DrawingToolSettings,
  NewProductShellInput,
  NewRasterInput,
  NewShapeInput,
  NewTextInput,
  ObjectTransform,
  StackDirection
} from "./canvas-port";
import { ObjectCommandService } from "./object-command-service";

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
  selectedId: string | null = null;
  drawingTool: DrawingToolSettings = { mode: "select" };

  async addText(input: NewTextInput): Promise<void> { this.#add(input.id, "text", input); }
  async addShape(input: NewShapeInput): Promise<void> { this.#add(input.id, input.kind, input); }
  async addRaster(input: NewRasterInput): Promise<void> { this.#add(input.id, "image", input); }
  async addProductShell(input: NewProductShellInput): Promise<void> {
    this.#add(input.id, "product-shell", input);
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
    extra: NewTextInput | NewShapeInput | NewRasterInput | NewProductShellInput
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

describe("ObjectCommandService", () => {
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

  it("rejects invalid transform numbers before they reach the port", async () => {
    const port = new MemoryCanvasPort();
    const commands = new ObjectCommandService(port, idFactory("shape-1"));
    const id = await commands.addShape({ kind: "rect", fill: "#000000" });

    expect(() => commands.transform(id, { x: Number.NaN })).toThrow("finite");
    expect(() => commands.transform(id, { scaleX: 0 })).toThrow("greater than zero");
  });
});
