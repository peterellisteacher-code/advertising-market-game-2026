# Clipped Product Artwork Surface Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve each composed product's artwork clip as one addressable nested Fabric group without changing the stable outer product selection frame.

**Architecture:** Keep one top-level `product-shell` group under the existing `FixedLayout`. Replace the flattened imported student-artwork object with one nested `artwork-slot` group whose `ClipPathLayout` derives a stable slot frame from its own clip path; the child artwork retains its own semantic ID. This is deliberately factory-only: canvas placement, edit-mode hit testing, duplication, document history and catalogue-reference reconciliation are later independently testable plans.

**Tech Stack:** TypeScript 7, Fabric.js 7.4.0, Vitest 4, Vite 8.

## Global Constraints

- Preserve the existing top-level product `Group`, `objectId`, `elementKind: "product-shell"`, `FixedLayout`, scale and tight selection frame.
- Do not enable nested hit testing or make artwork children independently canvas-selectable in this kernel.
- The nested surface owns the imported clip path; its child must not retain a second clip path.
- Direct legacy shells without composed artwork remain valid.
- Composed variants fail closed if artwork metadata or a clip path is missing or ambiguous.
- New semantic metadata must survive `toObject()` and `Group.fromObject()`.
- Use test-driven development: observe RED before production edits, then GREEN.
- Do not touch Claude-owned files or unrelated untracked paths.

## File Structure

- `web/src/fabric/fabric-custom-properties.ts` — declare and serialize `artworkSlotId` and `artworkId`.
- `web/src/fabric/product-shell-factory.ts` — recognise imported artwork metadata, create the clipped nested group, expose strict slot lookup.
- `web/src/fabric/product-shell-factory.test.ts` — prove structure, clipping, round-trip persistence and unchanged outer bounds using the reviewed real pack.

---

### Task 1: Nested clipped artwork-surface kernel

**Files:**
- Modify: `web/src/fabric/fabric-custom-properties.ts`
- Modify: `web/src/fabric/product-shell-factory.ts`
- Test: `web/src/fabric/product-shell-factory.test.ts`

**Interfaces:**
- Consumes: the composer-emitted `data-layer="artwork-slot"`, `data-artwork-slot="primary"`, `data-student-artwork="<id>"`, and imported Fabric child `clipPath`.
- Produces: `productArtworkSurface(shell: FabricObject, slotId?: string): Group`.
- Produces serialized Fabric properties `artworkSlotId?: string` and `artworkId?: string`.
- Produces one nested surface with `productLayer: "artwork-slot"`, `artworkSlotId: "primary"`, `ClipPathLayout`, one owned clip path, and child `productLayer: "student-artwork"`.

- [ ] **Step 1: Write failing structure and round-trip tests**

Add `ClipPathLayout` to the Fabric import, import `productArtworkSurface`, and add this test after the populated-variant test:

```ts
it("nests one clipped artwork surface without widening the product frame", async () => {
  const variant = resolver.resolveVariant({
    bodyId: "drinkware-classic-can",
    partId: "drinkware-top-ring",
    paletteId: "cobalt-citrus",
    materialId: "fabric"
  });
  if (!variant) throw new Error("Expected real drinkware variant fixture");
  const shell = await new FabricProductShellFactory().createVariant({
    id: "clipped-product",
    accessibleName: "Cobalt Citrus Classic Can",
    variant,
    authoringSvg: packText(`bodies/${variant.bodyId}/authoring.svg`),
    componentSvg: packText(`components/${variant.partId}.svg`),
    artwork: { id: "front-art", colour: "#F2385A" },
    mode: "editor"
  });

  const surface = productArtworkSurface(shell);
  expect(surface).toMatchObject({
    productLayer: "artwork-slot",
    artworkSlotId: "primary"
  });
  expect(surface.layoutManager.strategy).toBeInstanceOf(ClipPathLayout);
  expect(surface.clipPath).toBeDefined();
  expect(surface.getObjects()).toHaveLength(1);
  expect(surface.getObjects()[0]).toMatchObject({
    artworkId: "front-art",
    productLayer: "student-artwork",
    clipPath: undefined
  });
  expect(shell.layoutManager.strategy).toBeInstanceOf(FixedLayout);
  expect(shell.getScaledHeight()).toBeCloseTo(620, 0);
  expect(shell.getScaledWidth() / shell.getScaledHeight()).toBeLessThan(0.65);

  const restored = await Group.fromObject(shell.toObject());
  const restoredSurface = productArtworkSurface(restored);
  expect(restoredSurface.layoutManager.strategy).toBeInstanceOf(ClipPathLayout);
  expect(restoredSurface.clipPath).toBeDefined();
  expect(restoredSurface.getObjects()[0]).toMatchObject({
    artworkId: "front-art",
    productLayer: "student-artwork"
  });
  expect(restored.width).toBe(shell.width);
  expect(restored.height).toBe(shell.height);
  expect(restored.scaleX).toBeCloseTo(shell.scaleX, 3);
  expect(restored.scaleY).toBeCloseTo(shell.scaleY, 3);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run from the repository root:

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run 'web/src/fabric/product-shell-factory.test.ts'
```

