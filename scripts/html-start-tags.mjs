import { JSDOM } from "jsdom";

const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title"]);

export function decodeHtmlAttributeValue(value) {
  if (typeof value !== "string") return value;
  const safe = value.replaceAll('"', "&#34;").replaceAll("<", "&#60;");
  const fragment = JSDOM.fragment(`<span data-value="${safe}"></span>`);
  return fragment.firstElementChild?.getAttribute("data-value") ?? "";
}

function findTagEnd(html, start) {
  let quote;
  for (let index = start + 1; index < html.length; index += 1) {
    const character = html[index];
    if (quote) {
      if (character === quote) quote = undefined;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return index + 1;
    }
  }
  throw new Error("HTML contains an unterminated start tag");
}

function findRawTextClosing(lowerHtml, name, start) {
  const prefix = `</${name}`;
  let cursor = start;
  while (cursor < lowerHtml.length) {
    const candidate = lowerHtml.indexOf(prefix, cursor);
    if (candidate < 0) return -1;
    const boundary = lowerHtml[candidate + prefix.length] ?? "";
    if (boundary === ">" || boundary === "/" || /\s/.test(boundary)) return candidate;
    cursor = candidate + prefix.length;
  }
  return -1;
}

function parseStartTag(raw, start, end) {
  const nameMatch = raw.match(/^<([A-Za-z][A-Za-z0-9:-]*)/);
  if (!nameMatch) return undefined;
  const name = nameMatch[1].toLowerCase();
  const attributes = [];
  const limit = raw.length - 1;
  let index = nameMatch[0].length;
  while (index < limit) {
    const whitespaceStart = index;
    while (/\s/.test(raw[index] ?? "")) index += 1;
    if (index >= limit || (raw[index] === "/" && raw.slice(index + 1, limit).trim() === "")) {
      break;
    }
    const nameStart = index;
    while (index < limit && !/[\s=/>]/.test(raw[index])) index += 1;
    if (index === nameStart) throw new Error("HTML contains a malformed attribute name");
    const attributeName = raw.slice(nameStart, index);
    const nameEnd = index;
    let value;
    let valueCursor = index;
    while (/\s/.test(raw[valueCursor] ?? "")) valueCursor += 1;
    if (raw[valueCursor] === "=") {
      valueCursor += 1;
      while (/\s/.test(raw[valueCursor] ?? "")) valueCursor += 1;
      const quote = raw[valueCursor];
      if (quote === '"' || quote === "'") {
        const valueStart = valueCursor + 1;
        const valueEnd = raw.indexOf(quote, valueStart);
        if (valueEnd < 0 || valueEnd >= limit) {
          throw new Error("HTML contains an unterminated quoted attribute");
        }
        value = raw.slice(valueStart, valueEnd);
        index = valueEnd + 1;
      } else {
        const valueStart = valueCursor;
        while (valueCursor < limit && !/[\s>]/.test(raw[valueCursor])) valueCursor += 1;
        if (valueCursor === valueStart) throw new Error("HTML contains an empty unquoted attribute");
        value = raw.slice(valueStart, valueCursor);
        index = valueCursor;
      }
    } else {
      index = nameEnd;
    }
    attributes.push({
      name: attributeName.toLowerCase(),
      value,
      raw: raw.slice(nameStart, index),
      start: whitespaceStart,
      end: index
    });
  }
  return { name, raw, start, end, attributes };
}

