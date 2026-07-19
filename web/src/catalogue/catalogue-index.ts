import { CREATOR_CONFIG } from "../config";
import type { CatalogAssetV1 } from "./catalogue-types";

const words = (value: string): string[] => value
  .toLowerCase()
  .normalize("NFKD")
  .split(/[^a-z0-9]+/)
  .filter(Boolean);

const TOKEN_EQUIVALENCE_GROUPS = [
  ["refrigerator", ["fridge", "fridges", "refrigerator", "refrigerators"]],
  ["sofa", ["couch", "couches", "sofa", "sofas"]],
  ["cooler", ["cooler", "coolers", "eskies", "esky"]],
  ["road-vehicle", ["car", "cars", "vehicle", "vehicles"]],
  ["footwear", ["footwear", "shoe", "shoes"]],
  ["retail", ["retail", "retailer", "retailers", "shop", "shops", "store", "stores"]],
  ["fast-food", ["takeaway", "takeaways"]],
  ["digital-offering", ["app", "apps", "subscription", "subscriptions"]],
  ["alcoholic-drink", [
    "alcohol", "alcoholic", "beer", "beers", "spirit", "spirits", "wine", "wines"
  ]]
] as const;

const TOKEN_EQUIVALENTS = new Map<string, string>(
  TOKEN_EQUIVALENCE_GROUPS.flatMap(([canonical, variants]) =>
    variants.map((variant) => [variant, canonical] as const))
);

const PHRASE_EQUIVALENTS = new Map<string, string>([
  ["fast food", "fast-food"],
  ["digital product", "digital-offering"],
  ["digital products", "digital-offering"],
  ["digital service", "digital-offering"],
  ["digital services", "digital-offering"]
]);

/** Applies only explicit classroom-vocabulary groups; it never stems or substring-matches. */
const searchTerms = (value: string): string[] => {
  const source = words(value);
  const terms: string[] = [];

  for (let index = 0; index < source.length;) {
    const current = source[index];
    if (current === undefined) break;
    const next = source[index + 1];
    const phrase = next === undefined
      ? undefined
      : PHRASE_EQUIVALENTS.get(`${current} ${next}`);
    if (phrase) {
      terms.push(phrase);
      index += 2;
      continue;
    }
    terms.push(TOKEN_EQUIVALENTS.get(current) ?? current);
    index += 1;
  }

  return terms;
};

export class CatalogueIndex {
  readonly #records: Array<{
    asset: CatalogAssetV1;
    category: string;
    title: string;
    tokens: Set<string>;
  }>;

  constructor(records: CatalogAssetV1[]) {
    this.#records = records.map((asset) => ({
      asset,
      category: asset.category.toLowerCase(),
      title: words(asset.title).join(" "),
      tokens: new Set([asset.title, asset.category, ...asset.tags].flatMap(searchTerms))
    }));
  }

  search(query: string, category?: string): CatalogAssetV1[] {
    const queryTokens = searchTerms(query);
    const normalized = words(query).join(" ");
    const normalizedCategory = category?.trim().toLowerCase();

    return this.#records
      .filter(({ category: recordCategory, tokens }) =>
        (!normalizedCategory || recordCategory === normalizedCategory) &&
        queryTokens.every((token) => tokens.has(token)))
      .map(({ asset, title }) => ({
        asset,
        score: title === normalized ? 3 : title.startsWith(normalized) ? 2 : 1
      }))
      .sort((left, right) =>
        right.score - left.score ||
        left.asset.title.localeCompare(right.asset.title) ||
        left.asset.id.localeCompare(right.asset.id))
      .slice(0, CREATOR_CONFIG.searchResultLimit)
      .map(({ asset }) => asset);
  }
}
