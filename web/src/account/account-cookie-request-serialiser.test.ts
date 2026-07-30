import { describe, expect, it, vi } from "vitest";
import {
  AccountCookieSerialisationUnavailableError,
  BrowserAccountCookieRequestSerialiser,
  defaultAccountCookieRequestSerialiser
} from "./account-cookie-request-serialiser";

describe("BrowserAccountCookieRequestSerialiser", () => {
  it("uses one named exclusive Web Lock for the complete operation", async () => {
    const request = vi.fn(async (
      name: string,
      options: LockOptions,
      callback: () => Promise<string>
    ) => callback());
    const serialiser = new BrowserAccountCookieRequestSerialiser({ request } as unknown as LockManager);

    await expect(serialiser.run(async () => "done")).resolves.toBe("done");
    expect(request).toHaveBeenCalledWith(
      "advertising-market-account-cookie@1",
      { mode: "exclusive" },
      expect.any(Function)
    );
  });

  it("fails closed when cross-tab Web Locks are unavailable", async () => {
    const serialiser = new BrowserAccountCookieRequestSerialiser(undefined);
    await expect(serialiser.run(async () => "unsafe"))
      .rejects.toBeInstanceOf(AccountCookieSerialisationUnavailableError);
  });

  it("preserves same-tab ordering when the browser has no Web Locks", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const serialiser = defaultAccountCookieRequestSerialiser(globalThis.fetch, undefined);
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });

    const first = serialiser.run(async () => {
      events.push("first-start");
      await firstGate;
      events.push("first-end");
    });
    const second = serialiser.run(async () => {
      events.push("second-start");
      events.push("second-end");
    });

    await vi.waitFor(() => expect(events).toEqual(["first-start"]));
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(events).toEqual(["first-start", "first-end", "second-start", "second-end"]);
    expect(warning).toHaveBeenCalledWith(
      "[AdMarket account cookie lock unavailable]",
      { fallback: "same-tab" }
    );
    warning.mockRestore();
  });
});
