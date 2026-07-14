import { Canvas, FabricObject, Group, Point, Rect, util } from "fabric";
import {
  loadProductBuilderCatalogue
} from "../../src/product-builder/product-builder-catalogue";
import {
  createVirtualProductVariantResolver
} from "../../src/product-builder/virtual-product-variant";
import {
  FabricProductShellFactory,
  productArtworkSurface
} from "../../src/fabric/product-shell-factory";

type CheckpointName =
  | "selection"
  | "move"
  | "scale"
  | "rotate"
  | "clip"
  | "parentInvariant"
  | "exit";

type CheckpointState = "pending" | "pass" | "fail";

interface DiagnosticPoint {
  readonly x: number;
  readonly y: number;
}

interface TransformSnapshot {
  readonly left: number;
  readonly top: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly skewX: number;
  readonly skewY: number;
  readonly angle: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
}

interface NestedEditDiagnostic {
  readonly status: "loading" | "ready" | "running" | "pass" | "fail";
  readonly stage: string;
  readonly checkpoints: Readonly<Record<CheckpointName, CheckpointState>>;
  readonly points?: {
    readonly artworkCenter: DiagnosticPoint;
    readonly scaleHandle: DiagnosticPoint;
    readonly rotateHandle: DiagnosticPoint;
    readonly productBody: DiagnosticPoint;
    readonly canvasOutside: DiagnosticPoint;
  };
  readonly parentBefore?: TransformSnapshot;
  readonly parentAfter?: TransformSnapshot;
  readonly childBefore?: TransformSnapshot;
  readonly childAfter?: TransformSnapshot;
  readonly selectedObjectId?: string;
  readonly exitTrigger?: "escape" | "outside";
  readonly clipProbe?: {
    readonly insideChangedSamples: number;
    readonly insideSamples: number;
    readonly outsideChangedSamples: number;
    readonly outsideSamples: number;
    readonly representativeInsideBefore: readonly [number, number, number, number];
    readonly representativeInsideAfter: readonly [number, number, number, number];
    readonly representativeOutsideBefore: readonly [number, number, number, number];
    readonly representativeOutsideAfter: readonly [number, number, number, number];
  };
  readonly error?: string;
}

declare global {
  interface Window {
    __NESTED_EDIT_DIAGNOSTIC__?: NestedEditDiagnostic;
  }
}

const CATALOGUE_URL = "/catalog/generated/product-builder-pilot-v1/catalogue.json";
const ARTWORK_ID = "diagnostic-artwork";
const PRODUCT_ID = "diagnostic-product";
const CLIP_PROBE_COLOUR = [255, 47, 117] as const;
const TRANSFORM_EPSILON = 0.001;

const status = document.querySelector<HTMLElement>("#status") ??
  (() => { throw new Error("Nested-edit diagnostic status is missing"); })();
const canvasElement = document.querySelector<HTMLCanvasElement>("#diagnostic-canvas") ??
  (() => { throw new Error("Nested-edit diagnostic canvas is missing"); })();
const checkpointElements = new Map<CheckpointName, HTMLElement>(
  Array.from(document.querySelectorAll<HTMLElement>("[data-check]"), (element) => [
    element.dataset.check as CheckpointName,
    element
  ])
);
if (checkpointElements.size !== 7) {
  throw new Error("Nested-edit diagnostic host is incomplete");
}

const checkpoints: Record<CheckpointName, CheckpointState> = {
  selection: "pending",
  move: "pending",
  scale: "pending",
  rotate: "pending",
  clip: "pending",
  parentInvariant: "pending",
  exit: "pending"
};

let stage = "loading";
let product: Group;
let surface: Group;
let artwork: Rect;
let clipProbe: Rect;
let parentBefore: TransformSnapshot;
let childBefore: TransformSnapshot;
let clipProbePixels: NestedEditDiagnostic["clipProbe"];
let exitTrigger: NestedEditDiagnostic["exitTrigger"];

const canvas = new Canvas(canvasElement, {
  width: 1600,
  height: 900,
  preserveObjectStacking: true,
  backgroundColor: "#f8f5ee",
  selection: false
});

function snapshot(object: FabricObject): TransformSnapshot {
  return {
    left: object.left,
    top: object.top,
    scaleX: object.scaleX,
    scaleY: object.scaleY,
    skewX: object.skewX,
    skewY: object.skewY,
    angle: object.angle,
    flipX: object.flipX,
    flipY: object.flipY
  };
}

