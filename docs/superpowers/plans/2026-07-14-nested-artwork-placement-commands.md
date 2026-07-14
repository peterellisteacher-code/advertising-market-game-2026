# Nested Artwork Placement Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add text, shapes and same-origin rasters to a named product artwork surface, and edit nested text, while the product remains one stable top-level canvas object.

**Architecture:** Address a surface by `{ productId, slotId }`. The command service generates child IDs and delegates to new surface-scoped port methods; the Fabric adapter resolves the strict clipped surface, centres and fits each factory-created object in local coordinates, then emits exactly one parent-shell `modified` event. Nested pointer targeting, catalogue reference reconciliation and UI controls remain separate follow-on slices.

**Tech Stack:** TypeScript 7, Fabric.js 7.4.0, Vitest 4.

## Global Constraints

- Preserve one top-level product `Group`; nested additions must never become top-level canvas objects.
- Preserve the product's `FixedLayout`, width, height, scale and active outer selection.
- Keep the artwork surface clipped with `ClipPathLayout`; never enable `interactive` or `subTargetCheck` in this slice.
- Use only public Fabric 7 APIs such as `Group.add()`.
- Every successful nested add or text edit emits exactly one `{ type: "modified", objectId: productId }` mutation and no child-level canvas mutation.
- A rejected address, slot or raster leaves the surface, selection and mutation stream unchanged.
- Same-origin raster validation remains in `FabricObjectFactory.createRaster()`.
- Use genuine RED then GREEN TDD evidence and commit only scoped files.
- Do not touch Claude-owned files or unrelated untracked paths.

## File Structure

- `web/src/fabric/canvas-port.ts` — define the stable address and surface-scoped port contract.
- `web/src/fabric/object-command-service.ts` — validate commands, mint child IDs and keep the parent selected.
- `web/src/fabric/fabric-canvas-adapter.ts` — resolve, centre, fit and mutate nested Fabric children atomically.
- `web/src/fabric/object-command-service.test.ts` — prove command routing and parent selection without Fabric.
- `web/src/fabric/fabric-canvas-adapter.test.ts` — prove real clipped nesting, geometry stability, serialization and parent mutation boundaries.

---

### Task 1: Surface-scoped placement and text editing

**Files:**
- Modify: `web/src/fabric/canvas-port.ts`
- Modify: `web/src/fabric/object-command-service.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.ts`
- Test: `web/src/fabric/object-command-service.test.ts`
- Test: `web/src/fabric/fabric-canvas-adapter.test.ts`

**Interfaces:**
- Produces: `ArtworkSurfaceAddress { productId: string; slotId: string }`.
- Produces port methods `addArtworkText`, `addArtworkShape`, `addArtworkRaster`, and `setArtworkText`.
- Produces command methods with the same four names; add methods return the generated child ID.
- Consumes: `productArtworkSurface(shell, slotId)`, `FabricObjectFactory`, and the existing `CanvasMutation` stream.

- [ ] **Step 1: Write the failing command-routing test**

Extend `MemoryCanvasPort` with an `artworkCalls` array and stub implementations of the four new methods. Add this test:

```ts
type ArtworkCall =
  | { type: "text:add"; target: ArtworkSurfaceAddress; id: string; value: string }
  | { type: "shape:add"; target: ArtworkSurfaceAddress; id: string; kind: ShapeKind }
  | { type: "raster:add"; target: ArtworkSurfaceAddress; id: string; assetId: string }
  | { type: "text:set"; target: ArtworkSurfaceAddress; id: string; value: string };

readonly artworkCalls: ArtworkCall[] = [];

async addArtworkText(target: ArtworkSurfaceAddress, input: NewTextInput): Promise<void> {
  this.artworkCalls.push({ type: "text:add", target: { ...target }, id: input.id, value: input.value });
}
async addArtworkShape(target: ArtworkSurfaceAddress, input: NewShapeInput): Promise<void> {
  this.artworkCalls.push({ type: "shape:add", target: { ...target }, id: input.id, kind: input.kind });
}
async addArtworkRaster(target: ArtworkSurfaceAddress, input: NewRasterInput): Promise<void> {
  this.artworkCalls.push({ type: "raster:add", target: { ...target }, id: input.id, assetId: input.assetId });
}
setArtworkText(target: ArtworkSurfaceAddress, id: string, value: string): void {
  this.artworkCalls.push({ type: "text:set", target: { ...target }, id, value });
}
```

