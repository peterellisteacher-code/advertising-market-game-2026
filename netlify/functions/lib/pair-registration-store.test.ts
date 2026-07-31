// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  PairRegistrationStoreError,
  createNetlifyPairRegistrationStore
} from "./pair-registration-store";

class MemoryBlobStore {
  value: unknown = null;
  etag: string | null = null;
  revision = 0;

  async getWithMetadata(): Promise<{ data: unknown; etag: string } | null> {
    return this.etag === null ? null : { data: structuredClone(this.value), etag: this.etag };
  }

  async setJSON(
    _key: string,
    value: unknown,
    condition: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<{ modified: boolean }> {
    if ("onlyIfNew" in condition ? this.etag !== null : condition.onlyIfMatch !== this.etag) {
      return { modified: false };
    }
    this.revision += 1;
    this.etag = `etag-${this.revision}`;
    this.value = structuredClone(value);
    return { modified: true };
  }
}

describe("pair registration store", () => {
  it("keeps a self-registration pending until the teacher records approval", async () => {
    const store = createNetlifyPairRegistrationStore(new MemoryBlobStore());
    const requestedAt = "2026-07-31T00:00:00.000Z";

    await expect(store.request({
      username: "bright-ideas",
      password: "classroom-only-password",
      requestedAt
    })).resolves.toEqual({
      username: "bright-ideas",
      password: "classroom-only-password",
      status: "pending",
      requestedAt,
      approvedAt: null
    });
    await expect(store.request({
      username: "bright-ideas",
      password: "classroom-only-password",
      requestedAt: "2026-07-31T00:05:00.000Z"
    })).resolves.toMatchObject({ status: "pending", requestedAt });
    await expect(store.request({
      username: "bright-ideas",
      password: "a-different-password",
      requestedAt
    })).rejects.toEqual(new PairRegistrationStoreError("USERNAME_UNAVAILABLE"));

    await store.recordApproved({
      username: "bright-ideas",
      password: "classroom-only-password",
      approvedAt: "2026-07-31T00:10:00.000Z"
    });

    await expect(store.list()).resolves.toEqual([{
      username: "bright-ideas",
      password: "classroom-only-password",
      status: "approved",
      requestedAt,
      approvedAt: "2026-07-31T00:10:00.000Z"
    }]);
    await expect(store.pending("bright-ideas")).resolves.toBeNull();
  });
});
