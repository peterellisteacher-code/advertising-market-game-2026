# Studio Editor Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the student editor so it offers a varied twelve-product starting range, visibly connected product components, proportional browse/design resizing, visible undoable deletion, bounded section filling, and reliable logo insertion.

**Architecture:** The current Fabric canvas, command service, history transactions, semantic product shells, reviewed raster catalogue, product-kit compositor and logo model remain authoritative. A small starter manifest unifies three certified kits with nine reviewed single-piece products. An accessible split-pane controller replaces the floating binary drawer control. Contextual deletion routes through the existing command/history path. Section Fill adds a pure connected-region algorithm plus an explicit serialisable fill recipe for eligible raster objects; semantic SVG shells continue using their named-region controls. Logo work begins with a browser reproduction and fixes prerequisite disclosure before changing the already-tested add/replace callbacks.

**Tech Stack:** TypeScript 7, Fabric.js 7.4, Vitest 4/JSDOM, CSS Grid, Pointer Events, ResizeObserver, Canvas 2D, Python 3/Pillow catalogue tests.

**Approved specification:** `docs/superpowers/specs/2026-07-27-student-teacher-editor-completion-design.md`

**Dependencies:** This plan is locally independent of teacher/account work. It must finish before the final guidance copy and visual QA, because those surfaces name the final tools and layout.

## Global Constraints

- Keep the existing three certified kits and all current product pricing, placement, canvas persistence and Undo/Redo behaviour.
- Add exactly twelve visible starters across at least six categories, with no more than two starters in one category.
- New single-piece starters must reference existing reviewed generated assets; do not add unreviewed public stock.
- Socket certification requires visible rendered contact evidence, not transform arithmetic alone.
- Replace the floating `Hide library` control. Do not retain an always-on-top overlay button under a new name.
- Desktop split range is 25/75 through 75/25, default 40/60. Narrow layouts use explicit `Browse` and `Edit` tabs.
- The separator must support pointer drag, Arrow keys, Shift+Arrow, Home and End.
- Canvas coordinates and saved transforms must not change when the pane changes width.
- Selected-object deletion is visible, keyboard accessible and undoable. Structural/non-removable objects remain protected.
- Section Fill must fail closed when it cannot establish a bounded eligible region. It must never colour transparent background or cross protected linework.
- Fill previews are cancellable. Applied fills are one undo step and survive save/reload/export.
- Do not represent whole-object tinting as per-section filling.
- Logo insertion must remain semantic, editable, selected, undoable and serialisable.
- Native Windows Godot remains quarantined.
- Do not delete or move any file without Peter's explicit deletion approval and notification.

---

### Task 1: Define and load the twelve reviewed starter products

**Files:**
- Create: `catalog/generated/offline-core-v1/student-starters-v1.json`
- Create: `pipeline/asset_pipeline/starter_fill_certification.py`
- Create: `pipeline/tests/test_starter_fill_certification.py`
- Create: `scripts/verify_starter_fill_regions.py`
- Create: `web/src/product-kit/student-starter-catalogue.ts`
- Create: `web/src/product-kit/student-starter-catalogue.test.ts`
- Modify: `web/src/product-kit/product-kit-loader.ts`
- Modify: `web/src/product-kit/product-kit-loader.test.ts`
- Modify: `web/src/product-kit/product-kit-panel.ts`
- Modify: `web/src/product-kit/product-kit-panel.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `scripts/build-web.mjs`
- Modify: `scripts/build-web.test.mjs`
- Modify: `scripts/verify-web-export.mjs`

**Manifest contract:**

```ts
interface StudentStarterManifestV1 {
  readonly schema: "student-product-starters@1";
  readonly version: 1;
  readonly fillProfiles: {
    readonly "bounded-linework-v1": {
      readonly lineDarknessThreshold: number;
      readonly minimumAlpha: number;
      readonly colourDistance: number;
      readonly minimumRegionPixels: number;
      readonly maximumRegionFraction: number;
    };
    readonly "opaque-body-v1": {
      readonly minimumAlpha: number;
    };
  };
  readonly starters: readonly StudentStarterRecord[];
}

