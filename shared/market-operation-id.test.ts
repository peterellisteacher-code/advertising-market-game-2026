import { describe, expect, it } from "vitest";

describe("market operation ids", () => {
  it("provides the shared room-scoped operation-id module", async () => {
    const modulePath = "./market-operation-id";
    const loaded = await import(/* @vite-ignore */ modulePath).catch(() => null);
    expect(loaded).not.toBeNull();
    expect(loaded).toHaveProperty("isJoinOperationIdForRoom");
  });
});
