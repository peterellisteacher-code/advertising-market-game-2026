# Editable Logo Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a same-page Logo Lab that creates, remixes, saves and reloads editable fictional marks from four recipes and the reviewed 4,205-icon Tabler catalogue.

**Architecture:** A pure deterministic design kernel owns recipes and remix state. A Fabric factory converts that state plus one reviewed icon into a semantic `Group`; the adapter owns add/replace/list operations while the panel owns keyboard-accessible controls. The existing build assembler copies and verifies the ignored generated catalogue into the Godot Web export without pruning files.

**Tech Stack:** TypeScript 7, Fabric.js 7.4.0, Vitest 4, Vite 8, Node test runner, Godot 4.7 same-page Web shell.

## Global Constraints

- Preserve the approved `docs/superpowers/specs/2026-07-10-advertising-creator-foundation-design.md` Logo Lab contract.
- Recipes are exactly `icon-wordmark`, `badge-seal`, `monogram` and `mascot-emblem`.
- Use only `/catalog/generated/logo-icons-v1-reviewed/catalog.json`; reject remote, branded and active SVG content.
- A mark remains a semantic editable Fabric group after save/reload; it is never flattened until campaign publication.
- Remix actions are deterministic for the same design, catalogue and seed.
- Student-facing copy must not contain the whole words `assignment`, `unit` or `task`.
- Every control is a native keyboard-reachable element with a 44px minimum target and visible focus.
- The creator stays same-page with no iframe, popup, Canva session or second application.
- Build assembly remains non-destructive and never prunes `build/web`.
- Do not launch native Godot; verify through TypeScript, static contracts and the existing Web shell.

---

### Task 1: Deterministic editable logo design kernel

**Files:**
- Create: `web/src/logo-lab/logo-mark-model.ts`
- Create: `web/src/logo-lab/logo-mark-model.test.ts`

**Interfaces:**
- Consumes: reviewed `LogoIconRecord` IDs and category-filtered candidate IDs.
- Produces: `LogoRecipeId`, `LogoMarkDesign`, `createLogoMarkDesign`, `remixLogoSymbol`, `remixLogoType`, `remixLogoColours`, `surpriseLogoMark`.

- [ ] **Step 1: Write failing deterministic recipe tests**

```ts
expect(LOGO_RECIPES.map(({ id }) => id)).toEqual([
  "icon-wordmark", "badge-seal", "monogram", "mascot-emblem"
]);
const first = surpriseLogoMark(base, ["paw", "rocket", "leaf"], 41);
const second = surpriseLogoMark(base, ["paw", "rocket", "leaf"], 41);
expect(second).toStrictEqual(first);
expect(remixLogoColours(base, 9)).toMatchObject({ revision: base.revision + 1 });
expect(base).toStrictEqual(originalBase);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
& $node node_modules\vitest\vitest.mjs run web/src/logo-lab/logo-mark-model.test.ts
```

Expected: FAIL because `logo-mark-model.ts` does not exist.

- [ ] **Step 3: Implement immutable recipe state and seeded remixes**

```ts
export type LogoRecipeId = "icon-wordmark" | "badge-seal" | "monogram" | "mascot-emblem";
export interface LogoMarkDesign {
  readonly recipe: LogoRecipeId;
  readonly text: string;
  readonly iconId: string;
  readonly primary: string;
  readonly secondary: string;
  readonly typeface: "Arial" | "Georgia" | "Trebuchet MS" | "Verdana";
  readonly seed: number;
  readonly revision: number;
}
export const LOGO_RECIPES = Object.freeze([
  { id: "icon-wordmark", label: "Icon + Wordmark" },
  { id: "badge-seal", label: "Badge / Seal" },
  { id: "monogram", label: "Monogram" },
  { id: "mascot-emblem", label: "Mascot / Emblem" }
] as const);
```

Use an unsigned 32-bit xorshift step to select an icon, typeface and one of twelve fixed two-colour palettes. Validate non-blank text/icon IDs, six-digit hex colours, safe typefaces and integer seeds. Freeze every returned design and increment `revision` once per remix.

- [ ] **Step 4: Run focused tests and commit**

Expected: all logo-model tests pass and input objects remain unchanged.

```powershell
git add web/src/logo-lab/logo-mark-model.ts web/src/logo-lab/logo-mark-model.test.ts
git commit -m "feat: add deterministic Logo Lab recipes"
```

---

### Task 2: Semantic Fabric logo groups

**Files:**
- Create: `web/src/fabric/logo-mark-factory.ts`
- Create: `web/src/fabric/logo-mark-factory.test.ts`
- Modify: `web/src/domain/editor-object.ts`
- Modify: `web/src/domain/campaign-document.test.ts`
- Modify: `web/src/fabric/fabric-custom-properties.ts`
- Modify: `web/src/fabric/fabric-custom-properties.test.ts`
- Modify: `web/src/fabric/canvas-port.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.test.ts`
- Modify: `web/src/fabric/object-command-service.ts`
- Modify: `web/src/fabric/object-command-service.test.ts`