type StudentStarterRecord =
  | {
      readonly kind: "kit";
      readonly id: string;
      readonly title: string;
      readonly category: string;
      readonly kitId: string;
      readonly defaultComponentId: string;
    }
  | {
      readonly kind: "raster";
      readonly id: string;
      readonly title: string;
      readonly category: string;
      readonly assetId: string;
      readonly fillMode: "connected-sections" | "whole-object" | "none";
      readonly fillProfile: "bounded-linework-v1" | "opaque-body-v1" | "none";
    };
```

- [ ] **Step 1: Write the failing catalogue invariants**

Assert:

```ts
expect(catalogue.starters).toHaveLength(12);
expect(new Set(catalogue.starters.map(({ title }) => title)).size).toBe(12);
expect(new Set(catalogue.starters.map(({ category }) => category)).size)
  .toBeGreaterThanOrEqual(6);
for (const count of categoryCounts(catalogue.starters).values()) {
  expect(count).toBeLessThanOrEqual(2);
}
expect(catalogue.starters.filter(({ kind }) => kind === "kit")).toHaveLength(3);
expect(catalogue.starters.filter(({ kind }) => kind === "raster")).toHaveLength(9);
expect(
  catalogue.starters.filter(
    (starter) => starter.kind === "raster" && starter.fillMode === "connected-sections"
  ).length
).toBeGreaterThanOrEqual(4);
```

For every kit, resolve an existing kit and certified component. For every raster, resolve one exact reviewed offline record, a local same-origin asset, valid master hash, mask/body bounds and price record. Add synthetic Pillow fixtures proving the fill certifier rejects the exterior, respects opaque linework, identifies two bounded interior regions, distinguishes a one-body recolour and rejects a leaky/open outline. Add one repository integration test that loads the final starter manifest and all nine exact master files. Define the versioned `bounded-linework-v1` and `opaque-body-v1` thresholds once in the manifest contract and assert that Python certification and TypeScript runtime constants match them exactly. For every `connected-sections` starter, require at least two distinct bounded interior regions on the exact master image; for `whole-object`, require one opaque recolourable body; for `none`, require a recorded factual ineligibility reason. Reject `QA`, `example.invalid`, live-photo-only and fixture records.

- [ ] **Step 2: Run the catalogue tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/product-kit/student-starter-catalogue.test.ts web/src/product-kit/product-kit-loader.test.ts web/src/product-kit/product-kit-panel.test.ts
python -m pytest -q pipeline/tests/test_starter_fill_certification.py
```

- [ ] **Step 3: Select the nine single-piece records**

Choose from the current generated reviewed catalogue only. Record exactly two or fewer per category. The combined twelve must include practical, personal, technology, home, leisure and food/drink contexts. Certify at least four different raster starters for bounded connected-section filling. Do not add a record merely to reach twelve if its preview, mask, fill classification, pricing or licence/provenance record fails.

Run the exact master-image verifier after writing the manifest:

```powershell
python scripts/verify_starter_fill_regions.py --catalog catalog/generated/offline-core-v1/catalog.json --starters catalog/generated/offline-core-v1/student-starters-v1.json
```

Success output includes `STARTER_FILL_CERTIFICATION_OK`, the nine raster IDs and their measured bounded-region counts.

- [ ] **Step 4: Implement the loader and unified starter UI**

`ProductKitPanel` renders one `Start with` list from the manifest. Kit selection continues through the current compositor. Raster selection calls the existing `CataloguePlacementQueue`. Both paths use the same selected state, preview region, accessible name and placement completion message.

Expose:

```ts
interface StudentStarterActions {
  selectStarter(starter: StudentStarterRecord): Promise<void>;
  placeSelectedStarter(): Promise<void>;
}
```

Keep one starter selected initially but do not mutate the campaign until `Place product on ad` is activated.

- [ ] **Step 5: Bind the manifest into the exact build**

