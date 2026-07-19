# Independent coding review: Product Kit contract and runtime kernel

## Review task

Perform a fresh, isolated, unguided and adversarial technical review of the supplied Product Kit contract implementation for a browser-delivered Godot learning game. Assess the implementation against the supplied plans and evidence. Do not assume any defect or preferred verdict.

Report only actionable correctness, security, determinism, cross-language parity, numerical, validation-boundary, immutability, offline-binding, performance, and maintainability findings. Rank findings P0–P3, cite exact file and line or symbol, explain a concrete failure case, and propose the smallest sound remedy. Distinguish mandatory findings from optional improvements. End with exactly one terminal verdict:

- APPROVE
- CHANGES_REQUIRED

## Acceptance constraints

- Product structures are raster-only; no SVG path exists in this contract.
- A product is a semantic composition of a whole/base raster plus zero or more certified socket, grip, or integer-grid components.
- Rendering uses a deterministic five-layer plan: rear, body, front, artwork, overlay.
- Certifications bind exact kit, mount-frame, component, connector-formula, compatibility-profile, and raster identities through canonical fingerprints.
- Only catalogue records that are exact-hash matched, offline-delivered, classroom-reviewed, brand-free, dimension-matched, and on the canonical pack path may be admitted.
- Browser runtime creation must trust only catalogue objects produced by the context-aware parser; structurally similar caller-created objects must fail closed.
- Every public JavaScript boundary must tolerate hostile proxies/accessors, inherited or nonstandard shapes, sparse arrays, cycles, symbols, mutable caller input, and bounded resource limits without executing accessors or throwing.
- A fresh plain-data snapshot must detach on every invocation and reapply the requested traversal limits.
- Connector math accepts only finite, non-signed-zero contract values. A returned transform must map every certified contact with absolute residual at most 1e-8. Stable finite ratios must not fail solely because a naïve intermediate overflows.
- Grid placement uses exact integer cells, deterministic edge compatibility, bounds checking, and overlap rejection.
- Python Pydantic validation, JSON Schema, Zod validation, and the shared mutation corpus must agree on admission semantics.
- All returned runtime plans and values are detached and deeply immutable.
- Invalid or stale inputs produce null/no plan, never a partial plan.
- The supplied evidence is code and synthetic test data only; it contains no student-identifying or confidential material.

## Verification evidence

- Focused browser Product Kit gate: 9 test files, 336/336 tests passed.
- Strict TypeScript: tsc --noEmit exited 0 with no diagnostics.
- Full browser gate, forced single worker: 85 test files, 1,233/1,233 tests passed in 116.39 seconds.
- Python Product Kit gate: 95/95 tests passed.
- The review evidence below is self-contained and includes the four governing plans, shared schema and corpus, Python implementation and tests, and all browser Product Kit implementation and tests.


## FILE: docs/superpowers/plans/2026-07-16-product-kit-connector-foundation.md

```markdown
# Product Kit Connector Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, engine-independent transform kernel for product-kit socket and two-contact grip attachments.

**Architecture:** The module uses Canvas-style affine matrices and normalized authoring frames. Socket transforms map a point, normal and reference scale; grip transforms evaluate unmirrored and, when explicitly permitted, mirrored similarity transforms, then fail closed against scale, rotation and per-contact normal constraints.

**Tech Stack:** TypeScript 7, Vitest 4, strict `tsconfig` settings.

## Global Constraints

- Work only in the new `web/src/product-kit/` namespace.
- Do not modify, stage, clean, regenerate or commit existing dirty paths.
- Do not introduce SVG, DOM, Fabric, Godot or image-loading dependencies.
- All input numbers must be finite; degenerate geometry returns `null`.
- Mirroring is default-deny and may occur only when `mirrorAllowed` is `true`.
- A resolved transform must place its authored contact point or points on the target within `1e-8`.
- The affine convention is `x' = a*x + c*y + e`, `y' = b*x + d*y + f`.

---

### Task 1: Lock the connector contract with failing tests

**Files:**
- Create: `web/src/product-kit/connector-transform.test.ts`
- Create later: `web/src/product-kit/connector-transform.ts`

**Interfaces:**
- Consumes: no existing runtime module.
- Produces: `applyTransform`, `resolveSocketTransform`, `resolveGripTransform`, `Point`, `Vector`, `SocketFrame`, `GripFrame`, `TransformConstraints`, `ResolvedMountTransform`.

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  applyTransform,
  resolveGripTransform,
  resolveSocketTransform,
  type GripFrame,
  type TransformConstraints
} from "./connector-transform";

const constraints = (overrides: Partial<TransformConstraints> = {}): TransformConstraints => ({
  minScale: 0.5,
  maxScale: 3,
  minRotationDegrees: -180,
  maxRotationDegrees: 180,
  maxNormalErrorDegrees: 2,
  mirrorAllowed: false,
  ...overrides
});

describe("socket connector transforms", () => {
  it("maps the authored point and uses the reference-scale ratio", () => {
    const result = resolveSocketTransform(
      { point: { x: 2, y: 3 }, normal: { x: 1, y: 0 }, referenceScale: 4 },
      { point: { x: 10, y: 20 }, normal: { x: 0, y: 1 }, referenceScale: 8 },
      constraints()
    );

    expect(result).toMatchObject({ scale: 2, rotationDegrees: 90, mirrored: false });
    expect(applyTransform(result!.matrix, { x: 2, y: 3 })).toEqual({ x: 10, y: 20 });
  });
});

describe("two-contact grip transforms", () => {
  const source: GripFrame = {
    contacts: [{ x: 0, y: 0 }, { x: 2, y: 0 }],
    normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
  };

  it("maps both contacts exactly and reports deterministic scale and rotation", () => {
    const result = resolveGripTransform(source, {
      contacts: [{ x: 10, y: 10 }, { x: 10, y: 14 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    }, constraints());

    expect(result).toMatchObject({ scale: 2, rotationDegrees: 90, mirrored: false });
    expect(applyTransform(result!.matrix, source.contacts[0])).toEqual({ x: 10, y: 10 });
    expect(applyTransform(result!.matrix, source.contacts[1])).toEqual({ x: 10, y: 14 });
  });

  it("derives three cup-size scales from the same authored handle", () => {
    const handle: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    const scaleFor = (height: number) => resolveGripTransform(handle, {
      contacts: [{ x: 4, y: 2 }, { x: 4, y: 2 + height }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    }, constraints())?.scale;

    expect([scaleFor(0.8), scaleFor(1), scaleFor(1.25)]).toEqual([0.8, 1, 1.25]);
  });

  it("uses mirroring only when it is permitted and normals require it", () => {
    const target: GripFrame = {
      contacts: [{ x: 10, y: 10 }, { x: 8, y: 10 }],
      normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
    };

    expect(resolveGripTransform(source, target, constraints())).toBeNull();
    expect(resolveGripTransform(source, target, constraints({ mirrorAllowed: true })))
      .toMatchObject({ mirrored: true, rotationDegrees: 0, scale: 1 });
  });

  it("fails closed for degenerate frames and breached scale or rotation limits", () => {
    const degenerate: GripFrame = {
      contacts: [{ x: 1, y: 1 }, { x: 1, y: 1 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    expect(resolveGripTransform(degenerate, source, constraints())).toBeNull();
    expect(resolveGripTransform(source, {
      contacts: [{ x: 0, y: 0 }, { x: 8, y: 0 }],
      normals: source.normals
    }, constraints({ maxScale: 2 }))).toBeNull();
    expect(resolveGripTransform(source, {
      contacts: [{ x: 0, y: 0 }, { x: 0, y: 2 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    }, constraints({ minRotationDegrees: -30, maxRotationDegrees: 30 }))).toBeNull();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run:

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run 'web/src/product-kit/connector-transform.test.ts' --no-cache --configLoader runner --reporter=verbose
```

Expected: FAIL because `./connector-transform` does not exist.

- [x] **Step 3: Confirm the red state is the intended missing-module failure**

Inspect the output and proceed only if the failure names `connector-transform`; unrelated configuration or dependency failures must be diagnosed first.

---

### Task 2: Implement finite, constrained socket and grip transforms

**Files:**
- Create: `web/src/product-kit/connector-transform.ts`
- Test: `web/src/product-kit/connector-transform.test.ts`

**Interfaces:**
- Consumes: the contract locked in Task 1.
- Produces: Canvas-style affine transforms with scale, wrapped rotation, mirror state and maximum normal error.

- [x] **Step 1: Add the public types and pure geometry helpers**

```ts
export interface Point { readonly x: number; readonly y: number; }
export interface Vector { readonly x: number; readonly y: number; }
export interface AffineTransform {
  readonly a: number; readonly b: number; readonly c: number;
  readonly d: number; readonly e: number; readonly f: number;
}
export interface SocketFrame {
  readonly point: Point;
  readonly normal: Vector;
  readonly referenceScale: number;
}
export interface GripFrame {
  readonly contacts: readonly [Point, Point];
  readonly normals: readonly [Vector, Vector];
}
export interface TransformConstraints {
  readonly minScale: number;
  readonly maxScale: number;
  readonly minRotationDegrees: number;
  readonly maxRotationDegrees: number;
  readonly maxNormalErrorDegrees: number;
  readonly mirrorAllowed: boolean;
}
export interface ResolvedMountTransform {
  readonly matrix: AffineTransform;
  readonly scale: number;
  readonly rotationDegrees: number;
  readonly mirrored: boolean;
  readonly maxNormalErrorDegrees: number;
}
```

- [x] **Step 2: Implement `applyTransform` and socket resolution**

Use normalized normals, `scale = target.referenceScale / source.referenceScale`, wrapped angle difference in `[-180, 180]`, and translation that maps the source point exactly. Reject non-finite values, zero normals, non-positive reference scales and every breached constraint.

- [x] **Step 3: Implement grip candidate evaluation**

Evaluate the non-mirrored candidate first and the X-reflected candidate only when `mirrorAllowed` is true. For each candidate, map the ordered contact span by a uniform similarity transform, translate contact zero exactly, calculate each transformed-normal angular error, reject any error above `maxNormalErrorDegrees`, and reject transform residuals above `1e-8`.

- [x] **Step 4: Make candidate selection deterministic**

Sort valid candidates by lowest maximum normal error, then lowest average normal error, then prefer unmirrored. Return `null` when no candidate survives.

- [x] **Step 5: Run the focused tests**

Run the Task 1 command.

Expected: 5 tests pass.

- [x] **Step 6: Run strict typechecking**

Run:

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
```

Expected: exit code 0 with no output.

- [x] **Step 7: Record the checkpoint without staging the dirty worktree**

Run:

```powershell
git diff --check -- web/src/product-kit/connector-transform.ts web/src/product-kit/connector-transform.test.ts
git status --short -- web/src/product-kit
```

Expected: no whitespace errors; only the two new product-kit files appear.

---

### Task 3: Add adversarial numeric and immutability coverage

**Files:**
- Modify: `web/src/product-kit/connector-transform.test.ts`
- Modify only if a test exposes a defect: `web/src/product-kit/connector-transform.ts`

**Interfaces:**
- Consumes: Task 2 transform functions.
- Produces: evidence that malformed frames fail closed and inputs remain unchanged.

- [x] **Step 1: Add table-driven red tests**

Add cases for `NaN`, `Infinity`, zero normals, negative reference scale, reversed constraint bounds, normal error just outside the bound, and source/target objects frozen with `Object.freeze`. Assert malformed cases return `null` and frozen inputs are unchanged.

- [x] **Step 2: Run the focused suite and confirm each new case is meaningful**

Run the Task 1 command. Expected before any required fix: at least one new adversarial assertion fails for a specific input-validation reason; if all pass, retain them as regression coverage.

- [x] **Step 3: Apply the smallest implementation correction**

Change only the validation or candidate-selection branch proven deficient by Step 2; do not expand the API.

- [x] **Step 4: Re-run focused tests and typechecking**

Expected: all connector tests pass and TypeScript exits 0.

- [x] **Step 5: Run the neighbouring product-builder regression**

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run 'web/src/product-builder/product-builder-catalogue.test.ts' 'web/src/product-kit/connector-transform.test.ts' --no-cache --configLoader runner --reporter=verbose
```

Expected: both files pass; existing product-builder behaviour is unchanged.

## Self-Review

- Spec coverage: socket scale, grip scale/rotation, exact contacts, normals, mirroring, constraint failure and no engine coupling each have an implementation step and test.
- Placeholder scan: no `TODO`, `TBD`, “similar to” or unspecified error-handling step remains.
- Type consistency: all function and type names used by tests are defined in Task 2.
- Deferred deliberately: schema parsing, grid snapping, compatibility certification, raster composition, UI and asset generation each receive a separate focused plan after this kernel is green.


```

## FILE: docs/superpowers/plans/2026-07-16-product-kit-offline-contract.md

```markdown
# Product Kit Offline Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror the approved browser `product-kit@1` contract in the offline Python authoring pipeline and prove both runtimes accept and reject the same shared corpus.

**Architecture:** New files under `pipeline/product_kit/` provide strict Pydantic 2 models and a catalogue-binding graph validator. A Draft 2020-12 structural schema and shared corpus under `catalog/schemas/` prevent contract drift; semantic checks that JSON Schema cannot express remain explicitly tested in Python and TypeScript.

**Tech Stack:** Python 3.12, Pydantic 2.13.4, jsonschema 4.26, pytest, TypeScript 7, Zod 4.4.3, Vitest 4.

## Global Constraints

- Do not modify existing `asset_pipeline` schema code or the generic `catalog-asset@1` contract.
- Create only `pipeline/product_kit/**`, `pipeline/tests/test_product_kit_schema.py`, `pipeline/tests/test_product_kit_pack.py`, `catalog/schemas/product-kit-v1.*`, and a product-kit shared-corpus browser test.
- Mirror all exact browser literals, bounds, discriminators and additional-property prohibitions.
- JSON input uses camelCase; Python attributes use snake_case and canonical output returns camelCase.
- Validate without coercion, NaN or infinity.
- Bind only reviewed, brand-free, offline canonical PNG assets with exact hashes and trim dimensions.
- Enforce globally unique frame IDs, sorted/unique IDs and layers, exact certified profiles/slots/types, feasible socket/grip transforms, and valid grid edges/footprints.
- Keep compatibility default-deny; no tag-based or fuzzy approval.
- Canonical serialization is UTF-8, sorted-key, compact JSON with one final LF.
- Generated pack writes must fail if their versioned destination already exists; destructive overwrite is forbidden.

---

### Task 1: Add strict Pydantic models and graph validation

**Files:**
- Create: `pipeline/product_kit/__init__.py`
- Create: `pipeline/product_kit/schema.py`
- Create: `pipeline/tests/test_product_kit_schema.py`

- [ ] Write a failing valid-four-mode test and table-driven invalid syntax/graph tests matching the approved browser cases.
- [ ] Implement strict extra-forbid camelCase Pydantic models for raster frames, profiles, constraints, socket/grip/grid frames, kits, components and certifications.
- [ ] Implement catalogue binding, global frame identity, exact certification, connector feasibility and grid compatibility.
- [ ] Implement canonical JSON serialization and assert deterministic camelCase bytes.
- [ ] Run `pipeline\.venv\Scripts\python.exe -m pytest pipeline\tests\test_product_kit_schema.py -q` and require all tests green.

### Task 2: Add the shared cross-language corpus

**Files:**
- Create: `catalog/schemas/product-kit-v1.corpus.json`
- Modify: `pipeline/tests/test_product_kit_schema.py`
- Create: `web/src/product-kit/product-kit-corpus.test.ts`

- [ ] Store one canonical four-mode value/context plus derived invalid mutations with exact paths and values.
- [ ] Make Python validate every corpus case against the Pydantic/graph contract.
- [ ] Make TypeScript apply the same mutations and assert the same verdicts through `parseProductKitCatalogue`.
- [ ] Include syntax, bounds, identity, catalogue binding, transform, grid and default-deny cases.

### Task 3: Add Draft 2020-12 structural schema parity

**Files:**
- Create: `catalog/schemas/product-kit-v1.schema.json`
- Modify: `pipeline/tests/test_product_kit_schema.py`

- [ ] Encode exact keys, discriminators, numeric bounds, tuple lengths, path-free raster references and collection limits.
- [ ] Validate the schema with `Draft202012Validator.check_schema`.
- [ ] Assert all structurally valid corpus values pass and all structural invalid cases fail.
- [ ] Document semantic-only cases in corpus metadata and prove Pydantic/TypeScript reject them.

### Task 4: Add fail-no-overwrite pack writing

**Files:**
- Create: `pipeline/product_kit/pack.py`
- Create: `pipeline/tests/test_product_kit_pack.py`

- [ ] Write failing tests for canonical output, missing parent, existing destination, invalid manifest and no partial output.
- [ ] Validate before writing, create only a previously absent versioned destination, write through a sibling temporary file, then atomically rename.
- [ ] On any error, leave neither a destination file nor temporary residue.
- [ ] Run the two focused product-kit Python test files, then the full pipeline suite.

### Task 5: Cross-runtime verification and review

- [ ] Run all product-kit browser tests and strict TypeScript checking.
- [ ] Run all product-kit Python tests and the full existing pipeline suite.
- [ ] Confirm only new low-collision paths changed.
- [ ] Request a fresh read-only contract review; both specification and quality verdicts must approve before authoring the pilot manifest.

## Self-Review

- The plan covers strict syntax, semantic graph checks, shared runtime parity, structural JSON Schema, deterministic serialization and non-overwriting pack output.
- No existing generic catalogue schema or dirty integration surface is modified.
- Certification fingerprint computation remains a separate milestone; this contract validates its exact SHA-256 shape and pair inputs.


```

## FILE: docs/superpowers/plans/2026-07-16-product-kit-browser-contract.md

```markdown
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


```

## FILE: docs/superpowers/plans/2026-07-16-product-kit-runtime-kernel.md

```markdown
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
- [ ] Record the exact fingerprint payload contract for the later Python authoring mirror and pilot manifest generator.

## Deferred Deliberately

- Python fingerprint generation/verification and pilot catalogue authoring.
- PNG loading, raster compositing, tint/mask/material effects and export.
- Economics adapter, semantic saves, Studio UI and market publishing.
- Grid rotation; the current catalogue has no explicit rotation permission and therefore remains default-deny.


```

## FILE: catalog/schemas/product-kit-v1.schema.json

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://admarket.classroom.invalid/schemas/product-kit-v1.schema.json",
  "$comment": "Structural product-kit@1 contract. Browser and Python graph validators enforce catalogue binding, canonical fragment layer order, feasible connectors, grid compatibility, and other cross-record semantics.",
  "$defs": {
    "AssetReference": {
      "additionalProperties": false,
      "properties": {
        "assetId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Assetid",
          "type": "string"
        },
        "masterSha256": {
          "pattern": "^[0-9a-f]{64}(?![\\s\\S])",
          "title": "Mastersha256",
          "type": "string"
        },
        "frame": {
          "$ref": "#/$defs/RasterFrame"
        }
      },
      "required": [
        "assetId",
        "masterSha256",
        "frame"
      ],
      "title": "AssetReference",
      "type": "object"
    },
    "Bounds": {
      "additionalProperties": false,
      "properties": {
        "x": {
          "maximum": 1.0,
          "minimum": 0.0,
          "title": "X",
          "type": "number"
        },
        "y": {
          "maximum": 1.0,
          "minimum": 0.0,
          "title": "Y",
          "type": "number"
        },
        "width": {
          "exclusiveMinimum": 0.0,
          "maximum": 1.0,
          "title": "Width",
          "type": "number"
        },
        "height": {
          "exclusiveMinimum": 0.0,
          "maximum": 1.0,
          "title": "Height",
          "type": "number"
        }
      },
      "required": [
        "x",
        "y",
        "width",
        "height"
      ],
      "title": "Bounds",
      "type": "object"
    },
    "CellSize": {
      "additionalProperties": false,
      "properties": {
        "width": {
          "exclusiveMinimum": 0.0,
          "maximum": 1.0,
          "title": "Width",
          "type": "number"
        },
        "height": {
          "exclusiveMinimum": 0.0,
          "maximum": 1.0,
          "title": "Height",
          "type": "number"
        }
      },
      "required": [
        "width",
        "height"
      ],
      "title": "CellSize",
      "type": "object"
    },
    "Certification": {
      "additionalProperties": false,
      "properties": {
        "id": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Id",
          "type": "string"
        },
        "kitId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Kitid",
          "type": "string"
        },
        "mountFrameId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Mountframeid",
          "type": "string"
        },
        "componentId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Componentid",
          "type": "string"
        },
        "fingerprint": {
          "pattern": "^[0-9a-f]{64}(?![\\s\\S])",
          "title": "Fingerprint",
          "type": "string"
        }
      },
      "required": [
        "id",
        "kitId",
        "mountFrameId",
        "componentId",
        "fingerprint"
      ],
      "title": "Certification",
      "type": "object"
    },
    "CompatibilityProfile": {
      "additionalProperties": false,
      "properties": {
        "familyId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Familyid",
          "type": "string"
        },
        "perspectiveId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Perspectiveid",
          "type": "string"
        },
        "geometryId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Geometryid",
          "type": "string"
        },
        "styleId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Styleid",
          "type": "string"
        }
      },
      "required": [
        "familyId",
        "perspectiveId",
        "geometryId",
        "styleId"
      ],
      "title": "CompatibilityProfile",
      "type": "object"
    },
    "Component": {
      "additionalProperties": false,
      "properties": {
        "id": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Id",
          "type": "string"
        },
        "title": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^(?![\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff])(?![\\s\\S]*[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]$)[^\\u0000-\\u001f]+$",
          "title": "Title",
          "type": "string"
        },
        "slotId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Slotid",
          "type": "string"
        },
        "compatibilityProfile": {
          "$ref": "#/$defs/CompatibilityProfile"
        },
        "componentFrame": {
          "discriminator": {
            "mapping": {
              "grid": "#/$defs/GridComponentFrame",
              "grip": "#/$defs/GripComponentFrame",
              "socket": "#/$defs/SocketComponentFrame"
            },
            "propertyName": "mountType"
          },
          "oneOf": [
            {
              "$ref": "#/$defs/SocketComponentFrame"
            },
            {
              "$ref": "#/$defs/GripComponentFrame"
            },
            {
              "$ref": "#/$defs/GridComponentFrame"
            }
          ],
          "title": "Componentframe"
        },
        "fragments": {
          "items": {
            "$ref": "#/$defs/Fragment"
          },
          "maxItems": 3,
          "minItems": 1,
          "title": "Fragments",
          "type": "array",
          "oneOf": [
            {
              "minItems": 1,
              "maxItems": 1
            },
            {
              "minItems": 2,
              "maxItems": 2,
              "prefixItems": [
                {
                  "properties": {
                    "layer": { "const": "rear" }
                  }
                },
                {
                  "properties": {
                    "layer": { "const": "front" }
                  }
                }
              ]
            },
            {
              "minItems": 2,
              "maxItems": 2,
              "prefixItems": [
                {
                  "properties": {
                    "layer": { "const": "rear" }
                  }
                },
                {
                  "properties": {
                    "layer": { "const": "overlay" }
                  }
                }
              ]
            },
            {
              "minItems": 2,
              "maxItems": 2,
              "prefixItems": [
                {
                  "properties": {
                    "layer": { "const": "front" }
                  }
                },
                {
                  "properties": {
                    "layer": { "const": "overlay" }
                  }
                }
              ]
            },
            {
              "minItems": 3,
              "maxItems": 3,
              "prefixItems": [
                {
                  "properties": {
                    "layer": { "const": "rear" }
                  }
                },
                {
                  "properties": {
                    "layer": { "const": "front" }
                  }
                },
                {
                  "properties": {
                    "layer": { "const": "overlay" }
                  }
                }
              ]
            }
          ]
        },
        "priceAssetId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Priceassetid",
          "type": "string"
        }
      },
      "required": [
        "id",
        "title",
        "slotId",
        "compatibilityProfile",
        "componentFrame",
        "fragments",
        "priceAssetId"
      ],
      "title": "Component",
      "type": "object"
    },
    "EdgeTypes": {
      "additionalProperties": false,
      "properties": {
        "north": {
          "title": "North",
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "type": "string"
        },
        "east": {
          "title": "East",
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "type": "string"
        },
        "south": {
          "title": "South",
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "type": "string"
        },
        "west": {
          "title": "West",
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "type": "string"
        }
      },
      "title": "EdgeTypes",
      "type": "object"
    },
    "Footprint": {
      "additionalProperties": false,
      "properties": {
        "columns": {
          "maximum": 64,
          "minimum": 1,
          "title": "Columns",
          "type": "integer"
        },
        "rows": {
          "maximum": 64,
          "minimum": 1,
          "title": "Rows",
          "type": "integer"
        }
      },
      "required": [
        "columns",
        "rows"
      ],
      "title": "Footprint",
      "type": "object"
    },
    "Fragment": {
      "additionalProperties": false,
      "properties": {
        "layer": {
          "enum": [
            "rear",
            "front",
            "overlay"
          ],
          "title": "Layer",
          "type": "string"
        },
        "raster": {
          "$ref": "#/$defs/AssetReference"
        }
      },
      "required": [
        "layer",
        "raster"
      ],
      "title": "Fragment",
      "type": "object"
    },
    "GridComponentFrame": {
      "additionalProperties": false,
      "properties": {
        "mountType": {
          "const": "grid",
          "title": "Mounttype",
          "type": "string"
        },
        "plane": {
          "enum": [
            "floor",
            "wall"
          ],
          "title": "Plane",
          "type": "string"
        },
        "footprint": {
          "$ref": "#/$defs/Footprint"
        },
        "edgeTypes": {
          "$ref": "#/$defs/EdgeTypes"
        }
      },
      "required": [
        "mountType",
        "plane",
        "footprint",
        "edgeTypes"
      ],
      "title": "GridComponentFrame",
      "type": "object"
    },
    "GridMountFrame": {
      "additionalProperties": false,
      "properties": {
        "id": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Id",
          "type": "string"
        },
        "slotId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Slotid",
          "type": "string"
        },
        "mountType": {
          "const": "grid",
          "title": "Mounttype",
          "type": "string"
        },
        "origin": {
          "$ref": "#/$defs/Point"
        },
        "cellSize": {
          "$ref": "#/$defs/CellSize"
        },
        "columns": {
          "maximum": 64,
          "minimum": 1,
          "title": "Columns",
          "type": "integer"
        },
        "rows": {
          "maximum": 64,
          "minimum": 1,
          "title": "Rows",
          "type": "integer"
        },
        "plane": {
          "enum": [
            "floor",
            "wall"
          ],
          "title": "Plane",
          "type": "string"
        },
        "acceptedEdgeTypes": {
          "items": {
            "maxLength": 80,
            "minLength": 1,
            "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
            "type": "string"
          },
          "maxItems": 32,
          "title": "Acceptededgetypes",
          "type": "array",
          "uniqueItems": true,
          "x-canonicalOrder": true
        }
      },
      "required": [
        "id",
        "slotId",
        "mountType",
        "origin",
        "cellSize",
        "columns",
        "rows",
        "plane",
        "acceptedEdgeTypes"
      ],
      "title": "GridMountFrame",
      "type": "object"
    },
    "GripComponentFrame": {
      "additionalProperties": false,
      "properties": {
        "mountType": {
          "const": "grip",
          "title": "Mounttype",
          "type": "string"
        },
        "contacts": {
          "items": {
            "$ref": "#/$defs/Point"
          },
          "maxItems": 2,
          "minItems": 2,
          "title": "Contacts",
          "type": "array",
          "uniqueItems": true
        },
        "normals": {
          "items": {
            "$ref": "#/$defs/Normal"
          },
          "maxItems": 2,
          "minItems": 2,
          "title": "Normals",
          "type": "array"
        }
      },
      "required": [
        "mountType",
        "contacts",
        "normals"
      ],
      "title": "GripComponentFrame",
      "type": "object"
    },
    "GripMountFrame": {
      "additionalProperties": false,
      "properties": {
        "id": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Id",
          "type": "string"
        },
        "slotId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Slotid",
          "type": "string"
        },
        "mountType": {
          "const": "grip",
          "title": "Mounttype",
          "type": "string"
        },
        "contacts": {
          "items": {
            "$ref": "#/$defs/Point"
          },
          "maxItems": 2,
          "minItems": 2,
          "title": "Contacts",
          "type": "array",
          "uniqueItems": true
        },
        "normals": {
          "items": {
            "$ref": "#/$defs/Normal"
          },
          "maxItems": 2,
          "minItems": 2,
          "title": "Normals",
          "type": "array"
        },
        "constraints": {
          "$ref": "#/$defs/TransformConstraints"
        }
      },
      "required": [
        "id",
        "slotId",
        "mountType",
        "contacts",
        "normals",
        "constraints"
      ],
      "title": "GripMountFrame",
      "type": "object"
    },
    "Kit": {
      "additionalProperties": false,
      "properties": {
        "id": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Id",
          "type": "string"
        },
        "title": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^(?![\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff])(?![\\s\\S]*[\\u0009-\\u000d\\u0020\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]$)[^\\u0000-\\u001f]+$",
          "title": "Title",
          "type": "string"
        },
        "mode": {
          "enum": [
            "whole",
            "socket",
            "grip",
            "grid"
          ],
          "title": "Mode",
          "type": "string"
        },
        "compatibilityProfile": {
          "$ref": "#/$defs/CompatibilityProfile"
        },
        "base": {
          "$ref": "#/$defs/AssetReference"
        },
        "priceAssetId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Priceassetid",
          "type": "string"
        },
        "mountFrames": {
          "items": {
            "discriminator": {
              "mapping": {
                "grid": "#/$defs/GridMountFrame",
                "grip": "#/$defs/GripMountFrame",
                "socket": "#/$defs/SocketMountFrame"
              },
              "propertyName": "mountType"
            },
            "oneOf": [
              {
                "$ref": "#/$defs/SocketMountFrame"
              },
              {
                "$ref": "#/$defs/GripMountFrame"
              },
              {
                "$ref": "#/$defs/GridMountFrame"
              }
            ]
          },
          "maxItems": 32,
          "title": "Mountframes",
          "type": "array",
          "x-canonicalOrder": "id",
          "x-uniqueBy": "id"
        },
        "artworkBounds": {
          "items": {
            "$ref": "#/$defs/Bounds"
          },
          "maxItems": 8,
          "title": "Artworkbounds",
          "type": "array"
        }
      },
      "required": [
        "id",
        "title",
        "mode",
        "compatibilityProfile",
        "base",
        "priceAssetId",
        "mountFrames",
        "artworkBounds"
      ],
      "title": "Kit",
      "type": "object",
      "allOf": [
        {
          "if": {
            "required": ["mode"],
            "properties": { "mode": { "const": "whole" } }
          },
          "then": {
            "properties": { "mountFrames": { "maxItems": 0 } }
          }
        },
        {
          "if": {
            "required": ["mode"],
            "properties": { "mode": { "const": "socket" } }
          },
          "then": {
            "properties": {
              "mountFrames": {
                "minItems": 1,
                "items": { "$ref": "#/$defs/SocketMountFrame" }
              }
            }
          }
        },
        {
          "if": {
            "required": ["mode"],
            "properties": { "mode": { "const": "grip" } }
          },
          "then": {
            "properties": {
              "mountFrames": {
                "minItems": 1,
                "items": { "$ref": "#/$defs/GripMountFrame" }
              }
            }
          }
        },
        {
          "if": {
            "required": ["mode"],
            "properties": { "mode": { "const": "grid" } }
          },
          "then": {
            "properties": {
              "mountFrames": {
                "minItems": 1,
                "items": { "$ref": "#/$defs/GridMountFrame" }
              }
            }
          }
        }
      ]
    },
    "Normal": {
      "additionalProperties": false,
      "properties": {
        "x": {
          "maximum": 1.0,
          "minimum": -1.0,
          "title": "X",
          "type": "number"
        },
        "y": {
          "maximum": 1.0,
          "minimum": -1.0,
          "title": "Y",
          "type": "number"
        }
      },
      "required": [
        "x",
        "y"
      ],
      "title": "Normal",
      "type": "object",
      "not": {
        "required": [
          "x",
          "y"
        ],
        "properties": {
          "x": {
            "const": 0
          },
          "y": {
            "const": 0
          }
        }
      }
    },
    "Point": {
      "additionalProperties": false,
      "properties": {
        "x": {
          "maximum": 1.0,
          "minimum": 0.0,
          "title": "X",
          "type": "number"
        },
        "y": {
          "maximum": 1.0,
          "minimum": 0.0,
          "title": "Y",
          "type": "number"
        }
      },
      "required": [
        "x",
        "y"
      ],
      "title": "Point",
      "type": "object"
    },
    "RasterFrame": {
      "additionalProperties": false,
      "properties": {
        "originalWidth": {
          "maximum": 8192,
          "minimum": 1,
          "title": "Originalwidth",
          "type": "integer"
        },
        "originalHeight": {
          "maximum": 8192,
          "minimum": 1,
          "title": "Originalheight",
          "type": "integer"
        },
        "trimX": {
          "maximum": 8191,
          "minimum": 0,
          "title": "Trimx",
          "type": "integer"
        },
        "trimY": {
          "maximum": 8191,
          "minimum": 0,
          "title": "Trimy",
          "type": "integer"
        },
        "trimWidth": {
          "maximum": 8192,
          "minimum": 1,
          "title": "Trimwidth",
          "type": "integer"
        },
        "trimHeight": {
          "maximum": 8192,
          "minimum": 1,
          "title": "Trimheight",
          "type": "integer"
        }
      },
      "required": [
        "originalWidth",
        "originalHeight",
        "trimX",
        "trimY",
        "trimWidth",
        "trimHeight"
      ],
      "title": "RasterFrame",
      "type": "object"
    },
    "SocketComponentFrame": {
      "additionalProperties": false,
      "properties": {
        "mountType": {
          "const": "socket",
          "title": "Mounttype",
          "type": "string"
        },
        "point": {
          "$ref": "#/$defs/Point"
        },
        "normal": {
          "$ref": "#/$defs/Normal"
        },
        "referenceScale": {
          "exclusiveMinimum": 0.0,
          "maximum": 2.0,
          "title": "Referencescale",
          "type": "number"
        }
      },
      "required": [
        "mountType",
        "point",
        "normal",
        "referenceScale"
      ],
      "title": "SocketComponentFrame",
      "type": "object"
    },
    "SocketMountFrame": {
      "additionalProperties": false,
      "properties": {
        "id": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Id",
          "type": "string"
        },
        "slotId": {
          "maxLength": 80,
          "minLength": 1,
          "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
          "title": "Slotid",
          "type": "string"
        },
        "mountType": {
          "const": "socket",
          "title": "Mounttype",
          "type": "string"
        },
        "point": {
          "$ref": "#/$defs/Point"
        },
        "normal": {
          "$ref": "#/$defs/Normal"
        },
        "referenceScale": {
          "exclusiveMinimum": 0.0,
          "maximum": 2.0,
          "title": "Referencescale",
          "type": "number"
        },
        "constraints": {
          "$ref": "#/$defs/TransformConstraints"
        }
      },
      "required": [
        "id",
        "slotId",
        "mountType",
        "point",
        "normal",
        "referenceScale",
        "constraints"
      ],
      "title": "SocketMountFrame",
      "type": "object"
    },
    "TransformConstraints": {
      "additionalProperties": false,
      "properties": {
        "minScale": {
          "exclusiveMinimum": 0.0,
          "maximum": 8.0,
          "title": "Minscale",
          "type": "number"
        },
        "maxScale": {
          "exclusiveMinimum": 0.0,
          "maximum": 8.0,
          "title": "Maxscale",
          "type": "number"
        },
        "minRotationDegrees": {
          "maximum": 180.0,
          "minimum": -180.0,
          "title": "Minrotationdegrees",
          "type": "number"
        },
        "maxRotationDegrees": {
          "maximum": 180.0,
          "minimum": -180.0,
          "title": "Maxrotationdegrees",
          "type": "number"
        },
        "maxNormalErrorDegrees": {
          "maximum": 45.0,
          "minimum": 0.0,
          "title": "Maxnormalerrordegrees",
          "type": "number"
        },
        "mirrorAllowed": {
          "title": "Mirrorallowed",
          "type": "boolean"
        }
      },
      "required": [
        "minScale",
        "maxScale",
        "minRotationDegrees",
        "maxRotationDegrees",
        "maxNormalErrorDegrees",
        "mirrorAllowed"
      ],
      "title": "TransformConstraints",
      "type": "object"
    }
  },
  "additionalProperties": false,
  "properties": {
    "schema": {
      "const": "product-kit@1",
      "title": "Schema",
      "type": "string"
    },
    "version": {
      "const": 1,
      "title": "Version",
      "type": "integer"
    },
    "packId": {
      "maxLength": 80,
      "minLength": 1,
      "pattern": "^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
      "title": "Packid",
      "type": "string"
    },
    "catalogPackId": {
      "maxLength": 80,
      "minLength": 1,
      "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*(?![\\s\\S])",
      "title": "Catalogpackid",
      "type": "string"
    },
    "catalogSha256": {
      "pattern": "^[0-9a-f]{64}(?![\\s\\S])",
      "title": "Catalogsha256",
      "type": "string"
    },
    "pricingVersion": {
      "const": "product-pricing@1",
      "title": "Pricingversion",
      "type": "string"
    },
    "connectorFormulaVersion": {
      "const": "product-kit-connectors@1",
      "title": "Connectorformulaversion",
      "type": "string"
    },
    "kits": {
      "items": {
        "$ref": "#/$defs/Kit"
      },
      "maxItems": 10000,
      "minItems": 1,
      "title": "Kits",
      "type": "array",
      "x-canonicalOrder": "id",
      "x-uniqueBy": "id"
    },
    "components": {
      "items": {
        "$ref": "#/$defs/Component"
      },
      "maxItems": 10000,
      "title": "Components",
      "type": "array",
      "x-canonicalOrder": "id",
      "x-uniqueBy": "id"
    },
    "certifications": {
      "items": {
        "$ref": "#/$defs/Certification"
      },
      "maxItems": 10000,
      "title": "Certifications",
      "type": "array",
      "x-canonicalOrder": "id",
      "x-uniqueBy": "id"
    }
  },
  "required": [
    "schema",
    "version",
    "packId",
    "catalogPackId",
    "catalogSha256",
    "pricingVersion",
    "connectorFormulaVersion",
    "kits",
    "components",
    "certifications"
  ],
  "title": "Advertising Market product kit v1",
  "type": "object"
}


```

## FILE: catalog/schemas/product-kit-v1.corpus.json

```json
{
  "schema": "product-kit-corpus@1",
  "context": {
    "catalogPackId": "offline-core-v1",
    "catalogSha256": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "records": [
      {
        "id": "asset-grid-base",
        "masterSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "delivery": "offline",
        "kind": "raster-master",
        "files": { "master": "/catalog/generated/offline-core-v1/assets/asset-grid-base/master.png" },
        "dimensions": { "width": 100, "height": 100 },
        "classroomReviewed": true,
        "brandFree": true
      },
      {
        "id": "asset-grid-part",
        "masterSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "delivery": "offline",
        "kind": "component",
        "files": { "master": "/catalog/generated/offline-core-v1/assets/asset-grid-part/master.png" },
        "dimensions": { "width": 100, "height": 100 },
        "classroomReviewed": true,
        "brandFree": true
      },
      {
        "id": "asset-grip-base",
        "masterSha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        "delivery": "offline",
        "kind": "raster-master",
        "files": { "master": "/catalog/generated/offline-core-v1/assets/asset-grip-base/master.png" },
        "dimensions": { "width": 100, "height": 100 },
        "classroomReviewed": true,
        "brandFree": true
      },
      {
        "id": "asset-grip-front",
        "masterSha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        "delivery": "offline",
        "kind": "component",
        "files": { "master": "/catalog/generated/offline-core-v1/assets/asset-grip-front/master.png" },
        "dimensions": { "width": 100, "height": 100 },
        "classroomReviewed": true,
        "brandFree": true
      },
      {
        "id": "asset-grip-rear",
        "masterSha256": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        "delivery": "offline",
        "kind": "component",
        "files": { "master": "/catalog/generated/offline-core-v1/assets/asset-grip-rear/master.png" },
        "dimensions": { "width": 100, "height": 100 },
        "classroomReviewed": true,
        "brandFree": true
      },
      {
        "id": "asset-socket-base",
        "masterSha256": "1111111111111111111111111111111111111111111111111111111111111111",
        "delivery": "offline",
        "kind": "raster-master",
        "files": { "master": "/catalog/generated/offline-core-v1/assets/asset-socket-base/master.png" },
        "dimensions": { "width": 100, "height": 100 },
        "classroomReviewed": true,
        "brandFree": true
      },
      {
        "id": "asset-socket-part",
        "masterSha256": "2222222222222222222222222222222222222222222222222222222222222222",
        "delivery": "offline",
        "kind": "component",
        "files": { "master": "/catalog/generated/offline-core-v1/assets/asset-socket-part/master.png" },
        "dimensions": { "width": 100, "height": 100 },
        "classroomReviewed": true,
        "brandFree": true
      },
      {
        "id": "asset-whole-base",
        "masterSha256": "3333333333333333333333333333333333333333333333333333333333333333",
        "delivery": "offline",
        "kind": "raster-master",
        "files": { "master": "/catalog/generated/offline-core-v1/assets/asset-whole-base/master.png" },
        "dimensions": { "width": 100, "height": 100 },
        "classroomReviewed": true,
        "brandFree": true
      }
    ]
  },
  "valid": [
    {
      "name": "four composition modes with one split logical component",
      "value": {
        "schema": "product-kit@1",
        "version": 1,
        "packId": "pk1-pilot",
        "catalogPackId": "offline-core-v1",
        "catalogSha256": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        "pricingVersion": "product-pricing@1",
        "connectorFormulaVersion": "product-kit-connectors@1",
        "kits": [
          {
            "id": "pk1-grid-kit",
            "title": "Escape Room Wall",
            "mode": "grid",
            "compatibilityProfile": {
              "familyId": "pk1-escape-room",
              "perspectiveId": "pk1-front-view",
              "geometryId": "pk1-wall-grid",
              "styleId": "pk1-outline-clean"
            },
            "base": {
              "assetId": "asset-grid-base",
              "masterSha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              "frame": {
                "originalWidth": 100,
                "originalHeight": 100,
                "trimX": 0,
                "trimY": 0,
                "trimWidth": 100,
                "trimHeight": 100
              }
            },
            "priceAssetId": "pk1-price-grid-base",
            "mountFrames": [
              {
                "id": "pk1-grid-frame",
                "slotId": "pk1-grid-slot",
                "mountType": "grid",
                "origin": { "x": 0.1, "y": 0.1 },
                "cellSize": { "width": 0.1, "height": 0.1 },
                "columns": 8,
                "rows": 6,
                "plane": "wall",
                "acceptedEdgeTypes": ["pk1-door", "pk1-panel"]
              }
            ],
            "artworkBounds": []
          },
          {
            "id": "pk1-grip-kit",
            "title": "Reusable Cup",
            "mode": "grip",
            "compatibilityProfile": {
              "familyId": "pk1-drinkware",
              "perspectiveId": "pk1-front-view",
              "geometryId": "pk1-cup-handle",
              "styleId": "pk1-outline-clean"
            },
            "base": {
              "assetId": "asset-grip-base",
              "masterSha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
              "frame": {
                "originalWidth": 100,
                "originalHeight": 100,
                "trimX": 0,
                "trimY": 0,
                "trimWidth": 100,
                "trimHeight": 100
              }
            },
            "priceAssetId": "pk1-price-grip-base",
            "mountFrames": [
              {
                "id": "pk1-grip-frame",
                "slotId": "pk1-handle-slot",
                "mountType": "grip",
                "contacts": [{ "x": 0.82, "y": 0.35 }, { "x": 0.82, "y": 0.7 }],
                "normals": [{ "x": 1, "y": 0 }, { "x": 1, "y": 0 }],
                "constraints": {
                  "minScale": 0.5,
                  "maxScale": 2,
                  "minRotationDegrees": -45,
                  "maxRotationDegrees": 45,
                  "maxNormalErrorDegrees": 5,
                  "mirrorAllowed": true
                }
              }
            ],
            "artworkBounds": [{ "x": 0.25, "y": 0.25, "width": 0.45, "height": 0.5 }]
          },
          {
            "id": "pk1-socket-kit",
            "title": "Travel Bottle",
            "mode": "socket",
            "compatibilityProfile": {
              "familyId": "pk1-drinkware",
              "perspectiveId": "pk1-front-view",
              "geometryId": "pk1-bottle-lid",
              "styleId": "pk1-outline-clean"
            },
            "base": {
              "assetId": "asset-socket-base",
              "masterSha256": "1111111111111111111111111111111111111111111111111111111111111111",
              "frame": {
                "originalWidth": 100,
                "originalHeight": 100,
                "trimX": 0,
                "trimY": 0,
                "trimWidth": 100,
                "trimHeight": 100
              }
            },
            "priceAssetId": "pk1-price-socket-base",
            "mountFrames": [
              {
                "id": "pk1-socket-frame",
                "slotId": "pk1-lid-slot",
                "mountType": "socket",
                "point": { "x": 0.5, "y": 0.08 },
                "normal": { "x": 0, "y": -1 },
                "referenceScale": 0.22,
                "constraints": {
                  "minScale": 0.5,
                  "maxScale": 2,
                  "minRotationDegrees": -45,
                  "maxRotationDegrees": 45,
                  "maxNormalErrorDegrees": 5,
                  "mirrorAllowed": false
                }
              }
            ],
            "artworkBounds": [{ "x": 0.2, "y": 0.3, "width": 0.6, "height": 0.45 }]
          },
          {
            "id": "pk1-whole-kit",
            "title": "Complete Mug",
            "mode": "whole",
            "compatibilityProfile": {
              "familyId": "pk1-drinkware",
              "perspectiveId": "pk1-front-view",
              "geometryId": "pk1-complete-mug",
              "styleId": "pk1-outline-clean"
            },
            "base": {
              "assetId": "asset-whole-base",
              "masterSha256": "3333333333333333333333333333333333333333333333333333333333333333",
              "frame": {
                "originalWidth": 100,
                "originalHeight": 100,
                "trimX": 0,
                "trimY": 0,
                "trimWidth": 100,
                "trimHeight": 100
              }
            },
            "priceAssetId": "pk1-price-whole-base",
            "mountFrames": [],
            "artworkBounds": [{ "x": 0.25, "y": 0.25, "width": 0.45, "height": 0.5 }]
          }
        ],
        "components": [
          {
            "id": "pk1-grid-component",
            "title": "Secret Door",
            "slotId": "pk1-grid-slot",
            "compatibilityProfile": {
              "familyId": "pk1-escape-room",
              "perspectiveId": "pk1-front-view",
              "geometryId": "pk1-wall-grid",
              "styleId": "pk1-outline-clean"
            },
            "componentFrame": {
              "mountType": "grid",
              "plane": "wall",
              "footprint": { "columns": 2, "rows": 3 },
              "edgeTypes": { "north": "pk1-panel", "south": "pk1-door" }
            },
            "fragments": [
              {
                "layer": "front",
                "raster": {
                  "assetId": "asset-grid-part",
                  "masterSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                  "frame": {
                    "originalWidth": 100,
                    "originalHeight": 100,
                    "trimX": 0,
                    "trimY": 0,
                    "trimWidth": 100,
                    "trimHeight": 100
                  }
                }
              }
            ],
            "priceAssetId": "pk1-price-secret-door"
          },
          {
            "id": "pk1-grip-component",
            "title": "Loop Handle",
            "slotId": "pk1-handle-slot",
            "compatibilityProfile": {
              "familyId": "pk1-drinkware",
              "perspectiveId": "pk1-front-view",
              "geometryId": "pk1-cup-handle",
              "styleId": "pk1-outline-clean"
            },
            "componentFrame": {
              "mountType": "grip",
              "contacts": [{ "x": 0.18, "y": 0.25 }, { "x": 0.18, "y": 0.75 }],
              "normals": [{ "x": -1, "y": 0 }, { "x": -1, "y": 0 }]
            },
            "fragments": [
              {
                "layer": "rear",
                "raster": {
                  "assetId": "asset-grip-rear",
                  "masterSha256": "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                  "frame": {
                    "originalWidth": 100,
                    "originalHeight": 100,
                    "trimX": 0,
                    "trimY": 0,
                    "trimWidth": 100,
                    "trimHeight": 100
                  }
                }
              },
              {
                "layer": "front",
                "raster": {
                  "assetId": "asset-grip-front",
                  "masterSha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
                  "frame": {
                    "originalWidth": 100,
                    "originalHeight": 100,
                    "trimX": 0,
                    "trimY": 0,
                    "trimWidth": 100,
                    "trimHeight": 100
                  }
                }
              }
            ],
            "priceAssetId": "pk1-price-loop-handle"
          },
          {
            "id": "pk1-socket-component",
            "title": "Flip Lid",
            "slotId": "pk1-lid-slot",
            "compatibilityProfile": {
              "familyId": "pk1-drinkware",
              "perspectiveId": "pk1-front-view",
              "geometryId": "pk1-bottle-lid",
              "styleId": "pk1-outline-clean"
            },
            "componentFrame": {
              "mountType": "socket",
              "point": { "x": 0.5, "y": 0.9 },
              "normal": { "x": 0, "y": -1 },
              "referenceScale": 0.2
            },
            "fragments": [
              {
                "layer": "front",
                "raster": {
                  "assetId": "asset-socket-part",
                  "masterSha256": "2222222222222222222222222222222222222222222222222222222222222222",
                  "frame": {
                    "originalWidth": 100,
                    "originalHeight": 100,
                    "trimX": 0,
                    "trimY": 0,
                    "trimWidth": 100,
                    "trimHeight": 100
                  }
                }
              }
            ],
            "priceAssetId": "pk1-price-flip-lid"
          }
        ],
        "certifications": [
          {
            "id": "pk1-cert-grid",
            "kitId": "pk1-grid-kit",
            "mountFrameId": "pk1-grid-frame",
            "componentId": "pk1-grid-component",
            "fingerprint": "4444444444444444444444444444444444444444444444444444444444444444"
          },
          {
            "id": "pk1-cert-grip",
            "kitId": "pk1-grip-kit",
            "mountFrameId": "pk1-grip-frame",
            "componentId": "pk1-grip-component",
            "fingerprint": "5555555555555555555555555555555555555555555555555555555555555555"
          },
          {
            "id": "pk1-cert-socket",
            "kitId": "pk1-socket-kit",
            "mountFrameId": "pk1-socket-frame",
            "componentId": "pk1-socket-component",
            "fingerprint": "6666666666666666666666666666666666666666666666666666666666666666"
          }
        ]
      }
    }
  ],
  "derivedValid": [
    {
      "name": "integral decimal grid count",
      "target": "value",
      "path": ["kits", 0, "mountFrames", 0, "columns"],
      "value": 8.0
    },
    {
      "name": "integral decimal raster dimension",
      "target": "value",
      "path": ["kits", 0, "base", "frame", "originalWidth"],
      "value": 100.0
    },
    {
      "name": "integral decimal version",
      "target": "value",
      "path": ["version"],
      "value": 1.0
    }
  ],
  "derivedInvalid": [
    {
      "name": "top-level extra",
      "target": "value",
      "path": ["extra"],
      "value": true,
      "structural": true
    },
    {
      "name": "boolean version",
      "target": "value",
      "path": ["version"],
      "value": true,
      "structural": true
    },
    {
      "name": "zero socket normal",
      "target": "value",
      "path": ["kits", 2, "mountFrames", 0, "normal"],
      "value": { "x": 0, "y": 0 },
      "structural": true
    },
    {
      "name": "signed-zero socket point",
      "target": "value",
      "path": ["kits", 2, "mountFrames", 0, "point", "x"],
      "value": -0.0,
      "structural": false
    },
    {
      "name": "pack ID with terminal LF",
      "target": "value",
      "path": ["packId"],
      "value": "pk1-pilot\n",
      "structural": true
    },
    {
      "name": "catalogue hash with terminal LF",
      "target": "value",
      "path": ["catalogSha256"],
      "value": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff\n",
      "structural": true
    },
    {
      "name": "globally duplicated mount-frame ID",
      "target": "value",
      "path": ["kits", 2, "mountFrames", 0, "id"],
      "value": "pk1-grip-frame",
      "structural": false
    },
    {
      "name": "wrong catalogue hash",
      "target": "context",
      "path": ["catalogSha256"],
      "value": "0000000000000000000000000000000000000000000000000000000000000000",
      "structural": false
    },
    {
      "name": "unknown base asset",
      "target": "value",
      "path": ["kits", 0, "base", "assetId"],
      "value": "asset-missing",
      "structural": false
    },
    {
      "name": "certified profile mismatch",
      "target": "value",
      "path": ["components", 1, "compatibilityProfile", "styleId"],
      "value": "pk1-other-style",
      "structural": false
    },
    {
      "name": "unsupported certified grid edge",
      "target": "value",
      "path": ["components", 0, "componentFrame", "edgeTypes", "north"],
      "value": "pk1-unsupported-edge",
      "structural": false
    },
    {
      "name": "certified socket scale outside limits",
      "target": "value",
      "path": ["components", 2, "componentFrame", "referenceScale"],
      "value": 0.01,
      "structural": false
    },
    {
      "name": "unreviewed referenced asset",
      "target": "context",
      "path": ["records", 0, "classroomReviewed"],
      "value": false,
      "structural": false
    },
    {
      "name": "unpaired Unicode surrogate title",
      "target": "value",
      "path": ["kits", 0, "title"],
      "value": "\ud800",
      "structural": false
    },
    {
      "name": "title over browser UTF-16 limit but within JSON-Schema code-point limit",
      "target": "value",
      "path": ["kits", 0, "title"],
      "value": "😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀",
      "structural": false
    },
    {
      "name": "duplicate grip mount contacts",
      "target": "value",
      "path": ["kits", 1, "mountFrames", 0, "contacts"],
      "value": [{ "x": 0.2, "y": 0.2 }, { "x": 0.2, "y": 0.2 }],
      "structural": true
    },
    {
      "name": "kit mode and mount-frame type mismatch",
      "target": "value",
      "path": ["kits", 1, "mode"],
      "value": "socket",
      "structural": true
    },
    {
      "name": "whole kit with a mount frame",
      "target": "value",
      "path": ["kits", 3, "mountFrames"],
      "value": [
        {
          "id": "pk1-whole-illegal-frame",
          "slotId": "pk1-whole-illegal-slot",
          "mountType": "socket",
          "point": { "x": 0.5, "y": 0.1 },
          "normal": { "x": 0, "y": -1 },
          "referenceScale": 0.2,
          "constraints": {
            "minScale": 0.5,
            "maxScale": 2,
            "minRotationDegrees": -45,
            "maxRotationDegrees": 45,
            "maxNormalErrorDegrees": 2,
            "mirrorAllowed": false
          }
        }
      ],
      "structural": true
    },
    {
      "name": "duplicate component fragment layer",
      "target": "value",
      "path": ["components", 1, "fragments", 0, "layer"],
      "value": "front",
      "structural": true
    },
    {
      "name": "out-of-order component fragment layers",
      "target": "value",
      "path": ["components", 1, "fragments", 0, "layer"],
      "value": "overlay",
      "structural": true
    },
    {
      "name": "title with outer whitespace",
      "target": "value",
      "path": ["kits", 0, "title"],
      "value": " Grid kit",
      "structural": true
    },
    {
      "name": "title with control character",
      "target": "value",
      "path": ["components", 0, "title"],
      "value": "Grid\u0007component",
      "structural": true
    },
    {
      "name": "non-whole kit without mount frames",
      "target": "value",
      "path": ["kits", 0, "mountFrames"],
      "value": [],
      "structural": true
    },
    {
      "name": "grip kit without mount frames",
      "target": "value",
      "path": ["kits", 1, "mountFrames"],
      "value": [],
      "structural": true
    },
    {
      "name": "socket kit without mount frames",
      "target": "value",
      "path": ["kits", 2, "mountFrames"],
      "value": [],
      "structural": true
    },
    {
      "name": "artwork bounds overflow",
      "target": "value",
      "path": ["kits", 1, "artworkBounds", 0, "width"],
      "value": 0.9,
      "structural": false
    },
    {
      "name": "raster trim overflow",
      "target": "value",
      "path": ["kits", 0, "base", "frame", "originalWidth"],
      "value": 99,
      "structural": false
    },
    {
      "name": "grid extent overflow",
      "target": "value",
      "path": ["kits", 0, "mountFrames", 0, "cellSize"],
      "value": { "width": 0.2, "height": 0.1 },
      "structural": false
    },
    {
      "name": "inverted transform constraints",
      "target": "value",
      "path": ["kits", 2, "mountFrames", 0, "constraints", "minScale"],
      "value": 3,
      "structural": false
    }
  ]
}


```

## FILE: pipeline/product_kit/__init__.py

```python
"""Offline ``product-kit@1`` authoring contract."""

from .pack import write_product_kit_pack
from .schema import (
    AssetReference,
    Bounds,
    Certification,
    CompatibilityProfile,
    Component,
    Fragment,
    GridComponentFrame,
    GridMountFrame,
    GripComponentFrame,
    GripMountFrame,
    Kit,
    Point,
    ProductKitCatalogue,
    ProductKitCatalogueAssetRecord,
    ProductKitCatalogueContext,
    RasterFrame,
    SocketComponentFrame,
    SocketMountFrame,
    TransformConstraints,
    canonical_json_bytes,
    parse_product_kit_catalogue,
    validate_product_kit_catalogue,
)

__all__ = [
    "AssetReference",
    "Bounds",
    "Certification",
    "CompatibilityProfile",
    "Component",
    "Fragment",
    "GridComponentFrame",
    "GridMountFrame",
    "GripComponentFrame",
    "GripMountFrame",
    "Kit",
    "Point",
    "ProductKitCatalogue",
    "ProductKitCatalogueAssetRecord",
    "ProductKitCatalogueContext",
    "RasterFrame",
    "SocketComponentFrame",
    "SocketMountFrame",
    "TransformConstraints",
    "canonical_json_bytes",
    "parse_product_kit_catalogue",
    "validate_product_kit_catalogue",
    "write_product_kit_pack",
]


```

## FILE: pipeline/product_kit/schema.py

```python
"""Strict offline authoring contract for ``product-kit@1`` catalogues.

The browser implementation in ``web/src/product-kit`` is authoritative.  This
module mirrors its closed camelCase syntax and its catalogue-bound graph checks
while exposing idiomatic snake_case attributes to Python callers.
"""

from __future__ import annotations

import json
import math
import re
import types
from dataclasses import dataclass
from typing import Annotated, Any, Literal, Mapping, Sequence, Union, get_args, get_origin

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)


PORTABLE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*\Z")
PRODUCT_KIT_ID_PATTERN = re.compile(r"^pk1-[a-z0-9]+(?:-[a-z0-9]+)*\Z")
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}\Z")
MAX_COLLECTION = 10_000
CONTACT_TOLERANCE = 1e-8
RAD_TO_DEGREES = 180.0 / math.pi
COMPONENT_LAYER_ORDER = {"rear": 0, "front": 1, "overlay": 2}
ALLOWED_RASTER_KINDS = frozenset({"component", "raster-master", "shell"})
JAVASCRIPT_TRIM_CHARACTERS = (
    "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680"
    "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a"
    "\u2028\u2029\u202f\u205f\u3000\ufeff"
)


def _to_camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)


class ContractModel(BaseModel):
    """Closed strict model accepting aliases, never Python field names."""

    model_config = ConfigDict(
        alias_generator=_to_camel,
        extra="forbid",
        strict=True,
        validate_by_alias=True,
        validate_by_name=False,
        validate_default=True,
        revalidate_instances="always",
        frozen=True,
    )


def _validate_title(value: str) -> str:
    utf16_length = len(value.encode("utf-16-le", errors="surrogatepass")) // 2
    if utf16_length > 80:
        raise ValueError("title may not exceed 80 UTF-16 code units")
    if value != value.strip(JAVASCRIPT_TRIM_CHARACTERS):
        raise ValueError("title must not contain outer whitespace")
    if any(ord(character) < 32 for character in value):
        raise ValueError("title must not contain control characters")
    return value


def _validate_portable_id(value: str) -> str:
    if PORTABLE_ID_PATTERN.fullmatch(value) is None:
        raise ValueError("value must be a portable ID")
    return value


def _validate_product_kit_id(value: str) -> str:
    if PRODUCT_KIT_ID_PATTERN.fullmatch(value) is None:
        raise ValueError("value must be a product-kit ID")
    return value


def _validate_sha256(value: str) -> str:
    if SHA256_PATTERN.fullmatch(value) is None:
        raise ValueError("value must be a lowercase SHA-256")
    return value


def _reject_signed_zero(value: Any) -> Any:
    if type(value) is float and value == 0.0 and math.copysign(1.0, value) < 0.0:
        raise ValueError("signed zero is not part of the product-kit numeric contract")
    return value


def _validate_json_integer(value: Any) -> int:
    _reject_signed_zero(value)
    if isinstance(value, bool):
        raise ValueError("JSON integer fields may not be booleans")
    if isinstance(value, int):
        return value
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return int(value)
    raise ValueError("value must be a finite integral JSON number")


PortableId = Annotated[
    str,
    Field(
        strict=True,
        min_length=1,
        max_length=80,
    ),
    AfterValidator(_validate_portable_id),
]
ProductKitId = Annotated[
    str,
    Field(
        strict=True,
        min_length=1,
        max_length=80,
    ),
    AfterValidator(_validate_product_kit_id),
]
Sha256 = Annotated[
    str,
    Field(strict=True, min_length=64, max_length=64),
    AfterValidator(_validate_sha256),
]
Title = Annotated[
    str,
    Field(strict=True, min_length=1, max_length=80),
    AfterValidator(_validate_title),
]
FiniteNumber = Annotated[
    float,
    BeforeValidator(_reject_signed_zero),
    Field(strict=True, allow_inf_nan=False),
]
UnitNumber = Annotated[
    float,
    BeforeValidator(_reject_signed_zero),
    Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False),
]
PositiveUnitNumber = Annotated[
    float,
    BeforeValidator(_reject_signed_zero),
    Field(strict=True, gt=0.0, le=1.0, allow_inf_nan=False),
]
NormalNumber = Annotated[
    float,
    BeforeValidator(_reject_signed_zero),
    Field(strict=True, ge=-1.0, le=1.0, allow_inf_nan=False),
]
PositiveReferenceScale = Annotated[
    float,
    BeforeValidator(_reject_signed_zero),
    Field(strict=True, gt=0.0, le=2.0, allow_inf_nan=False),
]
PixelDimension = Annotated[
    int,
    BeforeValidator(_validate_json_integer),
    Field(strict=True, ge=1, le=8192),
]
TrimOffset = Annotated[
    int,
    BeforeValidator(_validate_json_integer),
    Field(strict=True, ge=0, le=8191),
]
GridCount = Annotated[
    int,
    BeforeValidator(_validate_json_integer),
    Field(strict=True, ge=1, le=64),
]


class Point(ContractModel):
    x: UnitNumber
    y: UnitNumber


class Normal(ContractModel):
    x: NormalNumber
    y: NormalNumber

    @model_validator(mode="after")
    def validate_nonzero(self) -> "Normal":
        if self.x == 0.0 and self.y == 0.0:
            raise ValueError("normal must be non-zero")
        return self


class Bounds(ContractModel):
    x: UnitNumber
    y: UnitNumber
    width: PositiveUnitNumber
    height: PositiveUnitNumber

    @model_validator(mode="after")
    def validate_design_rectangle(self) -> "Bounds":
        if self.x + self.width > 1.0 or self.y + self.height > 1.0:
            raise ValueError("bounds must remain inside the design rectangle")
        return self


class RasterFrame(ContractModel):
    original_width: PixelDimension
    original_height: PixelDimension
    trim_x: TrimOffset
    trim_y: TrimOffset
    trim_width: PixelDimension
    trim_height: PixelDimension

    @model_validator(mode="after")
    def validate_trim_rectangle(self) -> "RasterFrame":
        if (
            self.trim_x + self.trim_width > self.original_width
            or self.trim_y + self.trim_height > self.original_height
        ):
            raise ValueError("trim rectangle must fit inside original dimensions")
        return self


class AssetReference(ContractModel):
    asset_id: PortableId
    master_sha256: Sha256
    frame: RasterFrame


class CompatibilityProfile(ContractModel):
    family_id: ProductKitId
    perspective_id: ProductKitId
    geometry_id: ProductKitId
    style_id: ProductKitId


class TransformConstraints(ContractModel):
    min_scale: Annotated[
        float,
        BeforeValidator(_reject_signed_zero),
        Field(strict=True, gt=0.0, le=8.0, allow_inf_nan=False),
    ]
    max_scale: Annotated[
        float,
        BeforeValidator(_reject_signed_zero),
        Field(strict=True, gt=0.0, le=8.0, allow_inf_nan=False),
    ]
    min_rotation_degrees: Annotated[
        float,
        BeforeValidator(_reject_signed_zero),
        Field(strict=True, ge=-180.0, le=180.0, allow_inf_nan=False),
    ]
    max_rotation_degrees: Annotated[
        float,
        BeforeValidator(_reject_signed_zero),
        Field(strict=True, ge=-180.0, le=180.0, allow_inf_nan=False),
    ]
    max_normal_error_degrees: Annotated[
        float,
        BeforeValidator(_reject_signed_zero),
        Field(strict=True, ge=0.0, le=45.0, allow_inf_nan=False),
    ]
    mirror_allowed: bool

    @model_validator(mode="after")
    def validate_ranges(self) -> "TransformConstraints":
        if self.min_scale > self.max_scale:
            raise ValueError("minScale must not exceed maxScale")
        if self.min_rotation_degrees > self.max_rotation_degrees:
            raise ValueError("minRotationDegrees must not exceed maxRotationDegrees")
        return self


class SocketMountFrame(ContractModel):
    id: ProductKitId
    slot_id: ProductKitId
    mount_type: Literal["socket"]
    point: Point
    normal: Normal
    reference_scale: PositiveReferenceScale
    constraints: TransformConstraints


class GripMountFrame(ContractModel):
    id: ProductKitId
    slot_id: ProductKitId
    mount_type: Literal["grip"]
    contacts: list[Point] = Field(min_length=2, max_length=2)
    normals: list[Normal] = Field(min_length=2, max_length=2)
    constraints: TransformConstraints

    @model_validator(mode="after")
    def validate_distinct_contacts(self) -> "GripMountFrame":
        if _same_point(self.contacts[0], self.contacts[1]):
            raise ValueError("grip contacts must be distinct")
        return self


class CellSize(ContractModel):
    width: PositiveUnitNumber
    height: PositiveUnitNumber


class GridMountFrame(ContractModel):
    id: ProductKitId
    slot_id: ProductKitId
    mount_type: Literal["grid"]
    origin: Point
    cell_size: CellSize
    columns: GridCount
    rows: GridCount
    plane: Literal["floor", "wall"]
    accepted_edge_types: list[ProductKitId] = Field(max_length=32)

    @model_validator(mode="after")
    def validate_design_rectangle(self) -> "GridMountFrame":
        if (
            self.origin.x + self.cell_size.width * self.columns > 1.0
            or self.origin.y + self.cell_size.height * self.rows > 1.0
        ):
            raise ValueError("grid must remain inside the design rectangle")
        return self


MountFrame = Annotated[
    SocketMountFrame | GripMountFrame | GridMountFrame,
    Field(discriminator="mount_type"),
]


class SocketComponentFrame(ContractModel):
    mount_type: Literal["socket"]
    point: Point
    normal: Normal
    reference_scale: PositiveReferenceScale


class GripComponentFrame(ContractModel):
    mount_type: Literal["grip"]
    contacts: list[Point] = Field(min_length=2, max_length=2)
    normals: list[Normal] = Field(min_length=2, max_length=2)

    @model_validator(mode="after")
    def validate_distinct_contacts(self) -> "GripComponentFrame":
        if _same_point(self.contacts[0], self.contacts[1]):
            raise ValueError("grip contacts must be distinct")
        return self


class Footprint(ContractModel):
    columns: GridCount
    rows: GridCount


class EdgeTypes(ContractModel):
    north: ProductKitId | None = None
    east: ProductKitId | None = None
    south: ProductKitId | None = None
    west: ProductKitId | None = None

    @model_validator(mode="after")
    def reject_explicit_null(self) -> "EdgeTypes":
        if any(getattr(self, name) is None for name in self.__pydantic_fields_set__):
            raise ValueError("edge types may be omitted but may not be null")
        return self


class GridComponentFrame(ContractModel):
    mount_type: Literal["grid"]
    plane: Literal["floor", "wall"]
    footprint: Footprint
    edge_types: EdgeTypes


ComponentFrame = Annotated[
    SocketComponentFrame | GripComponentFrame | GridComponentFrame,
    Field(discriminator="mount_type"),
]


class Kit(ContractModel):
    id: ProductKitId
    title: Title
    mode: Literal["whole", "socket", "grip", "grid"]
    compatibility_profile: CompatibilityProfile
    base: AssetReference
    price_asset_id: ProductKitId
    mount_frames: list[MountFrame] = Field(max_length=32)
    artwork_bounds: list[Bounds] = Field(max_length=8)


class Fragment(ContractModel):
    layer: Literal["rear", "front", "overlay"]
    raster: AssetReference


class Component(ContractModel):
    id: ProductKitId
    title: Title
    slot_id: ProductKitId
    compatibility_profile: CompatibilityProfile
    component_frame: ComponentFrame
    fragments: list[Fragment] = Field(min_length=1, max_length=3)
    price_asset_id: ProductKitId


class Certification(ContractModel):
    id: ProductKitId
    kit_id: ProductKitId
    mount_frame_id: ProductKitId
    component_id: ProductKitId
    fingerprint: Sha256


class ProductKitCatalogue(ContractModel):
    schema_id: Literal["product-kit@1"] = Field(alias="schema")
    version: Literal[1]
    pack_id: ProductKitId
    catalog_pack_id: PortableId
    catalog_sha256: Sha256
    pricing_version: Literal["product-pricing@1"]
    connector_formula_version: Literal["product-kit-connectors@1"]
    kits: list[Kit] = Field(min_length=1, max_length=MAX_COLLECTION)
    components: list[Component] = Field(max_length=MAX_COLLECTION)
    certifications: list[Certification] = Field(max_length=MAX_COLLECTION)

    @field_validator("version", mode="before")
    @classmethod
    def validate_version_number(cls, value: Any) -> int:
        return _validate_json_integer(value)


class AssetRecordFiles(ContractModel):
    master: str


class AssetRecordDimensions(ContractModel):
    width: PixelDimension
    height: PixelDimension


class ProductKitCatalogueAssetRecord(ContractModel):
    id: PortableId
    master_sha256: Sha256
    delivery: str
    kind: str
    files: AssetRecordFiles
    dimensions: AssetRecordDimensions
    classroom_reviewed: bool
    brand_free: bool


class ProductKitCatalogueContext(ContractModel):
    catalog_pack_id: PortableId
    catalog_sha256: Sha256
    records: list[ProductKitCatalogueAssetRecord] = Field(max_length=20_000)


def _same_point(left: Point, right: Point) -> bool:
    return left.x == right.x and left.y == right.y


def _sorted_unique_by_id(values: Sequence[Any]) -> bool:
    return all(values[index - 1].id < values[index].id for index in range(1, len(values)))


def _sorted_unique_strings(values: Sequence[str]) -> bool:
    return all(values[index - 1] < values[index] for index in range(1, len(values)))


def _same_profile(left: CompatibilityProfile, right: CompatibilityProfile) -> bool:
    return (
        left.family_id == right.family_id
        and left.perspective_id == right.perspective_id
        and left.geometry_id == right.geometry_id
        and left.style_id == right.style_id
    )


def _raster_is_bound(
    raster: AssetReference,
    records: Mapping[str, ProductKitCatalogueAssetRecord],
    pack_id: str,
) -> bool:
    record = records.get(raster.asset_id)
    if record is None:
        return False
    expected_master = f"/catalog/generated/{pack_id}/assets/{record.id}/master.png"
    return (
        record.master_sha256 == raster.master_sha256
        and record.delivery == "offline"
        and record.classroom_reviewed
        and record.brand_free
        and record.kind in ALLOWED_RASTER_KINDS
        and record.files.master == expected_master
        and record.dimensions.width == raster.frame.trim_width
        and record.dimensions.height == raster.frame.trim_height
    )


def _fragments_are_canonical(fragments: Sequence[Fragment]) -> bool:
    return all(
        COMPONENT_LAYER_ORDER[fragments[index - 1].layer]
        < COMPONENT_LAYER_ORDER[fragments[index].layer]
        for index in range(1, len(fragments))
    )


Vector = tuple[float, float]
Matrix = tuple[float, float, float, float, float, float]


@dataclass(frozen=True)
class _Rotation:
    cosine: float
    sine: float
    radians: float
    degrees: float


@dataclass(frozen=True)
class _Candidate:
    max_normal_error_degrees: float
    average_normal_error_degrees: float
    mirrored: bool


def _vector(value: Point | Normal) -> Vector:
    return value.x, value.y


def _finite_vector(value: Vector) -> bool:
    return math.isfinite(value[0]) and math.isfinite(value[1])


def _span_between(first: Point, second: Point) -> Vector | None:
    span = second.x - first.x, second.y - first.y
    return span if _finite_vector(span) else None


def _magnitude_parts(value: Vector) -> tuple[float, float] | None:
    largest_component = max(abs(value[0]), abs(value[1]))
    if largest_component == 0.0 or not math.isfinite(largest_component):
        return None
    scaled_length = math.hypot(
        value[0] / largest_component,
        value[1] / largest_component,
    )
    if not math.isfinite(scaled_length):
        return None
    return largest_component, scaled_length


def _normalized(value: Vector) -> Vector | None:
    if not _finite_vector(value):
        return None
    largest_component = max(abs(value[0]), abs(value[1]))
    if largest_component == 0.0:
        return None
    scaled_x = value[0] / largest_component
    scaled_y = value[1] / largest_component
    scaled_length = math.hypot(scaled_x, scaled_y)
    if scaled_length == 0.0 or not math.isfinite(scaled_length):
        return None
    return scaled_x / scaled_length, scaled_y / scaled_length


def _dot_cross(left: Vector, right: Vector) -> tuple[float, float]:
    """Return dot and signed cross products without angle clamping.

    Callers normalize vectors using largest-component scaling first.  Keeping
    both products feeds ``atan2`` directly, preserving genuine tiny errors and
    avoiding the overflow/precision loss of ``acos(dot)``.
    """

    return (
        left[0] * right[0] + left[1] * right[1],
        left[0] * right[1] - left[1] * right[0],
    )


def _rotation_between(source: Vector, target: Vector) -> _Rotation | None:
    cosine, sine = _dot_cross(source, target)
    unit = _normalized((cosine, sine))
    if unit is None:
        return None
    radians = math.atan2(unit[1], unit[0])
    degrees = radians * RAD_TO_DEGREES
    if radians == 0.0:
        radians = 0.0
    if degrees == 0.0:
        degrees = 0.0
    return _Rotation(unit[0], unit[1], radians, degrees)


def _within_constraints(
    scale: float,
    rotation_degrees: float,
    constraints: TransformConstraints,
) -> bool:
    return (
        math.isfinite(scale)
        and math.isfinite(rotation_degrees)
        and constraints.min_scale <= scale <= constraints.max_scale
        and constraints.min_rotation_degrees
        <= rotation_degrees
        <= constraints.max_rotation_degrees
    )


def _affine_for(
    source_point: Point,
    target_point: Point,
    scale: float,
    rotation: _Rotation,
    mirrored: bool,
) -> Matrix:
    mirror_x = -1.0 if mirrored else 1.0
    a = rotation.cosine * scale * mirror_x
    b = rotation.sine * scale * mirror_x
    c = -rotation.sine * scale
    d = rotation.cosine * scale
    e = target_point.x - (a * source_point.x + c * source_point.y)
    f = target_point.y - (b * source_point.x + d * source_point.y)
    return a, b, c, d, e, f


def _finite_matrix(matrix: Matrix) -> bool:
    return all(math.isfinite(value) for value in matrix)


def _transformed_normal(source: Vector, rotation: _Rotation, mirrored: bool) -> Vector:
    x = -source[0] if mirrored else source[0]
    return (
        rotation.cosine * x - rotation.sine * source[1],
        rotation.sine * x + rotation.cosine * source[1],
    )


def _angular_error_degrees(left: Vector, right: Vector) -> float:
    dot, cross = _dot_cross(left, right)
    return math.atan2(abs(cross), dot) * RAD_TO_DEGREES


def _apply_transform(matrix: Matrix, point: Point) -> Vector:
    a, b, c, d, e, f = matrix
    return (
        a * point.x + c * point.y + e,
        b * point.x + d * point.y + f,
    )


def _contact_residual(matrix: Matrix, source: Point, target: Point) -> float:
    transformed = _apply_transform(matrix, source)
    if not _finite_vector(transformed):
        return math.inf
    residual = math.hypot(transformed[0] - target.x, transformed[1] - target.y)
    return residual if math.isfinite(residual) else math.inf


def _socket_transform_is_feasible(
    source: SocketComponentFrame,
    target: SocketMountFrame,
    constraints: TransformConstraints,
) -> bool:
    source_normal = _normalized(_vector(source.normal))
    target_normal = _normalized(_vector(target.normal))
    if source_normal is None or target_normal is None:
        return False
    scale = target.reference_scale / source.reference_scale
    rotation = _rotation_between(source_normal, target_normal)
    if rotation is None or not _within_constraints(scale, rotation.degrees, constraints):
        return False
    matrix = _affine_for(source.point, target.point, scale, rotation, False)
    if not _finite_matrix(matrix):
        return False
    normal_error = _angular_error_degrees(
        _transformed_normal(source_normal, rotation, False),
        target_normal,
    )
    return (
        normal_error <= constraints.max_normal_error_degrees
        and _contact_residual(matrix, source.point, target.point) <= CONTACT_TOLERANCE
    )


def _grip_candidate(
    source: GripComponentFrame,
    target: GripMountFrame,
    source_normals: tuple[Vector, Vector],
    target_normals: tuple[Vector, Vector],
    scale: float,
    constraints: TransformConstraints,
    mirrored: bool,
) -> _Candidate | None:
    source_span = (
        source.contacts[1].x - source.contacts[0].x,
        source.contacts[1].y - source.contacts[0].y,
    )
    target_span = (
        target.contacts[1].x - target.contacts[0].x,
        target.contacts[1].y - target.contacts[0].y,
    )
    reflected_source_span = (
        -source_span[0] if mirrored else source_span[0],
        source_span[1],
    )
    source_direction = _normalized(reflected_source_span)
    target_direction = _normalized(target_span)
    if source_direction is None or target_direction is None:
        return None
    rotation = _rotation_between(source_direction, target_direction)
    if rotation is None or not _within_constraints(scale, rotation.degrees, constraints):
        return None
    matrix = _affine_for(
        source.contacts[0],
        target.contacts[0],
        scale,
        rotation,
        mirrored,
    )
    if (
        not _finite_matrix(matrix)
        or _contact_residual(matrix, source.contacts[0], target.contacts[0])
        > CONTACT_TOLERANCE
        or _contact_residual(matrix, source.contacts[1], target.contacts[1])
        > CONTACT_TOLERANCE
    ):
        return None
    errors = tuple(
        _angular_error_degrees(
            _transformed_normal(source_normals[index], rotation, mirrored),
            target_normals[index],
        )
        for index in range(2)
    )
    max_error = max(errors)
    if max_error > constraints.max_normal_error_degrees:
        return None
    return _Candidate(max_error, (errors[0] + errors[1]) / 2.0, mirrored)


def _grip_transform_is_feasible(
    source: GripComponentFrame,
    target: GripMountFrame,
    constraints: TransformConstraints,
) -> bool:
    normalized_source = tuple(_normalized(_vector(normal)) for normal in source.normals)
    normalized_target = tuple(_normalized(_vector(normal)) for normal in target.normals)
    if any(value is None for value in (*normalized_source, *normalized_target)):
        return False
    source_span = _span_between(source.contacts[0], source.contacts[1])
    target_span = _span_between(target.contacts[0], target.contacts[1])
    if source_span is None or target_span is None:
        return False
    source_magnitude = _magnitude_parts(source_span)
    target_magnitude = _magnitude_parts(target_span)
    if source_magnitude is None or target_magnitude is None:
        return False
    scale = (target_magnitude[0] / source_magnitude[0]) * (
        target_magnitude[1] / source_magnitude[1]
    )
    source_normals = normalized_source  # narrowed by the explicit None check above
    target_normals = normalized_target
    candidates = [
        _grip_candidate(
            source,
            target,
            source_normals,  # type: ignore[arg-type]
            target_normals,  # type: ignore[arg-type]
            scale,
            constraints,
            False,
        )
    ]
    if constraints.mirror_allowed:
        candidates.append(
            _grip_candidate(
                source,
                target,
                source_normals,  # type: ignore[arg-type]
                target_normals,  # type: ignore[arg-type]
                scale,
                constraints,
                True,
            )
        )
    feasible = [candidate for candidate in candidates if candidate is not None]
    feasible.sort(
        key=lambda candidate: (
            candidate.max_normal_error_degrees,
            candidate.average_normal_error_degrees,
            candidate.mirrored,
        )
    )
    return bool(feasible)


def _certified_geometry_is_valid(frame: MountFrame, component_frame: ComponentFrame) -> bool:
    if isinstance(frame, SocketMountFrame) and isinstance(component_frame, SocketComponentFrame):
        return _socket_transform_is_feasible(component_frame, frame, frame.constraints)
    if isinstance(frame, GripMountFrame) and isinstance(component_frame, GripComponentFrame):
        return _grip_transform_is_feasible(component_frame, frame, frame.constraints)
    if isinstance(frame, GridMountFrame) and isinstance(component_frame, GridComponentFrame):
        accepted = set(frame.accepted_edge_types)
        edge_types = (
            component_frame.edge_types.north,
            component_frame.edge_types.east,
            component_frame.edge_types.south,
            component_frame.edge_types.west,
        )
        return (
            frame.plane == component_frame.plane
            and component_frame.footprint.columns <= frame.columns
            and component_frame.footprint.rows <= frame.rows
            and all(edge_type in accepted for edge_type in edge_types if edge_type is not None)
        )
    return False


def _validate_graph(
    catalogue: ProductKitCatalogue,
    context: ProductKitCatalogueContext,
) -> None:
    if catalogue.catalog_pack_id != context.catalog_pack_id:
        raise ValueError("catalogue pack does not match its binding context")
    if catalogue.catalog_sha256 != context.catalog_sha256:
        raise ValueError("catalogue hash does not match its binding context")
    if not _sorted_unique_by_id(catalogue.kits):
        raise ValueError("kits must have sorted unique IDs")
    if not _sorted_unique_by_id(catalogue.components):
        raise ValueError("components must have sorted unique IDs")
    if not _sorted_unique_by_id(catalogue.certifications):
        raise ValueError("certifications must have sorted unique IDs")

    records = {record.id: record for record in context.records}
    if len(records) != len(context.records):
        raise ValueError("catalogue context record IDs must be unique")
    kits = {kit.id: kit for kit in catalogue.kits}
    components = {component.id: component for component in catalogue.components}
    all_frame_ids = [frame.id for kit in catalogue.kits for frame in kit.mount_frames]
    if len(set(all_frame_ids)) != len(all_frame_ids):
        raise ValueError("mount-frame IDs must be globally unique")

    for kit in catalogue.kits:
        if not _raster_is_bound(kit.base, records, context.catalog_pack_id):
            raise ValueError("kit base raster is not bound to the reviewed offline catalogue")
        if not _sorted_unique_by_id(kit.mount_frames):
            raise ValueError("mount frames must have sorted unique IDs")
        if kit.mode == "whole":
            if kit.mount_frames:
                raise ValueError("whole kits may not contain mount frames")
        elif not kit.mount_frames or any(
            frame.mount_type != kit.mode for frame in kit.mount_frames
        ):
            raise ValueError("kit mode and mount-frame types must match exactly")
        for frame in kit.mount_frames:
            if isinstance(frame, GridMountFrame) and not _sorted_unique_strings(
                frame.accepted_edge_types
            ):
                raise ValueError("accepted grid edge types must be sorted and unique")

    for component in catalogue.components:
        if not _fragments_are_canonical(component.fragments):
            raise ValueError("component fragments must use canonical unique layer order")
        if any(
            not _raster_is_bound(fragment.raster, records, context.catalog_pack_id)
            for fragment in component.fragments
        ):
            raise ValueError("component raster is not bound to the reviewed offline catalogue")

    certified_pairs: set[tuple[str, str, str]] = set()
    for certification in catalogue.certifications:
        kit = kits.get(certification.kit_id)
        component = components.get(certification.component_id)
        frame = (
            next(
                (
                    candidate
                    for candidate in kit.mount_frames
                    if candidate.id == certification.mount_frame_id
                ),
                None,
            )
            if kit is not None
            else None
        )
        pair = (
            certification.kit_id,
            certification.mount_frame_id,
            certification.component_id,
        )
        if (
            kit is None
            or component is None
            or frame is None
            or kit.mode == "whole"
            or pair in certified_pairs
            or frame.slot_id != component.slot_id
            or frame.mount_type != component.component_frame.mount_type
            or not _same_profile(kit.compatibility_profile, component.compatibility_profile)
            or not _certified_geometry_is_valid(frame, component.component_frame)
        ):
            raise ValueError("certification does not bind an exact feasible kit/component pair")
        certified_pairs.add(pair)


def _model_value_for_revalidation(
    value: Any,
    unexpected_attributes: list[str],
    path: str = "$",
    active_ids: set[int] | None = None,
    model_state: bool = False,
    expected_annotation: Any = Any,
    allow_model_instances: bool = True,
) -> Any:
    """Rebuild model instances with aliases without dropping invalid state.

    Pydantic's direct ``revalidate_instances`` path exposes field-name mappings,
    which conflicts with this contract's deliberate alias-only input boundary.
    ``model_dump`` is also insufficient because it silently omits attributes
    injected by ``model_copy(update=...)``.  This traversal preserves explicit
    values (including explicit ``None``) and records every non-field attribute so
    the target model can reject the input rather than sanitising it.
    """

    plain_scalar_types = (bool, int, float, str, bytes)
    if isinstance(value, plain_scalar_types) and type(value) not in plain_scalar_types:
        unexpected_attributes.append(f"{path}:scalar-subclass")
        return value
    if isinstance(value, list) and type(value) is not list:
        unexpected_attributes.append(f"{path}:list-subclass")
        return None
    if isinstance(value, tuple) and type(value) is not tuple:
        unexpected_attributes.append(f"{path}:tuple-subclass")
        return None
    if isinstance(value, Mapping) and not isinstance(value, BaseModel) and type(value) is not dict:
        unexpected_attributes.append(f"{path}:mapping-subclass")
        return None
    if model_state and isinstance(value, Mapping) and not isinstance(value, BaseModel):
        unexpected_attributes.append(f"{path}:mapping-inside-model")
        return None

    if active_ids is None:
        active_ids = set()
    tracked = isinstance(value, (BaseModel, Mapping, list, tuple))
    identity = id(value)
    if tracked:
        if identity in active_ids:
            unexpected_attributes.append(f"{path}:cycle")
            return None
        active_ids.add(identity)

    try:
        if isinstance(value, BaseModel):
            expected_models = _annotation_model_types(expected_annotation)
            if not allow_model_instances:
                unexpected_attributes.append(f"{path}:model-inside-raw-mapping")
            if expected_annotation is not Any and type(value) not in expected_models:
                unexpected_attributes.append(f"{path}:unexpected-model-type")
            if not isinstance(value, ContractModel) or type(value).__bases__ != (ContractModel,):
                unexpected_attributes.append(f"{path}:model-subclass")
            fields = type(value).model_fields
            raw_fields_set = value.__pydantic_fields_set__
            if type(raw_fields_set) is not set:
                unexpected_attributes.append(f"{path}:fields-set-subclass")
                fields_set: set[str] = set()
            else:
                fields_set = set()
                for raw_name in raw_fields_set:
                    if type(raw_name) is not str:
                        unexpected_attributes.append(
                            f"{path}:non-plain-string-field-set-key"
                        )
                        continue
                    fields_set.add(raw_name)
            field_names = set(fields)
            model_values: dict[str, Any] = {}
            for raw_name, item in value.__dict__.items():
                if type(raw_name) is not str:
                    unexpected_attributes.append(
                        f"{path}:non-plain-string-model-key"
                    )
                    continue
                model_values[raw_name] = item
            rebuilt: dict[str, Any] = {}
            for name in fields_set - field_names:
                unexpected_attributes.append(f"{path}.{name}:unknown-field-set")
            if value.__pydantic_private__ is not None:
                unexpected_attributes.append(f"{path}:private-state")
            if value.__pydantic_extra__ is not None:
                unexpected_attributes.append(f"{path}:extra-state")
            for name, field in fields.items():
                if field.is_required() and name not in fields_set:
                    unexpected_attributes.append(f"{path}.{name}:required-not-set")
                if name not in model_values:
                    unexpected_attributes.append(f"{path}.{name}:missing")
                    continue
                item = model_values[name]
                if name not in fields_set and not field.is_required():
                    default = field.get_default(call_default_factory=False)
                    unchanged = item is default
                    if type(item) is type(default) and isinstance(
                        default,
                        (bool, int, float, str, bytes),
                    ):
                        unchanged = item == default
                    if not unchanged:
                        unexpected_attributes.append(f"{path}.{name}:not-set")
                    continue
                if isinstance(item, (bool, int, float, str, bytes)) and not (
                    _annotation_accepts_exact_scalar(field.annotation, item)
                ):
                    unexpected_attributes.append(f"{path}.{name}:scalar-type-drift")
                alias = field.alias or name
                rebuilt[alias] = _model_value_for_revalidation(
                    item,
                    unexpected_attributes,
                    f"{path}.{alias}",
                    active_ids,
                    True,
                    field.annotation,
                    allow_model_instances,
                )

            for name in model_values:
                if name not in fields:
                    unexpected_attributes.append(f"{path}.{name}")
            return rebuilt

        if isinstance(value, Mapping):
            rebuilt_mapping: dict[Any, Any] = {}
            for key, item in value.items():
                if type(key) is not str:
                    unexpected_attributes.append(f"{path}:non-plain-string-key")
                rebuilt_mapping[key] = _model_value_for_revalidation(
                    item,
                    unexpected_attributes,
                    f"{path}.{key}",
                    active_ids,
                    model_state,
                    Any,
                    allow_model_instances,
                )
            return rebuilt_mapping
        if isinstance(value, list):
            return [
                _model_value_for_revalidation(
                    item,
                    unexpected_attributes,
                    f"{path}[{index}]",
                    active_ids,
                    model_state,
                    _sequence_item_annotation(expected_annotation, index),
                    allow_model_instances,
                )
                for index, item in enumerate(value)
            ]
        if isinstance(value, tuple):
            return tuple(
                _model_value_for_revalidation(
                    item,
                    unexpected_attributes,
                    f"{path}[{index}]",
                    active_ids,
                    model_state,
                    _sequence_item_annotation(expected_annotation, index),
                    allow_model_instances,
                )
                for index, item in enumerate(value)
            )
        if value is not None and type(value) not in (bool, int, float, str, bytes):
            unexpected_attributes.append(f"{path}:non-json-value")
            return None
        return value
    finally:
        if tracked:
            active_ids.remove(identity)


def _annotation_accepts_exact_scalar(annotation: Any, value: Any) -> bool:
    origin = get_origin(annotation)
    if origin is Annotated:
        return _annotation_accepts_exact_scalar(get_args(annotation)[0], value)
    if origin is Literal:
        return any(type(value) is type(option) and value == option for option in get_args(annotation))
    if origin in (Union, types.UnionType):
        return any(_annotation_accepts_exact_scalar(option, value) for option in get_args(annotation))
    if annotation in (bool, int, float, str, bytes):
        return type(value) is annotation
    return False


def _annotation_model_types(annotation: Any) -> tuple[type[BaseModel], ...]:
    origin = get_origin(annotation)
    if origin is Annotated:
        return _annotation_model_types(get_args(annotation)[0])
    if origin in (Union, types.UnionType):
        return tuple(
            model_type
            for option in get_args(annotation)
            for model_type in _annotation_model_types(option)
        )
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return (annotation,)
    return ()


def _sequence_item_annotation(annotation: Any, index: int) -> Any:
    origin = get_origin(annotation)
    if origin is Annotated:
        return _sequence_item_annotation(get_args(annotation)[0], index)
    if origin is list:
        arguments = get_args(annotation)
        return arguments[0] if arguments else Any
    if origin is tuple:
        arguments = get_args(annotation)
        if len(arguments) == 2 and arguments[1] is Ellipsis:
            return arguments[0]
        return arguments[index] if index < len(arguments) else Any
    return Any


def _input_for_revalidation(value: Any, expected_model: type[BaseModel]) -> Any:
    unexpected_attributes: list[str] = []
    if isinstance(value, BaseModel) and type(value) is not expected_model:
        unexpected_attributes.append("$:unexpected-root-model")
    rebuilt = _model_value_for_revalidation(
        value,
        unexpected_attributes,
        model_state=isinstance(value, BaseModel),
        expected_annotation=expected_model,
        allow_model_instances=isinstance(value, BaseModel),
    )
    if unexpected_attributes and isinstance(rebuilt, dict):
        rebuilt["unexpectedModelAttributes"] = sorted(set(unexpected_attributes))
    return rebuilt


def validate_product_kit_catalogue(
    value: Any,
    context: Any,
) -> ProductKitCatalogue:
    """Validate syntax and catalogue-bound graph semantics, raising on failure."""

    catalogue = ProductKitCatalogue.model_validate(
        _input_for_revalidation(value, ProductKitCatalogue)
    )
    parsed_context = ProductKitCatalogueContext.model_validate(
        _input_for_revalidation(context, ProductKitCatalogueContext)
    )
    _validate_graph(catalogue, parsed_context)
    return catalogue


def parse_product_kit_catalogue(
    value: Any,
    context: Any,
) -> ProductKitCatalogue | None:
    """Return a validated catalogue or ``None``, matching the browser parser."""

    try:
        return validate_product_kit_catalogue(value, context)
    except Exception:
        return None


def canonical_json_bytes(
    value: BaseModel | Mapping[str, Any] | Sequence[Any],
) -> bytes:
    """Serialize sorted compact camelCase JSON as UTF-8 with one final LF."""

    payload: Any
    if isinstance(value, BaseModel):
        payload = value.model_dump(mode="json", by_alias=True, exclude_none=True)
    else:
        payload = value
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    return f"{encoded}\n".encode("utf-8")


__all__ = [
    "AssetReference",
    "Bounds",
    "Certification",
    "CompatibilityProfile",
    "Component",
    "Fragment",
    "GridComponentFrame",
    "GridMountFrame",
    "GripComponentFrame",
    "GripMountFrame",
    "Kit",
    "Point",
    "ProductKitCatalogue",
    "ProductKitCatalogueAssetRecord",
    "ProductKitCatalogueContext",
    "RasterFrame",
    "SocketComponentFrame",
    "SocketMountFrame",
    "TransformConstraints",
    "canonical_json_bytes",
    "parse_product_kit_catalogue",
    "validate_product_kit_catalogue",
]


```

## FILE: pipeline/product_kit/pack.py

```python
"""Fail-closed writer for versioned ``product-kit@1`` catalogue files."""

from __future__ import annotations

import os
from os import PathLike
from pathlib import Path
from typing import Any, BinaryIO
from uuid import uuid4

from .schema import canonical_json_bytes, validate_product_kit_catalogue


def _temporary_path(destination: Path) -> Path:
    return destination.with_name(f".{destination.name}.{uuid4().hex}.tmp")


def _write_payload(stream: BinaryIO, payload: bytes) -> None:
    written = stream.write(payload)
    if written != len(payload):
        raise OSError(
            f"short product-kit temporary write: {written} of {len(payload)} bytes"
        )
    stream.flush()
    os.fsync(stream.fileno())


def _replace_file(source: Path, destination: Path) -> None:
    """Atomically publish ``source`` without ever replacing ``destination``."""

    if os.name == "nt":
        os.rename(source, destination)
        return

    linked = False
    try:
        os.link(source, destination)
        linked = True
        source.unlink()
    except BaseException:
        if linked:
            destination.unlink(missing_ok=True)
        raise


def write_product_kit_pack(
    value: Any,
    context: Any,
    destination: str | PathLike[str],
) -> Path:
    """Validate and write one canonical product-kit catalogue."""

    parsed = validate_product_kit_catalogue(value, context)
    output_path = Path(destination)
    if not output_path.parent.is_dir():
        raise FileNotFoundError(
            f"product-kit destination parent does not exist: {output_path.parent}"
        )
    if os.path.lexists(output_path):
        raise FileExistsError(
            f"product-kit destination already exists: {output_path}"
        )
    payload = canonical_json_bytes(parsed)
    temporary_path = _temporary_path(output_path)
    temporary_created = False
    try:
        with temporary_path.open("xb") as stream:
            temporary_created = True
            _write_payload(stream, payload)
        if os.path.lexists(output_path):
            raise FileExistsError(
                f"product-kit destination already exists: {output_path}"
            )
        _replace_file(temporary_path, output_path)
    except BaseException:
        if temporary_created:
            temporary_path.unlink(missing_ok=True)
        raise
    return output_path


__all__ = ["write_product_kit_pack"]


```

## FILE: pipeline/tests/test_product_kit_schema.py

```python
from __future__ import annotations

import copy
import importlib
import json
import math
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from pipeline.asset_pipeline.json_schema import catalog_schema_validator


CATALOGUE_SHA = "f" * 64
REPO_ROOT = Path(__file__).resolve().parents[2]
HASHES = {
    "grid_base": "a" * 64,
    "grid_part": "b" * 64,
    "grip_base": "c" * 64,
    "grip_front": "d" * 64,
    "grip_rear": "e" * 64,
    "socket_base": "1" * 64,
    "socket_part": "2" * 64,
    "whole_base": "3" * 64,
}
FRAME = {
    "originalWidth": 100,
    "originalHeight": 100,
    "trimX": 0,
    "trimY": 0,
    "trimWidth": 100,
    "trimHeight": 100,
}
CONSTRAINTS = {
    "minScale": 0.5,
    "maxScale": 2.0,
    "minRotationDegrees": -45.0,
    "maxRotationDegrees": 45.0,
    "maxNormalErrorDegrees": 5.0,
    "mirrorAllowed": False,
}


def _contract() -> ModuleType:
    try:
        module = importlib.import_module("pipeline.product_kit.schema")
    except ModuleNotFoundError:
        pytest.fail("product_kit.schema has not been implemented")
    required = {
        "ProductKitCatalogue",
        "ProductKitCatalogueContext",
        "canonical_json_bytes",
        "parse_product_kit_catalogue",
    }
    missing = sorted(required.difference(vars(module)))
    assert missing == [], f"missing public contract symbols: {missing}"
    return module


def _asset(asset_id: str, master_sha256: str, kind: str = "raster-master") -> dict[str, Any]:
    return {
        "id": asset_id,
        "masterSha256": master_sha256,
        "delivery": "offline",
        "kind": kind,
        "files": {
            "master": f"/catalog/generated/offline-core-v1/assets/{asset_id}/master.png"
        },
        "dimensions": {"width": 100, "height": 100},
        "classroomReviewed": True,
        "brandFree": True,
    }


def context_fixture() -> dict[str, Any]:
    return {
        "catalogPackId": "offline-core-v1",
        "catalogSha256": CATALOGUE_SHA,
        "records": [
            _asset("asset-grid-base", HASHES["grid_base"]),
            _asset("asset-grid-part", HASHES["grid_part"], "component"),
            _asset("asset-grip-base", HASHES["grip_base"]),
            _asset("asset-grip-front", HASHES["grip_front"], "component"),
            _asset("asset-grip-rear", HASHES["grip_rear"], "component"),
            _asset("asset-socket-base", HASHES["socket_base"]),
            _asset("asset-socket-part", HASHES["socket_part"], "component"),
            _asset("asset-whole-base", HASHES["whole_base"]),
        ],
    }


def _raster(asset_id: str, master_sha256: str) -> dict[str, Any]:
    return {
        "assetId": asset_id,
        "masterSha256": master_sha256,
        "frame": dict(FRAME),
    }


def _profile(family_id: str, geometry_id: str) -> dict[str, str]:
    return {
        "familyId": family_id,
        "perspectiveId": "pk1-front-view",
        "geometryId": geometry_id,
        "styleId": "pk1-outline-clean",
    }


def catalogue_fixture() -> dict[str, Any]:
    return {
        "schema": "product-kit@1",
        "version": 1,
        "packId": "pk1-pilot",
        "catalogPackId": "offline-core-v1",
        "catalogSha256": CATALOGUE_SHA,
        "pricingVersion": "product-pricing@1",
        "connectorFormulaVersion": "product-kit-connectors@1",
        "kits": [
            {
                "id": "pk1-grid-kit",
                "title": "Escape Room Wall",
                "mode": "grid",
                "compatibilityProfile": _profile("pk1-escape-room", "pk1-wall-grid"),
                "base": _raster("asset-grid-base", HASHES["grid_base"]),
                "priceAssetId": "pk1-price-grid-base",
                "mountFrames": [
                    {
                        "id": "pk1-grid-frame",
                        "slotId": "pk1-grid-slot",
                        "mountType": "grid",
                        "origin": {"x": 0.1, "y": 0.1},
                        "cellSize": {"width": 0.1, "height": 0.1},
                        "columns": 8,
                        "rows": 6,
                        "plane": "wall",
                        "acceptedEdgeTypes": ["pk1-door", "pk1-panel"],
                    }
                ],
                "artworkBounds": [],
            },
            {
                "id": "pk1-grip-kit",
                "title": "Reusable Cup",
                "mode": "grip",
                "compatibilityProfile": _profile("pk1-drinkware", "pk1-cup-handle"),
                "base": _raster("asset-grip-base", HASHES["grip_base"]),
                "priceAssetId": "pk1-price-grip-base",
                "mountFrames": [
                    {
                        "id": "pk1-grip-frame",
                        "slotId": "pk1-handle-slot",
                        "mountType": "grip",
                        "contacts": [
                            {"x": 0.82, "y": 0.35},
                            {"x": 0.82, "y": 0.7},
                        ],
                        "normals": [
                            {"x": 1.0, "y": 0.0},
                            {"x": 1.0, "y": 0.0},
                        ],
                        "constraints": {**CONSTRAINTS, "mirrorAllowed": True},
                    }
                ],
                "artworkBounds": [
                    {"x": 0.25, "y": 0.25, "width": 0.45, "height": 0.5}
                ],
            },
            {
                "id": "pk1-socket-kit",
                "title": "Travel Bottle",
                "mode": "socket",
                "compatibilityProfile": _profile("pk1-drinkware", "pk1-bottle-lid"),
                "base": _raster("asset-socket-base", HASHES["socket_base"]),
                "priceAssetId": "pk1-price-socket-base",
                "mountFrames": [
                    {
                        "id": "pk1-socket-frame",
                        "slotId": "pk1-lid-slot",
                        "mountType": "socket",
                        "point": {"x": 0.5, "y": 0.08},
                        "normal": {"x": 0.0, "y": -1.0},
                        "referenceScale": 0.22,
                        "constraints": dict(CONSTRAINTS),
                    }
                ],
                "artworkBounds": [
                    {"x": 0.2, "y": 0.3, "width": 0.6, "height": 0.45}
                ],
            },
            {
                "id": "pk1-whole-kit",
                "title": "Complete Mug",
                "mode": "whole",
                "compatibilityProfile": _profile("pk1-drinkware", "pk1-complete-mug"),
                "base": _raster("asset-whole-base", HASHES["whole_base"]),
                "priceAssetId": "pk1-price-whole-base",
                "mountFrames": [],
                "artworkBounds": [
                    {"x": 0.25, "y": 0.25, "width": 0.45, "height": 0.5}
                ],
            },
        ],
        "components": [
            {
                "id": "pk1-grid-component",
                "title": "Secret Door",
                "slotId": "pk1-grid-slot",
                "compatibilityProfile": _profile("pk1-escape-room", "pk1-wall-grid"),
                "componentFrame": {
                    "mountType": "grid",
                    "plane": "wall",
                    "footprint": {"columns": 2, "rows": 3},
                    "edgeTypes": {"north": "pk1-panel", "south": "pk1-door"},
                },
                "fragments": [
                    {
                        "layer": "front",
                        "raster": _raster("asset-grid-part", HASHES["grid_part"]),
                    }
                ],
                "priceAssetId": "pk1-price-secret-door",
            },
            {
                "id": "pk1-grip-component",
                "title": "Loop Handle",
                "slotId": "pk1-handle-slot",
                "compatibilityProfile": _profile("pk1-drinkware", "pk1-cup-handle"),
                "componentFrame": {
                    "mountType": "grip",
                    "contacts": [
                        {"x": 0.18, "y": 0.25},
                        {"x": 0.18, "y": 0.75},
                    ],
                    "normals": [
                        {"x": -1.0, "y": 0.0},
                        {"x": -1.0, "y": 0.0},
                    ],
                },
                "fragments": [
                    {
                        "layer": "rear",
                        "raster": _raster("asset-grip-rear", HASHES["grip_rear"]),
                    },
                    {
                        "layer": "front",
                        "raster": _raster("asset-grip-front", HASHES["grip_front"]),
                    },
                ],
                "priceAssetId": "pk1-price-loop-handle",
            },
            {
                "id": "pk1-socket-component",
                "title": "Flip Lid",
                "slotId": "pk1-lid-slot",
                "compatibilityProfile": _profile("pk1-drinkware", "pk1-bottle-lid"),
                "componentFrame": {
                    "mountType": "socket",
                    "point": {"x": 0.5, "y": 0.9},
                    "normal": {"x": 0.0, "y": -1.0},
                    "referenceScale": 0.2,
                },
                "fragments": [
                    {
                        "layer": "front",
                        "raster": _raster("asset-socket-part", HASHES["socket_part"]),
                    }
                ],
                "priceAssetId": "pk1-price-flip-lid",
            },
        ],
        "certifications": [
            {
                "id": "pk1-cert-grid",
                "kitId": "pk1-grid-kit",
                "mountFrameId": "pk1-grid-frame",
                "componentId": "pk1-grid-component",
                "fingerprint": "4" * 64,
            },
            {
                "id": "pk1-cert-grip",
                "kitId": "pk1-grip-kit",
                "mountFrameId": "pk1-grip-frame",
                "componentId": "pk1-grip-component",
                "fingerprint": "5" * 64,
            },
            {
                "id": "pk1-cert-socket",
                "kitId": "pk1-socket-kit",
                "mountFrameId": "pk1-socket-frame",
                "componentId": "pk1-socket-component",
                "fingerprint": "6" * 64,
            },
        ],
    }


def _set_path(root: Any, path: tuple[str | int, ...], value: Any) -> None:
    target = root
    for segment in path[:-1]:
        target = target[segment]
    target[path[-1]] = value


def test_shared_cross_language_corpus_has_matching_python_verdicts() -> None:
    contract = _contract()
    corpus = json.loads(
        (REPO_ROOT / "catalog" / "schemas" / "product-kit-v1.corpus.json").read_text(
            encoding="utf-8"
        )
    )
    valid = corpus["valid"][0]["value"]
    context = corpus["context"]

    assert contract.parse_product_kit_catalogue(valid, context) is not None
    for case in corpus["derivedValid"]:
        candidate = copy.deepcopy(valid)
        candidate_context = copy.deepcopy(context)
        target = candidate if case["target"] == "value" else candidate_context
        _set_path(target, tuple(case["path"]), case["value"])
        assert (
            contract.parse_product_kit_catalogue(candidate, candidate_context)
            is not None
        ), case["name"]
    for case in corpus["derivedInvalid"]:
        candidate = copy.deepcopy(valid)
        candidate_context = copy.deepcopy(context)
        target = candidate if case["target"] == "value" else candidate_context
        _set_path(target, tuple(case["path"]), case["value"])
        assert (
            contract.parse_product_kit_catalogue(candidate, candidate_context) is None
        ), case["name"]


def test_draft_2020_schema_matches_shared_structural_corpus_verdicts() -> None:
    schema = json.loads(
        (REPO_ROOT / "catalog" / "schemas" / "product-kit-v1.schema.json").read_text(
            encoding="utf-8"
        )
    )
    corpus = json.loads(
        (REPO_ROOT / "catalog" / "schemas" / "product-kit-v1.corpus.json").read_text(
            encoding="utf-8"
        )
    )
    Draft202012Validator.check_schema(schema)
    validator = catalog_schema_validator(schema)
    valid = corpus["valid"][0]["value"]

    assert list(validator.iter_errors(valid)) == []
    for case in corpus["derivedValid"]:
        candidate = copy.deepcopy(valid)
        if case["target"] == "value":
            _set_path(candidate, tuple(case["path"]), case["value"])
        assert list(validator.iter_errors(candidate)) == [], case["name"]
    for case in corpus["derivedInvalid"]:
        candidate = copy.deepcopy(valid)
        if case["target"] == "value":
            _set_path(candidate, tuple(case["path"]), case["value"])
        errors = list(validator.iter_errors(candidate))
        if case["structural"]:
            assert errors, case["name"]
        else:
            assert errors == [], case["name"]


SYNTAX_CASES = (
    "top-level extras",
    "nested frame extras",
    "wrong schema literal",
    "wrong connector formula literal",
    "snake-case input key",
    "unprefixed product-kit ID",
    "uppercase hash",
    "empty title",
    "outer title whitespace",
    "control character in title",
    "overlong title",
    "overlong UTF-16 title",
    "JavaScript-trimmed title whitespace",
    "coerced version",
    "boolean version",
    "non-integral grid count",
    "boolean numeric constraint",
    "non-finite point",
    "infinite normal",
    "zero normal",
    "identical grip contacts",
    "grid outside design rectangle",
    "trim rectangle outside original dimensions",
    "artwork bounds outside design rectangle",
    "unknown grid edge key",
    "too many mount frames",
    "empty component fragments",
    "context extras",
)


def _apply_syntax_case(name: str, value: dict[str, Any], context: dict[str, Any]) -> None:
    match name:
        case "top-level extras":
            value["extra"] = True
        case "nested frame extras":
            value["kits"][1]["mountFrames"][0]["extra"] = True
        case "wrong schema literal":
            value["schema"] = "product-kit@2"
        case "wrong connector formula literal":
            value["connectorFormulaVersion"] = "product-kit-connectors@2"
        case "snake-case input key":
            value["catalog_pack_id"] = value.pop("catalogPackId")
        case "unprefixed product-kit ID":
            value["packId"] = "pilot"
        case "uppercase hash":
            value["catalogSha256"] = "A" * 64
        case "empty title":
            value["kits"][0]["title"] = ""
        case "outer title whitespace":
            value["kits"][0]["title"] = " Escape Room Wall"
        case "control character in title":
            value["kits"][0]["title"] = "Escape\nRoom"
        case "overlong title":
            value["kits"][0]["title"] = "x" * 81
        case "overlong UTF-16 title":
            value["kits"][0]["title"] = "\U0001f600" * 41
        case "JavaScript-trimmed title whitespace":
            value["kits"][0]["title"] = "\ufeffEscape Room Wall"
        case "coerced version":
            value["version"] = "1"
        case "boolean version":
            value["version"] = True
        case "non-integral grid count":
            value["kits"][0]["mountFrames"][0]["columns"] = 8.5
        case "boolean numeric constraint":
            value["kits"][1]["mountFrames"][0]["constraints"]["minScale"] = True
        case "non-finite point":
            value["kits"][2]["mountFrames"][0]["point"]["x"] = math.nan
        case "infinite normal":
            value["kits"][2]["mountFrames"][0]["normal"]["x"] = math.inf
        case "zero normal":
            value["kits"][2]["mountFrames"][0]["normal"] = {"x": 0.0, "y": 0.0}
        case "identical grip contacts":
            contacts = value["components"][1]["componentFrame"]["contacts"]
            contacts[1] = copy.deepcopy(contacts[0])
        case "grid outside design rectangle":
            value["kits"][0]["mountFrames"][0]["cellSize"] = {
                "width": 0.2,
                "height": 0.1,
            }
        case "trim rectangle outside original dimensions":
            value["kits"][0]["base"]["frame"]["originalWidth"] = 99
        case "artwork bounds outside design rectangle":
            value["kits"][1]["artworkBounds"][0]["width"] = 0.9
        case "unknown grid edge key":
            value["components"][0]["componentFrame"]["edgeTypes"]["diagonal"] = "pk1-panel"
        case "too many mount frames":
            frame = value["kits"][1]["mountFrames"][0]
            value["kits"][1]["mountFrames"] = [copy.deepcopy(frame) for _ in range(33)]
        case "empty component fragments":
            value["components"][0]["fragments"] = []
        case "context extras":
            context["extra"] = True
        case _:
            raise AssertionError(f"unknown syntax case: {name}")


GRAPH_CASES = (
    "unsorted kit IDs",
    "whole kit frames",
    "structural mode/frame mismatch",
    "duplicate mount-frame IDs",
    "mount-frame ID reused by another kit",
    "unsorted mount-frame IDs",
    "unknown certified kit",
    "unknown certified frame",
    "unknown certified component",
    "duplicate certified pair",
    "mismatched slot",
    "mismatched family profile",
    "mismatched perspective profile",
    "mismatched geometry profile",
    "mismatched style profile",
    "mismatched component frame type",
    "socket geometry outside scale limits",
    "socket geometry outside rotation limits",
    "grip geometry outside scale limits",
    "grip geometry requires forbidden mirror",
    "grid edge outside certified surface",
    "grid footprint larger than surface",
    "grid plane mismatch",
    "out-of-order component layers",
    "duplicate component layers",
    "unsorted component IDs",
    "duplicate component IDs",
    "unsorted certification IDs",
    "duplicate certification IDs",
    "unsorted grid edge types",
    "duplicate grid edge types",
    "wrong catalogue pack",
    "wrong catalogue hash",
    "duplicate context record IDs",
    "unknown raster asset",
    "stale raster hash",
    "unreviewed raster",
    "branded raster",
    "non-offline raster",
    "disallowed raster kind",
    "noncanonical raster path",
    "trim/catalogue dimension drift",
)


def _apply_graph_case(name: str, value: dict[str, Any], context: dict[str, Any]) -> None:
    match name:
        case "unsorted kit IDs":
            value["kits"].reverse()
        case "whole kit frames":
            value["kits"][3]["mountFrames"] = copy.deepcopy(value["kits"][2]["mountFrames"])
        case "structural mode/frame mismatch":
            value["kits"][1]["mode"] = "socket"
        case "duplicate mount-frame IDs":
            frames = value["kits"][1]["mountFrames"]
            frames.append(copy.deepcopy(frames[0]))
        case "mount-frame ID reused by another kit":
            reused_id = value["kits"][1]["mountFrames"][0]["id"]
            value["kits"][2]["mountFrames"][0]["id"] = reused_id
            value["certifications"][2]["mountFrameId"] = reused_id
        case "unsorted mount-frame IDs":
            frame = copy.deepcopy(value["kits"][1]["mountFrames"][0])
            frame["id"] = "pk1-alpha-frame"
            value["kits"][1]["mountFrames"].append(frame)
        case "unknown certified kit":
            value["certifications"][0]["kitId"] = "pk1-missing-kit"
        case "unknown certified frame":
            value["certifications"][0]["mountFrameId"] = "pk1-missing-frame"
        case "unknown certified component":
            value["certifications"][0]["componentId"] = "pk1-missing-component"
        case "duplicate certified pair":
            duplicate = copy.deepcopy(value["certifications"][0])
            duplicate["id"] = "pk1-cert-grid-copy"
            value["certifications"].insert(1, duplicate)
        case "mismatched slot":
            value["components"][0]["slotId"] = "pk1-other-slot"
        case name if name.startswith("mismatched ") and name.endswith(" profile"):
            key = name.removeprefix("mismatched ").removesuffix(" profile") + "Id"
            value["components"][1]["compatibilityProfile"][key] = f"pk1-other-{key.lower()}"
        case "mismatched component frame type":
            value["components"][2]["componentFrame"] = copy.deepcopy(
                value["components"][1]["componentFrame"]
            )
        case "socket geometry outside scale limits":
            value["components"][2]["componentFrame"]["referenceScale"] = 0.01
        case "socket geometry outside rotation limits":
            value["components"][2]["componentFrame"]["normal"] = {"x": 1.0, "y": 0.0}
        case "grip geometry outside scale limits":
            value["components"][1]["componentFrame"]["contacts"] = [
                {"x": 0.18, "y": 0.25},
                {"x": 0.18, "y": 0.3},
            ]
        case "grip geometry requires forbidden mirror":
            value["kits"][1]["mountFrames"][0]["constraints"]["mirrorAllowed"] = False
        case "grid edge outside certified surface":
            value["components"][0]["componentFrame"]["edgeTypes"] = {
                "north": "pk1-unsupported-edge"
            }
        case "grid footprint larger than surface":
            value["components"][0]["componentFrame"]["footprint"] = {
                "columns": 9,
                "rows": 3,
            }
        case "grid plane mismatch":
            value["components"][0]["componentFrame"]["plane"] = "floor"
        case "out-of-order component layers":
            value["components"][1]["fragments"].reverse()
        case "duplicate component layers":
            value["components"][1]["fragments"][1]["layer"] = "rear"
        case "unsorted component IDs":
            value["components"].reverse()
        case "duplicate component IDs":
            value["components"][1]["id"] = value["components"][0]["id"]
        case "unsorted certification IDs":
            value["certifications"].reverse()
        case "duplicate certification IDs":
            value["certifications"][1]["id"] = value["certifications"][0]["id"]
        case "unsorted grid edge types":
            value["kits"][0]["mountFrames"][0]["acceptedEdgeTypes"].reverse()
        case "duplicate grid edge types":
            value["kits"][0]["mountFrames"][0]["acceptedEdgeTypes"] = [
                "pk1-panel",
                "pk1-panel",
            ]
        case "wrong catalogue pack":
            context["catalogPackId"] = "another-pack"
        case "wrong catalogue hash":
            context["catalogSha256"] = "0" * 64
        case "duplicate context record IDs":
            context["records"].append(copy.deepcopy(context["records"][0]))
        case "unknown raster asset":
            value["kits"][0]["base"]["assetId"] = "asset-missing"
        case "stale raster hash":
            value["kits"][0]["base"]["masterSha256"] = "0" * 64
        case "unreviewed raster":
            context["records"][0]["classroomReviewed"] = False
        case "branded raster":
            context["records"][0]["brandFree"] = False
        case "non-offline raster":
            context["records"][0]["delivery"] = "live-photo"
        case "disallowed raster kind":
            context["records"][0]["kind"] = "photo"
        case "noncanonical raster path":
            context["records"][0]["files"]["master"] = (
                "/catalog/generated/offline-core-v1/assets/asset-grid-base/master.svg"
            )
        case "trim/catalogue dimension drift":
            value["kits"][0]["base"]["frame"]["trimWidth"] = 99
        case _:
            raise AssertionError(f"unknown graph case: {name}")


def test_accepts_valid_four_mode_catalogue_and_emits_exact_canonical_camel_case_bytes() -> None:
    contract = _contract()
    value = catalogue_fixture()
    context = context_fixture()
    before = copy.deepcopy((value, context))

    parsed = contract.parse_product_kit_catalogue(value, context)

    assert isinstance(parsed, contract.ProductKitCatalogue)
    assert [kit.mode for kit in parsed.kits] == ["grid", "grip", "socket", "whole"]
    assert [fragment.layer for fragment in parsed.components[1].fragments] == ["rear", "front"]
    assert parsed.catalog_pack_id == "offline-core-v1"
    assert (value, context) == before

    expected = (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")
    encoded = contract.canonical_json_bytes(parsed)
    assert encoded == expected
    assert contract.canonical_json_bytes(parsed) == encoded
    assert b'"catalogPackId":"offline-core-v1"' in encoded
    assert b"catalog_pack_id" not in encoded
    assert encoded.endswith(b"\n")
    assert not encoded.startswith(b"\xef\xbb\xbf")


@pytest.mark.parametrize("case", SYNTAX_CASES)
def test_rejects_strict_browser_syntax_cases(case: str) -> None:
    contract = _contract()
    value = catalogue_fixture()
    context = context_fixture()
    _apply_syntax_case(case, value, context)

    assert contract.parse_product_kit_catalogue(value, context) is None, case


@pytest.mark.parametrize("case", GRAPH_CASES)
def test_rejects_browser_graph_and_binding_cases(case: str) -> None:
    contract = _contract()
    value = catalogue_fixture()
    context = context_fixture()
    _apply_graph_case(case, value, context)

    assert contract.parse_product_kit_catalogue(value, context) is None, case


def test_accepts_tiny_positive_socket_and_grip_geometry_without_absolute_epsilon_cutoffs() -> None:
    contract = _contract()
    value = catalogue_fixture()

    socket_mount = value["kits"][2]["mountFrames"][0]
    socket_component = value["components"][2]["componentFrame"]
    socket_mount.update({"normal": {"x": 1e-10, "y": 0.0}, "referenceScale": 1e-10})
    socket_component.update({"normal": {"x": 1e-10, "y": 0.0}, "referenceScale": 1e-10})

    grip_mount = value["kits"][1]["mountFrames"][0]
    grip_component = value["components"][1]["componentFrame"]
    tiny_contacts = [{"x": 0.0, "y": 0.0}, {"x": 1e-10, "y": 0.0}]
    tiny_normals = [{"x": 0.0, "y": -1e-10}, {"x": 0.0, "y": -1e-10}]
    grip_mount.update(
        {
            "contacts": copy.deepcopy(tiny_contacts),
            "normals": copy.deepcopy(tiny_normals),
            "constraints": {**CONSTRAINTS, "mirrorAllowed": False},
        }
    )
    grip_component.update(
        {"contacts": copy.deepcopy(tiny_contacts), "normals": copy.deepcopy(tiny_normals)}
    )

    assert contract.parse_product_kit_catalogue(value, context_fixture()) is not None


def test_accepts_integral_decimal_json_numbers_like_browser_and_json_schema() -> None:
    contract = _contract()
    value = catalogue_fixture()
    value["version"] = 1.0
    value["kits"][0]["mountFrames"][0]["columns"] = 8.0
    value["kits"][0]["base"]["frame"]["originalWidth"] = 100.0

    parsed = contract.parse_product_kit_catalogue(value, context_fixture())

    assert parsed is not None
    assert parsed.version == 1
    assert parsed.kits[0].mount_frames[0].columns == 8
    assert parsed.kits[0].base.frame.original_width == 100


@pytest.mark.parametrize(
    "path",
    [
        ("kits", 0, "mountFrames", 0, "origin", "x"),
        ("kits", 2, "mountFrames", 0, "normal", "x"),
        ("kits", 2, "mountFrames", 0, "constraints", "maxNormalErrorDegrees"),
        ("kits", 0, "base", "frame", "trimX"),
    ],
)
def test_rejects_signed_zero_before_float_or_json_integer_coercion(
    path: tuple[str | int, ...],
) -> None:
    contract = _contract()
    value = catalogue_fixture()
    _set_path(value, path, -0.0)

    assert contract.parse_product_kit_catalogue(value, context_fixture()) is None


@pytest.mark.parametrize(
    ("path", "changed_value"),
    [
        (("packId",), "pk1-pilot\n"),
        (("catalogSha256",), f"{CATALOGUE_SHA}\n"),
    ],
)
def test_rejects_terminal_lf_in_ids_and_hashes(
    path: tuple[str | int, ...],
    changed_value: str,
) -> None:
    contract = _contract()
    value = catalogue_fixture()
    _set_path(value, path, changed_value)

    assert contract.parse_product_kit_catalogue(value, context_fixture()) is None


def test_exact_oblique_grip_alignment_passes_at_zero_normal_tolerance() -> None:
    contract = _contract()
    value = catalogue_fixture()
    grip_mount = value["kits"][1]["mountFrames"][0]
    grip_component = value["components"][1]["componentFrame"]
    common_contacts = [{"x": 0.1, "y": 0.2}, {"x": 0.8, "y": 0.7}]
    common_normals = [{"x": 1.0, "y": 1.0}, {"x": 1.0, "y": 1.0}]
    grip_mount.update(
        {
            "contacts": copy.deepcopy(common_contacts),
            "normals": copy.deepcopy(common_normals),
            "constraints": {
                **CONSTRAINTS,
                "mirrorAllowed": False,
                "maxNormalErrorDegrees": 0.0,
            },
        }
    )
    grip_component.update(
        {
            "contacts": copy.deepcopy(common_contacts),
            "normals": copy.deepcopy(common_normals),
        }
    )

    assert contract.parse_product_kit_catalogue(value, context_fixture()) is not None


def test_does_not_erase_genuine_tiny_socket_or_grip_angle_mismatches() -> None:
    contract = _contract()

    socket_value = catalogue_fixture()
    socket_mount = socket_value["kits"][2]["mountFrames"][0]
    socket_component = socket_value["components"][2]["componentFrame"]
    socket_mount.update(
        {
            "normal": {"x": -1.0, "y": 1e-16},
            "constraints": {
                **CONSTRAINTS,
                "minRotationDegrees": 0.0,
                "maxRotationDegrees": 0.0,
                "maxNormalErrorDegrees": 0.0,
            },
        }
    )
    socket_component["normal"] = {"x": -1.0, "y": -1e-16}
    assert contract.parse_product_kit_catalogue(socket_value, context_fixture()) is None

    grip_value = catalogue_fixture()
    grip_mount = grip_value["kits"][1]["mountFrames"][0]
    grip_component = grip_value["components"][1]["componentFrame"]
    common_contacts = [{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 0.0}]
    grip_mount.update(
        {
            "contacts": copy.deepcopy(common_contacts),
            "normals": [{"x": 1.0, "y": 0.0}, {"x": 1.0, "y": 0.0}],
            "constraints": {
                **CONSTRAINTS,
                "mirrorAllowed": False,
                "maxNormalErrorDegrees": 0.0,
            },
        }
    )
    grip_component.update(
        {
            "contacts": copy.deepcopy(common_contacts),
            "normals": [
                {"x": 1.0, "y": 1e-16},
                {"x": 1.0, "y": 1e-16},
            ],
        }
    )
    assert contract.parse_product_kit_catalogue(grip_value, context_fixture()) is None


def test_model_classes_are_alias_only_strict_and_context_is_independently_validated() -> None:
    contract = _contract()
    catalogue = contract.ProductKitCatalogue.model_validate(catalogue_fixture())
    context = contract.ProductKitCatalogueContext.model_validate(context_fixture())

    assert catalogue.catalog_pack_id == context.catalog_pack_id
    with pytest.raises(ValidationError):
        contract.ProductKitCatalogue.model_validate(
            {**catalogue_fixture(), "catalogPackId": None}
        )
    with pytest.raises(ValidationError):
        contract.ProductKitCatalogueContext.model_validate(
            {**context_fixture(), "records": "not-an-array"}
        )


def test_validation_revalidates_mutated_model_instances_and_detaches_valid_models() -> None:
    contract = _contract()
    original = contract.validate_product_kit_catalogue(
        catalogue_fixture(), context_fixture()
    )
    context = contract.ProductKitCatalogueContext.model_validate(context_fixture())
    valid_clone = contract.validate_product_kit_catalogue(original, context)

    assert valid_clone is not original
    invalid_version = original.model_copy(update={"version": 2})
    assert contract.parse_product_kit_catalogue(invalid_version, context) is None

    invalid_nested = original.model_copy(deep=True)
    invalid_nested.kits.clear()
    assert contract.parse_product_kit_catalogue(invalid_nested, context) is None

    invalid_extra = original.model_copy(update={"unexpected": True})
    assert contract.parse_product_kit_catalogue(invalid_extra, context) is None

    invalid_explicit_null = original.model_copy(deep=True)
    edge_types = invalid_explicit_null.components[0].component_frame.edge_types
    object.__setattr__(edge_types, "north", None)
    assert "north" in edge_types.__pydantic_fields_set__
    assert contract.parse_product_kit_catalogue(invalid_explicit_null, context) is None

    invalid_omitted_field = original.model_copy(deep=True)
    omitted_edges = invalid_omitted_field.components[0].component_frame.edge_types
    assert "east" not in omitted_edges.__pydantic_fields_set__
    object.__setattr__(omitted_edges, "east", "not-a-product-kit-id")
    assert contract.parse_product_kit_catalogue(invalid_omitted_field, context) is None

    invalid_valid_omitted_field = original.model_copy(deep=True)
    valid_omitted_edges = (
        invalid_valid_omitted_field.components[0].component_frame.edge_types
    )
    assert "east" not in valid_omitted_edges.__pydantic_fields_set__
    object.__setattr__(valid_omitted_edges, "east", "pk1-panel")
    assert (
        contract.parse_product_kit_catalogue(invalid_valid_omitted_field, context)
        is None
    )

    invalid_deleted_optional = original.model_copy(deep=True)
    deleted_edges = invalid_deleted_optional.components[0].component_frame.edge_types
    assert "east" not in deleted_edges.__pydantic_fields_set__
    object.__delattr__(deleted_edges, "east")
    assert contract.parse_product_kit_catalogue(invalid_deleted_optional, context) is None

    cyclic_extra: list[object] = []
    cyclic_extra.append(cyclic_extra)
    invalid_cycle = original.model_copy(update={"unexpected": cyclic_extra})
    assert contract.parse_product_kit_catalogue(invalid_cycle, context) is None

    deeply_nested_extra: object = []
    for _ in range(1_500):
        deeply_nested_extra = [deeply_nested_extra]
    invalid_depth = original.model_copy(update={"unexpected": deeply_nested_extra})
    assert contract.parse_product_kit_catalogue(invalid_depth, context) is None

    invalid_required_fields_set = original.model_copy(deep=True)
    invalid_required_fields_set.__pydantic_fields_set__.discard("version")
    assert (
        contract.parse_product_kit_catalogue(invalid_required_fields_set, context)
        is None
    )

    invalid_unknown_fields_set = original.model_copy(deep=True)
    invalid_unknown_fields_set.__pydantic_fields_set__.add("unexpected")
    assert contract.parse_product_kit_catalogue(invalid_unknown_fields_set, context) is None

    class InternalStringKey(str):
        pass

    invalid_fields_set_key = original.model_copy(deep=True)
    invalid_fields_set_key.__pydantic_fields_set__.remove("version")
    invalid_fields_set_key.__pydantic_fields_set__.add(InternalStringKey("version"))
    assert contract.parse_product_kit_catalogue(invalid_fields_set_key, context) is None

    invalid_model_dict_key = original.model_copy(deep=True)
    schema_value = invalid_model_dict_key.__dict__.pop("schema_id")
    invalid_model_dict_key.__dict__[InternalStringKey("schema_id")] = schema_value
    assert contract.parse_product_kit_catalogue(invalid_model_dict_key, context) is None

    invalid_private_state = original.model_copy(deep=True)
    object.__setattr__(invalid_private_state, "__pydantic_private__", {"hidden": True})
    assert contract.parse_product_kit_catalogue(invalid_private_state, context) is None

    class FalseyState(dict[str, object]):
        def __bool__(self) -> bool:
            return False

    invalid_falsey_private = original.model_copy(deep=True)
    object.__setattr__(
        invalid_falsey_private,
        "__pydantic_private__",
        FalseyState({"hidden": True}),
    )
    assert contract.parse_product_kit_catalogue(invalid_falsey_private, context) is None

    invalid_falsey_extra = original.model_copy(deep=True)
    object.__setattr__(
        invalid_falsey_extra,
        "__pydantic_extra__",
        FalseyState({"unexpected": True}),
    )
    assert contract.parse_product_kit_catalogue(invalid_falsey_extra, context) is None

    class EvilString(str):
        def __eq__(self, other: object) -> bool:
            return str(self) == str(other)

    invalid_scalar_subclass = original.model_copy(deep=True)
    object.__setattr__(
        invalid_scalar_subclass,
        "pack_id",
        EvilString(original.pack_id),
    )
    assert contract.parse_product_kit_catalogue(invalid_scalar_subclass, context) is None

    class CatalogueSubclass(contract.ProductKitCatalogue):
        pass

    invalid_model_subclass = CatalogueSubclass.model_validate(catalogue_fixture())
    assert contract.parse_product_kit_catalogue(invalid_model_subclass, context) is None

    invalid_nested_mapping = original.model_copy(deep=True)
    invalid_nested_mapping.kits[0] = invalid_nested_mapping.kits[0].model_dump(
        by_alias=True
    )  # type: ignore[assignment]
    assert contract.parse_product_kit_catalogue(invalid_nested_mapping, context) is None

    invalid_model_number = original.model_copy(deep=True)
    object.__setattr__(invalid_model_number, "version", 1.0)
    assert contract.parse_product_kit_catalogue(invalid_model_number, context) is None

    invalid_nested_model_type = original.model_copy(deep=True)
    socket_frame = invalid_nested_model_type.kits[2].mount_frames[0]
    wrong_point_model = contract.Normal.model_validate({"x": 0.5, "y": 0.08})
    object.__setattr__(socket_frame, "point", wrong_point_model)
    assert contract.parse_product_kit_catalogue(invalid_nested_model_type, context) is None

    raw_model_hybrid = catalogue_fixture()
    raw_model_hybrid["kits"][2]["mountFrames"][0]["point"] = (
        contract.Point.model_validate({"x": 0.5, "y": 0.08})
    )
    assert contract.parse_product_kit_catalogue(
        raw_model_hybrid,
        context_fixture(),
    ) is None

    class EqualToNone:
        def __eq__(self, other: object) -> bool:
            return other is None

    invalid_equal_default = original.model_copy(deep=True)
    equal_default_edges = invalid_equal_default.components[0].component_frame.edge_types
    object.__setattr__(equal_default_edges, "east", EqualToNone())
    assert contract.parse_product_kit_catalogue(invalid_equal_default, context) is None

    class EqualityExplosion:
        def __eq__(self, _other: object) -> bool:
            raise RuntimeError("equality must not run at the parser boundary")

    invalid_exploding_default = original.model_copy(deep=True)
    exploding_edges = invalid_exploding_default.components[0].component_frame.edge_types
    object.__setattr__(exploding_edges, "east", EqualityExplosion())
    assert contract.parse_product_kit_catalogue(invalid_exploding_default, context) is None

    from decimal import Decimal

    invalid_decimal = catalogue_fixture()
    invalid_decimal["kits"][2]["mountFrames"][0]["point"]["x"] = Decimal("0.5")
    assert contract.parse_product_kit_catalogue(invalid_decimal, context_fixture()) is None

    class StringKey(str):
        pass

    invalid_key = catalogue_fixture()
    invalid_key[StringKey("schema")] = invalid_key.pop("schema")
    assert contract.parse_product_kit_catalogue(invalid_key, context_fixture()) is None


```

## FILE: pipeline/tests/test_product_kit_pack.py

```python
from __future__ import annotations

import importlib
import json
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest
from pydantic import ValidationError

from pipeline.product_kit.schema import (
    ProductKitCatalogueContext,
    canonical_json_bytes,
    validate_product_kit_catalogue,
)


REPO_ROOT = Path(__file__).resolve().parents[2]


def _pack() -> ModuleType:
    try:
        module = importlib.import_module("pipeline.product_kit.pack")
    except ModuleNotFoundError:
        pytest.fail("product_kit.pack has not been implemented")
    assert hasattr(module, "write_product_kit_pack")
    return module


def _valid_contract() -> tuple[dict[str, Any], dict[str, Any]]:
    corpus = json.loads(
        (REPO_ROOT / "catalog" / "schemas" / "product-kit-v1.corpus.json").read_text(
            encoding="utf-8"
        )
    )
    return corpus["valid"][0]["value"], corpus["context"]


def test_writes_exact_canonical_bytes_to_new_versioned_destination(
    tmp_path: Path,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"

    result = module.write_product_kit_pack(value, context, destination)

    assert result == destination
    expected = canonical_json_bytes(validate_product_kit_catalogue(value, context))
    assert destination.read_bytes() == expected
    assert list(tmp_path.iterdir()) == [destination]


def test_rejects_invalid_manifest_before_creating_any_file(tmp_path: Path) -> None:
    module = _pack()
    value, context = _valid_contract()
    value["schema"] = "product-kit@2"
    destination = tmp_path / "product-kit-v1.json"

    with pytest.raises(ValidationError):
        module.write_product_kit_pack(value, context, destination)

    assert destination.exists() is False
    assert list(tmp_path.iterdir()) == []


def test_requires_an_existing_parent_directory(tmp_path: Path) -> None:
    module = _pack()
    value, context = _valid_contract()
    missing_parent = tmp_path / "missing"
    destination = missing_parent / "product-kit-v1.json"

    with pytest.raises(FileNotFoundError):
        module.write_product_kit_pack(value, context, destination)

    assert missing_parent.exists() is False


def test_refuses_to_overwrite_an_existing_destination(tmp_path: Path) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"
    destination.write_bytes(b"keep-existing\n")

    with pytest.raises(FileExistsError):
        module.write_product_kit_pack(value, context, destination)

    assert destination.read_bytes() == b"keep-existing\n"
    assert list(tmp_path.iterdir()) == [destination]


def test_exclusively_creates_the_sibling_temporary_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"
    occupied_temporary = tmp_path / ".product-kit-v1.json.occupied.tmp"
    occupied_temporary.write_bytes(b"foreign-temporary\n")
    monkeypatch.setattr(
        module,
        "_temporary_path",
        lambda _destination: occupied_temporary,
        raising=False,
    )

    with pytest.raises(FileExistsError):
        module.write_product_kit_pack(value, context, destination)

    assert destination.exists() is False
    assert occupied_temporary.read_bytes() == b"foreign-temporary\n"


def test_simulated_partial_write_leaves_no_output_or_temporary_residue(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"

    def fail_after_partial_write(stream: Any, payload: bytes) -> None:
        assert Path(stream.name).parent == destination.parent
        assert Path(stream.name) != destination
        stream.write(payload[:17])
        raise OSError("simulated write failure")

    monkeypatch.setattr(
        module,
        "_write_payload",
        fail_after_partial_write,
        raising=False,
    )

    with pytest.raises(OSError, match="simulated write failure"):
        module.write_product_kit_pack(value, context, destination)

    assert destination.exists() is False
    assert list(tmp_path.iterdir()) == []


def test_simulated_atomic_replace_failure_removes_the_complete_temporary_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"

    def fail_replace(source: Path, target: Path) -> None:
        assert source.parent == destination.parent
        assert source.is_file()
        assert target == destination
        assert destination.exists() is False
        raise OSError("simulated replace failure")

    monkeypatch.setattr(module, "_replace_file", fail_replace, raising=False)

    with pytest.raises(OSError, match="simulated replace failure"):
        module.write_product_kit_pack(value, context, destination)

    assert destination.exists() is False
    assert list(tmp_path.iterdir()) == []


def test_never_overwrites_a_destination_created_during_atomic_publish(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"
    publish = module._replace_file

    def create_competing_destination_then_publish(source: Path, target: Path) -> None:
        target.write_bytes(b"competing-writer\n")
        publish(source, target)

    monkeypatch.setattr(
        module,
        "_replace_file",
        create_competing_destination_then_publish,
    )

    with pytest.raises(FileExistsError):
        module.write_product_kit_pack(value, context, destination)

    assert destination.read_bytes() == b"competing-writer\n"
    assert list(tmp_path.iterdir()) == [destination]


def test_simulated_fsync_failure_leaves_no_output_or_temporary_residue(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"

    def fail_fsync(_file_descriptor: int) -> None:
        raise OSError("simulated fsync failure")

    monkeypatch.setattr(module.os, "fsync", fail_fsync)

    with pytest.raises(OSError, match="simulated fsync failure"):
        module.write_product_kit_pack(value, context, destination)

    assert destination.exists() is False
    assert list(tmp_path.iterdir()) == []


def test_revalidates_mutated_model_instances_before_any_write(tmp_path: Path) -> None:
    module = _pack()
    value, context_value = _valid_contract()
    parsed = validate_product_kit_catalogue(value, context_value)
    context = ProductKitCatalogueContext.model_validate(context_value)

    invalid_version = parsed.model_copy(update={"version": 2})
    version_destination = tmp_path / "invalid-version.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(invalid_version, context, version_destination)

    invalid_nested = parsed.model_copy(deep=True)
    invalid_nested.kits.clear()
    nested_destination = tmp_path / "invalid-nested.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(invalid_nested, context, nested_destination)

    invalid_extra = parsed.model_copy(update={"unexpected": True})
    extra_destination = tmp_path / "invalid-extra.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(invalid_extra, context, extra_destination)

    invalid_explicit_null = parsed.model_copy(deep=True)
    edge_types = invalid_explicit_null.components[0].component_frame.edge_types
    object.__setattr__(edge_types, "north", None)
    explicit_null_destination = tmp_path / "invalid-explicit-null.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_explicit_null,
            context,
            explicit_null_destination,
        )

    invalid_omitted_field = parsed.model_copy(deep=True)
    omitted_edges = invalid_omitted_field.components[0].component_frame.edge_types
    assert "east" not in omitted_edges.__pydantic_fields_set__
    object.__setattr__(omitted_edges, "east", "not-a-product-kit-id")
    omitted_field_destination = tmp_path / "invalid-omitted-field.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_omitted_field,
            context,
            omitted_field_destination,
        )

    invalid_valid_omitted_field = parsed.model_copy(deep=True)
    valid_omitted_edges = (
        invalid_valid_omitted_field.components[0].component_frame.edge_types
    )
    assert "east" not in valid_omitted_edges.__pydantic_fields_set__
    object.__setattr__(valid_omitted_edges, "east", "pk1-panel")
    valid_omitted_destination = tmp_path / "invalid-valid-omitted-field.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_valid_omitted_field,
            context,
            valid_omitted_destination,
        )

    invalid_deleted_optional = parsed.model_copy(deep=True)
    deleted_edges = invalid_deleted_optional.components[0].component_frame.edge_types
    assert "east" not in deleted_edges.__pydantic_fields_set__
    object.__delattr__(deleted_edges, "east")
    deleted_optional_destination = tmp_path / "invalid-deleted-optional.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_deleted_optional,
            context,
            deleted_optional_destination,
        )

    cyclic_extra: list[object] = []
    cyclic_extra.append(cyclic_extra)
    invalid_cycle = parsed.model_copy(update={"unexpected": cyclic_extra})
    cyclic_destination = tmp_path / "invalid-cycle.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(invalid_cycle, context, cyclic_destination)

    deeply_nested_extra: object = []
    for _ in range(1_500):
        deeply_nested_extra = [deeply_nested_extra]
    invalid_depth = parsed.model_copy(update={"unexpected": deeply_nested_extra})
    depth_destination = tmp_path / "invalid-depth.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(invalid_depth, context, depth_destination)

    invalid_required_fields_set = parsed.model_copy(deep=True)
    invalid_required_fields_set.__pydantic_fields_set__.discard("version")
    required_set_destination = tmp_path / "invalid-required-fields-set.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_required_fields_set,
            context,
            required_set_destination,
        )

    invalid_unknown_fields_set = parsed.model_copy(deep=True)
    invalid_unknown_fields_set.__pydantic_fields_set__.add("unexpected")
    unknown_set_destination = tmp_path / "invalid-unknown-fields-set.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_unknown_fields_set,
            context,
            unknown_set_destination,
        )

    invalid_private_state = parsed.model_copy(deep=True)
    object.__setattr__(invalid_private_state, "__pydantic_private__", {"hidden": True})
    private_destination = tmp_path / "invalid-private-state.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_private_state,
            context,
            private_destination,
        )

    class FalseyState(dict[str, object]):
        def __bool__(self) -> bool:
            return False

    invalid_falsey_private = parsed.model_copy(deep=True)
    object.__setattr__(
        invalid_falsey_private,
        "__pydantic_private__",
        FalseyState({"hidden": True}),
    )
    falsey_private_destination = tmp_path / "invalid-falsey-private.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_falsey_private,
            context,
            falsey_private_destination,
        )

    invalid_falsey_extra = parsed.model_copy(deep=True)
    object.__setattr__(
        invalid_falsey_extra,
        "__pydantic_extra__",
        FalseyState({"unexpected": True}),
    )
    falsey_extra_destination = tmp_path / "invalid-falsey-extra.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_falsey_extra,
            context,
            falsey_extra_destination,
        )

    class CatalogueSubclass(type(parsed)):
        pass

    invalid_model_subclass = CatalogueSubclass.model_validate(value)
    subclass_destination = tmp_path / "invalid-model-subclass.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_model_subclass,
            context,
            subclass_destination,
        )

    invalid_nested_mapping = parsed.model_copy(deep=True)
    invalid_nested_mapping.kits[0] = invalid_nested_mapping.kits[0].model_dump(
        by_alias=True
    )  # type: ignore[assignment]
    mapping_destination = tmp_path / "invalid-nested-mapping.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_nested_mapping,
            context,
            mapping_destination,
        )

    invalid_model_number = parsed.model_copy(deep=True)
    object.__setattr__(invalid_model_number, "version", 1.0)
    number_destination = tmp_path / "invalid-model-number.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_model_number,
            context,
            number_destination,
        )

    assert list(tmp_path.iterdir()) == []


```

## FILE: web/src/product-kit/utf8-sha256.ts

```typescript
const ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const INITIAL_HASH = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]);

const encoder = new TextEncoder();

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

function assertWellFormedUtf16(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError("SHA-256 input contains malformed UTF-16");
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new TypeError("SHA-256 input contains malformed UTF-16");
    }
  }
}

function paddedMessage(value: string): Uint8Array {
  const encoded = encoder.encode(value);
  const paddedLength = Math.ceil((encoded.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(encoded);
  padded[encoded.length] = 0x80;

  const bitLengthHigh = Math.floor(encoded.length / 0x20000000);
  const bitLengthLow = (encoded.length << 3) >>> 0;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, bitLengthHigh, false);
  view.setUint32(paddedLength - 4, bitLengthLow, false);
  return padded;
}

export function sha256Utf8(value: string): string {
  assertWellFormedUtf16(value);

  const message = paddedMessage(value);
  const hash = new Uint32Array(INITIAL_HASH);
  const schedule = new Uint32Array(64);
  const view = new DataView(message.buffer);

  for (let offset = 0; offset < message.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const previous15 = schedule[index - 15]!;
      const previous2 = schedule[index - 2]!;
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^
        (previous15 >>> 3);
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^
        (previous2 >>> 10);
      schedule[index] = (schedule[index - 16]! + sigma0 +
        schedule[index - 7]! + sigma1) >>> 0;
    }

    let a = hash[0]!;
    let b = hash[1]!;
    let c = hash[2]!;
    let d = hash[3]!;
    let e = hash[4]!;
    let f = hash[5]!;
    let g = hash[6]!;
    let h = hash[7]!;

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + ROUND_CONSTANTS[index]! +
        schedule[index]!) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    hash[0] = (hash[0]! + a) >>> 0;
    hash[1] = (hash[1]! + b) >>> 0;
    hash[2] = (hash[2]! + c) >>> 0;
    hash[3] = (hash[3]! + d) >>> 0;
    hash[4] = (hash[4]! + e) >>> 0;
    hash[5] = (hash[5]! + f) >>> 0;
    hash[6] = (hash[6]! + g) >>> 0;
    hash[7] = (hash[7]! + h) >>> 0;
  }

  return [...hash]
    .map((word) => word.toString(16).padStart(8, "0"))
    .join("");
}


```

## FILE: web/src/product-kit/certification-fingerprint.ts

```typescript
import type {
  ProductKitComponent,
  ProductKitKit,
  ProductKitMountFrame
} from "./product-kit-catalogue";
import { snapshotPlainData } from "./plain-data";
import { sha256Utf8 } from "./utf8-sha256";

const SHA256 = /^[0-9a-f]{64}(?![\s\S])/;
const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const PRODUCT_KIT_ID = /^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const CERTIFICATION_SCHEMA = "product-kit-certification@1";
const CERTIFICATION_VERSION = 1;
const INVALID_EDGE = Symbol("invalid-grid-edge");

type CanonicalObject = Readonly<Record<string, unknown>>;

export interface ProductKitCertificationContext {
  readonly packId: string;
  readonly connectorFormulaVersion: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[]
): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length && keys.every((key) =>
    typeof key === "string" && expected.includes(key)
  );
}

function hasOwnDenseIndices(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function isWellFormedString(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    !Object.is(value, -0);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0);
}

function isPortableId(value: unknown): value is string {
  return isWellFormedString(value) && value.length <= 80 && PORTABLE_ID.test(value);
}

function isProductKitId(value: unknown): value is string {
  return isWellFormedString(value) && value.length <= 80 && PRODUCT_KIT_ID.test(value);
}

function canonicalPoint(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, ["x", "y"]) ||
    !isFiniteNumber(value.x) || value.x < 0 || value.x > 1 ||
    !isFiniteNumber(value.y) || value.y < 0 || value.y > 1) {
    return null;
  }
  return { x: value.x, y: value.y };
}

function canonicalNormal(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, ["x", "y"]) ||
    !isFiniteNumber(value.x) || value.x < -1 || value.x > 1 ||
    !isFiniteNumber(value.y) || value.y < -1 || value.y > 1 ||
    (value.x === 0 && value.y === 0)) return null;
  return { x: value.x, y: value.y };
}

function canonicalProfile(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "familyId", "perspectiveId", "geometryId", "styleId"
  ]) || !isProductKitId(value.familyId) ||
    !isProductKitId(value.perspectiveId) ||
    !isProductKitId(value.geometryId) ||
    !isProductKitId(value.styleId)) return null;
  return {
    familyId: value.familyId,
    perspectiveId: value.perspectiveId,
    geometryId: value.geometryId,
    styleId: value.styleId
  };
}

function canonicalRasterFrame(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "originalWidth", "originalHeight", "trimX", "trimY", "trimWidth", "trimHeight"
  ]) ||
    !isSafeInteger(value.originalWidth) ||
    !isSafeInteger(value.originalHeight) ||
    !isSafeInteger(value.trimX) ||
    !isSafeInteger(value.trimY) ||
    !isSafeInteger(value.trimWidth) ||
    !isSafeInteger(value.trimHeight) ||
    value.originalWidth < 1 || value.originalWidth > 8192 ||
    value.originalHeight < 1 || value.originalHeight > 8192 ||
    value.trimX < 0 || value.trimX > 8191 ||
    value.trimY < 0 || value.trimY > 8191 ||
    value.trimWidth < 1 || value.trimWidth > 8192 ||
    value.trimHeight < 1 || value.trimHeight > 8192 ||
    value.trimX + value.trimWidth > value.originalWidth ||
    value.trimY + value.trimHeight > value.originalHeight) return null;
  return {
    originalWidth: value.originalWidth,
    originalHeight: value.originalHeight,
    trimX: value.trimX,
    trimY: value.trimY,
    trimWidth: value.trimWidth,
    trimHeight: value.trimHeight
  };
}

function canonicalRaster(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, ["assetId", "masterSha256", "frame"]) ||
    !isPortableId(value.assetId) ||
    typeof value.masterSha256 !== "string" ||
    !SHA256.test(value.masterSha256)) return null;
  const frame = canonicalRasterFrame(value.frame);
  if (!frame) return null;
  return {
    assetId: value.assetId,
    masterSha256: value.masterSha256,
    frame
  };
}

function canonicalConstraints(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "minScale", "maxScale", "minRotationDegrees", "maxRotationDegrees",
    "maxNormalErrorDegrees", "mirrorAllowed"
  ]) ||
    !isFiniteNumber(value.minScale) ||
    !isFiniteNumber(value.maxScale) ||
    !isFiniteNumber(value.minRotationDegrees) ||
    !isFiniteNumber(value.maxRotationDegrees) ||
    !isFiniteNumber(value.maxNormalErrorDegrees) ||
    typeof value.mirrorAllowed !== "boolean" ||
    value.minScale <= 0 || value.minScale > 8 ||
    value.maxScale <= 0 || value.maxScale > 8 || value.minScale > value.maxScale ||
    value.minRotationDegrees < -180 || value.minRotationDegrees > 180 ||
    value.maxRotationDegrees < -180 || value.maxRotationDegrees > 180 ||
    value.minRotationDegrees > value.maxRotationDegrees ||
    value.maxNormalErrorDegrees < 0 || value.maxNormalErrorDegrees > 45) return null;
  return {
    minScale: value.minScale,
    maxScale: value.maxScale,
    minRotationDegrees: value.minRotationDegrees,
    maxRotationDegrees: value.maxRotationDegrees,
    maxNormalErrorDegrees: value.maxNormalErrorDegrees,
    mirrorAllowed: value.mirrorAllowed
  };
}

function canonicalPair(
  value: unknown,
  canonicalItem: (item: unknown) => CanonicalObject | null
): readonly [CanonicalObject, CanonicalObject] | null {
  if (!Array.isArray(value) || value.length !== 2 ||
    !hasOwnDenseIndices(value)) return null;
  const first = canonicalItem(value[0]);
  const second = canonicalItem(value[1]);
  return first && second ? [first, second] : null;
}

function canonicalMountFrame(value: unknown): CanonicalObject | null {
  if (!isRecord(value) ||
    !isProductKitId(value.id) ||
    !isProductKitId(value.slotId)) return null;

  if (value.mountType === "socket") {
    if (!hasExactKeys(value, [
      "id", "slotId", "mountType", "point", "normal", "referenceScale", "constraints"
    ])) return null;
    const point = canonicalPoint(value.point);
    const normal = canonicalNormal(value.normal);
    const constraints = canonicalConstraints(value.constraints);
    if (!point || !normal || !isFiniteNumber(value.referenceScale) ||
      value.referenceScale <= 0 || value.referenceScale > 2 || !constraints) return null;
    return {
      id: value.id,
      slotId: value.slotId,
      mountType: "socket",
      point,
      normal,
      referenceScale: value.referenceScale,
      constraints
    };
  }

  if (value.mountType === "grip") {
    if (!hasExactKeys(value, [
      "id", "slotId", "mountType", "contacts", "normals", "constraints"
    ])) return null;
    const contacts = canonicalPair(value.contacts, canonicalPoint);
    const normals = canonicalPair(value.normals, canonicalNormal);
    const constraints = canonicalConstraints(value.constraints);
    if (!contacts || !normals || !constraints || sameCanonicalValue(
      contacts[0], contacts[1]
    )) return null;
    return {
      id: value.id,
      slotId: value.slotId,
      mountType: "grip",
      contacts,
      normals,
      constraints
    };
  }

  if (value.mountType === "grid") {
    if (!hasExactKeys(value, [
      "id", "slotId", "mountType", "origin", "cellSize", "columns", "rows",
      "plane", "acceptedEdgeTypes"
    ])) return null;
    const origin = canonicalPoint(value.origin);
    if (!isRecord(value.cellSize) || !hasExactKeys(value.cellSize, ["width", "height"]) ||
      !isFiniteNumber(value.cellSize.width) ||
      !isFiniteNumber(value.cellSize.height) ||
      !isSafeInteger(value.columns) ||
      !isSafeInteger(value.rows) ||
      (value.plane !== "floor" && value.plane !== "wall") ||
      !Array.isArray(value.acceptedEdgeTypes) ||
      !hasOwnDenseIndices(value.acceptedEdgeTypes) ||
      value.acceptedEdgeTypes.length > 32 ||
      !value.acceptedEdgeTypes.every(isProductKitId) ||
      !value.acceptedEdgeTypes.every((edge, index, edges) =>
        index === 0 || edges[index - 1]! < edge
      ) || !origin || value.cellSize.width <= 0 || value.cellSize.width > 1 ||
      value.cellSize.height <= 0 || value.cellSize.height > 1 ||
      value.columns < 1 || value.columns > 64 || value.rows < 1 || value.rows > 64 ||
      (origin.x as number) + value.cellSize.width * value.columns > 1 ||
      (origin.y as number) + value.cellSize.height * value.rows > 1) return null;
    return {
      id: value.id,
      slotId: value.slotId,
      mountType: "grid",
      origin,
      cellSize: {
        width: value.cellSize.width,
        height: value.cellSize.height
      },
      columns: value.columns,
      rows: value.rows,
      plane: value.plane,
      acceptedEdgeTypes: [...value.acceptedEdgeTypes]
    };
  }

  return null;
}

function canonicalOptionalEdge(value: unknown): string | null | typeof INVALID_EDGE {
  if (value === undefined) return null;
  return isProductKitId(value) ? value : INVALID_EDGE;
}

function canonicalComponentFrame(value: unknown): CanonicalObject | null {
  if (!isRecord(value)) return null;

  if (value.mountType === "socket") {
    if (!hasExactKeys(value, ["mountType", "point", "normal", "referenceScale"])) {
      return null;
    }
    const point = canonicalPoint(value.point);
    const normal = canonicalNormal(value.normal);
    if (!point || !normal || !isFiniteNumber(value.referenceScale) ||
      value.referenceScale <= 0 || value.referenceScale > 2) return null;
    return {
      mountType: "socket",
      point,
      normal,
      referenceScale: value.referenceScale
    };
  }

  if (value.mountType === "grip") {
    if (!hasExactKeys(value, ["mountType", "contacts", "normals"])) return null;
    const contacts = canonicalPair(value.contacts, canonicalPoint);
    const normals = canonicalPair(value.normals, canonicalNormal);
    if (!contacts || !normals || sameCanonicalValue(contacts[0], contacts[1])) return null;
    return { mountType: "grip", contacts, normals };
  }

  if (value.mountType === "grid") {
    if (!hasExactKeys(value, ["mountType", "plane", "footprint", "edgeTypes"]) ||
      (value.plane !== "floor" && value.plane !== "wall") ||
      !isRecord(value.footprint) ||
      !hasExactKeys(value.footprint, ["columns", "rows"]) ||
      !isSafeInteger(value.footprint.columns) ||
      !isSafeInteger(value.footprint.rows) ||
      value.footprint.columns < 1 || value.footprint.columns > 64 ||
      value.footprint.rows < 1 || value.footprint.rows > 64 ||
      !isRecord(value.edgeTypes) || Reflect.ownKeys(value.edgeTypes).some((key) =>
        typeof key !== "string" || !["north", "east", "south", "west"].includes(key)
      )) return null;
    const north = canonicalOptionalEdge(value.edgeTypes.north);
    const east = canonicalOptionalEdge(value.edgeTypes.east);
    const south = canonicalOptionalEdge(value.edgeTypes.south);
    const west = canonicalOptionalEdge(value.edgeTypes.west);
    if (north === INVALID_EDGE || east === INVALID_EDGE ||
      south === INVALID_EDGE || west === INVALID_EDGE) return null;
    return {
      mountType: "grid",
      plane: value.plane,
      footprint: {
        columns: value.footprint.columns,
        rows: value.footprint.rows
      },
      edgeTypes: { north, east, south, west }
    };
  }

  return null;
}

function canonicalFragment(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, ["layer", "raster"]) ||
    (value.layer !== "rear" && value.layer !== "front" && value.layer !== "overlay")) {
    return null;
  }
  const raster = canonicalRaster(value.raster);
  return raster ? { layer: value.layer, raster } : null;
}

function canonicalFragments(value: unknown): readonly CanonicalObject[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 3 ||
    !hasOwnDenseIndices(value)) return null;
  const fragments: CanonicalObject[] = [];
  for (const fragment of value) {
    const canonical = canonicalFragment(fragment);
    if (!canonical) return null;
    if (fragments.length > 0) {
      const order = { rear: 0, front: 1, overlay: 2 } as const;
      const previous = fragments.at(-1)!.layer as keyof typeof order;
      const current = canonical.layer as keyof typeof order;
      if (order[previous] >= order[current]) return null;
    }
    fragments.push(canonical);
  }
  return fragments;
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canonicalCertificationInputFromSnapshot(
  context: ProductKitCertificationContext,
  kit: ProductKitKit,
  frame: ProductKitMountFrame,
  component: ProductKitComponent
): string | null {
  if (!isRecord(context) || !hasExactKeys(context, [
    "packId", "connectorFormulaVersion"
  ]) || !isProductKitId(context.packId) ||
    !isWellFormedString(context.connectorFormulaVersion) ||
    !isRecord(kit) || !isProductKitId(kit.id) ||
    !isRecord(frame) || !isRecord(component) ||
    !isProductKitId(component.id) || !isProductKitId(component.slotId)) return null;

  if ((kit.mode !== "socket" && kit.mode !== "grip" && kit.mode !== "grid") ||
    frame.mountType !== kit.mode || !isRecord(component.componentFrame) ||
    component.componentFrame.mountType !== kit.mode || frame.slotId !== component.slotId) {
    return null;
  }

  const kitProfile = canonicalProfile(kit.compatibilityProfile);
  const componentProfile = canonicalProfile(component.compatibilityProfile);
  const base = canonicalRaster(kit.base);
  const mountFrame = canonicalMountFrame(frame);
  const componentFrame = canonicalComponentFrame(component.componentFrame);
  const fragments = canonicalFragments(component.fragments);
  if (!kitProfile || !componentProfile || !sameCanonicalValue(kitProfile, componentProfile) ||
    !base || !mountFrame || !componentFrame || !fragments ||
    !Array.isArray(kit.mountFrames) || kit.mountFrames.length === 0 ||
    !hasOwnDenseIndices(kit.mountFrames) ||
    kit.mountFrames.length > 32 || kit.mountFrames.some((candidate) =>
      canonicalMountFrame(candidate) === null
    )) return null;

  const selectedFrames = kit.mountFrames.filter((candidate) =>
    isRecord(candidate) && candidate.id === frame.id
  );
  if (selectedFrames.length !== 1) return null;
  const selectedFrame = canonicalMountFrame(selectedFrames[0]);
  if (!selectedFrame || !sameCanonicalValue(selectedFrame, mountFrame)) return null;

  return JSON.stringify({
    schema: CERTIFICATION_SCHEMA,
    version: CERTIFICATION_VERSION,
    packId: context.packId,
    connectorFormulaVersion: context.connectorFormulaVersion,
    kit: {
      id: kit.id,
      mode: kit.mode,
      compatibilityProfile: kitProfile,
      base,
      mountFrame
    },
    component: {
      id: component.id,
      slotId: component.slotId,
      compatibilityProfile: componentProfile,
      componentFrame,
      fragments
    }
  });
}

export function canonicalCertificationInput(
  context: ProductKitCertificationContext,
  kit: ProductKitKit,
  frame: ProductKitMountFrame,
  component: ProductKitComponent
): string | null {
  const snapshot = snapshotPlainData(
    [context, kit, frame, component] as const,
    { maxNodes: 10_000, maxArrayLength: 64 }
  );
  return snapshot === null
    ? null
    : canonicalCertificationInputFromSnapshot(...snapshot);
}

export function computeCertificationFingerprint(
  context: ProductKitCertificationContext,
  kit: ProductKitKit,
  frame: ProductKitMountFrame,
  component: ProductKitComponent
): string | null {
  const input = canonicalCertificationInput(context, kit, frame, component);
  return input === null ? null : sha256Utf8(input);
}

export function certificationFingerprintMatches(
  context: ProductKitCertificationContext,
  kit: ProductKitKit,
  frame: ProductKitMountFrame,
  component: ProductKitComponent,
  fingerprint: string
): boolean {
  if (typeof fingerprint !== "string" || !SHA256.test(fingerprint)) return false;
  const computed = computeCertificationFingerprint(context, kit, frame, component);
  if (computed === null) return false;

  let difference = 0;
  for (let index = 0; index < 64; index += 1) {
    difference |= computed.charCodeAt(index) ^ fingerprint.charCodeAt(index);
  }
  return difference === 0;
}


```

## FILE: web/src/product-kit/connector-transform.ts

```typescript
import { snapshotPlainData } from "./plain-data";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Vector {
  readonly x: number;
  readonly y: number;
}

export interface AffineTransform {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

export interface SocketFrame {
  readonly point: Point;
  readonly normal: Vector;
  readonly referenceScale: number;
}

export interface GripFrame {
  readonly contacts: readonly [Point, Point];
  readonly normals: readonly [Vector, Vector];
}

export interface TransformConstraints {
  readonly minScale: number;
  readonly maxScale: number;
  readonly minRotationDegrees: number;
  readonly maxRotationDegrees: number;
  readonly maxNormalErrorDegrees: number;
  readonly mirrorAllowed: boolean;
}

export interface ResolvedMountTransform {
  readonly matrix: AffineTransform;
  readonly scale: number;
  readonly rotationDegrees: number;
  readonly mirrored: boolean;
  readonly maxNormalErrorDegrees: number;
}

interface Candidate extends ResolvedMountTransform {
  readonly averageNormalErrorDegrees: number;
}

interface MagnitudeParts {
  readonly largestComponent: number;
  readonly scaledLength: number;
}

interface UnitRotation {
  readonly cosine: number;
  readonly sine: number;
  readonly radians: number;
  readonly degrees: number;
}

const CONTACT_TOLERANCE = 1e-8;
const RAD_TO_DEGREES = 180 / Math.PI;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[]
): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length && keys.every((key) =>
    typeof key === "string" && expected.includes(key)
  );
}

function hasOwnDenseIndices(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function isFiniteContractNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    !Object.is(value, -0);
}

const finitePoint = (value: unknown): value is Point =>
  isRecord(value) && hasExactKeys(value, ["x", "y"]) &&
  isFiniteContractNumber(value.x) && isFiniteContractNumber(value.y);

const finiteComputedPoint = (value: unknown): value is Point =>
  isRecord(value) && hasExactKeys(value, ["x", "y"]) &&
  typeof value.x === "number" && Number.isFinite(value.x) &&
  typeof value.y === "number" && Number.isFinite(value.y);

function spanBetween(first: Point, second: Point): Vector | null {
  const span = { x: second.x - first.x, y: second.y - first.y };
  return finiteComputedPoint(span) ? span : null;
}

function magnitudeParts(value: Vector): MagnitudeParts | null {
  const largestComponent = Math.max(Math.abs(value.x), Math.abs(value.y));
  if (largestComponent === 0) return null;
  return {
    largestComponent,
    scaledLength: Math.hypot(value.x / largestComponent, value.y / largestComponent)
  };
}

function magnitudeRatio(
  target: MagnitudeParts,
  source: MagnitudeParts
): number {
  if (target.scaledLength <= source.scaledLength) {
    return (target.largestComponent /
      (source.scaledLength / target.scaledLength)) / source.largestComponent;
  }
  return target.largestComponent /
    (source.largestComponent / (target.scaledLength / source.scaledLength));
}

function normalized(value: Vector): Vector | null {
  if (!finiteComputedPoint(value)) return null;
  const largestComponent = Math.max(Math.abs(value.x), Math.abs(value.y));
  if (largestComponent === 0) return null;
  const scaledX = value.x / largestComponent;
  const scaledY = value.y / largestComponent;
  const scaledLength = Math.hypot(scaledX, scaledY);
  return { x: scaledX / scaledLength, y: scaledY / scaledLength };
}

function validConstraints(value: unknown): value is TransformConstraints {
  if (!isRecord(value) || !hasExactKeys(value, [
    "minScale",
    "maxScale",
    "minRotationDegrees",
    "maxRotationDegrees",
    "maxNormalErrorDegrees",
    "mirrorAllowed"
  ])) return false;
  const constraints = value as unknown as TransformConstraints;
  return isFiniteContractNumber(constraints.minScale) && constraints.minScale > 0 &&
    isFiniteContractNumber(constraints.maxScale) &&
    constraints.maxScale >= constraints.minScale &&
    isFiniteContractNumber(constraints.minRotationDegrees) &&
    constraints.minRotationDegrees >= -180 &&
    isFiniteContractNumber(constraints.maxRotationDegrees) &&
    constraints.maxRotationDegrees <= 180 &&
    constraints.maxRotationDegrees >= constraints.minRotationDegrees &&
    isFiniteContractNumber(constraints.maxNormalErrorDegrees) &&
    constraints.maxNormalErrorDegrees >= 0 &&
    constraints.maxNormalErrorDegrees <= 180 &&
    typeof constraints.mirrorAllowed === "boolean";
}

function validSocketFrame(value: unknown): value is SocketFrame {
  return isRecord(value) && finitePoint(value.point) && finitePoint(value.normal) &&
    isFiniteContractNumber(value.referenceScale) && value.referenceScale > 0;
}

function validGripFrame(value: unknown): value is GripFrame {
  return isRecord(value) &&
    Array.isArray(value.contacts) && value.contacts.length === 2 &&
    hasOwnDenseIndices(value.contacts) &&
    value.contacts.every(finitePoint) &&
    Array.isArray(value.normals) && value.normals.length === 2 &&
    hasOwnDenseIndices(value.normals) &&
    value.normals.every(finitePoint);
}

function rotationBetween(source: Vector, target: Vector): UnitRotation | null {
  const cosine = source.x * target.x + source.y * target.y;
  const sine = source.x * target.y - source.y * target.x;
  const unit = normalized({ x: cosine, y: sine });
  if (!unit) return null;
  const radians = Math.atan2(unit.y, unit.x);
  const degrees = radians * RAD_TO_DEGREES;
  return {
    cosine: unit.x,
    sine: unit.y,
    radians: Object.is(radians, -0) ? 0 : radians,
    degrees: Object.is(degrees, -0) ? 0 : degrees
  };
}

function withinConstraints(
  scale: number,
  rotationDegrees: number,
  constraints: TransformConstraints
): boolean {
  return Number.isFinite(scale) && Number.isFinite(rotationDegrees) &&
    scale >= constraints.minScale && scale <= constraints.maxScale &&
    rotationDegrees >= constraints.minRotationDegrees &&
    rotationDegrees <= constraints.maxRotationDegrees;
}

const finiteMatrix = (matrix: AffineTransform): boolean =>
  Object.values(matrix).every(Number.isFinite);

function affineFor(
  sourcePoint: Point,
  targetPoint: Point,
  scale: number,
  rotation: UnitRotation,
  mirrored: boolean
): AffineTransform {
  const mirrorX = mirrored ? -1 : 1;
  const a = rotation.cosine * scale * mirrorX;
  const b = rotation.sine * scale * mirrorX;
  const c = -rotation.sine * scale;
  const d = rotation.cosine * scale;
  const withoutNegativeZero = (value: number): number =>
    Object.is(value, -0) ? 0 : value;
  return {
    a: withoutNegativeZero(a),
    b: withoutNegativeZero(b),
    c: withoutNegativeZero(c),
    d: withoutNegativeZero(d),
    e: withoutNegativeZero(targetPoint.x - (a * sourcePoint.x + c * sourcePoint.y)),
    f: withoutNegativeZero(targetPoint.y - (b * sourcePoint.x + d * sourcePoint.y))
  };
}

function transformedNormal(
  source: Vector,
  rotation: UnitRotation,
  mirrored: boolean
): Vector {
  const x = mirrored ? -source.x : source.x;
  return {
    x: rotation.cosine * x - rotation.sine * source.y,
    y: rotation.sine * x + rotation.cosine * source.y
  };
}

function angularErrorDegrees(left: Vector, right: Vector): number {
  const cross = left.x * right.y - left.y * right.x;
  const dot = left.x * right.x + left.y * right.y;
  return Math.atan2(Math.abs(cross), dot) * RAD_TO_DEGREES;
}

function contactResidualIsAcceptable(
  matrix: AffineTransform,
  source: Point,
  target: Point
): boolean {
  const transformed = applyTransform(matrix, source);
  if (!finiteComputedPoint(transformed)) return false;
  const residual = Math.hypot(transformed.x - target.x, transformed.y - target.y);
  return Number.isFinite(residual) && residual <= CONTACT_TOLERANCE;
}

export function applyTransform(matrix: AffineTransform, point: Point): Point {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f
  };
}

export function resolveSocketTransform(
  source: SocketFrame,
  target: SocketFrame,
  constraints: TransformConstraints
): ResolvedMountTransform | null {
  const safeSource = snapshotPlainData(source, { maxNodes: 256 });
  const safeTarget = snapshotPlainData(target, { maxNodes: 256 });
  const safeConstraints = snapshotPlainData(constraints, { maxNodes: 64 });
  if (!safeSource || !safeTarget || !safeConstraints ||
    !validConstraints(safeConstraints) || !validSocketFrame(safeSource) ||
    !validSocketFrame(safeTarget)) return null;
  const sourceNormal = normalized(safeSource.normal);
  const targetNormal = normalized(safeTarget.normal);
  if (!sourceNormal || !targetNormal) return null;

  const scale = safeTarget.referenceScale / safeSource.referenceScale;
  const rotation = rotationBetween(sourceNormal, targetNormal);
  if (!rotation || !withinConstraints(scale, rotation.degrees, safeConstraints)) return null;

  const matrix = affineFor(safeSource.point, safeTarget.point, scale, rotation, false);
  if (!finiteMatrix(matrix)) return null;
  const normalError = angularErrorDegrees(
    transformedNormal(sourceNormal, rotation, false),
    targetNormal
  );
  if (normalError > safeConstraints.maxNormalErrorDegrees ||
    !contactResidualIsAcceptable(matrix, safeSource.point, safeTarget.point)) return null;

  return {
    matrix,
    scale,
    rotationDegrees: rotation.degrees,
    mirrored: false,
    maxNormalErrorDegrees: normalError
  };
}

function gripCandidate(
  source: GripFrame,
  target: GripFrame,
  sourceNormals: readonly [Vector, Vector],
  targetNormals: readonly [Vector, Vector],
  scale: number,
  constraints: TransformConstraints,
  mirrored: boolean
): Candidate | null {
  const sourceSpan = {
    x: source.contacts[1].x - source.contacts[0].x,
    y: source.contacts[1].y - source.contacts[0].y
  };
  const targetSpan = {
    x: target.contacts[1].x - target.contacts[0].x,
    y: target.contacts[1].y - target.contacts[0].y
  };
  const reflectedSourceSpan = {
    x: mirrored ? -sourceSpan.x : sourceSpan.x,
    y: sourceSpan.y
  };
  const sourceDirection = normalized(reflectedSourceSpan);
  const targetDirection = normalized(targetSpan);
  if (!sourceDirection || !targetDirection) return null;
  const rotation = rotationBetween(sourceDirection, targetDirection);
  if (!rotation || !withinConstraints(scale, rotation.degrees, constraints)) return null;

  const matrix = affineFor(
    source.contacts[0],
    target.contacts[0],
    scale,
    rotation,
    mirrored
  );
  if (!finiteMatrix(matrix) ||
    !contactResidualIsAcceptable(matrix, source.contacts[0], target.contacts[0]) ||
    !contactResidualIsAcceptable(matrix, source.contacts[1], target.contacts[1])) return null;

  const errors = sourceNormals.map((normal, index) => angularErrorDegrees(
    transformedNormal(normal, rotation, mirrored),
    targetNormals[index]!
  ));
  const maxNormalErrorDegrees = Math.max(...errors);
  if (maxNormalErrorDegrees > constraints.maxNormalErrorDegrees) return null;

  return {
    matrix,
    scale,
    rotationDegrees: rotation.degrees,
    mirrored,
    maxNormalErrorDegrees,
    averageNormalErrorDegrees: (errors[0]! + errors[1]!) / 2
  };
}

export function resolveGripTransform(
  source: GripFrame,
  target: GripFrame,
  constraints: TransformConstraints
): ResolvedMountTransform | null {
  const safeSource = snapshotPlainData(source, { maxNodes: 256 });
  const safeTarget = snapshotPlainData(target, { maxNodes: 256 });
  const safeConstraints = snapshotPlainData(constraints, { maxNodes: 64 });
  if (!safeSource || !safeTarget || !safeConstraints ||
    !validConstraints(safeConstraints) || !validGripFrame(safeSource) ||
    !validGripFrame(safeTarget)) return null;

  const sourceNormals = safeSource.normals.map(normalized);
  const targetNormals = safeTarget.normals.map(normalized);
  if (sourceNormals.some((value) => value === null) ||
    targetNormals.some((value) => value === null)) return null;

  const sourceSpan = spanBetween(safeSource.contacts[0], safeSource.contacts[1]);
  const targetSpan = spanBetween(safeTarget.contacts[0], safeTarget.contacts[1]);
  if (!sourceSpan || !targetSpan) return null;
  const sourceMagnitude = magnitudeParts(sourceSpan);
  const targetMagnitude = magnitudeParts(targetSpan);
  if (!sourceMagnitude || !targetMagnitude) return null;
  const scale = magnitudeRatio(targetMagnitude, sourceMagnitude);
  const normalizedSource = sourceNormals as unknown as readonly [Vector, Vector];
  const normalizedTarget = targetNormals as unknown as readonly [Vector, Vector];
  const candidates = [
    gripCandidate(
      safeSource,
      safeTarget,
      normalizedSource,
      normalizedTarget,
      scale,
      safeConstraints,
      false
    ),
    safeConstraints.mirrorAllowed
      ? gripCandidate(
        safeSource,
        safeTarget,
        normalizedSource,
        normalizedTarget,
        scale,
        safeConstraints,
        true
      )
      : null
  ].filter((candidate): candidate is Candidate => candidate !== null);

  candidates.sort((left, right) =>
    left.maxNormalErrorDegrees - right.maxNormalErrorDegrees ||
    left.averageNormalErrorDegrees - right.averageNormalErrorDegrees ||
    Number(left.mirrored) - Number(right.mirrored)
  );
  const best = candidates[0];
  if (!best) return null;
  const { averageNormalErrorDegrees: _average, ...resolved } = best;
  return resolved;
}


```

## FILE: web/src/product-kit/grid-placement.ts

```typescript
import type {
  ProductKitComponent,
  ProductKitMountFrame,
  ProductKitPoint
} from "./product-kit-catalogue";
import { snapshotPlainData } from "./plain-data";

const MAX_GRID_AXIS = 64;
const MAX_EDGE_TYPES = 32;
const MAX_EDGE_TYPE_LENGTH = 80;
const EDGE_DIRECTIONS = ["north", "east", "south", "west"] as const;

type GridMountFrame = Extract<ProductKitMountFrame, { readonly mountType: "grid" }>;
type GridComponentFrame = Extract<
  ProductKitComponent["componentFrame"],
  { readonly mountType: "grid" }
>;
type GridComponent = ProductKitComponent & {
  readonly componentFrame: GridComponentFrame;
};

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwnDenseIndices(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function isUnitNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    !Object.is(value, -0) &&
    value >= 0 && value <= 1;
}

function isGridAxis(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0) &&
    value >= 1 && value <= MAX_GRID_AXIS;
}

function isGridMountFrame(value: unknown): value is GridMountFrame {
  if (!isRecord(value) || value.mountType !== "grid" ||
    !isRecord(value.origin) || !isRecord(value.cellSize) ||
    !isUnitNumber(value.origin.x) || !isUnitNumber(value.origin.y) ||
    !isUnitNumber(value.cellSize.width) || value.cellSize.width === 0 ||
    !isUnitNumber(value.cellSize.height) || value.cellSize.height === 0 ||
    !isGridAxis(value.columns) || !isGridAxis(value.rows) ||
    (value.plane !== "floor" && value.plane !== "wall")) return false;

  return value.origin.x + value.cellSize.width * value.columns <= 1 &&
    value.origin.y + value.cellSize.height * value.rows <= 1;
}

function isGridComponent(value: unknown): value is GridComponent {
  if (!isRecord(value) || !isRecord(value.componentFrame) ||
    value.componentFrame.mountType !== "grid" ||
    !isRecord(value.componentFrame.footprint)) return false;
  return (value.componentFrame.plane === "floor" ||
      value.componentFrame.plane === "wall") &&
    isGridAxis(value.componentFrame.footprint.columns) &&
    isGridAxis(value.componentFrame.footprint.rows);
}

function isNormalizedPoint(value: unknown): value is ProductKitPoint {
  return isRecord(value) && isUnitNumber(value.x) && isUnitNumber(value.y);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0) && value >= 0;
}

function snapCoordinateTowardPositiveTie(
  coordinate: number,
  origin: number,
  cellSize: number
): number {
  const lower = Math.floor((coordinate - origin) / cellSize);
  const midpoint = origin + cellSize * (lower + 0.5);
  return coordinate < midpoint ? lower : lower + 1;
}

function hasValidPlacementGeometry(
  value: unknown,
  frame: GridMountFrame
): value is ProductKitGridTile {
  if (!isRecord(value) || typeof value.placementId !== "string" ||
    value.placementId.length === 0 || typeof value.componentId !== "string" ||
    value.componentId.length === 0 || !isNonNegativeSafeInteger(value.column) ||
    !isNonNegativeSafeInteger(value.row) || !isRecord(value.footprint) ||
    !isGridAxis(value.footprint.columns) || !isGridAxis(value.footprint.rows) ||
    !isRecord(value.edgeTypes) || !Object.keys(value.edgeTypes).every((key) =>
      (EDGE_DIRECTIONS as readonly string[]).includes(key)
    )) return false;
  return value.column + value.footprint.columns <= frame.columns &&
    value.row + value.footprint.rows <= frame.rows;
}

function acceptedEdgeTypesAreCanonical(value: unknown): value is readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_EDGE_TYPES ||
    !hasOwnDenseIndices(value)) return false;
  return value.every((edgeType, index) =>
    typeof edgeType === "string" && edgeType.length > 0 &&
    edgeType.length <= MAX_EDGE_TYPE_LENGTH &&
    (index === 0 || value[index - 1] < edgeType)
  );
}

function placementEdgesAreAccepted(
  placement: ProductKitGridTile,
  acceptedEdgeTypes: ReadonlySet<string>
): boolean {
  return EDGE_DIRECTIONS.every((direction) => {
    const edgeType = placement.edgeTypes[direction];
    return edgeType === undefined ||
      (typeof edgeType === "string" && acceptedEdgeTypes.has(edgeType));
  });
}

function intervalsOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number
): boolean {
  return Math.max(firstStart, secondStart) < Math.min(firstEnd, secondEnd);
}

function touchingEdgesAreCompatible(
  first: ProductKitGridTile,
  second: ProductKitGridTile
): boolean {
  const firstRight = first.column + first.footprint.columns;
  const secondRight = second.column + second.footprint.columns;
  const firstBottom = first.row + first.footprint.rows;
  const secondBottom = second.row + second.footprint.rows;

  if (firstRight === second.column && intervalsOverlap(
    first.row, firstBottom, second.row, secondBottom
  )) return first.edgeTypes.east === second.edgeTypes.west;
  if (secondRight === first.column && intervalsOverlap(
    first.row, firstBottom, second.row, secondBottom
  )) return second.edgeTypes.east === first.edgeTypes.west;
  if (firstBottom === second.row && intervalsOverlap(
    first.column, firstRight, second.column, secondRight
  )) return first.edgeTypes.south === second.edgeTypes.north;
  if (secondBottom === first.row && intervalsOverlap(
    first.column, firstRight, second.column, secondRight
  )) return second.edgeTypes.south === first.edgeTypes.north;
  return true;
}

function detachAndFreezePlacement(
  placement: ProductKitGridTile
): ProductKitGridTile {
  const footprint = Object.freeze({
    columns: placement.footprint.columns,
    rows: placement.footprint.rows
  });
  const edgeTypes = Object.freeze({
    ...(placement.edgeTypes.north === undefined
      ? {}
      : { north: placement.edgeTypes.north }),
    ...(placement.edgeTypes.east === undefined
      ? {}
      : { east: placement.edgeTypes.east }),
    ...(placement.edgeTypes.south === undefined
      ? {}
      : { south: placement.edgeTypes.south }),
    ...(placement.edgeTypes.west === undefined
      ? {}
      : { west: placement.edgeTypes.west })
  });
  return Object.freeze({
    placementId: placement.placementId,
    componentId: placement.componentId,
    column: placement.column,
    row: placement.row,
    footprint,
    edgeTypes
  });
}

export interface ProductKitGridCell {
  readonly column: number;
  readonly row: number;
}

export interface ProductKitGridTile {
  readonly placementId: string;
  readonly componentId: string;
  readonly column: number;
  readonly row: number;
  readonly footprint: {
    readonly columns: number;
    readonly rows: number;
  };
  readonly edgeTypes: {
    readonly north?: string;
    readonly east?: string;
    readonly south?: string;
    readonly west?: string;
  };
}

export interface ProductKitGridOccupancy {
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly (string | null)[];
  readonly placements: readonly ProductKitGridTile[];
}

function snapProductKitGridCellFromSnapshot(
  frame: ProductKitMountFrame,
  component: ProductKitComponent,
  desiredTopLeft: ProductKitPoint
): ProductKitGridCell | null {
  if (!isGridMountFrame(frame) || !isGridComponent(component) ||
    !isNormalizedPoint(desiredTopLeft) ||
    frame.plane !== component.componentFrame.plane) return null;

  const right = frame.origin.x + frame.cellSize.width * frame.columns;
  const bottom = frame.origin.y + frame.cellSize.height * frame.rows;
  if (desiredTopLeft.x < frame.origin.x || desiredTopLeft.x >= right ||
    desiredTopLeft.y < frame.origin.y || desiredTopLeft.y >= bottom) return null;

  const column = snapCoordinateTowardPositiveTie(
    desiredTopLeft.x,
    frame.origin.x,
    frame.cellSize.width
  );
  const row = snapCoordinateTowardPositiveTie(
    desiredTopLeft.y,
    frame.origin.y,
    frame.cellSize.height
  );
  if (!Number.isSafeInteger(column) || !Number.isSafeInteger(row) ||
    column < 0 || row < 0 ||
    column + component.componentFrame.footprint.columns > frame.columns ||
    row + component.componentFrame.footprint.rows > frame.rows) return null;
  return Object.freeze({ column, row });
}

export function snapProductKitGridCell(
  frame: ProductKitMountFrame,
  component: ProductKitComponent,
  desiredTopLeft: ProductKitPoint
): ProductKitGridCell | null {
  const snapshot = snapshotPlainData(
    [frame, component, desiredTopLeft] as const,
    { maxNodes: 10_000, maxArrayLength: 64 }
  );
  return snapshot === null
    ? null
    : snapProductKitGridCellFromSnapshot(...snapshot);
}

function createProductKitGridOccupancyFromSnapshot(
  frame: ProductKitMountFrame,
  placements: readonly ProductKitGridTile[]
): ProductKitGridOccupancy | null {
  if (!isGridMountFrame(frame) || !Array.isArray(placements) ||
    !hasOwnDenseIndices(placements) ||
    placements.length > frame.columns * frame.rows ||
    !acceptedEdgeTypesAreCanonical(frame.acceptedEdgeTypes)) return null;
  const acceptedEdgeTypes = new Set(frame.acceptedEdgeTypes);
  const placementIds = new Set<string>();
  for (const placement of placements) {
    if (!hasValidPlacementGeometry(placement, frame) ||
      placementIds.has(placement.placementId) ||
      !placementEdgesAreAccepted(placement, acceptedEdgeTypes)) return null;
    placementIds.add(placement.placementId);
  }
  const ordered = placements.map(detachAndFreezePlacement).sort((left, right) =>
    left.row - right.row || left.column - right.column ||
    (left.placementId < right.placementId
      ? -1
      : left.placementId > right.placementId ? 1 : 0)
  );
  const cells = new Array<string | null>(frame.columns * frame.rows).fill(null);
  for (const placement of ordered) {
    for (let row = placement.row;
      row < placement.row + placement.footprint.rows;
      row += 1) {
      for (let column = placement.column;
        column < placement.column + placement.footprint.columns;
        column += 1) {
        const index = row * frame.columns + column;
        if (cells[index] !== null) return null;
        cells[index] = placement.placementId;
      }
    }
  }
  for (let firstIndex = 0; firstIndex < ordered.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1;
      secondIndex < ordered.length;
      secondIndex += 1) {
      if (!touchingEdgesAreCompatible(
        ordered[firstIndex]!,
        ordered[secondIndex]!
      )) return null;
    }
  }
  const frozenCells = Object.freeze(cells);
  const frozenPlacements = Object.freeze(ordered);
  return Object.freeze({
    columns: frame.columns,
    rows: frame.rows,
    cells: frozenCells,
    placements: frozenPlacements
  });
}

export function createProductKitGridOccupancy(
  frame: ProductKitMountFrame,
  placements: readonly ProductKitGridTile[]
): ProductKitGridOccupancy | null {
  const snapshot = snapshotPlainData(
    [frame, placements] as const,
    { maxNodes: 100_000, maxArrayLength: 4096 }
  );
  return snapshot === null
    ? null
    : createProductKitGridOccupancyFromSnapshot(...snapshot);
}


```

## FILE: web/src/product-kit/layer-plan.ts

```typescript
import type { ResolvedMountTransform } from "./connector-transform";
import type {
  ProductKitAssetReference,
  ProductKitComponent,
  ProductKitKit
} from "./product-kit-catalogue";
import { snapshotPlainData } from "./plain-data";

export const PRODUCT_KIT_LAYER_ORDER = Object.freeze([
  "rear",
  "body",
  "front",
  "artwork",
  "overlay"
] as const);

export type ProductKitRenderLayer = typeof PRODUCT_KIT_LAYER_ORDER[number];

export interface ProductKitAffinePlacement {
  readonly kind: "affine";
  readonly placementId: string;
  readonly mountFrameId: string;
  readonly component: ProductKitComponent;
  readonly transform: ResolvedMountTransform;
}

export interface ProductKitGridPlacement {
  readonly kind: "grid";
  readonly placementId: string;
  readonly mountFrameId: string;
  readonly component: ProductKitComponent;
  readonly column: number;
  readonly row: number;
  readonly normalizedBounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export type ProductKitResolvedPlacement =
  | ProductKitAffinePlacement
  | ProductKitGridPlacement;

export interface ProductKitBaseRasterEntry {
  readonly kind: "base-raster";
  readonly itemId: string;
  readonly raster: ProductKitAssetReference;
}

export interface ProductKitComponentRasterEntry {
  readonly kind: "component-raster";
  readonly itemId: string;
  readonly placementId: string;
  readonly mountFrameId: string;
  readonly componentId: string;
  readonly raster: ProductKitAssetReference;
  readonly geometry:
    | { readonly kind: "affine"; readonly transform: ResolvedMountTransform }
    | {
      readonly kind: "grid";
      readonly column: number;
      readonly row: number;
      readonly normalizedBounds: {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
      };
    };
}

export interface ProductKitArtworkSlotEntry {
  readonly kind: "artwork-slot";
  readonly itemId: string;
  readonly index: number;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export type ProductKitLayerEntry =
  | ProductKitBaseRasterEntry
  | ProductKitComponentRasterEntry
  | ProductKitArtworkSlotEntry;

export interface ProductKitLayerBucket {
  readonly layer: ProductKitRenderLayer;
  readonly entries: readonly ProductKitLayerEntry[];
}

export type ProductKitPricedItem =
  | {
    readonly kind: "base";
    readonly itemId: string;
    readonly priceAssetId: string;
  }
  | {
    readonly kind: "component";
    readonly itemId: string;
    readonly placementId: string;
    readonly componentId: string;
    readonly priceAssetId: string;
  };

export interface ProductKitLayerPlan {
  readonly kitId: string;
  readonly layers: readonly ProductKitLayerBucket[];
  readonly pricedItems: readonly ProductKitPricedItem[];
}

const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const SHA256 = /^[0-9a-f]{64}(?![\s\S])/;
const FRAGMENT_LAYER_INDEX = { rear: 0, front: 1, overlay: 2 } as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwnDenseIndices(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function isFiniteContractNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    !Object.is(value, -0);
}

function isSafeContractInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0);
}

function isRaster(value: unknown): value is ProductKitAssetReference {
  if (!isRecord(value) || typeof value.assetId !== "string" ||
    !PORTABLE_ID.test(value.assetId) || typeof value.masterSha256 !== "string" ||
    !SHA256.test(value.masterSha256) || !isRecord(value.frame)) return false;
  const frame = value.frame;
  const dimensions = [
    frame.originalWidth,
    frame.originalHeight,
    frame.trimX,
    frame.trimY,
    frame.trimWidth,
    frame.trimHeight
  ];
  return dimensions.every(isSafeContractInteger) &&
    (frame.originalWidth as number) >= 1 && (frame.originalWidth as number) <= 8192 &&
    (frame.originalHeight as number) >= 1 && (frame.originalHeight as number) <= 8192 &&
    (frame.trimX as number) >= 0 && (frame.trimY as number) >= 0 &&
    (frame.trimWidth as number) >= 1 && (frame.trimHeight as number) >= 1 &&
    (frame.trimX as number) + (frame.trimWidth as number) <=
      (frame.originalWidth as number) &&
    (frame.trimY as number) + (frame.trimHeight as number) <=
      (frame.originalHeight as number);
}

function isArtworkBounds(value: unknown): value is ProductKitKit["artworkBounds"][number] {
  if (!isRecord(value)) return false;
  const numbers = [value.x, value.y, value.width, value.height];
  return numbers.every(isFiniteContractNumber) &&
    (value.x as number) >= 0 && (value.y as number) >= 0 &&
    (value.width as number) > 0 && (value.height as number) > 0 &&
    (value.x as number) + (value.width as number) <= 1 &&
    (value.y as number) + (value.height as number) <= 1;
}

function cloneRaster(raster: ProductKitAssetReference): ProductKitAssetReference {
  return {
    assetId: raster.assetId,
    masterSha256: raster.masterSha256,
    frame: { ...raster.frame }
  };
}

function cloneTransform(transform: ResolvedMountTransform): ResolvedMountTransform {
  return {
    matrix: { ...transform.matrix },
    scale: transform.scale,
    rotationDegrees: transform.rotationDegrees,
    mirrored: transform.mirrored,
    maxNormalErrorDegrees: transform.maxNormalErrorDegrees
  };
}

function finiteTransform(value: unknown): value is ResolvedMountTransform {
  if (!isRecord(value) || !isRecord(value.matrix)) return false;
  const transform = value as unknown as ResolvedMountTransform;
  const values = [
    transform.matrix.a,
    transform.matrix.b,
    transform.matrix.c,
    transform.matrix.d,
    transform.matrix.e,
    transform.matrix.f,
    transform.scale,
    transform.rotationDegrees,
    transform.maxNormalErrorDegrees
  ];
  return values.every(isFiniteContractNumber) && transform.scale > 0 &&
    transform.rotationDegrees >= -180 && transform.rotationDegrees <= 180 &&
    transform.maxNormalErrorDegrees >= 0 && transform.maxNormalErrorDegrees <= 180 &&
    typeof transform.mirrored === "boolean";
}

function finiteGridPlacement(placement: ProductKitGridPlacement): boolean {
  const { normalizedBounds } = placement;
  return isRecord(normalizedBounds) &&
    isSafeContractInteger(placement.column) && placement.column >= 0 &&
    isSafeContractInteger(placement.row) && placement.row >= 0 &&
    [
      normalizedBounds.x,
      normalizedBounds.y,
      normalizedBounds.width,
      normalizedBounds.height
    ].every(isFiniteContractNumber) &&
    normalizedBounds.x >= 0 && normalizedBounds.y >= 0 &&
    normalizedBounds.width > 0 && normalizedBounds.height > 0 &&
    normalizedBounds.x + normalizedBounds.width <= 1 &&
    normalizedBounds.y + normalizedBounds.height <= 1;
}

function placementIsValid(
  kit: ProductKitKit,
  value: unknown
): value is ProductKitResolvedPlacement {
  if (!isRecord(value) || typeof value.placementId !== "string" ||
    typeof value.mountFrameId !== "string" || !isRecord(value.component)) return false;
  const placement = value as unknown as ProductKitResolvedPlacement;
  if (!PORTABLE_ID.test(placement.placementId) || placement.placementId.length > 80 ||
    !PORTABLE_ID.test(placement.mountFrameId) || placement.mountFrameId.length > 80 ||
    !isRecord(placement.component.componentFrame) ||
    !Array.isArray(placement.component.fragments) ||
    !hasOwnDenseIndices(placement.component.fragments) ||
    placement.component.fragments.length === 0 ||
    typeof placement.component.id !== "string" ||
    typeof placement.component.priceAssetId !== "string" ||
    !PORTABLE_ID.test(placement.component.id) ||
    !PORTABLE_ID.test(placement.component.priceAssetId) ||
    !placement.component.fragments.every((fragment, index, fragments) =>
      isRecord(fragment) &&
      (fragment.layer === "rear" || fragment.layer === "front" ||
        fragment.layer === "overlay") && isRaster(fragment.raster) &&
      (index === 0 || FRAGMENT_LAYER_INDEX[
        fragments[index - 1]!.layer as keyof typeof FRAGMENT_LAYER_INDEX
      ] < FRAGMENT_LAYER_INDEX[fragment.layer])
    )) {
    return false;
  }
  if (placement.kind === "affine") {
    return (kit.mode === "socket" || kit.mode === "grip") &&
      placement.component.componentFrame.mountType === kit.mode &&
      finiteTransform(placement.transform);
  }
  if (placement.kind !== "grid") return false;
  return kit.mode === "grid" && placement.component.componentFrame.mountType === "grid" &&
    finiteGridPlacement(placement);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function comparePlacements(
  left: ProductKitResolvedPlacement,
  right: ProductKitResolvedPlacement
): number {
  if (left.kind === "grid" && right.kind === "grid") {
    return left.row - right.row || left.column - right.column ||
      compareCodeUnits(left.placementId, right.placementId);
  }
  if (left.kind !== right.kind) return compareCodeUnits(left.kind, right.kind);
  return compareCodeUnits(left.mountFrameId, right.mountFrameId) ||
    compareCodeUnits(left.placementId, right.placementId);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function createProductKitLayerPlanFromSnapshot(
  kit: ProductKitKit,
  placements: readonly ProductKitResolvedPlacement[]
): ProductKitLayerPlan | null {
  if (!isRecord(kit) || !Array.isArray(placements) ||
    !hasOwnDenseIndices(placements) ||
    typeof kit.id !== "string" || typeof kit.priceAssetId !== "string" ||
    !PORTABLE_ID.test(kit.id) || !PORTABLE_ID.test(kit.priceAssetId) ||
    !isRaster(kit.base) || !Array.isArray(kit.artworkBounds) ||
    !hasOwnDenseIndices(kit.artworkBounds) ||
    !kit.artworkBounds.every(isArtworkBounds) ||
    (kit.mode !== "whole" && kit.mode !== "socket" &&
      kit.mode !== "grip" && kit.mode !== "grid")) return null;
  if (kit.mode === "whole" && placements.length > 0) return null;
  if (!placements.every((placement) => placementIsValid(kit, placement))) return null;

  const placementIds = new Set<string>();
  for (const placement of placements) {
    if (placementIds.has(placement.placementId)) return null;
    placementIds.add(placement.placementId);
  }

  const sortedPlacements = [...placements].sort(comparePlacements);
  const entries = new Map<ProductKitRenderLayer, ProductKitLayerEntry[]>(
    PRODUCT_KIT_LAYER_ORDER.map((layer) => [layer, []])
  );
  const baseItemId = `base:${kit.id}`;
  entries.get("body")!.push({
    kind: "base-raster",
    itemId: baseItemId,
    raster: cloneRaster(kit.base)
  });
  kit.artworkBounds.forEach((bounds, index) => {
    entries.get("artwork")!.push({
      kind: "artwork-slot",
      itemId: `artwork:${kit.id}:${index}`,
      index,
      bounds: { ...bounds }
    });
  });

  const pricedItems: ProductKitPricedItem[] = [{
    kind: "base",
    itemId: baseItemId,
    priceAssetId: kit.priceAssetId
  }];
  for (const placement of sortedPlacements) {
    const geometry: ProductKitComponentRasterEntry["geometry"] = placement.kind === "affine"
      ? { kind: "affine", transform: cloneTransform(placement.transform) }
      : {
        kind: "grid",
        column: placement.column,
        row: placement.row,
        normalizedBounds: { ...placement.normalizedBounds }
      };
    for (const fragment of placement.component.fragments) {
      entries.get(fragment.layer)!.push({
        kind: "component-raster",
        itemId: `fragment:${placement.placementId}:${fragment.layer}`,
        placementId: placement.placementId,
        mountFrameId: placement.mountFrameId,
        componentId: placement.component.id,
        raster: cloneRaster(fragment.raster),
        geometry
      });
    }
    pricedItems.push({
      kind: "component",
      itemId: `placement:${placement.placementId}`,
      placementId: placement.placementId,
      componentId: placement.component.id,
      priceAssetId: placement.component.priceAssetId
    });
  }

  return deepFreeze({
    kitId: kit.id,
    layers: PRODUCT_KIT_LAYER_ORDER.map((layer) => ({
      layer,
      entries: entries.get(layer)!
    })),
    pricedItems
  });
}

export function createProductKitLayerPlan(
  kit: ProductKitKit,
  placements: readonly ProductKitResolvedPlacement[]
): ProductKitLayerPlan | null {
  const snapshot = snapshotPlainData(
    [kit, placements] as const,
    { maxNodes: 4_000_000, maxArrayLength: 131_072 }
  );
  return snapshot === null
    ? null
    : createProductKitLayerPlanFromSnapshot(...snapshot);
}


```

## FILE: web/src/product-kit/plain-data.ts

```typescript
export interface PlainDataSnapshotLimits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxArrayLength: number;
  readonly maxObjectProperties: number;
  readonly maxStringLength: number;
}

const DEFAULT_LIMITS: PlainDataSnapshotLimits = Object.freeze({
  maxDepth: 64,
  maxNodes: 1_000_000,
  maxArrayLength: 131_072,
  maxObjectProperties: 128,
  maxStringLength: 1_000_000
});

const FAILURE = Symbol("plain-data-snapshot-failure");

const arrayIsArray = Array.isArray;
const defineProperty = Object.defineProperty;
const freeze = Object.freeze;
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
const getPrototypeOf = Object.getPrototypeOf;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const reflectApply = Reflect.apply;
const reflectOwnKeys = Reflect.ownKeys;

interface SnapshotState {
  readonly limits: PlainDataSnapshotLimits;
  readonly active: WeakSet<object>;
  readonly clones: WeakMap<object, object>;
  nodes: number;
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return reflectApply(hasOwnProperty, value, [key]) as boolean;
}

function validLimit(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function resolveLimits(
  overrides: Partial<PlainDataSnapshotLimits> | undefined
): PlainDataSnapshotLimits | null {
  if (overrides === undefined) return DEFAULT_LIMITS;
  try {
    if (overrides === null || typeof overrides !== "object" ||
      arrayIsArray(overrides) || getPrototypeOf(overrides) !== Object.prototype) {
      return null;
    }
    const descriptors = getOwnPropertyDescriptors(overrides);
    const keys = reflectOwnKeys(descriptors);
    if (keys.length > 5) return null;
    const limits = {
      maxDepth: DEFAULT_LIMITS.maxDepth,
      maxNodes: DEFAULT_LIMITS.maxNodes,
      maxArrayLength: DEFAULT_LIMITS.maxArrayLength,
      maxObjectProperties: DEFAULT_LIMITS.maxObjectProperties,
      maxStringLength: DEFAULT_LIMITS.maxStringLength
    };
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (typeof key !== "string") return null;
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable ||
        !validLimit(descriptor.value)) return null;
      if (key === "maxDepth") limits.maxDepth = descriptor.value;
      else if (key === "maxNodes") limits.maxNodes = descriptor.value;
      else if (key === "maxArrayLength") limits.maxArrayLength = descriptor.value;
      else if (key === "maxObjectProperties") {
        limits.maxObjectProperties = descriptor.value;
      } else if (key === "maxStringLength") limits.maxStringLength = descriptor.value;
      else return null;
    }
    return limits;
  } catch {
    return null;
  }
}

function recordNode(state: SnapshotState): boolean {
  state.nodes += 1;
  return state.nodes <= state.limits.maxNodes;
}

function cloneArray(
  value: readonly unknown[],
  depth: number,
  state: SnapshotState
): readonly unknown[] | typeof FAILURE {
  if (getPrototypeOf(value) !== Array.prototype) return FAILURE;
  const lengthDescriptor = getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 ||
    lengthDescriptor.value > state.limits.maxArrayLength) return FAILURE;
  const length = lengthDescriptor.value as number;
  const descriptors = getOwnPropertyDescriptors(value);
  const keys = reflectOwnKeys(descriptors);
  if (keys.length !== length + 1 || !hasOwn(descriptors, "length")) return FAILURE;

  const clone: unknown[] = new Array(length);
  state.clones.set(value, clone);
  state.active.add(value);
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    if (!hasOwn(descriptors, key)) return FAILURE;
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return FAILURE;
    const nested = cloneValue(descriptor.value, depth + 1, state);
    if (nested === FAILURE) return FAILURE;
    defineProperty(clone, key, {
      value: nested,
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  state.active.delete(value);
  freeze(clone);
  return clone;
}

function cloneObject(
  value: Readonly<Record<PropertyKey, unknown>>,
  depth: number,
  state: SnapshotState
): Readonly<Record<string, unknown>> | typeof FAILURE {
  if (getPrototypeOf(value) !== Object.prototype) return FAILURE;
  const descriptors = getOwnPropertyDescriptors(value);
  const keys = reflectOwnKeys(descriptors);
  if (keys.length > state.limits.maxObjectProperties) return FAILURE;
  const clone: Record<string, unknown> = {};
  state.clones.set(value, clone);
  state.active.add(value);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (typeof key !== "string") return FAILURE;
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return FAILURE;
    const nested = cloneValue(descriptor.value, depth + 1, state);
    if (nested === FAILURE) return FAILURE;
    defineProperty(clone, key, {
      value: nested,
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  state.active.delete(value);
  freeze(clone);
  return clone;
}

function cloneValue(
  value: unknown,
  depth: number,
  state: SnapshotState
): unknown | typeof FAILURE {
  if (depth > state.limits.maxDepth || !recordNode(state)) return FAILURE;
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return value.length <= state.limits.maxStringLength ? value : FAILURE;
  }
  if (typeof value !== "object") return FAILURE;
  if (state.active.has(value)) return FAILURE;
  const existing = state.clones.get(value);
  if (existing) return existing;
  return arrayIsArray(value)
    ? cloneArray(value, depth, state)
    : cloneObject(value as Readonly<Record<PropertyKey, unknown>>, depth, state);
}

export function snapshotPlainData<T>(
  value: T,
  limits?: Partial<PlainDataSnapshotLimits>
): T | null {
  const resolvedLimits = resolveLimits(limits);
  if (!resolvedLimits) return null;
  try {
    const snapshot = cloneValue(value, 0, {
      limits: resolvedLimits,
      active: new WeakSet<object>(),
      clones: new WeakMap<object, object>(),
      nodes: 0
    });
    return snapshot === FAILURE ? null : snapshot as T;
  } catch {
    return null;
  }
}


```

## FILE: web/src/product-kit/product-kit-catalogue.ts

```typescript
import { z } from "zod";
import { resolveGripTransform, resolveSocketTransform } from "./connector-transform";
import { snapshotPlainData } from "./plain-data";

const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const SHA256 = /^[0-9a-f]{64}(?![\s\S])/;
const MAX_COLLECTION = 10_000;
const parsedProductKitCatalogues = new WeakSet<object>();
const COMPONENT_LAYER_ORDER = new Map([
  ["rear", 0],
  ["front", 1],
  ["overlay", 2]
] as const);

const rejectsSignedZero = (value: number): boolean => !Object.is(value, -0);
const finiteNumber = z.number().finite().refine(rejectsSignedZero);
const jsonInteger = z.number().int().refine(rejectsSignedZero);
const unitNumber = finiteNumber.min(0).max(1);
const portableId = z.string().min(1).max(80).regex(PORTABLE_ID);
const productKitId = portableId.refine((value) => value.startsWith("pk1-"));
const sha256 = z.string().regex(SHA256);

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return true;
      index += 1;
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      return true;
    }
  }
  return false;
}

const title = z.string().min(1).max(80).refine((value) =>
  value === value.trim() && !hasUnpairedSurrogate(value) &&
  ![...value].some((character) => character.charCodeAt(0) < 32)
);

const PointSchema = z.strictObject({ x: unitNumber, y: unitNumber });
const NormalSchema = z.strictObject({
  x: finiteNumber.min(-1).max(1),
  y: finiteNumber.min(-1).max(1)
}).refine(({ x, y }) => x !== 0 || y !== 0);

const BoundsSchema = z.strictObject({
  x: unitNumber,
  y: unitNumber,
  width: unitNumber.gt(0),
  height: unitNumber.gt(0)
}).refine(({ x, y, width, height }) => x + width <= 1 && y + height <= 1);

const RasterFrameSchema = z.strictObject({
  originalWidth: jsonInteger.min(1).max(8192),
  originalHeight: jsonInteger.min(1).max(8192),
  trimX: jsonInteger.min(0).max(8191),
  trimY: jsonInteger.min(0).max(8191),
  trimWidth: jsonInteger.min(1).max(8192),
  trimHeight: jsonInteger.min(1).max(8192)
}).refine(({ originalWidth, originalHeight, trimX, trimY, trimWidth, trimHeight }) =>
  trimX + trimWidth <= originalWidth && trimY + trimHeight <= originalHeight
);

const AssetReferenceSchema = z.strictObject({
  assetId: portableId,
  masterSha256: sha256,
  frame: RasterFrameSchema
});

const CompatibilityProfileSchema = z.strictObject({
  familyId: productKitId,
  perspectiveId: productKitId,
  geometryId: productKitId,
  styleId: productKitId
});

const TransformConstraintsSchema = z.strictObject({
  minScale: finiteNumber.gt(0).max(8),
  maxScale: finiteNumber.gt(0).max(8),
  minRotationDegrees: finiteNumber.min(-180).max(180),
  maxRotationDegrees: finiteNumber.min(-180).max(180),
  maxNormalErrorDegrees: finiteNumber.min(0).max(45),
  mirrorAllowed: z.boolean()
}).refine(({ minScale, maxScale, minRotationDegrees, maxRotationDegrees }) =>
  minScale <= maxScale && minRotationDegrees <= maxRotationDegrees
);

const MountIdentitySchema = {
  id: productKitId,
  slotId: productKitId
} as const;

const SocketMountFrameSchema = z.strictObject({
  ...MountIdentitySchema,
  mountType: z.literal("socket"),
  point: PointSchema,
  normal: NormalSchema,
  referenceScale: finiteNumber.gt(0).max(2),
  constraints: TransformConstraintsSchema
});

const GripMountFrameSchema = z.strictObject({
  ...MountIdentitySchema,
  mountType: z.literal("grip"),
  contacts: z.tuple([PointSchema, PointSchema]).refine(([first, second]) =>
    first.x !== second.x || first.y !== second.y
  ),
  normals: z.tuple([NormalSchema, NormalSchema]),
  constraints: TransformConstraintsSchema
});

const GridMountFrameSchema = z.strictObject({
  ...MountIdentitySchema,
  mountType: z.literal("grid"),
  origin: PointSchema,
  cellSize: z.strictObject({
    width: unitNumber.gt(0),
    height: unitNumber.gt(0)
  }),
  columns: jsonInteger.min(1).max(64),
  rows: jsonInteger.min(1).max(64),
  plane: z.enum(["floor", "wall"]),
  acceptedEdgeTypes: z.array(productKitId).max(32)
}).refine(({ origin, cellSize, columns, rows }) =>
  origin.x + cellSize.width * columns <= 1 &&
  origin.y + cellSize.height * rows <= 1
);

const MountFrameSchema = z.discriminatedUnion("mountType", [
  SocketMountFrameSchema,
  GripMountFrameSchema,
  GridMountFrameSchema
]);

const SocketComponentFrameSchema = z.strictObject({
  mountType: z.literal("socket"),
  point: PointSchema,
  normal: NormalSchema,
  referenceScale: finiteNumber.gt(0).max(2)
});

const GripComponentFrameSchema = z.strictObject({
  mountType: z.literal("grip"),
  contacts: z.tuple([PointSchema, PointSchema]).refine(([first, second]) =>
    first.x !== second.x || first.y !== second.y
  ),
  normals: z.tuple([NormalSchema, NormalSchema])
});

const GridComponentFrameSchema = z.strictObject({
  mountType: z.literal("grid"),
  plane: z.enum(["floor", "wall"]),
  footprint: z.strictObject({
    columns: jsonInteger.min(1).max(64),
    rows: jsonInteger.min(1).max(64)
  }),
  edgeTypes: z.strictObject({
    north: productKitId.optional(),
    east: productKitId.optional(),
    south: productKitId.optional(),
    west: productKitId.optional()
  })
});

const ComponentFrameSchema = z.discriminatedUnion("mountType", [
  SocketComponentFrameSchema,
  GripComponentFrameSchema,
  GridComponentFrameSchema
]);

const KitSchema = z.strictObject({
  id: productKitId,
  title,
  mode: z.enum(["whole", "socket", "grip", "grid"]),
  compatibilityProfile: CompatibilityProfileSchema,
  base: AssetReferenceSchema,
  priceAssetId: productKitId,
  mountFrames: z.array(MountFrameSchema).max(32),
  artworkBounds: z.array(BoundsSchema).max(8)
});

const FragmentSchema = z.strictObject({
  layer: z.enum(["rear", "front", "overlay"]),
  raster: AssetReferenceSchema
});

const ComponentSchema = z.strictObject({
  id: productKitId,
  title,
  slotId: productKitId,
  compatibilityProfile: CompatibilityProfileSchema,
  componentFrame: ComponentFrameSchema,
  fragments: z.array(FragmentSchema).min(1).max(3),
  priceAssetId: productKitId
});

const CertificationSchema = z.strictObject({
  id: productKitId,
  kitId: productKitId,
  mountFrameId: productKitId,
  componentId: productKitId,
  fingerprint: sha256
});

const CatalogueSchema = z.strictObject({
  schema: z.literal("product-kit@1"),
  version: z.literal(1),
  packId: productKitId,
  catalogPackId: portableId,
  catalogSha256: sha256,
  pricingVersion: z.literal("product-pricing@1"),
  connectorFormulaVersion: z.literal("product-kit-connectors@1"),
  kits: z.array(KitSchema).min(1).max(MAX_COLLECTION),
  components: z.array(ComponentSchema).max(MAX_COLLECTION),
  certifications: z.array(CertificationSchema).max(MAX_COLLECTION)
});

const AssetRecordSchema = z.strictObject({
  id: portableId,
  masterSha256: sha256,
  delivery: z.string(),
  kind: z.string(),
  files: z.strictObject({ master: z.string() }),
  dimensions: z.strictObject({
    width: jsonInteger.min(1).max(8192),
    height: jsonInteger.min(1).max(8192)
  }),
  classroomReviewed: z.boolean(),
  brandFree: z.boolean()
});

const ContextSchema = z.strictObject({
  catalogPackId: portableId,
  catalogSha256: sha256,
  records: z.array(AssetRecordSchema).max(20_000)
});

type ParsedCatalogue = z.infer<typeof CatalogueSchema>;
type ParsedContext = z.infer<typeof ContextSchema>;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly [unknown, ...unknown[]]
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ProductKitPoint = DeepReadonly<z.infer<typeof PointSchema>>;
export type ProductKitNormal = DeepReadonly<z.infer<typeof NormalSchema>>;
export type ProductKitRasterFrame = DeepReadonly<z.infer<typeof RasterFrameSchema>>;
export type ProductKitAssetReference = DeepReadonly<z.infer<typeof AssetReferenceSchema>>;
export type ProductKitCompatibilityProfile = DeepReadonly<z.infer<typeof CompatibilityProfileSchema>>;
export type ProductKitMountFrame = DeepReadonly<z.infer<typeof MountFrameSchema>>;
export type ProductKitComponentFrame = DeepReadonly<z.infer<typeof ComponentFrameSchema>>;
export type ProductKitKit = DeepReadonly<z.infer<typeof KitSchema>>;
export type ProductKitComponent = DeepReadonly<z.infer<typeof ComponentSchema>>;
export type ProductKitCertification = DeepReadonly<z.infer<typeof CertificationSchema>>;
export type ProductKitCatalogue = DeepReadonly<ParsedCatalogue>;

export interface ProductKitCatalogueAssetRecord {
  readonly id: string;
  readonly masterSha256: string;
  readonly delivery: string;
  readonly kind: string;
  readonly files: { readonly master: string };
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly classroomReviewed: boolean;
  readonly brandFree: boolean;
}

export interface ProductKitCatalogueContext {
  readonly catalogPackId: string;
  readonly catalogSha256: string;
  readonly records: readonly ProductKitCatalogueAssetRecord[];
}

function sortedUniqueById(values: readonly { readonly id: string }[]): boolean {
  return values.every((value, index) =>
    index === 0 || values[index - 1]!.id < value.id
  );
}

function sortedUniqueStrings(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]! < value);
}

function sameProfile(
  left: z.infer<typeof CompatibilityProfileSchema>,
  right: z.infer<typeof CompatibilityProfileSchema>
): boolean {
  return left.familyId === right.familyId &&
    left.perspectiveId === right.perspectiveId &&
    left.geometryId === right.geometryId &&
    left.styleId === right.styleId;
}

function rasterIsBound(
  raster: z.infer<typeof AssetReferenceSchema>,
  records: ReadonlyMap<string, z.infer<typeof AssetRecordSchema>>,
  packId: string
): boolean {
  const record = records.get(raster.assetId);
  if (!record || record.masterSha256 !== raster.masterSha256 ||
    record.delivery !== "offline" || !record.classroomReviewed || !record.brandFree ||
    !["component", "raster-master", "shell"].includes(record.kind) ||
    record.files.master !==
      `/catalog/generated/${packId}/assets/${record.id}/master.png`) return false;
  return record.dimensions.width === raster.frame.trimWidth &&
    record.dimensions.height === raster.frame.trimHeight;
}

function fragmentsAreCanonical(
  fragments: readonly z.infer<typeof FragmentSchema>[]
): boolean {
  return fragments.every((fragment, index) => {
    if (index === 0) return true;
    return COMPONENT_LAYER_ORDER.get(fragments[index - 1]!.layer)! <
      COMPONENT_LAYER_ORDER.get(fragment.layer)!;
  });
}

function certifiedGeometryIsValid(
  frame: z.infer<typeof MountFrameSchema>,
  componentFrame: z.infer<typeof ComponentFrameSchema>
): boolean {
  if (frame.mountType === "socket" && componentFrame.mountType === "socket") {
    return resolveSocketTransform(componentFrame, frame, frame.constraints) !== null;
  }
  if (frame.mountType === "grip" && componentFrame.mountType === "grip") {
    return resolveGripTransform(componentFrame, frame, frame.constraints) !== null;
  }
  if (frame.mountType === "grid" && componentFrame.mountType === "grid") {
    const accepted = new Set(frame.acceptedEdgeTypes);
    const edgeTypes = Object.values(componentFrame.edgeTypes).filter(
      (value): value is string => value !== undefined
    );
    return frame.plane === componentFrame.plane &&
      componentFrame.footprint.columns <= frame.columns &&
      componentFrame.footprint.rows <= frame.rows &&
      edgeTypes.every((edgeType) => accepted.has(edgeType));
  }
  return false;
}

function graphIsValid(catalogue: ParsedCatalogue, context: ParsedContext): boolean {
  if (catalogue.catalogPackId !== context.catalogPackId ||
    catalogue.catalogSha256 !== context.catalogSha256 ||
    !sortedUniqueById(catalogue.kits) ||
    !sortedUniqueById(catalogue.components) ||
    !sortedUniqueById(catalogue.certifications)) return false;

  const records = new Map(context.records.map((record) => [record.id, record]));
  if (records.size !== context.records.length) return false;
  const kits = new Map(catalogue.kits.map((kit) => [kit.id, kit]));
  const components = new Map(catalogue.components.map((component) => [component.id, component]));
  const allFrameIds = catalogue.kits.flatMap((kit) =>
    kit.mountFrames.map((frame) => frame.id)
  );
  if (new Set(allFrameIds).size !== allFrameIds.length) return false;

  for (const kit of catalogue.kits) {
    if (!rasterIsBound(kit.base, records, context.catalogPackId) ||
      !sortedUniqueById(kit.mountFrames)) return false;
    if (kit.mode === "whole") {
      if (kit.mountFrames.length !== 0) return false;
    } else if (kit.mountFrames.length === 0 ||
      kit.mountFrames.some((frame) => frame.mountType !== kit.mode)) return false;
    for (const frame of kit.mountFrames) {
      if (frame.mountType === "grid" && !sortedUniqueStrings(frame.acceptedEdgeTypes)) return false;
    }
  }

  for (const component of catalogue.components) {
    if (!fragmentsAreCanonical(component.fragments) ||
      component.fragments.some(({ raster }) =>
        !rasterIsBound(raster, records, context.catalogPackId)
      )) return false;
  }

  const certifiedPairs = new Set<string>();
  for (const certification of catalogue.certifications) {
    const kit = kits.get(certification.kitId);
    const component = components.get(certification.componentId);
    const frame = kit?.mountFrames.find(({ id }) => id === certification.mountFrameId);
    const pair = `${certification.kitId}\0${certification.mountFrameId}\0${certification.componentId}`;
    if (!kit || !component || !frame || kit.mode === "whole" || certifiedPairs.has(pair) ||
      frame.slotId !== component.slotId ||
      frame.mountType !== component.componentFrame.mountType ||
      !sameProfile(kit.compatibilityProfile, component.compatibilityProfile) ||
      !certifiedGeometryIsValid(frame, component.componentFrame)) return false;
    certifiedPairs.add(pair);
  }
  return true;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): DeepReadonly<T> {
  if (value === null || typeof value !== "object" || seen.has(value) ||
    Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value) as DeepReadonly<T>;
}

export function snapshotProductKitCatalogueData(
  value: unknown
): ProductKitCatalogue | null {
  const snapshot = snapshotPlainData(value, {
    maxNodes: 4_000_000,
    maxArrayLength: 20_000
  });
  if (!snapshot || !CatalogueSchema.safeParse(snapshot).success) return null;
  return snapshot as ProductKitCatalogue;
}

export function parseProductKitCatalogue(
  value: unknown,
  context: ProductKitCatalogueContext
): ProductKitCatalogue | null {
  const catalogueSnapshot = snapshotProductKitCatalogueData(value);
  const contextSnapshot = snapshotPlainData(context, {
    maxNodes: 500_000,
    maxArrayLength: 20_000
  });
  if (!catalogueSnapshot || !contextSnapshot) return null;
  const parsedContext = ContextSchema.safeParse(contextSnapshot);
  if (!parsedContext.success || !graphIsValid(
    catalogueSnapshot as unknown as ParsedCatalogue,
    parsedContext.data
  )) return null;
  const parsed = deepFreeze(catalogueSnapshot as unknown as ParsedCatalogue);
  parsedProductKitCatalogues.add(parsed as object);
  return parsed;
}

export function isParsedProductKitCatalogue(
  value: unknown
): value is ProductKitCatalogue {
  return value !== null && typeof value === "object" &&
    parsedProductKitCatalogues.has(value);
}


```

## FILE: web/src/product-kit/product-kit-runtime.ts

```typescript
import { certificationFingerprintMatches } from "./certification-fingerprint";
import {
  resolveGripTransform,
  resolveSocketTransform,
  type ResolvedMountTransform
} from "./connector-transform";
import {
  createProductKitGridOccupancy,
  type ProductKitGridTile
} from "./grid-placement";
import {
  createProductKitLayerPlan,
  type ProductKitLayerPlan,
  type ProductKitResolvedPlacement
} from "./layer-plan";
import { snapshotPlainData } from "./plain-data";
import {
  isParsedProductKitCatalogue,
  type ProductKitCatalogue,
  type ProductKitComponent,
  type ProductKitKit,
  type ProductKitMountFrame
} from "./product-kit-catalogue";

const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;

export interface ProductKitPairRequest {
  readonly kind: "socket" | "grip" | "grid";
  readonly kitId: string;
  readonly mountFrameId: string;
  readonly componentId: string;
}

export type ProductKitCertifiedPair =
  | {
    readonly kind: "socket" | "grip";
    readonly kitId: string;
    readonly mountFrameId: string;
    readonly componentId: string;
    readonly transform: ResolvedMountTransform;
  }
  | {
    readonly kind: "grid";
    readonly kitId: string;
    readonly mountFrameId: string;
    readonly componentId: string;
    readonly plane: "floor" | "wall";
    readonly footprint: { readonly columns: number; readonly rows: number };
    readonly edgeTypes: {
      readonly north?: string;
      readonly east?: string;
      readonly south?: string;
      readonly west?: string;
    };
  };

export type ProductKitCompositionPlacementRequest =
  | {
    readonly kind: "socket" | "grip";
    readonly placementId: string;
    readonly mountFrameId: string;
    readonly componentId: string;
  }
  | {
    readonly kind: "grid";
    readonly placementId: string;
    readonly mountFrameId: string;
    readonly componentId: string;
    readonly column: number;
    readonly row: number;
  };

export interface ProductKitCompositionRequest {
  readonly kitId: string;
  readonly placements: readonly ProductKitCompositionPlacementRequest[];
}

export interface ProductKitRuntime {
  readonly resolvePair: (request: ProductKitPairRequest) =>
    ProductKitCertifiedPair | null;
  readonly planComposition: (request: ProductKitCompositionRequest) =>
    ProductKitLayerPlan | null;
}

interface IndexedCertifiedPair {
  readonly kit: ProductKitKit;
  readonly frame: ProductKitMountFrame;
  readonly component: ProductKitComponent;
}

interface IndexedFrame {
  readonly kit: ProductKitKit;
  readonly frame: ProductKitMountFrame;
}

interface GridPlacementGroup {
  readonly frame: Extract<ProductKitMountFrame, { readonly mountType: "grid" }>;
  readonly tiles: ProductKitGridTile[];
  readonly components: Map<string, ProductKitComponent>;
}

function pairKey(kitId: string, frameId: string, componentId: string): string {
  return `${kitId}\0${frameId}\0${componentId}`;
}

function frameKey(kitId: string, frameId: string): string {
  return `${kitId}\0${frameId}`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[]
): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length && keys.every((key) =>
    typeof key === "string" && expected.includes(key)
  );
}

function hasOwnDenseIndices(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function isPortableId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 80 && PORTABLE_ID.test(value);
}

function isPairRequest(value: unknown): value is ProductKitPairRequest {
  return isRecord(value) && hasExactKeys(value, [
    "kind", "kitId", "mountFrameId", "componentId"
  ]) &&
    (value.kind === "socket" || value.kind === "grip" || value.kind === "grid") &&
    isPortableId(value.kitId) && isPortableId(value.mountFrameId) &&
    isPortableId(value.componentId);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0) && value >= 0;
}

function isCompositionPlacementRequest(
  value: unknown
): value is ProductKitCompositionPlacementRequest {
  if (!isRecord(value) || !isPortableId(value.placementId) ||
    !isPortableId(value.mountFrameId) || !isPortableId(value.componentId)) return false;
  if (value.kind === "socket" || value.kind === "grip") return hasExactKeys(value, [
    "kind", "placementId", "mountFrameId", "componentId"
  ]);
  return value.kind === "grid" && hasExactKeys(value, [
    "kind", "placementId", "mountFrameId", "componentId", "column", "row"
  ]) && isNonNegativeSafeInteger(value.column) &&
    isNonNegativeSafeInteger(value.row);
}

function isCompositionRequest(value: unknown): value is ProductKitCompositionRequest {
  return isRecord(value) && hasExactKeys(value, ["kitId", "placements"]) &&
    isPortableId(value.kitId) &&
    Array.isArray(value.placements) && value.placements.length <= 131_072 &&
    hasOwnDenseIndices(value.placements) &&
    value.placements.every(isCompositionPlacementRequest);
}

function cloneGridEdgeTypes(
  value: Extract<
    ProductKitComponent["componentFrame"],
    { readonly mountType: "grid" }
  >["edgeTypes"]
): Extract<ProductKitCertifiedPair, { readonly kind: "grid" }>["edgeTypes"] {
  return {
    ...(value.north === undefined ? {} : { north: value.north }),
    ...(value.east === undefined ? {} : { east: value.east }),
    ...(value.south === undefined ? {} : { south: value.south }),
    ...(value.west === undefined ? {} : { west: value.west })
  };
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function createProductKitRuntimeFromSnapshot(
  catalogue: ProductKitCatalogue
): ProductKitRuntime {
  const certificationContext = snapshotPlainData({
    packId: catalogue.packId,
    connectorFormulaVersion: catalogue.connectorFormulaVersion
  }, { maxNodes: 16 });
  if (!certificationContext) {
    throw new Error("trusted product-kit catalogue produced an invalid context");
  }
  const kits = new Map(catalogue.kits.map((kit) => [kit.id, kit]));
  const components = new Map(
    catalogue.components.map((component) => [component.id, component])
  );
  const frames = new Map<string, IndexedFrame>();
  for (const kit of catalogue.kits) {
    for (const frame of kit.mountFrames) {
      frames.set(frameKey(kit.id, frame.id), { kit, frame });
    }
  }
  const certifiedPairs = new Map<string, IndexedCertifiedPair>();
  for (const certification of catalogue.certifications) {
    const kit = kits.get(certification.kitId);
    const component = components.get(certification.componentId);
    const indexedFrame = frames.get(frameKey(
      certification.kitId,
      certification.mountFrameId
    ));
    const frame = indexedFrame?.frame;
    if (!kit || !component || !frame || !certificationFingerprintMatches(
      certificationContext,
      kit,
      frame,
      component,
      certification.fingerprint
    )) continue;
    certifiedPairs.set(
      pairKey(kit.id, frame.id, component.id),
      { kit, frame, component }
    );
  }

  const resolvePairFromSnapshot = (
    request: ProductKitPairRequest
  ): ProductKitCertifiedPair | null => {
    if (!isPairRequest(request)) return null;
    const pair = certifiedPairs.get(pairKey(
      request.kitId,
      request.mountFrameId,
      request.componentId
    ));
    if (!pair || request.kind !== pair.kit.mode ||
      request.kind !== pair.frame.mountType ||
      request.kind !== pair.component.componentFrame.mountType) return null;
    if (request.kind === "grid") {
      if (pair.frame.mountType !== "grid" ||
        pair.component.componentFrame.mountType !== "grid" ||
        pair.frame.plane !== pair.component.componentFrame.plane ||
        !Number.isSafeInteger(pair.component.componentFrame.footprint.columns) ||
        !Number.isSafeInteger(pair.component.componentFrame.footprint.rows) ||
        pair.component.componentFrame.footprint.columns < 1 ||
        pair.component.componentFrame.footprint.rows < 1 ||
        pair.component.componentFrame.footprint.columns > pair.frame.columns ||
        pair.component.componentFrame.footprint.rows > pair.frame.rows) return null;
      return deepFreeze({
        kind: "grid" as const,
        kitId: pair.kit.id,
        mountFrameId: pair.frame.id,
        componentId: pair.component.id,
        plane: pair.frame.plane,
        footprint: { ...pair.component.componentFrame.footprint },
        edgeTypes: cloneGridEdgeTypes(pair.component.componentFrame.edgeTypes)
      });
    }
    let transform: ResolvedMountTransform | null;
    if (request.kind === "socket") {
      if (pair.frame.mountType !== "socket" ||
        pair.component.componentFrame.mountType !== "socket") return null;
      transform = resolveSocketTransform(
        pair.component.componentFrame,
        pair.frame,
        pair.frame.constraints
      );
    } else if (request.kind === "grip") {
      if (pair.frame.mountType !== "grip" ||
        pair.component.componentFrame.mountType !== "grip") return null;
      transform = resolveGripTransform(
        pair.component.componentFrame,
        pair.frame,
        pair.frame.constraints
      );
    } else {
      return null;
    }
    if (!transform) return null;
    return deepFreeze({
      kind: request.kind,
      kitId: pair.kit.id,
      mountFrameId: pair.frame.id,
      componentId: pair.component.id,
      transform
    });
  };

  const resolvePair = (request: ProductKitPairRequest): ProductKitCertifiedPair | null => {
    const snapshot = snapshotPlainData(request, { maxNodes: 64, maxArrayLength: 8 });
    return snapshot === null ? null : resolvePairFromSnapshot(snapshot);
  };

  const planCompositionFromSnapshot = (
    request: ProductKitCompositionRequest
  ): ProductKitLayerPlan | null => {
    if (!isCompositionRequest(request)) return null;
    const kit = kits.get(request.kitId);
    if (!kit) return null;
    const placements: ProductKitResolvedPlacement[] = [];
    const gridGroups = new Map<string, GridPlacementGroup>();
    const occupiedFixedFrames = new Set<string>();
    for (const placement of request.placements) {
      if (placement.kind === "grid") {
        const pair = resolvePairFromSnapshot({
          kind: "grid",
          kitId: kit.id,
          mountFrameId: placement.mountFrameId,
          componentId: placement.componentId
        });
        const indexed = certifiedPairs.get(pairKey(
          kit.id,
          placement.mountFrameId,
          placement.componentId
        ));
        if (!pair || pair.kind !== "grid" || !indexed ||
          indexed.frame.mountType !== "grid" ||
          indexed.component.componentFrame.mountType !== "grid") return null;
        let group = gridGroups.get(indexed.frame.id);
        if (!group) {
          group = {
            frame: indexed.frame,
            tiles: [],
            components: new Map()
          };
          gridGroups.set(indexed.frame.id, group);
        }
        group.tiles.push({
          placementId: placement.placementId,
          componentId: indexed.component.id,
          column: placement.column,
          row: placement.row,
          footprint: { ...pair.footprint },
          edgeTypes: { ...pair.edgeTypes }
        });
        group.components.set(placement.placementId, indexed.component);
        continue;
      }
      if (occupiedFixedFrames.has(placement.mountFrameId)) return null;
      occupiedFixedFrames.add(placement.mountFrameId);
      const pair = resolvePairFromSnapshot({
        kind: placement.kind,
        kitId: kit.id,
        mountFrameId: placement.mountFrameId,
        componentId: placement.componentId
      });
      const indexed = certifiedPairs.get(pairKey(
        kit.id,
        placement.mountFrameId,
        placement.componentId
      ));
      if (!pair || pair.kind === "grid" || !indexed) return null;
      placements.push({
        kind: "affine",
        placementId: placement.placementId,
        mountFrameId: placement.mountFrameId,
        component: indexed.component,
        transform: pair.transform
      });
    }
    for (const group of gridGroups.values()) {
      const occupancy = createProductKitGridOccupancy(group.frame, group.tiles);
      if (!occupancy) return null;
      for (const tile of occupancy.placements) {
        const component = group.components.get(tile.placementId);
        if (!component) return null;
        placements.push({
          kind: "grid",
          placementId: tile.placementId,
          mountFrameId: group.frame.id,
          component,
          column: tile.column,
          row: tile.row,
          normalizedBounds: {
            x: group.frame.origin.x + tile.column * group.frame.cellSize.width,
            y: group.frame.origin.y + tile.row * group.frame.cellSize.height,
            width: tile.footprint.columns * group.frame.cellSize.width,
            height: tile.footprint.rows * group.frame.cellSize.height
          }
        });
      }
    }
    return createProductKitLayerPlan(kit, placements);
  };

  const planComposition = (
    request: ProductKitCompositionRequest
  ): ProductKitLayerPlan | null => {
    const snapshot = snapshotPlainData(request, {
      maxNodes: 2_000_000,
      maxArrayLength: 131_072
    });
    return snapshot === null ? null : planCompositionFromSnapshot(snapshot);
  };

  return Object.freeze({
    resolvePair,
    planComposition
  });
}

const NULL_PRODUCT_KIT_RUNTIME: ProductKitRuntime = Object.freeze({
  resolvePair: (_request: ProductKitPairRequest) => null,
  planComposition: (_request: ProductKitCompositionRequest) => null
});

export function createProductKitRuntime(
  catalogue: ProductKitCatalogue
): ProductKitRuntime;
export function createProductKitRuntime(
  catalogue: unknown
): ProductKitRuntime | null;
export function createProductKitRuntime(
  catalogue: unknown
): ProductKitRuntime | null {
  const plainSnapshot = snapshotPlainData(catalogue, {
    maxNodes: 4_000_000,
    maxArrayLength: 20_000
  });
  if (!plainSnapshot) return null;
  if (!isParsedProductKitCatalogue(catalogue)) return NULL_PRODUCT_KIT_RUNTIME;
  try {
    return createProductKitRuntimeFromSnapshot(plainSnapshot as ProductKitCatalogue);
  } catch {
    return NULL_PRODUCT_KIT_RUNTIME;
  }
}


```

## FILE: web/src/product-kit/utf8-sha256.test.ts

```typescript
import { describe, expect, it } from "vitest";
import { sha256Utf8 } from "./utf8-sha256";

describe("sha256Utf8", () => {
  it.each([
    ["empty text", "", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    [
      "the standard multi-block message",
      "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    ],
    ["Unicode text", "广告市场🎨", "b4bf91488f8e0df669e309853821f5a3435c2338b0f7627146c94e75c6a2ef47"]
  ])("hashes %s as UTF-8", (_label, value, expected) => {
    expect(sha256Utf8(value)).toBe(expected);
  });

  it.each([
    ["a lone high surrogate", "\uD800"],
    ["a trailing high surrogate", "valid\uDFFF\uD800"],
    ["a high surrogate followed by a non-low code unit", "\uD800x"],
    ["a lone low surrogate", "\uDFFF"],
    ["a low surrogate after ordinary text", "valid\uDFFF"]
  ])("rejects %s instead of hashing a replacement character", (_label, value) => {
    expect(() => sha256Utf8(value)).toThrow(TypeError);
  });

  it("is deterministic without changing its input", () => {
    const value = "immutable input \uD83C\uDFA8";
    const before = value;

    const first = sha256Utf8(value);
    const second = sha256Utf8(value);

    expect(first).toBe(second);
    expect(value).toBe(before);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});


```

## FILE: web/src/product-kit/certification-fingerprint.test.ts

```typescript
import { describe, expect, it } from "vitest";
import {
  canonicalCertificationInput,
  certificationFingerprintMatches,
  computeCertificationFingerprint,
  type ProductKitCertificationContext
} from "./certification-fingerprint";
import type {
  ProductKitComponent,
  ProductKitKit,
  ProductKitMountFrame
} from "./product-kit-catalogue";

const CONTEXT: ProductKitCertificationContext = {
  packId: "pk1-pilot",
  connectorFormulaVersion: "product-kit-connectors@1"
};

const SOCKET_KIT: ProductKitKit = {
  id: "pk1-socket-kit",
  title: "Travel Bottle",
  mode: "socket",
  compatibilityProfile: {
    familyId: "pk1-drinkware",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-bottle-lid",
    styleId: "pk1-outline-clean"
  },
  base: {
    assetId: "asset-socket-base",
    masterSha256: "1".repeat(64),
    frame: {
      originalWidth: 1200,
      originalHeight: 1000,
      trimX: 100,
      trimY: 50,
      trimWidth: 900,
      trimHeight: 800
    }
  },
  priceAssetId: "pk1-price-socket-base",
  mountFrames: [{
    id: "pk1-socket-frame",
    slotId: "pk1-lid-slot",
    mountType: "socket",
    point: { x: 0.5, y: 0.08 },
    normal: { x: 0, y: -1 },
    referenceScale: 0.22,
    constraints: {
      minScale: 0.5,
      maxScale: 2,
      minRotationDegrees: -45,
      maxRotationDegrees: 45,
      maxNormalErrorDegrees: 5,
      mirrorAllowed: false
    }
  }],
  artworkBounds: [{ x: 0.2, y: 0.3, width: 0.6, height: 0.45 }]
};

const SOCKET_COMPONENT: ProductKitComponent = {
  id: "pk1-socket-component",
  title: "Flip Lid",
  slotId: "pk1-lid-slot",
  compatibilityProfile: {
    familyId: "pk1-drinkware",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-bottle-lid",
    styleId: "pk1-outline-clean"
  },
  componentFrame: {
    mountType: "socket",
    point: { x: 0.5, y: 0.9 },
    normal: { x: 0, y: -1 },
    referenceScale: 0.2
  },
  fragments: [{
    layer: "front",
    raster: {
      assetId: "asset-socket-part",
      masterSha256: "2".repeat(64),
      frame: {
        originalWidth: 500,
        originalHeight: 400,
        trimX: 10,
        trimY: 20,
        trimWidth: 300,
        trimHeight: 200
      }
    }
  }],
  priceAssetId: "pk1-price-flip-lid"
};

const GRIP_KIT: ProductKitKit = {
  id: "pk1-grip-kit",
  title: "Reusable Cup",
  mode: "grip",
  compatibilityProfile: {
    familyId: "pk1-drinkware",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-cup-handle",
    styleId: "pk1-outline-clean"
  },
  base: {
    assetId: "asset-grip-base",
    masterSha256: "3".repeat(64),
    frame: {
      originalWidth: 1000,
      originalHeight: 1200,
      trimX: 0,
      trimY: 100,
      trimWidth: 900,
      trimHeight: 1000
    }
  },
  priceAssetId: "pk1-price-grip-base",
  mountFrames: [{
    id: "pk1-grip-frame",
    slotId: "pk1-handle-slot",
    mountType: "grip",
    contacts: [{ x: 0.82, y: 0.35 }, { x: 0.82, y: 0.7 }],
    normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }],
    constraints: {
      minScale: 0.5,
      maxScale: 2,
      minRotationDegrees: -90,
      maxRotationDegrees: 90,
      maxNormalErrorDegrees: 3,
      mirrorAllowed: true
    }
  }],
  artworkBounds: [{ x: 0.25, y: 0.25, width: 0.45, height: 0.5 }]
};

const GRIP_COMPONENT: ProductKitComponent = {
  id: "pk1-grip-component",
  title: "Loop Handle",
  slotId: "pk1-handle-slot",
  compatibilityProfile: {
    familyId: "pk1-drinkware",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-cup-handle",
    styleId: "pk1-outline-clean"
  },
  componentFrame: {
    mountType: "grip",
    contacts: [{ x: 0.18, y: 0.25 }, { x: 0.18, y: 0.75 }],
    normals: [{ x: -1, y: 0 }, { x: -1, y: 0 }]
  },
  fragments: [
    {
      layer: "rear",
      raster: {
        assetId: "asset-grip-rear",
        masterSha256: "4".repeat(64),
        frame: {
          originalWidth: 600,
          originalHeight: 800,
          trimX: 20,
          trimY: 30,
          trimWidth: 500,
          trimHeight: 700
        }
      }
    },
    {
      layer: "front",
      raster: {
        assetId: "asset-grip-front",
        masterSha256: "5".repeat(64),
        frame: {
          originalWidth: 620,
          originalHeight: 820,
          trimX: 21,
          trimY: 31,
          trimWidth: 501,
          trimHeight: 701
        }
      }
    }
  ],
  priceAssetId: "pk1-price-loop-handle"
};

const GRID_KIT: ProductKitKit = {
  id: "pk1-grid-kit",
  title: "Escape Room Wall",
  mode: "grid",
  compatibilityProfile: {
    familyId: "pk1-escape-room",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-wall-grid",
    styleId: "pk1-outline-clean"
  },
  base: {
    assetId: "asset-grid-base",
    masterSha256: "6".repeat(64),
    frame: {
      originalWidth: 1600,
      originalHeight: 1000,
      trimX: 40,
      trimY: 20,
      trimWidth: 1500,
      trimHeight: 900
    }
  },
  priceAssetId: "pk1-price-grid-base",
  mountFrames: [{
    id: "pk1-grid-frame",
    slotId: "pk1-grid-slot",
    mountType: "grid",
    origin: { x: 0.1, y: 0.15 },
    cellSize: { width: 0.1, height: 0.12 },
    columns: 8,
    rows: 6,
    plane: "wall",
    acceptedEdgeTypes: ["pk1-door", "pk1-panel"]
  }],
  artworkBounds: []
};

const GRID_COMPONENT: ProductKitComponent = {
  id: "pk1-grid-component",
  title: "Secret Door",
  slotId: "pk1-grid-slot",
  compatibilityProfile: {
    familyId: "pk1-escape-room",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-wall-grid",
    styleId: "pk1-outline-clean"
  },
  componentFrame: {
    mountType: "grid",
    plane: "wall",
    footprint: { columns: 2, rows: 3 },
    edgeTypes: { north: "pk1-panel", south: "pk1-door" }
  },
  fragments: [{
    layer: "overlay",
    raster: {
      assetId: "asset-grid-part",
      masterSha256: "7".repeat(64),
      frame: {
        originalWidth: 420,
        originalHeight: 640,
        trimX: 10,
        trimY: 15,
        trimWidth: 400,
        trimHeight: 600
      }
    }
  }],
  priceAssetId: "pk1-price-secret-door"
};

const SOCKET_CANONICAL = `{"schema":"product-kit-certification@1","version":1,"packId":"pk1-pilot","connectorFormulaVersion":"product-kit-connectors@1","kit":{"id":"pk1-socket-kit","mode":"socket","compatibilityProfile":{"familyId":"pk1-drinkware","perspectiveId":"pk1-front-view","geometryId":"pk1-bottle-lid","styleId":"pk1-outline-clean"},"base":{"assetId":"asset-socket-base","masterSha256":"${"1".repeat(64)}","frame":{"originalWidth":1200,"originalHeight":1000,"trimX":100,"trimY":50,"trimWidth":900,"trimHeight":800}},"mountFrame":{"id":"pk1-socket-frame","slotId":"pk1-lid-slot","mountType":"socket","point":{"x":0.5,"y":0.08},"normal":{"x":0,"y":-1},"referenceScale":0.22,"constraints":{"minScale":0.5,"maxScale":2,"minRotationDegrees":-45,"maxRotationDegrees":45,"maxNormalErrorDegrees":5,"mirrorAllowed":false}}},"component":{"id":"pk1-socket-component","slotId":"pk1-lid-slot","compatibilityProfile":{"familyId":"pk1-drinkware","perspectiveId":"pk1-front-view","geometryId":"pk1-bottle-lid","styleId":"pk1-outline-clean"},"componentFrame":{"mountType":"socket","point":{"x":0.5,"y":0.9},"normal":{"x":0,"y":-1},"referenceScale":0.2},"fragments":[{"layer":"front","raster":{"assetId":"asset-socket-part","masterSha256":"${"2".repeat(64)}","frame":{"originalWidth":500,"originalHeight":400,"trimX":10,"trimY":20,"trimWidth":300,"trimHeight":200}}}]}}`;

const GRIP_CANONICAL = `{"schema":"product-kit-certification@1","version":1,"packId":"pk1-pilot","connectorFormulaVersion":"product-kit-connectors@1","kit":{"id":"pk1-grip-kit","mode":"grip","compatibilityProfile":{"familyId":"pk1-drinkware","perspectiveId":"pk1-front-view","geometryId":"pk1-cup-handle","styleId":"pk1-outline-clean"},"base":{"assetId":"asset-grip-base","masterSha256":"${"3".repeat(64)}","frame":{"originalWidth":1000,"originalHeight":1200,"trimX":0,"trimY":100,"trimWidth":900,"trimHeight":1000}},"mountFrame":{"id":"pk1-grip-frame","slotId":"pk1-handle-slot","mountType":"grip","contacts":[{"x":0.82,"y":0.35},{"x":0.82,"y":0.7}],"normals":[{"x":1,"y":0},{"x":1,"y":0}],"constraints":{"minScale":0.5,"maxScale":2,"minRotationDegrees":-90,"maxRotationDegrees":90,"maxNormalErrorDegrees":3,"mirrorAllowed":true}}},"component":{"id":"pk1-grip-component","slotId":"pk1-handle-slot","compatibilityProfile":{"familyId":"pk1-drinkware","perspectiveId":"pk1-front-view","geometryId":"pk1-cup-handle","styleId":"pk1-outline-clean"},"componentFrame":{"mountType":"grip","contacts":[{"x":0.18,"y":0.25},{"x":0.18,"y":0.75}],"normals":[{"x":-1,"y":0},{"x":-1,"y":0}]},"fragments":[{"layer":"rear","raster":{"assetId":"asset-grip-rear","masterSha256":"${"4".repeat(64)}","frame":{"originalWidth":600,"originalHeight":800,"trimX":20,"trimY":30,"trimWidth":500,"trimHeight":700}}},{"layer":"front","raster":{"assetId":"asset-grip-front","masterSha256":"${"5".repeat(64)}","frame":{"originalWidth":620,"originalHeight":820,"trimX":21,"trimY":31,"trimWidth":501,"trimHeight":701}}}]}}`;

const GRID_CANONICAL = `{"schema":"product-kit-certification@1","version":1,"packId":"pk1-pilot","connectorFormulaVersion":"product-kit-connectors@1","kit":{"id":"pk1-grid-kit","mode":"grid","compatibilityProfile":{"familyId":"pk1-escape-room","perspectiveId":"pk1-front-view","geometryId":"pk1-wall-grid","styleId":"pk1-outline-clean"},"base":{"assetId":"asset-grid-base","masterSha256":"${"6".repeat(64)}","frame":{"originalWidth":1600,"originalHeight":1000,"trimX":40,"trimY":20,"trimWidth":1500,"trimHeight":900}},"mountFrame":{"id":"pk1-grid-frame","slotId":"pk1-grid-slot","mountType":"grid","origin":{"x":0.1,"y":0.15},"cellSize":{"width":0.1,"height":0.12},"columns":8,"rows":6,"plane":"wall","acceptedEdgeTypes":["pk1-door","pk1-panel"]}},"component":{"id":"pk1-grid-component","slotId":"pk1-grid-slot","compatibilityProfile":{"familyId":"pk1-escape-room","perspectiveId":"pk1-front-view","geometryId":"pk1-wall-grid","styleId":"pk1-outline-clean"},"componentFrame":{"mountType":"grid","plane":"wall","footprint":{"columns":2,"rows":3},"edgeTypes":{"north":"pk1-panel","east":null,"south":"pk1-door","west":null}},"fragments":[{"layer":"overlay","raster":{"assetId":"asset-grid-part","masterSha256":"${"7".repeat(64)}","frame":{"originalWidth":420,"originalHeight":640,"trimX":10,"trimY":15,"trimWidth":400,"trimHeight":600}}}]}}`;

const EXPECTED_FINGERPRINTS = {
  socket: "141f2fa929ec7f4336f5b6addb845993c44a686c882baf7543a1221750e55771",
  grip: "769ac88a116a1d19e83928b19d6087f4aa868009493decfcbac9f690e994060a",
  grid: "ce6ab5b80432b613a3d41321761857bd650b09e16e60f57004c61f384762414b"
} as const;

interface EvidenceFixture {
  context: ProductKitCertificationContext;
  kit: ProductKitKit;
  component: ProductKitComponent;
}

const fixtures = {
  socket: { context: CONTEXT, kit: SOCKET_KIT, component: SOCKET_COMPONENT },
  grip: { context: CONTEXT, kit: GRIP_KIT, component: GRIP_COMPONENT },
  grid: { context: CONTEXT, kit: GRID_KIT, component: GRID_COMPONENT }
} satisfies Record<string, EvidenceFixture>;

function frameOf(fixture: EvidenceFixture): ProductKitMountFrame {
  return fixture.kit.mountFrames[0]!;
}

function fingerprintOf(fixture: EvidenceFixture): string | null {
  return computeCertificationFingerprint(
    fixture.context,
    fixture.kit,
    frameOf(fixture),
    fixture.component
  );
}

function cloneFixture(fixture: EvidenceFixture): EvidenceFixture {
  return structuredClone(fixture);
}

function setPath(root: unknown, path: readonly (string | number)[], value: unknown): void {
  let target = root as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) {
    target = target[key] as Record<string | number, unknown>;
  }
  target[path.at(-1)!] = value;
}

function reverseInsertionOrder<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => reverseInsertionOrder(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).reverse().map(([key, item]) => [key, reverseInsertionOrder(item)])
    ) as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

describe("certification canonical input", () => {
  it.each([
    ["socket", fixtures.socket, SOCKET_CANONICAL, EXPECTED_FINGERPRINTS.socket],
    ["grip", fixtures.grip, GRIP_CANONICAL, EXPECTED_FINGERPRINTS.grip],
    ["grid", fixtures.grid, GRID_CANONICAL, EXPECTED_FINGERPRINTS.grid]
  ] as const)("pins the exact %s evidence and fingerprint", (_kind, fixture, canonical, fingerprint) => {
    const actual = canonicalCertificationInput(
      fixture.context,
      fixture.kit,
      frameOf(fixture),
      fixture.component
    );

    expect(actual).toBe(canonical);
    expect(actual?.endsWith("\n")).toBe(false);
    expect(computeCertificationFingerprint(
      fixture.context,
      fixture.kit,
      frameOf(fixture),
      fixture.component
    )).toBe(fingerprint);
  });

  it("encodes every absent grid edge as null", () => {
    const canonical = canonicalCertificationInput(
      CONTEXT,
      GRID_KIT,
      frameOf(fixtures.grid),
      GRID_COMPONENT
    );

    expect(JSON.parse(canonical!).component.componentFrame.edgeTypes).toEqual({
      north: "pk1-panel",
      east: null,
      south: "pk1-door",
      west: null
    });
  });

  it("is independent of property insertion order at every object depth", () => {
    const reordered = reverseInsertionOrder(fixtures.grip);

    expect(canonicalCertificationInput(
      reordered.context,
      reordered.kit,
      frameOf(reordered),
      reordered.component
    )).toBe(GRIP_CANONICAL);
    expect(fingerprintOf(reordered)).toBe(EXPECTED_FINGERPRINTS.grip);
  });

  it("does not mutate deeply frozen evidence", () => {
    const frozen = deepFreeze(cloneFixture(fixtures.grip));
    const before = JSON.stringify(frozen);

    expect(fingerprintOf(frozen)).toBe(EXPECTED_FINGERPRINTS.grip);
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it.each([
    ["an inconsistent kit/frame discriminant", ["kit", "mode"], "socket"],
    ["an inconsistent component/frame discriminant", ["component", "componentFrame", "mountType"], "socket"],
    ["an unknown frame discriminant", ["kit", "mountFrames", 0, "mountType"], "unknown"],
    ["non-finite geometry", ["kit", "mountFrames", 0, "origin", "x"], Number.NaN],
    ["malformed UTF-16", ["context", "packId"], "pk1-bad\uD800"],
    ["terminal LF in an ID", ["context", "packId"], "pk1-pilot\n"],
    ["signed-zero evidence", ["kit", "mountFrames", 0, "origin", "x"], -0]
  ] as const)("fails closed for %s", (_label, path, changedValue) => {
    const changed = cloneFixture(fixtures.grid);
    setPath(changed, path, changedValue);

    expect(canonicalCertificationInput(
      changed.context,
      changed.kit,
      frameOf(changed),
      changed.component
    )).toBeNull();
    expect(fingerprintOf(changed)).toBeNull();
  });

  it("rejects sparse evidence arrays instead of omitting holes", () => {
    const changed = cloneFixture(fixtures.grid);
    const sparseFrames = new Array<ProductKitMountFrame>(2);
    sparseFrames[0] = frameOf(changed);
    (changed.kit as unknown as {
      mountFrames: ProductKitMountFrame[];
    }).mountFrames = sparseFrames;

    expect(fingerprintOf(changed)).toBeNull();
  });

  it("returns null without invoking hostile evidence shapes", () => {
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    const methodOverride = cloneFixture(fixtures.socket);
    Object.defineProperty(methodOverride.component.fragments, "map", {
      value: () => { throw new Error("caller-owned map"); },
      enumerable: false
    });
    let accessorReads = 0;
    const accessorKit = cloneFixture(fixtures.socket).kit as unknown as Record<string, unknown>;
    Object.defineProperty(accessorKit, "base", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("hostile getter");
      }
    });

    const calls = [
      () => canonicalCertificationInput(
        proxy as never,
        SOCKET_KIT,
        frameOf(fixtures.socket),
        SOCKET_COMPONENT
      ),
      () => canonicalCertificationInput(
        CONTEXT,
        Object.create(SOCKET_KIT) as never,
        frameOf(fixtures.socket),
        SOCKET_COMPONENT
      ),
      () => canonicalCertificationInput(
        CONTEXT,
        accessorKit as never,
        frameOf(fixtures.socket),
        SOCKET_COMPONENT
      ),
      () => computeCertificationFingerprint(
        CONTEXT,
        methodOverride.kit,
        frameOf(methodOverride),
        methodOverride.component
      )
    ];
    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
    expect(accessorReads).toBe(0);
  });

  it.each([
    ["negative raster dimensions", "socket", ["kit", "base", "frame", "originalWidth"], -1],
    ["raster trim overflow", "socket", ["kit", "base", "frame", "trimX"], 1199],
    ["point outside the unit rectangle", "socket", ["kit", "mountFrames", 0, "point", "x"], 1.1],
    ["zero normal", "socket", ["component", "componentFrame", "normal"], { x: 0, y: 0 }],
    ["inverted transform constraints", "socket", ["kit", "mountFrames", 0, "constraints", "minScale"], 3],
    ["zero grid columns", "grid", ["kit", "mountFrames", 0, "columns"], 0],
    ["grid extent overflow", "grid", ["kit", "mountFrames", 0, "origin", "x"], 0.9],
    ["zero component footprint", "grid", ["component", "componentFrame", "footprint", "columns"], 0]
  ] as const)("rejects out-of-contract %s", (_label, fixtureName, path, changedValue) => {
    const changed = cloneFixture(fixtures[fixtureName]);
    setPath(changed, path, changedValue);

    expect(canonicalCertificationInput(
      changed.context,
      changed.kit,
      frameOf(changed),
      changed.component
    )).toBeNull();
    expect(fingerprintOf(changed)).toBeNull();
  });

  it.each([
    ["kit title", ["kit", "title"], "Renamed kit"],
    ["kit artwork bounds", ["kit", "artworkBounds"], [{ x: 0, y: 0, width: 1, height: 1 }]],
    ["kit price ID", ["kit", "priceAssetId"], "pk1-another-kit-price"],
    ["component title", ["component", "title"], "Renamed component"],
    ["component price ID", ["component", "priceAssetId"], "pk1-another-component-price"]
  ] as const)("excludes %s", (_label, path, changedValue) => {
    const changed = cloneFixture(fixtures.socket);
    setPath(changed, path, changedValue);

    expect(fingerprintOf(changed)).toBe(EXPECTED_FINGERPRINTS.socket);
  });
});

const socketIncludedChanges = [
  ["pack ID", ["context", "packId"], "pk1-another-pack"],
  ["connector formula version", ["context", "connectorFormulaVersion"], "product-kit-connectors@2"],
  ["kit ID", ["kit", "id"], "pk1-another-socket-kit"],
  ["kit mode", ["kit", "mode"], "grip"],
  ["kit family profile", ["kit", "compatibilityProfile", "familyId"], "pk1-another-family"],
  ["kit perspective profile", ["kit", "compatibilityProfile", "perspectiveId"], "pk1-side-view"],
  ["kit geometry profile", ["kit", "compatibilityProfile", "geometryId"], "pk1-another-geometry"],
  ["kit style profile", ["kit", "compatibilityProfile", "styleId"], "pk1-another-style"],
  ["base asset ID", ["kit", "base", "assetId"], "asset-another-base"],
  ["base hash", ["kit", "base", "masterSha256"], "a".repeat(64)],
  ["base original width", ["kit", "base", "frame", "originalWidth"], 1201],
  ["base original height", ["kit", "base", "frame", "originalHeight"], 1001],
  ["base trim x", ["kit", "base", "frame", "trimX"], 101],
  ["base trim y", ["kit", "base", "frame", "trimY"], 51],
  ["base trim width", ["kit", "base", "frame", "trimWidth"], 901],
  ["base trim height", ["kit", "base", "frame", "trimHeight"], 801],
  ["mount-frame ID", ["kit", "mountFrames", 0, "id"], "pk1-another-socket-frame"],
  ["mount-frame slot", ["kit", "mountFrames", 0, "slotId"], "pk1-another-slot"],
  ["mount point x", ["kit", "mountFrames", 0, "point", "x"], 0.51],
  ["mount point y", ["kit", "mountFrames", 0, "point", "y"], 0.09],
  ["mount normal x", ["kit", "mountFrames", 0, "normal", "x"], 0.1],
  ["mount normal y", ["kit", "mountFrames", 0, "normal", "y"], -0.9],
  ["mount reference scale", ["kit", "mountFrames", 0, "referenceScale"], 0.23],
  ["minimum scale", ["kit", "mountFrames", 0, "constraints", "minScale"], 0.4],
  ["maximum scale", ["kit", "mountFrames", 0, "constraints", "maxScale"], 2.1],
  ["minimum rotation", ["kit", "mountFrames", 0, "constraints", "minRotationDegrees"], -44],
  ["maximum rotation", ["kit", "mountFrames", 0, "constraints", "maxRotationDegrees"], 44],
  ["normal-error limit", ["kit", "mountFrames", 0, "constraints", "maxNormalErrorDegrees"], 4],
  ["mirror permission", ["kit", "mountFrames", 0, "constraints", "mirrorAllowed"], true],
  ["component ID", ["component", "id"], "pk1-another-socket-component"],
  ["component slot", ["component", "slotId"], "pk1-another-slot"],
  ["component family profile", ["component", "compatibilityProfile", "familyId"], "pk1-another-family"],
  ["component perspective profile", ["component", "compatibilityProfile", "perspectiveId"], "pk1-side-view"],
  ["component geometry profile", ["component", "compatibilityProfile", "geometryId"], "pk1-another-geometry"],
  ["component style profile", ["component", "compatibilityProfile", "styleId"], "pk1-another-style"],
  ["component point x", ["component", "componentFrame", "point", "x"], 0.51],
  ["component point y", ["component", "componentFrame", "point", "y"], 0.91],
  ["component normal x", ["component", "componentFrame", "normal", "x"], 0.1],
  ["component normal y", ["component", "componentFrame", "normal", "y"], -0.9],
  ["component reference scale", ["component", "componentFrame", "referenceScale"], 0.21],
  ["fragment layer", ["component", "fragments", 0, "layer"], "overlay"],
  ["fragment asset ID", ["component", "fragments", 0, "raster", "assetId"], "asset-another-part"],
  ["fragment hash", ["component", "fragments", 0, "raster", "masterSha256"], "b".repeat(64)],
  ["fragment original width", ["component", "fragments", 0, "raster", "frame", "originalWidth"], 501],
  ["fragment original height", ["component", "fragments", 0, "raster", "frame", "originalHeight"], 401],
  ["fragment trim x", ["component", "fragments", 0, "raster", "frame", "trimX"], 11],
  ["fragment trim y", ["component", "fragments", 0, "raster", "frame", "trimY"], 21],
  ["fragment trim width", ["component", "fragments", 0, "raster", "frame", "trimWidth"], 301],
  ["fragment trim height", ["component", "fragments", 0, "raster", "frame", "trimHeight"], 201]
] as const;

const gripIncludedChanges = [
  ["first mount contact x", ["kit", "mountFrames", 0, "contacts", 0, "x"], 0.81],
  ["first mount contact y", ["kit", "mountFrames", 0, "contacts", 0, "y"], 0.34],
  ["second mount contact x", ["kit", "mountFrames", 0, "contacts", 1, "x"], 0.83],
  ["second mount contact y", ["kit", "mountFrames", 0, "contacts", 1, "y"], 0.71],
  ["first mount normal x", ["kit", "mountFrames", 0, "normals", 0, "x"], 0.9],
  ["first mount normal y", ["kit", "mountFrames", 0, "normals", 0, "y"], 0.1],
  ["second mount normal x", ["kit", "mountFrames", 0, "normals", 1, "x"], 0.9],
  ["second mount normal y", ["kit", "mountFrames", 0, "normals", 1, "y"], 0.1],
  ["first component contact x", ["component", "componentFrame", "contacts", 0, "x"], 0.17],
  ["first component contact y", ["component", "componentFrame", "contacts", 0, "y"], 0.24],
  ["second component contact x", ["component", "componentFrame", "contacts", 1, "x"], 0.19],
  ["second component contact y", ["component", "componentFrame", "contacts", 1, "y"], 0.76],
  ["first component normal x", ["component", "componentFrame", "normals", 0, "x"], -0.9],
  ["first component normal y", ["component", "componentFrame", "normals", 0, "y"], 0.1],
  ["second component normal x", ["component", "componentFrame", "normals", 1, "x"], -0.9],
  ["second component normal y", ["component", "componentFrame", "normals", 1, "y"], 0.1],
  ["second fragment layer", ["component", "fragments", 1, "layer"], "overlay"],
  ["second fragment asset", ["component", "fragments", 1, "raster", "assetId"], "asset-another-front"]
] as const;

const gridIncludedChanges = [
  ["grid origin x", ["kit", "mountFrames", 0, "origin", "x"], 0.11],
  ["grid origin y", ["kit", "mountFrames", 0, "origin", "y"], 0.16],
  ["grid cell width", ["kit", "mountFrames", 0, "cellSize", "width"], 0.09],
  ["grid cell height", ["kit", "mountFrames", 0, "cellSize", "height"], 0.11],
  ["grid columns", ["kit", "mountFrames", 0, "columns"], 7],
  ["grid rows", ["kit", "mountFrames", 0, "rows"], 5],
  ["grid plane", ["kit", "mountFrames", 0, "plane"], "floor"],
  ["accepted edge type", ["kit", "mountFrames", 0, "acceptedEdgeTypes", 0], "pk1-another-edge"],
  ["component grid plane", ["component", "componentFrame", "plane"], "floor"],
  ["footprint columns", ["component", "componentFrame", "footprint", "columns"], 1],
  ["footprint rows", ["component", "componentFrame", "footprint", "rows"], 2],
  ["north edge", ["component", "componentFrame", "edgeTypes", "north"], "pk1-door"],
  ["east edge", ["component", "componentFrame", "edgeTypes", "east"], "pk1-panel"],
  ["south edge", ["component", "componentFrame", "edgeTypes", "south"], "pk1-panel"],
  ["west edge", ["component", "componentFrame", "edgeTypes", "west"], "pk1-door"]
] as const;

describe("certification fingerprint staleness", () => {
  it.each(socketIncludedChanges)("invalidates a changed %s", (_label, path, value) => {
    const changed = cloneFixture(fixtures.socket);
    setPath(changed, path, value);
    expect(fingerprintOf(changed)).not.toBe(EXPECTED_FINGERPRINTS.socket);
  });

  it.each(gripIncludedChanges)("invalidates a changed grip %s", (_label, path, value) => {
    const changed = cloneFixture(fixtures.grip);
    setPath(changed, path, value);
    expect(fingerprintOf(changed)).not.toBe(EXPECTED_FINGERPRINTS.grip);
  });

  it.each(gridIncludedChanges)("invalidates a changed %s", (_label, path, value) => {
    const changed = cloneFixture(fixtures.grid);
    setPath(changed, path, value);
    expect(fingerprintOf(changed)).not.toBe(EXPECTED_FINGERPRINTS.grid);
  });
});

describe("certificationFingerprintMatches", () => {
  it("accepts only the exact lowercase 64-character fingerprint", () => {
    const fingerprint = EXPECTED_FINGERPRINTS.socket;
    const args = [CONTEXT, SOCKET_KIT, frameOf(fixtures.socket), SOCKET_COMPONENT] as const;

    expect(certificationFingerprintMatches(...args, fingerprint)).toBe(true);
    expect(certificationFingerprintMatches(...args, fingerprint.toUpperCase())).toBe(false);
    expect(certificationFingerprintMatches(...args, fingerprint.slice(0, -1))).toBe(false);
    expect(certificationFingerprintMatches(...args, `${fingerprint}0`)).toBe(false);
    expect(certificationFingerprintMatches(...args, `${fingerprint}\n`)).toBe(false);
    expect(certificationFingerprintMatches(...args, `${"g"}${fingerprint.slice(1)}`)).toBe(false);
    expect(certificationFingerprintMatches(...args, "0".repeat(64))).toBe(false);
  });

  it("returns false rather than throwing for hostile evidence", () => {
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    const call = () => certificationFingerprintMatches(
      proxy as never,
      SOCKET_KIT,
      frameOf(fixtures.socket),
      SOCKET_COMPONENT,
      EXPECTED_FINGERPRINTS.socket
    );

    expect(call).not.toThrow();
    expect(call()).toBe(false);
  });
});


```

## FILE: web/src/product-kit/connector-transform.test.ts

```typescript
import { describe, expect, it } from "vitest";
import {
  applyTransform,
  resolveGripTransform,
  resolveSocketTransform,
  type GripFrame,
  type Point,
  type SocketFrame,
  type TransformConstraints
} from "./connector-transform";

const constraints = (overrides: Partial<TransformConstraints> = {}): TransformConstraints => ({
  minScale: 0.5,
  maxScale: 3,
  minRotationDegrees: -180,
  maxRotationDegrees: 180,
  maxNormalErrorDegrees: 2,
  mirrorAllowed: false,
  ...overrides
});

function expectPointClose(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
}

describe("socket connector transforms", () => {
  it("maps the authored point and uses the reference-scale ratio", () => {
    const result = resolveSocketTransform(
      { point: { x: 2, y: 3 }, normal: { x: 1, y: 0 }, referenceScale: 4 },
      { point: { x: 10, y: 20 }, normal: { x: 0, y: 1 }, referenceScale: 8 },
      constraints()
    );

    expect(result).toMatchObject({ scale: 2, rotationDegrees: 90, mirrored: false });
    expectPointClose(applyTransform(result!.matrix, { x: 2, y: 3 }), { x: 10, y: 20 });
  });

  it.each([
    ["non-finite point", { point: { x: Number.NaN, y: 0 }, normal: { x: 1, y: 0 }, referenceScale: 1 }],
    ["infinite point", { point: { x: Number.POSITIVE_INFINITY, y: 0 }, normal: { x: 1, y: 0 }, referenceScale: 1 }],
    ["zero normal", { point: { x: 0, y: 0 }, normal: { x: 0, y: 0 }, referenceScale: 1 }],
    ["negative reference scale", { point: { x: 0, y: 0 }, normal: { x: 1, y: 0 }, referenceScale: -1 }]
  ])("rejects a %s", (_label, source) => {
    expect(resolveSocketTransform(source, {
      point: { x: 1, y: 1 },
      normal: { x: 1, y: 0 },
      referenceScale: 1
    }, constraints())).toBeNull();
  });

  it("fails closed when finite inputs overflow the derived affine matrix", () => {
    expect(resolveSocketTransform({
      point: { x: Number.MAX_VALUE, y: 0 },
      normal: { x: 1, y: 0 },
      referenceScale: 1
    }, {
      point: { x: 0, y: 0 },
      normal: { x: 1, y: 0 },
      referenceScale: 2
    }, constraints())).toBeNull();
  });

  it("accepts finite non-zero normals and positive reference scales below 1e-9", () => {
    expect(resolveSocketTransform({
      point: { x: 0, y: 0 },
      normal: { x: 1e-10, y: 0 },
      referenceScale: 1e-10
    }, {
      point: { x: 1, y: 1 },
      normal: { x: 1e-10, y: 0 },
      referenceScale: 1e-10
    }, constraints())).not.toBeNull();
  });

  it("preserves a genuine tiny socket rotation across the atan2 branch cut", () => {
    expect(resolveSocketTransform({
      point: { x: 0, y: 0 },
      normal: { x: -1, y: -1e-16 },
      referenceScale: 1
    }, {
      point: { x: 0, y: 0 },
      normal: { x: -1, y: 1e-16 },
      referenceScale: 1
    }, constraints({
      minRotationDegrees: 0,
      maxRotationDegrees: 0,
      maxNormalErrorDegrees: 0
    }))).toBeNull();
  });
});

describe("two-contact grip transforms", () => {
  const source: GripFrame = {
    contacts: [{ x: 0, y: 0 }, { x: 2, y: 0 }],
    normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
  };

  it("maps both contacts exactly and reports deterministic scale and rotation", () => {
    const result = resolveGripTransform(source, {
      contacts: [{ x: 10, y: 10 }, { x: 10, y: 14 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    }, constraints());

    expect(result).toMatchObject({ scale: 2, rotationDegrees: 90, mirrored: false });
    expectPointClose(applyTransform(result!.matrix, source.contacts[0]), { x: 10, y: 10 });
    expectPointClose(applyTransform(result!.matrix, source.contacts[1]), { x: 10, y: 14 });
  });

  it("derives three cup-size scales from the same authored handle", () => {
    const handle: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    const scaleFor = (height: number) => resolveGripTransform(handle, {
      contacts: [{ x: 4, y: 2 }, { x: 4, y: 2 + height }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    }, constraints())?.scale;

    expect(scaleFor(0.8)).toBeCloseTo(0.8, 10);
    expect(scaleFor(1)).toBeCloseTo(1, 10);
    expect(scaleFor(1.25)).toBeCloseTo(1.25, 10);
  });

  it("uses mirroring only when it is permitted and normals require it", () => {
    const target: GripFrame = {
      contacts: [{ x: 10, y: 10 }, { x: 8, y: 10 }],
      normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
    };

    expect(resolveGripTransform(source, target, constraints())).toBeNull();
    expect(resolveGripTransform(source, target, constraints({ mirrorAllowed: true })))
      .toMatchObject({ mirrored: true, rotationDegrees: 0, scale: 1 });
  });

  it("fails closed for degenerate frames and breached scale or rotation limits", () => {
    const degenerate: GripFrame = {
      contacts: [{ x: 1, y: 1 }, { x: 1, y: 1 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    expect(resolveGripTransform(degenerate, source, constraints())).toBeNull();
    expect(resolveGripTransform(source, {
      contacts: [{ x: 0, y: 0 }, { x: 8, y: 0 }],
      normals: source.normals
    }, constraints({ maxScale: 2 }))).toBeNull();
    expect(resolveGripTransform(source, {
      contacts: [{ x: 0, y: 0 }, { x: 0, y: 2 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    }, constraints({ minRotationDegrees: -30, maxRotationDegrees: 30 }))).toBeNull();
  });

  it("rejects invalid bounds and normals outside the authored tolerance", () => {
    const target: GripFrame = {
      contacts: source.contacts,
      normals: [
        { x: Math.sin(Math.PI / 180), y: -Math.cos(Math.PI / 180) },
        { x: Math.sin(Math.PI / 180), y: -Math.cos(Math.PI / 180) }
      ]
    };

    expect(resolveGripTransform(source, target, constraints({ minScale: 2, maxScale: 1 })))
      .toBeNull();
    expect(resolveGripTransform(source, target, constraints({
      minRotationDegrees: 20,
      maxRotationDegrees: -20
    }))).toBeNull();
    expect(resolveGripTransform(source, target, constraints({ maxNormalErrorDegrees: 0.5 })))
      .toBeNull();
    expect(resolveGripTransform(source, target, constraints({ maxNormalErrorDegrees: 1.1 })))
      .not.toBeNull();
  });

  it("does not mutate frozen source, target or constraints", () => {
    const frozenSource = Object.freeze({
      contacts: Object.freeze([
        Object.freeze({ x: 0, y: 0 }),
        Object.freeze({ x: 2, y: 0 })
      ]),
      normals: Object.freeze([
        Object.freeze({ x: 0, y: -1 }),
        Object.freeze({ x: 0, y: -1 })
      ])
    }) as GripFrame;
    const frozenTarget = Object.freeze({
      contacts: Object.freeze([
        Object.freeze({ x: 3, y: 4 }),
        Object.freeze({ x: 5, y: 4 })
      ]),
      normals: Object.freeze([
        Object.freeze({ x: 0, y: -1 }),
        Object.freeze({ x: 0, y: -1 })
      ])
    }) as GripFrame;
    const frozenConstraints = Object.freeze(constraints());
    const before = JSON.stringify([frozenSource, frozenTarget, frozenConstraints]);

    expect(resolveGripTransform(frozenSource, frozenTarget, frozenConstraints)).not.toBeNull();
    expect(JSON.stringify([frozenSource, frozenTarget, frozenConstraints])).toBe(before);
  });

  it("normalizes very large finite vectors without understating their angular error", () => {
    const largePositive = { x: 1e308, y: Number.MAX_VALUE };
    const largeNegative = { x: 1e308, y: -Number.MAX_VALUE };
    const target: GripFrame = {
      contacts: source.contacts,
      normals: [largeNegative, largeNegative]
    };

    expect(resolveGripTransform({
      contacts: source.contacts,
      normals: [largePositive, largePositive]
    }, target, constraints({ maxNormalErrorDegrees: 100 }))).toBeNull();
  });

  it("accepts exact oblique normal alignment at a zero-degree tolerance", () => {
    const oblique: GripFrame = {
      contacts: source.contacts,
      normals: [{ x: 1, y: 1 }, { x: 1, y: 1 }]
    };

    expect(resolveGripTransform(
      oblique,
      oblique,
      constraints({ maxNormalErrorDegrees: 0 })
    )).not.toBeNull();
  });

  it("accepts distinct finite contacts below an absolute 1e-9 separation", () => {
    const tiny: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: 1e-10, y: 0 }],
      normals: [{ x: 0, y: -1e-10 }, { x: 0, y: -1e-10 }]
    };

    expect(resolveGripTransform(tiny, tiny, constraints())).toMatchObject({ scale: 1 });
  });

  it("accepts an identity transform for equal large finite spans", () => {
    const large: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: Number.MAX_VALUE, y: Number.MAX_VALUE }],
      normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
    };

    expect(resolveGripTransform(large, large, constraints())).toMatchObject({
      scale: 1,
      rotationDegrees: 0,
      mirrored: false
    });
  });

  it("accepts a finite huge grip scale without an overflowing intermediate", () => {
    const exponentUnit = 2 ** 1023;
    const sourceContact = { x: 2 ** -3, y: 2 ** -1 };
    const hugeSource: GripFrame = {
      contacts: [{ x: 0, y: 0 }, sourceContact],
      normals: [{ x: 1, y: 4 }, { x: 1, y: 4 }]
    };
    const hugeTarget: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: exponentUnit, y: 0 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    const result = resolveGripTransform(hugeSource, hugeTarget, constraints({
      minScale: Number.MIN_VALUE,
      maxScale: Number.MAX_VALUE
    }));

    expect(result).not.toBeNull();
    expect(hugeTarget.contacts[1].x / sourceContact.y).toBe(Number.POSITIVE_INFINITY);
    const expectedScale = hugeTarget.contacts[1].x /
      Math.hypot(sourceContact.x, sourceContact.y);
    expect(Math.abs(result!.scale - expectedScale) / expectedScale)
      .toBeLessThanOrEqual(Number.EPSILON * 4);
    expect(Object.values(result!.matrix).every(Number.isFinite)).toBe(true);
    for (let index = 0; index < 2; index += 1) {
      const mapped = applyTransform(result!.matrix, hugeSource.contacts[index]!);
      const target = hugeTarget.contacts[index]!;
      expect(Math.abs(mapped.x - target.x)).toBeLessThanOrEqual(1e-8);
      expect(Math.abs(mapped.y - target.y)).toBeLessThanOrEqual(1e-8);
    }
  });

  it("rejects an extreme transform whose absolute contact residual exceeds 1e-8", () => {
    const offsetSource: GripFrame = {
      contacts: [{ x: 1e16, y: 1e16 }, { x: 1e16 + 2, y: 1e16 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    const offsetTarget: GripFrame = {
      contacts: [{ x: 1e16, y: 1e16 }, { x: 1e16 + 2, y: 1e16 + 2 }],
      normals: [
        { x: Math.SQRT1_2, y: Math.SQRT1_2 },
        { x: Math.SQRT1_2, y: Math.SQRT1_2 }
      ]
    };

    expect(resolveGripTransform(
      offsetSource,
      offsetTarget,
      constraints({ maxNormalErrorDegrees: 1 })
    )).toBeNull();
  });

  it("keeps the tiny rotation across the span-angle branch cut", () => {
    const sourceAcrossCut: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: -1e8, y: -1e-9 }],
      normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
    };
    const targetAcrossCut: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: -1e8, y: 1e-9 }],
      normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
    };

    const result = resolveGripTransform(sourceAcrossCut, targetAcrossCut, constraints());
    expect(result).not.toBeNull();
    expect(result?.mirrored).toBe(false);
    expect(result?.rotationDegrees).toBeCloseTo(0, 10);
    expectPointClose(
      applyTransform(result!.matrix, sourceAcrossCut.contacts[1]),
      targetAcrossCut.contacts[1]
    );
  });

  it("accepts exact rotated normal alignment at a zero-degree tolerance", () => {
    const rotatedSource: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      normals: [{ x: 2, y: 1 }, { x: 2, y: 1 }]
    };
    const rotatedTarget: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      normals: [{ x: -1, y: 2 }, { x: -1, y: 2 }]
    };

    expect(resolveGripTransform(
      rotatedSource,
      rotatedTarget,
      constraints({ maxNormalErrorDegrees: 0 })
    )).toMatchObject({ rotationDegrees: 90, mirrored: false });
  });

  it("does not erase a genuine tiny normal mismatch at zero tolerance", () => {
    const alignedSource: GripFrame = {
      contacts: source.contacts,
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    const mismatchedTarget: GripFrame = {
      contacts: source.contacts,
      normals: [{ x: 1, y: 1e-16 }, { x: 1, y: 1e-16 }]
    };

    expect(resolveGripTransform(
      alignedSource,
      mismatchedTarget,
      constraints({ maxNormalErrorDegrees: 0 })
    )).toBeNull();
  });

  it("does not erase a tiny grip-normal mismatch across the atan2 branch cut", () => {
    const branchSource: GripFrame = {
      contacts: source.contacts,
      normals: [{ x: -1, y: -1e-16 }, { x: -1, y: -1e-16 }]
    };
    const branchTarget: GripFrame = {
      contacts: source.contacts,
      normals: [{ x: -1, y: 1e-16 }, { x: -1, y: 1e-16 }]
    };

    expect(resolveGripTransform(
      branchSource,
      branchTarget,
      constraints({ maxNormalErrorDegrees: 0 })
    )).toBeNull();
  });
});

describe("connector structural fail-closed guards", () => {
  const socket: SocketFrame = {
    point: { x: 0, y: 0 },
    normal: { x: 1, y: 0 },
    referenceScale: 1
  };
  const grip: GripFrame = {
    contacts: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
  };

  it("returns null for null socket/grip frames or constraints", () => {
    expect(resolveSocketTransform(null as never, socket, constraints())).toBeNull();
    expect(resolveSocketTransform(socket, null as never, constraints())).toBeNull();
    expect(resolveSocketTransform(socket, socket, null as never)).toBeNull();
    expect(resolveGripTransform(null as never, grip, constraints())).toBeNull();
    expect(resolveGripTransform(grip, null as never, constraints())).toBeNull();
    expect(resolveGripTransform(grip, grip, null as never)).toBeNull();
  });

  it("rejects grip arrays with anything other than exactly two entries", () => {
    expect(resolveGripTransform({
      ...grip,
      contacts: [...grip.contacts, { x: 2, y: 0 }]
    } as never, grip, constraints())).toBeNull();
    expect(resolveGripTransform({
      ...grip,
      normals: [...grip.normals, { x: 0, y: -1 }]
    } as never, grip, constraints())).toBeNull();
  });

  it.each(["contacts", "normals"] as const)(
    "returns null without throwing for a length-two sparse %s array",
    (field) => {
      const sparse = new Array(2);
      sparse[0] = grip[field][0];
      const malformed = { ...grip, [field]: sparse } as GripFrame;
      const resolve = () => resolveGripTransform(malformed, grip, constraints());

      expect(resolve).not.toThrow();
      expect(resolve()).toBeNull();
    }
  );

  it("rejects signed zero at connector numeric boundaries", () => {
    expect(resolveSocketTransform({
      ...socket,
      point: { x: -0, y: 0 }
    }, socket, constraints())).toBeNull();
    expect(resolveGripTransform({
      ...grip,
      normals: [{ x: -0, y: -1 }, { x: 0, y: -1 }]
    }, grip, constraints())).toBeNull();
    expect(resolveSocketTransform(
      socket,
      socket,
      constraints({ maxNormalErrorDegrees: -0 })
    )).toBeNull();
  });

  it("accepts valid structural frame subtypes carrying parsed mount metadata", () => {
    const socketMount = {
      ...socket,
      id: "pk1-socket-frame",
      slotId: "pk1-lid-slot",
      mountType: "socket" as const,
      constraints: constraints()
    };
    const gripMount = {
      ...grip,
      id: "pk1-grip-frame",
      slotId: "pk1-handle-slot",
      mountType: "grip" as const,
      constraints: constraints()
    };

    expect(resolveSocketTransform(socket, socketMount, constraints())).not.toBeNull();
    expect(resolveGripTransform(grip, gripMount, constraints())).not.toBeNull();
  });

  it("returns null without invoking hostile proxy, accessor, or array methods", () => {
    const proxy = new Proxy({}, {
      get() {
        throw new Error("hostile get trap");
      }
    });
    let accessorReads = 0;
    const accessorFrame = { ...socket } as Record<string, unknown>;
    Object.defineProperty(accessorFrame, "point", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("hostile getter");
      }
    });
    const normals = [...grip.normals];
    Object.defineProperty(normals, "map", {
      value: () => { throw new Error("caller-owned map"); },
      enumerable: false
    });

    const calls = [
      () => resolveSocketTransform(proxy as never, socket, constraints()),
      () => resolveSocketTransform(accessorFrame as never, socket, constraints()),
      () => resolveSocketTransform(Object.create(socket) as never, socket, constraints()),
      () => resolveGripTransform({ ...grip, normals } as never, grip, constraints()),
      () => resolveGripTransform(grip, proxy as never, constraints()),
      () => resolveGripTransform(grip, grip, proxy as never)
    ];
    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
    expect(accessorReads).toBe(0);
  });
});


```

## FILE: web/src/product-kit/grid-placement.test.ts

```typescript
import { describe, expect, it } from "vitest";
import type {
  ProductKitComponent,
  ProductKitMountFrame,
  ProductKitPoint
} from "./product-kit-catalogue";
import {
  createProductKitGridOccupancy,
  snapProductKitGridCell,
  type ProductKitGridTile
} from "./grid-placement";

type GridMountFrame = Extract<ProductKitMountFrame, { readonly mountType: "grid" }>;

function gridFrame(overrides: Partial<GridMountFrame> = {}): GridMountFrame {
  return {
    id: "pk1-grid-frame",
    slotId: "pk1-grid-slot",
    mountType: "grid",
    origin: { x: 0, y: 0 },
    cellSize: { width: 0.25, height: 0.25 },
    columns: 4,
    rows: 4,
    plane: "floor",
    acceptedEdgeTypes: ["pk1-door", "pk1-panel"],
    ...overrides
  };
}

function gridComponent(
  plane: "floor" | "wall" = "floor",
  footprint: { readonly columns: number; readonly rows: number } = {
    columns: 1,
    rows: 1
  },
  edgeTypes: {
    readonly north?: string;
    readonly east?: string;
    readonly south?: string;
    readonly west?: string;
  } = {}
): ProductKitComponent {
  return {
    id: "pk1-grid-component",
    title: "Grid component",
    slotId: "pk1-grid-slot",
    compatibilityProfile: {
      familyId: "pk1-grid-family",
      perspectiveId: "pk1-grid-perspective",
      geometryId: "pk1-grid-geometry",
      styleId: "pk1-grid-style"
    },
    componentFrame: {
      mountType: "grid",
      plane,
      footprint,
      edgeTypes
    },
    fragments: [{
      layer: "front",
      raster: {
        assetId: "asset-grid-component",
        masterSha256: "a".repeat(64),
        frame: {
          originalWidth: 10,
          originalHeight: 10,
          trimX: 0,
          trimY: 0,
          trimWidth: 10,
          trimHeight: 10
        }
      }
    }],
    priceAssetId: "pk1-grid-component-price"
  };
}

function gridTile(
  placementId: string,
  column: number,
  row: number,
  overrides: Partial<ProductKitGridTile> = {}
): ProductKitGridTile {
  return {
    placementId,
    componentId: `pk1-component-${placementId}`,
    column,
    row,
    footprint: { columns: 1, rows: 1 },
    edgeTypes: {},
    ...overrides
  };
}

describe("snapProductKitGridCell", () => {
  it("snaps floor top-left ties east and south", () => {
    const desiredTopLeft: ProductKitPoint = { x: 0.125, y: 0.375 };

    expect(snapProductKitGridCell(
      gridFrame(),
      gridComponent(),
      desiredTopLeft
    )).toEqual({ column: 1, row: 2 });
  });

  it("snaps wall top-left coordinates when the planes match", () => {
    expect(snapProductKitGridCell(
      gridFrame({
        origin: { x: 0.125, y: 0.125 },
        cellSize: { width: 0.125, height: 0.125 },
        plane: "wall"
      }),
      gridComponent("wall"),
      { x: 0.3125, y: 0.1875 }
    )).toEqual({ column: 2, row: 1 });
  });

  it.each(["floor", "wall"] as const)(
    "treats computed decimal half-cells as east/south ties on a %s grid",
    (plane) => {
      const frame = gridFrame({
        origin: { x: 0.1, y: 0.1 },
        cellSize: { width: 0.1, height: 0.1 },
        plane
      });
      const tie = frame.origin.x + frame.cellSize.width * 1.5;

      expect(snapProductKitGridCell(
        frame,
        gridComponent(plane),
        { x: tie, y: tie }
      )).toEqual({ column: 2, row: 2 });
    }
  );

  it("distinguishes the adjacent floats around a computed decimal midpoint", () => {
    const frame = gridFrame({
      origin: { x: 0.1, y: 0.1 },
      cellSize: { width: 0.1, height: 0.1 }
    });
    const tie = frame.origin.x + frame.cellSize.width * 1.5;
    const values = new Float64Array([tie]);
    const bits = new BigUint64Array(values.buffer);
    bits[0] = bits[0]! - 1n;
    const below = values[0]!;
    bits[0] = bits[0]! + 2n;
    const above = values[0]!;

    expect(snapProductKitGridCell(
      frame,
      gridComponent(),
      { x: below, y: below }
    )).toEqual({ column: 1, row: 1 });
    expect(snapProductKitGridCell(
      frame,
      gridComponent(),
      { x: tie, y: tie }
    )).toEqual({ column: 2, row: 2 });
    expect(snapProductKitGridCell(
      frame,
      gridComponent(),
      { x: above, y: above }
    )).toEqual({ column: 2, row: 2 });
  });

  it("rejects a floor and wall plane mismatch", () => {
    expect(snapProductKitGridCell(
      gridFrame({ plane: "wall" }),
      gridComponent("floor"),
      { x: 0, y: 0 }
    )).toBeNull();
  });

  it.each([
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY]
  ])("rejects a non-finite desired top-left (%s, %s)", (x, y) => {
    expect(snapProductKitGridCell(
      gridFrame(),
      gridComponent(),
      { x, y }
    )).toBeNull();
  });

  it("rejects a desired top-left outside the grid before rounding", () => {
    expect(snapProductKitGridCell(
      gridFrame({ origin: { x: 0.25, y: 0.25 }, columns: 2, rows: 2 }),
      gridComponent(),
      { x: 0.24, y: 0.25 }
    )).toBeNull();
  });

  it("rejects a snapped footprint that overflows the grid", () => {
    expect(snapProductKitGridCell(
      gridFrame(),
      gridComponent("floor", { columns: 2, rows: 2 }),
      { x: 0.75, y: 0.75 }
    )).toBeNull();
  });

  it.each([
    ["unsafe frame columns", gridFrame({ columns: Number.MAX_SAFE_INTEGER + 1 }), gridComponent()],
    ["fractional footprint", gridFrame(), gridComponent("floor", { columns: 1.5, rows: 1 })],
    ["zero cell width", gridFrame({ cellSize: { width: 0, height: 0.25 } }), gridComponent()],
    ["grid beyond normalized bounds", gridFrame({
      origin: { x: 0.9, y: 0 },
      cellSize: { width: 0.25, height: 0.25 },
      columns: 1
    }), gridComponent()]
  ])("rejects %s", (_label, frame, component) => {
    expect(snapProductKitGridCell(frame, component, frame.origin)).toBeNull();
  });

  it("returns a frozen cell detached from the desired point", () => {
    const desiredTopLeft = { x: 0, y: 0 };
    const result = snapProductKitGridCell(
      gridFrame(),
      gridComponent(),
      desiredTopLeft
    );

    expect(result).toEqual({ column: 0, row: 0 });
    expect(result).not.toBe(desiredTopLeft);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("returns null rather than invoking hostile snap inputs", () => {
    const proxy = new Proxy({}, {
      get() {
        throw new Error("hostile get trap");
      }
    });
    const inheritedPoint = Object.create({ x: 0.125, y: 0.125 });
    const calls = [
      () => snapProductKitGridCell(proxy as never, gridComponent(), { x: 0, y: 0 }),
      () => snapProductKitGridCell(gridFrame(), proxy as never, { x: 0, y: 0 }),
      () => snapProductKitGridCell(gridFrame(), gridComponent(), proxy as never),
      () => snapProductKitGridCell(gridFrame(), gridComponent(), inheritedPoint)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
  });
});

describe("createProductKitGridOccupancy", () => {
  it("returns row-major cells and deterministic placement order", () => {
    const result = createProductKitGridOccupancy(
      gridFrame({ rows: 3 }),
      [
        gridTile("c", 2, 1, { footprint: { columns: 2, rows: 1 } }),
        gridTile("b", 1, 0),
        gridTile("a", 0, 2)
      ]
    );

    expect(result).toEqual({
      columns: 4,
      rows: 3,
      cells: [
        null, "b", null, null,
        null, null, "c", "c",
        "a", null, null, null
      ],
      placements: [
        gridTile("b", 1, 0),
        gridTile("c", 2, 1, { footprint: { columns: 2, rows: 1 } }),
        gridTile("a", 0, 2)
      ]
    });
  });

  it("rejects duplicate placement IDs even when the tiles do not overlap", () => {
    expect(createProductKitGridOccupancy(gridFrame(), [
      gridTile("duplicate", 0, 0),
      gridTile("duplicate", 3, 3)
    ])).toBeNull();
  });

  it.each([
    ["fractional column", gridTile("bad", 0.5, 0)],
    ["fractional row", gridTile("bad", 0, 0.5)],
    ["unsafe column", gridTile("bad", Number.MAX_SAFE_INTEGER + 1, 0)],
    ["fractional footprint columns", gridTile("bad", 0, 0, {
      footprint: { columns: 1.5, rows: 1 }
    })],
    ["fractional footprint rows", gridTile("bad", 0, 0, {
      footprint: { columns: 1, rows: 1.5 }
    })]
  ])("rejects %s", (_label, placement) => {
    expect(createProductKitGridOccupancy(gridFrame(), [placement])).toBeNull();
  });

  it.each([
    ["negative column", gridTile("bad", -1, 0)],
    ["negative row", gridTile("bad", 0, -1)],
    ["zero footprint", gridTile("bad", 0, 0, {
      footprint: { columns: 0, rows: 1 }
    })],
    ["footprint wider than the frame", gridTile("bad", 0, 0, {
      footprint: { columns: 5, rows: 1 }
    })],
    ["column plus footprint overflow", gridTile("bad", 3, 0, {
      footprint: { columns: 2, rows: 1 }
    })],
    ["row plus footprint overflow", gridTile("bad", 0, 3, {
      footprint: { columns: 1, rows: 2 }
    })]
  ])("rejects out-of-bounds geometry: %s", (_label, placement) => {
    expect(createProductKitGridOccupancy(gridFrame(), [placement])).toBeNull();
  });

  it("rejects overlapping footprints", () => {
    expect(createProductKitGridOccupancy(gridFrame(), [
      gridTile("large", 0, 0, { footprint: { columns: 2, rows: 2 } }),
      gridTile("overlap", 1, 1)
    ])).toBeNull();
  });

  it("accepts a tile only when every declared edge is accepted by the frame", () => {
    expect(createProductKitGridOccupancy(gridFrame(), [
      gridTile("accepted", 1, 1, {
        edgeTypes: {
          north: "pk1-door",
          east: "pk1-panel",
          south: "pk1-door",
          west: "pk1-panel"
        }
      })
    ])).not.toBeNull();

    expect(createProductKitGridOccupancy(gridFrame(), [
      gridTile("rejected", 1, 1, {
        edgeTypes: { east: "pk1-unaccepted" }
      })
    ])).toBeNull();
  });

  it("rejects a non-string declared edge at runtime", () => {
    const malformed = gridTile("malformed", 0, 0, {
      edgeTypes: { north: null as unknown as string }
    });

    expect(createProductKitGridOccupancy(gridFrame(), [malformed])).toBeNull();
  });

  it("rejects unknown edge directions instead of silently dropping them", () => {
    const malformed = gridTile("malformed", 0, 0);
    (malformed.edgeTypes as Record<string, string>).diagonal = "pk1-door";

    expect(createProductKitGridOccupancy(gridFrame(), [malformed])).toBeNull();
  });

  it("rejects an array-shaped edge map instead of normalising it to empty", () => {
    const malformed = gridTile("malformed", 0, 0, {
      edgeTypes: [] as unknown as ProductKitGridTile["edgeTypes"]
    });

    expect(createProductKitGridOccupancy(gridFrame(), [malformed])).toBeNull();
  });

  it("rejects an accepted-edge list that is not sorted and unique", () => {
    expect(createProductKitGridOccupancy(
      gridFrame({ acceptedEdgeTypes: ["pk1-panel", "pk1-door"] }),
      []
    )).toBeNull();
    expect(createProductKitGridOccupancy(
      gridFrame({ acceptedEdgeTypes: ["pk1-door", "pk1-door"] }),
      []
    )).toBeNull();
  });

  it("rejects sparse accepted-edge and placement arrays without throwing", () => {
    const sparseEdges = new Array<string>(2);
    sparseEdges[0] = "pk1-door";
    const sparsePlacements = new Array<ProductKitGridTile>(1);
    const resolveEdges = () => createProductKitGridOccupancy(
      gridFrame({ acceptedEdgeTypes: sparseEdges }),
      []
    );
    const resolvePlacements = () => createProductKitGridOccupancy(
      gridFrame(),
      sparsePlacements
    );

    expect(resolveEdges).not.toThrow();
    expect(resolveEdges()).toBeNull();
    expect(resolvePlacements).not.toThrow();
    expect(resolvePlacements()).toBeNull();
  });

  it("returns null rather than invoking hostile occupancy inputs", () => {
    const proxy = new Proxy({}, {
      get() {
        throw new Error("hostile get trap");
      }
    });
    const placements = [gridTile("one", 0, 0)];
    Object.defineProperty(placements, "sort", {
      value: () => { throw new Error("caller-owned sort"); },
      enumerable: false
    });
    const calls = [
      () => createProductKitGridOccupancy(proxy as never, []),
      () => createProductKitGridOccupancy(gridFrame(), proxy as never),
      () => createProductKitGridOccupancy(gridFrame(), placements)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
  });

  it.each([
    [
      "east/west",
      gridTile("left", 0, 0, { edgeTypes: { east: "pk1-door" } }),
      gridTile("right", 1, 0, { edgeTypes: { west: "pk1-door" } })
    ],
    [
      "south/north",
      gridTile("top", 0, 0, { edgeTypes: { south: "pk1-panel" } }),
      gridTile("bottom", 0, 1, { edgeTypes: { north: "pk1-panel" } })
    ],
    [
      "both absent",
      gridTile("left", 0, 0),
      gridTile("right", 1, 0)
    ],
    [
      "partial rectangle side",
      gridTile("large", 0, 0, {
        footprint: { columns: 2, rows: 2 },
        edgeTypes: { east: "pk1-door" }
      }),
      gridTile("small", 2, 1, { edgeTypes: { west: "pk1-door" } })
    ]
  ])("allows exact %s touching-edge compatibility", (_label, first, second) => {
    expect(createProductKitGridOccupancy(gridFrame(), [first, second])).not.toBeNull();
  });

  it.each([
    [
      "east only",
      gridTile("left", 0, 0, { edgeTypes: { east: "pk1-door" } }),
      gridTile("right", 1, 0)
    ],
    [
      "west only",
      gridTile("left", 0, 0),
      gridTile("right", 1, 0, { edgeTypes: { west: "pk1-door" } })
    ],
    [
      "different east/west edges",
      gridTile("left", 0, 0, { edgeTypes: { east: "pk1-door" } }),
      gridTile("right", 1, 0, { edgeTypes: { west: "pk1-panel" } })
    ],
    [
      "south only",
      gridTile("top", 0, 0, { edgeTypes: { south: "pk1-door" } }),
      gridTile("bottom", 0, 1)
    ],
    [
      "north only",
      gridTile("top", 0, 0),
      gridTile("bottom", 0, 1, { edgeTypes: { north: "pk1-door" } })
    ],
    [
      "different south/north edges",
      gridTile("top", 0, 0, { edgeTypes: { south: "pk1-door" } }),
      gridTile("bottom", 0, 1, { edgeTypes: { north: "pk1-panel" } })
    ]
  ])("rejects touching rectangles with %s", (_label, first, second) => {
    expect(createProductKitGridOccupancy(gridFrame(), [first, second])).toBeNull();
  });

  it("does not impose edge compatibility on diagonal contact", () => {
    expect(createProductKitGridOccupancy(gridFrame(), [
      gridTile("north-west", 0, 0, {
        edgeTypes: { east: "pk1-door", south: "pk1-door" }
      }),
      gridTile("south-east", 1, 1, {
        edgeTypes: { north: "pk1-panel", west: "pk1-panel" }
      })
    ])).not.toBeNull();
  });

  it("does not invent an outer-boundary edge rule", () => {
    expect(createProductKitGridOccupancy(
      gridFrame({ columns: 2, rows: 2 }),
      [gridTile("boundary", 0, 0, {
        footprint: { columns: 2, rows: 2 },
        edgeTypes: {
          north: "pk1-door",
          east: "pk1-door",
          south: "pk1-door",
          west: "pk1-door"
        }
      })]
    )).not.toBeNull();
  });

  it("returns a detached deeply frozen occupancy without mutating input order", () => {
    const late = gridTile("late", 2, 2);
    const early = gridTile("early", 0, 0, {
      edgeTypes: { north: "pk1-door" }
    });
    const input: ProductKitGridTile[] = [late, early];

    const result = createProductKitGridOccupancy(gridFrame(), input);

    expect(result).not.toBeNull();
    expect(input.map(({ placementId }) => placementId)).toEqual(["late", "early"]);
    expect(result!.placements.map(({ placementId }) => placementId)).toEqual([
      "early",
      "late"
    ]);
    expect(result!.placements).not.toBe(input);
    expect(result!.placements[0]).not.toBe(early);
    expect(result!.placements[0]!.footprint).not.toBe(early.footprint);
    expect(result!.placements[0]!.edgeTypes).not.toBe(early.edgeTypes);

    (early as { placementId: string }).placementId = "mutated";
    (early.footprint as { columns: number }).columns = 3;
    (early.edgeTypes as { north?: string }).north = "pk1-panel";
    expect(result!.placements[0]).toMatchObject({
      placementId: "early",
      footprint: { columns: 1, rows: 1 },
      edgeTypes: { north: "pk1-door" }
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result!.cells)).toBe(true);
    expect(Object.isFrozen(result!.placements)).toBe(true);
    expect(Object.isFrozen(result!.placements[0])).toBe(true);
    expect(Object.isFrozen(result!.placements[0]!.footprint)).toBe(true);
    expect(Object.isFrozen(result!.placements[0]!.edgeTypes)).toBe(true);
  });

  it("is deterministic across placement input order", () => {
    const first = gridTile("first", 0, 0);
    const second = gridTile("second", 2, 2);

    expect(createProductKitGridOccupancy(gridFrame(), [first, second])).toEqual(
      createProductKitGridOccupancy(gridFrame(), [second, first])
    );
  });
});


```

## FILE: web/src/product-kit/layer-plan.test.ts

```typescript
import { describe, expect, it } from "vitest";
import type {
  ProductKitAssetReference,
  ProductKitComponent,
  ProductKitKit
} from "./product-kit-catalogue";
import {
  PRODUCT_KIT_LAYER_ORDER,
  createProductKitLayerPlan,
  type ProductKitResolvedPlacement
} from "./layer-plan";

const hash = (character: string) => character.repeat(64);
const raster = (assetId: string, character: string): ProductKitAssetReference => ({
  assetId,
  masterSha256: hash(character),
  frame: {
    originalWidth: 100,
    originalHeight: 100,
    trimX: 0,
    trimY: 0,
    trimWidth: 100,
    trimHeight: 100
  }
});
const profile = {
  familyId: "pk1-drinkware",
  perspectiveId: "pk1-front-view",
  geometryId: "pk1-cup-medium",
  styleId: "pk1-clean-outline"
} as const;

const kit = (): ProductKitKit => ({
  id: "pk1-cup-kit",
  title: "Cup",
  mode: "grip",
  compatibilityProfile: profile,
  base: raster("cup-base", "a"),
  priceAssetId: "pk1-price-cup",
  mountFrames: [],
  artworkBounds: [
    { x: 0.2, y: 0.2, width: 0.5, height: 0.4 },
    { x: 0.3, y: 0.65, width: 0.3, height: 0.15 }
  ]
});

const handle = (): ProductKitComponent => ({
  id: "pk1-loop-handle",
  title: "Loop handle",
  slotId: "pk1-handle-slot",
  compatibilityProfile: profile,
  componentFrame: {
    mountType: "grip",
    contacts: [{ x: 0, y: 0.2 }, { x: 0, y: 0.8 }],
    normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
  },
  fragments: [
    { layer: "rear", raster: raster("handle-rear", "b") },
    { layer: "front", raster: raster("handle-front", "c") }
  ],
  priceAssetId: "pk1-price-loop-handle"
});

const gridComponent = (): ProductKitComponent => ({
  id: "pk1-patio-tile",
  title: "Patio tile",
  slotId: "pk1-patio-slot",
  compatibilityProfile: profile,
  componentFrame: {
    mountType: "grid",
    plane: "floor",
    footprint: { columns: 1, rows: 1 },
    edgeTypes: {}
  },
  fragments: [{ layer: "overlay", raster: raster("patio-tile", "d") }],
  priceAssetId: "pk1-price-patio-tile"
});

const transform = {
  matrix: { a: 1, b: 0, c: 0, d: 1, e: 0.2, f: 0.1 },
  scale: 1,
  rotationDegrees: 0,
  mirrored: false,
  maxNormalErrorDegrees: 0
} as const;

const affinePlacement = (): Extract<ProductKitResolvedPlacement, { kind: "affine" }> => ({
  kind: "affine",
  placementId: "placement-handle",
  mountFrameId: "pk1-handle-frame",
  component: handle(),
  transform
});

describe("product-kit layer planning", () => {
  it("always emits the exact five buckets with one body and artwork slots", () => {
    const result = createProductKitLayerPlan(kit(), []);

    expect(result?.layers.map(({ layer }) => layer)).toEqual(PRODUCT_KIT_LAYER_ORDER);
    expect(result?.layers.map(({ entries }) => entries.length)).toEqual([0, 1, 0, 2, 0]);
    expect(result?.layers[1]?.entries[0]).toMatchObject({
      kind: "base-raster",
      itemId: "base:pk1-cup-kit",
      raster: { assetId: "cup-base" }
    });
    expect(result?.layers[3]?.entries.map(({ kind }) => kind)).toEqual([
      "artwork-slot",
      "artwork-slot"
    ]);
    expect(result?.pricedItems).toEqual([{
      kind: "base",
      itemId: "base:pk1-cup-kit",
      priceAssetId: "pk1-price-cup"
    }]);
  });

  it("renders a split handle twice but prices its logical placement once", () => {
    const result = createProductKitLayerPlan(kit(), [affinePlacement()]);

    expect(result?.layers[0]?.entries).toHaveLength(1);
    expect(result?.layers[2]?.entries).toHaveLength(1);
    expect(result?.layers[0]?.entries[0]).toMatchObject({
      kind: "component-raster",
      placementId: "placement-handle",
      componentId: "pk1-loop-handle",
      raster: { assetId: "handle-rear" },
      geometry: { kind: "affine", transform }
    });
    expect(result?.pricedItems).toEqual([
      {
        kind: "base",
        itemId: "base:pk1-cup-kit",
        priceAssetId: "pk1-price-cup"
      },
      {
        kind: "component",
        itemId: "placement:placement-handle",
        placementId: "placement-handle",
        componentId: "pk1-loop-handle",
        priceAssetId: "pk1-price-loop-handle"
      }
    ]);
  });

  it("orders repeated grid instances by row, column and ID and prices each one", () => {
    const component = gridComponent();
    const placements: ProductKitResolvedPlacement[] = [
      {
        kind: "grid",
        placementId: "placement-z",
        mountFrameId: "pk1-patio-grid",
        component,
        column: 2,
        row: 1,
        normalizedBounds: { x: 0.5, y: 0.25, width: 0.25, height: 0.25 }
      },
      {
        kind: "grid",
        placementId: "placement-a",
        mountFrameId: "pk1-patio-grid",
        component,
        column: 0,
        row: 0,
        normalizedBounds: { x: 0, y: 0, width: 0.25, height: 0.25 }
      }
    ];

    const result = createProductKitLayerPlan({ ...kit(), mode: "grid" }, placements);

    expect(result?.layers[4]?.entries.map((entry) =>
      entry.kind === "component-raster" ? entry.placementId : null
    )).toEqual(["placement-a", "placement-z"]);
    expect(result?.pricedItems.slice(1).map(({ itemId }) => itemId)).toEqual([
      "placement:placement-a",
      "placement:placement-z"
    ]);
    expect(placements[0]?.placementId).toBe("placement-z");
  });

  it("rejects duplicate placement IDs and malformed resolved geometry", () => {
    const first = affinePlacement();
    expect(createProductKitLayerPlan(kit(), [first, { ...first }])).toBeNull();
    expect(createProductKitLayerPlan(kit(), [{
      ...first,
      placementId: "placement-bad",
      transform: { ...transform, scale: Number.NaN }
    }])).toBeNull();
    expect(createProductKitLayerPlan({ ...kit(), mode: "grid" }, [{
      kind: "grid",
      placementId: "placement-bad-grid",
      mountFrameId: "pk1-patio-grid",
      component: gridComponent(),
      column: -1,
      row: 0,
      normalizedBounds: { x: 0, y: 0, width: 0.25, height: 0.25 }
    }])).toBeNull();
  });

  it("fails closed for null or unknown placement discriminants", () => {
    expect(createProductKitLayerPlan(null as never, [])).toBeNull();
    expect(createProductKitLayerPlan(kit(), [null] as never)).toBeNull();
    expect(createProductKitLayerPlan({ ...kit(), mode: "grid" }, [{
      kind: "bogus",
      placementId: "placement-bogus",
      mountFrameId: "pk1-patio-grid",
      component: gridComponent(),
      column: 0,
      row: 0,
      normalizedBounds: { x: 0, y: 0, width: 0.25, height: 0.25 }
    }] as never)).toBeNull();
  });

  it("returns null without throwing for sparse placement and nested arrays", () => {
    const sparsePlacements = new Array<ProductKitResolvedPlacement>(1);
    const sparseArtwork = new Array<ProductKitKit["artworkBounds"][number]>(1);
    const placement = affinePlacement();
    const sparseFragments = new Array<ProductKitComponent["fragments"][number]>(1);
    const resolvePlacements = () => createProductKitLayerPlan(kit(), sparsePlacements);
    const resolveArtwork = () => createProductKitLayerPlan({
      ...kit(),
      artworkBounds: sparseArtwork
    }, []);
    const resolveFragments = () => createProductKitLayerPlan(kit(), [{
      ...placement,
      component: { ...placement.component, fragments: sparseFragments }
    }]);

    expect(resolvePlacements).not.toThrow();
    expect(resolvePlacements()).toBeNull();
    expect(resolveArtwork).not.toThrow();
    expect(resolveArtwork()).toBeNull();
    expect(resolveFragments).not.toThrow();
    expect(resolveFragments()).toBeNull();
  });

  it("rejects signed zero in layer-plan geometry", () => {
    expect(createProductKitLayerPlan(kit(), [{
      ...affinePlacement(),
      transform: {
        ...transform,
        matrix: { ...transform.matrix, e: -0 }
      }
    }])).toBeNull();
    expect(createProductKitLayerPlan({ ...kit(), mode: "grid" }, [{
      kind: "grid",
      placementId: "placement-signed-zero",
      mountFrameId: "pk1-patio-grid",
      component: gridComponent(),
      column: -0,
      row: 0,
      normalizedBounds: { x: 0, y: 0, width: 0.25, height: 0.25 }
    }])).toBeNull();
  });

  it("rejects malformed raster, artwork and fragment records without normalising", () => {
    expect(createProductKitLayerPlan({
      ...kit(),
      base: {} as ProductKitAssetReference
    }, [])).toBeNull();
    expect(createProductKitLayerPlan({
      ...kit(),
      artworkBounds: [null] as never
    }, [])).toBeNull();

    const placement = affinePlacement();
    const malformedComponent = {
      ...placement.component,
      fragments: [{ layer: "front", raster: {} }]
    } as unknown as ProductKitComponent;
    expect(createProductKitLayerPlan(kit(), [{
      ...placement,
      component: malformedComponent
    }])).toBeNull();
  });

  it("keeps the authoritative layer order frozen at runtime", () => {
    expect(Object.isFrozen(PRODUCT_KIT_LAYER_ORDER)).toBe(true);
    expect(() => (
      PRODUCT_KIT_LAYER_ORDER as unknown as string[]
    ).reverse()).toThrow(TypeError);
    expect(createProductKitLayerPlan(kit(), [])?.layers.map(({ layer }) => layer))
      .toEqual(["rear", "body", "front", "artwork", "overlay"]);
  });

  it("returns null rather than invoking hostile planning inputs", () => {
    const proxy = new Proxy({}, {
      get() {
        throw new Error("hostile get trap");
      }
    });
    const placements = [affinePlacement()];
    Object.defineProperty(placements, "sort", {
      value: () => { throw new Error("caller-owned sort"); },
      enumerable: false
    });
    let accessorReads = 0;
    const accessorKit = kit() as unknown as Record<string, unknown>;
    Object.defineProperty(accessorKit, "base", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("hostile getter");
      }
    });
    const calls = [
      () => createProductKitLayerPlan(proxy as never, []),
      () => createProductKitLayerPlan(kit(), proxy as never),
      () => createProductKitLayerPlan(Object.create(kit()), []),
      () => createProductKitLayerPlan(accessorKit as never, []),
      () => createProductKitLayerPlan(kit(), placements)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
    expect(accessorReads).toBe(0);
  });

  it("returns a detached deeply frozen plan without freezing caller values", () => {
    const mutableKit = kit() as ProductKitKit;
    const placement = affinePlacement();
    const result = createProductKitLayerPlan(mutableKit, [placement]);

    expect(Object.isFrozen(mutableKit)).toBe(false);
    expect(Object.isFrozen(placement)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.layers)).toBe(true);
    expect(Object.isFrozen(result?.layers[0]?.entries[0])).toBe(true);
    expect(Object.isFrozen(result?.pricedItems)).toBe(true);
  });
});


```

## FILE: web/src/product-kit/plain-data.test.ts

```typescript
import { describe, expect, it } from "vitest";
import { snapshotPlainData } from "./plain-data";

function throwingProxy(): object {
  return new Proxy({}, {
    ownKeys() {
      throw new Error("hostile ownKeys trap");
    }
  });
}

describe("product-kit plain-data snapshot", () => {
  it("detaches ordinary frozen data without losing signed zero", () => {
    const input = Object.freeze({
      values: Object.freeze([-0, 1, "two", true, null]),
      nested: Object.freeze({ value: 3 })
    });

    const snapshot = snapshotPlainData(input);

    expect(snapshot).toEqual(input);
    expect(snapshot).not.toBe(input);
    expect(snapshot?.values).not.toBe(input.values);
    expect(Object.is(snapshot?.values[0], -0)).toBe(true);
    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(snapshot?.values)).toBe(Array.prototype);
  });

  it.each([
    ["an object with inherited data", () => Object.create({ required: 1 })],
    ["a null-prototype object", () => Object.assign(Object.create(null), { required: 1 })],
    ["a class instance", () => new (class Data { required = 1; })()],
    ["a symbol-keyed object", () => ({ required: 1, [Symbol("extra")]: true })],
    ["a sparse array", () => {
      const value = new Array(2);
      value[0] = 1;
      return value;
    }],
    ["an array with an extra own property", () => Object.assign([1, 2], { extra: true })],
    ["an array with a caller-owned method override", () => {
      const value = [1, 2];
      Object.defineProperty(value, "map", { value: () => [], enumerable: false });
      return value;
    }],
    ["an array with a nonstandard prototype", () => {
      const value = [1, 2];
      Object.setPrototypeOf(value, Object.create(Array.prototype));
      return value;
    }]
  ])("rejects %s", (_label, createValue) => {
    expect(snapshotPlainData(createValue())).toBeNull();
  });

  it("rejects accessors without invoking them", () => {
    let reads = 0;
    const value = {};
    Object.defineProperty(value, "required", {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("getter must not run");
      }
    });

    expect(snapshotPlainData(value)).toBeNull();
    expect(reads).toBe(0);
  });

  it("rejects accessor-based limits without invoking them", () => {
    let reads = 0;
    const limits = {};
    Object.defineProperty(limits, "maxDepth", {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("limit getter must not run");
      }
    });

    expect(snapshotPlainData({ value: 1 }, limits)).toBeNull();
    expect(reads).toBe(0);
  });

  it("returns null rather than throwing for throwing and revoked proxies", () => {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(() => snapshotPlainData(throwingProxy())).not.toThrow();
    expect(snapshotPlainData(throwingProxy())).toBeNull();
    expect(() => snapshotPlainData(revocable.proxy)).not.toThrow();
    expect(snapshotPlainData(revocable.proxy)).toBeNull();
  });

  it("rejects cycles and enforces traversal bounds", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expect(snapshotPlainData(cyclic)).toBeNull();
    expect(snapshotPlainData([1, 2, 3], { maxArrayLength: 2 })).toBeNull();
    expect(snapshotPlainData({ one: 1, two: 2 }, { maxObjectProperties: 1 })).toBeNull();
    expect(snapshotPlainData({ child: { value: 1 } }, { maxDepth: 0 })).toBeNull();
    expect(snapshotPlainData({ one: 1, two: 2 }, { maxNodes: 2 })).toBeNull();
  });

  it("reapplies limits and detaches an earlier snapshot", () => {
    const first = snapshotPlainData({ child: { value: 1 } });
    expect(first).not.toBeNull();

    const second = snapshotPlainData(first);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second?.child).not.toBe(first?.child);
    expect(snapshotPlainData(first, { maxDepth: 0 })).toBeNull();
    expect(snapshotPlainData(first, { maxNodes: 1 })).toBeNull();
  });
});


```

## FILE: web/src/product-kit/product-kit-catalogue.test.ts

```typescript
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  parseProductKitCatalogue,
  type ProductKitCatalogueContext,
  type ProductKitPoint
} from "./product-kit-catalogue";

const CATALOGUE_SHA = "f".repeat(64);
const HASHES = {
  gridBase: "a".repeat(64),
  gridPart: "b".repeat(64),
  gripBase: "c".repeat(64),
  gripFront: "d".repeat(64),
  gripRear: "e".repeat(64),
  socketBase: "1".repeat(64),
  socketPart: "2".repeat(64),
  wholeBase: "3".repeat(64)
} as const;

const FRAME = {
  originalWidth: 100,
  originalHeight: 100,
  trimX: 0,
  trimY: 0,
  trimWidth: 100,
  trimHeight: 100
} as const;

const CONSTRAINTS = {
  minScale: 0.5,
  maxScale: 2,
  minRotationDegrees: -45,
  maxRotationDegrees: 45,
  maxNormalErrorDegrees: 5,
  mirrorAllowed: false
} as const;

const asset = (id: string, masterSha256: string, kind = "raster-master") => ({
  id,
  masterSha256,
  delivery: "offline" as const,
  kind,
  files: {
    master: `/catalog/generated/offline-core-v1/assets/${id}/master.png`
  },
  dimensions: { width: 100, height: 100 },
  classroomReviewed: true,
  brandFree: true
});

const contextFixture = (): ProductKitCatalogueContext => ({
  catalogPackId: "offline-core-v1",
  catalogSha256: CATALOGUE_SHA,
  records: [
    asset("asset-grid-base", HASHES.gridBase),
    asset("asset-grid-part", HASHES.gridPart, "component"),
    asset("asset-grip-base", HASHES.gripBase),
    asset("asset-grip-front", HASHES.gripFront, "component"),
    asset("asset-grip-rear", HASHES.gripRear, "component"),
    asset("asset-socket-base", HASHES.socketBase),
    asset("asset-socket-part", HASHES.socketPart, "component"),
    asset("asset-whole-base", HASHES.wholeBase)
  ]
});

const raster = (assetId: string, masterSha256: string) => ({
  assetId,
  masterSha256,
  frame: { ...FRAME }
});

const profile = (familyId: string, geometryId: string) => ({
  familyId,
  perspectiveId: "pk1-front-view",
  geometryId,
  styleId: "pk1-outline-clean"
});

const fixture = () => ({
  schema: "product-kit@1",
  version: 1,
  packId: "pk1-pilot",
  catalogPackId: "offline-core-v1",
  catalogSha256: CATALOGUE_SHA,
  pricingVersion: "product-pricing@1",
  connectorFormulaVersion: "product-kit-connectors@1",
  kits: [
    {
      id: "pk1-grid-kit",
      title: "Escape Room Wall",
      mode: "grid",
      compatibilityProfile: profile("pk1-escape-room", "pk1-wall-grid"),
      base: raster("asset-grid-base", HASHES.gridBase),
      priceAssetId: "pk1-price-grid-base",
      mountFrames: [{
        id: "pk1-grid-frame",
        slotId: "pk1-grid-slot",
        mountType: "grid",
        origin: { x: 0.1, y: 0.1 },
        cellSize: { width: 0.1, height: 0.1 },
        columns: 8,
        rows: 6,
        plane: "wall",
        acceptedEdgeTypes: ["pk1-door", "pk1-panel"]
      }],
      artworkBounds: []
    },
    {
      id: "pk1-grip-kit",
      title: "Reusable Cup",
      mode: "grip",
      compatibilityProfile: profile("pk1-drinkware", "pk1-cup-handle"),
      base: raster("asset-grip-base", HASHES.gripBase),
      priceAssetId: "pk1-price-grip-base",
      mountFrames: [{
        id: "pk1-grip-frame",
        slotId: "pk1-handle-slot",
        mountType: "grip",
        contacts: [{ x: 0.82, y: 0.35 }, { x: 0.82, y: 0.7 }],
        normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }],
        constraints: { ...CONSTRAINTS, mirrorAllowed: true }
      }],
      artworkBounds: [{ x: 0.25, y: 0.25, width: 0.45, height: 0.5 }]
    },
    {
      id: "pk1-socket-kit",
      title: "Travel Bottle",
      mode: "socket",
      compatibilityProfile: profile("pk1-drinkware", "pk1-bottle-lid"),
      base: raster("asset-socket-base", HASHES.socketBase),
      priceAssetId: "pk1-price-socket-base",
      mountFrames: [{
        id: "pk1-socket-frame",
        slotId: "pk1-lid-slot",
        mountType: "socket",
        point: { x: 0.5, y: 0.08 },
        normal: { x: 0, y: -1 },
        referenceScale: 0.22,
        constraints: { ...CONSTRAINTS }
      }],
      artworkBounds: [{ x: 0.2, y: 0.3, width: 0.6, height: 0.45 }]
    },
    {
      id: "pk1-whole-kit",
      title: "Complete Mug",
      mode: "whole",
      compatibilityProfile: profile("pk1-drinkware", "pk1-complete-mug"),
      base: raster("asset-whole-base", HASHES.wholeBase),
      priceAssetId: "pk1-price-whole-base",
      mountFrames: [],
      artworkBounds: [{ x: 0.25, y: 0.25, width: 0.45, height: 0.5 }]
    }
  ],
  components: [
    {
      id: "pk1-grid-component",
      title: "Secret Door",
      slotId: "pk1-grid-slot",
      compatibilityProfile: profile("pk1-escape-room", "pk1-wall-grid"),
      componentFrame: {
        mountType: "grid",
        plane: "wall",
        footprint: { columns: 2, rows: 3 },
        edgeTypes: { north: "pk1-panel", south: "pk1-door" }
      },
      fragments: [{
        layer: "front",
        raster: raster("asset-grid-part", HASHES.gridPart)
      }],
      priceAssetId: "pk1-price-secret-door"
    },
    {
      id: "pk1-grip-component",
      title: "Loop Handle",
      slotId: "pk1-handle-slot",
      compatibilityProfile: profile("pk1-drinkware", "pk1-cup-handle"),
      componentFrame: {
        mountType: "grip",
        contacts: [{ x: 0.18, y: 0.25 }, { x: 0.18, y: 0.75 }],
        normals: [{ x: -1, y: 0 }, { x: -1, y: 0 }]
      },
      fragments: [
        { layer: "rear", raster: raster("asset-grip-rear", HASHES.gripRear) },
        { layer: "front", raster: raster("asset-grip-front", HASHES.gripFront) }
      ],
      priceAssetId: "pk1-price-loop-handle"
    },
    {
      id: "pk1-socket-component",
      title: "Flip Lid",
      slotId: "pk1-lid-slot",
      compatibilityProfile: profile("pk1-drinkware", "pk1-bottle-lid"),
      componentFrame: {
        mountType: "socket",
        point: { x: 0.5, y: 0.9 },
        normal: { x: 0, y: -1 },
        referenceScale: 0.2
      },
      fragments: [{
        layer: "front",
        raster: raster("asset-socket-part", HASHES.socketPart)
      }],
      priceAssetId: "pk1-price-flip-lid"
    }
  ],
  certifications: [
    {
      id: "pk1-cert-grid",
      kitId: "pk1-grid-kit",
      mountFrameId: "pk1-grid-frame",
      componentId: "pk1-grid-component",
      fingerprint: "4".repeat(64)
    },
    {
      id: "pk1-cert-grip",
      kitId: "pk1-grip-kit",
      mountFrameId: "pk1-grip-frame",
      componentId: "pk1-grip-component",
      fingerprint: "5".repeat(64)
    },
    {
      id: "pk1-cert-socket",
      kitId: "pk1-socket-kit",
      mountFrameId: "pk1-socket-frame",
      componentId: "pk1-socket-component",
      fingerprint: "6".repeat(64)
    }
  ]
});

function isDeeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((item) => isDeeplyFrozen(item, seen));
}

type MutableRecord = Record<string, unknown>;
const rows = (value: MutableRecord, key: string): MutableRecord[] =>
  value[key] as MutableRecord[];

describe("product-kit catalogue parser", () => {
  it("accepts all four modes, preserves one logical split component, and freezes only its clone", () => {
    const value = fixture();
    const context = contextFixture();
    const before = JSON.stringify({ value, context });

    const parsed = parseProductKitCatalogue(value, context);

    expect(parsed).not.toBeNull();
    expect(parsed?.kits.map(({ mode }) => mode)).toEqual(["grid", "grip", "socket", "whole"]);
    expect(parsed?.components[1]).toMatchObject({
      id: "pk1-grip-component",
      priceAssetId: "pk1-price-loop-handle"
    });
    expect(parsed?.components[1]?.fragments.map(({ layer }) => layer)).toEqual(["rear", "front"]);
    expect(isDeeplyFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(value)).toBe(false);
    expect(Object.isFrozen(value.kits[0])).toBe(false);
    expect(Object.isFrozen(context)).toBe(false);
    expect(Object.isFrozen(context.records[0])).toBe(false);
    expect(JSON.stringify({ value, context })).toBe(before);

    const gripFrame = parsed?.components[1]?.componentFrame;
    expect(gripFrame?.mountType).toBe("grip");
    if (gripFrame?.mountType === "grip") {
      expectTypeOf(gripFrame.contacts).toEqualTypeOf<
        readonly [ProductKitPoint, ProductKitPoint]
      >();
      expectTypeOf(gripFrame.normals).toEqualTypeOf<
        readonly [ProductKitPoint, ProductKitPoint]
      >();
    }
  });

  it.each([
    ["top-level extras", (value: MutableRecord) => { value.extra = true; }],
    ["unsorted kit IDs", (value: MutableRecord) => { rows(value, "kits").reverse(); }],
    ["whole kit frames", (value: MutableRecord) => {
      rows(value, "kits")[3]!.mountFrames = structuredClone(rows(value, "kits")[2]!.mountFrames);
    }],
    ["structural mode/frame mismatch", (value: MutableRecord) => {
      rows(value, "kits")[1]!.mode = "socket";
    }],
    ["duplicate mount-frame IDs", (value: MutableRecord) => {
      const frames = rows(value, "kits")[1]!.mountFrames as MutableRecord[];
      frames.push(structuredClone(frames[0]!));
    }],
    ["mount-frame ID reused by another kit", (value: MutableRecord) => {
      const reusedId = (rows(value, "kits")[1]!.mountFrames as MutableRecord[])[0]!.id;
      ((rows(value, "kits")[2]!.mountFrames as MutableRecord[])[0]!).id = reusedId;
      rows(value, "certifications")[2]!.mountFrameId = reusedId;
    }],
    ["unknown certified kit", (value: MutableRecord) => {
      rows(value, "certifications")[0]!.kitId = "pk1-missing-kit";
    }],
    ["unknown certified frame", (value: MutableRecord) => {
      rows(value, "certifications")[0]!.mountFrameId = "pk1-missing-frame";
    }],
    ["unknown certified component", (value: MutableRecord) => {
      rows(value, "certifications")[0]!.componentId = "pk1-missing-component";
    }],
    ["duplicate certified pair", (value: MutableRecord) => {
      const duplicate = structuredClone(rows(value, "certifications")[0]!);
      duplicate.id = "pk1-cert-grid-copy";
      rows(value, "certifications").splice(1, 0, duplicate);
    }],
    ["mismatched slot", (value: MutableRecord) => {
      rows(value, "components")[0]!.slotId = "pk1-other-slot";
    }],
    ["mismatched compatibility profile", (value: MutableRecord) => {
      (rows(value, "components")[1]!.compatibilityProfile as MutableRecord).styleId = "pk1-other-style";
    }],
    ["mismatched component frame type", (value: MutableRecord) => {
      rows(value, "components")[2]!.componentFrame = structuredClone(
        rows(value, "components")[1]!.componentFrame
      );
    }],
    ["socket geometry outside certified scale limits", (value: MutableRecord) => {
      const frame = rows(value, "components")[2]!.componentFrame as MutableRecord;
      frame.referenceScale = 0.01;
    }],
    ["grip geometry outside certified scale limits", (value: MutableRecord) => {
      const frame = rows(value, "components")[1]!.componentFrame as MutableRecord;
      frame.contacts = [{ x: 0.18, y: 0.25 }, { x: 0.18, y: 0.3 }];
    }],
    ["grid edge type outside the certified surface", (value: MutableRecord) => {
      const frame = rows(value, "components")[0]!.componentFrame as MutableRecord;
      frame.edgeTypes = { north: "pk1-unsupported-edge" };
    }],
    ["grid footprint larger than the certified surface", (value: MutableRecord) => {
      const frame = rows(value, "components")[0]!.componentFrame as MutableRecord;
      frame.footprint = { columns: 9, rows: 3 };
    }],
    ["out-of-order component layers", (value: MutableRecord) => {
      (rows(value, "components")[1]!.fragments as MutableRecord[]).reverse();
    }],
    ["duplicate component layers", (value: MutableRecord) => {
      const fragments = rows(value, "components")[1]!.fragments as MutableRecord[];
      fragments[1]!.layer = "rear";
    }],
    ["unsorted component IDs", (value: MutableRecord) => {
      rows(value, "components").reverse();
    }],
    ["duplicate component IDs", (value: MutableRecord) => {
      rows(value, "components")[1]!.id = rows(value, "components")[0]!.id;
    }],
    ["unsorted certification IDs", (value: MutableRecord) => {
      rows(value, "certifications").reverse();
    }],
    ["duplicate certification IDs", (value: MutableRecord) => {
      rows(value, "certifications")[1]!.id = rows(value, "certifications")[0]!.id;
    }],
    ["unsorted grid edge types", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[0]!.mountFrames as MutableRecord[])[0]!;
      (frame.acceptedEdgeTypes as string[]).reverse();
    }],
    ["nested frame extras", (value: MutableRecord) => {
      ((rows(value, "kits")[1]!.mountFrames as MutableRecord[])[0]!).extra = true;
    }],
    ["zero normal", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[2]!.mountFrames as MutableRecord[])[0]!;
      frame.normal = { x: 0, y: 0 };
    }],
    ["grid outside the design rectangle", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[0]!.mountFrames as MutableRecord[])[0]!;
      frame.cellSize = { width: 0.2, height: 0.1 };
    }],
    ["trim rectangle outside original dimensions", (value: MutableRecord) => {
      const frame = ((rows(value, "kits")[0]!.base as MutableRecord).frame) as MutableRecord;
      frame.originalWidth = 99;
    }]
  ])("rejects %s", (_label, mutate) => {
    const value = fixture() as unknown as MutableRecord;
    mutate(value);
    expect(parseProductKitCatalogue(value, contextFixture())).toBeNull();
  });

  it.each(["familyId", "perspectiveId", "geometryId", "styleId"])(
    "rejects a certified %s mismatch",
    (profileKey) => {
      const value = fixture() as unknown as MutableRecord;
      const profileValue = rows(value, "components")[1]!.compatibilityProfile as MutableRecord;
      profileValue[profileKey] = `pk1-other-${profileKey.toLowerCase()}`;

      expect(parseProductKitCatalogue(value, contextFixture())).toBeNull();
    }
  );

  it.each([
    ["point coordinate", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[0]!.mountFrames as MutableRecord[])[0]!;
      (frame.origin as MutableRecord).x = -0;
    }],
    ["normal coordinate", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[2]!.mountFrames as MutableRecord[])[0]!;
      (frame.normal as MutableRecord).x = -0;
    }],
    ["constraint boundary", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[2]!.mountFrames as MutableRecord[])[0]!;
      (frame.constraints as MutableRecord).maxNormalErrorDegrees = -0;
    }],
    ["integer trim offset", (value: MutableRecord) => {
      const frame = ((rows(value, "kits")[0]!.base as MutableRecord).frame) as MutableRecord;
      frame.trimX = -0;
    }]
  ])("rejects signed zero in a %s", (_label, mutate) => {
    const value = fixture() as unknown as MutableRecord;
    mutate(value);

    expect(parseProductKitCatalogue(value, contextFixture())).toBeNull();
  });

  it.each([
    ["product-kit ID", (value: MutableRecord) => {
      value.packId = "pk1-pilot\n";
    }],
    ["SHA-256", (value: MutableRecord) => {
      value.catalogSha256 = `${CATALOGUE_SHA}\n`;
    }]
  ])("rejects a terminal LF in a %s", (_label, mutate) => {
    const value = fixture() as unknown as MutableRecord;
    mutate(value);

    expect(parseProductKitCatalogue(value, contextFixture())).toBeNull();
  });

  it.each([
    ["wrong catalogue pack", (_value: MutableRecord, context: MutableRecord) => {
      context.catalogPackId = "another-pack";
    }],
    ["wrong catalogue hash", (_value: MutableRecord, context: MutableRecord) => {
      context.catalogSha256 = "0".repeat(64);
    }],
    ["unknown raster asset", (value: MutableRecord) => {
      ((rows(value, "kits")[0]!.base as MutableRecord).assetId) = "asset-missing";
    }],
    ["stale raster hash", (value: MutableRecord) => {
      ((rows(value, "kits")[0]!.base as MutableRecord).masterSha256) = "0".repeat(64);
    }],
    ["unreviewed raster", (_value: MutableRecord, context: MutableRecord) => {
      (rows(context, "records")[0]!).classroomReviewed = false;
    }],
    ["branded raster", (_value: MutableRecord, context: MutableRecord) => {
      (rows(context, "records")[0]!).brandFree = false;
    }],
    ["non-offline raster", (_value: MutableRecord, context: MutableRecord) => {
      (rows(context, "records")[0]!).delivery = "live-photo";
    }],
    ["SVG master", (_value: MutableRecord, context: MutableRecord) => {
      ((rows(context, "records")[0]!.files as MutableRecord).master) =
        "/catalog/generated/offline-core-v1/assets/asset-grid-base/master.svg";
    }],
    ["trim/catalogue dimension drift", (value: MutableRecord) => {
      const frame = ((rows(value, "kits")[0]!.base as MutableRecord).frame) as MutableRecord;
      frame.trimWidth = 99;
    }]
  ])("rejects %s", (_label, mutate) => {
    const value = fixture() as unknown as MutableRecord;
    const context = contextFixture() as unknown as MutableRecord;
    mutate(value, context);
    expect(parseProductKitCatalogue(
      value,
      context as unknown as ProductKitCatalogueContext
    )).toBeNull();
  });

  it("returns null without invoking hostile catalogue or context shapes", () => {
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    let accessorReads = 0;
    const accessorCatalogue = fixture() as unknown as MutableRecord;
    Object.defineProperty(accessorCatalogue, "kits", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("hostile getter");
      }
    });
    const methodOverrideCatalogue = fixture();
    Object.defineProperty(methodOverrideCatalogue.kits, "map", {
      value: () => { throw new Error("caller-owned map"); },
      enumerable: false
    });
    const cyclicCatalogue = fixture() as unknown as MutableRecord;
    cyclicCatalogue.self = cyclicCatalogue;

    const calls = [
      () => parseProductKitCatalogue(proxy, contextFixture()),
      () => parseProductKitCatalogue(fixture(), proxy as never),
      () => parseProductKitCatalogue(accessorCatalogue, contextFixture()),
      () => parseProductKitCatalogue(Object.create(fixture()), contextFixture()),
      () => parseProductKitCatalogue(methodOverrideCatalogue, contextFixture()),
      () => parseProductKitCatalogue(cyclicCatalogue, contextFixture())
    ];
    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
    expect(accessorReads).toBe(0);
  });
});


```

## FILE: web/src/product-kit/product-kit-corpus.test.ts

```typescript
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseProductKitCatalogue,
  type ProductKitCatalogueContext
} from "./product-kit-catalogue";

interface CorpusMutation {
  readonly name: string;
  readonly target: "value" | "context";
  readonly path: readonly (string | number)[];
  readonly value: unknown;
  readonly structural: boolean;
}

interface ProductKitCorpus {
  readonly schema: "product-kit-corpus@1";
  readonly context: ProductKitCatalogueContext;
  readonly valid: readonly [{ readonly name: string; readonly value: unknown }];
  readonly derivedValid: readonly Omit<CorpusMutation, "structural">[];
  readonly derivedInvalid: readonly CorpusMutation[];
}

const CORPUS = JSON.parse(readFileSync(
  resolve("catalog/schemas/product-kit-v1.corpus.json"),
  "utf8"
)) as ProductKitCorpus;

function setPath(root: unknown, path: readonly (string | number)[], value: unknown): void {
  if (root === null || typeof root !== "object" || path.length === 0) {
    throw new TypeError("corpus mutation path requires a non-empty object path");
  }
  let target = root as Record<string | number, unknown>;
  for (const segment of path.slice(0, -1)) {
    const next = target[segment];
    if (next === null || typeof next !== "object") {
      throw new TypeError(`invalid corpus mutation segment: ${String(segment)}`);
    }
    target = next as Record<string | number, unknown>;
  }
  target[path.at(-1)!] = value;
}

describe("shared product-kit corpus", () => {
  it("accepts the canonical four-mode value", () => {
    expect(CORPUS.schema).toBe("product-kit-corpus@1");
    expect(parseProductKitCatalogue(CORPUS.valid[0].value, CORPUS.context)).not.toBeNull();
  });

  it.each(CORPUS.derivedValid)("accepts $name", (testCase) => {
    const value = structuredClone(CORPUS.valid[0].value);
    const context = structuredClone(CORPUS.context);
    setPath(testCase.target === "value" ? value : context, testCase.path, testCase.value);

    expect(parseProductKitCatalogue(value, context)).not.toBeNull();
  });

  it.each(CORPUS.derivedInvalid)("rejects $name", (testCase) => {
    const value = structuredClone(CORPUS.valid[0].value);
    const context = structuredClone(CORPUS.context);
    setPath(testCase.target === "value" ? value : context, testCase.path, testCase.value);

    expect(parseProductKitCatalogue(value, context)).toBeNull();
  });
});


```

## FILE: web/src/product-kit/product-kit-runtime.test.ts

```typescript
import { describe, expect, it } from "vitest";
import { computeCertificationFingerprint } from "./certification-fingerprint";
import type {
  ProductKitCatalogue,
  ProductKitCatalogueContext,
  ProductKitComponent,
  ProductKitKit
} from "./product-kit-catalogue";
import { parseProductKitCatalogue } from "./product-kit-catalogue";
import { createProductKitRuntime } from "./product-kit-runtime";

const HASH = "a".repeat(64);
const CONTEXT = {
  packId: "pk1-runtime-pack",
  connectorFormulaVersion: "product-kit-connectors@1"
} as const;
const PROFILE = {
  familyId: "pk1-drinkware",
  perspectiveId: "pk1-front-view",
  geometryId: "pk1-bottle-lid",
  styleId: "pk1-clean-outline"
} as const;

function socketKit(referenceScale = 0.4): ProductKitKit {
  return {
    id: "pk1-bottle-kit",
    title: "Bottle",
    mode: "socket",
    compatibilityProfile: PROFILE,
    base: {
      assetId: "bottle-base",
      masterSha256: HASH,
      frame: {
        originalWidth: 1000,
        originalHeight: 1000,
        trimX: 0,
        trimY: 0,
        trimWidth: 1000,
        trimHeight: 1000
      }
    },
    priceAssetId: "pk1-price-bottle",
    mountFrames: [{
      id: "pk1-bottle-lid-frame",
      slotId: "pk1-bottle-lid-slot",
      mountType: "socket",
      point: { x: 0.5, y: 0.1 },
      normal: { x: 0, y: -1 },
      referenceScale,
      constraints: {
        minScale: 0.25,
        maxScale: 4,
        minRotationDegrees: -45,
        maxRotationDegrees: 45,
        maxNormalErrorDegrees: 1,
        mirrorAllowed: false
      }
    }],
    artworkBounds: [{ x: 0.2, y: 0.3, width: 0.6, height: 0.4 }]
  };
}

function socketComponent(): ProductKitComponent {
  return {
    id: "pk1-flip-lid",
    title: "Flip lid",
    slotId: "pk1-bottle-lid-slot",
    compatibilityProfile: PROFILE,
    componentFrame: {
      mountType: "socket",
      point: { x: 0.5, y: 0.9 },
      normal: { x: 0, y: -1 },
      referenceScale: 0.2
    },
    fragments: [{
      layer: "front",
      raster: {
        assetId: "flip-lid-front",
        masterSha256: "b".repeat(64),
        frame: {
          originalWidth: 400,
          originalHeight: 300,
          trimX: 0,
          trimY: 0,
          trimWidth: 400,
          trimHeight: 300
        }
      }
    }],
    priceAssetId: "pk1-price-flip-lid"
  };
}

function gripKit(): ProductKitKit {
  return {
    ...socketKit(),
    id: "pk1-cup-kit",
    title: "Cup",
    mode: "grip",
    priceAssetId: "pk1-price-cup",
    mountFrames: [{
      id: "pk1-cup-handle-frame",
      slotId: "pk1-cup-handle-slot",
      mountType: "grip",
      contacts: [{ x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }],
      constraints: {
        minScale: 0.25,
        maxScale: 4,
        minRotationDegrees: -90,
        maxRotationDegrees: 90,
        maxNormalErrorDegrees: 1,
        mirrorAllowed: false
      }
    }]
  };
}

function gripComponent(): ProductKitComponent {
  return {
    ...socketComponent(),
    id: "pk1-loop-handle",
    title: "Loop handle",
    slotId: "pk1-cup-handle-slot",
    componentFrame: {
      mountType: "grip",
      contacts: [{ x: 0.2, y: 0.35 }, { x: 0.2, y: 0.65 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    },
    fragments: [
      {
        layer: "rear",
        raster: {
          ...socketComponent().fragments[0]!.raster,
          assetId: "loop-handle-rear"
        }
      },
      {
        layer: "front",
        raster: {
          ...socketComponent().fragments[0]!.raster,
          assetId: "loop-handle-front",
          masterSha256: "d".repeat(64)
        }
      }
    ],
    priceAssetId: "pk1-price-loop-handle"
  };
}

function gridKit(plane: "floor" | "wall" = "floor"): ProductKitKit {
  return {
    ...socketKit(),
    id: `pk1-${plane}-kit`,
    title: `${plane} grid`,
    mode: "grid",
    priceAssetId: `pk1-price-${plane}`,
    mountFrames: [{
      id: `pk1-${plane}-frame`,
      slotId: `pk1-${plane}-slot`,
      mountType: "grid",
      origin: { x: 0.1, y: 0.2 },
      cellSize: { width: 0.1, height: 0.1 },
      columns: 4,
      rows: 4,
      plane,
      acceptedEdgeTypes: ["pk1-join"]
    }]
  };
}

function gridComponent(plane: "floor" | "wall" = "floor"): ProductKitComponent {
  return {
    ...socketComponent(),
    id: `pk1-${plane}-tile`,
    title: `${plane} tile`,
    slotId: `pk1-${plane}-slot`,
    componentFrame: {
      mountType: "grid",
      plane,
      footprint: { columns: 2, rows: 1 },
      edgeTypes: { east: "pk1-join", west: "pk1-join" }
    },
    fragments: [{
      layer: "overlay",
      raster: {
        ...socketComponent().fragments[0]!.raster,
        assetId: `${plane}-tile-overlay`
      }
    }],
    priceAssetId: `pk1-price-${plane}-tile`
  };
}

function catalogueFor(
  kit: ProductKitKit,
  component: ProductKitComponent
): ProductKitCatalogue {
  return catalogueForPairs([{ kit, component }]);
}

function catalogueForPairs(
  pairs: readonly {
    readonly kit: ProductKitKit;
    readonly component: ProductKitComponent;
  }[]
): ProductKitCatalogue {
  const direct = directCatalogueForPairs(pairs);
  const parsed = parseProductKitCatalogue(direct, contextForCatalogue(direct));
  if (!parsed) throw new Error("invalid bound test catalogue");
  return parsed;
}

function directCatalogueForPairs(
  pairs: readonly {
    readonly kit: ProductKitKit;
    readonly component: ProductKitComponent;
  }[]
): ProductKitCatalogue {
  const kits = [...new Map(pairs.map(({ kit }) => [kit.id, kit])).values()]
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const components = [
    ...new Map(pairs.map(({ component }) => [component.id, component])).values()
  ].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const certifications = pairs.map(({ kit, component }, index) => {
    const frame = kit.mountFrames[0]!;
    const fingerprint = computeCertificationFingerprint(
      CONTEXT,
      kit,
      frame,
      component
    );
    if (fingerprint === null) throw new Error("invalid test fixture");
    return {
      id: `pk1-certification-${index + 1}`,
      kitId: kit.id,
      mountFrameId: frame.id,
      componentId: component.id,
      fingerprint
    };
  });
  return {
    schema: "product-kit@1",
    version: 1,
    packId: CONTEXT.packId,
    catalogPackId: "runtime-catalog",
    catalogSha256: "c".repeat(64),
    pricingVersion: "product-pricing@1",
    connectorFormulaVersion: CONTEXT.connectorFormulaVersion,
    kits,
    components,
    certifications
  };
}

function contextForCatalogue(
  catalogue: ProductKitCatalogue
): ProductKitCatalogueContext {
  const rasters = [
    ...catalogue.kits.map(({ base }) => base),
    ...catalogue.components.flatMap(({ fragments }) =>
      fragments.map(({ raster }) => raster)
    )
  ];
  const records = [...new Map(rasters.map((raster) => [raster.assetId, raster])).values()]
    .map((raster) => ({
      id: raster.assetId,
      masterSha256: raster.masterSha256,
      delivery: "offline",
      kind: "raster-master",
      files: {
        master: `/catalog/generated/${catalogue.catalogPackId}/assets/${raster.assetId}/master.png`
      },
      dimensions: {
        width: raster.frame.trimWidth,
        height: raster.frame.trimHeight
      },
      classroomReviewed: true,
      brandFree: true
    }));
  return {
    catalogPackId: catalogue.catalogPackId,
    catalogSha256: catalogue.catalogSha256,
    records
  };
}

function setPath(
  root: unknown,
  path: readonly (string | number)[],
  value: unknown
): void {
  let target = root as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) {
    target = target[key] as Record<string | number, unknown>;
  }
  target[path.at(-1)!] = value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const SOCKET_REQUEST = {
  kind: "socket",
  kitId: "pk1-bottle-kit",
  mountFrameId: "pk1-bottle-lid-frame",
  componentId: "pk1-flip-lid"
} as const;

describe("product-kit certified pair runtime", () => {
  it("does not trust a directly constructed catalogue with self-computed fingerprints", () => {
    const direct = directCatalogueForPairs([{
      kit: socketKit(),
      component: socketComponent()
    }]);
    const runtime = createProductKitRuntime(direct);

    expect(runtime.resolvePair(SOCKET_REQUEST)).toBeNull();
    expect(runtime.planComposition({
      kitId: SOCKET_REQUEST.kitId,
      placements: [{
        kind: SOCKET_REQUEST.kind,
        placementId: "placement-untrusted",
        mountFrameId: SOCKET_REQUEST.mountFrameId,
        componentId: SOCKET_REQUEST.componentId
      }]
    })).toBeNull();
  });

  it("returns null rather than invoking hostile catalogue shapes", () => {
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    const methodOverride = directCatalogueForPairs([{
      kit: socketKit(),
      component: socketComponent()
    }]) as unknown as {
      kits: ProductKitKit[];
    };
    Object.defineProperty(methodOverride.kits, "map", {
      value: () => { throw new Error("caller-owned map"); },
      enumerable: false
    });
    let accessorReads = 0;
    const accessorCatalogue = directCatalogueForPairs([{
      kit: socketKit(),
      component: socketComponent()
    }]) as unknown as Record<string, unknown>;
    Object.defineProperty(accessorCatalogue, "kits", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("hostile getter");
      }
    });
    const inherited = Object.create(directCatalogueForPairs([{
      kit: socketKit(),
      component: socketComponent()
    }]));
    const calls = [
      () => createProductKitRuntime(proxy as never),
      () => createProductKitRuntime(methodOverride as never),
      () => createProductKitRuntime(accessorCatalogue as never),
      () => createProductKitRuntime(inherited as never)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
    expect(accessorReads).toBe(0);
  });

  it("resolves an exact socket certification through the connector transform", () => {
    const catalogue = catalogueFor(socketKit(), socketComponent());
    const before = JSON.stringify(catalogue);
    const runtime = createProductKitRuntime(catalogue);

    const pair = runtime.resolvePair(SOCKET_REQUEST);

    expect(pair).toMatchObject({
      kind: "socket",
      kitId: "pk1-bottle-kit",
      mountFrameId: "pk1-bottle-lid-frame",
      componentId: "pk1-flip-lid",
      transform: { scale: 2, rotationDegrees: 0 }
    });
    expect(Object.isFrozen(pair)).toBe(true);
    expect(JSON.stringify(catalogue)).toBe(before);
  });

  it("resolves an exact grip certification through the connector transform", () => {
    const runtime = createProductKitRuntime(catalogueFor(gripKit(), gripComponent()));

    const pair = runtime.resolvePair({
      kind: "grip",
      kitId: "pk1-cup-kit",
      mountFrameId: "pk1-cup-handle-frame",
      componentId: "pk1-loop-handle"
    });

    expect(pair).toMatchObject({
      kind: "grip",
      transform: { scale: 2, rotationDegrees: 0, mirrored: false }
    });
    expect(pair && "transform" in pair && Object.isFrozen(pair.transform)).toBe(true);
  });

  it("keeps exact cup-handle scale across differently sized certified bases", () => {
    const compact = structuredClone(gripKit()) as ProductKitKit;
    setPath(compact, ["id"], "pk1-cup-compact");
    setPath(compact, ["base", "assetId"], "cup-compact-base");
    setPath(compact, ["base", "frame", "originalWidth"], 600);
    setPath(compact, ["base", "frame", "originalHeight"], 600);
    setPath(compact, ["base", "frame", "trimWidth"], 600);
    setPath(compact, ["base", "frame", "trimHeight"], 600);
    setPath(compact, ["mountFrames", 0, "id"], "pk1-cup-compact-frame");
    setPath(compact, ["mountFrames", 0, "contacts", 0, "y"], 0.35);
    setPath(compact, ["mountFrames", 0, "contacts", 1, "y"], 0.65);

    const large = structuredClone(gripKit()) as ProductKitKit;
    setPath(large, ["id"], "pk1-cup-large");
    setPath(large, ["base", "assetId"], "cup-large-base");
    setPath(large, ["base", "frame", "originalWidth"], 1200);
    setPath(large, ["base", "frame", "originalHeight"], 1200);
    setPath(large, ["base", "frame", "trimWidth"], 1200);
    setPath(large, ["base", "frame", "trimHeight"], 1200);
    setPath(large, ["mountFrames", 0, "id"], "pk1-cup-large-frame");

    const component = gripComponent();
    const runtime = createProductKitRuntime(catalogueForPairs([
      { kit: compact, component },
      { kit: large, component }
    ]));

    const compactPair = runtime.resolvePair({
      kind: "grip",
      kitId: "pk1-cup-compact",
      mountFrameId: "pk1-cup-compact-frame",
      componentId: "pk1-loop-handle"
    });
    const largePair = runtime.resolvePair({
      kind: "grip",
      kitId: "pk1-cup-large",
      mountFrameId: "pk1-cup-large-frame",
      componentId: "pk1-loop-handle"
    });

    expect(compactPair && "transform" in compactPair
      ? compactPair.transform.scale
      : null).toBe(1);
    expect(largePair && "transform" in largePair
      ? largePair.transform.scale
      : null).toBe(2);
  });

  it("resolves only the certified grid plane and footprint", () => {
    const runtime = createProductKitRuntime(catalogueFor(gridKit(), gridComponent()));

    const pair = runtime.resolvePair({
      kind: "grid",
      kitId: "pk1-floor-kit",
      mountFrameId: "pk1-floor-frame",
      componentId: "pk1-floor-tile"
    });

    expect(pair).toEqual({
      kind: "grid",
      kitId: "pk1-floor-kit",
      mountFrameId: "pk1-floor-frame",
      componentId: "pk1-floor-tile",
      plane: "floor",
      footprint: { columns: 2, rows: 1 },
      edgeTypes: { east: "pk1-join", west: "pk1-join" }
    });
    expect(pair && "footprint" in pair && Object.isFrozen(pair.footprint)).toBe(true);
  });

  it.each([
    ["connector formula", ["connectorFormulaVersion"], "product-kit-connectors@2"],
    ["compatibility profile", ["kits", 0, "compatibilityProfile", "geometryId"], "pk1-stale-geometry"],
    ["mount frame", ["kits", 0, "mountFrames", 0, "point", "x"], 0.55],
    ["base raster", ["kits", 0, "base", "masterSha256"], "e".repeat(64)],
    ["fragment raster", ["components", 0, "fragments", 0, "raster", "masterSha256"], "f".repeat(64)],
    ["signed-zero geometry", ["kits", 0, "mountFrames", 0, "normal", "x"], -0]
  ] as const)("denies %s staleness before resolving a transform", (_label, path, value) => {
    const stale = structuredClone(
      catalogueFor(socketKit(), socketComponent())
    ) as ProductKitCatalogue;
    setPath(stale, path, value);

    const runtime = createProductKitRuntime(stale);
    expect(runtime.resolvePair(SOCKET_REQUEST)).toBeNull();
    expect(runtime.planComposition({
      kitId: SOCKET_REQUEST.kitId,
      placements: [{
        kind: SOCKET_REQUEST.kind,
        placementId: "placement-stale",
        mountFrameId: SOCKET_REQUEST.mountFrameId,
        componentId: SOCKET_REQUEST.componentId
      }]
    })).toBeNull();
  });

  it("fails closed for a malformed pair request", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    );

    expect(runtime.resolvePair(null as never)).toBeNull();
    expect(runtime.resolvePair({
      ...SOCKET_REQUEST,
      unexpected: true
    } as never)).toBeNull();
  });

  it("returns null rather than invoking hostile pair requests", () => {
    const runtime = createProductKitRuntime(catalogueFor(socketKit(), socketComponent()));
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    const calls = [
      () => runtime.resolvePair(proxy as never),
      () => runtime.resolvePair(Object.create(SOCKET_REQUEST) as never)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
  });

  it("rejects missing certification and request-kind mismatches", () => {
    const uncertified = structuredClone(
      catalogueFor(socketKit(), socketComponent())
    ) as ProductKitCatalogue;
    setPath(uncertified, ["certifications"], []);

    expect(createProductKitRuntime(uncertified).resolvePair(SOCKET_REQUEST)).toBeNull();
    expect(createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    ).resolvePair({ ...SOCKET_REQUEST, kind: "grip" })).toBeNull();
  });

  it("rejects exactly certified grid pairs with a different plane or overflowing footprint", () => {
    const wrongPlane = structuredClone(gridComponent("floor")) as ProductKitComponent;
    setPath(wrongPlane, ["componentFrame", "plane"], "wall");
    const oversized = structuredClone(gridComponent("floor")) as ProductKitComponent;
    setPath(oversized, ["componentFrame", "footprint", "columns"], 5);
    const request = {
      kind: "grid",
      kitId: "pk1-floor-kit",
      mountFrameId: "pk1-floor-frame",
      componentId: "pk1-floor-tile"
    } as const;

    expect(createProductKitRuntime(
      directCatalogueForPairs([{ kit: gridKit("floor"), component: wrongPlane }])
    ).resolvePair(request)).toBeNull();
    expect(createProductKitRuntime(
      directCatalogueForPairs([{ kit: gridKit("floor"), component: oversized }])
    ).resolvePair(request)).toBeNull();
  });
});

describe("product-kit composition runtime", () => {
  it("composes one certified socket placement into the complete layer plan", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    );

    const plan = runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [{
        kind: "socket",
        placementId: "placement-lid",
        mountFrameId: "pk1-bottle-lid-frame",
        componentId: "pk1-flip-lid"
      }]
    });

    expect(plan?.layers.map(({ layer }) => layer)).toEqual([
      "rear",
      "body",
      "front",
      "artwork",
      "overlay"
    ]);
    expect(plan?.layers[2]?.entries[0]).toMatchObject({
      kind: "component-raster",
      placementId: "placement-lid",
      componentId: "pk1-flip-lid",
      geometry: { kind: "affine", transform: { scale: 2 } }
    });
    expect(plan?.pricedItems).toEqual([
      {
        kind: "base",
        itemId: "base:pk1-bottle-kit",
        priceAssetId: "pk1-price-bottle"
      },
      {
        kind: "component",
        itemId: "placement:placement-lid",
        placementId: "placement-lid",
        componentId: "pk1-flip-lid",
        priceAssetId: "pk1-price-flip-lid"
      }
    ]);
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("groups and validates repeated integer-cell grid placements per frame", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(gridKit("floor"), gridComponent("floor"))
    );

    const plan = runtime.planComposition({
      kitId: "pk1-floor-kit",
      placements: [
        {
          kind: "grid",
          placementId: "placement-right",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 2,
          row: 0
        },
        {
          kind: "grid",
          placementId: "placement-left",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 0,
          row: 0
        }
      ]
    });

    const overlayEntries = plan?.layers[4]?.entries;
    expect(overlayEntries?.map((entry) =>
      entry.kind === "component-raster" ? entry.placementId : null
    )).toEqual(["placement-left", "placement-right"]);
    expect(overlayEntries?.[0]).toMatchObject({
      geometry: {
        kind: "grid",
        column: 0,
        row: 0,
        normalizedBounds: { x: 0.1, y: 0.2, width: 0.2, height: 0.1 }
      }
    });
    expect(plan?.pricedItems.slice(1).map(({ itemId }) => itemId)).toEqual([
      "placement:placement-left",
      "placement:placement-right"
    ]);
  });

  it("allows at most one fixed placement on a socket or grip mount frame", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    );

    expect(runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [
        {
          kind: "socket",
          placementId: "placement-first",
          mountFrameId: "pk1-bottle-lid-frame",
          componentId: "pk1-flip-lid"
        },
        {
          kind: "socket",
          placementId: "placement-second",
          mountFrameId: "pk1-bottle-lid-frame",
          componentId: "pk1-flip-lid"
        }
      ]
    })).toBeNull();
  });

  it("fails closed for malformed composition requests", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    );

    expect(runtime.planComposition(null as never)).toBeNull();
    expect(runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [null]
    } as never)).toBeNull();
    expect(runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [],
      unexpected: true
    } as never)).toBeNull();
    expect(runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [{
        kind: "socket",
        placementId: "placement-extra",
        mountFrameId: "pk1-bottle-lid-frame",
        componentId: "pk1-flip-lid",
        unexpected: true
      }]
    } as never)).toBeNull();

    const sparsePlacements = new Array(1);
    const resolveSparse = () => runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: sparsePlacements
    } as never);
    expect(resolveSparse).not.toThrow();
    expect(resolveSparse()).toBeNull();
  });

  it("returns null rather than invoking hostile composition requests", () => {
    const runtime = createProductKitRuntime(catalogueFor(socketKit(), socketComponent()));
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    const placements = [{
      kind: "socket" as const,
      placementId: "placement-one",
      mountFrameId: SOCKET_REQUEST.mountFrameId,
      componentId: SOCKET_REQUEST.componentId
    }];
    Object.defineProperty(placements, "every", {
      value: () => { throw new Error("caller-owned every"); },
      enumerable: false
    });
    const cyclic: Record<string, unknown> = {
      kitId: SOCKET_REQUEST.kitId,
      placements: []
    };
    (cyclic.placements as unknown[]).push(cyclic);
    const calls = [
      () => runtime.planComposition(proxy as never),
      () => runtime.planComposition(Object.create({
        kitId: SOCKET_REQUEST.kitId,
        placements: []
      }) as never),
      () => runtime.planComposition({
        kitId: SOCKET_REQUEST.kitId,
        placements
      }),
      () => runtime.planComposition(cyclic as never)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
  });

  it("rejects signed-zero grid placement coordinates", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(gridKit("floor"), gridComponent("floor"))
    );

    expect(runtime.planComposition({
      kitId: "pk1-floor-kit",
      placements: [{
        kind: "grid",
        placementId: "placement-signed-zero",
        mountFrameId: "pk1-floor-frame",
        componentId: "pk1-floor-tile",
        column: -0,
        row: 0
      }]
    })).toBeNull();
  });

  it("rejects duplicate IDs, request-kind mismatch, and any invalid member without a partial plan", () => {
    const gridRuntime = createProductKitRuntime(
      catalogueFor(gridKit("floor"), gridComponent("floor"))
    );
    expect(gridRuntime.planComposition({
      kitId: "pk1-floor-kit",
      placements: [
        {
          kind: "grid",
          placementId: "placement-duplicate",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 0,
          row: 0
        },
        {
          kind: "grid",
          placementId: "placement-duplicate",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 2,
          row: 0
        }
      ]
    })).toBeNull();
    expect(gridRuntime.planComposition({
      kitId: "pk1-floor-kit",
      placements: [
        {
          kind: "grid",
          placementId: "placement-valid",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 0,
          row: 0
        },
        {
          kind: "grid",
          placementId: "placement-overlap",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 1,
          row: 0
        }
      ]
    })).toBeNull();

    const socketRuntime = createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    );
    expect(socketRuntime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [{
        kind: "grip",
        placementId: "placement-wrong-kind",
        mountFrameId: "pk1-bottle-lid-frame",
        componentId: "pk1-flip-lid"
      }]
    })).toBeNull();
  });

  it("composes a wall grid with exact integer-cell bounds", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(gridKit("wall"), gridComponent("wall"))
    );

    const plan = runtime.planComposition({
      kitId: "pk1-wall-kit",
      placements: [{
        kind: "grid",
        placementId: "placement-wall",
        mountFrameId: "pk1-wall-frame",
        componentId: "pk1-wall-tile",
        column: 1,
        row: 2
      }]
    });

    expect(plan?.layers[4]?.entries[0]).toMatchObject({
      kind: "component-raster",
      placementId: "placement-wall",
      geometry: {
        kind: "grid",
        column: 1,
        row: 2,
        normalizedBounds: { x: 0.2, y: 0.4, width: 0.2, height: 0.1 }
      }
    });
  });

  it("leaves deeply frozen catalogue and request inputs unchanged", () => {
    const catalogue = deepFreeze(catalogueFor(socketKit(), socketComponent()));
    const request = deepFreeze({
      kitId: "pk1-bottle-kit",
      placements: [{
        kind: "socket" as const,
        placementId: "placement-frozen",
        mountFrameId: "pk1-bottle-lid-frame",
        componentId: "pk1-flip-lid"
      }]
    });
    const beforeCatalogue = JSON.stringify(catalogue);
    const beforeRequest = JSON.stringify(request);
    const runtime = createProductKitRuntime(catalogue);

    const plan = runtime.planComposition(request);

    expect(plan).not.toBeNull();
    expect(Object.isFrozen(runtime)).toBe(true);
    expect(Object.isFrozen(plan?.layers[2]?.entries[0])).toBe(true);
    expect(JSON.stringify(catalogue)).toBe(beforeCatalogue);
    expect(JSON.stringify(request)).toBe(beforeRequest);
  });
});


```

