declare module "@netlify/blobs" {
  interface WriteResult {
    modified: boolean;
    etag?: string;
  }

  interface Store {
    getWithMetadata(
      key: string,
      options: { type: "json" }
    ): Promise<{ data: unknown; etag?: string } | null>;
    setJSON(
      key: string,
      value: unknown,
      options: { onlyIfNew: true } | { onlyIfMatch: string }
    ): Promise<WriteResult>;
  }

  export function getStore(options: {
    name: string;
    consistency: "strong" | "eventual";
  }): Store;
}
