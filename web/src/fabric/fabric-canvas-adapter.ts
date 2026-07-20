import {
  ActiveSelection,
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
  CanvasSelectionSnapshot,
  CanvasSize,
  CropState,
  DrawingToolSettings,
  LogoMarkSnapshot,
  LogoMarkSource,
  NewLogoMarkInput,
  NewProductKitInput,
  NewProductVariantInput,
  NewProductShellInput,
  NewRasterInput,
  NewShapeInput,
  NewTextInput,
  ObjectTransform,
  StackDirection
} from "./canvas-port";
import { createLogoMarkDesign, type LogoMarkDesign } from "../logo-lab/logo-mark-model";
import {
  calculateTextFitScale,
  FABRIC_SELECTION_STYLE,
  FabricObjectFactory,
  portableRasterUrlForLoad,
  portableRasterUrlForStorage
} from "./object-factory";
import {
  FabricProductShellFactory,
  productArtworkSurface,
  productShellRegionColours,
  recolourProductShellRegion
} from "./product-shell-factory";
import { FabricLogoMarkFactory } from "./logo-mark-factory";
import { FabricProductKitCompositor } from "../product-kit/fabric-product-kit-compositor";
import "./fabric-custom-properties";

const SERIALIZED_INTERACTION_PROPERTIES = [
  "cornerSize",
  "touchCornerSize",
  "transparentCorners",
  "borderScaleFactor",
  "borderColor",
  "cornerColor",
  "cornerStrokeColor",
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
const OMITTED_JSON_PROPERTY = Symbol("omitted-json-property");

type IdFactory = () => string;
const defaultIdFactory: IdFactory = () => globalThis.crypto.randomUUID();

function transformSerializedImageSources(
  value: unknown,
  transform: (source: string) => string,
  seen = new WeakSet<object>()
): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => transformSerializedImageSources(item, transform, seen));
    return;
  }
  Object.entries(value).forEach(([key, child]) => {
    if (key === "src" && typeof child === "string") {
      Reflect.set(value, key, transform(child));
    } else {
      transformSerializedImageSources(child, transform, seen);
    }
  });
}

function durableJsonValue(
  value: unknown,
  path = "$",
  ancestors = new Set<object>()
): unknown | typeof OMITTED_JSON_PROPERTY {
  if (value === undefined) return OMITTED_JSON_PROPERTY;
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} must contain a finite number`);
    return value;
  }
  if (typeof value !== "object") throw new Error(`${path} contains a non-JSON value`);
  if (ancestors.has(value)) throw new Error(`${path} contains a circular reference`);

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((child, index) => {
        const clone = durableJsonValue(child, `${path}[${index}]`, ancestors);
        return clone === OMITTED_JSON_PROPERTY ? null : clone;
      });
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} contains a non-JSON object`);
    }
    const clone: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new Error(`${path} contains a symbol key`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new Error(`${path}.${key} is not a plain JSON property`);
      }
      const child = durableJsonValue(descriptor.value, `${path}.${key}`, ancestors);
      if (child !== OMITTED_JSON_PROPERTY) clone[key] = child;
    }
    return clone;
  } finally {
    ancestors.delete(value);
  }
}

function durableCanvasState(value: Record<string, unknown>): Record<string, unknown> {
  const clone = durableJsonValue(value);
  if (clone === OMITTED_JSON_PROPERTY || clone === null || Array.isArray(clone) ||
    typeof clone !== "object") {
    throw new Error("Canvas state must be a JSON object");
  }
  return clone as Record<string, unknown>;
}

export class FabricCanvasAdapter implements CanvasPort {
  readonly #listeners = new Set<CanvasMutationListener>();
  readonly #disposeEvents: Array<() => void>;
  readonly #pencilBrush: PencilBrush;
  readonly #logoFactory = new FabricLogoMarkFactory();
  readonly #textAtEditingStart = new WeakMap<FabricObject, string>();
  #suppressEvents = false;
  #drawingTool: DrawingToolSettings = { mode: "select" };

