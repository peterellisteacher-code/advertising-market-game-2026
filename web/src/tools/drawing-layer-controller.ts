import type { CanvasPoint, CanvasPort, DrawingToolSettings } from "../fabric/canvas-port";

type DrawingPort = Pick<CanvasPort, "setDrawingTool" | "eraseTopmostDrawing">;

export interface DrawingStyle {
  color: string;
  width: number;
}

export interface MarkerStyle extends DrawingStyle {
  opacity?: number;
}

type DrawingMode = DrawingToolSettings["mode"];

export class DrawingLayerController {
  #mode: DrawingMode = "select";
  #eraserRadius = 0;

  constructor(private readonly port: DrawingPort) {}

  activatePencil(style: DrawingStyle): void {
    this.#activateDrawing("pencil", style, 1);
  }

  activateMarker(style: MarkerStyle): void {
    this.#activateDrawing("marker", style, style.opacity ?? 0.35);
  }

  activateEraser(radius: number): void {
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new Error("Eraser radius must be a positive finite number");
    }
    this.port.setDrawingTool({ mode: "eraser", radius });
    this.#eraserRadius = radius;
    this.#mode = "eraser";
  }

  deactivate(): void {
    this.port.setDrawingTool({ mode: "select" });
    this.#mode = "select";
    this.#eraserRadius = 0;
  }

  eraseAt(point: CanvasPoint): boolean {
    if (this.#mode !== "eraser") return false;
    if (![point.x, point.y].every(Number.isFinite)) {
      throw new Error("Eraser point must be finite");
    }
    return this.port.eraseTopmostDrawing(point, this.#eraserRadius);
  }

  #activateDrawing(mode: "pencil" | "marker", style: DrawingStyle, opacity: number): void {
    if (!style.color.trim()) throw new Error("Drawing colour must not be empty");
    if (!Number.isFinite(style.width) || style.width <= 0) {
      throw new Error("Drawing width must be a positive finite number");
    }
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
      throw new Error("Drawing opacity must be between zero and one");
    }
    this.port.setDrawingTool({ mode, color: style.color, width: style.width, opacity });
    this.#mode = mode;
    this.#eraserRadius = 0;
  }
}