**Interfaces:**
- Consumes: `LogoMarkDesign` and one parsed `LogoIconRecord`.
- Produces: `NewLogoMarkInput`, `LogoMarkSnapshot`, `FabricLogoMarkFactory.create`, `CanvasPort.addLogoMark`, `replaceLogoMark`, `listLogoMarks`, and `ObjectCommandService.addLogoMark` / `replaceLogoMark`.

- [ ] **Step 1: Write failing schema, factory and adapter tests**

```ts
const group = await factory.create({ id: "logo-1", design, icon });
expect(group).toMatchObject({
  objectId: "logo-1",
  elementKind: "logo-mark",
  logoRecipe: "icon-wordmark",
  logoIconId: "paw",
  logoText: "NOVA"
});
expect(group.getObjects().map((child) => child.logoLayer)).toEqual([
  "container", "symbol", "wordmark"
]);
canvas.addLogoMark({ id: "logo-1", design, icon });
expect(canvas.serialize().objects[0]).toMatchObject({
  type: "Group", elementKind: "logo-mark", logoRecipe: "icon-wordmark"
});
await restored.load(canvas.serialize());
expect(restored.listLogoMarks()).toStrictEqual([{ id: "logo-1", design }]);
```

- [ ] **Step 2: Run focused tests and verify RED**

Expected: FAIL on the unsupported `logo-mark` kind and missing port methods.

- [ ] **Step 3: Add the semantic contract and custom properties**

Append `"logo-mark"` to `ELEMENT_KINDS`. Register these nested-safe custom properties on `FabricObject` and `SerializedObjectProps`:

```ts
logoRecipe?: LogoRecipeId;
logoSeed?: number;
logoRevision?: number;
logoIconId?: string;
logoText?: string;
logoPrimary?: string;
logoSecondary?: string;
logoTypeface?: string;
logoLayer?: "container" | "symbol" | "wordmark";
```

- [ ] **Step 4: Build a real Fabric group from trusted inline SVG**

Use the pinned Fabric 7 APIs confirmed in current documentation:

```ts
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width} ${icon.height}">${icon.body.replaceAll("currentColor", design.primary)}</svg>`;
const parsed = await loadSVGFromString(svg);
const symbol = util.groupSVGElements(parsed.objects.filter(Boolean) as FabricObject[], parsed.options);
const mark = new Group([container, symbol, wordmark], { interactive: false });
```

Create recipe-specific geometry with ordinary `Rect`, `Circle`, `Textbox` and parsed vector children. Configure root origin, centre placement, 44px controls and stable semantic metadata. Child layers retain `logoLayer` and ordinary `shape`/`text` kinds.

- [ ] **Step 5: Add/replace/list through the adapter**

`replaceLogoMark` builds the replacement first, copies transform/visibility/lock state, removes the old group, inserts the replacement at the same stack index, selects it and emits one logical `modified` mutation. `listLogoMarks` validates root metadata and returns immutable snapshots. Reject non-Group roots, duplicate IDs and icon/design mismatches.

- [ ] **Step 6: Run focused/full tests and commit**

```powershell
git add web/src/domain web/src/fabric
git commit -m "feat: add editable Fabric logo marks"
```

---

### Task 3: Keyboard-accessible Logo Lab panel

**Files:**
- Create: `web/src/logo-lab/logo-lab-panel.ts`
- Create: `web/src/logo-lab/logo-lab-panel.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/styles/editor.css`
- Modify: `web/src/styles/editor-css.test.ts`

**Interfaces:**
- Consumes: `LogoIconCatalogue`, design-kernel functions, and callbacks `add(design, icon)` / `replace(id, design, icon)`.
- Produces: `LogoLabPanel.render`, `setMarks`, `unavailable`, `dispose` and one `EditorShell.logoLabPanel` region.

- [ ] **Step 1: Write failing DOM interaction tests**

Test all four recipe radio buttons, wordmark input, category/search filtering, no more than 40 icon buttons, colour inputs, Add logo, Surprise me, Remix symbol, Remix type, Remix colours and an existing-mark chooser. Assert native labels, 44px targets, status announcements and absence of banned whole words.

- [ ] **Step 2: Run panel/shell tests and verify RED**

Expected: FAIL because the panel region and controller do not exist.

- [ ] **Step 3: Add the panel region and render controls**

Insert one collapsible region after Round 0 tools:

```html
<section class="creator__logo-lab" role="region" aria-label="Logo Lab">
  <h2>Logo Lab</h2>
  <div data-logo-lab-panel><p role="status">Logo maker loading</p></div>