Copy and hash `student-starters-v1.json` in the bound artifact. The verifier must prove all twelve referenced asset files exist and match their catalogue hashes.

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/product-kit/student-starter-catalogue.test.ts web/src/product-kit/product-kit-loader.test.ts web/src/product-kit/product-kit-panel.test.ts web/src/main.test.ts
python -m pytest -q pipeline/tests/test_starter_fill_certification.py
python scripts/verify_starter_fill_regions.py --catalog catalog/generated/offline-core-v1/catalog.json --starters catalog/generated/offline-core-v1/student-starters-v1.json
node --test scripts/build-web.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add catalog/generated/offline-core-v1/student-starters-v1.json pipeline/asset_pipeline/starter_fill_certification.py pipeline/tests/test_starter_fill_certification.py scripts/verify_starter_fill_regions.py web/src/product-kit/student-starter-catalogue.ts web/src/product-kit/student-starter-catalogue.test.ts web/src/product-kit/product-kit-loader.ts web/src/product-kit/product-kit-loader.test.ts web/src/product-kit/product-kit-panel.ts web/src/product-kit/product-kit-panel.test.ts web/src/main.ts web/src/main.test.ts scripts/build-web.mjs scripts/build-web.test.mjs scripts/verify-web-export.mjs
git commit -m "feat(product): offer twelve reviewed starters"
```

### Task 2: Repair sockets using rendered contact evidence

**Files:**
- Create: `pipeline/product_kit/socket_contact.py`
- Create: `pipeline/tests/test_product_kit_socket_contact.py`
- Create: `scripts/verify_product_kit_sockets.py`
- Modify: `pipeline/tests/test_product_kit_pack.py`
- Modify: `catalog/generated/offline-core-v1/product-kit-v1.json`
- Modify: `web/src/product-kit/connector-transform.test.ts`
- Modify: `web/src/product-kit/product-kit-raster-matrix.test.ts`
- Modify: `docs/operations/product-kit-certification-fingerprint-v1.md`

**Rendered-contact result:**

```py
@dataclass(frozen=True)
class SocketContactResult:
    certification_id: str
    overlap_pixels: int
    gap_pixels: int
    maximum_gap_pixels: int
    detached_components: int
```

- [ ] **Step 1: Write the failing alpha-contact tests**

Use small synthetic RGBA fixtures to prove the verifier:

- detects direct base/component contact;
- accepts a bounded antialias gap no larger than two output pixels;
- rejects a floating handle;
- rejects component overlap that hides more than the allowed attachment band;
- evaluates both `front` and `rear` fragment layers after the actual transform;
- reports certification ID and measured residuals without changing assets.

- [ ] **Step 2: Run Python tests and verify RED**

```powershell
python -m pytest -q pipeline/tests/test_product_kit_socket_contact.py pipeline/tests/test_product_kit_pack.py
```

- [ ] **Step 3: Implement the renderer-independent verifier**

Load the exact master PNG frames, apply the current connector transform, scale them into the same certification canvas, inspect nontransparent alpha, and measure the nearest base/component boundary. Do not infer contact from connector points alone.

Command:

```powershell
python scripts/verify_product_kit_sockets.py --catalog catalog/generated/offline-core-v1/catalog.json --kit catalog/generated/offline-core-v1/product-kit-v1.json
```

Success output:

```text
PRODUCT_KIT_SOCKET_CONTACT_OK certifications=5 maximum_gap_pixels=2
```

- [ ] **Step 4: Run against the current pack and capture the expected failure**

The compact carry-case handle shown in Peter's screenshot must fail if the current metadata reproduces a visible gap. Record the measured certification IDs and gap only; do not alter assets until the failing evidence exists.

- [ ] **Step 5: Correct the smallest source metadata**

Adjust only the mount point, component point, reference scale, rotation or fragment layer required by the rendered evidence. Do not change product pricing, IDs, source hashes or unrelated kits. Recompute the existing certification fingerprints through the retained pipeline.

- [ ] **Step 6: Re-run Python and TypeScript contracts**

```powershell
python -m pytest -q pipeline/tests/test_product_kit_socket_contact.py pipeline/tests/test_product_kit_pack.py
python scripts/verify_product_kit_sockets.py --catalog catalog/generated/offline-core-v1/catalog.json --kit catalog/generated/offline-core-v1/product-kit-v1.json
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/product-kit/connector-transform.test.ts web/src/product-kit/product-kit-raster-matrix.test.ts web/src/product-kit/product-kit-catalogue.test.ts
```

Expected: all pass and the verifier reports all five certifications.

- [ ] **Step 7: Update certification documentation and commit**

Record the verifier command, maximum gap, pack hash and all five results.

```powershell
git add pipeline/product_kit/socket_contact.py pipeline/tests/test_product_kit_socket_contact.py scripts/verify_product_kit_sockets.py pipeline/tests/test_product_kit_pack.py catalog/generated/offline-core-v1/product-kit-v1.json web/src/product-kit/connector-transform.test.ts web/src/product-kit/product-kit-raster-matrix.test.ts docs/operations/product-kit-certification-fingerprint-v1.md
git commit -m "fix(product): align certified component sockets"
```

### Task 3: Replace the floating drawer control with an accessible split pane

**Files:**
- Create: `web/src/ui/studio-split-pane.ts`
- Create: `web/src/ui/studio-split-pane.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/ui/studio-tool-drawer.ts`
- Modify: `web/src/ui/studio-tool-drawer.test.ts`
- Modify: `web/src/styles/editor.css`
- Modify: `web/src/styles/editor-css.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`

**Interface:**

```ts
export interface StudioSplitPaneOptions {
  readonly root: HTMLElement;
  readonly browsePane: HTMLElement;
  readonly designPane: HTMLElement;
  readonly separator: HTMLElement;
  readonly narrowQuery?: MediaQueryList;
  readonly initialPercent?: number;
  readonly minimumPercent?: number;
  readonly maximumPercent?: number;
}

