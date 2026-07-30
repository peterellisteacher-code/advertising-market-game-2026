import { getStore } from "@netlify/blobs";
import {
  ProductPriceGuideStateService,
  type ProductPriceGuideStateRepository,
  type ProductPriceGuideStoredState
} from "./product-price-guide-state";

const STORE_NAME = "advertising-market-product-price-guides";

interface BlobStore {
  getWithMetadata(
    key: string,
    options: { type: "json" }
  ): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(
    key: string,
    value: ProductPriceGuideStoredState,
    options: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<{ modified: boolean }>;
}

export function createNetlifyProductPriceGuideRepository(
  store: BlobStore
): ProductPriceGuideStateRepository {
  return {
    async read(key) {
      const entry = await store.getWithMetadata(key, { type: "json" });
      if (entry === null) return null;
      if (!entry.etag) throw new Error("Product price guide state entry had no ETag");
      return { value: entry.data, etag: entry.etag };
    },
    async write(key, value, condition) {
      return (await store.setJSON(key, value, condition)).modified;
    }
  };
}

let sharedService: Promise<ProductPriceGuideStateService> | null = null;

export function defaultProductPriceGuideStateService(): Promise<ProductPriceGuideStateService> {
  sharedService ??= Promise.resolve().then(() => {
    const store = getStore({ name: STORE_NAME, consistency: "strong" }) as BlobStore;
    return new ProductPriceGuideStateService(createNetlifyProductPriceGuideRepository(store));
  }).catch((error) => {
    sharedService = null;
    throw error;
  });
  return sharedService;
}