</section>
```

The panel renders only filtered results, uses `aria-pressed` for the selected icon, keeps action buttons disabled until a valid design exists, and announces each add/remix through the supplied live region.

- [ ] **Step 4: Add bounded responsive styles**

Use the existing paper/ink/blue tokens. Cap the panel at `min(34vh, 22rem)`, use a two-column icon grid, keep the canvas dominant, and collapse optional controls inside `<details>` at heights below 820px.

- [ ] **Step 5: Run focused/full tests and commit**

```powershell
git add web/src/logo-lab/logo-lab-panel.ts web/src/logo-lab/logo-lab-panel.test.ts web/src/ui web/src/styles
git commit -m "feat: add the Logo Lab panel"
```

---

### Task 4: Wire Logo Lab lifecycle and persistence

**Files:**
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`

**Interfaces:**
- Consumes: root `data-logo-icon-catalogue-url`, `loadLogoIconCatalogue`, `LogoLabPanel` and the adapter logo methods.
- Produces: one panel lifecycle tied to the current campaign and working add/remix after reopen.

- [ ] **Step 1: Add a failing integration test**

Open a blank campaign, load a three-icon fixture, create one mark from each recipe, remix symbol/type/colours, save, close, reopen and assert that the four `logo-mark` groups and their design metadata are unchanged. Assert a clean PNG publication and no external fetch.

- [ ] **Step 2: Run `main.test.ts` and verify RED**

Expected: FAIL because the panel is not wired and the catalogue URL is ignored.

- [ ] **Step 3: Wire the panel once and refresh it per document**

Load the catalogue only from `root.dataset.logoIconCatalogueUrl`. Panel callbacks flush queued placements, call `ObjectCommandService.addLogoMark` / `replaceLogoMark`, refresh `setMarks(adapter.listLogoMarks())`, and rely on the existing Fabric history subscription. Missing catalogues call `unavailable()` without blocking the rest of the creator.

- [ ] **Step 4: Verify integration and commit**

```powershell
git add web/src/main.ts web/src/main.test.ts
git commit -m "feat: wire Logo Lab into campaign persistence"
```

---

### Task 5: Package and verify the reviewed icon catalogue

**Files:**
- Modify: `scripts/verify-web-export.mjs`
- Modify: `scripts/build-web.mjs`
- Modify: `scripts/build-web.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `catalog/generated/logo-icons-v1-reviewed/catalog.json` regenerated from the committed vendor source.
- Produces: `verifyLogoIconDirectory`, `injectLogoIconCatalogueUrl`, `--require-logo-icons` and a copied same-origin Web catalogue.

- [ ] **Step 1: Add failing build and verification tests**

Assert exactly one canonical `data-logo-icon-catalogue-url`, safe local path validation, 4,205 unique non-brand icons, pinned source/licence metadata, rejected active SVG content, recursive non-pruning copy and failure when the required pack is absent.

- [ ] **Step 2: Run Node build tests and verify RED**

- [ ] **Step 3: Implement non-destructive injection/copy/verification**

Add `LOGO_ICON_RELATIVE`, optional detection and `requireLogoIcons`. Nest injection alongside the existing three catalogue attributes and copy the verified source directory with `copyVerifiedTree`. Extend production `build:web` and `build` scripts with `--require-logo-icons`.

- [ ] **Step 4: Rebuild, assemble and verify**

```powershell
& $node scripts\build-logo-icons.mjs
& $node node_modules\vite\bin\vite.js build
& $node scripts\build-web.mjs --require-product-shells --require-product-builder --require-logo-icons
& $node scripts\verify-web-export.mjs build\web
```

- [ ] **Step 5: Commit**

```powershell
git add scripts package.json
git commit -m "build: package the reviewed Logo Lab catalogue"
```

---

### Task 6: Real-browser Logo Lab proof

**Files:**
- Create: `web/tests/manual/logo-lab.html`
- Create: `web/tests/manual/logo-lab.ts`

**Interfaces:**
- Consumes: production `main.ts`, public creator bridge and reviewed catalogue.
- Produces: deterministic visual/runtime evidence for all four recipes, every remix class, save/reload, export and close.

- [ ] **Step 1: Write a diagnostic with final checkpoints**

```ts
const checkpoints = [
  "open", "catalogue", "icon-wordmark", "badge-seal", "monogram",
  "mascot-emblem", "remix-symbol", "remix-type", "remix-colours",
  "reload", "export", "close"
] as const;
```

Fail on any console warning/error, remote request, iframe, banned classroom framing, missing semantic group or lossy reload.

- [ ] **Step 2: Drive the actual browser at 1366×768 and 1920×1080**

Use semantic controls and real pointer selection. Capture composed marks at both sizes. Expected: 12/12 checkpoints, no clipped primary controls and clean logs.

- [ ] **Step 3: Run final verification**

Expected: TypeScript clean; all Vitest and Node tests pass; Web export verifies; `git diff --check` is clean.

- [ ] **Step 4: Commit the browser proof**

```powershell
git add web/tests/manual/logo-lab.html web/tests/manual/logo-lab.ts
git commit -m "test: prove editable Logo Lab workflows"
```
