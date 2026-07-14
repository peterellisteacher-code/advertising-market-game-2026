# Recursive Semantic Object Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate and address campaign objects nested inside Fabric groups without treating decorative shell geometry or clip paths as campaign objects.

**Architecture:** Add one Fabric-independent collector that walks only the root `fabricState.objects` array and descendant `objects` arrays. A node becomes semantic when it carries any application identity key; semantic nodes must then have complete metadata and a globally unique ID. Campaign schema and checklist logic use this collector as their single identity source.

**Tech Stack:** TypeScript 7, Zod 4.4, Vitest 4.

## Global Constraints

- Traverse only `objects` arrays; never recurse through `clipPath` or arbitrary object properties.
- Treat a node as semantic if it owns any of `objectId`, `elementKind`, `accessibleName`, `assetId`, or `sourceHash`.
- Every semantic node requires a non-empty `objectId`, supported `elementKind`, and non-empty `accessibleName`.
- Optional `assetId` and `sourceHash`, when present, must be non-empty strings.
- Reject duplicate semantic object IDs across all depths, including root-versus-child collisions.
- Permit decorative descendants with none of the five semantic keys.
- Preserve schema version 1 and existing valid top-level documents.
- Do not strip, migrate or silently repair malformed nested metadata.
- Use genuine RED then GREEN TDD evidence and touch only scoped files.
- Do not touch Claude-owned files or unrelated untracked paths.

## File Structure

- `web/src/domain/campaign-semantic-objects.ts` — pure recursive collector and ID map.
- `web/src/domain/campaign-semantic-objects.test.ts` — collector traversal, exclusion and failure cases.
- `web/src/domain/campaign-document.ts` — enforce the recursive contract during v1 parsing.
- `web/src/domain/campaign-document.test.ts` — prove valid and malformed nested documents.
- `web/src/checklist/checklist-store.ts` — source evidence IDs from the recursive map.
- `web/src/checklist/checklist-store.test.ts` — prove nested evidence and global duplicate handling.

---

### Task 1: Pure semantic-tree collector and consumers

**Files:**
- Create: `web/src/domain/campaign-semantic-objects.ts`
- Create: `web/src/domain/campaign-semantic-objects.test.ts`
- Modify: `web/src/domain/campaign-document.ts`
- Test: `web/src/domain/campaign-document.test.ts`
- Modify: `web/src/checklist/checklist-store.ts`
- Test: `web/src/checklist/checklist-store.test.ts`

**Interfaces:**
- Produces `CampaignSemanticObject` with `objectId`, `elementKind`, `accessibleName`, optional asset/source IDs, original object record and numeric path.
- Produces `collectCampaignSemanticObjects(fabricState: unknown): CampaignSemanticObject[]`.
- Produces `campaignSemanticObjectMap(fabricState: unknown): Map<string, CampaignSemanticObject>`.
- CampaignDocument v1 parsing and checklist evidence both consume the same collector contract.

- [ ] **Step 1: Write failing collector tests**

Create `campaign-semantic-objects.test.ts` with these cases:

```ts
import { describe, expect, it } from "vitest";
import {
  campaignSemanticObjectMap,
  collectCampaignSemanticObjects
} from "./campaign-semantic-objects";

const nestedState = {
  version: "7.4.0",
  objects: [{
    type: "Group",
    objectId: "product-1",
    elementKind: "product-shell",
    accessibleName: "Classic can",
    clipPath: {
      type: "Path",
      objectId: "nested-image",
      elementKind: "image",
      accessibleName: "Clip path must not count"
    },
    objects: [
      { type: "Path", productLayer: "base-shell", shellRegion: "body" },
      {
        type: "Group",
        productLayer: "artwork-slot",
        artworkSlotId: "primary",
        objects: [{
          type: "FabricImage",
          objectId: "nested-image",
          elementKind: "image",
          accessibleName: "Sliced citrus",
          assetId: "fruit-1",
          src: "/catalog/fruit.png"
        }]
      }
    ]
  }]
};

describe("campaign semantic object tree", () => {
  it("collects root and nested semantic objects while ignoring decoration and clip paths", () => {
    const collected = collectCampaignSemanticObjects(nestedState);

    expect(collected.map(({ objectId, path }) => ({ objectId, path }))).toEqual([
      { objectId: "product-1", path: [0] },
      { objectId: "nested-image", path: [0, 1, 0] }
    ]);
    expect(campaignSemanticObjectMap(nestedState).get("nested-image")?.object)
      .toMatchObject({ assetId: "fruit-1", src: "/catalog/fruit.png" });
  });

  it("rejects partial nested semantic metadata", () => {
    const malformed = structuredClone(nestedState);
    malformed.objects[0]!.objects[1]!.objects = [{
      type: "Textbox",
      objectId: "partial-child"
    }];

    expect(() => collectCampaignSemanticObjects(malformed))
      .toThrow("partial-child");
  });

  it("rejects duplicate IDs across root and nested objects", () => {
    const duplicate = structuredClone(nestedState);
    duplicate.objects[0]!.objects[1]!.objects![0]!.objectId = "product-1";

    expect(() => collectCampaignSemanticObjects(duplicate))
      .toThrow("Duplicate Fabric object ID product-1");
  });

  it("rejects malformed descendant object arrays", () => {
    const malformed = structuredClone(nestedState) as Record<string, unknown>;
    const root = (malformed.objects as Array<Record<string, unknown>>)[0]!;
    root.objects = "not-an-array";

    expect(() => collectCampaignSemanticObjects(malformed))
      .toThrow("children must be an array");
  });
});
```