export class StudioSplitPane {
  setPercent(percent: number): void;
  getPercent(): number;
  selectNarrowPane(pane: "browse" | "edit"): void;
  destroy(): void;
}
```

- [ ] **Step 1: Write failing pointer and keyboard tests**

Assert:

- default is 40;
- set/clamp range is 25–75;
- pointer capture begins on primary-button pointerdown;
- pointermove uses workspace-relative position;
- pointerup and pointercancel release capture and listeners;
- ArrowLeft/Right change by 2;
- Shift+Arrow changes by 10;
- Home sets 25 and End sets 75;
- the separator exposes `role="separator"`, `aria-orientation="vertical"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, a label and visible focus;
- narrow mode removes the separator from the tab order and exposes `Browse`/`Edit` tabs with correct `aria-selected`;
- destroy removes every listener.

- [ ] **Step 2: Write failing layout tests**

Assert no `Hide library` button or absolute collapse control remains. Assert CSS uses:

```css
grid-template-columns:
  var(--studio-rail-width)
  minmax(0, var(--studio-browse-width))
  var(--studio-separator-width)
  minmax(0, 1fr);
```

and that pane widths derive from `--studio-browse-percent`. The canvas object state before and after resizing must serialize identically.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/ui/studio-split-pane.test.ts web/src/ui/editor-shell.test.ts web/src/ui/studio-tool-drawer.test.ts web/src/styles/editor-css.test.ts web/src/main.test.ts
```

- [ ] **Step 4: Implement the split pane**

Insert:

```html
<div
  class="creator__workspace-separator"
  role="separator"
  aria-label="Resize the library and design areas"
  aria-orientation="vertical"
  tabindex="0">
</div>
```

Add narrow `Browse` and `Edit` tabs above the panes. Retain the current tool rail and tool-tab controller; remove only binary drawer collapse state. Do not persist pane percentage into campaign data. Session-local UI preference may be retained in memory only.

- [ ] **Step 5: Stabilise canvas scaling**

Use one `ResizeObserver` on the design pane to update CSS display size and request a Fabric render. Do not change the 1600×900 logical canvas, saved object transforms, crop coordinates or export dimensions.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/ui/studio-split-pane.ts web/src/ui/studio-split-pane.test.ts web/src/ui/editor-shell.ts web/src/ui/editor-shell.test.ts web/src/ui/studio-tool-drawer.ts web/src/ui/studio-tool-drawer.test.ts web/src/styles/editor.css web/src/styles/editor-css.test.ts web/src/main.ts web/src/main.test.ts
git commit -m "feat(studio): add proportional browse and design panes"
```

### Task 4: Add a visible contextual delete action through existing history

**Files:**
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/ui/canvas-accessibility-controller.ts`
- Modify: `web/src/ui/canvas-accessibility-controller.test.ts`
- Modify: `web/src/fabric/object-command-service.ts`
- Modify: `web/src/fabric/object-command-service.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `web/src/styles/editor.css`

- [ ] **Step 1: Write failing user-visible tests**

Assert:

