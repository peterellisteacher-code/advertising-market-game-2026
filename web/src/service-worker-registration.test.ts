import { describe, expect, it, vi } from "vitest";
import { registerReleaseServiceWorker } from "./service-worker-registration";

describe("registerReleaseServiceWorker", () => {
  it("registers the release worker without cached update checks", async () => {
    const update = vi.fn(async () => undefined);
    const registration = {
      installing: null,
      waiting: null,
      addEventListener: vi.fn(),
      update
    };
    const register = vi.fn(async () => registration);
    const listeners = new Map<string, () => void>();
    const windowObject = {
      addEventListener: vi.fn((type: string, listener: () => void) => {
        listeners.set(type, listener);
      }),
      document: { readyState: "complete" },
      queueMicrotask
    };

    registerReleaseServiceWorker({
      navigatorObject: {
        serviceWorker: { controller: {}, register }
      },
      windowObject,
      onUpdateReady: vi.fn()
    });
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(register).not.toHaveBeenCalled();
    expect(listeners.has("admarket:game-startup-ready")).toBe(true);
    listeners.get("admarket:game-startup-ready")?.();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(register).toHaveBeenCalledWith("/service-worker.js", {
      scope: "/",
      updateViaCache: "none"
    });
    expect(update).toHaveBeenCalledOnce();
  });

  it("reports a waiting update without forcing a reload", async () => {
    const onUpdateReady = vi.fn();
    const registration = {
      installing: null,
      waiting: { state: "installed", addEventListener: vi.fn() },
      addEventListener: vi.fn(),
      update: vi.fn(async () => undefined)
    };
    const listeners = new Map<string, () => void>();
    const windowObject = {
      addEventListener: vi.fn((type: string, listener: () => void) => {
        listeners.set(type, listener);
      }),
      document: { readyState: "complete" },
      queueMicrotask
    };

    registerReleaseServiceWorker({
      navigatorObject: {
        serviceWorker: {
          controller: {},
          register: vi.fn(async () => registration)
        }
      },
      windowObject,
      onUpdateReady
    });
    expect(onUpdateReady).not.toHaveBeenCalled();
    listeners.get("admarket:game-startup-ready")?.();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(onUpdateReady).toHaveBeenCalledOnce();
  });
});
