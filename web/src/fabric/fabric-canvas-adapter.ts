import { Canvas, FabricObject } from "fabric";
import type {
  CanvasMutation,
  CanvasMutationListener,
  CanvasPort,
  NewRasterInput,
  NewShapeInput,
  NewTextInput,
  ObjectTransform,
  StackDirection
} from "./canvas-port";
import { FabricObjectFactory } from "./object-factory";
import "./fabric-custom-properties";

export class FabricCanvasAdapter implements CanvasPort {
  readonly #listeners = new Set<CanvasMutationListener>();
  readonly #disposeEvents: Array<() => void>;
  #suppressEvents = false;

  constructor(
    private readonly canvas: Canvas,
    private readonly factory = new FabricObjectFactory()
  ) {
    this.#disposeEvents = [
      this.canvas.on("object:added", ({ target }) => this.#emit("added", target)),
      this.canvas.on("object:modified", ({ target }) => this.#emit("modified", target)),
      this.canvas.on("object:removed", ({ target }) => this.#emit("removed", target))
    ];
  }

  async addText(input: NewTextInput): Promise<void> { this.#add(this.factory.createText(input)); }
  async addShape(input: NewShapeInput): Promise<void> { this.#add(this.factory.createShape(input)); }
  async addRaster(input: NewRasterInput): Promise<void> { this.#add(await this.factory.createRaster(input)); }

  transform(id: string, patch: Partial<ObjectTransform>): void {
    const object = this.#get(id);
    if (patch.x !== undefined) object.set("left", patch.x);
    if (patch.y !== undefined) object.set("top", patch.y);
    if (patch.scaleX !== undefined) object.set("scaleX", patch.scaleX);
    if (patch.scaleY !== undefined) object.set("scaleY", patch.scaleY);
    if (patch.angle !== undefined) object.set("angle", patch.angle);
    if (patch.flipX !== undefined) object.set("flipX", patch.flipX);
    if (patch.flipY !== undefined) object.set("flipY", patch.flipY);
    object.setCoords();
    this.canvas.requestRenderAll();
    this.#emit("modified", object);
  }

  async duplicate(id: string, newId: string): Promise<void> {
    const source = this.#get(id);
    const copy = await source.clone();
    copy.set({
      objectId: newId,
      accessibleName: `${source.accessibleName ?? "Object"} copy`,
      left: (source.left ?? 0) + 24,
      top: (source.top ?? 0) + 24
    });
    copy.setCoords();
    this.#add(copy);
  }

  remove(id: string): void {
    this.canvas.remove(this.#get(id));
    this.canvas.requestRenderAll();
  }

  move(id: string, direction: StackDirection): void {
    const object = this.#get(id);
    switch (direction) {
      case "front": this.canvas.bringObjectToFront(object); break;
      case "forward": this.canvas.bringObjectForward(object); break;
      case "backward": this.canvas.sendObjectBackwards(object); break;
      case "back": this.canvas.sendObjectToBack(object); break;
    }
    this.canvas.requestRenderAll();
    this.#emit("modified", object);
  }

  setLocked(id: string, locked: boolean): void {
    const object = this.#get(id);
    object.set({
      selectable: !locked,
      evented: !locked,
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked
    });
    if (locked && this.canvas.getActiveObject() === object) this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.#emit("modified", object);
  }

  setVisible(id: string, visible: boolean): void {
    const object = this.#get(id);
    object.set("visible", visible);
    if (!visible && this.canvas.getActiveObject() === object) this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.#emit("modified", object);
  }

  setSelected(id: string | null): void {
    if (id === null) this.canvas.discardActiveObject();
    else this.canvas.setActiveObject(this.#get(id));
    this.canvas.requestRenderAll();
  }

  serialize(): Record<string, unknown> {
    return this.canvas.toObject() as Record<string, unknown>;
  }

  async load(value: Record<string, unknown>): Promise<void> {
    this.#suppressEvents = true;
    try {
      await this.canvas.loadFromJSON(value);
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    } finally {
      this.#suppressEvents = false;
    }
  }

  subscribe(listener: CanvasMutationListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    this.#disposeEvents.forEach((dispose) => dispose());
    this.#listeners.clear();
  }

  #add(object: FabricObject): void {
    this.canvas.add(object);
    this.canvas.requestRenderAll();
  }

  #get(id: string): FabricObject {
    const object = this.canvas.getObjects().find((candidate) => candidate.objectId === id);
    if (!object) throw new Error(`Missing object ${id}`);
    return object;
  }

  #emit(type: CanvasMutation["type"], object: FabricObject): void {
    if (this.#suppressEvents || !object.objectId) return;
    const mutation: CanvasMutation = { type, objectId: object.objectId };
    this.#listeners.forEach((listener) => listener(mutation));
  }
}