Expected: FAIL because `productArtworkSurface` and `artworkSlotId`/`artworkId` do not exist and the imported artwork is still flat.

- [ ] **Step 3: Add serializable artwork metadata**

Add both properties to `FabricObject`, `SerializedObjectProps`, and `FabricObject.customProperties` in `fabric-custom-properties.ts`:

```ts
artworkSlotId?: string;
artworkId?: string;
```

```ts
"artworkSlotId",
"artworkId"
```

- [ ] **Step 4: Recognise the SVG metadata and build the nested clipped surface**

Import `ClipPathLayout` in `product-shell-factory.ts`. Add this helper beside `descendants()`:

```ts
function nestArtworkSurface(objects: readonly FabricObject[]): FabricObject[] {
  const artworkObjects = objects.filter((object) => object.artworkId !== undefined);
  if (artworkObjects.length === 0) return [...objects];
  if (artworkObjects.length !== 1) {
    throw new Error("Product variant must contain exactly one student artwork object");
  }
  const artwork = artworkObjects[0];
  if (!artwork) throw new Error("Product variant artwork is missing");
  const slotId = artwork.artworkSlotId;
  const clipPath = artwork.clipPath;
  if (!slotId?.trim() || !clipPath) {
    throw new Error("Product variant artwork requires one named clipped slot");
  }
  const index = objects.indexOf(artwork);
  artwork.set({ productLayer: "student-artwork" });
  artwork.clipPath = undefined;
  artwork.dirty = true;
  const surface = new Group([artwork], {
    clipPath,
    productLayer: "artwork-slot",
    artworkSlotId: slotId,
    selectable: false,
    evented: false,
    layoutManager: new LayoutManager(new ClipPathLayout())
  });
  surface.setCoords();
  return [...objects.slice(0, index), surface, ...objects.slice(index + 1)];
}
```

In the `loadSVGFromString` callback, read and apply the two source attributes:

```ts
const artworkSlotId = nearestAttribute(element, "data-artwork-slot");
const artworkId = nearestAttribute(element, "data-student-artwork");
```

```ts
...(artworkSlotId ? { artworkSlotId } : {}),
...(artworkId ? { artworkId } : {}),
```

Immediately after filtering null parsed objects, call `nestArtworkSurface` and use its returned array for all grouping, material detection and bounds calculations:

```ts
const nestedObjects = nestArtworkSurface(objects);
```

- [ ] **Step 5: Add strict public surface lookup**

Add this export before the recolouring helpers:

```ts
export function productArtworkSurface(
  shell: FabricObject,
  slotId = "primary"
): Group {
  if (shell.elementKind !== "product-shell" || !slotId.trim()) {
    throw new Error("Artwork surface lookup requires a product shell and named slot");
  }
  const matches = descendants(shell).filter(
    (object): object is Group => object instanceof Group &&
      object.productLayer === "artwork-slot" && object.artworkSlotId === slotId
  );
  if (matches.length !== 1 || !matches[0]?.clipPath ||
      !(matches[0].layoutManager.strategy instanceof ClipPathLayout)) {
    throw new Error(`Product shell has invalid artwork slot ${slotId}`);
  }
  return matches[0];
}
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Run the Step 2 command again.

Expected: the full `product-shell-factory.test.ts` file passes, including all eight material-bound round trips.

- [ ] **Step 7: Run type and full-suite regressions**

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run
```

Expected: TypeScript exits 0 and all Vitest files pass.

- [ ] **Step 8: Inspect the exact diff and commit only this kernel**

```powershell
git diff --check
git diff -- web/src/fabric/fabric-custom-properties.ts web/src/fabric/product-shell-factory.ts web/src/fabric/product-shell-factory.test.ts
git add -- web/src/fabric/fabric-custom-properties.ts web/src/fabric/product-shell-factory.ts web/src/fabric/product-shell-factory.test.ts
git commit -m "feat: add clipped product artwork surface"
```

Expected: one focused commit; unrelated untracked files remain untouched.

## Self-Review

- Spec coverage: structure, clip ownership, semantic metadata, strict lookup, round-trip persistence, stable outer bounds and legacy-shell compatibility are covered.
- Deliberately deferred: interactive nested selection, drawing/raster/text placement, deep-ID duplication, recursive campaign validation, atomic document history, export-reference reconciliation and UI controls each require a separate independently testable plan.
- Placeholder scan: clear; every code-changing step supplies concrete content.
- Type consistency: the same `artworkSlotId`, `artworkId`, `productArtworkSurface(shell, slotId?)`, `artwork-slot` and `student-artwork` names are used throughout.
