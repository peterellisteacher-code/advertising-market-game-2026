import { CREATOR_CONFIG } from "../config";
import type { CatalogAssetV1 } from "./catalogue-types";

const words = (value: string): string[] => value
  .toLowerCase()
  .normalize("NFKD")
  .split(/[^a-z0-9]+/)
  .filter(Boolean);

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
      tokens: new Set(words([asset.title, asset.category, ...asset.tags].join(" ")))
    }));
  }

  search(query: string, category?: string): CatalogAssetV1[] {
    const queryTokens = words(query);
    const normalized = queryTokens.join(" ");
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
