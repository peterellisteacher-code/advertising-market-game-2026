# Creator Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify the asset-first Creator Foundation: a Godot 4.7 Web shell that opens a seamless Fabric.js campaign studio with a large virtualised catalogue, realistic masked recolouring, Openverse photography, drawing, AIDA evidence tagging, revisioned save/reload and PNG publication.

**Architecture:** Godot owns the visible game lifecycle while a local Fabric.js 7.4.0 IIFE owns the creator canvas in a same-page DOM overlay. A versioned JSON bridge keeps both runtimes isolated. Static catalogue manifests and a Python asset pipeline supply reviewed local assets; two Netlify Functions expose Openverse search and same-origin image bytes without retaining a permanent server copy.

**Tech Stack:** Godot 4.7 Standard/GDScript with Compatibility renderer; Fabric.js 7.4.0; Vite 8.1.4; TypeScript 7.0.2; Vitest 4.1.10; Zod 4.4.3; Netlify Functions 5.3.0 and CLI 26.2.0; Python 3.12; Pillow 12.3.0; pytest 9.1.1; Chromium-class desktop browser.

**Review resolution (11 July 2026):** Independent neutral and adversarial reviews both found the original three-task draft non-executable and incomplete. This revision fixes the missing Vite entry/Node types/Godot ignores, makes the first task prove the risky same-page Godot–Fabric seam, removes unsafe catalogue interpolation, enforces the 72-tile limit, gives Price/AIDA one source of truth, reserves audience/context/purpose/need/value/technique data, adds the pair-shaped timed trial, and maps all fifteen specification tests to evidence.

## Global Constraints

- Work only inside `C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game`.
- `C:\Users\Peter Ellis\Games Workshop`, `C:\Users\Peter Ellis\Godot`, every Claude-created path and every harness outside the Codex project are read-only.
- Launch `C:\Users\Peter Ellis\Godot\godot_current_console.exe`; never write beside it or its templates.
- Use Godot `4.7.stable`, GDScript, Web export, Compatibility renderer and Web threads disabled.
- The editor is a same-page overlay. No iframe, Canva redirect or second visible application.
- The publication canvas is exactly `1600×900` pixels in this slice.
- The first slice includes no Supabase market, category-specific shell library, student file upload, YouTube scraping, live AI campaign generation or permanent public gallery.
- Begin with a blank canvas; do not provide a completed or partially completed campaign.
- Price, Attention, Interest, Desire and Action remain visible, non-colour-only states; a drawing can be tagged as evidence.
- Never use *assignment*, *unit* or *task* in student-facing copy.
- Do not add a Playwright test suite. Use Vitest, pytest, Godot headless contract tests and a real-browser diagnostic harness.
- Do not invoke a deletion-producing clean command. Set Vite `emptyOutDir: false`; before any later cleanup or move from OneDrive, notify Peter under the global deletion rule.
- Keep Fabric objects behind application interfaces; Godot and domain code must never import Fabric classes.
- Keep all catalogue records outside Fabric; only placed objects belong on the canvas.
- Every raster placed on Fabric must be local or same-origin proxied before export.
- Store Openverse attribution metadata invisibly, but do not allow rights administration to reduce the classroom prototype's asset range.
- Commit after each task only when its specified tests pass.

## Scope Boundary

This plan implements only the **Creator Foundation vertical slice** described in the approved design. It proves the creator, bridge, catalogue, 100-master review pack, Openverse path and offline-in-session fallback. The three content levels, teacher console, Supabase room state and live market receive later specifications and plans after this slice passes.

## File Map

```text
Codex Advertising Market Game/
├── package.json                         # pinned JavaScript toolchain and commands
├── pnpm-lock.yaml                       # reproducible dependency graph
├── .npmrc                               # project-local pnpm store/cache
├── .gitignore                           # generated/build/cache exclusions
├── tsconfig.json                        # strict browser + function TypeScript
├── vite.config.ts                       # fixed-name local IIFE/CSS build
├── vitest.config.ts                     # jsdom unit-test environment
├── netlify.toml                         # dev/build/function routing
├── scripts/
│   ├── build-web.mjs                    # non-destructive Vite + Godot assembly
│   └── verify-web-export.mjs            # read-only export contract check
├── web/
│   ├── src/
│   │   ├── main.ts                      # installs window.AdMarketCreator once
│   │   ├── config.ts                    # fixed canvas and contract values
│   │   ├── domain/
│   │   │   ├── campaign-document.ts     # versioned campaign schema/defaults
│   │   │   └── editor-object.ts         # application metadata types
│   │   ├── bridge/
│   │   │   ├── contracts.ts             # JSON envelope types/validation
│   │   │   └── creator-public-api.ts    # sole window global callable by Godot
│   │   ├── fabric/
│   │   │   ├── fabric-custom-properties.ts
│   │   │   ├── canvas-port.ts           # Fabric-free application interface
│   │   │   ├── fabric-canvas-adapter.ts
│   │   │   └── object-factory.ts
│   │   ├── history/
│   │   │   ├── history-controller.ts
│   │   │   └── fabric-history-bindings.ts
│   │   ├── tools/
│   │   │   ├── crop-controller.ts
│   │   │   ├── drawing-layer-controller.ts
│   │   │   └── masked-variant-renderer.ts
│   │   ├── catalogue/
│   │   │   ├── catalogue-types.ts
│   │   │   ├── catalogue-index.ts
│   │   │   ├── catalogue-store.ts
│   │   │   ├── virtual-grid.ts
│   │   │   └── catalogue-panel.ts
│   │   ├── checklist/checklist-store.ts
│   │   ├── persistence/draft-store.ts
│   │   ├── export/campaign-exporter.ts
│   │   ├── ui/
│   │   │   ├── editor-shell.ts
│   │   │   ├── layers-panel.ts
│   │   │   ├── keyboard-controller.ts
│   │   │   └── live-announcer.ts
│   │   └── styles/editor.css
│   └── tests/manual/creator-diagnostic.html
├── netlify/functions/
│   ├── openverse-search.mts             # constrained Openverse JSON proxy
│   ├── openverse-image.mts              # UUID-only same-origin byte proxy
│   └── lib/openverse.ts                 # mapping, timeout and size limits
├── godot/
│   ├── project.godot
│   ├── export_presets.cfg
│   ├── web/godot_shell.html
│   ├── src/main/Main.tscn
│   ├── src/main/Main.gd
│   ├── src/creator/CreatorHost.tscn
│   ├── src/creator/CreatorHost.gd
│   ├── src/creator/CreatorBridge.gd
│   ├── src/creator/CampaignDocument.gd
│   ├── src/creator/transport/CreatorTransport.gd
│   ├── src/creator/transport/WebCreatorTransport.gd
│   └── tests/
│       ├── run_tests.gd
│       ├── test_campaign_document.gd
│       ├── test_creator_bridge.gd
│       └── fakes/FakeCreatorTransport.gd
├── catalog/
│   ├── schemas/catalog-asset-v1.schema.json
│   ├── source/creator-foundation-100/
│   ├── source/materials-v1/
│   ├── generated/catalog-v1/
│   ├── generated/offline-core-v1/
│   ├── generated/performance-fixtures/
│   └── reports/creator-foundation-100/
└── pipeline/
    ├── pyproject.toml
    ├── requirements.txt
    ├── prompts/creator-foundation-100.json
    ├── asset_pipeline/
    │   ├── __main__.py
    │   ├── schema.py
    │   ├── sheet_splitter.py
    │   ├── chroma.py
    │   ├── masks.py
    │   ├── normalize.py
    │   ├── build_pack.py
    │   ├── synthetic_catalog.py
    │   └── qa_report.py
    └── tests/
        ├── test_schema.py
        ├── test_sheet_splitter.py
        ├── test_masks.py
        └── test_pack.py
```

---

### Task 1: Reproducible Toolchain, Accessible Shell and Godot–Fabric Seam

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.gitignore`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `netlify.toml`
- Create: `web/src/main.ts`
- Create: `web/src/config.ts`
- Create: `web/src/ui/editor-shell.ts`
- Create: `web/src/styles/editor.css`
- Test: `web/src/main.test.ts`
- Create: `godot/project.godot`
- Create: `godot/export_presets.cfg`
- Create: `godot/web/godot_shell.html`
- Create: `godot/src/main/Main.tscn`
- Create: `godot/src/main/Main.gd`
- Create: `godot/src/creator/CreatorHost.gd`
- Create: `godot/src/creator/transport/CreatorTransport.gd`
- Create: `godot/src/creator/transport/WebCreatorTransport.gd`
- Create: `godot/tests/run_tests.gd`
- Create: `godot/tests/fakes/FakeCreatorTransport.gd`
- Create: `godot/tests/test_creator_host.gd`
- Test: `web/src/ui/editor-shell.test.ts`

**Interfaces:**
- Consumes: the installed read-only Godot 4.7 executable and Web export templates.
- Produces: `CREATOR_CONFIG`, `createEditorShell(root: HTMLElement): EditorShell`, a browser global `window.AdMarketCreatorSpike`, a Godot host that opens/closes the same-page overlay, `build/studio/studio.js`, and `build/studio/studio.css`.

- [ ] **Step 1: Create the pinned package and build configuration**

Create `package.json` with this exact baseline:

```json
{
  "name": "advertising-market-creator-foundation",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.7.0",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "netlify dev",
    "test": "vitest run",
    "test:unit": "vitest run",
    "typecheck": "tsc --noEmit",
    "build:studio": "vite build",
    "build": "pnpm typecheck && pnpm test:unit && pnpm build:studio"
  },
  "dependencies": {
    "fabric": "7.4.0",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@types/node": "26.1.1",
    "@netlify/functions": "5.3.0",
    "@testing-library/dom": "10.4.1",
    "fake-indexeddb": "6.2.5",
    "jsdom": "29.1.1",
    "netlify": "26.2.0",
    "typescript": "7.0.2",
    "vite": "8.1.4",
    "vitest": "4.1.10"
  }
}
```

Create `pnpm-workspace.yaml` so pnpm 11 permits only the exact pinned native/tooling build scripts:

```yaml
packages:
  - "."

