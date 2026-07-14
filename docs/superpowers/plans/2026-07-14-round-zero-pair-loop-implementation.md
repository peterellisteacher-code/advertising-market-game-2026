# Round Zero Pair Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the tested pair-game kernel into a genuinely playable browser Round 0: choose an audience signal, see complementary pair roles, hand off the computer, add words/assets, move or resize canvas objects, and undo or redo.

**Architecture:** Add one Fabric-free `PairGameController` that renders the existing immutable game kernel through semantic DOM controls and a narrow `RoundZeroPort`. `BrowserCreatorHandler` implements that port, creates per-open Fabric history only after document load, and keeps the controller isolated from Fabric classes. Pair progress remains in memory by `sessionId` until Godot becomes the durable game-state owner; campaign brief and canvas edits remain in the existing document/history paths.

**Tech Stack:** TypeScript 7.0.2, Vite 8.1.4, Fabric.js 7.4.0, Vitest 4.1.10, Testing Library DOM, semantic HTML/CSS, existing Godot 4.7 same-page Web shell.

## Global Constraints

- Work only inside `Codex Advertising Market Game`; do not modify Claude-owned work or unrelated untracked files.
- Do not launch `godot_current.exe` or `godot_current_console.exe` during the native-run quarantine.
- Preserve the same-page creator seam, `1600×900` campaign canvas, Fabric-free domain/UI boundaries and existing local-asset rules.
- Student-facing copy must exclude the case-insensitive whole words `assignment`, `unit` and `task`.
- Round 0 exposes only search, add, move, resize, text and undo/redo; crop, drawing, recolour, layers, AIDA evidence, price and market preview remain later tested slices.
- Use real `<button>`, `<select>` and `<input>` controls, 44px primary targets, visible focus, two live regions and reduced-motion-safe styling.
- Do not invoke deletion-producing cleanup. Do not stage the unrelated edit-mode specification or existing untracked paths in this slice.
- Use direct bundled Node commands because `pnpm` is unavailable in this session.

---

### Task 1: Audience selection and pair-game controller

**Files:**
- Modify: `web/src/game/pair-session.ts`
- Modify: `web/src/game/pair-session.test.ts`
- Modify: `web/src/game/student-copy.ts`
- Modify: `web/src/game/student-copy.test.ts`
- Create: `web/src/game/pair-game-controller.ts`
- Create: `web/src/game/pair-game-controller.test.ts`

**Interfaces:**
- Consumes: `PairSession`, `PairRoleProgress`, `AUDIENCE_BRIEFS`, `STUDENT_COPY`, `CampaignDocumentV1` and a narrow semantic `PairGameView`.
- Produces: `selectAudienceBrief(session, audienceBriefId)`, `RoundZeroPort`, `PairGameView`, and `PairGameController.open(document)`, `.close()` and `.dispose()`.

- [ ] **Step 1: Write the failing audience-selection test**

Add a test proving that selection trims a non-blank ID, preserves the role/phase/handoff/time fields, returns a new object and rejects blank IDs:

```ts
const source = createPairSession({
  sessionId: "session-1",
  audienceBriefId: "careful-spenders",
  startedAt
});
expect(selectAudienceBrief(source, " weekend-neighbours ")).toEqual({
  ...source,
  audienceBriefId: "weekend-neighbours"
});
expect(source.audienceBriefId).toBe("careful-spenders");
expect(() => selectAudienceBrief(source, " ")).toThrow(
  "audienceBriefId must be non-blank"
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run web/src/game/pair-session.test.ts
```

Expected: FAIL because `selectAudienceBrief` is not exported.

- [ ] **Step 3: Implement the immutable selector**

Add:

```ts
export function selectAudienceBrief(
  session: PairSession,
  audienceBriefId: string
): PairSession {
  return {
    ...session,
    audienceBriefId: nonBlankId(audienceBriefId, "audienceBriefId")
  };
}
```

- [ ] **Step 4: Extend the tested student-copy contract**

Add the pair-status, audience-detail and validation strings used by the controller to `STUDENT_COPY`, then extend the recursive banned-word test so every new value is covered. The controller must not own untested student-facing copy.

- [ ] **Step 5: Write the failing controller tests**

Define a real fake port, not a mocked controller:

