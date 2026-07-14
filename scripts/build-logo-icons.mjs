import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const PACK_ID = "tabler-logo-icons-v1";
const PACKAGE_VERSION = "1.2.35";

const ALLOWED_SVG_ELEMENTS = new Set([
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

const BLOCKED_ICON_TERMS = new Set([
  "beer",
  "bong",
  "bomb",
  "cannabis",
  "cigarette",
  "condom",
  "gun",
  "knife",
  "pistol",
  "rifle",
  "smoking",
  "sword",
  "vape",
  "vodka",
  "weapon",
  "weed",
  "wine"
]);

const FAMILY_KEYWORDS = [
  ["beauty-care", ["brush", "comb", "cosmetic", "droplet", "face", "feather", "flower", "heart", "leaf", "lipstick", "manicure", "perfume", "razor", "scissors", "soap", "sparkle"]],
  ["drinks-snacks", ["apple", "banana", "berry", "bottle", "bread", "burger", "cake", "candy", "carrot", "cheese", "cherry", "coffee", "cookie", "cup", "egg", "food", "fork", "grape", "ice", "lemon", "meat", "milk", "mushroom", "pizza", "salad", "snack", "soup", "spoon", "strawberry", "taco", "tea", "wheat"]],
  ["fashion-footwear", ["backpack", "bag", "bow", "cap", "clothes", "crown", "diamond", "dress", "glasses", "hanger", "hat", "jacket", "shirt", "shoe", "sock", "sunglasses", "tie"]],
  ["fast-food-hospitality", ["bakery", "bowl", "burger", "cake", "chef", "coffee", "cookie", "cup", "food", "fork", "hotel", "ice", "meal", "pizza", "restaurant", "salad", "soup", "spoon", "taco", "tea"]],
  ["home-lifestyle", ["armchair", "bath", "bed", "candle", "chair", "clock", "couch", "door", "flower", "home", "house", "lamp", "plant", "sofa", "table", "vase"]],
  ["pets-animals", ["animal", "bird", "bone", "cat", "dog", "fish", "horse", "paw", "pet", "rabbit", "turtle"]],
  ["shops-services", ["building", "business", "cash", "coin", "receipt", "scissors", "shop", "shopping", "store", "ticket", "tools", "wallet"]],
  ["sport-outdoors", ["ball", "basketball", "bike", "camp", "cycling", "football", "mountain", "run", "skateboard", "sport", "surf", "swim", "tent", "trophy", "volleyball"]],
  ["tech-gadgets", ["alien", "camera", "computer", "controller", "device", "game", "headphone", "keyboard", "laptop", "phone", "rocket", "robot", "smartwatch", "speaker", "tablet", "watch"]],
  ["travel-transport", ["airplane", "backpack", "bike", "bus", "car", "luggage", "map", "plane", "road", "scooter", "suitcase", "train", "travel", "truck", "van"]]
];

function iconTokens(id) {
  return id.split("-").filter(Boolean);
}

function titleFromId(id) {
  return id.split("-").map((word) => word.length <= 2
    ? word.toUpperCase()
    : `${word[0].toUpperCase()}${word.slice(1)}`).join(" ");
}

function iconCategories(id) {
  const tokens = iconTokens(id);
  const categories = FAMILY_KEYWORDS
    .filter(([, keywords]) => keywords.some((keyword) =>
      tokens.includes(keyword) || id.includes(`${keyword}-`) || id.endsWith(`-${keyword}`)))
    .map(([family]) => family);
  return categories.length > 0 ? categories : ["general"];
}

function shouldIncludeIcon(id) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return false;
  if (id.startsWith("brand-") || id.endsWith("-filled") || id.endsWith("-off")) return false;
  return !iconTokens(id).some((token) => BLOCKED_ICON_TERMS.has(token));
}

export function safeIconBody(body) {
  if (typeof body !== "string" || body.length === 0 || body.length > 16_000) return false;
  if (/(?:<\s*(?:script|style|foreignObject|iframe|image|a)\b|\bon[a-z]+\s*=|\bxlink:href\s*=|url\s*\(|javascript\s*:|https?\s*:|data\s*:)/i.test(body)) {
    return false;
  }
  for (const match of body.matchAll(/\bhref\s*=\s*["']([^"']*)["']/gi)) {
    if (!/^#[A-Za-z][A-Za-z0-9_.:-]*$/.test(match[1])) return false;
  }
  for (const match of body.matchAll(/<\/?\s*([a-z][a-z0-9]*)\b/gi)) {
    if (!ALLOWED_SVG_ELEMENTS.has(match[1].toLowerCase())) return false;
  }
  return /<\s*(?:path|circle|ellipse|line|polygon|polyline|rect)\b/i.test(body);
}

export function compileLogoIconCatalogue(source, versions) {
  if (!source || typeof source !== "object" || Array.isArray(source) ||
    source.prefix !== "tabler" || !source.icons || typeof source.icons !== "object" ||
    Array.isArray(source.icons)) {
    throw new Error("Tabler source has an invalid Iconify contract");
  }
  if (!versions || typeof versions.packageVersion !== "string" ||
    typeof versions.sourceVersion !== "string") {
    throw new Error("Tabler source versions are required");
  }
  const rootWidth = Number.isFinite(source.width) ? source.width : 24;
  const rootHeight = Number.isFinite(source.height) ? source.height : 24;
  const icons = [];
  for (const id of Object.keys(source.icons).sort()) {
    if (!shouldIncludeIcon(id)) continue;
    const icon = source.icons[id];
    if (!icon || typeof icon !== "object" || Array.isArray(icon) || !safeIconBody(icon.body)) {
      throw new Error(`Icon ${id} has an unsafe SVG body`);
    }
    icons.push({
      id,
      title: titleFromId(id),
      body: icon.body,
      width: Number.isFinite(icon.width) ? icon.width : rootWidth,
      height: Number.isFinite(icon.height) ? icon.height : rootHeight,
      categories: iconCategories(id)
    });
  }
  return {
    schema: "logo-icon-catalog@1",
    packId: PACK_ID,
    version: 1,
    source: {
      name: "Tabler Icons",
      package: "@iconify-json/tabler",
      packageVersion: versions.packageVersion,
      sourceVersion: versions.sourceVersion,
      licence: "MIT",
      url: "https://github.com/tabler/tabler-icons"
    },
    icons
  };
}

async function main() {
  if (process.argv.length > 2) throw new Error("Usage: node scripts/build-logo-icons.mjs");
  const sourceDirectory = path.join(DEFAULT_ROOT, "catalog", "source", "logo-icons-tabler-v1", "vendor");
  const outputDirectory = path.join(DEFAULT_ROOT, "catalog", "generated", "logo-icons-v1-reviewed");
  const [source, info] = await Promise.all([
    readFile(path.join(sourceDirectory, "icons.json"), "utf8").then(JSON.parse),
    readFile(path.join(sourceDirectory, "info.json"), "utf8").then(JSON.parse)
  ]);
  const catalogue = compileLogoIconCatalogue(source, {
    packageVersion: PACKAGE_VERSION,
    sourceVersion: String(info.version ?? "")
  });
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "catalog.json"),
    `${JSON.stringify(catalogue)}\n`,
    "utf8"
  );
  console.log(`LOGO_ICON_CATALOGUE_BUILT ${catalogue.icons.length}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