- [ ] **Step 2: Add failing document and checklist tests**

In `campaign-document.test.ts`, add a valid nested image and a partial nested child case:

```ts
it("accepts complete nested semantic objects and rejects partial nested metadata", () => {
  const doc = createBlankCampaignDocument({
    documentId: "nested-doc",
    sessionId: "nested-session",
    mode: "offline"
  });
  const product = {
    objectId: "product-1",
    elementKind: "product-shell",
    accessibleName: "Classic can",
    objects: [{ productLayer: "base-shell" }, {
      productLayer: "artwork-slot",
      objects: [{
        objectId: "nested-image",
        elementKind: "image",
        accessibleName: "Sliced citrus",
        assetId: "fruit-1"
      }]
    }]
  };

  expect(parseCampaignDocument({
    ...doc,
    fabricState: { version: "7.4.0", objects: [product] }
  }).fabricState.objects[0]).toMatchObject(product);

  const malformed = structuredClone(product);
  malformed.objects[1]!.objects![0] = { objectId: "partial-child" } as never;
  expect(() => parseCampaignDocument({
    ...doc,
    fabricState: { version: "7.4.0", objects: [malformed] }
  })).toThrow("partial-child");
});
```

In `checklist-store.test.ts`, add nested evidence:

```ts
it("accepts nested semantic object IDs as checklist evidence", () => {
  const source = documentFixture();
  const product = {
    objectId: "product-shell",
    elementKind: "product-shell" as const,
    accessibleName: "Classic can",
    objects: [{ productLayer: "base-shell" }, {
      productLayer: "artwork-slot",
      objects: [{
        objectId: "front-headline",
        elementKind: "text" as const,
        accessibleName: "Front headline",
        text: "Fizz first"
      }]
    }]
  };
  const nested = CampaignDocumentSchema.parse({
    ...source,
    fabricState: {
      ...source.fabricState,
      objects: [...source.fabricState.objects, product]
    }
  });

  const updated = new ChecklistStore(nested)
    .setEvidence("attention", ["front-headline"]);

  expect(updated.evidence.attention).toEqual(["front-headline"]);
});
```

Update the existing duplicate-ID test so the assertion starts at `CampaignDocumentSchema.parse(...)`; recursive schema enforcement should reject the duplicate before `ChecklistStore` construction.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run 'web/src/domain/campaign-semantic-objects.test.ts' 'web/src/domain/campaign-document.test.ts' 'web/src/checklist/checklist-store.test.ts'
```

Expected: FAIL because the collector does not exist, nested partial metadata is not checked, and nested IDs are unavailable to checklist evidence.

- [ ] **Step 4: Implement the pure collector**

Create `campaign-semantic-objects.ts`:

```ts
import {
  ELEMENT_KINDS,
  type ElementKind
} from "./editor-object";

const SEMANTIC_KEYS = [
  "objectId",
  "elementKind",
  "accessibleName",
  "assetId",
  "sourceHash"
] as const;
const ELEMENT_KIND_SET = new Set<string>(ELEMENT_KINDS);

