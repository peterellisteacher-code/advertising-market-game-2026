import { fireEvent, getByLabelText, getByRole, queryByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import type { StudioCoachRuntimeState } from "./studio-coach-runtime";
import { StudioCoachPanel, type StudioCoachPanelActions } from "./studio-coach-panel";

function readyState(): StudioCoachRuntimeState {
  return {
    phase: "ready",
    attemptsUsed: 0,
    pendingCheck: null,
    changedSinceFirst: false,
    first: null,
    final: null,
    error: ""
  };
}

function actions(initial = readyState()): StudioCoachPanelActions & {
  update(next: StudioCoachRuntimeState): void;
} {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    state: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    requestInitial: vi.fn().mockResolvedValue(undefined),
    requestRevision: vi.fn().mockResolvedValue(undefined),
    update(next) {
      current = next;
      listeners.forEach((listener) => listener());
    }
  };
}

describe("StudioCoachPanel", () => {
  it("starts with one small action and the local technique reference", () => {
    const host = document.createElement("div");
    const port = actions();
    new StudioCoachPanel(host, port);

    expect(host.textContent).toContain("Two checks for this ad");
    expect(host.textContent).toContain("Check 1 gives one design change");
    expect(getByRole(host, "button", { name: "Check this technique (1 of 2)" })).toBeTruthy();
    expect(getByRole(host, "button", { name: "Check the whole ad (1 of 2)" })).toBeTruthy();
    expect(getByLabelText(host, "Technique to check")).toBeTruthy();
    expect(host.textContent).toContain("Salience makes one element");
    expect(host.textContent).not.toMatch(/assignment|unit/i);
  });

  it("changes the visible reference and sends the selected technique", () => {
    const host = document.createElement("div");
    const port = actions();
    new StudioCoachPanel(host, port);
    fireEvent.change(getByLabelText(host, "Technique to check"), {
      target: { value: "leading-lines" }
    });

    expect(host.textContent).toContain("guide the viewer's eye");
    fireEvent.click(getByRole(host, "button", { name: "Check this technique (1 of 2)" }));
    expect(port.requestInitial).toHaveBeenCalledWith("technique", "leading-lines");
  });

  it("keeps first advice visible and enables only the one final comparison after a change", () => {
    const host = document.createElement("div");
    const port = actions();
    new StudioCoachPanel(host, port);
    port.update({
      phase: "advice",
      attemptsUsed: 1,
      pendingCheck: null,
      changedSinceFirst: false,
      first: {
        turn: 1,
        mode: "technique",
        observation: "The diagonal line points away from the product.",
        effect: "The eye leaves the main reading path.",
        nextMove: "Angle the existing line towards the product.",
        selfCheck: "Does your eye land on the product first?",
        evidenceRefs: ["product"],
        certainty: "clear"
      },
      final: null,
      error: ""
    });

    expect(host.textContent).toContain("Angle the existing line towards the product");
    expect(host.textContent).toContain("One design change to try");
    const revision = getByRole<HTMLButtonElement>(host, "button", { name: "Check my revision (2 of 2)" });
    expect(revision.disabled).toBe(true);

    port.update({ ...port.state(), changedSinceFirst: true });
    const enabled = getByRole<HTMLButtonElement>(host, "button", { name: "Check my revision (2 of 2)" });
    expect(enabled.disabled).toBe(false);
    fireEvent.click(enabled);
    expect(port.requestRevision).toHaveBeenCalledOnce();
  });

  it("ends after the final verdict without opening another advice cycle", () => {
    const host = document.createElement("div");
    const port = actions({
      phase: "complete",
      attemptsUsed: 2,
      pendingCheck: null,
      changedSinceFirst: true,
      first: null,
      final: {
        turn: 2,
        mode: "revision",
        verdict: "clearer",
        whatChanged: "The line now points towards the product.",
        why: "The product is now on the strongest reading path.",
        evidenceRefs: ["product"],
        certainty: "clear"
      },
      error: ""
    });
    new StudioCoachPanel(host, port);

    expect(host.textContent).toContain("Coach session complete");
    expect(host.textContent).toContain("Clearer");
    expect(queryByRole(host, "button", { name: /check/i })).toBeNull();
  });

  it("does not leak a rejected action promise after the runtime records the error", async () => {
    const host = document.createElement("div");
    const port = actions();
    vi.mocked(port.requestInitial).mockRejectedValueOnce(new Error("recorded by runtime"));
    new StudioCoachPanel(host, port);

    fireEvent.click(getByRole(host, "button", { name: "Check the whole ad (1 of 2)" }));
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));

    expect(port.requestInitial).toHaveBeenCalledOnce();
  });

  it("offers one explicit resume action for an interrupted final check", () => {
    const host = document.createElement("div");
    const port = actions({
      phase: "error",
      attemptsUsed: 2,
      pendingCheck: "revision",
      changedSinceFirst: true,
      first: {
        turn: 1,
        mode: "technique",
        observation: "The diagonal line points away from the product.",
        effect: "The eye leaves the main reading path.",
        nextMove: "Angle the existing line towards the product.",
        selfCheck: "Does your eye land on the product first?",
        evidenceRefs: ["product"],
        certainty: "clear"
      },
      final: null,
      error: "The final check was interrupted."
    });
    new StudioCoachPanel(host, port);

    expect(host.textContent).toContain("does not use another turn");
    fireEvent.click(getByRole(host, "button", { name: "Resume final check" }));
    expect(port.requestRevision).toHaveBeenCalledOnce();
  });
});
