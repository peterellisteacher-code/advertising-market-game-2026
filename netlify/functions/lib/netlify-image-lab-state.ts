import {
  ImageLabStateService,
  type ImageLabPairState,
  type ImageLabStateRepository
} from "./image-lab-state";

const STORE_NAME = "advertising-market-image-lab";

interface BlobStoreResult {
  modified: boolean;
}

interface BlobStore {
  getWithMetadata(
    key: string,
    options: { type: "json" }
  ): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(
    key: string,
    value: ImageLabPairState,
    options: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<BlobStoreResult>;
}

export function createNetlifyImageLabRepository(store: BlobStore): ImageLabStateRepository {
  return {
    async read(key) {
      const entry = await store.getWithMetadata(key, { type: "json" });
      if (entry === null) return null;
      if (!entry.etag) throw new Error("Image Lab state entry had no ETag");
      return { value: entry.data, etag: entry.etag };
    },
    async write(key, value, condition) {
      const result = await store.setJSON(key, value, condition);
      return result.modified;
    }
  };
}

let sharedService: Promise<ImageLabStateService> | null = null;

export function defaultImageLabStateService(): Promise<ImageLabStateService> {
  const moduleName = "@netlify/blobs";
  sharedService ??= import(/* @vite-ignore */ moduleName).then(({ getStore }) => {
    const store = getStore({ name: STORE_NAME, consistency: "strong" }) as BlobStore;
    return new ImageLabStateService(createNetlifyImageLabRepository(store));
  });
  return sharedService;
}