- no selection: `Delete selected item` is disabled and says `Select an item to delete`;
- one removable selection: button is enabled and names the selection in its accessible description;
- a protected structural object remains disabled with an exact reason;
- activation calls the same `ObjectCommandService.remove(id)` path as Layers/Delete key;
- one undo restores the item, transform, stack position, visibility, lock state and selection;
- redo removes it again;
- deletion updates the accessibility layer list and live region;
- keyboard activation works with Space and Enter.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/ui/editor-shell.test.ts web/src/ui/canvas-accessibility-controller.test.ts web/src/fabric/object-command-service.test.ts web/src/main.test.ts
```

- [ ] **Step 3: Implement one removal eligibility rule**

Add:

```ts
export interface CanvasRemovalState {
  readonly selectedId: string | null;
  readonly removable: boolean;
  readonly reason: string;
}
```

Derive this state from the same `CanvasObjectSummary` used by Layers and keyboard actions. Do not build a second selection model. Place `Delete selected item` in the canvas toolbar, not as an overlay covering the design.

- [ ] **Step 4: Route through one history transaction**

`BrowserCreatorHandler.deleteSelected()` flushes pending placements, checks the current summary, runs `ObjectCommandService.remove(id)` inside the existing Fabric history transaction, and refreshes selection, logo state, inspector and autosave.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/ui/editor-shell.ts web/src/ui/editor-shell.test.ts web/src/ui/canvas-accessibility-controller.ts web/src/ui/canvas-accessibility-controller.test.ts web/src/fabric/object-command-service.ts web/src/fabric/object-command-service.test.ts web/src/main.ts web/src/main.test.ts web/src/styles/editor.css
git commit -m "feat(canvas): expose undoable selected-item deletion"
```

### Task 5: Implement the pure bounded connected-region fill algorithm

**Files:**
- Create: `web/src/tools/connected-region-fill.ts`
- Create: `web/src/tools/connected-region-fill.test.ts`

**Interfaces:**

```ts
export interface PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface ConnectedRegionFillInput {
  readonly source: PixelBuffer;
  readonly seedX: number;
  readonly seedY: number;
  readonly colour: string;
  readonly colourDistance: number;
  readonly lineDarknessThreshold: number;
  readonly minimumAlpha: number;
  readonly maximumPixels: number;
}

export type ConnectedRegionFillResult =
  | {
      readonly status: "filled";
      readonly pixels: Uint32Array;
      readonly bounds: { x: number; y: number; width: number; height: number };
    }
  | {
      readonly status:
        | "transparent-seed"
        | "line-seed"
        | "unbounded-background"
        | "region-too-small"
        | "region-too-large";
    };
```

- [ ] **Step 1: Write exhaustive failing algorithm tests**

Use literal 8×8 and 16×16 buffers to cover:

- one closed white region bounded by black linework;
- two adjacent sections separated by a one-pixel antialiased boundary;
- transparent background;
- seed on linework;
- open outline leaking to image edge;
- a region touching transparent background;
- colour-distance tolerance;
- maximum-pixel ceiling;
- deterministic row-major pixel output;
- no mutation of the source buffer;
- invalid dimensions, byte length, coordinates, colour and thresholds.

- [ ] **Step 2: Run the pure tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/tools/connected-region-fill.test.ts
```

- [ ] **Step 3: Implement iterative flood fill**

Use a bounded queue, a visited bitset and four-way connectivity. A traversable pixel must:

- be sufficiently opaque;
- not satisfy the protected-line predicate;
- remain within colour distance of the seed; and
- not connect to transparent image edge/background.

Return pixel indices only. Do not allocate one object per pixel and do not recurse.

- [ ] **Step 4: Run tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add web/src/tools/connected-region-fill.ts web/src/tools/connected-region-fill.test.ts
git commit -m "feat(fill): detect bounded product sections"
```

### Task 6: Add serialisable Section Fill interaction and preview

