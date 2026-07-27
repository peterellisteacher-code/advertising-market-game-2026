import { describe, expect, it, vi } from "vitest";
import { createNetlifyImageLabRepository } from "./netlify-image-lab-state";

const value = {
  version: 2 as const,
  jobs: {}
};

describe("Netlify Image Lab state repository", () => {
  it("preserves ETags and conditional-write outcomes", async () => {
    const store = {
      getWithMetadata: vi.fn().mockResolvedValue({ data: value, etag: '"etag-1"' }),
      setJSON: vi.fn().mockResolvedValueOnce({ modified: false }).mockResolvedValueOnce({ modified: true })
    };
    const repository = createNetlifyImageLabRepository(store);

    await expect(repository.read("account/key")).resolves.toEqual({ value, etag: '"etag-1"' });
    await expect(repository.write("account/key", value, { onlyIfNew: true })).resolves.toBe(false);
    await expect(repository.write("account/key", value, { onlyIfMatch: '"etag-1"' })).resolves.toBe(true);
    expect(store.setJSON).toHaveBeenNthCalledWith(1, "account/key", value, { onlyIfNew: true });
    expect(store.setJSON).toHaveBeenNthCalledWith(2, "account/key", value, { onlyIfMatch: '"etag-1"' });
  });

  it("fails closed if a state value arrives without an ETag", async () => {
    const repository = createNetlifyImageLabRepository({
      getWithMetadata: vi.fn().mockResolvedValue({ data: value }),
      setJSON: vi.fn()
    });
    await expect(repository.read("account/key")).rejects.toThrow("ETag");
  });
});