```ts
it("routes artwork commands to one named product surface and keeps the product selected", async () => {
  const port = new MemoryCanvasPort();
  const commands = new ObjectCommandService(
    port,
    idFactory("art-text-1", "art-shape-1", "art-image-1")
  );
  const target = { productId: "product-1", slotId: "primary" };

  const textId = await commands.addArtworkText(target, "Fizz first", "Front headline");
  const shapeId = await commands.addArtworkShape(target, {
    kind: "ellipse",
    fill: "#F2385A",
    accessibleName: "Front burst"
  });
  const imageId = await commands.addArtworkRaster(target, {
    assetId: "fruit-1",
    sameOriginUrl: `${window.location.origin}/catalog/fruit.png`,
    accessibleName: "Sliced citrus"
  });
  commands.setArtworkText(target, textId, "Fizz together");

  expect([textId, shapeId, imageId]).toEqual([
    "art-text-1",
    "art-shape-1",
    "art-image-1"
  ]);
  expect(port.selectedId).toBe("product-1");
  expect(port.artworkCalls).toEqual([
    expect.objectContaining({ type: "text:add", target, id: "art-text-1" }),
    expect.objectContaining({ type: "shape:add", target, id: "art-shape-1" }),
    expect.objectContaining({ type: "raster:add", target, id: "art-image-1" }),
    expect.objectContaining({
      type: "text:set",
      target,
      id: "art-text-1",
      value: "Fizz together"
    })
  ]);
});
```

- [ ] **Step 2: Write the failing adapter integration test**

In `fabric-canvas-adapter.test.ts`, widen `FakeCanvas.objects` and `activeObject` to `FabricObject`, add one compact SVG fixture with a body, material-treatment, named clipped artwork slot and one `data-student-artwork` rectangle, and create its shell through `FabricProductShellFactory.create()`.

Use this exact fixture:

```ts
const CLIPPED_SHELL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <defs>
    <clipPath id="front-clip">
      <rect x="300" y="280" width="400" height="440" rx="30" />
    </clipPath>
  </defs>
  <g data-region="body" fill="#E8E2D8">
    <rect x="250" y="120" width="500" height="760" rx="80" />
  </g>
  <g data-layer="artwork-slot" data-artwork-slot="primary" clip-path="url(#front-clip)">
    <rect data-student-artwork="base-art" x="300" y="280" width="400" height="440" fill="#FFFFFF" />
  </g>
  <g data-material-treatment="fabric" opacity="0.08">
    <rect x="0" y="0" width="1000" height="1000" fill="#172033" />
  </g>
</svg>`;
```

Add a test that:

```ts
it("adds and edits clipped artwork children with one parent mutation per action", async () => {
  const canvas = new FakeCanvas();
  const shell = await new FabricProductShellFactory().create({
    id: "product-1",
    shellId: "drinkware-classic-can",
    accessibleName: "Classic can",
    svg: CLIPPED_SHELL_SVG
  });
  canvas.objects = [shell];
  canvas.activeObject = shell;
  const factory = new FabricObjectFactory();
  const raster = new FabricImage(document.createElement("img"), {
    width: 120,
    height: 80
  });
  raster.set({
    objectId: "art-image-1",
    elementKind: "image",
    assetId: "fruit-1",
    accessibleName: "Sliced citrus"
  });
  vi.spyOn(factory, "createRaster").mockResolvedValue(raster);
  const adapter = new FabricCanvasAdapter(
    canvas as unknown as Canvas,
    factory
  );
  const target = { productId: "product-1", slotId: "primary" };
  const mutations: CanvasMutation[] = [];
  adapter.subscribe((mutation) => mutations.push(mutation));
  const before = {
    width: shell.width,
    height: shell.height,
    scaleX: shell.scaleX,
    scaleY: shell.scaleY
  };

  await adapter.addArtworkText(target, {
    id: "art-text-1",
    value: "Fizz first",
    accessibleName: "Front headline"
  });
  await adapter.addArtworkShape(target, {
    id: "art-shape-1",
    kind: "ellipse",
    fill: "#F2385A",
    accessibleName: "Front burst"
  });
  await adapter.addArtworkRaster(target, {
    id: "art-image-1",
    assetId: "fruit-1",
    sameOriginUrl: `${window.location.origin}/catalog/fruit.png`,
    accessibleName: "Sliced citrus"
  });
  adapter.setArtworkText(target, "art-text-1", "Fizz together");

  const surface = productArtworkSurface(shell);
  expect(canvas.objects).toEqual([shell]);
  expect(canvas.activeObject).toBe(shell);
  expect(surface.getObjects()).toEqual(expect.arrayContaining([
    expect.objectContaining({ objectId: "art-text-1", text: "Fizz together" }),
    expect.objectContaining({ objectId: "art-shape-1", elementKind: "shape" }),
    expect.objectContaining({ objectId: "art-image-1", assetId: "fruit-1" })
  ]));
  expect(surface.getObjects().filter(({ objectId }) => objectId)).toHaveLength(3);
  expect(shell).toMatchObject(before);
  expect(mutations).toEqual(Array.from({ length: 4 }, () => ({
    type: "modified",
    objectId: "product-1"
  })));

  const restored = await Group.fromObject(shell.toObject());
  expect(productArtworkSurface(restored).getObjects()).toEqual(expect.arrayContaining([
    expect.objectContaining({ objectId: "art-text-1", text: "Fizz together" }),
    expect.objectContaining({ objectId: "art-shape-1" }),
    expect.objectContaining({ objectId: "art-image-1", assetId: "fruit-1" })
  ]));
});
```

Add this rejection test for `slotId: "missing"` and a rejected raster factory promise:

```ts
it("leaves product artwork unchanged when a target or raster is rejected", async () => {
  const canvas = new FakeCanvas();
  const shell = await new FabricProductShellFactory().create({
    id: "product-1",
    shellId: "drinkware-classic-can",
    accessibleName: "Classic can",
    svg: CLIPPED_SHELL_SVG
  });
  canvas.objects = [shell];
  canvas.activeObject = shell;
  const factory = new FabricObjectFactory();
  const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas, factory);
  const mutations: CanvasMutation[] = [];
  adapter.subscribe((mutation) => mutations.push(mutation));
  const before = JSON.stringify(shell.toObject());

  await expect(adapter.addArtworkText(
    { productId: "product-1", slotId: "missing" },
    { id: "bad-text", value: "No", accessibleName: "Bad text" }
  )).rejects.toThrow("invalid artwork slot");
  vi.spyOn(factory, "createRaster").mockRejectedValueOnce(new Error("Synthetic raster failure"));
  await expect(adapter.addArtworkRaster(
    { productId: "product-1", slotId: "primary" },
    {
      id: "bad-image",
      assetId: "bad-asset",
      sameOriginUrl: `${window.location.origin}/catalog/bad.png`,
      accessibleName: "Bad image"
    }
  )).rejects.toThrow("Synthetic raster failure");

  expect(JSON.stringify(shell.toObject())).toBe(before);
  expect(canvas.objects).toEqual([shell]);
  expect(canvas.activeObject).toBe(shell);
  expect(mutations).toEqual([]);
});
```

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run 'web/src/fabric/object-command-service.test.ts' 'web/src/fabric/fabric-canvas-adapter.test.ts'
```