```ts
class RoundZeroHarness implements RoundZeroPort {
  document: CampaignDocumentV1;
  readonly addedText: string[] = [];
  readonly briefIds: string[] = [];
  undoCount = 0;
  redoCount = 0;
  #listener: (() => void) | null = null;

  constructor(document: CampaignDocumentV1) { this.document = structuredClone(document); }
  async setAudienceBrief(brief: AudienceBrief): Promise<CampaignDocumentV1> {
    this.briefIds.push(brief.id);
    this.document.brief = {
      targetAudienceId: brief.id,
      contextId: brief.id,
      purpose: "persuade",
      audienceNeeds: [brief.need],
      audienceValues: [...brief.values],
      intendedEffects: [brief.intendedEffect],
      techniques: []
    };
    return structuredClone(this.document);
  }
  async addText(value: string): Promise<void> { this.addedText.push(value); this.#listener?.(); }
  async undo(): Promise<boolean> { this.undoCount += 1; return true; }
  async redo(): Promise<boolean> { this.redoCount += 1; return true; }
  subscribeCanvasMutations(listener: () => void): () => void {
    this.#listener = listener;
    return () => { if (this.#listener === listener) this.#listener = null; };
  }
  emitCanvasMutation(): void { this.#listener?.(); }
}
```

Tests must prove:

```ts
await controller.open(blankDocument);
expect(port.briefIds).toEqual([AUDIENCE_BRIEFS[0].id]);
expect(getByRole(root, "heading", { name: "Art Director" })).toBeTruthy();
expect(getByRole<HTMLSelectElement>(root, "combobox", { name: "Audience signal" }).options)
  .toHaveLength(AUDIENCE_BRIEFS.length);

fireEvent.input(getByRole(root, "textbox", { name: "Canvas words" }), {
  target: { value: "Make room for adventure" }
});
fireEvent.click(getByRole(root, "button", { name: "Add words" }));
await vi.waitFor(() => expect(port.addedText).toEqual(["Make room for adventure"]));
expect(root.textContent).toContain("1 visible change");

fireEvent.click(getByRole(root, "button", { name: "Swap roles" }));
expect(getByRole(root, "heading", { name: "Strategist" })).toBeTruthy();
port.emitCanvasMutation();
expect(root.textContent).toContain("Both roles have made a change");

controller.close();
await controller.open(port.document);
expect(getByRole(root, "heading", { name: "Strategist" })).toBeTruthy();
expect(root.textContent).toContain("Both roles have made a change");
```

Also verify an audience change updates the port and visible context/need/values/effect, blank text produces an assertive message without calling the port, and `dispose()` removes listeners.

- [ ] **Step 6: Run controller tests and verify RED**

Run:

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run web/src/game/pair-session.test.ts web/src/game/pair-game-controller.test.ts
```

Expected: pair selector and copy tests pass; controller test fails because the controller module does not exist.

- [ ] **Step 7: Implement `PairGameController` minimally**

Use these public contracts:

```ts
export interface PairGameView {
  activeRole: HTMLElement;
  activeRoleAction: HTMLElement;
  partnerRoleAction: HTMLElement;
  roundProgress: HTMLElement;
  swapRoles: HTMLButtonElement;
  audienceSignal: HTMLSelectElement;
  audienceContext: HTMLElement;
  audienceNeed: HTMLElement;
  audienceValues: HTMLElement;
  audienceEffect: HTMLElement;
  canvasWords: HTMLInputElement;
  addWords: HTMLButtonElement;
  undo: HTMLButtonElement;
  redo: HTMLButtonElement;
  polite: HTMLElement;
  assertive: HTMLElement;
}

export interface RoundZeroPort {
  setAudienceBrief(brief: AudienceBrief): Promise<CampaignDocumentV1>;
  addText(value: string): Promise<void>;
  undo(): Promise<boolean>;
  redo(): Promise<boolean>;
  subscribeCanvasMutations(listener: () => void): () => void;
}

export class PairGameController {
  constructor(
    private readonly view: PairGameView,
    private readonly port: RoundZeroPort,
    private readonly now: () => Date = () => new Date()
  ) {}
  async open(document: CampaignDocumentV1): Promise<void>;
  close(): void;
  dispose(): void;
}
```

The test fixture builds `PairGameView` directly, so this task has no compile-time dependency on the not-yet-extended `EditorShell`. Store `{ session, progress }` by `sessionId`. Resolve a valid stored `targetAudienceId`, otherwise choose `AUDIENCE_BRIEFS[0]` and persist it before rendering. Subscribe only after the canvas has loaded. Record one productive action for the currently active role for each canvas mutation. Render from `STUDENT_COPY`, use `textContent` for all brief data, serialize button operations so a rapid double-click cannot interleave, and route errors to `view.assertive`.

- [ ] **Step 8: Verify GREEN and commit the pure controller slice**

Run the focused command from Step 5 and TypeScript:

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
```

