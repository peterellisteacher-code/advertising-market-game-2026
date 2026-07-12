import type { CanvasPort } from "../fabric/canvas-port";
import { HistoryController } from "./history-controller";

type HistoryPort = Pick<CanvasPort, "serialize" | "load" | "subscribe">;
type LiveRegion = Pick<HTMLElement, "textContent">;
type Direction = "undo" | "redo";

const cloneSnapshot = (value: Record<string, unknown>): Record<string, unknown> =>
  structuredClone(value);

function snapshotHash(value: Record<string, unknown>): string {
  const hash = JSON.stringify(value);
  if (hash === undefined) throw new Error("Canvas snapshot is not serialisable");
  return hash;
}

export class FabricHistoryBindings {
  readonly #history: HistoryController<Record<string, unknown>>;
  readonly #unsubscribe: () => void;
  #currentHash: string;
  #loading = false;
  #queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly port: HistoryPort,
    private readonly polite: LiveRegion
  ) {
    const initial = this.port.serialize();
    this.#history = new HistoryController(initial, cloneSnapshot);
    this.#currentHash = snapshotHash(initial);
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
}
