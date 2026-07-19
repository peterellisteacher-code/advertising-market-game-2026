# Product Kit Runtime Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Keep each red/green cycle isolated and do not edit existing product-builder modules.

**Goal:** Turn a parsed `product-kit@1` catalogue into default-deny certified socket, grip and grid placements, then produce one immutable renderer-neutral five-layer plan with one price identity per logical placement.

**Architecture:** New pure TypeScript modules under `web/src/product-kit/` sit after structural parsing. A local synchronous UTF-8 SHA-256 kernel verifies exact certification evidence without an asynchronous gap. Grid occupancy and layer planning remain independent pure kernels. A final runtime composes those kernels and reuses only the approved connector transforms and product-kit catalogue types.

**Tech Stack:** TypeScript 7, Vitest 4, strict `tsconfig`, no DOM, no SVG, no image loading.

## Global Constraints

- Create or modify only `web/src/product-kit/**` and this plan.
- Do not import from `product-svg-composer`, `product-builder-panel`, `virtual-product-variant`, product economics, or other dirty integration surfaces.
- Compatibility is exact and default-deny. Missing, malformed or stale certification returns `null` before transform or composition work.
- Certification covers visual fit as well as connector geometry: exact base and fragment asset IDs, SHA-256 values and raster frames are fingerprint inputs.
- Fixed render layers are exactly `rear`, `body`, `front`, `artwork`, `overlay`.
- One logical component placement has one `priceAssetId`, regardless of fragment count; repeated grid placements are separately priced.
- Stored grid state uses integer cells, never pointer floats. Plane, footprint, occupancy and touching edges must match exactly.
- All numeric inputs must be finite and bounded; all outputs are detached and deeply frozen; caller input is never mutated.
- Sorting is deterministic code-unit order, never locale-sensitive.

---

### Task 1: Add a local synchronous UTF-8 SHA-256 kernel

**Files:**
- Create: `web/src/product-kit/utf8-sha256.test.ts`
- Create: `web/src/product-kit/utf8-sha256.ts`

- [x] Write failing standard-vector tests for empty text, `abc`, a multi-block message and Unicode.
- [x] Implement `sha256Utf8(value: string): string` with `TextEncoder`, 32-bit SHA-256 rounds and lowercase 64-character hexadecimal output.
- [x] Reject malformed UTF-16 containing unpaired surrogates rather than hashing replacement characters.
- [x] Verify input is not mutated and repeated calls are deterministic.
- [x] Run the focused test and strict TypeScript checking.

### Task 2: Canonicalise and verify exact certification evidence

**Files:**
- Create: `web/src/product-kit/certification-fingerprint.test.ts`
- Create: `web/src/product-kit/certification-fingerprint.ts`

**Public interfaces:**

```ts
export interface ProductKitCertificationContext {
  readonly packId: string;
  readonly connectorFormulaVersion: string;
}

export function canonicalCertificationInput(
  context: ProductKitCertificationContext,
  kit: ProductKitKit,
  frame: ProductKitMountFrame,
  component: ProductKitComponent
): string | null;

export function computeCertificationFingerprint(
  context: ProductKitCertificationContext,
  kit: ProductKitKit,
  frame: ProductKitMountFrame,
  component: ProductKitComponent
): string | null;
```

- [x] Write failing exact-snapshot tests for socket, grip and grid evidence.
- [x] Build every discriminated frame variant explicitly; do not hash arbitrary object enumeration.
- [x] Canonical payload includes fingerprint schema/version, pack ID, connector formula version, kit ID/mode/profile, exact kit base asset/hash/frame, complete selected mount frame, component ID/slot/profile/frame, and every ordered fragment layer plus exact asset/hash/frame.
- [x] Encode each absent grid edge explicitly as `null`; use compact JSON with fixed key construction and no final LF.
- [x] Exclude titles, artwork bounds and price IDs because they do not affect reviewed visual attachment; tests must prove those changes do not alter the fingerprint.
- [x] Prove every included geometry/profile/raster/formula/pack field changes the fingerprint and property insertion order does not.
- [x] Add `certificationFingerprintMatches(...)` and require lowercase constant-length equality.
- [x] Run focused tests and strict TypeScript checking.

### Task 3: Add deterministic grid snapping and occupancy

**Files:**
- Create: `web/src/product-kit/grid-placement.test.ts`
- Create: `web/src/product-kit/grid-placement.ts`

**Public interfaces:**

```ts
export interface ProductKitGridCell { readonly column: number; readonly row: number; }
export interface ProductKitGridTile {
  readonly placementId: string;
  readonly componentId: string;
  readonly column: number;
  readonly row: number;
  readonly footprint: { readonly columns: number; readonly rows: number };
  readonly edgeTypes: {
    readonly north?: string; readonly east?: string;
    readonly south?: string; readonly west?: string;
  };
}
export interface ProductKitGridOccupancy {
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly (string | null)[];
  readonly placements: readonly ProductKitGridTile[];
}
```

