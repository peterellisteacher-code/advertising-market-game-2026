import { Canvas } from "fabric";
import { FabricCanvasAdapter } from "../../src/fabric/fabric-canvas-adapter";
import { ObjectCommandService } from "../../src/fabric/object-command-service";
import { FabricHistoryBindings } from "../../src/history/fabric-history-bindings";
import { CropController } from "../../src/tools/crop-controller";
import { DrawingLayerController } from "../../src/tools/drawing-layer-controller";

declare global {
  interface Window {
    __CREATOR_DIAGNOSTIC__?: {
      objectOperations?: "pass" | "fail";
      creativeTools?: "pass" | "fail";
      baselineHash?: string;
      completedHash?: string;
      error?: string;
    };
  }
}

const status = document.querySelector<HTMLElement>("#status")!;
const canvasElement = document.querySelector<HTMLCanvasElement>("#diagnostic-canvas")!;
if (!status || !canvasElement) throw new Error("Diagnostic host is incomplete");

window.__CREATOR_DIAGNOSTIC__ = {};

interface StrokePoint { x: number; y: number }

async function drawStroke(canvas: Canvas, points: StrokePoint[]): Promise<void> {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) throw new Error("A diagnostic stroke needs two points");
  const target = canvas.upperCanvasEl;
  const bounds = target.getBoundingClientRect();
  const clientPoint = ({ x, y }: StrokePoint): StrokePoint => ({
    x: bounds.left + (x / canvas.getWidth()) * bounds.width,
    y: bounds.top + (y / canvas.getHeight()) * bounds.height
  });
  const dispatch = (host: EventTarget, type: string, point: StrokePoint, buttons: number): void => {
    const client = clientPoint(point);
    host.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons,
      clientX: client.x,
      clientY: client.y,
      view: window
    }));
  };
  dispatch(target, "mousedown", first, 1);
  points.slice(1).forEach((point) => dispatch(document, "mousemove", point, 1));
  dispatch(document, "mouseup", last, 0);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

const hashCanvas = (adapter: FabricCanvasAdapter): string => JSON.stringify(adapter.serialize());