  constructor(
    private readonly canvas: Canvas,
    private readonly factory = new FabricObjectFactory(),
    private readonly shellFactory = new FabricProductShellFactory(),
    private readonly createId: IdFactory = defaultIdFactory,
    private readonly productKitCompositor = new FabricProductKitCompositor()
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
  async addLogoMark(input: NewLogoMarkInput): Promise<void> {
    const mark = await this.#logoFactory.create(input);
    this.#assertUniqueTreeIds(mark);
    this.#add(mark);
  }

  async replaceLogoMark(id: string, input: LogoMarkSource): Promise<void> {
    const original = this.#getLogoMark(id);
    const replacement = await this.#logoFactory.create({ id, ...input });
    this.#assertUniqueTreeIds(replacement, original);
    const index = this.canvas.getObjects().indexOf(original);
    if (index < 0) throw new Error(`Missing object ${id}`);
    const previousActive = this.canvas.getActiveObject();
    replacement.set({
      left: original.left,
      top: original.top,
      scaleX: original.scaleX,
      scaleY: original.scaleY,
      angle: original.angle,
      flipX: original.flipX,
      flipY: original.flipY,
      visible: original.visible,
      selectable: original.selectable,
      evented: original.evented,
      lockMovementX: original.lockMovementX,
      lockMovementY: original.lockMovementY,
      lockScalingX: original.lockScalingX,
      lockScalingY: original.lockScalingY,
      lockRotation: original.lockRotation
    });
    replacement.setCoords();

    const previousSuppression = this.#suppressEvents;
    this.#suppressEvents = true;
    try {
      this.canvas.remove(original);
      this.canvas.insertAt(index, replacement);
      this.canvas.setActiveObject(replacement);
      this.canvas.requestRenderAll();
    } catch (error) {
      if (this.canvas.getObjects().includes(replacement)) this.canvas.remove(replacement);
      if (!this.canvas.getObjects().includes(original)) {
        this.canvas.insertAt(Math.min(index, this.canvas.getObjects().length), original);
      }
      if (previousActive) this.canvas.setActiveObject(previousActive);
      else this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      throw error;
    } finally {
      this.#suppressEvents = previousSuppression;
    }
    this.#emit("modified", replacement);
  }

  listLogoMarks(): readonly LogoMarkSnapshot[] {
    const seen = new Set<string>();
    return Object.freeze(this.canvas.getObjects()
      .filter((object) => object.elementKind === "logo-mark")
      .map((object) => {
        const mark = this.#logoMark(object);
        if (seen.has(mark.objectId!)) throw new Error(`Duplicate Fabric object ID ${mark.objectId}`);
        seen.add(mark.objectId!);
        return Object.freeze({ id: mark.objectId!, design: this.#logoDesign(mark) });
      }));
  }
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
  async addProductKit(input: NewProductKitInput): Promise<void> {
    this.#add(await this.productKitCompositor.create(input));
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

  setText(id: string, value: string, accessibleName?: string, editable?: boolean): void {
    if (!value.trim()) throw new Error("Text must not be empty");
    if (accessibleName !== undefined && !accessibleName.trim()) {
      throw new Error("Accessible name must not be empty");
    }
    const object = this.#get(id);
    if (!(object instanceof Textbox) || object.elementKind !== "text") {
      throw new Error(`${id} is not editable text`);
    }
    if (object.text === value &&
      (accessibleName === undefined || object.accessibleName === accessibleName) &&
      (editable === undefined || object.editable === editable)) return;
    object.set({
      text: value,
      ...(accessibleName === undefined ? {} : { accessibleName }),
      ...(editable === undefined ? {} : { editable })
    });
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
    this.assertCanDuplicate(id);
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

  assertCanDuplicate(id: string): void {
    if (this.#get(id).elementKind === "product-kit") {
      throw new Error("Product Kit objects cannot be duplicated");
    }
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

  getSelectedObjectId(): string | null {
    const selected = this.canvas.getActiveObject();
    if (!selected) return null;
    const objectId = selected.objectId?.trim();
    if (!objectId) throw new Error("Selected canvas object has no restorable object ID");
    return objectId;
  }

  captureSelection(): CanvasSelectionSnapshot {
    const seen = new Set<string>();
    const objectIds = this.canvas.getActiveObjects().map((object) => {
      const objectId = object.objectId?.trim();
      if (!objectId || !object.elementKind || this.#get(objectId) !== object) {
        throw new Error("Selected canvas object is not a restorable semantic root");
      }
      if (seen.has(objectId)) throw new Error(`Duplicate selection object ID ${objectId}`);
      seen.add(objectId);
      return objectId;
    });
    return Object.freeze({ objectIds: Object.freeze(objectIds) });
  }

  restoreSelection(snapshot: CanvasSelectionSnapshot): void {
    if (snapshot === null || typeof snapshot !== "object" ||
      !Array.isArray(snapshot.objectIds)) {
      throw new Error("Canvas selection snapshot is invalid");
    }
    const seen = new Set<string>();
    const objects = snapshot.objectIds.map((value) => {
      if (typeof value !== "string" || !value.trim()) {
        throw new Error("Canvas selection object ID must not be empty");
      }
      if (seen.has(value)) throw new Error(`Duplicate selection object ID ${value}`);
      seen.add(value);
      const object = this.#get(value);
      if (!object.elementKind) throw new Error(`${value} is not a semantic canvas root`);
      return object;
    });

    this.canvas.discardActiveObject();
    if (objects.length === 1) {
      this.canvas.setActiveObject(objects[0]!);
    } else if (objects.length > 1) {
      this.canvas.setActiveObject(new ActiveSelection(objects, {
        canvas: this.canvas,
        multiSelectionStacking: "selection-order"
      }));
    }
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
    const state = durableCanvasState(
      this.canvas.toObject(SERIALIZED_INTERACTION_PROPERTIES) as Record<string, unknown>
    );
    transformSerializedImageSources(state, portableRasterUrlForStorage);
    return state;
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
    const state = durableCanvasState(value);
    transformSerializedImageSources(state, portableRasterUrlForLoad);
    this.#suppressEvents = true;
    try {
      await this.canvas.loadFromJSON(state);
      this.canvas.getObjects().forEach((object) => {
        object.set(FABRIC_SELECTION_STYLE);
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
    const matches = this.canvas.getObjects().filter((candidate) => candidate.objectId === id);
    if (matches.length === 0) throw new Error(`Missing object ${id}`);
    if (matches.length > 1) throw new Error(`Duplicate Fabric object ID ${id}`);
    return matches[0]!;
  }

  #getRaster(id: string): FabricImage {
    const object = this.#get(id);
    if (!(object instanceof FabricImage) || object.elementKind !== "image") {
      throw new Error(`${id} is not a raster image`);
    }
    return object;
  }

  #getLogoMark(id: string): Group {
    return this.#logoMark(this.#get(id));
  }

  #logoMark(object: FabricObject): Group {
    if (!(object instanceof Group) || object.elementKind !== "logo-mark" || !object.objectId?.trim()) {
      throw new Error(`${object.objectId ?? "Object"} is not an editable logo mark`);
    }
    return object;
  }

  #logoDesign(object: Group): LogoMarkDesign {
    return createLogoMarkDesign({
      recipe: object.logoRecipe as LogoMarkDesign["recipe"],
      text: object.logoText as string,
      iconId: object.logoIconId as string,
      primary: object.logoPrimary as string,
      secondary: object.logoSecondary as string,
      typeface: object.logoTypeface as LogoMarkDesign["typeface"],
      seed: object.logoSeed as number,
      revision: object.logoRevision as number
    });
  }

  #assertUniqueTreeIds(candidate: FabricObject, excludedRoot?: FabricObject): void {
    const candidateIds = new Set<string>();
    for (const object of this.#objectTree(candidate)) {
      const id = object.objectId?.trim();
      if (!id) continue;
      if (candidateIds.has(id)) throw new Error(`Duplicate Fabric object ID ${id}`);
      candidateIds.add(id);
    }
    const existingIds = new Set<string>();
    for (const root of this.canvas.getObjects()) {
      if (root === excludedRoot) continue;
      for (const object of this.#objectTree(root)) {
        const id = object.objectId?.trim();
        if (id) existingIds.add(id);
      }
    }
    for (const id of candidateIds) {
      if (existingIds.has(id)) throw new Error(`Duplicate Fabric object ID ${id}`);
    }
  }

  #objectTree(root: FabricObject): FabricObject[] {
    const objects: FabricObject[] = [root];
    if (root instanceof Group) {
      root.getObjects().forEach((child) => objects.push(...this.#objectTree(child)));
    }
    return objects;
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
      ...FABRIC_SELECTION_STYLE
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
