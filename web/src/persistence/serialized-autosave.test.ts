import { describe, expect, it, vi } from "vitest";
import { SerializedAutosave, type AutosaveState } from "./serialized-autosave";

describe("SerializedAutosave", () => {
  it("debounces changes and flushes the latest snapshot with one operation ID", async () => {
    vi.useFakeTimers();
    const commit = vi.fn(async (operationId: string, version: number) => ({ operationId, version }));
    const states: AutosaveState<{ operationId: string; version: number }>[] = [];
    let id = 0;
    const autosave = new SerializedAutosave({
      commit,
      createOperationId: () => `autosave-${++id}`,
      delayMs: 250,
      onState: (state) => states.push(state)
    });

    autosave.schedule();
    autosave.schedule();
    autosave.schedule();
    expect(commit).not.toHaveBeenCalled();

    await autosave.flush();

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("autosave-1", 3);
    expect(states.at(-1)).toEqual({
      phase: "saved",
      result: { operationId: "autosave-1", version: 3 }
    });
    vi.useRealTimers();
  });

  it("never overlaps commits and suppresses a stale Saved state", async () => {
    vi.useFakeTimers();
    const releases: Array<() => void> = [];
    let concurrent = 0;
    let peak = 0;
    const commit = vi.fn(async (_operationId: string, version: number) => {
      concurrent += 1;
      peak = Math.max(peak, concurrent);
      await new Promise<void>((resolve) => releases.push(resolve));
      concurrent -= 1;
      return { version };
    });
    const states: AutosaveState<{ version: number }>[] = [];
    const autosave = new SerializedAutosave<{ version: number }>({
      commit,
      createOperationId: (() => {
        let id = 0;
        return () => `autosave-${++id}`;
      })(),
      delayMs: 10,
      onState: (state) => states.push(state)
    });

    autosave.schedule();
    const firstFlush = autosave.flush();
    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    autosave.schedule();
    await vi.advanceTimersByTimeAsync(10);
    expect(commit).toHaveBeenCalledTimes(1);

    releases.shift()?.();
    await vi.waitFor(() => expect(commit).toHaveBeenCalledTimes(2));
    expect(states).not.toContainEqual({ phase: "saved", result: { version: 1 } });
    releases.shift()?.();
    await firstFlush;
    await autosave.flush();

    expect(peak).toBe(1);
    expect(states.at(-1)).toEqual({ phase: "saved", result: { version: 2 } });
    vi.useRealTimers();
  });

  it("adopts a stale successful result before committing the queued latest edit", async () => {
    let releaseFirst!: () => void;
    let firstStarted!: () => void;
    const started = new Promise<void>((resolve) => { firstStarted = resolve; });
    let durableRevision = 0;
    let editorRevision = 0;
    let calls = 0;
    const states: AutosaveState<{ revision: number }>[] = [];
    const autosave = new SerializedAutosave<{ revision: number }>({
      delayMs: 0,
      createOperationId: (() => {
        let id = 0;
        return () => `autosave-${++id}`;
      })(),
      commit: async () => {
        calls += 1;
        if (calls === 1) {
          firstStarted();
          await new Promise<void>((resolve) => { releaseFirst = resolve; });
        }
        if (editorRevision !== durableRevision) {
          throw new Error(`stale editor ${editorRevision}; durable ${durableRevision}`);
        }
        durableRevision += 1;
        return { revision: durableRevision };
      },
      onCommitResult: (result) => { editorRevision = result.revision; },
      onState: (state) => states.push(state)
    });

    autosave.schedule();
    const firstFlush = autosave.flush();
    await started;
    autosave.schedule();
    const secondFlush = autosave.flush();
    releaseFirst();
    await Promise.all([firstFlush, secondFlush]);

    expect(calls).toBe(2);
    expect(editorRevision).toBe(2);
    expect(durableRevision).toBe(2);
    expect(states).not.toContainEqual({ phase: "saved", result: { revision: 1 } });
    expect(states.at(-1)).toEqual({ phase: "saved", result: { revision: 2 } });
  });

  it("surfaces a failed flush but permits a later change to save", async () => {
    const failure = new Error("Synthetic storage failure");
    const commit = vi.fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ version: 2 });
    const states: AutosaveState<{ version: number }>[] = [];
    const autosave = new SerializedAutosave<{ version: number }>({
      commit,
      createOperationId: (() => {
        let id = 0;
        return () => `autosave-${++id}`;
      })(),
      delayMs: 0,
      onState: (state) => states.push(state)
    });

    autosave.schedule();
    await expect(autosave.flush()).rejects.toThrow("Synthetic storage failure");
    expect(states.at(-1)).toEqual({ phase: "error", error: failure });

    autosave.schedule();
    await autosave.flush();
    expect(commit).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toEqual({ phase: "saved", result: { version: 2 } });
  });

  it("lets an in-flight local commit finish while fencing stale callbacks after disposal", async () => {
    let release!: (result: { version: number }) => void;
    let started!: () => void;
    const commitStarted = new Promise<void>((resolve) => { started = resolve; });
    const commit = vi.fn(async () => {
      started();
      return new Promise<{ version: number }>((resolve) => { release = resolve; });
    });
    const states: AutosaveState<{ version: number }>[] = [];
    const onCommitResult = vi.fn();
    const autosave = new SerializedAutosave<{ version: number }>({
      commit,
      createOperationId: () => "account-a-autosave",
      delayMs: 0,
      onCommitResult,
      onState: (state) => states.push(state)
    });

    autosave.schedule();
    const flushing = autosave.flush();
    await commitStarted;
    const disposing = autosave.dispose();
    release({ version: 1 });
    await Promise.all([flushing, disposing]);

    expect(commit).toHaveBeenCalledOnce();
    expect(onCommitResult).not.toHaveBeenCalled();
    expect(states).not.toContainEqual({ phase: "saved", result: { version: 1 } });
    autosave.schedule();
    await autosave.flush();
    expect(commit).toHaveBeenCalledOnce();
  });

  it("best-effort flushes a pending local commit during disposal without publishing its result", async () => {
    vi.useFakeTimers();
    const commit = vi.fn(async () => ({ version: 1 }));
    const onCommitResult = vi.fn();
    const onState = vi.fn();
    const autosave = new SerializedAutosave<{ version: number }>({
      commit,
      createOperationId: () => "pending-account-a-autosave",
      delayMs: 60_000,
      onCommitResult,
      onState
    });
    autosave.schedule();

    await autosave.dispose();

    expect(commit).toHaveBeenCalledOnce();
    expect(onCommitResult).not.toHaveBeenCalled();
    expect(onState).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
