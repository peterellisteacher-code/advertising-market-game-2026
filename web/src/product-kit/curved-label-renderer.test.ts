import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CURVED_LABEL_HEIGHT,
  CURVED_LABEL_FONT_FAMILIES,
  CURVED_LABEL_WIDTH,
  cylindricalLabelX,
  waitForCurvedLabelFont,
  renderCurvedLabel
} from "./curved-label-renderer";

it("keeps curved label typography aligned with the bundled logo typefaces", () => {
  expect(CURVED_LABEL_FONT_FAMILIES).toEqual(expect.arrayContaining(["Lilita One", "Bebas Neue", "Russo One"]));
});

it("waits for a selected curved-label face when the Font Loading API is available", async () => {
  const load = vi.fn().mockResolvedValue([]);
  Object.defineProperty(document, "fonts", { configurable: true, value: { load } });
  await waitForCurvedLabelFont("Lilita One");
  expect(load).toHaveBeenCalledWith('700 48px "Lilita One"');
});

it("safely proceeds when the Font Loading API is unavailable", async () => {
  Object.defineProperty(document, "fonts", { configurable: true, value: undefined });
  await expect(waitForCurvedLabelFont("Bebas Neue")).resolves.toBeUndefined();
});

it("stops waiting when a selected face never settles", async () => {
  vi.useFakeTimers();
  try {
    const load = vi.fn(() => new Promise<FontFace[]>(() => undefined));
    Object.defineProperty(document, "fonts", { configurable: true, value: { load } });
    let settled = false;
    void waitForCurvedLabelFont("Russo One").then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(3_000);

    expect(settled).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

interface ContextTrace {
  font: string;
  fillStyle: string | CanvasGradient | CanvasPattern;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  globalAlpha: number;
  fills: Array<{ text: string; x: number; y: number }>;
  strips: Array<{
    sourceX: number;
    sourceWidth: number;
    destinationX: number;
    destinationY: number;
    destinationWidth: number;
  }>;
}

function installCanvasContexts(): ContextTrace[] {
  const traces: ContextTrace[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () {
    const trace: ContextTrace = {
      font: "",
      fillStyle: "#000000",
      textAlign: "start",
      textBaseline: "alphabetic",
      globalAlpha: 1,
      fills: [],
      strips: []
    };
    traces.push(trace);
    return {
      get font() { return trace.font; },
      set font(value: string) { trace.font = value; },
      get fillStyle() { return trace.fillStyle; },
      set fillStyle(value: string | CanvasGradient | CanvasPattern) { trace.fillStyle = value; },
      get textAlign() { return trace.textAlign; },
      set textAlign(value: CanvasTextAlign) { trace.textAlign = value; },
      get textBaseline() { return trace.textBaseline; },
      set textBaseline(value: CanvasTextBaseline) { trace.textBaseline = value; },
      get globalAlpha() { return trace.globalAlpha; },
      set globalAlpha(value: number) { trace.globalAlpha = value; },
      measureText(value: string) {
        const fontSize = Number.parseFloat(trace.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? "16");
        return { width: [...value].length * fontSize * 0.58 } as TextMetrics;
      },
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillText(text: string, x: number, y: number) {
        trace.fills.push({ text, x, y });
      },
      drawImage(
        _source: CanvasImageSource,
        sourceX: number,
        _sourceY: number,
        sourceWidth: number,
        _sourceHeight: number,
        destinationX: number,
        destinationY: number,
        destinationWidth: number
      ) {
        trace.strips.push({
          sourceX,
          sourceWidth,
          destinationX,
          destinationY,
          destinationWidth
        });
      }
    } as unknown as CanvasRenderingContext2D;
  });
  return traces;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("renderCurvedLabel", () => {
  it("renders a deterministic transparent cylinder-front label", () => {
    const traces = installCanvasContexts();

    const rendered = renderCurvedLabel({
      text: "Refill. Roam. Repeat.",
      colour: "#17324D",
      fontFamily: "Arial"
    });

    expect(rendered.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(rendered.canvas.width).toBe(CURVED_LABEL_WIDTH);
    expect(rendered.canvas.height).toBe(CURVED_LABEL_HEIGHT);
    expect(rendered.profile).toEqual({
      id: "cylinder-front",
      width: CURVED_LABEL_WIDTH,
      height: CURVED_LABEL_HEIGHT,
      lineCount: 3,
      edgeCompression: 0.5
    });
    expect(traces).toHaveLength(2);
    expect(traces[0]!.fills.map(({ text }) => text).join(" "))
      .toBe("Refill. Roam. Repeat.");
    expect(traces[0]!.fillStyle).toBe("#17324D");
    expect(traces[1]!.strips.length).toBeGreaterThan(100);
    expect(traces[1]!.strips.every(({ destinationX, destinationWidth }) =>
      destinationX >= 0 && destinationX <= CURVED_LABEL_WIDTH &&
      destinationWidth > 0 && destinationWidth <= CURVED_LABEL_WIDTH
    )).toBe(true);
    const yValues = traces[1]!.strips.map(({ destinationY }) => destinationY);
    expect(Math.max(...yValues) - Math.min(...yValues)).toBeGreaterThan(24);
    expect(yValues.at(0)).toBeGreaterThan(yValues[Math.floor(yValues.length / 2)]!);
    expect(Math.max(...yValues)).toBeLessThanOrEqual(CURVED_LABEL_HEIGHT * 0.09);
  });

  it("compresses the label edges more than its centre", () => {
    const edgeStep = cylindricalLabelX(1, CURVED_LABEL_WIDTH) -
      cylindricalLabelX(0, CURVED_LABEL_WIDTH);
    const centreStep = cylindricalLabelX(CURVED_LABEL_WIDTH / 2 + 1, CURVED_LABEL_WIDTH) -
      cylindricalLabelX(CURVED_LABEL_WIDTH / 2, CURVED_LABEL_WIDTH);

    expect(edgeStep).toBeGreaterThan(0);
    expect(centreStep).toBeGreaterThan(edgeStep);
    expect(edgeStep / centreStep).toBeCloseTo(0.5, 2);
  });

  it("wraps bounded copy without dropping any words", () => {
    const traces = installCanvasContexts();
    const text = "Warm drinks stay warm while every refill keeps another cup out of the bin";

    const rendered = renderCurvedLabel({ text });
    const lines = traces[0]!.fills.map(({ text: line }) => line);

    expect(rendered.profile.lineCount).toBeGreaterThan(1);
    expect(rendered.profile.lineCount).toBeLessThanOrEqual(3);
    expect(lines.join(" ")).toBe(text);
    expect(lines.every((line) => line.length > 0)).toBe(true);
  });

  it("rejects unbounded or non-portable label inputs", () => {
    installCanvasContexts();

    expect(() => renderCurvedLabel({ text: " " })).toThrow("must not be empty");
    expect(() => renderCurvedLabel({ text: "x".repeat(161) })).toThrow("160");
    expect(() => renderCurvedLabel({ text: "Safe", colour: "red" })).toThrow("colour");
    expect(() => renderCurvedLabel({ text: "Safe", fontFamily: "Remote Font" as never }))
      .toThrow("font");
  });
});