function sameTransform(left: TransformSnapshot, right: TransformSnapshot): boolean {
  return left.flipX === right.flipX && left.flipY === right.flipY &&
    Math.abs(left.left - right.left) <= TRANSFORM_EPSILON &&
    Math.abs(left.top - right.top) <= TRANSFORM_EPSILON &&
    Math.abs(left.scaleX - right.scaleX) <= TRANSFORM_EPSILON &&
    Math.abs(left.scaleY - right.scaleY) <= TRANSFORM_EPSILON &&
    Math.abs(left.skewX - right.skewX) <= TRANSFORM_EPSILON &&
    Math.abs(left.skewY - right.skewY) <= TRANSFORM_EPSILON &&
    Math.abs(left.angle - right.angle) <= TRANSFORM_EPSILON;
}

function canvasClientPoint(point: Point): DiagnosticPoint {
  const bounds = canvas.upperCanvasEl.getBoundingClientRect();
  return {
    x: bounds.left + (point.x / canvas.getWidth()) * bounds.width,
    y: bounds.top + (point.y / canvas.getHeight()) * bounds.height
  };
}

function diagnosticPoints(): NestedEditDiagnostic["points"] | undefined {
  if (!artwork || !product || !artwork.canvas) return undefined;
  artwork.setCoords();
  product.setCoords();
  const scale = artwork.oCoords.br;
  const rotate = artwork.oCoords.mtr;
  if (!scale || !rotate) return undefined;
  const productPoint = util.transformPoint(
    new Point(-product.width * 0.36, product.height * 0.34),
    product.calcTransformMatrix()
  );
  return {
    artworkCenter: canvasClientPoint(artwork.getCenterPoint()),
    scaleHandle: canvasClientPoint(new Point(scale.x, scale.y)),
    rotateHandle: canvasClientPoint(new Point(rotate.x, rotate.y)),
    productBody: canvasClientPoint(productPoint),
    canvasOutside: canvasClientPoint(new Point(80, 820))
  };
}

function allInteractionChecksPassed(): boolean {
  return checkpoints.selection === "pass" && checkpoints.move === "pass" &&
    checkpoints.scale === "pass" && checkpoints.rotate === "pass" &&
    checkpoints.clip === "pass" && checkpoints.parentInvariant === "pass";
}

function publish(
  nextStatus: NestedEditDiagnostic["status"],
  message: string,
  error?: string
): void {
  const points = diagnosticPoints();
  const activeObjectId = canvas.getActiveObject()?.objectId;
  status.textContent = message;
  status.dataset.status = nextStatus;
  status.dataset.stage = stage;
  status.dataset.clipProbe = clipProbePixels ? JSON.stringify(clipProbePixels) : "";
  status.dataset.points = points ? JSON.stringify(points) : "";
  status.dataset.checkpoints = JSON.stringify(checkpoints);
  status.dataset.selectedObjectId = activeObjectId ?? "";
  status.dataset.exitTrigger = exitTrigger ?? "";
  checkpointElements.forEach((element, name) => {
    const value = checkpoints[name];
    element.dataset.pass = String(value === "pass");
    element.dataset.fail = String(value === "fail");
  });
  window.__NESTED_EDIT_DIAGNOSTIC__ = {
    status: nextStatus,
    stage,
    checkpoints: Object.freeze({ ...checkpoints }),
    ...(points ? { points } : {}),
    ...(parentBefore ? { parentBefore, parentAfter: snapshot(product) } : {}),
    ...(childBefore ? { childBefore, childAfter: snapshot(artwork) } : {}),
    ...(activeObjectId ? { selectedObjectId: activeObjectId } : {}),
    ...(exitTrigger ? { exitTrigger } : {}),
    ...(clipProbePixels ? { clipProbe: clipProbePixels } : {}),
    ...(error ? { error } : {})
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "omit",
    redirect: "error",
    headers: { accept: "image/svg+xml,text/plain" }
  });
  if (!response.ok) throw new Error(`Could not load ${new URL(url).pathname}`);
  return response.text();
}

function sampleScenePixel(point: Point): readonly [number, number, number, number] {
  const retina = canvas.getRetinaScaling();
  const data = canvas.contextContainer.getImageData(
    Math.round(point.x * retina),
    Math.round(point.y * retina),
    1,
    1
  ).data;
  return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 0];
}

function pixelChanged(
  before: readonly [number, number, number, number],
  after: readonly [number, number, number, number]
): boolean {
  return before.reduce((difference, value, index) =>
    difference + Math.abs(value - after[index]!), 0
  ) >= 18;
}