async function run(): Promise<void> {
  const canvas = new Canvas(canvasElement, {
    width: 1600,
    height: 900,
    preserveObjectStacking: true,
    backgroundColor: "#ffffff"
  });
  const adapter = new FabricCanvasAdapter(canvas);
  const commands = new ObjectCommandService(adapter);
  const shapeId = await commands.addShape({
    kind: "rect",
    fill: "#e11d48",
    accessibleName: "Red product card"
  });
  const textId = await commands.addText("Fresh idea", "Fresh idea headline");
  const imageId = await commands.addRaster({
    assetId: "diagnostic-product",
    sameOriginUrl: new URL("./probe.svg", window.location.href).href,
    accessibleName: "Diagnostic product image"
  });
  commands.transform(shapeId, {
    x: 360,
    y: 300,
    scaleX: 1.2,
    scaleY: 0.8,
    angle: 12,
    flipX: true
  });
  const copyId = await commands.duplicate(shapeId);
  commands.moveToFront(copyId);
  commands.moveBackward(copyId);
  commands.moveForward(copyId);
  commands.moveToBack(copyId);
  commands.setLocked(shapeId, true);
  commands.setLocked(shapeId, false);
  commands.setHidden(copyId, true);
  commands.setHidden(copyId, false);
  commands.select(shapeId);
  commands.setLocked(shapeId, true);
  commands.setHidden(copyId, true);
  const saved = commands.serialize();
  const savedObjects = saved.objects as Array<Record<string, unknown>>;
  const savedOrder = savedObjects.map((object) => object.objectId);
  commands.remove(copyId);
  await commands.load(saved);

  const restoredObjects = commands.serialize().objects as Array<Record<string, unknown>>;
  const restoredOrder = restoredObjects.map((object) => object.objectId);
  const restoredShape = restoredObjects.find((object) => object.objectId === shapeId);
  const restoredCopy = restoredObjects.find((object) => object.objectId === copyId);
  if (restoredObjects.length !== 4) throw new Error("Serialized objects did not restore");
  if (JSON.stringify(restoredOrder) !== JSON.stringify(savedOrder)) throw new Error("Object order changed");
  if (!restoredOrder.includes(textId) || !restoredOrder.includes(imageId)) throw new Error("Object metadata was lost");
  if (!restoredShape || restoredShape.selectable !== false || restoredShape.lockMovementX !== true) {
    throw new Error("Locked state was not restored");
  }
  if (!restoredCopy || restoredCopy.visible !== false) throw new Error("Visibility was not restored");
  if (restoredObjects.some((object) =>
    object.cornerSize !== 44 || object.touchCornerSize !== 44 || !object.accessibleName)) {
    throw new Error("Controls or accessibility metadata were not restored");
  }

  const history = new FabricHistoryBindings(adapter, status);
  const crop = new CropController(adapter);
  const drawing = new DrawingLayerController(adapter);
  const baselineHash = hashCanvas(adapter);
  crop.apply(imageId, {
    cropX: 80,
    cropY: 40,
    visibleWidth: 400,
    visibleHeight: 320,
    focalX: 0.65,
    focalY: 0.4
  });
  drawing.activatePencil({ color: "#0f172a", width: 12 });
  await drawStroke(canvas, [{ x: 760, y: 170 }, { x: 900, y: 170 }, { x: 1040, y: 170 }]);
  await drawStroke(canvas, [{ x: 760, y: 250 }, { x: 900, y: 250 }, { x: 1040, y: 250 }]);
  await drawStroke(canvas, [{ x: 760, y: 330 }, { x: 900, y: 330 }, { x: 1040, y: 330 }]);
  const drawingsBeforeErase = (adapter.serialize().objects as Array<Record<string, unknown>>)
    .filter((object) => object.elementKind === "drawing");
  if (drawingsBeforeErase.length !== 3) throw new Error("Three drawing strokes were not created");
  drawing.activateEraser(18);
  if (!drawing.eraseAt({ x: 900, y: 250 })) throw new Error("Middle drawing stroke was not erased");
  const completed = adapter.serialize();
  const completedObjects = completed.objects as Array<Record<string, unknown>>;
  const completedHash = JSON.stringify(completed);
  if (completedObjects.filter((object) => object.elementKind === "drawing").length !== 2) {
    throw new Error("Eraser did not leave exactly two drawing strokes");
  }
  const croppedImage = completedObjects.find((object) => object.objectId === imageId);
  if (!croppedImage || croppedImage.cropX !== 80 || croppedImage.cropY !== 40 ||
    croppedImage.width !== 400 || croppedImage.height !== 320 ||
    croppedImage.cropFocalX !== 0.65 || croppedImage.cropFocalY !== 0.4) {
    throw new Error("Non-destructive crop state was not serialised");
  }

  for (let index = 0; index < 5; index += 1) {
    if (!await history.undo()) throw new Error(`Undo ${index + 1} was unavailable`);
  }
  if (hashCanvas(adapter) !== baselineHash) throw new Error("Undo did not restore the baseline hash");
  if (await history.undo()) throw new Error("Creative operations produced more than five history actions");
  for (let index = 0; index < 5; index += 1) {
    if (!await history.redo()) throw new Error(`Redo ${index + 1} was unavailable`);
  }
  if (hashCanvas(adapter) !== completedHash) throw new Error("Redo did not restore the completed hash");
  if (await history.redo()) throw new Error("Creative operations produced extra redo actions");
  drawing.deactivate();
  history.dispose();

  window.__CREATOR_DIAGNOSTIC__ = {
    objectOperations: "pass",
    creativeTools: "pass",
    baselineHash,
    completedHash
  };
  status.dataset.objectOperations = "pass";
  status.dataset.creativeTools = "pass";
  status.textContent = "Object operations, crop, drawing, erasing and exact undo/redo passed";
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  window.__CREATOR_DIAGNOSTIC__ = {
    objectOperations: "fail",
    creativeTools: "fail",
    error: message
  };
  status.dataset.objectOperations = "fail";
  status.dataset.creativeTools = "fail";
  status.textContent = `Creator diagnostic failed: ${message}`;
  console.error(error);
});