**Files:**
- Create: `web/src/tools/section-fill-controller.ts`
- Create: `web/src/tools/section-fill-controller.test.ts`
- Modify: `web/src/fabric/canvas-port.ts`
- Modify: `web/src/fabric/fabric-custom-properties.ts`
- Modify: `web/src/fabric/fabric-custom-properties.test.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.test.ts`
- Modify: `web/src/catalogue/catalogue-runtime.ts`
- Modify: `web/src/catalogue/catalogue-runtime.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `web/src/styles/editor.css`

**Persistent recipe:**

```ts
export interface RasterSectionFillRecipe {
  readonly schema: "raster-section-fill";
  readonly version: 1;
  readonly fillProfile: "bounded-linework-v1" | "opaque-body-v1";
  readonly sourceAssetId: string;
  readonly sourceSha256: string;
  readonly seedX: number;
  readonly seedY: number;
  readonly colour: string;
  readonly colourDistance: number;
}
```

- [ ] **Step 1: Write failing eligibility and interaction tests**

Assert:

- semantic SVG shell selection continues to show named region controls;
- a reviewed raster with source hash/mask data shows `Fill section`;
- an explicitly simple single-region raster shows `Fill object`;
- text, logo, price, drawing, group and unknown raster selections explain why Fill is unavailable;
- `Fill section` enters a crosshair selection mode and announces the instruction;
- canvas click maps through the object's inverse transform to source pixels;
- valid preview changes only the bounded region;
- Cancel restores byte-exact prior rendering;
- Apply records one recipe in one history transaction;
- undo/redo, save/load, duplicate and clean PNG export preserve expected results;
- source-hash mismatch on reload fails closed and leaves the original image unchanged;
- a failed region shows a factual reason and does not mutate history.

- [ ] **Step 2: Run adapter/controller tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/tools/section-fill-controller.test.ts web/src/fabric/fabric-custom-properties.test.ts web/src/fabric/fabric-canvas-adapter.test.ts web/src/catalogue/catalogue-runtime.test.ts web/src/ui/editor-shell.test.ts web/src/main.test.ts
```

- [ ] **Step 3: Extend the canvas port**

Add:

```ts
interface FillableRasterSnapshot {
  readonly id: string;
  readonly assetId: string;
  readonly sourceSha256: string;
  readonly width: number;
  readonly height: number;
  readonly sectionMode: "connected" | "whole-object";
}

interface NewRasterInput {
  readonly id: string;
  readonly assetId: string;
  readonly sameOriginUrl: string;
  readonly accessibleName: string;
  readonly sectionFill?: {
    readonly sourceSha256: string;
    readonly mode: "connected-sections" | "whole-object";
    readonly profile: "bounded-linework-v1" | "opaque-body-v1";
  };
}

interface CanvasPort {
  getFillableRaster(id: string): Promise<FillableRasterSnapshot | null>;
  previewRasterSectionFill(id: string, recipe: RasterSectionFillRecipe): Promise<void>;
  cancelRasterSectionFillPreview(id: string): void;
  applyRasterSectionFill(id: string, recipe: RasterSectionFillRecipe): Promise<void>;
}
```

`CataloguePlacementQueue` attaches `sectionFill` only after resolving the starter manifest against the exact reviewed same-origin catalogue record and hash. Generated AI images, remote/Openverse images and unclassified catalogue records remain ineligible. Persist an immutable ordered recipe list on eligible Fabric image objects. Reconstruct from the original owned/local source, never from the already-filled preview, so undo/load is deterministic.

- [ ] **Step 4: Implement the controller and UI**

Place `Fill section`, colour input, `Apply fill`, and `Cancel` in the selected-element controls. While fill selection is active, Escape cancels and returns focus to `Fill section`. Disable other mutating canvas commands only for the short preview interval.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 6: Run serialization/export regressions**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/fabric/fabric-canvas-adapter.test.ts web/src/history/history-controller.test.ts web/src/domain/campaign-document.test.ts web/src/export/campaign-exporter.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/tools/section-fill-controller.ts web/src/tools/section-fill-controller.test.ts web/src/fabric/canvas-port.ts web/src/fabric/fabric-custom-properties.ts web/src/fabric/fabric-custom-properties.test.ts web/src/fabric/fabric-canvas-adapter.ts web/src/fabric/fabric-canvas-adapter.test.ts web/src/catalogue/catalogue-runtime.ts web/src/catalogue/catalogue-runtime.test.ts web/src/ui/editor-shell.ts web/src/ui/editor-shell.test.ts web/src/main.ts web/src/main.test.ts web/src/styles/editor.css
git commit -m "feat(fill): colour eligible product sections"
```

### Task 7: Reproduce and repair Logo Lab prerequisite disclosure

**Files:**
- Modify: `web/src/logo-lab/logo-lab-panel.ts`
- Modify: `web/src/logo-lab/logo-lab-panel.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `web/src/styles/editor.css`

