# Compact Canvas Command Dock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized floating advertisement toolbar with a compact bottom command dock that never obscures the Item list in student or teacher-playtest Studio routes.

**Architecture:** Keep the existing command elements and controller APIs intact. Convert their container from a multi-row CSS grid to a content-width flex dock, visually hide only the redundant status prose, and drive the dock plus Item-list clearance from shared workspace CSS variables. Add a teacher-route top offset so the separate playtest strip and Item list do not collide.

**Tech Stack:** TypeScript, DOM APIs, CSS, Vitest, Testing Library, Vite, Godot 4 web export, Netlify, GitHub Actions.

## Global Constraints

- Preserve every existing editor command and document mutation.
- Preserve status announcements, accessible names, descriptions, disabled states, focus indicators, and keyboard behaviour.
- Keep the teacher-playtest strip separate and usable.
- Desktop/laptop only; verify 1280×800 and 1440×900. Do not add phone layouts, phone breakpoints, or touch-specific behaviour.
- Do not change Godot scenes/scripts, Supabase objects, or Netlify Functions for this UI-only change.
- Never stage `godot/project.godot`, the six `godot/assets/agency/salience/*.png.import` files, existing QA images, `.claude/`, `.playwright-cli/`, `.playwright-mcp/`, `release-evidence/`, or the untracked 2026-08-09 handover.

---

### Task 1: Preserve semantics while removing visible status rows

**Files:**
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/ui/editor-shell.ts`

**Interfaces:**
- Consumes: `createEditorShell(root: HTMLElement): EditorShell`
- Produces: unchanged `saveStatus`, `zoomStatus`, `deleteStatus`, and command-button handles; each status node gains the established `sr-only` class.

- [ ] **Step 1: Write the failing semantic-layout test**

In the existing canvas-first Studio test, assert the seven visible command labels in DOM order and require all three explanatory status nodes to be non-visual announcements:

```ts
expect(
  [...sizeControls.querySelectorAll<HTMLButtonElement>("button")]
    .map((button) => button.textContent?.trim())
).toEqual([
  "Undo",
  "Redo",
  "−",
  "Fill ad",
  "+",
  "Items",
  "Delete selected item"
]);
expect(shell.saveStatus.classList.contains("sr-only")).toBe(true);
expect(shell.zoomStatus.classList.contains("sr-only")).toBe(true);
expect(shell.deleteStatus.classList.contains("sr-only")).toBe(true);
```

This test catches a regression that restores explanatory rows or removes/reorders a command.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
corepack pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/ui/editor-shell.test.ts
```

Expected: FAIL because the three status nodes do not yet have `sr-only`.

- [ ] **Step 3: Make the three status nodes non-visual**

In `createEditorShell`, preserve every role, ID and data attribute while adding `sr-only`:

