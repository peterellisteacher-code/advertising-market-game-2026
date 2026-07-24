import { beforeEach, describe, expect, it } from "vitest";
import { BrowserImageLabSubmissionPersistence } from "./browser-image-lab-submission-persistence";

describe("BrowserImageLabSubmissionPersistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores only a SHA-256 fingerprint and an opaque idempotency key", async () => {
    const persistence = new BrowserImageLabSubmissionPersistence(window.localStorage, "test-image-lab:");
    const fingerprint = "a".repeat(64);
    const idempotencyKey = "00000000-0000-4000-8000-000000000001";

    await persistence.store(fingerprint, idempotencyKey);

    expect(window.localStorage.length).toBe(1);
    const storedKey = window.localStorage.key(0) ?? "";
    const storedValue = window.localStorage.getItem(storedKey) ?? "";
    expect(storedKey).toBe(`test-image-lab:${fingerprint}`);
    expect(storedValue).toBe(idempotencyKey);
    expect(`${storedKey}${storedValue}`).not.toContain("data:image");
    await expect(persistence.load(fingerprint)).resolves.toBe(idempotencyKey);
  });

  it("removes only the addressed pending submission", async () => {
    const persistence = new BrowserImageLabSubmissionPersistence(window.localStorage, "test-image-lab:");
    const first = "a".repeat(64);
    const second = "b".repeat(64);
    await persistence.store(first, "00000000-0000-4000-8000-000000000001");
    await persistence.store(second, "00000000-0000-4000-8000-000000000002");

    await persistence.remove(first);

    await expect(persistence.load(first)).resolves.toBeNull();
    await expect(persistence.load(second)).resolves.toBe("00000000-0000-4000-8000-000000000002");
  });

  it("rejects malformed fingerprints and idempotency keys before touching storage", async () => {
    const persistence = new BrowserImageLabSubmissionPersistence(window.localStorage, "test-image-lab:");

    await expect(persistence.store("raw student submission", "not-an-id")).rejects.toThrow();
    expect(window.localStorage.length).toBe(0);
  });

  it("fails before a paid request when durable browser storage is unavailable", async () => {
    const persistence = new BrowserImageLabSubmissionPersistence(null);

    await expect(persistence.load("a".repeat(64))).rejects.toThrow("retry storage is unavailable");
  });

  it("uses account-scoped v2 keys and resets only the selected account", async () => {
    const persistence = new BrowserImageLabSubmissionPersistence(
      window.localStorage,
      "test-image-lab:v1:",
      "test-image-lab:v2:"
    );
    const fingerprint = "a".repeat(64);
    await persistence.activateAccount("team-one");
    await persistence.store(fingerprint, "00000000-0000-4000-8000-000000000001");
    await persistence.activateAccount("team-two");
    await persistence.store(fingerprint, "00000000-0000-4000-8000-000000000002");

    await persistence.resetAccount("team-one");

    await expect(persistence.load(fingerprint))
      .resolves.toBe("00000000-0000-4000-8000-000000000002");
    await persistence.activateAccount("team-one");
    await expect(persistence.load(fingerprint)).resolves.toBeNull();
    await persistence.activateAccount("team-two");
    await expect(persistence.load(fingerprint))
      .resolves.toBe("00000000-0000-4000-8000-000000000002");
  });
});
