const HISTORY_LIMIT = 100;

export class HistoryController<T> {
  #past: T[] = [];
  #present: T;
  #future: T[] = [];

  constructor(initial: T, private readonly clone: (value: T) => T) {
    this.#present = this.clone(initial);
  }

  commit(next: T): void {
    const previousSnapshot = this.clone(this.#present);
    const nextSnapshot = this.clone(next);
    this.#past.push(previousSnapshot);
    if (this.#past.length > HISTORY_LIMIT) this.#past.shift();
    this.#present = nextSnapshot;
    this.#future = [];
  }

  alignPresent(next: T): void {
    this.#present = this.clone(next);
  }

  undo(): T | null {
    const previous = this.#past.at(-1);
    if (previous === undefined) return null;
    const nextPresent = this.clone(previous);
    const nextFuture = this.clone(this.#present);
    const result = this.clone(nextPresent);
    this.#past.pop();
    this.#future.unshift(nextFuture);
    this.#present = nextPresent;
    return result;
  }

  redo(): T | null {
    const next = this.#future[0];
    if (next === undefined) return null;
    const nextPresent = this.clone(next);
    const nextPast = this.clone(this.#present);
    const result = this.clone(nextPresent);
    this.#future.shift();
    this.#past.push(nextPast);
    if (this.#past.length > HISTORY_LIMIT) this.#past.shift();
    this.#present = nextPresent;
    return result;
  }
}