strictDepBuilds: true

allowBuilds:
  "@parcel/watcher": true
  canvas: true
  esbuild: true
  netlify: true
  sharp: true
  unix-dgram: true
```

Create `.npmrc`:

```ini
store-dir=.pnpm-store
cache-dir=.pnpm-cache
```

Create `.gitignore` without any cleanup command:

```gitignore
node_modules/
.pnpm-store/
.pnpm-cache/
.python-deps/
build/
.godot/
godot/.godot/
catalog/generated/
catalog/reports/
__pycache__/
.pytest_cache/
```

Create strict `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "types": ["vite/client", "vitest/globals", "node"],
    "noEmit": true
  },
  "include": ["web/src", "netlify/functions", "vite.config.ts", "vitest.config.ts"]
}
```

Create `vite.config.ts` with fixed non-destructive output names:

```ts
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  publicDir: "web/public",
  build: {
    emptyOutDir: false,
    outDir: "build/studio",
    lib: {
      entry: resolve(import.meta.dirname, "web/src/main.ts"),
      name: "AdMarketCreatorBundle",
      formats: ["iife"],
      fileName: () => "studio.js",
      cssFileName: "studio"
    }
  }
});
```

Create `index.html` as the Vite development host:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Campaign Creator</title>
  </head>
  <body>
    <div id="creator-root"></div>
    <script type="module" src="/web/src/main.ts"></script>
  </body>
</html>
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["web/src/**/*.test.ts", "netlify/functions/**/*.test.ts"],
    restoreMocks: true,
    clearMocks: true
  }
});
```

Create `netlify.toml`:

```toml
[build]
command = "pnpm build"
publish = "build/web"
functions = "netlify/functions"

[dev]
command = "pnpm vite --host 127.0.0.1"
targetPort = 5173
port = 8888
```

- [ ] **Step 2: Install and lock dependencies**

Run:

```powershell
pnpm install --frozen-lockfile=false
```

Expected: `pnpm-lock.yaml` is created; all dependencies install inside the project-local store; exit code `0`.

- [ ] **Step 3: Write the failing semantic-shell test**

Create `web/src/ui/editor-shell.test.ts`:

```ts
import { getByRole, getAllByRole } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { createEditorShell } from "./editor-shell";

describe("createEditorShell", () => {
  it("creates labelled regions, five checklist tabs and two live regions", () => {
    document.body.innerHTML = '<div id="creator-root"></div>';
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    const shell = createEditorShell(root);

    expect(getByRole(root, "searchbox", { name: "Search assets" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Campaign canvas" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Layers" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Selected element" })).toBeTruthy();
    expect(getAllByRole(root, "tab").map((tab) => tab.textContent)).toEqual([
      "Price", "Attention", "Interest", "Desire", "Action"
    ]);
    expect(shell.polite.getAttribute("aria-live")).toBe("polite");
    expect(shell.assertive.getAttribute("aria-live")).toBe("assertive");
  });
});
```

- [ ] **Step 4: Run the shell test to verify RED**

Run:

```powershell
pnpm test:unit -- web/src/ui/editor-shell.test.ts
```

Expected: FAIL because `./editor-shell` does not exist.

- [ ] **Step 5: Implement the configuration and semantic shell**

Create `web/src/config.ts`:

```ts
export const CREATOR_CONFIG = Object.freeze({
  contractVersion: "1.0.0" as const,
  editorVersion: "0.1.0",
  canvasWidth: 1600,
  canvasHeight: 900,
  historyLimit: 100,
  liveThumbnailLimit: 72,
  searchResultLimit: 100
});
```

Create `web/src/ui/editor-shell.ts`:

```ts
export interface EditorShell {
  overlay: HTMLElement;
  library: HTMLElement;
  canvasRegion: HTMLElement;
  canvas: HTMLCanvasElement;
  inspector: HTMLElement;
  layers: HTMLElement;
  polite: HTMLElement;
  assertive: HTMLElement;
}

const AIDA = ["Price", "Attention", "Interest", "Desire", "Action"];

export function createEditorShell(root: HTMLElement): EditorShell {
  root.innerHTML = `
    <section class="creator" aria-label="Campaign creator">
      <header class="creator__topbar">
        <input aria-label="Product name" maxlength="48">
        <button type="button" data-command="undo">Undo</button>
        <button type="button" data-command="redo">Redo</button>
        <button type="button" data-command="return">Return to game</button>
      </header>
      <nav role="tablist" aria-label="Campaign checklist">
        ${AIDA.map((label, index) => `<button type="button" role="tab" aria-selected="${index === 0}" data-slot="${label.toLowerCase()}">${label}</button>`).join("")}
      </nav>
      <aside class="creator__library" aria-label="Asset library">
        <label>Search assets <input type="search" aria-label="Search assets"></label>
        <div data-library-results></div>
      </aside>
      <main class="creator__canvas" role="region" aria-label="Campaign canvas">
        <canvas width="1600" height="900"></canvas>
      </main>
      <aside class="creator__inspector" role="region" aria-label="Selected element"></aside>
      <aside class="creator__layers" role="region" aria-label="Layers"></aside>
      <p class="sr-only" data-live="polite" aria-live="polite"></p>
      <p class="sr-only" data-live="assertive" aria-live="assertive"></p>
    </section>`;

  return {
    overlay: root.querySelector(".creator")!,
    library: root.querySelector(".creator__library")!,
    canvasRegion: root.querySelector(".creator__canvas")!,
    canvas: root.querySelector("canvas")!,
    inspector: root.querySelector(".creator__inspector")!,
    layers: root.querySelector(".creator__layers")!,
    polite: root.querySelector('[data-live="polite"]')!,
    assertive: root.querySelector('[data-live="assertive"]')!
  };
}
```

Create `web/src/styles/editor.css` with visible focus, overlay and screen-reader rules:

```css
#creator-root[hidden] { display: none; }
#creator-root { position: fixed; inset: 0; z-index: 200; background: #f4f1ea; color: #1d2430; }
.creator { display: grid; height: 100%; grid-template: auto auto 1fr / minmax(250px, 20rem) 1fr minmax(240px, 19rem); }
.creator__topbar, [role="tablist"] { grid-column: 1 / -1; display: flex; gap: .5rem; align-items: center; }
.creator__canvas { overflow: auto; display: grid; place-items: center; background: #d7d2c7; }
.creator__canvas canvas { max-width: 100%; height: auto; background: white; box-shadow: 0 8px 30px rgb(0 0 0 / .18); }
button, input { min-height: 44px; }
:focus-visible { outline: 3px solid #075985; outline-offset: 3px; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
```

Create the missing Vite entry `web/src/main.ts`:

```ts
import "./styles/editor.css";
import { createEditorShell } from "./ui/editor-shell";

const root = document.querySelector<HTMLElement>("#creator-root");
if (!root) throw new Error("Missing #creator-root");

const shell = createEditorShell(root);
root.hidden = true;

const spike = Object.freeze({
  open(payloadJson: string): string {
    JSON.parse(payloadJson);
    root.hidden = false;
    shell.canvasRegion.focus({ preventScroll: true });
    return JSON.stringify({ contract: "creator-spike@1", event: "opened" });
  },
  close(): string {
    root.hidden = true;
    return JSON.stringify({ contract: "creator-spike@1", event: "closed" });
  },
  publishProbe(): string {
    const png = shell.canvas.toDataURL("image/png");
    return JSON.stringify({ contract: "creator-spike@1", event: "published", png });
  }
});

declare global {
  interface Window { AdMarketCreatorSpike: typeof spike }
}

window.AdMarketCreatorSpike = spike;
```

Extend that spike with `setEventCallback(callback)`. The DOM `Return to game`
control emits a versioned `closeRequested` envelope through the retained Godot
callback; `CreatorHost` handles it by calling the same validated `close()` path
used by native game flow. While open, make the underlying game landmark inert
and hidden from the accessibility tree; after close, restore it and DOM focus
to the Godot canvas while Godot restores its internal launch-control focus.
Make the Godot open state idempotent so duplicate requests cannot preserve the
disabled process mode. Cover the DOM route in `web/src/main.test.ts` and the
idempotent process-mode route in `godot/tests/test_creator_host.gd`.

- [ ] **Step 6: Run tests, typecheck and build**

Run:

```powershell
pnpm test:unit -- web/src/main.test.ts web/src/ui/editor-shell.test.ts
pnpm typecheck
pnpm build:studio
```

Expected: two passing tests; typecheck exit `0`; `build/studio/studio.js` and `build/studio/studio.css` exist.

- [ ] **Step 7: Write the failing Godot seam test**

Create `godot/tests/test_creator_host.gd` with a fake transport that records `open`, `close` and `publish_probe` requests. Assert that:

```gdscript
func run() -> void:
    var fake := FakeCreatorTransport.new()
    var host := CreatorHost.new()
    host.transport = fake
    host.open_creator({"contract": "creator-spike@1"})
    assert(fake.last_method == "open")
    host.request_publish_probe()
    assert(fake.last_method == "publishProbe")
    host.close_creator()
    assert(fake.last_method == "close")
```

- [ ] **Step 8: Run the Godot test to verify RED**

Run:

```powershell
& 'C:\Users\Peter Ellis\Godot\godot_current_console.exe' --headless --path godot --script tests/run_tests.gd
```

Expected: FAIL because `CreatorHost` and `FakeCreatorTransport` do not exist.

- [ ] **Step 9: Implement the minimal production seam**

Create the Godot Compatibility-renderer project, a `CreatorTransport` interface, a Web implementation that obtains `AdMarketCreatorSpike` through `JavaScriptBridge.get_interface`, and a `CreatorHost` that serialises one JSON envelope per call. Retain every object returned by `JavaScriptBridge.create_callback` as a member variable so it cannot be garbage-collected.