**Falsifier:** If a current browser reproduction with valid nonblank words and a selected symbol calls `addLogoMark`, inserts and selects one mark, the callback-defect hypothesis is dead; fix only prerequisite disclosure and layout.

- [ ] **Step 1: Add the failing prerequisite tests**

Test four states:

```text
missing words and symbol
missing words only
missing symbol only
complete draft
```

For incomplete states, the primary action remains activatable as a validation action or is accompanied by an explicit visible unmet-condition control. Activating it focuses and scrolls the first missing field. For the complete state, assert one add call, pending duplicate suppression, selected mark, success status, undo, save/load and keyboard activation.

- [ ] **Step 2: Run Logo Lab tests and capture RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/logo-lab/logo-lab-panel.test.ts web/src/main.test.ts
```

- [ ] **Step 3: Perform the current browser reproduction before changing callbacks**

On an unprotected current QA surface:

1. open Logo;
2. leave both prerequisites empty and activate `Add logo`;
3. record focus and visible error;
4. enter words only and repeat;
5. select a symbol and activate;
6. inspect canvas selection, history and console.

Record the result in the implementation commit message notes. Do not treat Peter's screenshot alone as proof of a callback failure.

- [ ] **Step 4: Implement prerequisite disclosure**

Add:

```ts
type LogoDraftRequirement = "words" | "symbol";

function missingLogoRequirements(draft: LogoDraftInput): readonly LogoDraftRequirement[];
```

Render `Add words` and/or `Choose a symbol` beside the action. On activation, set the live error, reveal the relevant chooser if collapsed, `scrollIntoView({ block: "nearest" })`, and focus the first missing control. Keep the existing semantic add/replace implementation if the browser falsifies a callback defect.

- [ ] **Step 5: Fix a callback only if reproduced**

If valid insertion fails, add one failing integration test that captures the exact break, make the smallest wiring change in `web/src/main.ts`, and preserve the `LogoLabPanel -> ObjectCommandService -> FabricCanvasAdapter` path.

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/logo-lab/logo-lab-panel.test.ts web/src/fabric/logo-mark-factory.test.ts web/src/fabric/fabric-canvas-adapter.test.ts web/src/main.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/logo-lab/logo-lab-panel.ts web/src/logo-lab/logo-lab-panel.test.ts web/src/main.ts web/src/main.test.ts web/src/styles/editor.css
git commit -m "fix(logo): explain and focus missing requirements"
```

### Task 8: Run the integrated editor contract once

**Files:**
- Modify only if a focused integration test reveals a substantiated defect.

- [ ] **Step 1: Run the editor-focused TypeScript group**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/product-kit web/src/product-builder web/src/catalogue web/src/fabric web/src/tools web/src/ui web/src/logo-lab web/src/history
```

Expected: PASS.

- [ ] **Step 2: Run the catalogue pipeline group**

```powershell
python -m pytest -q pipeline/tests/test_product_kit_schema.py pipeline/tests/test_product_kit_pack.py pipeline/tests/test_product_kit_socket_contact.py pipeline/tests/test_raster_catalog.py
```

Expected: PASS.

- [ ] **Step 3: Run build contracts**

```powershell
node --test scripts/build-web.test.mjs scripts/build-logo-icons.test.mjs
```

- [ ] **Step 4: Check the integrated diff**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and only explained worktree files.

## Plan Completion Gate

- [ ] Exactly twelve reviewed starters render and place successfully.
- [ ] All five certified socket pairs meet the rendered contact threshold.
- [ ] The floating `Hide library` control is gone.
- [ ] Desktop pane resizing and narrow Browse/Edit tabs work by pointer and keyboard.
- [ ] Canvas coordinates remain unchanged by layout resizing.
- [ ] A visible selected-item delete action uses existing undo/redo history.
- [ ] Section Fill affects only eligible bounded regions and survives persistence/export.
- [ ] Logo prerequisites are explicit, focusable and a valid logo inserts once.
- [ ] Focused TypeScript, Python and build-contract groups pass.
