# Product Kit Browser Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the strict browser-side `product-kit@1` sidecar parser that binds product bases, logical components, fixed mount frames and exact certifications to reviewed local PNG catalogue records.

**Architecture:** A Zod 4 strict-object graph validates syntax, discriminated frame types and bounded numeric authoring data. A second graph-validation pass binds every raster reference to the exact offline catalogue ID/hash/dimensions, enforces mode/slot/profile agreement, and keeps compatibility default-deny by exposing only exact certified pairs.

**Tech Stack:** TypeScript 7, Zod 4.4.3, Vitest 4.

## Global Constraints

- Create files only under `web/src/product-kit/` and this new plan path.
- The sidecar contains catalogue IDs and SHA-256 hashes, never file paths or SVG references.
- Valid composition modes are exactly `whole`, `socket`, `grip`, and `grid`.
- Valid fixed render layers are exactly `rear`, `body`, `front`, `artwork`, and `overlay`; component fragments in this contract use `rear`, `front`, or `overlay` because the kit base owns `body`.
- Raster frames explicitly preserve original dimensions and trim offsets; no alpha-bounds fitting or shear metadata is accepted.
- Every raster record must resolve to an offline, classroom-reviewed, brand-free canonical `master.png` record with an exact hash and exact trimmed dimensions.
- `whole` kits expose no mount frames and receive no certification.
- Structural kits expose only frames matching their composition mode.
- A certification is valid only when kit, frame, slot, component mount type, family, perspective, geometry, and style all match exactly.
- Components remain unavailable unless an exact certification exists; tags are not part of this contract.
- One logical component owns one `priceAssetId` even when it renders multiple PNG fragments.
- All public parsed data is deeply frozen.

---

### Task 1: Lock the four-mode contract with one valid fixture

**Files:**
- Create: `web/src/product-kit/product-kit-catalogue.test.ts`
- Create later: `web/src/product-kit/product-kit-catalogue.ts`

**Interfaces:**
- Consumes: an unknown sidecar value and `ProductKitCatalogueContext` containing the catalogue pack ID/hash and minimal offline asset records.
- Produces later: `parseProductKitCatalogue(value, context): ProductKitCatalogue | null`.

- [x] **Step 1: Write a canonical fixture covering all modes**

The fixture must contain sorted IDs for four kits (`grid`, `grip`, `socket`, `whole`), three logical components, and three exact certifications. Use one grip component with two fragments (`rear` and `front`) but one `priceAssetId`.

- [x] **Step 2: Write the first failing assertions**

Assert that parsing succeeds, all four modes survive, grip fragments remain one component, the full result is deeply frozen, and the caller-owned input/context remain unfrozen and unmodified.