Expected: FAIL because the address and surface-scoped methods do not exist.

- [ ] **Step 4: Add the port contract**

In `canvas-port.ts`, add:

```ts
export interface ArtworkSurfaceAddress {
  productId: string;
  slotId: string;
}
```

Add these methods to `CanvasPort`:

```ts
addArtworkText(address: ArtworkSurfaceAddress, input: NewTextInput): Promise<void>;
addArtworkShape(address: ArtworkSurfaceAddress, input: NewShapeInput): Promise<void>;
addArtworkRaster(address: ArtworkSurfaceAddress, input: NewRasterInput): Promise<void>;
setArtworkText(address: ArtworkSurfaceAddress, id: string, value: string): void;
```

- [ ] **Step 5: Add validated command-service routing**

Import `ArtworkSurfaceAddress`. Add these public methods to `ObjectCommandService`:

```ts
async addArtworkText(
  address: ArtworkSurfaceAddress,
  value: string,
  accessibleName = value
): Promise<string> {
  const target = this.#artworkAddress(address);
  const text = value.trim();
  if (!text) throw new Error("Text must not be empty");
  const id = this.#nextId();
  await this.port.addArtworkText(target, {
    id,
    value: text,
    accessibleName: this.#required(accessibleName, "accessible name")
  });
  this.port.setSelected(target.productId);
  return id;
}

async addArtworkShape(
  address: ArtworkSurfaceAddress,
  input: AddShapeCommand
): Promise<string> {
  const target = this.#artworkAddress(address);
  const kinds: ShapeKind[] = ["rect", "ellipse", "triangle", "line"];
  if (!kinds.includes(input.kind)) throw new Error("Unsupported shape kind");
  const id = this.#nextId();
  await this.port.addArtworkShape(target, {
    id,
    kind: input.kind,
    fill: this.#required(input.fill, "fill"),
    accessibleName: this.#required(
      input.accessibleName ?? `${input.kind} shape`,
      "accessible name"
    )
  });
  this.port.setSelected(target.productId);
  return id;
}

async addArtworkRaster(
  address: ArtworkSurfaceAddress,
  input: AddRasterCommand
): Promise<string> {
  const target = this.#artworkAddress(address);
  const id = this.#nextId();
  await this.port.addArtworkRaster(target, {
    id,
    assetId: this.#required(input.assetId, "asset id"),
    sameOriginUrl: this.#required(input.sameOriginUrl, "raster URL"),
    accessibleName: this.#required(input.accessibleName, "accessible name")
  });
  this.port.setSelected(target.productId);
  return id;
}

setArtworkText(
  address: ArtworkSurfaceAddress,
  id: string,
  value: string
): void {
  this.port.setArtworkText(
    this.#artworkAddress(address),
    this.#required(id, "artwork object id"),
    this.#required(value, "text")
  );
}
```

Add this private validator:

```ts
#artworkAddress(address: ArtworkSurfaceAddress): ArtworkSurfaceAddress {
  return {
    productId: this.#required(address.productId, "product id"),
    slotId: this.#required(address.slotId, "artwork slot")
  };
}
```

- [ ] **Step 6: Implement atomic nested placement in the adapter**

Import `ArtworkSurfaceAddress` and `productArtworkSurface`. Add the four port methods:

```ts
async addArtworkText(address: ArtworkSurfaceAddress, input: NewTextInput): Promise<void> {
  this.#addArtwork(address, this.factory.createText(input));
}

async addArtworkShape(address: ArtworkSurfaceAddress, input: NewShapeInput): Promise<void> {
  this.#addArtwork(address, this.factory.createShape(input));
}

async addArtworkRaster(address: ArtworkSurfaceAddress, input: NewRasterInput): Promise<void> {
  this.#addArtwork(address, await this.factory.createRaster(input));
}

setArtworkText(address: ArtworkSurfaceAddress, id: string, value: string): void {
  if (!value.trim()) throw new Error("Text must not be empty");
  const { product, surface } = this.#artworkContext(address);
  const object = surface.getObjects().find((candidate) => candidate.objectId === id);
  if (!(object instanceof Textbox) || object.elementKind !== "text") {
    throw new Error(`${id} is not editable artwork text`);
  }
  if (object.text === value) return;
  object.set("text", value);
  object.initDimensions();
  this.#fitArtworkObject(surface, object);
  this.#finishArtworkMutation(product, surface);
}
```

