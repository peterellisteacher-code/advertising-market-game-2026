import { describe, expect, it, vi } from "vitest";
import { getStore } from "@netlify/blobs";
import {
  createNetlifyStudioCoachRepository,
  defaultStudioCoachStateService
} from "./netlify-studio-coach-state";

vi.mock("@netlify/blobs", () => ({ getStore: vi.fn() }));

describe("Netlify Studio Coach state repository", () => {
  it("uses ETag conditions for strongly consistent JSON state", async () => {
    const store = {
      getWithMetadata: vi.fn().mockResolvedValue({ data: { version: 1 }, etag: "etag-1" }),
      setJSON: vi.fn().mockResolvedValue({ modified: true })
    };
    const repository = createNetlifyStudioCoachRepository(store);

    await expect(repository.read("campaign/key")).resolves.toEqual({ value: { version: 1 }, etag: "etag-1" });
    await expect(repository.write("campaign/key", { version: 1 } as never, { onlyIfMatch: "etag-1" }))
      .resolves.toBe(true);
    expect(store.setJSON).toHaveBeenCalledWith("campaign/key", { version: 1 }, { onlyIfMatch: "etag-1" });
  });

  it("fails closed when Netlify omits an ETag", async () => {
    const repository = createNetlifyStudioCoachRepository({
      getWithMetadata: vi.fn().mockResolvedValue({ data: {}, etag: undefined }),
      setJSON: vi.fn()
    });
    await expect(repository.read("campaign/key")).rejects.toThrow(/ETag/);
  });

  it("does not cache a transient store-initialisation failure", async () => {
    const store = {
      getWithMetadata: vi.fn(),
      setJSON: vi.fn()
    };
    vi.mocked(getStore)
      .mockImplementationOnce(() => { throw new Error("temporary store failure"); })
      .mockReturnValueOnce(store as never);

    await expect(defaultStudioCoachStateService()).rejects.toThrow("temporary store failure");
    await expect(defaultStudioCoachStateService()).resolves.toBeDefined();
    expect(getStore).toHaveBeenCalledTimes(2);
  });
});
