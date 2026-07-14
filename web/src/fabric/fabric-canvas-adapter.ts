import {
  Canvas,
  Color,
  FabricImage,
  FabricObject,
  Group,
  Path,
  PencilBrush,
  Point,
  Textbox,
  util
} from "fabric";
import type {
  ArtworkSurfaceAddress,
  CanvasPoint,
  CanvasMutation,
  CanvasMutationListener,
  CanvasPort,
  CanvasSize,
  CropState,
  DrawingToolSettings,
  NewProductVariantInput,
  NewProductShellInput,
  NewRasterInput,
  NewShapeInput,
  NewTextInput,
  ObjectTransform,
  StackDirection
} from "./canvas-port";
import {
  calculateTextFitScale,
  FABRIC_CONTROL_SIZE,
  FabricObjectFactory,
  sameOriginRasterUrl
} from "./object-factory";
import {
  FabricProductShellFactory,
  productArtworkSurface,
  productShellRegionColours,
  recolourProductShellRegion
} from "./product-shell-factory";
import "./fabric-custom-properties";

const SERIALIZED_INTERACTION_PROPERTIES = [
  "cornerSize",
  "touchCornerSize",
  "transparentCorners",
  "borderScaleFactor",
  "selectable",
  "evented",
  "visible",
  "lockMovementX",
  "lockMovementY",
  "lockScalingX",
  "lockScalingY",
  "lockRotation",
  "cropFocalX",
  "cropFocalY"
];
const REMOVABLE_ARTWORK_KINDS = new Set([
  "text",
  "shape",
  "image",
  "drawing",
  "masked-component"
]);

type IdFactory = () => string;
const defaultIdFactory: IdFactory = () => globalThis.crypto.randomUUID();

function validateSerializedImageSources(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => validateSerializedImageSources(item, seen));
    return;
  }
  Object.entries(value).forEach(([key, child]) => {
    if (key === "src" && typeof child === "string") sameOriginRasterUrl(child);
    else validateSerializedImageSources(child, seen);
  });
}

export class FabricCanvasAdapter implements CanvasPort {
  readonly #listeners = new Set<CanvasMutationListener>();
  readonly #disposeEvents: Array<() => void>;
  readonly #pencilBrush: PencilBrush;
  readonly #textAtEditingStart = new WeakMap<FabricObject, string>();
  #suppressEvents = false;
  #drawingTool: DrawingToolSettings = { mode: "select" };