async function renderProbe(visible: boolean): Promise<void> {
  clipProbe.set("visible", visible);
  clipProbe.dirty = true;
  surface.dirty = true;
  product.dirty = true;
  canvas.renderAll();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function verifyClip(): Promise<void> {
  const matrix = surface.calcTransformMatrix();
  const innerOffsets = [-0.34, -0.17, 0, 0.17, 0.34];
  const insidePoints = innerOffsets.flatMap((x) => innerOffsets.map((y) =>
    util.transformPoint(new Point(surface.width * x, surface.height * y), matrix)
  ));
  const edgeOffsets = [-0.34, -0.17, 0, 0.17, 0.34];
  const outsideLocalPoints = edgeOffsets.flatMap((offset) => [
    new Point(surface.width * -0.62, surface.height * offset),
    new Point(surface.width * 0.62, surface.height * offset),
    new Point(surface.width * offset, surface.height * -0.62),
    new Point(surface.width * offset, surface.height * 0.62)
  ]);
  const outsidePoints = outsideLocalPoints.map((point) => util.transformPoint(point, matrix));
  await renderProbe(false);
  const insideBefore = insidePoints.map(sampleScenePixel);
  const outsideBefore = outsidePoints.map(sampleScenePixel);
  await renderProbe(true);
  const insideAfter = insidePoints.map(sampleScenePixel);
  const outsideAfter = outsidePoints.map(sampleScenePixel);
  const insideChangedSamples = insideBefore.filter((pixel, index) =>
    pixelChanged(pixel, insideAfter[index]!)
  ).length;
  const outsideChangedSamples = outsideBefore.filter((pixel, index) =>
    pixelChanged(pixel, outsideAfter[index]!)
  ).length;
  clipProbePixels = {
    insideChangedSamples,
    insideSamples: insideBefore.length,
    outsideChangedSamples,
    outsideSamples: outsideBefore.length,
    representativeInsideBefore: insideBefore[0]!,
    representativeInsideAfter: insideAfter[0]!,
    representativeOutsideBefore: outsideBefore[0]!,
    representativeOutsideAfter: outsideAfter[0]!
  };
  checkpoints.clip = insideChangedSamples >= 5 && outsideChangedSamples === 0
    ? "pass"
    : "fail";
}

function verifyParentInvariant(): void {
  checkpoints.parentInvariant = sameTransform(parentBefore, snapshot(product))
    ? "pass"
    : "fail";
}

async function updateAfterInteraction(nextStage: string): Promise<void> {
  stage = nextStage;
  surface.dirty = true;
  product.dirty = true;
  surface.setCoords();
  product.setCoords();
  artwork.setCoords();
  canvas.requestRenderAll();
  verifyParentInvariant();
  await verifyClip();
  const failed = Object.values(checkpoints).includes("fail");
  publish(
    failed ? "fail" : "running",
    failed
      ? "The browser interaction exposed a nested-edit failure."
      : "Nested target is live. Move, resize, rotate, then press Escape."
  );
}

function enterEditMode(): void {
  product.set({
    selectable: false,
    evented: true,
    subTargetCheck: true,
    interactive: true
  });
  surface.set({
    selectable: false,
    evented: true,
    subTargetCheck: true,
    interactive: true
  });
  for (const child of surface.getObjects()) {
    const editable = child === artwork;
    child.set({ selectable: editable, evented: editable });
    child.setCoords();
  }
  product.setCoords();
  surface.setCoords();
  canvas.discardActiveObject();
  canvas.requestRenderAll();
}

async function exitEditMode(trigger: "escape" | "outside"): Promise<void> {
  if (stage === "exited") return;
  stage = "exited";
  exitTrigger = trigger;
  canvas.discardActiveObject();
  product.set({
    selectable: true,
    evented: true,
    subTargetCheck: false,
    interactive: false
  });
  surface.set({
    selectable: false,
    evented: false,
    subTargetCheck: false,
    interactive: false
  });
  artwork.set({ selectable: false, evented: false });
  product.setCoords();
  canvas.setActiveObject(product);
  canvas.requestRenderAll();
  verifyParentInvariant();
  await verifyClip();
  checkpoints.exit = canvas.getActiveObject() === product && allInteractionChecksPassed()
    ? "pass"
    : "fail";
  const passed = checkpoints.exit === "pass" &&
    Object.values(checkpoints).every((value) => value === "pass");
  publish(
    passed ? "pass" : "fail",
    passed
      ? "PASS — nested selection, transforms, clipping and clean exit survived the real browser."
      : "FAIL — edit mode did not complete every required browser interaction."
  );
}

async function run(): Promise<void> {
  publish("loading", "Loading the reviewed product shell…");
  const catalogue = await loadProductBuilderCatalogue(
    new URL(CATALOGUE_URL, window.location.href).href
  );
  if (!catalogue) throw new Error("Reviewed product-builder catalogue did not load");
  const variant = createVirtualProductVariantResolver(catalogue).resolveVariant({
    bodyId: "drinkware-classic-can",
    partId: "drinkware-top-ring",
    paletteId: "cobalt-citrus",
    materialId: "brushed-metal"
  });
  if (!variant) throw new Error("Diagnostic product variant did not resolve");

  product = await new FabricProductShellFactory().createVariant({
    id: PRODUCT_ID,
    accessibleName: "Rotated Cobalt Citrus can",
    variant,
    authoringSvg: await fetchText(variant.authoringUrl),
    componentSvg: await fetchText(variant.componentUrl),
    artwork: { id: "diagnostic-base-art", colour: "#2456C4" },
    mode: "editor"
  });
  canvas.add(product);
  surface = productArtworkSurface(product);

  clipProbe = new Rect({
    originX: "center",
    originY: "center",
    left: 0,
    top: 0,
    width: surface.width * 2,
    height: surface.height * 2,
    fill: `rgb(${CLIP_PROBE_COLOUR.join(" ")})`,
    selectable: false,
    evented: false,
    productLayer: "student-artwork"
  });
  surface.add(clipProbe);
  clipProbe.set({ left: 0, top: 0 });

  artwork = new Rect({
    objectId: ARTWORK_ID,
    elementKind: "shape",
    accessibleName: "Green diagnostic label",
    productLayer: "student-artwork",
    originX: "center",
    originY: "center",
    left: 0,
    top: 0,
    width: 230,
    height: 150,
    rx: 28,
    ry: 28,
    fill: "#12B981",
    stroke: "#052E2B",
    strokeWidth: 10,
    cornerColor: "#ffffff",
    cornerStrokeColor: "#172033",
    cornerSize: 44,
    touchCornerSize: 44,
    transparentCorners: false,
    borderColor: "#172033",
    borderScaleFactor: 3
  });
  surface.add(artwork);
  artwork.set({ left: 0, top: 0, scaleX: 0.78, scaleY: 0.72 });

  product.set({
    left: 800,
    top: 450,
    angle: 18,
    scaleX: product.scaleX * 1.14,
    scaleY: product.scaleY * 0.82
  });
  surface.dirty = true;
  product.dirty = true;
  surface.setCoords();
  product.setCoords();
  artwork.setCoords();
  canvas.requestRenderAll();

  parentBefore = snapshot(product);
  childBefore = snapshot(artwork);
  enterEditMode();
  stage = "ready";
  verifyParentInvariant();
  await verifyClip();
  publish(
    checkpoints.clip === "pass" ? "ready" : "fail",
    checkpoints.clip === "pass"
      ? "Ready — select the green label inside the tilted can."
      : "The initial clip probe failed before interaction."
  );
}

canvas.on("selection:created", ({ selected }) => {
  if (selected[0] !== artwork) return;
  checkpoints.selection = "pass";
  void updateAfterInteraction("selected");
});
canvas.on("selection:updated", ({ selected }) => {
  if (selected[0] !== artwork) return;
  checkpoints.selection = "pass";
  void updateAfterInteraction("selected");
});
canvas.on("object:moving", ({ target }) => {
  if (target !== artwork) return;
  if (Math.hypot(artwork.left - childBefore.left, artwork.top - childBefore.top) > 4) {
    checkpoints.move = "pass";
  }
});
canvas.on("object:scaling", ({ target }) => {
  if (target !== artwork) return;
  if (Math.abs(artwork.scaleX - childBefore.scaleX) > 0.03 ||
    Math.abs(artwork.scaleY - childBefore.scaleY) > 0.03) {
    checkpoints.scale = "pass";
  }
});
canvas.on("object:rotating", ({ target }) => {
  if (target !== artwork) return;
  if (Math.abs(artwork.angle - childBefore.angle) > 3) checkpoints.rotate = "pass";
});
canvas.on("object:modified", ({ target, action }) => {
  if (target !== artwork) return;
  const moved = Math.hypot(artwork.left - childBefore.left, artwork.top - childBefore.top) > 4;
  const scaled = Math.abs(artwork.scaleX - childBefore.scaleX) > 0.03 ||
    Math.abs(artwork.scaleY - childBefore.scaleY) > 0.03;
  const rotated = Math.abs(artwork.angle - childBefore.angle) > 3;
  if (action === "drag" && moved) checkpoints.move = "pass";
  if (action?.startsWith("scale") && scaled) checkpoints.scale = "pass";
  if (action === "rotate" && rotated) checkpoints.rotate = "pass";
  void updateAfterInteraction(action ? `modified:${action}` : "modified");
});
canvas.on("mouse:down:before", ({ target }) => {
  if (stage === "loading" || stage === "failed" || stage === "exited" || target === artwork) return;
  requestAnimationFrame(() => void exitEditMode("outside"));
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || event.isComposing) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)) return;
  event.preventDefault();
  void exitEditMode("escape");
});

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  stage = "failed";
  publish("fail", `Nested-edit diagnostic failed: ${message}`, message);
  console.error(error);
});
