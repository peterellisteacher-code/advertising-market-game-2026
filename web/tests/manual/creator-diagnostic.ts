import { Canvas } from "fabric";
import { FabricCanvasAdapter } from "../../src/fabric/fabric-canvas-adapter";
import { ObjectCommandService } from "../../src/fabric/object-command-service";

declare global {
  interface Window {
    __CREATOR_DIAGNOSTIC__?: { objectOperations?: "pass" | "fail"; error?: string };
  }
}

const status = document.querySelector<HTMLElement>("#status")!;
const canvasElement = document.querySelector<HTMLCanvasElement>("#diagnostic-canvas")!;
if (!status || !canvasElement) throw new Error("Diagnostic host is incomplete");

window.__CREATOR_DIAGNOSTIC__ = {};

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
  await commands.addText("Fresh idea", "Fresh idea headline");
  await commands.addRaster({
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
  const saved = commands.serialize();
  commands.remove(copyId);
  await commands.load(saved);

  const restoredObjects = (commands.serialize().objects as unknown[]) ?? [];
  if (restoredObjects.length < 4) throw new Error("Serialized objects did not restore");
  window.__CREATOR_DIAGNOSTIC__ = { objectOperations: "pass" };
  status.dataset.objectOperations = "pass";
  status.textContent = "Object operations passed";
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  window.__CREATOR_DIAGNOSTIC__ = { objectOperations: "fail", error: message };
  status.dataset.objectOperations = "fail";
  status.textContent = `Object operations failed: ${message}`;
  console.error(error);
});