```html
<span class="creator__save-status sr-only" role="status" aria-label="Saved progress" data-save-status></span>
<span class="sr-only" role="status" data-canvas-zoom-status>Select a product or image</span>
<span class="sr-only" id="canvas-delete-status" data-canvas-delete-status>Select an item to delete</span>
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Step 2 command. Expected: PASS with no warnings or errors.

- [ ] **Step 5: Commit the semantic change**

```powershell
git add -- web/src/ui/editor-shell.test.ts web/src/ui/editor-shell.ts
git diff --cached --check
git diff --cached --name-status
git commit -m "fix(studio): reduce canvas toolbar to commands"
```

---

### Task 2: Dock commands in one row and reserve matching Item-list clearance

**Files:**
- Modify: `web/src/styles/editor-css.test.ts`
- Modify: `web/src/styles/editor.css`

**Interfaces:**
- Consumes: `.creator__workspace`, `.creator__canvas`, `.creator__canvas-size`, and `.creator__layers`.
- Produces: inherited CSS variables `--canvas-command-dock-bottom`, `--canvas-command-dock-height`, and `--canvas-command-dock-clearance` shared by the dock, canvas padding, and Item list.

- [ ] **Step 1: Replace the obsolete overlap assertion with a failing dock contract**

Replace the old `bottom: 6.5rem` assertion in `editor-css.test.ts` with:

```ts
it("docks canvas commands in one compact row and keeps the Item list above it", () => {
  expect(css).toMatch(
    /\.creator__workspace\s*\{[^}]*--canvas-command-dock-bottom:\s*12px[^}]*--canvas-command-dock-height:\s*48px[^}]*--canvas-command-dock-clearance:\s*calc\(var\(--canvas-command-dock-bottom\)\s*\+\s*var\(--canvas-command-dock-height\)\s*\+\s*12px\)[^}]*\}/i
  );
  expect(css).toMatch(
    /\.creator__canvas-size\s*\{[^}]*left:\s*50%[^}]*bottom:\s*var\(--canvas-command-dock-bottom\)[^}]*display:\s*flex[^}]*flex-wrap:\s*nowrap[^}]*transform:\s*translateX\(-50%\)[^}]*\}/i
  );
  expect(css).not.toMatch(
    /\.creator__canvas-size\s*\{[^}]*grid-template-areas/i
  );
  expect(css).toMatch(
    /\.creator__canvas-size\s+button\s*\{[^}]*width:\s*max-content[^}]*flex:\s*0\s+0\s+auto[^}]*white-space:\s*nowrap[^}]*\}/i
  );
  expect(css).toMatch(
    /\.creator__layers\s*\{[^}]*bottom:\s*var\(--canvas-command-dock-clearance\)[^}]*max-height:\s*calc\(100%\s*-\s*var\(--canvas-command-dock-clearance\)\s*-\s*16px\)[^}]*overflow:\s*auto[^}]*\}/i
  );
});
```

This catches the production regressions that caused the screenshots: a multi-row toolbar, stretched buttons, or independent panel clearance.

- [ ] **Step 2: Run the style test and verify RED**

Run:

```powershell
corepack pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/styles/editor-css.test.ts
```

Expected: FAIL because the shared variables and flex dock do not exist.

- [ ] **Step 3: Add shared sizing variables and reserve canvas space**

Extend `.creator__workspace` with:

```css
--canvas-command-dock-bottom: 12px;
--canvas-command-dock-height: 48px;
--canvas-command-dock-clearance: calc(var(--canvas-command-dock-bottom) + var(--canvas-command-dock-height) + 12px);
```

Change the canvas padding to:

```css
padding: 16px 16px var(--canvas-command-dock-clearance);
```

- [ ] **Step 4: Replace the grid card with a single-row content-width dock**

Use this layout contract and retain the existing colour, border and shadow identity:

```css
.creator__canvas-size {
  position: absolute;
  left: 50%;
  bottom: var(--canvas-command-dock-bottom);
  z-index: 11;
  min-height: var(--canvas-command-dock-height);
  max-width: calc(100% - 24px);
  padding: 5px;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid #9db4bd;
  border-radius: 10px;
  background: rgb(255 250 242 / .96);
  box-shadow: 0 6px 18px rgb(23 32 51 / .2);
  transform: translateX(-50%);
}
.creator__canvas-size button {
  width: max-content;
  min-width: 0;
  min-height: 38px;
  padding: 0 .7rem;
  flex: 0 0 auto;
  border: 1px solid #7295a1;
  border-radius: 7px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-weight: 900;
  white-space: nowrap;
}
.creator__canvas-size button:disabled {
  border-color: #9db4bd;
  background: #eef2f3;
  color: #52627a;
  cursor: not-allowed;
  opacity: 1;
}
```

Delete only the obsolete `grid-area` declarations and visible status-row layout declarations from this selector block. Do not remove DOM status nodes or command-state logic.

- [ ] **Step 5: Bind the Item list to the shared clearance**

Replace its independent values with:

```css
bottom: var(--canvas-command-dock-clearance);
max-height: calc(100% - var(--canvas-command-dock-clearance) - 16px);
```

- [ ] **Step 6: Run the focused style and shell tests and verify GREEN**

```powershell
corepack pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/styles/editor-css.test.ts web/src/ui/editor-shell.test.ts
```

Expected: both files PASS.

- [ ] **Step 7: Commit the dock layout**

```powershell
git add -- web/src/styles/editor-css.test.ts web/src/styles/editor.css
git diff --cached --check
git diff --cached --name-status
git commit -m "fix(studio): dock canvas commands below the ad"
```

---

### Task 3: Keep the Item list clear of teacher-playtest controls

**Files:**
- Modify: `web/src/teacher/teacher-playtest-controller.test.ts`
- Modify: `web/src/teacher/teacher.css`

**Interfaces:**
- Consumes: route marker `[data-admarket-route="teacher-playtest"]`, `.teacher-playtest-strip[data-expanded]`, and `.creator__layers`.
- Produces: route-scoped Item-list top offsets for collapsed and expanded teacher controls; no controller API change.

- [ ] **Step 1: Write the failing rendered-style assertions**

In the existing fixed-strip style test, append this fixture to `#creator-root`
before mounting the controller:

```ts
const workspace = document.createElement("section");
workspace.className = "creator__workspace";
const layers = document.createElement("aside");
layers.className = "creator__layers";
workspace.append(layers);
creatorRoot.append(workspace);
```

After `mount()`, assert:

```ts
const layers = creatorRoot.querySelector<HTMLElement>(".creator__layers")!;
expect(getComputedStyle(layers).top).toBe("84px");
fireEvent.click(getByRole(root, "button", { name: "Show teacher controls" }));
expect(getComputedStyle(layers).top).toBe("160px");
```

This catches teacher chrome covering the Item-list heading and first controls.

- [ ] **Step 2: Run the teacher test and verify RED**

```powershell
corepack pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/teacher/teacher-playtest-controller.test.ts
```

Expected: FAIL because the Item list still uses its default `top: 16px`.

- [ ] **Step 3: Add route-scoped clearance**

Add to `teacher.css`:

```css
body:has([data-admarket-route="teacher-playtest"]) .creator__layers {
  top: 84px;
}

body:has(.teacher-playtest-strip[data-expanded="true"]) .creator__layers {
  top: 160px;
}
```

- [ ] **Step 4: Run the teacher test and verify GREEN**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the teacher-route collision fix**

