import type { Canvas, FabricObject } from "fabric";
import { Textbox } from "fabric";
import { describe, expect, it, vi } from "vitest";
import type { CanvasMutation, CanvasMutationListener } from "../fabric/canvas-port";
import { FabricCanvasAdapter } from "../fabric/fabric-canvas-adapter";
import { FabricHistoryBindings } from "./fabric-history-bindings";
import { HistoryController } from "./history-controller";

interface MixedObject {
  id: string;
  kind: string;
  [property: string]: unknown;
}

interface MixedState {
  objects: MixedObject[];
}

type MixedEdit = (state: MixedState) => void;

const byId = (state: MixedState, id: string): MixedObject => {
  const object = state.objects.find((candidate) => candidate.id === id);
  if (!object) throw new Error(`Missing ${id}`);
  return object;
};

const mixedActions: MixedEdit[] = [
  (state) => state.objects.push({ id: "text-1", kind: "text", value: "Fresh idea" }),
  (state) => { byId(state, "text-1").value = "A fresher idea"; },
  (state) => state.objects.push({ id: "photo-1", kind: "image", assetId: "photo" }),
  (state) => { byId(state, "photo-1").left = 320; },
  (state) => { byId(state, "photo-1").scaleX = 1.4; },
  (state) => { byId(state, "photo-1").angle = 17; },
  (state) => Object.assign(byId(state, "photo-1"), {
    cropX: 40,
    cropY: 20,
    visibleWidth: 420,
    visibleHeight: 300,
    focalX: 0.65,
    focalY: 0.4
  }),
  (state) => state.objects.push({ id: "drawing-1", kind: "drawing", stroke: "M 0 0 L 80 80" }),
  (state) => { state.objects.splice(state.objects.findIndex(({ id }) => id === "drawing-1"), 1); },
  (state) => { state.objects.reverse(); },
  (state) => state.objects.push({ ...byId(state, "photo-1"), id: "photo-copy" }),
  (state) => { state.objects.splice(state.objects.findIndex(({ id }) => id === "text-1"), 1); }
];

class HistoryHarnessPort {
  #state: MixedState = { objects: [] };
  readonly #listeners = new Set<CanvasMutationListener>();
  failNextLoad = false;

