export type AutosaveState<Result> =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "saved"; result: Result }
  | { phase: "error"; error: Error };

export interface SerializedAutosaveOptions<Result> {
  commit(operationId: string, version: number): Promise<Result | null>;
  createOperationId(): string;
  onCommitResult?(result: Result, version: number): void;
  onState(state: AutosaveState<Result>): void;
  delayMs?: number;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("Autosave failed");
}

export class SerializedAutosave<Result> {
  readonly #commit: SerializedAutosaveOptions<Result>["commit"];
  readonly #createOperationId: SerializedAutosaveOptions<Result>["createOperationId"];
  readonly #onCommitResult: SerializedAutosaveOptions<Result>["onCommitResult"];
  readonly #onState: SerializedAutosaveOptions<Result>["onState"];
  readonly #delayMs: number;
  #requestedVersion = 0;
  #queuedVersion = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #tail: Promise<void> = Promise.resolve();
  #disposed = false;
  #disposePromise: Promise<void> | null = null;

  constructor(options: SerializedAutosaveOptions<Result>) {
    if (!Number.isSafeInteger(options.delayMs ?? 300) || (options.delayMs ?? 300) < 0) {
      throw new Error("Autosave delay must be a non-negative safe integer");
    }
    this.#commit = options.commit;
    this.#createOperationId = options.createOperationId;
    this.#onCommitResult = options.onCommitResult;
    this.#onState = options.onState;
    this.#delayMs = options.delayMs ?? 300;
  }

  schedule(): void {
    if (this.#disposed) return;
    this.#requestedVersion += 1;
    this.#onState({ phase: "saving" });
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#queueLatest();
    }, this.#delayMs);
  }

  async flush(): Promise<void> {
    if (this.#disposePromise !== null) {
      await this.#disposePromise;
      return;
    }
    for (;;) {
      if (this.#timer !== null) {
        clearTimeout(this.#timer);
        this.#timer = null;
        this.#queueLatest();
      }
      const current = this.#tail;
      await current;
      if (current === this.#tail && this.#timer === null &&
        this.#queuedVersion >= this.#requestedVersion) {
        return;
      }
    }
  }

  dispose(): Promise<void> {
    if (this.#disposePromise !== null) return this.#disposePromise;
    this.#disposed = true;
    this.#disposePromise = this.#quiesce();
    return this.#disposePromise;
  }

  async #quiesce(): Promise<void> {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
      this.#queueLatest();
    }
    await this.#tail.catch(() => undefined);
  }

  #queueLatest(): void {
    const version = this.#requestedVersion;
    if (version <= this.#queuedVersion) return;
    this.#queuedVersion = version;
    const operationId = this.#createOperationId();
    this.#tail = this.#tail
      .catch(() => undefined)
      .then(async () => {
        const result = await this.#commit(operationId, version);
        if (this.#disposed) return;
        if (result !== null) this.#onCommitResult?.(result, version);
        if (version !== this.#requestedVersion) return;
        this.#onState(result === null
          ? { phase: "idle" }
          : { phase: "saved", result });
      })
      .catch((value: unknown) => {
        const error = asError(value);
        if (this.#disposed) return;
        if (version === this.#requestedVersion) this.#onState({ phase: "error", error });
        throw error;
      });
  }
}