Expected: all focused tests pass and TypeScript exits 0.

Commit only the six Task 1 files:

```powershell
git add web/src/game/pair-session.ts web/src/game/pair-session.test.ts web/src/game/student-copy.ts web/src/game/student-copy.test.ts web/src/game/pair-game-controller.ts web/src/game/pair-game-controller.test.ts
git commit -m "feat: add pair Round Zero controller"
```

---

### Task 2: Semantic Round 0 shell and visual hierarchy

**Files:**
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/styles/editor.css`

**Interfaces:**
- Consumes: the controller's `PairGameView` structural contract.
- Produces: semantic pair status, audience signal, brief details and quick text controls without changing the canvas or asset-library regions.

- [ ] **Step 1: Extend the shell test first**

Assert the following real controls and returned references:

```ts
expect(getByRole(root, "region", { name: "Pair play" })).toBeTruthy();
expect(getByRole(root, "status", { name: "Round progress" })).toBeTruthy();
expect(getByRole(root, "button", { name: "Swap roles" })).toBeTruthy();
expect(getByRole(root, "combobox", { name: "Audience signal" })).toBeTruthy();
expect(getByRole(root, "region", { name: "Audience brief" })).toBeTruthy();
expect(getByRole(root, "region", { name: "Round 0 tools" })).toBeTruthy();
expect(getByRole(root, "textbox", { name: "Canvas words" })).toBeTruthy();
expect(getByRole(root, "button", { name: "Add words" })).toBeTruthy();
expect(shell.undo.dataset.command).toBe("undo");
expect(shell.redo.dataset.command).toBe("redo");
```

- [ ] **Step 2: Run the shell test and verify RED**

Run:

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run web/src/ui/editor-shell.test.ts
```

Expected: FAIL because the pair and quick-tool regions are absent.

- [ ] **Step 3: Add exact semantic markup and references**

Add a full-width `.creator__pair-strip` between the top bar and checklist tabs. It contains a phase/status cell, an `<h2 data-active-role>`, two role-action paragraphs, the swap button, a labelled empty audience `<select>` and an audience `<article>` populated by the controller. Add `.creator__quick-tools` before asset search with a labelled text input and **Add words** button. Return each node in `EditorShell`, including typed `undo` and `redo` buttons.

- [ ] **Step 4: Add compact classroom-safe styling**

Change the main grid to three automatic header rows plus the working row. Give the pair strip a high-contrast light surface, clear role badge, responsive columns, no animation dependency and wrapping at narrow widths. Keep the canvas the dominant centre area and preserve the existing 44px/focus/reduced-motion rules.

- [ ] **Step 5: Verify GREEN and commit the shell slice**

Run the shell and controller tests plus TypeScript. Expected: pass with no banned student-facing words.

```powershell
git add web/src/ui/editor-shell.ts web/src/ui/editor-shell.test.ts web/src/styles/editor.css
git commit -m "feat: add semantic Round Zero HUD"
```

---

### Task 3: Wire real text, history, brief persistence and lifecycle

**Files:**
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`

**Interfaces:**
- Consumes: `PairGameController`, `RoundZeroPort`, `ObjectCommandService`, `FabricHistoryBindings` and the loaded `FabricCanvasAdapter`.
- Produces: a one-open-document history boundary, working Add words/Undo/Redo buttons, persisted brief metadata and canvas-mutation pair progress.

- [ ] **Step 1: Extend the main harness before production code**

The mocked adapter must implement real test state transitions:

```ts
const runtime = {
  listeners: new Set<(mutation: { type: "added" | "modified" | "removed"; objectId: string }) => void>()
};

async addText(input: { id: string; value: string; accessibleName: string }): Promise<void> {
  currentObjects().push({
    type: "textbox",
    objectId: input.id,
    elementKind: "text",
    accessibleName: input.accessibleName,
    text: input.value
  });
  runtime.listeners.forEach((listener) => listener({ type: "added", objectId: input.id }));
}
subscribe(listener: (mutation: { type: "added" | "modified" | "removed"; objectId: string }) => void): () => void {
  runtime.listeners.add(listener);
  return () => runtime.listeners.delete(listener);
}
```

Clear `runtime.listeners` in `beforeEach`. Add an integration test that opens a blank document, observes the first audience brief in `getState`, adds words through the DOM, verifies a semantic text object and Art Director progress, swaps roles, invokes undo and redo, and verifies state removal/restoration plus the polite announcements. Update the existing blank-document expectation to assert the intentional default-brief delta while preserving all unrelated state assertions.

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run web/src/main.test.ts
```

