interface WorkerLike {
  readonly state: string;
  addEventListener(type: "statechange", listener: () => void): void;
}

interface RegistrationLike {
  readonly installing: WorkerLike | null;
  readonly waiting: WorkerLike | null;
  addEventListener(type: "updatefound", listener: () => void): void;
  update(): Promise<unknown>;
}

interface ServiceWorkerContainerLike {
  readonly controller: unknown;
  register(
    scriptURL: string,
    options: { scope: string; updateViaCache: "none" }
  ): Promise<RegistrationLike>;
}

interface NavigatorLike {
  readonly serviceWorker?: ServiceWorkerContainerLike;
}

interface WindowLike {
  addEventListener(
    type: typeof GAME_STARTUP_READY_EVENT,
    listener: () => void,
    options: { once: true }
  ): void;
}

export const GAME_STARTUP_READY_EVENT = "admarket:game-startup-ready";

export interface ReleaseServiceWorkerOptions {
  navigatorObject?: NavigatorLike;
  windowObject?: WindowLike;
  onUpdateReady?: () => void;
}

export function registerReleaseServiceWorker({
  navigatorObject = navigator,
  windowObject = window,
  onUpdateReady = () => undefined
}: ReleaseServiceWorkerOptions = {}): void {
  const serviceWorker = navigatorObject.serviceWorker;
  if (serviceWorker === undefined) return;
  let announced = false;
  const announce = (): void => {
    if (announced || serviceWorker.controller === null) return;
    announced = true;
    onUpdateReady();
  };
  const register = async (): Promise<void> => {
    try {
      const registration = await serviceWorker.register("/service-worker.js", {
        scope: "/",
        updateViaCache: "none"
      });
      if (registration.waiting?.state === "installed") announce();
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (worker === null) return;
        const inspect = (): void => {
          if (worker.state === "installed") announce();
        };
        worker.addEventListener("statechange", inspect);
        inspect();
      });
      await registration.update();
    } catch {
      // Offline use remains available even when registration or update checks fail.
    }
  };
  windowObject.addEventListener(
    GAME_STARTUP_READY_EVENT,
    () => { void register(); },
    { once: true }
  );
}