The Web transport must fail with a visible diagnostic if the global is absent. The host must block game input while the creator is open, restore focus to the launch button after close, and reject any response whose `contract` is not `creator-spike@1`.

- [ ] **Step 10: Verify the seam in Godot and a real browser**

Run:

```powershell
& 'C:\Users\Peter Ellis\Godot\godot_current_console.exe' --headless --path godot --script tests/run_tests.gd
pnpm typecheck
pnpm test:unit -- web/src/main.test.ts web/src/ui/editor-shell.test.ts
pnpm build:studio
```

Expected: Godot tests pass; two Vitest tests pass; typecheck and Vite build exit `0`. Export the Godot project with threads disabled, load it in a current Chromium browser, and record a diagnostic proving: open/close occurs without navigation or iframe, background Godot input is suppressed while open, focus returns after close, and a non-empty PNG data URL crosses the bridge.

- [ ] **Step 11: Commit the risk spike and shell**

```powershell
git add package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc .gitignore index.html tsconfig.json vite.config.ts vitest.config.ts netlify.toml web/src godot
git commit -m "feat: prove Godot creator seam"
```

---

### Task 2: Versioned Campaign Document and Fabric Metadata

**Files:**
- Create: `web/src/domain/editor-object.ts`
- Create: `web/src/domain/campaign-document.ts`
- Create: `web/src/fabric/fabric-custom-properties.ts`
- Test: `web/src/domain/campaign-document.test.ts`
- Test: `web/src/fabric/fabric-custom-properties.test.ts`

**Interfaces:**
- Consumes: `CREATOR_CONFIG` from Task 1.
- Produces: `CampaignDocumentV1`, `createBlankCampaignDocument`, `parseCampaignDocument`, `EditorObjectMeta`, and registered Fabric custom properties.

- [ ] **Step 1: Write failing document tests**

Create `web/src/domain/campaign-document.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createBlankCampaignDocument, parseCampaignDocument } from "./campaign-document";

describe("CampaignDocumentV1", () => {
  it("creates a blank 1600 by 900 revision-zero document", () => {
    const doc = createBlankCampaignDocument({ documentId: "doc-1", sessionId: "local-1", mode: "offline" });
    expect(doc.canvas).toEqual({ width: 1600, height: 900, background: "#ffffff" });
    expect(doc.revision).toBe(0);
    expect(doc.fabricState).toEqual({ version: "7.4.0", objects: [] });
    expect(doc.evidence).toEqual({ price: [], attention: [], interest: [], desire: [], action: [] });
    expect(doc.brief).toEqual({
      targetAudienceId: "", contextId: "", purpose: "persuade",
      audienceNeeds: [], audienceValues: [], intendedEffects: [], techniques: []
    });
  });

  it("rejects a malformed document", () => {
    expect(() => parseCampaignDocument({ schemaVersion: 1, canvas: { width: 99 } })).toThrow();
  });
});
```

Create `web/src/fabric/fabric-custom-properties.test.ts`:

```ts
import { Rect } from "fabric";
import { describe, expect, it } from "vitest";
import "./fabric-custom-properties";

it("serializes application metadata", () => {
  const rect = new Rect({ width: 10, height: 10 });
  rect.objectId = "object-1";
  rect.elementKind = "shape";
  rect.accessibleName = "Red attention block";
  const data = rect.toObject();
  expect(data).toMatchObject({ objectId: "object-1", elementKind: "shape", accessibleName: "Red attention block" });
});
```

- [ ] **Step 2: Run both tests to verify RED**

```powershell
pnpm test:unit -- web/src/domain/campaign-document.test.ts web/src/fabric/fabric-custom-properties.test.ts
```

Expected: FAIL because the domain and augmentation modules do not exist.

- [ ] **Step 3: Implement the document schema and custom metadata**

Create `web/src/domain/editor-object.ts`:

```ts
export type AidaSlot = "price" | "attention" | "interest" | "desire" | "action";
export type ElementKind = "text" | "shape" | "image" | "drawing" | "masked-component";

export interface EditorObjectMeta {
  objectId: string;
  elementKind: ElementKind;
  assetId?: string;
  sourceHash?: string;
  accessibleName: string;
}
```

Create `web/src/domain/campaign-document.ts` using one Zod source of truth:

```ts
import { z } from "zod";
import { CREATOR_CONFIG } from "../config";

const slotMap = z.object({
  price: z.array(z.string()), attention: z.array(z.string()), interest: z.array(z.string()),
  desire: z.array(z.string()), action: z.array(z.string())
});

const fabricObjectState = z.object({
  objectId: z.string().min(1),
  elementKind: z.enum(["text", "shape", "image", "drawing", "masked-component"]),
  assetId: z.string().min(1).optional(),
  sourceHash: z.string().min(1).optional(),
  accessibleName: z.string().min(1)
}).passthrough();

const fabricState = z.object({
  version: z.string().min(1),
  objects: z.array(fabricObjectState)
}).passthrough();

export const CampaignDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  editorVersion: z.string().min(1),
  documentId: z.string().min(1),
  sessionId: z.string().min(1),
  mode: z.enum(["offline", "room"]),
  roomId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  revision: z.number().int().nonnegative(),
  canvas: z.object({ width: z.literal(1600), height: z.literal(900), background: z.string() }),
  fabricState,
  drawingLayers: z.array(z.record(z.string(), z.unknown())),
  product: z.object({ name: z.string().max(48), priceCents: z.number().int().nonnegative().nullable() }),
  brief: z.object({
    targetAudienceId: z.string(),
    contextId: z.string(),
    purpose: z.literal("persuade"),
    audienceNeeds: z.array(z.string()),
    audienceValues: z.array(z.string()),
    intendedEffects: z.array(z.string()),
    techniques: z.array(z.string())
  }),
  evidence: slotMap,
  assetReferences: z.array(z.record(z.string(), z.unknown())),
  updatedAt: z.string()
});

export type CampaignDocumentV1 = z.infer<typeof CampaignDocumentSchema>;

export function createBlankCampaignDocument(ids: {
  documentId: string; sessionId: string; mode: "offline" | "room"; roomId?: string; teamId?: string
}): CampaignDocumentV1 {
  return CampaignDocumentSchema.parse({
    schemaVersion: 1,
    editorVersion: CREATOR_CONFIG.editorVersion,
    ...ids,
    revision: 0,
    canvas: { width: 1600, height: 900, background: "#ffffff" },
    fabricState: { version: "7.4.0", objects: [] },
    drawingLayers: [],
    product: { name: "", priceCents: null },
    brief: {
      targetAudienceId: "", contextId: "", purpose: "persuade",
      audienceNeeds: [], audienceValues: [], intendedEffects: [], techniques: []
    },
    evidence: { price: [], attention: [], interest: [], desire: [], action: [] },
    assetReferences: [],
    updatedAt: new Date(0).toISOString()
  });
}

export function parseCampaignDocument(value: unknown): CampaignDocumentV1 {
  return CampaignDocumentSchema.parse(value);
}
```

Create `web/src/fabric/fabric-custom-properties.ts`:

```ts
import { FabricObject } from "fabric";
import type { ElementKind } from "../domain/editor-object";

declare module "fabric" {
  interface FabricObject {
    objectId?: string;
    elementKind?: ElementKind;
    assetId?: string;
    sourceHash?: string;
    accessibleName?: string;
  }
  interface SerializedObjectProps {
    objectId?: string;
    elementKind?: ElementKind;
    assetId?: string;
    sourceHash?: string;
    accessibleName?: string;
  }
}

FabricObject.customProperties = [
  "objectId", "elementKind", "assetId", "sourceHash", "accessibleName"
];
```

`CampaignDocument.evidence` is the sole source of truth for Price/AIDA mappings and stores object IDs. Fabric objects do not duplicate checklist tags. Add a schema refinement that rejects `mode: "room"` unless both `roomId` and `teamId` are present.

- [ ] **Step 4: Run tests and typecheck to verify GREEN**

```powershell
pnpm test:unit -- web/src/domain/campaign-document.test.ts web/src/fabric/fabric-custom-properties.test.ts
pnpm typecheck
```

Expected: five passing tests, including rejection of a saved Fabric object that
lacks application metadata; typecheck exit `0`.

- [ ] **Step 5: Commit the document contract**

```powershell
git add web/src/domain web/src/fabric/fabric-custom-properties.ts
git commit -m "feat: define versioned campaign document"
```

---

### Task 3: Catalogue Schema, Search and Virtualised Results

**Files:**
- Create: `web/src/catalogue/catalogue-types.ts`
- Create: `web/src/catalogue/catalogue-index.ts`
- Create: `web/src/catalogue/virtual-grid.ts`
- Create: `web/src/catalogue/catalogue-panel.ts`
- Test: `web/src/catalogue/catalogue-index.test.ts`
- Test: `web/src/catalogue/virtual-grid.test.ts`
- Test: `web/src/catalogue/catalogue-panel.test.ts`

**Interfaces:**
- Consumes: Task 1 `EditorShell` library container.
- Produces: `CatalogAssetV1`, `CatalogueIndex.search`, `computeVirtualWindow`, and `CataloguePanel.render`.

- [ ] **Step 1: Write failing search and virtual-window tests**