```powershell
git add -- web/src/teacher/teacher-playtest-controller.test.ts web/src/teacher/teacher.css
git diff --cached --check
git diff --cached --name-status
git commit -m "fix(teacher): keep item list below playtest controls"
```

---

### Task 4: Verify the integrated release candidate

**Files:**
- No production file changes expected.
- Store screenshots outside committed source unless Peter explicitly asks otherwise.

**Interfaces:**
- Consumes: built Studio and teacher-playtest route.
- Produces: focused-test, full-suite, build, console, interaction and screenshot evidence.

- [ ] **Step 1: Run focused tests**

```powershell
corepack pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/ui/editor-shell.test.ts web/src/styles/editor-css.test.ts web/src/teacher/teacher-playtest-controller.test.ts
```

- [ ] **Step 2: Run the full local gates once on unchanged integrated inputs**

```powershell
corepack pnpm run test:godot
corepack pnpm exec tsc --noEmit
corepack pnpm run test:build-web
corepack pnpm test
corepack pnpm run build:web
```

All commands must exit 0. Native Godot remains quarantined; the repository script owns the web-safe Godot test/export path.

- [ ] **Step 3: Run browser QA at both required desktop viewports**

The flow under test is: teacher playtest → enter Studio → place/select an item → use the bottom dock → open Items → verify the complete panel remains reachable → delete the selected item.

At 1280×800 and 1440×900, verify page identity, meaningful DOM, no framework overlay, relevant console errors/warnings absent, one-row dock geometry, content-width buttons, non-overlap in collapsed and expanded teacher-control states, keyboard focus, and actual Undo/Redo/Items/Delete state changes. Capture screenshots outside the repository.

- [ ] **Step 4: Review the stable release-candidate diff once**

Use a fresh isolated code reviewer with the approved design, exact diff, test evidence and no preferred verdict. Resolve any actionable finding proportionately, then rerun only affected focused checks followed by the full gate if integrated inputs changed.

---

### Task 5: Publish, merge and deploy the exact artifact

**Files:**
- No source changes expected after the reviewed release candidate.

**Interfaces:**
- Consumes: reviewed branch HEAD and green local gates.
- Produces: pushed branch, green Linux CI, merged PR, exact main artifact, Netlify production deployment and hosted QA evidence.

- [ ] **Step 1: Prove only intended changes are committed**

```powershell
git status --short --branch
git log --oneline origin/main..HEAD
git diff --name-status origin/main...HEAD
corepack pnpm run verify:repo-sync
```

The task-owned diff may contain only the design/plan documents, the six web source/test files named above, and any proportionate review fix. Protected dirty paths remain unstaged and are reported separately.

- [ ] **Step 2: Push and wait for Linux CI**

Push `codex/compact-canvas-toolbar-20260811`, open a ready PR against the
canonical repository `peterellisteacher-code/advertising-market-game-2026`,
and wait until required GitHub Actions checks pass:

```powershell
git push -u origin codex/compact-canvas-toolbar-20260811
$prUrl = gh pr create --repo peterellisteacher-code/advertising-market-game-2026 --base main --head codex/compact-canvas-toolbar-20260811 --title "Fix Studio canvas command dock" --body "Compacts the Studio canvas controls into one bottom dock, keeps status announcements accessible, and prevents the Item list from colliding with the dock or teacher-playtest controls. Verified by focused tests, full local gates, and desktop browser QA at 1280x800 and 1440x900. Protected local Godot metadata and QA artefacts were excluded."
$prNumber = gh pr view --repo peterellisteacher-code/advertising-market-game-2026 --json number --jq .number
gh pr checks --repo peterellisteacher-code/advertising-market-game-2026 --watch $prNumber
```

Record `$prUrl` and `$prNumber` for the release evidence.

- [ ] **Step 3: QA the exact CI draft artifact**

Download the exact successful CI artifact, verify its digest/manifest, deploy that artifact to a Netlify draft, and repeat the 1280×800 teacher-playtest flow with console and screenshot evidence.

- [ ] **Step 4: Merge and deploy the exact main artifact**

Merge the ready PR with the repository's permitted merge method, wait for main
CI, download and verify the exact main artifact, deploy it to Netlify
production, and record the merge SHA, workflow/run result, artifact ID/hash,
and Netlify deploy ID:

```powershell
gh pr merge --repo peterellisteacher-code/advertising-market-game-2026 --merge $prNumber
gh run list --repo peterellisteacher-code/advertising-market-game-2026 --branch main --limit 10
```

Use the returned identifiers with the repository's existing artifact download
and `deploy:production` workflow; do not rebuild a substitute production
artifact locally.

- [ ] **Step 5: Run production QA and reconcile refs**

Repeat the target interaction on production at 1280×800 and a 1440×900 visual pass. Then run:

```powershell
git fetch origin --prune
git merge --ff-only origin/main
git push origin codex/compact-canvas-toolbar-20260811
corepack pnpm run verify:repo-sync --expect-local-head
git status --short --branch
```

Confirm there are no unpushed task-owned commits. Report the pre-existing protected local modifications and untracked QA artefacts without deleting or staging them.