  perform(edit: MixedEdit, index: number): void {
    edit(this.#state);
    this.#emit({ type: "modified", objectId: `edit-${index}` });
  }

  serialize(): Record<string, unknown> {
    return structuredClone(this.#state) as unknown as Record<string, unknown>;
  }

  async load(value: Record<string, unknown>): Promise<void> {
    this.#state = structuredClone(value) as unknown as MixedState;
    // A defensive synthetic mutation proves bindings suppress snapshots while loading.
    this.#emit({ type: "modified", objectId: "load-probe" });
    if (this.failNextLoad) {
      this.failNextLoad = false;
      throw new Error("Synthetic load failure");
    }
  }

  subscribe(listener: CanvasMutationListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  hash(): string { return JSON.stringify(this.#state); }
  emitUnchanged(): void { this.#emit({ type: "modified", objectId: "no-op" }); }

  #emit(mutation: CanvasMutation): void {
    this.#listeners.forEach((listener) => listener(mutation));
  }
}

type AdapterEvent = { target?: FabricObject; path?: FabricObject; e?: Event };
type AdapterListener = (event: AdapterEvent) => void;

class TextMutationCanvas {
  readonly objects: FabricObject[] = [];
  readonly #listeners = new Map<string, Set<AdapterListener>>();

  on(event: string, listener: AdapterListener): () => void {
    const listeners = this.#listeners.get(event) ?? new Set<AdapterListener>();
    listeners.add(listener);
    this.#listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }

  fire(event: string, payload: AdapterEvent): void {
    this.#listeners.get(event)?.forEach((listener) => listener(payload));
  }

  getObjects(): FabricObject[] { return this.objects; }
  requestRenderAll(): void {}
}

describe("HistoryController", () => {
  it("keeps immutable snapshots and a fixed one-hundred-action limit", () => {
    const initial = { step: 0, nested: { value: "blank" } };
    const history = new HistoryController(initial, (value) => structuredClone(value));
    const first = { step: 1, nested: { value: "first" } };
    history.commit(first);
    initial.nested.value = "mutated initial";
    first.nested.value = "mutated next";

    const undone = history.undo();
    expect(undone).toEqual({ step: 0, nested: { value: "blank" } });
    if (!undone) throw new Error("Expected an undo snapshot");
    undone.nested.value = "mutated return value";
    expect(history.redo()).toEqual({ step: 1, nested: { value: "first" } });
    expect(history.undo()).toEqual({ step: 0, nested: { value: "blank" } });

    const bounded = new HistoryController({ step: 0 }, (value) => structuredClone(value));
    for (let step = 1; step <= 101; step += 1) bounded.commit({ step });
    const states: Array<{ step: number }> = [];
    for (;;) {
      const state = bounded.undo();
      if (state === null) break;
      states.push(state);
    }
    expect(states).toHaveLength(100);
    expect(states.at(-1)).toEqual({ step: 1 });

    const branched = new HistoryController({ step: 0 }, (value) => structuredClone(value));
    branched.commit({ step: 1 });
    branched.commit({ step: 2 });
    expect(branched.undo()).toEqual({ step: 1 });
    branched.commit({ step: 3 });
    expect(branched.redo()).toBeNull();
  });

  it("undoes and redoes twelve mixed edits in exact order", async () => {
    const port = new HistoryHarnessPort();
    const polite = document.createElement("p");
    const bindings = new FabricHistoryBindings(port, polite);
    const blankHash = port.hash();

    mixedActions.forEach((action, index) => port.perform(action, index));
    const completedHash = port.hash();
    for (let index = 0; index < mixedActions.length; index += 1) {
      expect(await bindings.undo()).toBe(true);
    }
    expect(port.hash()).toBe(blankHash);
    expect(polite.textContent).toBe("Undid last change.");

    for (let index = 0; index < mixedActions.length; index += 1) {
      expect(await bindings.redo()).toBe(true);
    }
    expect(port.hash()).toBe(completedHash);
    expect(polite.textContent).toBe("Redid last change.");
    expect(await bindings.redo()).toBe(false);
    bindings.dispose();
  });

  it("deduplicates unchanged snapshots and rolls back a failed async load", async () => {
    const port = new HistoryHarnessPort();
    const bindings = new FabricHistoryBindings(port, document.createElement("p"));
    port.emitUnchanged();
    expect(await bindings.undo()).toBe(false);

    port.perform(mixedActions[0]!, 0);
    const alignedHash = port.hash();
    port.failNextLoad = true;
    await expect(bindings.undo()).rejects.toThrow("Synthetic load failure");
    expect(port.hash()).toBe(alignedHash);

    port.perform(mixedActions[1]!, 1);
    expect(await bindings.undo()).toBe(true);
    expect(port.hash()).toBe(alignedHash);
    expect(await bindings.undo()).toBe(true);
    expect(port.hash()).toBe(JSON.stringify({ objects: [] }));
    bindings.dispose();
  });

  it("serializes rapid undo requests across asynchronous loads", async () => {
    const port = new HistoryHarnessPort();
    const bindings = new FabricHistoryBindings(port, document.createElement("p"));
    port.perform(mixedActions[0]!, 0);
    port.perform(mixedActions[1]!, 1);

    expect(await Promise.all([bindings.undo(), bindings.undo()])).toEqual([true, true]);
    expect(port.hash()).toBe(JSON.stringify({ objects: [] }));
    bindings.dispose();
  });

  it("commits an asynchronous composite edit as one history state", async () => {
    const port = new HistoryHarnessPort();
    const bindings = new FabricHistoryBindings(port, document.createElement("p"));
    const blankHash = port.hash();

    await bindings.transaction(async () => {
      port.perform(mixedActions[0]!, 0);
      await Promise.resolve();
      port.perform(mixedActions[1]!, 1);
    });
    const completedHash = port.hash();

    expect(await bindings.undo()).toBe(true);
    expect(port.hash()).toBe(blankHash);
    expect(await bindings.undo()).toBe(false);
    expect(await bindings.redo()).toBe(true);
    expect(port.hash()).toBe(completedHash);
    bindings.dispose();
  });

  it("restores both the port and history when an asynchronous composite edit fails", async () => {
    const port = new HistoryHarnessPort();
    const bindings = new FabricHistoryBindings(port, document.createElement("p"));
    const blankHash = port.hash();
    const failure = new Error("Synthetic composite failure");

    await expect(bindings.transaction(async () => {
      port.perform(mixedActions[0]!, 0);
      throw failure;
    })).rejects.toBe(failure);

    expect(port.hash()).toBe(blankHash);
    expect(await bindings.undo()).toBe(false);
    expect(await bindings.redo()).toBe(false);
    bindings.dispose();
  });

  it("emits exactly one observable mutation for a text edit", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      textBaseline: "alphabetic",
      measureText: (value: string) => ({ width: value.length * 16 })
    } as unknown as CanvasRenderingContext2D);
    const canvas = new TextMutationCanvas();
    const text = new Textbox("Fresh idea");
    text.objectId = "text-1";
    text.elementKind = "text";
    text.accessibleName = "Campaign headline";
    canvas.objects.push(text);
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));

    adapter.setText("text-1", "A fresher idea");

    expect(text.text).toBe("A fresher idea");
    expect(mutations).toEqual([{ type: "modified", objectId: "text-1" }]);
    expect(() => adapter.setText("text-1", "   ")).toThrow("empty");
    expect(mutations).toHaveLength(1);
  });

  it("coalesces an interactive text-editing session into one mutation", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      textBaseline: "alphabetic",
      measureText: (value: string) => ({ width: value.length * 16 })
    } as unknown as CanvasRenderingContext2D);
    const canvas = new TextMutationCanvas();
    const text = new Textbox("Fresh idea");
    text.objectId = "text-1";
    text.elementKind = "text";
    text.accessibleName = "Campaign headline";
    canvas.objects.push(text);
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));

    canvas.fire("text:editing:entered", { target: text });
    text.set("text", "A");
    canvas.fire("text:changed", { target: text });
    text.set("text", "A fresher idea");
    canvas.fire("text:changed", { target: text });
    canvas.fire("text:editing:exited", { target: text });
    expect(mutations).toEqual([{ type: "modified", objectId: "text-1" }]);

    canvas.fire("text:editing:entered", { target: text });
    canvas.fire("text:editing:exited", { target: text });
    expect(mutations).toHaveLength(1);
  });
});