export interface CampaignSemanticObject {
  objectId: string;
  elementKind: ElementKind;
  accessibleName: string;
  assetId?: string;
  sourceHash?: string;
  object: Record<string, unknown>;
  path: readonly number[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pathLabel(path: readonly number[]): string {
  return path.reduce((label, index, depth) =>
    `${label}${depth === 0 ? "" : ".objects"}[${index}]`, "objects");
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

export function collectCampaignSemanticObjects(
  fabricState: unknown
): CampaignSemanticObject[] {
  if (!isRecord(fabricState) || !Array.isArray(fabricState.objects)) {
    throw new Error("Fabric state objects must be an array");
  }
  const collected: CampaignSemanticObject[] = [];
  const seen = new Set<string>();

  const visit = (value: unknown, path: readonly number[]): void => {
    const label = pathLabel(path);
    if (!isRecord(value)) throw new Error(`${label} must be an object`);
    const semantic = SEMANTIC_KEYS.some((key) => Object.hasOwn(value, key));
    if (semantic) {
      const objectId = nonEmptyString(value.objectId, `${label} objectId`);
      const rawKind = nonEmptyString(value.elementKind, `${objectId} elementKind`);
      if (!ELEMENT_KIND_SET.has(rawKind)) {
        throw new Error(`${objectId} has unsupported elementKind ${rawKind}`);
      }
      const accessibleName = nonEmptyString(
        value.accessibleName,
        `${objectId} accessibleName`
      );
      const optional = (key: "assetId" | "sourceHash"): string | undefined => {
        if (!Object.hasOwn(value, key)) return undefined;
        return nonEmptyString(value[key], `${objectId} ${key}`);
      };
      if (seen.has(objectId)) throw new Error(`Duplicate Fabric object ID ${objectId}`);
      seen.add(objectId);
      const assetId = optional("assetId");
      const sourceHash = optional("sourceHash");
      collected.push({
        objectId,
        elementKind: rawKind as ElementKind,
        accessibleName,
        ...(assetId === undefined ? {} : { assetId }),
        ...(sourceHash === undefined ? {} : { sourceHash }),
        object: value,
        path: Object.freeze([...path])
      });
    }
    if (value.objects === undefined) return;
    if (!Array.isArray(value.objects)) {
      throw new Error(`${label} children must be an array`);
    }
    value.objects.forEach((child, index) => visit(child, [...path, index]));
  };

  fabricState.objects.forEach((object, index) => visit(object, [index]));
  return collected;
}

export function campaignSemanticObjectMap(
  fabricState: unknown
): Map<string, CampaignSemanticObject> {
  return new Map(
    collectCampaignSemanticObjects(fabricState).map((object) => [object.objectId, object])
  );
}
```

- [ ] **Step 5: Enforce the collector in CampaignDocument v1**

Import `collectCampaignSemanticObjects` in `campaign-document.ts`. Extend the existing `superRefine`:

```ts
try {
  collectCampaignSemanticObjects(document.fabricState);
} catch (error) {
  context.addIssue({
    code: "custom",
    path: ["fabricState", "objects"],
    message: error instanceof Error ? error.message : "Fabric object tree is invalid"
  });
}
```

Keep the existing top-level `fabricObjectState` schema and room-mode validation unchanged.

- [ ] **Step 6: Route checklist identity through the collector**

Import `campaignSemanticObjectMap` in `checklist-store.ts` and replace `campaignObjectIds` with:

```ts
export function campaignObjectIds(document: CampaignDocumentV1): Set<string> {
  return new Set(campaignSemanticObjectMap(document.fabricState).keys());
}
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run the Step 3 command again.

Expected: collector, schema and checklist test files all pass; clip-path metadata is excluded, nested evidence resolves, and malformed/duplicate nested metadata fails closed.

- [ ] **Step 8: Run full verification**

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run
git diff --check
```

Expected: TypeScript exits 0, all Vitest files pass, and no whitespace errors appear.

- [ ] **Step 9: Commit the scoped kernel**

```powershell
git add -- web/src/domain/campaign-semantic-objects.ts web/src/domain/campaign-semantic-objects.test.ts web/src/domain/campaign-document.ts web/src/domain/campaign-document.test.ts web/src/checklist/checklist-store.ts web/src/checklist/checklist-store.test.ts
git commit -m "feat: validate nested campaign objects"
```

Expected: one focused commit; unrelated untracked files remain untouched.

## Self-Review

- Spec coverage: root and descendant traversal, clip-path exclusion, decorative-node tolerance, complete metadata, supported kinds, optional strings, global uniqueness, schema enforcement and nested evidence are covered.
- Deliberately deferred: exporter validation, draft normalisation/rehydration, catalogue reconciliation, child-ID remapping, arbitrary Fabric cleanup and schema migration.
- Placeholder scan: clear; the collector, consumers, tests and commands are concrete.
- Type consistency: both consumers use the same `CampaignSemanticObject`/map contract and exact five semantic trigger keys.