Create `web/src/catalogue/catalogue-index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CatalogueIndex } from "./catalogue-index";
import type { CatalogAssetV1 } from "./catalogue-types";

const asset = (id: string, title: string, category: string, tags: string[]): CatalogAssetV1 => ({
  schema: "catalog-asset@1", id, version: 1, kind: "component", title, category, tags,
  files: { thumbnail: `/catalog/${id}-192.webp`, preview: `/catalog/${id}-640.webp`, master: `/catalog/${id}.png` },
  recolourZones: ["body"], classroomReviewed: true, brandFree: true,
  anchors: [], materialProfiles: ["matte-plastic"],
  attribution: { creator: "Classroom pack", sourceUrl: "local", license: "classroom-session" }
});

it("ranks an exact title match above a tag-only match", () => {
  const index = new CatalogueIndex([
    asset("a", "Solar Backpack", "wearables", ["eco"]),
    asset("b", "Travel Bag", "wearables", ["solar", "backpack"])
  ]);
  expect(index.search("solar backpack").map((x) => x.id)).toEqual(["a", "b"]);
});

it("searches 15000 records without returning more than 100", () => {
  const records = Array.from({ length: 15_000 }, (_, i) => asset(`id-${i}`, `Bottle ${i}`, "drinkware", ["bottle"]));
  expect(new CatalogueIndex(records).search("bottle")).toHaveLength(100);
});
```

Create `web/src/catalogue/virtual-grid.test.ts`:

```ts
import { expect, it } from "vitest";
import { computeVirtualWindow } from "./virtual-grid";

it.each([
  { columns: 1, viewportHeight: 360, scrollTop: 0 },
  { columns: 6, viewportHeight: 900, scrollTop: 36_000 },
  { columns: 12, viewportHeight: 2_160, scrollTop: 120_000 },
  { columns: 80, viewportHeight: 900, scrollTop: 0 }
])("never exposes more than 72 live tiles: %o", (shape) => {
  const window = computeVirtualWindow({
    itemCount: 15_000, rowHeight: 180, overscanRows: 3, ...shape
  });
  expect(window.start).toBeGreaterThanOrEqual(0);
  expect(window.end).toBeLessThanOrEqual(15_000);
  expect(window.end - window.start).toBeLessThanOrEqual(72);
});
```

- [ ] **Step 2: Run tests to verify RED**

```powershell
pnpm test:unit -- web/src/catalogue/catalogue-index.test.ts web/src/catalogue/virtual-grid.test.ts
```

Expected: FAIL because catalogue modules do not exist.

- [ ] **Step 3: Implement the catalogue contract and pure search index**

Create `web/src/catalogue/catalogue-types.ts`:

```ts
export type AssetKind = "raster-master" | "component" | "svg" | "texture" | "shape" | "photo" | "shell";
export type RecolourZone = "body" | "trim" | "accent" | "label";

export interface CatalogAssetV1 {
  schema: "catalog-asset@1";
  id: string;
  version: number;
  kind: AssetKind;
  title: string;
  category: string;
  tags: string[];
  files: { thumbnail: string; preview: string; master: string; masks?: Partial<Record<RecolourZone, string>>; shadow?: string };
  recolourZones: RecolourZone[];
  anchors: Array<{ id: string; x: number; y: number; accepts: string[] }>;
  materialProfiles: string[];
  classroomReviewed: boolean;
  brandFree: boolean;
  attribution: { creator: string; sourceUrl: string; license: string };
}
```

Create `web/src/catalogue/catalogue-index.ts`:

```ts
import { CREATOR_CONFIG } from "../config";
import type { CatalogAssetV1 } from "./catalogue-types";

const words = (value: string) => value.toLowerCase().normalize("NFKD").split(/[^a-z0-9]+/).filter(Boolean);

export class CatalogueIndex {
  readonly #records: Array<{ asset: CatalogAssetV1; title: string; tokens: Set<string> }>;

  constructor(records: CatalogAssetV1[]) {
    this.#records = records.map((asset) => ({
      asset,
      title: asset.title.toLowerCase(),
      tokens: new Set(words([asset.title, asset.category, ...asset.tags].join(" ")))
    }));
  }

  search(query: string, category?: string): CatalogAssetV1[] {
    const normalized = query.trim().toLowerCase();
    const queryTokens = words(normalized);
    return this.#records
      .filter(({ asset, tokens }) => (!category || asset.category === category) && queryTokens.every((token) => tokens.has(token)))
      .map(({ asset, title }) => ({ asset, score: title === normalized ? 3 : title.startsWith(normalized) ? 2 : 1 }))
      .sort((a, b) => b.score - a.score || a.asset.title.localeCompare(b.asset.title))
      .slice(0, CREATOR_CONFIG.searchResultLimit)
      .map(({ asset }) => asset);
  }
}
```

Create `web/src/catalogue/virtual-grid.ts`:

```ts
export interface VirtualWindow { start: number; end: number; top: number; totalHeight: number }

export function computeVirtualWindow(input: {
  itemCount: number; columns: number; rowHeight: number; viewportHeight: number; scrollTop: number; overscanRows: number;
}): VirtualWindow {
  const totalRows = Math.ceil(input.itemCount / input.columns);
  const firstRow = Math.max(0, Math.floor(input.scrollTop / input.rowHeight) - input.overscanRows);
  const visibleRows = Math.ceil(input.viewportHeight / input.rowHeight) + input.overscanRows * 2;
  const lastRow = Math.min(totalRows, firstRow + visibleRows);
  const start = Math.min(input.itemCount, firstRow * input.columns);
  return {
    start,
    end: Math.min(input.itemCount, start + Math.min(72, (lastRow - firstRow) * input.columns)),
    top: firstRow * input.rowHeight,
    totalHeight: totalRows * input.rowHeight
  };
}
```

Derive an effective column count from the 72-tile budget divided by the visible
plus overscan row count. Use the same count for window arithmetic and the DOM
grid. This prevents a requested 80-column row from making records after item 72
unreachable while preserving the hard live-node cap.

- [ ] **Step 4: Implement a recycled semantic catalogue panel**

Create `web/src/catalogue/catalogue-panel.ts` with a maximum of 72 asset buttons:

```ts
import type { CatalogAssetV1 } from "./catalogue-types";
import { computeVirtualWindow } from "./virtual-grid";

export class CataloguePanel {
  constructor(private readonly host: HTMLElement, private readonly onPick: (asset: CatalogAssetV1) => void) {}

  render(records: CatalogAssetV1[], scrollTop = 0, viewportHeight = 900, columns = 6): void {
    const view = computeVirtualWindow({ itemCount: records.length, columns, rowHeight: 180, viewportHeight, scrollTop, overscanRows: 3 });
    const spacer = document.createElement("div");
    spacer.style.height = `${view.totalHeight}px`;
    spacer.style.position = "relative";
    const mount = document.createElement("div");
    mount.style.position = "absolute";
    mount.style.top = `${view.top}px`;
    spacer.append(mount);
    this.host.replaceChildren(spacer);
    records.slice(view.start, view.end).forEach((asset, offset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.assetId = asset.id;
      button.setAttribute("aria-posinset", String(view.start + offset + 1));
      button.setAttribute("aria-setsize", String(records.length));
      const image = document.createElement("img");
      image.loading = "lazy";
      image.alt = "";
      image.src = validatedAssetUrl(asset.files.thumbnail);
      const title = document.createElement("span");
      title.textContent = asset.title;
      button.append(image, title);
      button.addEventListener("click", () => this.onPick(asset), { once: true });
      mount.append(button);
    });
  }
}
```

Define the URL guard in the same module:

```ts
const PLACEHOLDER_THUMBNAIL = "/catalog/system/missing-thumbnail.svg";

function validatedAssetUrl(value: string): string {
  const url = new URL(value, window.location.origin);
  const allowed = url.origin === window.location.origin &&
    (url.pathname.startsWith("/catalog/") || url.pathname.startsWith("/.netlify/functions/openverse-image/"));
  return allowed ? url.href : PLACEHOLDER_THUMBNAIL;
}
```

Attach one scroll listener and one `ResizeObserver` outside `render`; compute columns from measured width and rerender without accumulating listeners.

- [ ] **Step 5: Run tests and typecheck to verify GREEN**

```powershell
pnpm test:unit -- web/src/catalogue/catalogue-index.test.ts web/src/catalogue/virtual-grid.test.ts
pnpm typecheck
```

Expected: eleven search/window/panel cases pass; typecheck exit `0`; the
15,000-record search test creates no DOM nodes; DOM tests confirm at most 72
buttons, full-catalogue reachability, one scroll listener, guarded thumbnail
URLs and literal rendering of a title containing `<script>`.

- [ ] **Step 6: Commit the catalogue foundation**

```powershell
git add web/src/catalogue
git commit -m "feat: add virtualised asset catalogue"
```

---

### Task 4: Fabric Canvas Port and Core Object Operations

**Files:**
- Create: `web/src/fabric/canvas-port.ts`
- Create: `web/src/fabric/object-factory.ts`
- Create: `web/src/fabric/fabric-canvas-adapter.ts`
- Create: `web/src/fabric/object-command-service.ts`
- Test: `web/src/fabric/object-command-service.test.ts`
- Test: `web/src/fabric/object-factory.test.ts`

**Interfaces:**
- Consumes: Task 2 `EditorObjectMeta` and Task 3 `CatalogAssetV1`.
- Produces: Fabric-free `CanvasPort`, `ObjectCommandService`, and the sole `FabricCanvasAdapter`.

- [ ] **Step 1: Write failing port and command tests**

Define a memory fake in the test and verify add/select/move/resize/rotate/flip/duplicate/delete/front/back/lock/hide. The test must never import Fabric:

```ts
it("performs the required object commands through the port", async () => {
  const port = new MemoryCanvasPort();
  const commands = new ObjectCommandService(port);
  const id = await commands.addShape({ kind: "rect", fill: "#e11d48" });
  commands.transform(id, { x: 140, y: 90, scaleX: 1.5, scaleY: 0.75, angle: 18, flipX: true });
  const copyId = commands.duplicate(id);
  commands.moveToBack(copyId);
  commands.setLocked(id, true);
  expect(port.snapshot()).toMatchObject({
    selectedId: id,
    objects: expect.arrayContaining([
      expect.objectContaining({ id, x: 140, y: 90, angle: 18, locked: true }),
      expect.objectContaining({ id: copyId })
    ])
  });
  commands.remove(copyId);
  expect(port.has(copyId)).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify RED**

```powershell
pnpm test:unit -- web/src/fabric/object-command-service.test.ts web/src/fabric/object-factory.test.ts
```

Expected: FAIL because the port, factory and command service do not exist.

- [ ] **Step 3: Define the application port**

```ts
export interface ObjectTransform {
  x: number; y: number; scaleX: number; scaleY: number; angle: number; flipX: boolean; flipY: boolean;
}

