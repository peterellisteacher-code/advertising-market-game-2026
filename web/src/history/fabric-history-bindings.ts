import { HistoryController } from "./history-controller";

interface HistoryPort<T> {
  serialize(): T;
  load(value: T): Promise<void>;
  subscribe(listener: () => void): () => void;
}
type LiveRegion = Pick<HTMLElement, "textContent">;
type Direction = "undo" | "redo";

const cloneSnapshot = <T>(value: T): T => structuredClone(value);

function snapshotHash(value: unknown): string {
  const hash = JSON.stringify(value);
  if (hash === undefined) throw new Error("History snapshot is not serialisable");
  return hash;
}

export class FabricHistoryBindings<T = Record<string, unknown>> {
  readonly #history: HistoryController<T>;
  readonly #unsubscribe: () => void;
  #currentHash: string;
  #loading = false;
  #queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly port: HistoryPort<T>,
    private readonly polite: LiveRegion,
    initial?: T
  ) {
    const first = initial === undefined ? this.port.serialize() : cloneSnapshot(initial);
    this.#history = new HistoryController(first, cloneSnapshot);
    this.#currentHash = snapshotHash(first);
    this.#unsubscribe = this.port.subscribe(() => {
      if (this.#loading) return;
      const next = this.port.serialize();
      const hash = snapshotHash(next);
      if (hash === this.#currentHash) return;
      this.#history.commit(next);
      this.#currentHash = hash;
    });
  }

  undo(): Promise<boolean> { return this.#enqueue("undo"); }
  redo(): Promise<boolean> { return this.#enqueue("redo"); }
  transaction(operation: () => Promise<void>): Promise<void> {
    const queued = this.#queue.then(() => this.#transact(operation));
    this.#queue = queued.then(() => undefined, () => undefined);
    return queued;
  }
  dispose(): void { this.#unsubscribe(); }

  #enqueue(direction: Direction): Promise<boolean> {
    const operation = this.#queue.then(() => this.#travel(direction));
    this.#queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async #travel(direction: Direction): Promise<boolean> {
    if (this.#loading) throw new Error("A history snapshot is already loading");
    const current = cloneSnapshot(this.port.serialize());
    const target = direction === "undo" ? this.#history.undo() : this.#history.redo();
    if (target === null) return false;
    this.#loading = true;
    try {
      await this.port.load(target);
      this.#currentHash = snapshotHash(this.port.serialize());
      this.polite.textContent = direction === "undo" ? "Undid last change" : "Redid last change";
      return true;
    } catch (error) {
      const restored = direction === "undo" ? this.#history.redo() : this.#history.undo();
      if (restored === null || snapshotHash(restored) !== snapshotHash(current)) {
        throw new AggregateError([error], "History rollback failed");
      }
      try {
        await this.port.load(current);
        this.#currentHash = snapshotHash(this.port.serialize());
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], "Canvas and history rollback failed");
      }
      throw error;
    } finally {
      this.#loading = false;
    }
  }

  async #transact(operation: () => Promise<void>): Promise<void> {
    if (this.#loading) throw new Error("A history snapshot is already loading");
    const initial = cloneSnapshot(this.port.serialize());
    const initialHash = snapshotHash(initial);
    this.#history.alignPresent(initial);
    this.#currentHash = initialHash;
    this.#loading = true;
    try {
      await operation();
      const next = cloneSnapshot(this.port.serialize());
      const nextHash = snapshotHash(next);
      if (nextHash !== initialHash) this.#history.commit(next);
      else this.#history.alignPresent(next);
      this.#currentHash = nextHash;
    } catch (error) {
      try {
        if (snapshotHash(this.port.serialize()) !== initialHash) {
          await this.port.load(initial);
        }
        this.#history.alignPresent(initial);
        this.#currentHash = snapshotHash(this.port.serialize());
      } catch (rollbackError) {
        this.#history.alignPresent(initial);
        this.#currentHash = initialHash;
        throw new AggregateError([error, rollbackError], "Composite history rollback failed");
      }
      throw error;
    } finally {
      this.#loading = false;
    }
  }
}