/** Scans actual HTML start tags while respecting quotes, comments, and raw-text elements. */
export function scanHtmlStartTags(html) {
  if (typeof html !== "string") throw new TypeError("HTML must be a string");
  const tags = [];
  const lower = html.toLowerCase();
  let cursor = 0;
  let templateDepth = 0;
  let noscriptDepth = 0;
  while (cursor < html.length) {
    const start = html.indexOf("<", cursor);
    if (start < 0) break;
    if (html.startsWith("<!--", start)) {
      const commentEnd = html.indexOf("-->", start + 4);
      if (commentEnd < 0) throw new Error("HTML contains an unterminated comment");
      cursor = commentEnd + 3;
      continue;
    }
    const next = html[start + 1] ?? "";
    if (next === "/") {
      const end = findTagEnd(html, start);
      const closingName = html.slice(start, end).match(/^<\/\s*([A-Za-z][A-Za-z0-9:-]*)/i)?.[1]
        ?.toLowerCase();
      if (closingName === "template" && templateDepth > 0) templateDepth -= 1;
      if (closingName === "noscript" && noscriptDepth > 0) noscriptDepth -= 1;
      cursor = end;
      continue;
    }
    if (next === "!" || next === "?") {
      cursor = findTagEnd(html, start);
      continue;
    }
    if (!/[A-Za-z]/.test(next)) {
      cursor = start + 1;
      continue;
    }
    const end = findTagEnd(html, start);
    const tag = parseStartTag(html.slice(start, end), start, end);
    if (!tag) {
      cursor = start + 1;
      continue;
    }
    tag.templateDepth = templateDepth;
    tag.inertDepth = templateDepth + noscriptDepth;
    tags.push(tag);
    if (tag.name === "template") templateDepth += 1;
    if (tag.name === "noscript") noscriptDepth += 1;
    if (RAW_TEXT_ELEMENTS.has(tag.name)) {
      const closing = findRawTextClosing(lower, tag.name, end);
      tag.elementEnd = closing < 0 ? html.length : findTagEnd(html, closing);
      cursor = closing < 0 ? html.length : closing;
    } else {
      cursor = end;
    }
  }
  return tags;
}

function isCreatorRoot(tag) {
  return tag.attributes.some((attribute) =>
    attribute.name === "id" && attribute.value === "creator-root");
}

/** Removes an exact attribute everywhere, then writes one canonical copy on #creator-root. */
export function rewriteCreatorRootAttribute(html, attributeName, value) {
  if (!/^[a-z][a-z0-9-]*$/.test(attributeName) ||
    (value !== undefined && (typeof value !== "string" || /["'<>]/.test(value)))) {
    throw new Error("Invalid canonical HTML attribute");
  }
  const tags = scanHtmlStartTags(html);
  const creatorRoots = tags.filter(isCreatorRoot);
  if (creatorRoots.length !== 1) throw new Error("Godot export must contain exactly one #creator-root");
  const creatorRoot = creatorRoots[0];
  const replacements = [];
  for (const tag of tags) {
    let rewritten = tag.raw;
    const targets = tag.attributes
      .filter((attribute) => attribute.name === attributeName)
      .sort((left, right) => right.start - left.start);
    for (const target of targets) {
      rewritten = `${rewritten.slice(0, target.start)}${rewritten.slice(target.end)}`;
    }
    if (tag === creatorRoot && value !== undefined) {
      const closing = rewritten.endsWith("/>") ? "/>" : ">";
      rewritten = `${rewritten.slice(0, -closing.length)} ${attributeName}="${value}"${closing}`;
    }
    if (rewritten !== tag.raw) replacements.push({ start: tag.start, end: tag.end, rewritten });
  }
  let result = html;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, replacement.start)}${replacement.rewritten}${result.slice(replacement.end)}`;
  }
  return result;
}

/** Returns exact attribute tokens and their owning tags, never matches attribute values. */
export function inspectHtmlAttribute(html, attributeName) {
  const tags = scanHtmlStartTags(html);
  const creatorRoots = tags.filter(isCreatorRoot);
  const occurrences = tags.flatMap((tag) => tag.attributes
    .filter((attribute) => attribute.name === attributeName)
    .map((attribute) => ({ attribute, tag, onCreatorRoot: isCreatorRoot(tag) })));
  return { tags, creatorRoots, occurrences };
}