- [x] Write failing floor and wall snapping tests using desired normalized top-left coordinates.
- [x] Snap with nearest-cell `Math.floor(offset + 0.5)` so exact ties go east/south; reject non-finite, outside and footprint-overflow requests.
- [x] Write failing occupancy tests for duplicate placement IDs, non-safe integers, out-of-bounds footprints and overlap.
- [x] Require every declared edge to appear in the mount frame's sorted `acceptedEdgeTypes`.
- [x] For orthogonally touching rectangles, allow both edges absent or exact equal strings; reject one-sided and different edges. Diagonal contact imposes no edge rule. Do not invent outer-boundary rules because the contract has no boundary-edge metadata.
- [x] Return row-major cells and placements sorted by row, column and placement ID; deep-freeze detached output.
- [x] Run focused tests and strict TypeScript checking.

### Task 4: Add the renderer-neutral five-layer plan

**Files:**
- Create: `web/src/product-kit/layer-plan.test.ts`
- Create: `web/src/product-kit/layer-plan.ts`

- [x] Lock `PRODUCT_KIT_LAYER_ORDER` to `rear`, `body`, `front`, `artwork`, `overlay`.
- [x] Define resolved affine and grid placement inputs carrying stable `placementId`, component, mount-frame identity and transform/grid bounds.
- [x] Define raster render entries, artwork-slot descriptors and priced items as a closed discriminated union.
- [x] Place the kit base exactly once in `body`; route component fragments only to their declared layer; emit kit artwork bounds only in `artwork`.
- [x] Emit one base priced item plus exactly one component priced item per placement, even when a component has rear/front/overlay fragments.
- [x] Prove repeated grid instances create repeated price lines while a two-fragment handle remains one priced item.
- [x] Canonically order buckets and entries, deep-freeze output, and reject duplicate placement IDs or malformed resolved placements.
- [x] Run focused tests and strict TypeScript checking.

### Task 5: Orchestrate certified placement and composition

**Files:**
- Create: `web/src/product-kit/product-kit-runtime.test.ts`
- Create: `web/src/product-kit/product-kit-runtime.ts`

**Public interface:**

```ts
export interface ProductKitRuntime {
  readonly resolvePair: (request: ProductKitPairRequest) =>
    ProductKitCertifiedPair | null;
  readonly planComposition: (request: ProductKitCompositionRequest) =>
    ProductKitLayerPlan | null;
}

export function createProductKitRuntime(
  catalogue: ProductKitCatalogue
): ProductKitRuntime;
```

- [x] Build immutable kit, component, frame and certification indices once without mutating the parsed catalogue.
- [x] Recompute every referenced certification fingerprint and expose only exact matches; missing or stale pairs remain unavailable.
- [x] Resolve socket and grip pairs through `resolveSocketTransform` and `resolveGripTransform` using the certified frame/component data.
- [x] Resolve grid pairs only when plane, footprint and exact certification match; validate placements through the grid kernel.
- [x] Allow at most one socket/grip placement per mount frame; group repeated grid placements by grid frame; reject duplicate placement IDs and request-kind mismatches.
- [x] Produce the five-layer plan only after every requested placement succeeds. Any invalid request returns `null` with no partial plan.
- [x] Prove formula/profile/frame/raster staleness is rejected before transform, exact cup-handle scale works across base sizes, floor/wall grids work, and frozen caller input remains unchanged.
- [x] Run all product-kit tests and strict TypeScript checking.

### Task 6: Regression, review and handoff

- [x] Run all browser tests, not only product-kit tests.
- [x] Run `git diff --check` over the new paths and confirm no existing product-builder file changed.
- [ ] Request one fresh read-only specification/quality review with no inherited context or preferred verdict.
- [ ] Resolve required findings once, rerun focused/full tests, and obtain an approving fresh gate.
- [x] Record the exact fingerprint payload contract for the later Python authoring mirror and pilot manifest generator.

Fusion review note: the sealed coding review exhausted its one diagnosed retry
without a usable verdict. The first synthesis omitted its required terminal
verdict; the retry ended with response_invalid (fusion_invalid_json). No Fusion
approval is claimed.

## Deferred Deliberately

- Python fingerprint generation/verification and pilot catalogue authoring.
- PNG loading, raster compositing, tint/mask/material effects and export.
- Economics adapter, semantic saves, Studio UI and market publishing.
- Grid rotation; the current catalogue has no explicit rotation permission and therefore remains default-deny.