  constructor(
    private readonly canvas: Canvas,
    private readonly factory = new FabricObjectFactory(),
    private readonly shellFactory = new FabricProductShellFactory(),
    private readonly createId: IdFactory = defaultIdFactory
  ) {
    this.#pencilBrush = new PencilBrush(this.canvas);
    this.canvas.freeDrawingBrush = this.#pencilBrush;
    this.#disposeEvents = [
      this.canvas.on("object:added", ({ target }) => this.#emit("added", target)),
      this.canvas.on("object:modified", ({ target }) => this.#emit("modified", target)),
      this.canvas.on("object:removed", ({ target }) => this.#emit("removed", target)),
      this.canvas.on("text:editing:entered", ({ target }) => {
        if (target instanceof Textbox && target.elementKind === "text") {
          this.#textAtEditingStart.set(target, target.text);
        }
      }),
      this.canvas.on("text:editing:exited", ({ target }) => {
        const before = this.#textAtEditingStart.get(target);
        this.#textAtEditingStart.delete(target);
        if (before !== undefined && before !== target.text) this.#emit("modified", target);
      }),
      this.canvas.on("before:path:created", ({ path }) => this.#tagDrawingPath(path)),
      this.canvas.on("mouse:down", ({ e }) => {
        if (this.#drawingTool.mode !== "eraser") return;
        const point = this.canvas.getScenePoint(e);
        this.eraseTopmostDrawing(point, this.#drawingTool.radius);
      })
    ];
  }

  async addText(input: NewTextInput): Promise<void> { this.#add(this.factory.createText(input)); }
  async addShape(input: NewShapeInput): Promise<void> { this.#add(this.factory.createShape(input)); }
  async addRaster(input: NewRasterInput): Promise<void> { this.#add(await this.factory.createRaster(input)); }
  async addArtworkText(address: ArtworkSurfaceAddress, input: NewTextInput): Promise<void> {
    this.#addArtwork(address, this.factory.createText(input));
  }
  async addArtworkShape(address: ArtworkSurfaceAddress, input: NewShapeInput): Promise<void> {
    this.#addArtwork(address, this.factory.createShape(input));
  }
  async addArtworkRaster(address: ArtworkSurfaceAddress, input: NewRasterInput): Promise<void> {
    this.#addArtwork(address, await this.factory.createRaster(input));
  }
  async addProductShell(input: NewProductShellInput): Promise<void> {
    this.#add(await this.shellFactory.create(input));
  }
  async addProductVariant(input: NewProductVariantInput): Promise<void> {
    const product = await this.shellFactory.createVariant({ ...input, mode: "editor" });
    this.#add(product);
  }

  setProductShellRegion(id: string, region: string, colour: string): void {
    const object = this.#get(id);
    recolourProductShellRegion(object, region, colour);
    this.canvas.requestRenderAll();
    this.#emit("modified", object);
  }

  getProductShellRegionColours(id: string): Readonly<Record<string, string>> {
    return productShellRegionColours(this.#get(id));
  }

  setArtworkText(address: ArtworkSurfaceAddress, id: string, value: string): void {
    if (!value.trim()) throw new Error("Text must not be empty");
    const { product, surface } = this.#artworkContext(address);
    const object = surface.getObjects().find((candidate) => candidate.objectId === id);
    if (!(object instanceof Textbox) || object.elementKind !== "text") {
      throw new Error(`${id} is not editable artwork text`);
    }
    if (object.text === value) return;
    object.set("text", value);
    this.#fitArtworkObject(surface, object);
    this.#finishArtworkMutation(product, surface);
  }

  removeArtwork(address: ArtworkSurfaceAddress, childId: string): void {
    if (!childId.trim()) throw new Error("Artwork object id must not be empty");
    const { product, surface } = this.#artworkContext(address);
    const matches = surface.getObjects().filter((candidate) => candidate.objectId === childId);
    const object = matches.length === 1 ? matches[0] : undefined;
    if (!object || !REMOVABLE_ARTWORK_KINDS.has(object.elementKind ?? "") ||
      !object.accessibleName?.trim()) {
      throw new Error(`${childId} is not removable artwork`);
    }
    surface.remove(object);
    this.#finishArtworkMutation(product, surface);
  }

  setText(id: string, value: string): void {
    if (!value.trim()) throw new Error("Text must not be empty");
    const object = this.#get(id);
    if (!(object instanceof Textbox) || object.elementKind !== "text") {
      throw new Error(`${id} is not editable text`);
    }
    if (object.text === value) return;
    object.set("text", value);
    object.initDimensions();
    object.setCoords();
    this.canvas.requestRenderAll();
    this.#emit("modified", object);
  }

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

  getCropSourceSize(id: string): CanvasSize {
    const image = this.#getRaster(id);
    const { width, height } = image.getOriginalSize();
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error(`Raster ${id} has invalid source dimensions`);
    }
    return { width: Number(width), height: Number(height) };
  }

  setCrop(id: string, crop: CropState): void {
    const image = this.#getRaster(id);
    const source = this.getCropSourceSize(id);
    const values = Object.values(crop);
    if (values.some((value) => !Number.isFinite(value))) throw new Error("Crop values must be finite");
    if (crop.visibleWidth <= 0 || crop.visibleHeight <= 0 ||
      crop.cropX < 0 || crop.cropY < 0 ||
      crop.cropX + crop.visibleWidth > source.width ||
      crop.cropY + crop.visibleHeight > source.height ||
      crop.focalX < 0 || crop.focalX > 1 || crop.focalY < 0 || crop.focalY > 1) {
      throw new Error("Crop must remain inside its source bounds");
    }
    if (image.cropX === crop.cropX && image.cropY === crop.cropY &&
      image.width === crop.visibleWidth && image.height === crop.visibleHeight &&
      image.cropFocalX === crop.focalX && image.cropFocalY === crop.focalY) return;
    image.set({
      cropX: crop.cropX,
      cropY: crop.cropY,
      width: crop.visibleWidth,
      height: crop.visibleHeight,
      cropFocalX: crop.focalX,
      cropFocalY: crop.focalY
    });
    image.setCoords();
    this.canvas.requestRenderAll();
    this.#emit("modified", image);
  }

  setDrawingTool(settings: DrawingToolSettings): void {
    if (settings.mode === "select") {
      this.#drawingTool = settings;
      this.canvas.isDrawingMode = false;
      return;
    }
    if (settings.mode === "eraser") {
      if (!Number.isFinite(settings.radius) || settings.radius <= 0) {
        throw new Error("Eraser radius must be a positive finite number");
      }
      this.#drawingTool = { ...settings };
      this.canvas.isDrawingMode = false;
      return;
    }
    if (!settings.color.trim()) throw new Error("Drawing colour must not be empty");
    if (!Number.isFinite(settings.width) || settings.width <= 0) {
      throw new Error("Drawing width must be a positive finite number");
    }
    if (!Number.isFinite(settings.opacity) || settings.opacity < 0 || settings.opacity > 1) {
      throw new Error("Drawing opacity must be between zero and one");
    }
    const color = new Color(settings.color);
    if (color.isUnrecognised) throw new Error("Drawing colour is invalid");
    this.#pencilBrush.color = color.setAlpha(settings.opacity).toRgba();
    this.#pencilBrush.width = settings.width;
    this.#drawingTool = { ...settings };
    this.canvas.isDrawingMode = true;
  }

  eraseTopmostDrawing(point: CanvasPoint, radius: number): boolean {
    if (![point.x, point.y, radius].every(Number.isFinite) || radius <= 0) {
      throw new Error("Eraser geometry must be finite with a positive radius");
    }
    const zoom = this.canvas.getZoom();
    if (!Number.isFinite(zoom) || zoom <= 0) throw new Error("Canvas zoom must be positive and finite");
    const sceneRadius = radius / zoom;
    const objects = this.canvas.getObjects();
    for (let index = objects.length - 1; index >= 0; index -= 1) {
      const object = objects[index];
      if (!(object instanceof Path) || object.elementKind !== "drawing" || !object.visible) continue;
      const bounds = object.getBoundingRect();
      const nearestX = Math.max(bounds.left, Math.min(point.x, bounds.left + bounds.width));
      const nearestY = Math.max(bounds.top, Math.min(point.y, bounds.top + bounds.height));
      if (Math.hypot(point.x - nearestX, point.y - nearestY) > sceneRadius) continue;
      if (!this.#pathIntersectsRadius(object, point, sceneRadius)) continue;
      this.canvas.remove(object);
      this.canvas.requestRenderAll();
      return true;
    }
    return false;
  }

  serialize(): Record<string, unknown> {
    return this.canvas.toObject(SERIALIZED_INTERACTION_PROPERTIES) as Record<string, unknown>;
  }

  exportCleanPngDataUrl(): string {
    const activeObject = this.canvas.getActiveObject();
    const guideStates: Array<{
      object: FabricObject;
      topLevelIndex: number | null;
      visible: boolean;
    }> = [];
    const collect = (object: FabricObject, topLevelIndex: number | null): void => {
      if (object.editorGuide === true) {
        guideStates.push({ object, topLevelIndex, visible: object.visible });
      }
      if (object instanceof Group) {
        object.getObjects().forEach((child) => collect(child, null));
      }
    };
    this.canvas.getObjects().forEach((object, index) => collect(object, index));
    try {
      this.canvas.discardActiveObject();
      guideStates.forEach(({ object }) => object.set("visible", false));
      this.canvas.requestRenderAll();
      return this.canvas.toDataURL({ format: "png", multiplier: 1 });
    } finally {
      try {
        guideStates.forEach(({ object, topLevelIndex, visible }) => {
          object.set("visible", visible);
          if (topLevelIndex !== null) this.canvas.moveObjectTo(object, topLevelIndex);
        });
      } finally {
        if (activeObject) this.canvas.setActiveObject(activeObject);
        else this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
      }
    }
  }

  async load(value: Record<string, unknown>): Promise<void> {
    validateSerializedImageSources(value);
    this.#suppressEvents = true;
    try {
      await this.canvas.loadFromJSON(value);
      this.canvas.getObjects().forEach((object) => {
        object.set({
          cornerSize: FABRIC_CONTROL_SIZE,
          touchCornerSize: FABRIC_CONTROL_SIZE,
          transparentCorners: false,
          borderScaleFactor: 2
        });
        object.setCoords();
      });
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

  #getRaster(id: string): FabricImage {
    const object = this.#get(id);
    if (!(object instanceof FabricImage) || object.elementKind !== "image") {
      throw new Error(`${id} is not a raster image`);
    }
    return object;
  }

  #artworkContext(address: ArtworkSurfaceAddress): {
    product: FabricObject;
    surface: Group;
  } {
    if (!address.productId.trim() || !address.slotId.trim()) {
      throw new Error("Artwork surface address must not be empty");
    }
    const product = this.#get(address.productId);
    return {
      product,
      surface: productArtworkSurface(product, address.slotId)
    };
  }

  #addArtwork(address: ArtworkSurfaceAddress, object: FabricObject): void {
    const { product, surface } = this.#artworkContext(address);
    this.#assertArtworkSurfaceGeometry(surface);
    object.setPositionByOrigin(surface.getCenterPoint(), "center", "center");
    object.setCoords();
    surface.add(object);
    object.set({ left: 0, top: 0, originX: "center", originY: "center" });
    this.#fitArtworkObject(surface, object);
    this.#finishArtworkMutation(product, surface);
  }

  #assertArtworkSurfaceGeometry(surface: Group): void {
    if (![surface.width, surface.height].every(Number.isFinite) ||
      surface.width <= 0 || surface.height <= 0) {
      throw new Error("Artwork surface geometry is invalid");
    }
  }

  #fitArtworkObject(surface: Group, object: FabricObject): void {
    this.#assertArtworkSurfaceGeometry(surface);
    if (object instanceof Textbox) {
      const scale = calculateTextFitScale(
        object.getScaledWidth() / Math.max(Number.EPSILON, Math.abs(object.scaleX)),
        object.getScaledHeight() / Math.max(Number.EPSILON, Math.abs(object.scaleY)),
        surface.width * 0.82,
        surface.height * 0.82
      );
      object.set({ scaleX: scale, scaleY: scale });
    } else {
      const width = Math.max(1, object.getScaledWidth());
      const height = Math.max(1, object.getScaledHeight());
      const factor = Math.min(
        1,
        (surface.width * 0.82) / width,
        (surface.height * 0.82) / height
      );
      if (factor < 1) {
        object.set({
          scaleX: object.scaleX * factor,
          scaleY: object.scaleY * factor
        });
      }
    }
    object.dirty = true;
    object.setCoords();
  }

  #finishArtworkMutation(product: FabricObject, surface: Group): void {
    surface.dirty = true;
    product.dirty = true;
    surface.setCoords();
    product.setCoords();
    this.canvas.requestRenderAll();
    this.#emit("modified", product);
  }

  #tagDrawingPath(path: FabricObject): void {
    if (this.#drawingTool.mode !== "pencil" && this.#drawingTool.mode !== "marker") return;
    const label = this.#drawingTool.mode === "pencil" ? "Pencil drawing" : "Marker drawing";
    path.set({
      objectId: this.createId(),
      elementKind: "drawing",
      accessibleName: label,
      cornerSize: FABRIC_CONTROL_SIZE,
      touchCornerSize: FABRIC_CONTROL_SIZE,
      transparentCorners: false,
      borderScaleFactor: 2
    });
    path.setCoords();
  }

  #pathIntersectsRadius(path: Path, point: CanvasPoint, radius: number): boolean {
    const transformed = util.transformPath(path.path, path.calcTransformMatrix(), path.pathOffset);
    const segments = util.getPathSegmentsInfo(transformed);
    const totalLength = segments.at(-1)?.length ?? 0;
    const scaling = path.getObjectScaling();
    const strokeScale = path.strokeUniform ? 1 : Math.max(Math.abs(scaling.x), Math.abs(scaling.y));
    const tolerance = radius + (path.strokeWidth * strokeScale) / 2;
    if (totalLength === 0) {
      const first = transformed[0];
      return first?.[0] === "M" && Math.hypot(point.x - first[1], point.y - first[2]) <= tolerance;
    }
    const sampleCount = Math.max(
      2,
      Math.min(4096, Math.ceil(totalLength / Math.max(1, tolerance / 2)))
    );
    for (let index = 0; index <= sampleCount; index += 1) {
      const sample = util.getPointOnPath(transformed, (totalLength * index) / sampleCount, segments);
      if (sample && Math.hypot(point.x - sample.x, point.y - sample.y) <= tolerance) return true;
    }
    return false;
  }

  #emit(type: CanvasMutation["type"], object: FabricObject): void {
    if (this.#suppressEvents || !object.objectId) return;
    const mutation: CanvasMutation = { type, objectId: object.objectId };
    this.#listeners.forEach((listener) => listener(mutation));
  }
}