Add these private helpers:

```ts
#artworkContext(address: ArtworkSurfaceAddress): {
  product: FabricObject;
  surface: Group;
} {
  if (!address.productId.trim() || !address.slotId.trim()) {
    throw new Error("Artwork surface address must not be empty");
  }
  const product = this.#get(address.productId);
  return {
    product,
    surface: productArtworkSurface(product, address.slotId)
  };
}

#addArtwork(address: ArtworkSurfaceAddress, object: FabricObject): void {
  const { product, surface } = this.#artworkContext(address);
  this.#assertArtworkSurfaceGeometry(surface);
  object.setPositionByOrigin(surface.getCenterPoint(), "center", "center");
  object.setCoords();
  surface.add(object);
  object.set({ left: 0, top: 0, originX: "center", originY: "center" });
  this.#fitArtworkObject(surface, object);
  this.#finishArtworkMutation(product, surface);
}

#assertArtworkSurfaceGeometry(surface: Group): void {
  if (![surface.width, surface.height].every(Number.isFinite) ||
      surface.width <= 0 || surface.height <= 0) {
    throw new Error("Artwork surface geometry is invalid");
  }
}

#fitArtworkObject(surface: Group, object: FabricObject): void {
  this.#assertArtworkSurfaceGeometry(surface);
  const width = Math.max(1, object.getScaledWidth());
  const height = Math.max(1, object.getScaledHeight());
  const factor = Math.min(
    1,
    (surface.width * 0.82) / width,
    (surface.height * 0.82) / height
  );
  if (factor < 1) {
    object.set({
      scaleX: object.scaleX * factor,
      scaleY: object.scaleY * factor
    });
  }
  object.dirty = true;
  object.setCoords();
}

#finishArtworkMutation(product: FabricObject, surface: Group): void {
  surface.dirty = true;
  product.dirty = true;
  surface.setCoords();
  product.setCoords();
  this.canvas.requestRenderAll();
  this.#emit("modified", product);
}
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run the Step 3 command again.

Expected: both focused files pass; nested content remains clipped and serialized, the canvas keeps one top-level product, and every successful action emits one parent mutation.

- [ ] **Step 8: Run full verification**

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\typescript\bin\tsc' --noEmit
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'node_modules\vitest\vitest.mjs' run
git diff --check
```

Expected: TypeScript exits 0, all Vitest files pass, and the diff has no whitespace errors.

- [ ] **Step 9: Commit the scoped slice**

```powershell
git add -- web/src/fabric/canvas-port.ts web/src/fabric/object-command-service.ts web/src/fabric/fabric-canvas-adapter.ts web/src/fabric/object-command-service.test.ts web/src/fabric/fabric-canvas-adapter.test.ts
git commit -m "feat: add nested product artwork commands"
```

Expected: one focused commit; unrelated untracked files remain untouched.

## Self-Review

- Spec coverage: target validation, ID generation, nested placement, centring/fitting, same-origin raster reuse, text editing, serialization, stable outer geometry, parent selection, exact mutation count and rejection atomicity are covered.
- Deliberately deferred: nested transforms/crop/z-order/remove, pointer targeting, drawing, recursive campaign validation, child-ID remapping during product duplication, catalogue reference reconciliation, history UI, and visible artwork-mode controls.
- Placeholder scan: clear; all new types, signatures, helpers, tests and commands are concrete.
- Type consistency: every layer uses `ArtworkSurfaceAddress { productId, slotId }` and the four identical surface method names.
