const ALLOWED_ELEMENTS = new Set([
  "circle",
  "defs",
  "ellipse",
  "g",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "use"
]);

const ALLOWED_ATTRIBUTES = new Set([
  "class",
  "cx",
  "cy",
  "d",
  "fill",
  "height",
  "href",
  "id",
  "points",
  "r",
  "rx",
  "ry",
  "stroke",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-width",
  "transform",
  "width",
  "x",
  "x1",
  "x2",
  "y",
  "y1",
  "y2"
]);

const RENDERED_PRIMITIVES = new Set([
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "use"
]);

function parseAttributes(source) {
  const attributes = new Map();
  let index = 0;
  while (index < source.length) {
    while (/\s/.test(source[index] ?? "")) index += 1;
    if (index >= source.length) break;
    const match = source.slice(index).match(
      /^([a-z_][a-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/
    );
    if (!match) return null;
    const name = match[1];
    if (attributes.has(name)) return null;
    attributes.set(name, match[2] ?? match[3] ?? "");
    index += match[0].length;
  }
  return attributes;
}

function validAttributes(element, attributes) {
  for (const [name, value] of attributes) {
    if (!ALLOWED_ATTRIBUTES.has(name)) return false;
    if (value.includes(">")) return false;
    if (name !== "fill" && name !== "stroke" && value.includes("currentColor")) return false;
    if (name === "class" && (element !== "g" || value !== "icon-tabler")) return false;
    if (name === "href" && (element !== "use" || !/^#[A-Za-z][A-Za-z0-9_.:-]*$/.test(value))) {
      return false;
    }
    if (name === "id" && !/^[A-Za-z][A-Za-z0-9_.:-]*$/.test(value)) return false;
    if ((name === "fill" || name === "stroke") && value !== "none" && value !== "currentColor") {
      return false;
    }
  }
  return true;
}

/** Strictly validates the trusted SVG fragment contract used by the logo pack. */
export function isSafeColourableSvgBody(body) {
  if (typeof body !== "string" || body.length === 0 || body.length > 16_000 ||
    body.includes("&") || /<\s*[!?]/.test(body) ||
    [...body].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d &&
        !(codePoint >= 0x20 && codePoint <= 0xd7ff) &&
        !(codePoint >= 0xe000 && codePoint <= 0xfffd) &&
        !(codePoint >= 0x10000 && codePoint <= 0x10ffff);
    })) return false;

  const tagPattern = /<(\/?)([a-z][a-z0-9]*)([^<>]*)>/g;
  const stack = [];
  let cursor = 0;
  let colourable = false;
  let renderedPrimitiveCount = 0;
  for (const match of body.matchAll(tagPattern)) {
    if (body.slice(cursor, match.index).trim()) return false;
    cursor = match.index + match[0].length;
    const closing = match[1] === "/";
    const element = match[2];
    if (!ALLOWED_ELEMENTS.has(element)) return false;

    let suffix = match[3];
    if (closing) {
      if (suffix.trim() || stack.pop()?.element !== element) return false;
      continue;
    }
    const selfClosing = suffix.endsWith("/");
    if (selfClosing) suffix = suffix.slice(0, -1);
    const attributes = parseAttributes(suffix);
    if (!attributes || !validAttributes(element, attributes)) return false;

    const parent = stack.at(-1) ?? {
      fill: "black",
      stroke: "none",
      inDefs: false
    };
    const state = {
      element,
      fill: attributes.get("fill") ?? parent.fill,
      stroke: attributes.get("stroke") ?? parent.stroke,
      inDefs: parent.inDefs || element === "defs"
    };
    if (RENDERED_PRIMITIVES.has(element) && !state.inDefs) {
      renderedPrimitiveCount += 1;
      const paints = [state.fill, state.stroke].filter((paint) => paint !== "none");
      if (paints.some((paint) => paint !== "currentColor")) return false;
      if (paints.includes("currentColor")) colourable = true;
    }
    if (!selfClosing) stack.push(state);
  }
  return cursor === body.length && stack.length === 0 && renderedPrimitiveCount > 0 && colourable;
}
