export const FONT_READINESS_TIMEOUT_MS = 2_500;

interface FontLoader {
  load(descriptor: string): PromiseLike<unknown> | unknown;
}

export async function waitForFontReadiness(
  loader: FontLoader | undefined,
  descriptor: string,
  timeoutMs = FONT_READINESS_TIMEOUT_MS
): Promise<void> {
  if (!loader) return;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new Error("Font readiness timeout must be finite and non-negative");
  }

  await new Promise<void>((resolve) => {
    let finished = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      if (timeout !== undefined) clearTimeout(timeout);
      resolve();
    };

    timeout = setTimeout(finish, timeoutMs);
    try {
      Promise.resolve(loader.load(descriptor)).then(finish, finish);
    } catch {
      finish();
    }
  });
}