- [x] **Step 3: Run the focused test and confirm the missing-module red state**

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run 'web/src/product-kit/product-kit-catalogue.test.ts' --no-cache --configLoader runner --reporter=verbose
```

Expected: failure resolving `./product-kit-catalogue`.

---

### Task 2: Implement strict Zod syntax and discriminated frame types

**Files:**
- Create: `web/src/product-kit/product-kit-catalogue.ts`
- Test: `web/src/product-kit/product-kit-catalogue.test.ts`

**Interfaces:**
- Produces: `ProductKitPoint`, `ProductKitNormal`, `ProductKitRasterFrame`, `ProductKitAssetReference`, `ProductKitCompatibilityProfile`, `ProductKitMountFrame`, `ProductKitComponentFrame`, `ProductKitKit`, `ProductKitComponent`, `ProductKitCertification`, `ProductKitCatalogue`, `ProductKitCatalogueContext`, and `parseProductKitCatalogue`.

- [x] **Step 1: Define exact scalar and frame schemas**

Use `z.strictObject`, `z.discriminatedUnion`, finite numbers, lowercase kebab IDs, `pk1-` domain IDs, lowercase 64-character SHA-256 values, normalized points/bounds, non-zero normals, positive reference scales, finite scale/rotation/normal-error constraints, and bounded raster frames.

- [x] **Step 2: Define the three structural mount-frame variants**

- `socket`: point, normal, reference scale and constraints.
- `grip`: exactly two ordered contacts, exactly two contact normals and constraints.
- `grid`: normalized origin/cell size, integer rows/columns, `floor` or `wall` plane, and sorted unique accepted edge types.

Every frame also has a unique `id` and reusable `slotId`.

- [x] **Step 3: Define matching component-frame variants**

Socket and grip component frames carry their authored attachment geometry. Grid component frames carry plane, positive integer footprint, and a strict north/east/south/west edge-type object.

- [x] **Step 4: Define strict kit, component, certification and top-level schemas**

Arrays are bounded. Kit/component/certification IDs and fragment layers are sorted and unique. Raster trim rectangles must fit inside their original dimensions. Grid extents must fit within the normalized design rectangle.

- [x] **Step 5: Parse with `safeParse` and return `null` on syntax failure**

Do not throw for student/runtime data. Do not mutate or freeze the caller's original value.

---

### Task 3: Enforce catalogue binding and default-deny compatibility

**Files:**
- Modify: `web/src/product-kit/product-kit-catalogue.ts`
- Modify: `web/src/product-kit/product-kit-catalogue.test.ts`

**Interfaces:**
- Consumes: syntactically valid output from Task 2 plus `ProductKitCatalogueContext`.
- Produces: a deeply frozen catalogue only when every graph and catalogue invariant passes.

- [x] **Step 1: Add failing catalogue-binding cases**

Reject: wrong pack/hash, unknown asset, stale asset hash, unreviewed asset, branded asset, non-offline asset, SVG/noncanonical master, and trim dimensions not equal to catalogue dimensions.

- [x] **Step 2: Add failing graph cases**

Reject: unsorted/duplicate IDs, whole kit with frames, structural mode/frame mismatch, duplicate frame IDs, unknown kit/frame/component certification reference, duplicate certified pair, mismatched slot, mismatched mount type, and any family/perspective/geometry/style mismatch.

- [x] **Step 3: Add logical-component and layer cases**

Reject duplicate or out-of-order fragment layers and any component without exactly one logical `priceAssetId`. Assert that two grip fragments still yield one component and therefore one future cost identity.

- [x] **Step 4: Implement one closed graph-validation pass**

Build local maps after schema parsing; validate every reference and pair without consulting tags or fuzzy rules. Do not repair, sort or coerce invalid input.

- [x] **Step 5: Deep-freeze a detached parsed copy**

Return the Zod-produced clone after recursive freezing. Confirm that arrays, records and nested geometry are all frozen.

---

### Task 4: Verify the browser boundary and neighbouring code

**Files:**
- Test: `web/src/product-kit/product-kit-catalogue.test.ts`
- Regression only: `web/src/product-builder/product-builder-catalogue.test.ts`

- [x] **Step 1: Run the focused product-kit suite**

Expected: all new contract tests pass.

- [x] **Step 2: Run strict TypeScript checking**

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
```

Expected: exit code 0.

- [x] **Step 3: Run the neighbouring catalogue regression**

Run both catalogue test files together. Expected: all existing 44 product-builder tests plus the new contract tests pass.

- [x] **Step 4: Request a fresh read-only task review**

The reviewer receives this plan, the two product-kit files and test evidence only. Both terminal verdicts—specification and quality—must approve before the JSON Schema/Python mirror plan begins.

## Self-Review

- Spec coverage: four modes, fixed layers, explicit frames, reviewed PNG binding, reference dimensions, one logical price identity, exact certification and default-deny compatibility are each covered.
- Placeholder scan: no `TODO`, `TBD`, or unspecified “appropriate validation” step remains.
- Type consistency: the parser and all named interfaces are introduced in Task 2 and consumed only after that task.
- Deferred deliberately: JSON Schema/Pydantic parity, certification fingerprint computation, grid placement, compositor, economics, Studio UI and app integration remain separate testable milestones.
