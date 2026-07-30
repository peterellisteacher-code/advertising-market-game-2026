import { getStore } from "@netlify/blobs";
import {
  StudioCoachStateService,
  type StudioCoachCampaignState,
  type StudioCoachStateRepository
} from "./studio-coach-state";

const STORE_NAME = "advertising-market-studio-coach";

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
    value: StudioCoachCampaignState,
    options: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<BlobStoreResult>;
}

export function createNetlifyStudioCoachRepository(store: BlobStore): StudioCoachStateRepository {
  return {
    async read(key) {
      const entry = await store.getWithMetadata(key, { type: "json" });
      if (entry === null) return null;
      if (!entry.etag) throw new Error("Studio Coach state entry had no ETag");
      return { value: entry.data, etag: entry.etag };
    },
    async write(key, value, condition) {
      return (await store.setJSON(key, value, condition)).modified;
    }
  };
}

let sharedService: Promise<StudioCoachStateService> | null = null;

export function defaultStudioCoachStateService(): Promise<StudioCoachStateService> {
  sharedService ??= Promise.resolve().then(() => {
    const store = getStore({ name: STORE_NAME, consistency: "strong" }) as BlobStore;
    return new StudioCoachStateService(createNetlifyStudioCoachRepository(store));
  }).catch((error) => {
    sharedService = null;
    throw error;
  });
  return sharedService;
}