export interface CanvasPort {
  addText(value: string): Promise<string>;
  addShape(input: { kind: "rect" | "ellipse" | "triangle" | "line"; fill: string }): Promise<string>;
  addRaster(input: { assetId: string; sameOriginUrl: string; accessibleName: string }): Promise<string>;
  transform(id: string, patch: Partial<ObjectTransform>): void;
  duplicate(id: string): string;
  remove(id: string): void;
  move(id: string, direction: "front" | "forward" | "backward" | "back"): void;
  setLocked(id: string, locked: boolean): void;
  setVisible(id: string, visible: boolean): void;
  setSelected(id: string | null): void;
  serialize(): Record<string, unknown>;
  load(value: Record<string, unknown>): Promise<void>;
}
```

`ObjectCommandService` owns command validation and ID generation; no UI or Godot file imports Fabric. `FabricCanvasAdapter` maps the port to Fabric 7 objects, configures corner controls for 44-pixel minimum pointer targets at current zoom, and registers `object:modified`, `object:added` and `object:removed` events for Task 5.

- [ ] **Step 4: Implement the object factory and adapter**

Use `Textbox`, `Rect`, `Ellipse`, `Triangle`, `Line` and `FabricImage.fromURL`. Reject non-same-origin raster URLs before calling Fabric. Every object receives a UUID, `elementKind`, `accessibleName`, centred origin and bounded initial size. Configure selection handles once in the factory.

- [ ] **Step 5: Verify unit and real-canvas behaviour**

```powershell
pnpm test:unit -- web/src/fabric/object-command-service.test.ts web/src/fabric/object-factory.test.ts
pnpm typecheck
```

Expected: tests and typecheck pass. Add a page to `web/tests/manual/creator-diagnostic.html` that performs every operation against a real Fabric canvas and exposes `window.__CREATOR_DIAGNOSTIC__.objectOperations = "pass"`.

- [ ] **Step 6: Commit the object engine**

```powershell
git add web/src/fabric web/tests/manual/creator-diagnostic.html
git commit -m "feat: add creator object operations"
```

---

### Task 5: Crop, Drawing, Erasing and Unified History

**Files:**
- Create: `web/src/history/history-controller.ts`
- Create: `web/src/history/fabric-history-bindings.ts`
- Create: `web/src/tools/crop-controller.ts`
- Create: `web/src/tools/drawing-layer-controller.ts`
- Test: `web/src/history/history-controller.test.ts`
- Test: `web/src/tools/crop-controller.test.ts`
- Test: `web/src/tools/drawing-layer-controller.test.ts`

**Interfaces:**
- Consumes: Task 4 `CanvasPort` and adapter events.
- Produces: `HistoryController`, non-destructive `CropController`, and `DrawingLayerController`.

- [ ] **Step 1: Write the failing mixed-history test**

```ts
it("undoes and redoes twelve mixed edits in exact order", async () => {
  const harness = createHistoryHarness();
  for (const action of mixedActions) await harness.perform(action);
  const completed = harness.hash();
  for (let i = 0; i < mixedActions.length; i += 1) await harness.undo();
  expect(harness.hash()).toBe(harness.blankHash);
  for (let i = 0; i < mixedActions.length; i += 1) await harness.redo();
  expect(harness.hash()).toBe(completed);
});
```

`mixedActions` contains text add/edit, raster add, move, resize, rotate, crop, drawing stroke, eraser stroke removal, reorder, duplicate and delete.

- [ ] **Step 2: Run tests to verify RED**

```powershell
pnpm test:unit -- web/src/history/history-controller.test.ts web/src/tools/crop-controller.test.ts web/src/tools/drawing-layer-controller.test.ts
```

Expected: FAIL because all three controllers are absent.

- [ ] **Step 3: Implement bounded immutable history**

```ts
export class HistoryController<T> {
  #past: T[] = [];
  #present: T;
  #future: T[] = [];
  constructor(initial: T, private readonly clone: (value: T) => T, private readonly limit = 100) {
    this.#present = clone(initial);
  }
  commit(next: T): void {
    this.#past.push(this.clone(this.#present));
    if (this.#past.length > this.limit) this.#past.shift();
    this.#present = this.clone(next);
    this.#future = [];
  }
  undo(): T | null {
    const previous = this.#past.pop();
    if (!previous) return null;
    this.#future.unshift(this.clone(this.#present));
    return this.#present = this.clone(previous);
  }
  redo(): T | null {
    const next = this.#future.shift();
    if (!next) return null;
    this.#past.push(this.clone(this.#present));
    return this.#present = this.clone(next);
  }
}
```

`fabric-history-bindings.ts` coalesces continuous pointer movement into one commit at `object:modified`, suppresses commits while loading a snapshot, and announces undo/redo through the polite live region.

- [ ] **Step 4: Implement non-destructive crop and drawing**

`CropController` stores `cropX`, `cropY`, visible width/height and focal point without mutating source pixels. Clamp every crop rectangle inside the source bounds.

`DrawingLayerController` uses one Fabric `PencilBrush` for pencil/marker modes and tags each completed path as `elementKind: "drawing"`. Eraser mode removes the topmost drawing path intersecting the pointer radius; it never deletes text, product components or photographs. Each completed stroke or erased path is one history action.

- [ ] **Step 5: Verify GREEN and browser behaviour**

```powershell
pnpm test:unit -- web/src/history/history-controller.test.ts web/src/tools/crop-controller.test.ts web/src/tools/drawing-layer-controller.test.ts
pnpm typecheck
```

Expected: all tests pass. The real-browser diagnostic must crop a photograph, draw three strokes, erase the middle stroke, undo all actions and redo them to the same serialised hash.

- [ ] **Step 6: Commit creative tools**

```powershell
git add web/src/history web/src/tools web/tests/manual/creator-diagnostic.html
git commit -m "feat: add crop drawing and unified history"
```

---

### Task 6: Masked Realistic Recolouring and Material Variants

**Files:**
- Create: `web/src/tools/masked-variant-renderer.ts`
- Create: `web/src/tools/material-presets.ts`
- Create: `web/src/tools/variant-cache.ts`
- Test: `web/src/tools/masked-variant-renderer.test.ts`
- Test: `web/src/tools/variant-cache.test.ts`

**Interfaces:**
- Consumes: Task 3 mask paths/material profiles and Task 4 raster placement.
- Produces: `MaskedVariantRenderer.render(master, zones, materials)` and a bounded object-URL cache.

- [ ] **Step 1: Write failing renderer and cache tests**

Use a 4×4 synthetic master plus Body/Trim/Accent/Label masks. Assert independent zone colours, unchanged transparent pixels, preserved luminance ordering and least-recently-used eviction after 48 variants.

- [ ] **Step 2: Run tests to verify RED**

```powershell
pnpm test:unit -- web/src/tools/masked-variant-renderer.test.ts web/src/tools/variant-cache.test.ts
```

Expected: FAIL because the renderer and cache do not exist.

- [ ] **Step 3: Implement the compositor**

```ts
export type ZoneStyle = { colour: string; materialId: string; opacity: number };
export type ZoneStyles = Partial<Record<"body" | "trim" | "accent" | "label", ZoneStyle>>;

export interface MaskedVariantRenderer {
  render(input: {
    master: ImageBitmap;
    masks: Partial<Record<"body" | "trim" | "accent" | "label", ImageBitmap>>;
    styles: ZoneStyles;
    width: number;
    height: number;
  }): Promise<Blob>;
}
```

For each zone, draw colour/material texture through the alpha mask, blend it with the neutral master using `multiply` followed by `source-atop`, then redraw master highlights and optional shadow. Validate all dimensions and reject masks that differ from the master.

- [ ] **Step 4: Add deterministic material presets**

Define matte plastic, gloss plastic, rubber, cardboard, fabric, glass, brushed metal and wood as small data-only profiles controlling texture URL, blend mode, opacity and highlight strength. A variant cache key is SHA-256 of asset version plus sorted zone styles; revoke object URLs on eviction.

- [ ] **Step 5: Verify with representative categories**

```powershell
pnpm test:unit -- web/src/tools/masked-variant-renderer.test.ts web/src/tools/variant-cache.test.ts
pnpm typecheck
```

Expected: tests pass. Add browser fixtures for drinkware, footwear, electronics and packaging; the diagnostic records zone independence and preserved highlight contrast for all four.

- [ ] **Step 6: Commit recolouring**

```powershell
git add web/src/tools web/tests/manual
git commit -m "feat: add masked material recolouring"
```

---

### Task 7: Revisioned Draft Persistence and Clean PNG Publication

**Files:**
- Create: `web/src/persistence/draft-store.ts`
- Create: `web/src/persistence/draft-migrations.ts`
- Create: `web/src/export/campaign-exporter.ts`
- Create: `web/src/checklist/checklist-store.ts`
- Test: `web/src/persistence/draft-store.test.ts`
- Test: `web/src/export/campaign-exporter.test.ts`
- Test: `web/src/checklist/checklist-store.test.ts`

**Interfaces:**
- Consumes: Task 2 document schema, Task 4 serialisation, Task 5 history and Task 6 rendered variants.
- Produces: `DraftStore.save/load`, authoritative checklist mapping and `CampaignExporter.publish`.

- [ ] **Step 1: Write failing round-trip tests**

Use `fake-indexeddb` to save a document containing text, transform, crop, drawing, masked variant, Price/AIDA evidence and local asset blobs. Reload it and assert the canonical JSON hash and editable object count match. Export a 1600×900 PNG and assert its signature bytes, dimensions and absence of selection controls.

- [ ] **Step 2: Run tests to verify RED**

```powershell
pnpm test:unit -- web/src/persistence/draft-store.test.ts web/src/export/campaign-exporter.test.ts web/src/checklist/checklist-store.test.ts
```

Expected: FAIL because persistence, checklist and publication modules are absent.

- [ ] **Step 3: Implement the stores**

```ts
export interface DraftStore {
  save(document: CampaignDocumentV1, blobs: ReadonlyMap<string, Blob>): Promise<void>;
  load(documentId: string): Promise<{ document: CampaignDocumentV1; blobs: Map<string, Blob> } | null>;
}

export interface PublishedCampaign {
  contract: "published-campaign@1";
  documentId: string;
  revision: number;
  pngBytes: Uint8Array;
  metadata: {
    productName: string;
    priceCents: number;
    brief: CampaignDocumentV1["brief"];
    evidence: CampaignDocumentV1["evidence"];
    assetReferences: CampaignDocumentV1["assetReferences"];
  };
}
```

Use one IndexedDB database with `documents` and `blobs` stores. Save a new revision in a single transaction. Migrate older schema versions before parsing; never mutate the stored source object.

- [ ] **Step 4: Implement publication**

Temporarily clear active selection and guides, render through Fabric `toDataURL({ format: "png", multiplier: 1 })`, convert to bytes, restore editor state, then validate 1600×900 dimensions. Publication fails if price is null, any required AIDA array is empty, a referenced object ID is absent, or a raster is neither local nor same-origin.

- [ ] **Step 5: Verify GREEN**

```powershell
pnpm test:unit -- web/src/persistence/draft-store.test.ts web/src/export/campaign-exporter.test.ts web/src/checklist/checklist-store.test.ts
pnpm typecheck
```

Expected: all round-trip, migration and export tests pass; the browser diagnostic reproduces the same editable composition after page reload.

- [ ] **Step 6: Commit persistence and publication**

```powershell
git add web/src/persistence web/src/export web/src/checklist web/tests/manual
git commit -m "feat: persist and publish campaigns"
```

---

### Task 8: Production Godot–Creator Contract and Web Export Assembly

**Files:**
- Create: `web/src/bridge/contracts.ts`
- Create: `web/src/bridge/creator-public-api.ts`
- Create: `web/src/bridge/creator-public-api.test.ts`
- Create: `godot/src/creator/CreatorBridge.gd`
- Create: `godot/src/creator/CampaignDocument.gd`
- Modify: `godot/src/creator/transport/CreatorTransport.gd`
- Modify: `godot/src/creator/transport/WebCreatorTransport.gd`
- Modify: `godot/tests/fakes/FakeCreatorTransport.gd`
- Create: `godot/tests/test_creator_bridge.gd`
- Create: `scripts/build-web.mjs`
- Create: `scripts/verify-web-export.mjs`
- Modify: `web/src/main.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 2 documents and Task 7 publication payloads.
- Produces: `window.AdMarketCreator`, versioned JSON envelopes and a verified Godot Web export.

- [ ] **Step 1: Write failing TypeScript and GDScript contract tests**

The TypeScript test opens a valid document, rejects an unknown contract, returns current state, publishes bytes and closes. The Godot test uses `FakeCreatorTransport` to assert request IDs, version checks, callback routing, focus restoration and rejection of duplicate/stale responses.

```ts
expect(api.handle(JSON.stringify({
  contract: "creator-bridge@1", requestId: "r1", method: "open", payload: blankDocument
}))).resolves.toMatchObject({ contract: "creator-bridge@1", requestId: "r1", ok: true });
```

- [ ] **Step 2: Run tests to verify RED**

```powershell
pnpm test:unit -- web/src/bridge/creator-public-api.test.ts
& 'C:\Users\Peter Ellis\Godot\godot_current_console.exe' --headless --path godot --script tests/run_tests.gd
```

Expected: both commands fail on missing production bridge modules.

- [ ] **Step 3: Implement one JSON boundary**

```ts
export type CreatorMethod = "open" | "getState" | "save" | "publish" | "close";
export interface CreatorRequest {
  contract: "creator-bridge@1";
  requestId: string;
  method: CreatorMethod;
  payload: unknown;
}
export interface CreatorResponse {
  contract: "creator-bridge@1";
  requestId: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
}
```

`creator-public-api.ts` parses with Zod, serialises every response, and exposes one frozen `handle(requestJson): Promise<string>` method. No Fabric object crosses this boundary. `WebCreatorTransport.gd` holds callback references as members, uses `JavaScriptBridge.get_interface("AdMarketCreator")`, and sends only JSON strings.

- [ ] **Step 4: Implement non-destructive export assembly**

`scripts/build-web.mjs` must:

1. require existing `build/studio/studio.js` and `studio.css`;
2. invoke the read-only Godot executable with `--headless --path godot --export-release Web ../build/web/index.html`;
3. copy the fixed studio files and offline core into `build/web` without deleting existing entries;
4. inject fixed local `<link>` and `<script>` tags into a copied custom shell, never the Godot installation.

`verify-web-export.mjs` asserts required Godot artefacts, local studio assets, no remote runtime dependency, threads disabled, one `AdMarketCreator` global and no iframe.

Modify package scripts:

```json
"build:godot": "node scripts/build-web.mjs",
"build": "pnpm typecheck && pnpm test:unit && pnpm build:studio && pnpm build:godot",
"verify:export": "node scripts/verify-web-export.mjs build/web"
```

- [ ] **Step 5: Verify GREEN**

```powershell
pnpm test:unit -- web/src/bridge/creator-public-api.test.ts
& 'C:\Users\Peter Ellis\Godot\godot_current_console.exe' --headless --path godot --script tests/run_tests.gd
pnpm build
pnpm verify:export
```

Expected: bridge tests pass; Godot tests pass; the Web export contains the fixed studio assets and passes every export assertion.

- [ ] **Step 6: Commit the production bridge**

```powershell
git add web/src/bridge web/src/main.ts godot scripts package.json pnpm-lock.yaml
git commit -m "feat: integrate Godot and campaign creator"
```

---

### Task 9: Controlled Openverse Search, Placement and Offline Default

**Files:**
- Create: `netlify/functions/lib/openverse.ts`
- Create: `netlify/functions/openverse-search.mts`
- Create: `netlify/functions/openverse-image.mts`
- Create: `netlify/functions/openverse-search.test.ts`
- Create: `netlify/functions/openverse-image.test.ts`
- Create: `web/src/catalogue/openverse-client.ts`
- Create: `web/src/catalogue/openverse-client.test.ts`
- Modify: `web/src/catalogue/catalogue-panel.ts`

**Interfaces:**
- Consumes: Task 3 catalogue UI, Task 4 same-origin raster placement and Task 7 attribution records.
- Produces: constrained photo results and same-origin temporary image bytes.

- [ ] **Step 1: Write failing proxy tests**

Test query length, page-size cap, mature-content exclusion, upstream timeout, non-image response, oversize body, unsupported licence metadata, invalid UUID and offline fallback. Mock `fetch`; never contact Openverse from the unit suite.

- [ ] **Step 2: Run tests to verify RED**

```powershell
pnpm test:unit -- netlify/functions/openverse-search.test.ts netlify/functions/openverse-image.test.ts web/src/catalogue/openverse-client.test.ts
```

Expected: FAIL because the proxy and client modules do not exist.

- [ ] **Step 3: Implement the constrained search route**

`openverse-search.mts` accepts only `GET /.netlify/functions/openverse-search?q=<2..80 chars>&page=<1..20>`, requests `mature=false`, caps results at 30 and returns only:

```ts
type OpenverseResult = {
  id: string; title: string; creator: string; license: string;
  sourceUrl: string; thumbnailUrl: string; width: number; height: number;
};
```

Use an 8-second `AbortSignal.timeout`, map upstream errors to stable codes, and set `Cache-Control: public, max-age=300`.

- [ ] **Step 4: Implement UUID-only image bytes**

`openverse-image.mts` accepts one UUID, resolves that UUID through the Openverse API, fetches only the resolved image URL, permits `image/png`, `image/jpeg` or `image/webp`, rejects redirects to loopback/private-address hosts, streams at most 12 MB, and returns same-origin bytes with `X-Content-Type-Options: nosniff`. It stores nothing permanently.

The browser client has a teacher-controlled enabled flag. When disabled, offline or failed, it returns `{ status: "offline", records: [] }` and keeps the reviewed core catalogue fully usable.

- [ ] **Step 5: Verify placement and export**

```powershell
pnpm test:unit -- netlify/functions/openverse-search.test.ts netlify/functions/openverse-image.test.ts web/src/catalogue/openverse-client.test.ts
pnpm typecheck
```

Expected: tests pass. The browser diagnostic searches a fixed benign term, places one proxied image, records attribution and exports a clean PNG. A second diagnostic with network blocked completes from the offline core.

- [ ] **Step 6: Commit the photo library**

```powershell
git add netlify/functions web/src/catalogue web/tests/manual
git commit -m "feat: add controlled Openverse photo placement"
```

---

### Task 10: Deterministic Asset Ingestion and Sheet-Splitting Pipeline

**Files:**
- Create: `pipeline/pyproject.toml`
- Create: `pipeline/requirements.txt`
- Create: `pipeline/asset_pipeline/schema.py`
- Create: `pipeline/asset_pipeline/sheet_splitter.py`
- Create: `pipeline/asset_pipeline/chroma.py`
- Create: `pipeline/asset_pipeline/masks.py`
- Create: `pipeline/asset_pipeline/normalize.py`
- Create: `pipeline/asset_pipeline/build_pack.py`
- Create: `pipeline/asset_pipeline/synthetic_catalog.py`
- Create: `pipeline/asset_pipeline/qa_report.py`
- Create: `pipeline/tests/test_schema.py`
- Create: `pipeline/tests/test_sheet_splitter.py`
- Create: `pipeline/tests/test_masks.py`
- Create: `pipeline/tests/test_pack.py`

**Interfaces:**
- Consumes: source sheets, pre-existing assets and authored masks.
- Produces: validated masters, thumbnails, previews, masks, manifests, 1,000-record core index and 15,000-record fixture.

- [ ] **Step 1: Pin and install the isolated Python toolchain**

`requirements.txt` contains exact pins for Pillow 12.3.0, pydantic 2.13.4, jsonschema 4.26.0 and pytest 9.1.1. Install only into `pipeline/.venv` or the project-local `.python-deps`; never modify the system Python installation:

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m venv pipeline\.venv
pipeline\.venv\Scripts\python.exe -m pip install -r pipeline\requirements.txt
```

- [ ] **Step 2: Write failing chroma/split/mask/manifest tests**

Fixtures include a 4×4 sheet on a unique chroma colour with transparent gaps, touching objects that must be rejected, a mismatched mask, an asset with a trademark-like label, and a valid four-zone product. Assert pixel-perfect bounds, alpha cleanup, deterministic filenames, mask dimensions, anchor bounds and schema validation.

- [ ] **Step 3: Run tests to verify RED**

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
```

Expected: FAIL because pipeline modules are absent.

- [ ] **Step 4: Implement connected-component splitting and normalisation**

`sheet_splitter.py` removes the configured chroma colour in CIE-Lab distance, labels 8-connected alpha components, rejects components touching another component's padding zone, adds a fixed transparent gutter and emits source coordinates. `normalize.py` writes 192-pixel WebP thumbnails, 640-pixel previews and a lossless master while preserving alpha and embedded colour profile.

- [ ] **Step 5: Implement mask and manifest validation**

Each master may expose Body/Trim/Accent/Label masks, optional shadow, attachment anchors and material profiles. Validation rejects size mismatch, overlapping zone pixels above 2%, anchors outside bounds, missing attribution, non-unique IDs and source hashes that do not match bytes.

- [ ] **Step 6: Implement deterministic pack and fixture builders**

`build_pack.py` sorts by stable ID, emits `catalog-asset@1` JSON and a QA row per asset. `synthetic_catalog.py --count 15000 --seed 20260710` produces a repeatable search fixture without duplicating image files.

- [ ] **Step 7: Verify GREEN**

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
pipeline\.venv\Scripts\python.exe -m asset_pipeline.synthetic_catalog --count 15000 --seed 20260710 --out catalog/generated/performance-fixtures/catalog-15000.json
```

Expected: tests pass; the fixture contains exactly 15,000 valid unique records.

- [ ] **Step 8: Commit the pipeline**

```powershell
git add pipeline
git commit -m "feat: add deterministic asset pipeline"
```

---

### Task 11: Reviewed 100-Master Pack and 1,000-Record Offline Core

**Files:**
- Create: `catalog/schemas/catalog-asset-v1.schema.json`
- Create: `catalog/source/creator-foundation-100/`
- Create: `catalog/source/materials-v1/`
- Create: `catalog/generated/offline-core-v1/catalog.json`
- Create: `catalog/reports/creator-foundation-100/qa.json`
- Create: `catalog/reports/creator-foundation-100/contact-sheet.webp`
- Create: `catalog/INDEX.md`
- Create: `CREDITS.md`

**Interfaces:**
- Consumes: Task 10 pipeline plus existing/open assets and image-generated chroma sheets where gaps remain.
- Produces: a brand-free 100-master pack across ten categories and at least 1,000 searchable base/virtual records.

- [ ] **Step 1: Fix the category quota before collection**

Use exactly ten broad launch categories with at least ten reviewed masters each: drinkware, food/packaging, bags, footwear, wearable accessories, personal care, small electronics, leisure/outdoor, home/desk and transport/travel. Within each category include bodies plus interchangeable components rather than ten near-duplicates.

- [ ] **Step 2: Inventory pre-existing candidates first**

Record source path/URL, creator, licence, source hash, brand-removal status, category, masks, anchors and rejection reason in `catalog/INDEX.md`. Normalise usable existing assets before generating replacements. Do not copy or modify anything in Games Workshop; copy only from sources explicitly allowed for this Codex project.

- [ ] **Step 3: Generate only the missing masters**

Generate dense chroma-key sheets at the largest supported image size, with separated realistic product bodies/components, consistent camera angle, neutral lighting, no text/logos and a unique chroma colour absent from the objects. Split with Task 10, inspect every cutout at pixel level and reject fused edges, clipped shadows, warped geometry or baked-in brands.

- [ ] **Step 4: Author recolour masks and attachment anchors**

At least 20 representative masters across the ten categories receive Body/Trim/Accent/Label masks; the remainder expose every zone that is visually meaningful. Every component intended to attach has named compatible anchors.

- [ ] **Step 5: Build and validate the offline core**

```powershell
pipeline\.venv\Scripts\python.exe -m asset_pipeline.build_pack --source catalog/source/creator-foundation-100 --materials catalog/source/materials-v1 --out catalog/generated/offline-core-v1 --report catalog/reports/creator-foundation-100
pipeline\.venv\Scripts\python.exe -m asset_pipeline.qa_report --catalog catalog/generated/offline-core-v1/catalog.json --require-masters 100 --require-categories 10 --require-records 1000
```

Expected: at least 100 accepted masters, ten categories, 1,000 searchable records, zero schema errors, zero missing attributions and zero unreviewed launch records.

- [ ] **Step 6: Verify realistic variety**

For four representative categories, render 24 colours × 12 materials from one master without duplicate source files. The contact sheet must show preserved lighting, legible silhouette at thumbnail size and visually distinct Body/Trim/Accent/Label changes.

- [ ] **Step 7: Commit the reviewed pack**

```powershell
git add catalog CREDITS.md
git commit -m "feat: add reviewed creator asset core"
```

---

### Task 12: Game-Shaped Pair Flow, Advertising Meaning and Market-Card Preview

**Files:**
- Create: `web/src/game/pair-session.ts`
- Create: `web/src/game/audience-briefs.ts`
- Create: `web/src/game/creator-stage.ts`
- Create: `web/src/game/market-card-preview.ts`
- Create: `web/src/game/round-zero.ts`
- Create: `web/src/game/student-copy.ts`
- Create: `web/src/game/pair-session.test.ts`
- Create: `web/src/game/creator-stage.test.ts`
- Create: `web/src/game/student-copy.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/styles/editor.css`

**Interfaces:**
- Consumes: Task 2 advertising brief/evidence, Task 4 commands, Task 7 publication and Task 11 offline core.
- Produces: a thin fun-first pair loop from audience signal to product, AIDA/price evidence and market-card preview.

- [ ] **Step 1: Write failing pair-flow and copy tests**

Assert:

- roles start as Art Director and Strategist and swap without losing state;
- both roles receive a visible productive action before publication;
- Round 0 exposes search, add, move, resize, text and undo only;
- crop, drawing, recolour and layers unlock one cluster at a time;
- one audience brief records context, need, values and intended effect;
- publication requires product name, price and one object/drawing ID in each AIDA slot;
- every student-facing string excludes the case-insensitive whole words `assignment`, `unit` and `task`.

- [ ] **Step 2: Run tests to verify RED**

```powershell
pnpm test:unit -- web/src/game/pair-session.test.ts web/src/game/creator-stage.test.ts web/src/game/student-copy.test.ts
```

Expected: FAIL because the pair/game modules do not exist.

- [ ] **Step 3: Implement the pair state**

```ts
export type PairRole = "art-director" | "strategist";
export type CreatorPhase = "round-zero" | "invent" | "sell" | "refine" | "preview";

export interface PairSession {
  sessionId: string;
  activeRole: PairRole;
  phase: CreatorPhase;
  audienceBriefId: string;
  handoffCount: number;
  startedAt: string;
}
```

`swapRole` changes only the active role and increments `handoffCount`. The strategist can shortlist assets, tag AIDA evidence, edit audience intent and set price while the art director manipulates the canvas. Role labels describe play, not marking criteria.

- [ ] **Step 4: Implement Round 0 and progressive controls**

Round 0 is playable immediately and demonstrates one add/move/resize interaction in under two minutes. It shows no modal tutorial. Each subsequent phase unlocks one control cluster and uses tooltips of at most two lines/140 characters. No session introduces more than two new hint keywords.

- [ ] **Step 5: Implement the market-card preview**

`market-card-preview.ts` renders the exact 1600×900 campaign at fit scale with product name, price and an anonymous seller badge outside the image. It displays audience-fit signals to the pair but does not rank or score them. Returning to edit preserves revision and history.

- [ ] **Step 6: Verify the thin loop**

```powershell
pnpm test:unit -- web/src/game
pnpm typecheck
```

Expected: tests pass. The real-browser diagnostic completes audience signal → product assembly → all AIDA tags → price → role swap → market preview without opening another application.

- [ ] **Step 7: Commit the pair loop**

```powershell
git add web/src/game web/src/ui/editor-shell.ts web/src/styles/editor.css web/tests/manual
git commit -m "feat: add pair creator game loop"
```

---

### Task 13: Keyboard Access, Offline Continuity and Classroom Performance

**Files:**
- Create: `web/src/ui/keyboard-controller.ts`
- Create: `web/src/ui/tablist-controller.ts`
- Create: `web/src/ui/layers-panel.ts`
- Create: `web/src/ui/live-announcer.ts`
- Create: `web/public/service-worker.js`
- Create: `web/src/offline/register-service-worker.ts`
- Create: `web/src/performance/performance-budget.ts`
- Create: `web/src/performance/diagnostic-recorder.ts`
- Create: `web/src/ui/keyboard-controller.test.ts`
- Create: `web/src/ui/tablist-controller.test.ts`
- Create: `web/src/performance/performance-budget.test.ts`
- Create: `scripts/verify-offline-core.mjs`
- Modify: `web/src/main.ts`
- Modify: `scripts/build-web.mjs`

**Interfaces:**
- Consumes: editor commands, catalogue, draft store, pair flow and build assembly.
- Produces: complete keyboard operation, non-colour-only state, offline continuation and measured budgets.

- [ ] **Step 1: Write failing accessibility and budget tests**

Test tablist arrow/Home/End behaviour, focus return after close, keyboard move/resize/rotate/layer/delete/undo/redo, lock/hidden announcements, reduced-motion state and no focus trap leakage. Test the hard budgets:

```ts
export const PERFORMANCE_BUDGET = Object.freeze({
  maxLiveThumbnails: 72,
  maxSearchP95Ms: 60,
  minScrollFps: 50,
  maxStudioOpenMs: 1500,
  maxPublishMs: 2500,
  maxLongTaskMs: 200,
  maxJsHeapMb: 512
});
```

- [ ] **Step 2: Run tests to verify RED**

```powershell
pnpm test:unit -- web/src/ui web/src/performance
```

Expected: FAIL because controllers and budgets do not exist.

- [ ] **Step 3: Implement keyboard and semantic state**

Provide:

- arrow movement (1 px; Shift 10 px);
- Alt+arrows resize;
- Ctrl+arrows reorder;
- `[`/`]` rotate;
- Ctrl+D duplicate, Delete remove, Ctrl+Z/Y history;
- Escape exit current tool before closing;
- real buttons, tabpanels and layer rows with visible text/icon states;
- polite announcements for selection/transform/history and assertive messages only for destructive or failed actions.

All actions must be reachable without interacting with the canvas pointer surface.

- [ ] **Step 4: Implement offline continuity**

Build a plain local `web/public/service-worker.js` that fetches a generated `offline-manifest.json` and precaches the Godot export, studio JS/CSS, offline core manifest, thumbnails, previews, fonts and material textures. `scripts/build-web.mjs` writes that manifest from the final build inventory. The service worker must not cache Openverse responses permanently. On network failure, the creator opens the most recent local draft and the reviewed core; a visible status reads `Using the classroom pack`.

`verify-offline-core.mjs` parses the generated precache manifest, asserts every URL exists under `build/web`, rejects remote URLs and verifies the core contains at least 1,000 records.

- [ ] **Step 5: Add measured browser diagnostics**

The diagnostic page runs 50 catalogue searches against 15,000 records, scrolls through 200 virtual windows, opens/closes the studio ten times, publishes three 1600×900 campaigns and records `PerformanceObserver` long tasks plus `performance.memory` when Chromium exposes it. It writes a downloadable JSON report with machine model/browser version entered once at start.

- [ ] **Step 6: Verify GREEN**

```powershell
pnpm test:unit -- web/src/ui web/src/performance
pnpm build
node scripts/verify-offline-core.mjs build/web
```

Expected: unit tests and build pass. In current Chromium, the online and network-disabled diagnostics pass every hard budget at 1366×768 and 1920×1080 with no more than 72 live thumbnail buttons.

- [ ] **Step 7: Commit classroom hardening**

```powershell
git add web/src/ui web/src/offline web/src/performance scripts web/src/main.ts web/tests/manual
git commit -m "feat: harden creator for classroom use"
```

---

### Task 14: Six Timed, Distinct Campaign Trials and Visual QA

**Files:**
- Create: `catalog/trials/briefs.json`
- Create: `catalog/trials/trial-protocol.md`
- Create: `catalog/trials/results.json`
- Create: `catalog/trials/exports/`
- Create: `catalog/trials/contact-sheet.webp`
- Create: `catalog/trials/visual-rubric.md`

**Interfaces:**
- Consumes: the complete creator, offline core and browser diagnostic.
- Produces: timed evidence that the creator can make six polished, recognisably different campaigns.

- [ ] **Step 1: Define six non-overlapping briefs**

Use six different audience/context/product combinations: heatwave commuter drinkware, rainy-weekend family game, noise-sensitive study accessory, low-waste travel kit, beginner outdoor safety product and budget-conscious pet-care product. Each brief specifies need, values and context but no visual solution, slogan or preselected asset.

- [ ] **Step 2: Lock the blind trial protocol**

Each trial:

1. starts from a blank document and cold browser session;
2. uses two roles and at least one handoff;
3. uses only the reviewed offline core;
4. receives two minutes for Round 0 and no more than 13 minutes for creation;
5. includes product name, price, all AIDA evidence and at least one advertising technique;
6. exports without developer console, direct JSON editing or arbitrary upload.

- [ ] **Step 3: Run and record all six trials**

Record start/end time, role handoff, asset IDs, material variants, object count, AIDA mapping, export hash, performance report and any stuck point in `results.json`. Preserve the six PNG exports and editable documents.

- [ ] **Step 4: Apply the visual rubric blind**

The rubric scores legibility at market-card size, focal hierarchy, product realism, colour/material coherence, typography, audience fit, AIDA clarity and visual distinction. A trial passes when:

- no essential text is clipped or unreadable;
- the product remains recognisable at 480×270;
- no two campaigns share the same dominant composition and product silhouette;
- at least five of eight rubric dimensions meet the defined competent anchor;
- all six exports complete within the 13-minute creation budget.

- [ ] **Step 5: Fix creator defects, not campaign content**

If a trial fails because of tool friction, asset gaps, performance or export defects, add a failing automated/diagnostic test, fix the creator or pack, rerun the affected trial from blank, and replace its result. Do not hand-polish the exported PNG outside the creator.

- [ ] **Step 6: Commit the trial evidence**

```powershell
git add catalog/trials catalog/reports
git commit -m "test: verify creator campaign range"
```

---

### Task 15: Creator Foundation Acceptance, Provenance and Handoff

**Files:**
- Create: `docs/creator-foundation-acceptance.md`
- Create: `docs/creator-foundation-teacher-run.md`
- Create: `docs/creator-foundation-student-controls.md`
- Create: `docs/creator-foundation-debrief.md`
- Create: `docs/creator-foundation-known-limits.md`
- Modify: `CREDITS.md`

**Interfaces:**
- Consumes: Tasks 1–14.
- Produces: one verified Godot Web Creator Foundation build and evidence package ready for the next separately specified game subproject.

- [ ] **Step 1: Run the full deterministic suite**

```powershell
pnpm typecheck
pnpm test:unit
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
& 'C:\Users\Peter Ellis\Godot\godot_current_console.exe' --headless --path godot --script tests/run_tests.gd
pnpm build
pnpm verify:export
node scripts/verify-offline-core.mjs build/web
```

Expected: every command exits `0`; no test is skipped; the final build is non-destructive and contains no remote runtime dependency.

- [ ] **Step 2: Run the real-browser acceptance script**

Use the generated build in a current Chromium browser on an ordinary Windows classroom laptop. Capture the diagnostic JSON, screenshots of blank/open/edited/published states, offline proof, six-trial contact sheet and console/network logs. Zero uncaught exceptions, failed local requests, critical accessibility violations or budget failures are permitted.

- [ ] **Step 3: Complete the acceptance matrix**

In `docs/creator-foundation-acceptance.md`, give each specification test an evidence path and PASS/FAIL status. A missing evidence path is FAIL; do not infer success from another test.

- [ ] **Step 4: Write concise operating material**

`teacher-run.md` covers launch, offline mode, pair handoff, publication check, safe Openverse toggle and recovery. `student-controls.md` uses game language only and stays under one screen. `debrief.md` moves from observation to audience/technique/effect transfer. `known-limits.md` states that content levels, Supabase market, teacher console and production catalogue expansion remain separate subprojects.

- [ ] **Step 5: Audit provenance and boundaries**

Confirm every third-party asset/dependency has a CREDITS entry; all new work is inside the Codex project; Games Workshop, the Godot installation and Claude-owned files are unchanged; no file deletion or OneDrive move occurred; and the working tree contains no untracked implementation artefact.

- [ ] **Step 6: Commit the accepted foundation**

```powershell
git add docs CREDITS.md
git commit -m "docs: accept creator foundation"
```

---

## Acceptance Traceability

| Spec test | Implemented by | Required evidence |
|---|---|---|
| 1. Same-page Godot/Fabric open-close | Tasks 1, 8, 13 | Godot contract test + browser focus/input trace |
| 2. Blank canvas adds raster/SVG/text/shapes | Tasks 4, 11 | object tests + browser diagnostic |
| 3. Transform/crop/layer/duplicate/delete | Tasks 4, 5 | command/crop tests + diagnostic |
| 4. Drawing/erasing and AIDA mapping | Tasks 5, 7, 12 | drawing/history/checklist tests |
| 5. Four-zone realistic recolouring | Tasks 6, 11 | synthetic pixel tests + four-category contact sheet |
| 6. 1,000 searchable virtualised records | Tasks 3, 11, 13 | 1,000/15,000 fixture and 72-node/performance reports |
| 7. Openverse placement and clean PNG | Tasks 7, 9 | proxy tests + browser export |
| 8. Ten-plus mixed undo/redo actions | Task 5 | twelve-action hash round-trip |
| 9. Editable save/reload fidelity | Task 7 | IndexedDB canonical hash round-trip |
| 10. Godot receives metadata and PNG bytes | Task 8 | cross-runtime contract trace |
| 11. Network-disabled usability | Tasks 9, 13 | offline build verification + blocked-network run |
| 12. Classroom-laptop responsiveness | Task 13 | diagnostic budget report at two viewport sizes |
| 13. 100 realistic masters/ten categories | Tasks 10, 11 | pipeline QA report and contact sheet |
| 14. Thousands of virtual appearances | Tasks 6, 11 | 24×12 renders across four categories |
| 15. Six polished distinct campaigns | Task 14 | timed results, editable documents, PNGs and blind rubric |

## Explicitly Deferred

The following remain outside this plan: the final three content levels beyond the thin creator-shaped trial, Supabase rooms, teacher console, live class market, fixed-wallet purchasing, simulated-market fallback, production catalogue expansion beyond the reviewed core, category-specific shell library, student uploads, YouTube scraping, live AI generation, Canva handoff and a permanent public gallery.