Expected: FAIL because `BrowserCreatorHandler` does not implement `RoundZeroPort` and no controller is attached.

- [ ] **Step 3: Add one history lifecycle per loaded document**

Add `#history: FabricHistoryBindings | null`. After `adapter.load()` succeeds, dispose the previous binding and create `new FabricHistoryBindings(adapter, shell.polite)`. Dispose it before adapter/canvas disposal on close. Expose:

```ts
async undo(): Promise<boolean> {
  if (!this.#history) throw new Error("Campaign creator is not open");
  return this.#history.undo();
}

async redo(): Promise<boolean> {
  if (!this.#history) throw new Error("Campaign creator is not open");
  return this.#history.redo();
}
```

- [ ] **Step 4: Implement the remaining `RoundZeroPort` methods**

`addText` flushes placements, constructs `ObjectCommandService` over the loaded adapter and calls `addText(value)`. `subscribeCanvasMutations` adapts the existing mutation listener to `() => void`. `setAudienceBrief` snapshots current canvas state and persists:

```ts
brief: {
  targetAudienceId: brief.id,
  contextId: brief.id,
  purpose: "persuade",
  audienceNeeds: [brief.need],
  audienceValues: [...brief.values],
  intendedEffects: [brief.intendedEffect],
  techniques: [...current.brief.techniques]
}
```

Parse the result through `CampaignDocumentSchema` and return a structured clone.

- [ ] **Step 5: Attach and sequence the controller**

Create `PairGameController(shell, handler)` after the handler, attach it once, await `controller.open(document)` only after the runtime load/document commit and before focusing the canvas, and call `controller.close()` before history/adapter disposal. A failed controller open must run the same rollback path as a failed canvas open. `dispose()` is reserved for whole-page teardown and is not called on ordinary close, so in-memory role progress survives reopen.

- [ ] **Step 6: Verify the complete slice**

Run:

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run web/src/game web/src/ui/editor-shell.test.ts web/src/main.test.ts
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run
git diff --check
```

Expected: focused tests, TypeScript and the full suite pass; diff check reports no errors.

- [ ] **Step 7: Commit only the integration files**

```powershell
git add web/src/main.ts web/src/main.test.ts
git commit -m "feat: wire playable Round Zero pair loop"
```

---

### Task 4: Real-browser Round 0 regression

**Files:**
- Create: `web/tests/manual/round-zero-pair-loop.html`
- Create: `web/tests/manual/round-zero-pair-loop.ts`
- Modify: `.superpowers/sdd/progress.md` (ignored working ledger only)

**Interfaces:**
- Consumes: the production bundle and public creator bridge.
- Produces: deterministic DOM/browser evidence for cold open, brief, both roles, text add, drag/resize, undo/redo and clean close.

- [ ] **Step 1: Write a diagnostic that fails until every checkpoint runs**

Use production `main.ts`, a blank offline campaign and visible status rows. The diagnostic exposes only these final checkpoint IDs:

```ts
const checkpointIds = [
  "open",
  "brief",
  "art-director",
  "text-add",
  "pointer-move",
  "pointer-resize",
  "undo-redo",
  "role-swap",
  "strategist-action",
  "close"
] as const;
```

It fails if any checkpoint is not `pass`, any console warning/error occurs, a banned student-facing whole word appears, or the creator opens an iframe/second application.

- [ ] **Step 2: Run the diagnostic in the in-app Chromium browser**

Use the existing Vite server or start it on `127.0.0.1:4173`; do not launch native Godot. Drive the actual pointer controls for move and resize. Run at 1366×768 and 1920×1080. Expected: every checkpoint passes at both sizes, focus is visible, no control is clipped, and console/network logs are clean.

- [ ] **Step 3: Run build verification**

Run studio build and existing non-destructive Web assembly/verification with direct Node binaries. Do not clean `build/web`.

- [ ] **Step 4: Commit evidence and update the working ledger**

```powershell
git add web/tests/manual/round-zero-pair-loop.html web/tests/manual/round-zero-pair-loop.ts
git commit -m "test: prove playable Round Zero pair loop"
```

Record exact test counts, browser sizes and checkpoint results in `.superpowers/sdd/progress.md`. Do not claim the later AIDA/price/preview levels, live market, networking or Godot game-state ownership are complete.
