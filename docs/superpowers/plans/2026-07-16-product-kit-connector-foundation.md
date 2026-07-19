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
