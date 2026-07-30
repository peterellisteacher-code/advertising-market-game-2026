export const CURVED_LABEL_WIDTH = 1_024;
export const CURVED_LABEL_HEIGHT = 512;
export const CURVED_LABEL_MAX_CHARACTERS = 160;
export const CURVED_TEXT_PROFILE = "cylinder-front" as const;
export const CURVED_LABEL_FONT_FAMILIES = Object.freeze([
  "Arial",
  "Georgia",
  "Trebuchet MS",
  "Verdana"
] as const);

export type CurvedTextProfileId = typeof CURVED_TEXT_PROFILE;
export type CurvedLabelFontFamily = typeof CURVED_LABEL_FONT_FAMILIES[number];

export interface CurvedLabelInput {
  readonly text: string;
  readonly colour?: string;
  readonly fontFamily?: CurvedLabelFontFamily;
}

export interface CurvedLabelProfile {
  readonly id: CurvedTextProfileId;
  readonly width: number;
  readonly height: number;
  readonly lineCount: number;
  readonly edgeCompression: number;
}

export interface CurvedLabelRender {
  readonly canvas: HTMLCanvasElement;
  readonly profile: CurvedLabelProfile;
}

interface LabelLayout {
  readonly lines: readonly string[];
  readonly fontSize: number;
}

const HALF_VISIBLE_ANGLE = Math.PI / 3;
const MAX_LINES = 3;
const MAX_TEXT_WIDTH = CURVED_LABEL_WIDTH * 0.78;
const MAX_TEXT_HEIGHT = CURVED_LABEL_HEIGHT * 0.72;
const MAX_FONT_SIZE = 144;
const MIN_FONT_SIZE = 24;
const FONT_STEP = 2;
const LINE_HEIGHT_RATIO = 1.08;
const STRIP_WIDTH = 4;
const MAX_VERTICAL_ARC = CURVED_LABEL_HEIGHT * 0.09;
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

function normaliseText(value: string): string {
  const text = value.replace(/\s+/gu, " ").trim();
  if (!text) throw new Error("Curved label text must not be empty");
  if ([...text].length > CURVED_LABEL_MAX_CHARACTERS) {
    throw new Error(`Curved label text must contain at most ${CURVED_LABEL_MAX_CHARACTERS} characters`);
  }
  if ([...text].some((character) => character.charCodeAt(0) < 32)) {
    throw new Error("Curved label text contains an unsupported control character");
  }
  return text;
}

function requiredColour(value: string | undefined): string {
  const colour = value ?? "#111827";
  if (!HEX_COLOUR.test(colour)) {
    throw new Error("Curved label colour must be a six-digit hexadecimal colour");
  }
  return colour.toUpperCase();
}

function requiredFont(value: CurvedLabelFontFamily | undefined): CurvedLabelFontFamily {
  const font = value ?? "Arial";
  if (!(CURVED_LABEL_FONT_FAMILIES as readonly string[]).includes(font)) {
    throw new Error("Curved label font is not supported");
  }
  return font;
}

function splitLongWord(
  context: CanvasRenderingContext2D,
  word: string,
  maxWidth: number
): string[] {
  const parts: string[] = [];
  let part = "";
  for (const character of word) {
    const candidate = `${part}${character}`;
    if (part && context.measureText(candidate).width > maxWidth) {
      parts.push(part);
      part = character;
    } else {
      part = candidate;
    }
  }
  if (part) parts.push(part);
  return parts;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const wordParts = context.measureText(word).width <= maxWidth
      ? [word]
      : splitLongWord(context, word, maxWidth);
    for (const part of wordParts) {
      const candidate = line ? `${line} ${part}` : part;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = part;
      } else {
        line = candidate;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function layoutText(
  context: CanvasRenderingContext2D,
  text: string,
  fontFamily: CurvedLabelFontFamily
): LabelLayout {
  for (let fontSize = MAX_FONT_SIZE; fontSize >= MIN_FONT_SIZE; fontSize -= FONT_STEP) {
    context.font = `700 ${fontSize}px "${fontFamily}"`;
    const lines = wrapText(context, text, MAX_TEXT_WIDTH);
    const height = lines.length * fontSize * LINE_HEIGHT_RATIO;
    if (lines.length <= MAX_LINES && height <= MAX_TEXT_HEIGHT) {
      return { lines: Object.freeze(lines), fontSize };
    }
  }
  throw new Error("Curved label text cannot fit within three lines");
}

function requiredContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas text rendering is unavailable");
  return context;
}

export function cylindricalLabelX(
  sourceX: number,
  width = CURVED_LABEL_WIDTH
): number {
  if (!Number.isFinite(sourceX) || !Number.isFinite(width) || width <= 0) {
    throw new Error("Curved label geometry must be finite and positive");
  }
  const clamped = Math.min(width, Math.max(0, sourceX));
  const normalised = clamped / width * 2 - 1;
  return width / 2 +
    Math.sin(normalised * HALF_VISIBLE_ANGLE) /
    Math.sin(HALF_VISIBLE_ANGLE) *
    width / 2;
}

export function renderCurvedLabel(input: CurvedLabelInput): CurvedLabelRender {
  const text = normaliseText(input.text);
  const colour = requiredColour(input.colour);
  const fontFamily = requiredFont(input.fontFamily);
  const source = document.createElement("canvas");
  source.width = CURVED_LABEL_WIDTH;
  source.height = CURVED_LABEL_HEIGHT;
  const sourceContext = requiredContext(source);
  const layout = layoutText(sourceContext, text, fontFamily);
  sourceContext.clearRect(0, 0, source.width, source.height);
  sourceContext.font = `700 ${layout.fontSize}px "${fontFamily}"`;
  sourceContext.fillStyle = colour;
  sourceContext.textAlign = "center";
  sourceContext.textBaseline = "middle";
  const lineHeight = layout.fontSize * LINE_HEIGHT_RATIO;
  const firstY = source.height / 2 - (layout.lines.length - 1) * lineHeight / 2;
  layout.lines.forEach((line, index) => {
    sourceContext.fillText(line, source.width / 2, firstY + index * lineHeight);
  });

  const output = document.createElement("canvas");
  output.width = CURVED_LABEL_WIDTH;
  output.height = CURVED_LABEL_HEIGHT;
  const outputContext = requiredContext(output);
  outputContext.clearRect(0, 0, output.width, output.height);
  outputContext.save();
  for (let sourceX = 0; sourceX < source.width; sourceX += STRIP_WIDTH) {
    const sourceWidth = Math.min(STRIP_WIDTH, source.width - sourceX);
    const destinationX = cylindricalLabelX(sourceX, source.width);
    const destinationRight = cylindricalLabelX(sourceX + sourceWidth, source.width);
    const midpoint = (sourceX + sourceWidth / 2) / source.width * 2 - 1;
    const destinationY = MAX_VERTICAL_ARC * Math.pow(Math.abs(midpoint), 2);
    outputContext.globalAlpha = 0.58 +
      0.42 * Math.pow(Math.cos(midpoint * HALF_VISIBLE_ANGLE), 0.4);
    outputContext.drawImage(
      source,
      sourceX,
      0,
      sourceWidth,
      source.height,
      destinationX,
      destinationY,
      Math.max(0.5, destinationRight - destinationX + 0.5),
      output.height
    );
  }
  outputContext.restore();

  return {
    canvas: output,
    profile: Object.freeze({
      id: CURVED_TEXT_PROFILE,
      width: output.width,
      height: output.height,
      lineCount: layout.lines.length,
      edgeCompression: Number(Math.cos(HALF_VISIBLE_ANGLE).toFixed(6))
    })
  };
}
