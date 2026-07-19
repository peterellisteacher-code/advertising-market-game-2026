# Raster Product Kit Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development task-by-task. Steps use checkbox syntax for tracking. Work only in the exact files named by the active task and return concise red/green evidence.

**Goal:** Ship one PNG-only reusable-tumbler Product Kit that students can
configure with a compatible lid, price, place, save, and reopen as one semantic
campaign object.

**Architecture:** Two same-origin sidecars bind the pilot to exact reviewed
offline raster records. Pure loader, pricing, matrix, and reference modules feed
the certified Product Kit runtime. A Fabric compositor creates one semantic
top-level group from the immutable five-layer plan; a placement transaction
commits the group, price snapshot, and campaign reference atomically.

**Tech Stack:** TypeScript 7, Vitest 4, Fabric 7.4, Zod 4, IndexedDB through the
existing DraftStore, static PNG assets, no SVG.

## Global Constraints

- Product visuals use PNG only. Do not import, load, generate, convert, or fall
  back to SVG.
- Use only reviewed, brand-free, offline records already admitted by
  offline-core-v1.
- Pilot base asset:
  89-beverage-container-bases-r03c05, SHA-256
  d87a3718df6bd9a00e667a8c50729c3c84a3bd33bfe395df86b9992f49eb7abf.
- Pilot lid asset:
  90-beverage-container-add-ons-r04c01, SHA-256
  6156af7416af78a8bb53a93c540ff2745caa77140f808213227487985e3580a5.
- Offline catalogue SHA-256:
  8549a4647cb996b6afd6f74f2c8c1e64f74807d915046d7cef7f394c3089d907.
- Use the shared 400 by 500 logical frame. Base trim is x 127, y 240,
  width 146, height 238. Lid trim is x 83, y 80, width 233, height 164.
- The lid socket maps the visible component edge at (0.49875, 0.448) to the
  visible body rim at (0.5, 0.52), at exact scale 0.7 with zero rotation and
  no mirror. These contacts exclude the 20-pixel transparent extraction pad.
- Fixed layer order remains rear, body, front, artwork, overlay.
- One lid placement produces one cost line even though later components may
  contain multiple raster fragments.
- Student-facing copy does not use assignment, unit, or task.
- No cloud write, AI generation, grid-authoring controls, generic Product Kit
  duplication, or grip-sleeve option in this slice.
- Preserve all unrelated dirty work. Do not clean, stash, reset, mass-stage, or
  commit this shared branch.

---

### Task 1: Admit the exact pilot bundle and pricing sidecar

**Files:**

- Create: catalog/generated/offline-core-v1/product-kit-v1.json
- Create: catalog/generated/offline-core-v1/product-kit-pricing-v1.json
- Create: web/src/product-kit/product-kit-loader.ts
- Create: web/src/product-kit/product-kit-loader.test.ts
- Create: web/src/product-kit/product-kit-pricing.ts
- Create: web/src/product-kit/product-kit-pricing.test.ts

**Interfaces:**

- Consumes: OfflineCatalogueWithHash from catalogue-store, exact offline
  catalogue records, parseProductKitCatalogue, createProductKitRuntime.
- Produces:

      export interface ProductKitRasterSource {
        readonly assetId: string;
        readonly masterSha256: string;
        readonly masterUrl: string;
      }

      export interface ProductKitPrice {
        readonly priceAssetId: string;
        readonly groupId: string;
        readonly groupLabel: string;
        readonly kind: ProductChoiceKind;
        readonly label: string;
        readonly costCents: number;
      }

      export interface ProductKitPricingIndex {
        readonly packId: string;
        readonly pricingVersion: number;
        readonly blueprintTitleByKitId: ReadonlyMap<string, string>;
        readonly byPriceAssetId: ReadonlyMap<string, ProductKitPrice>;
      }

      export interface LoadedProductKitBundle {
        readonly catalogue: ProductKitCatalogue;
        readonly runtime: ProductKitRuntime;
        readonly rasterSources: ReadonlyMap<string, ProductKitRasterSource>;
        readonly pricing: ProductKitPricingIndex;
      }

      export function loadProductKitBundle(
        offlineCatalogueUrl: string | undefined,
        offline: OfflineCatalogueWithHash,
        options?: { readonly fetchImpl?: typeof fetch }
      ): Promise<LoadedProductKitBundle | null>;

      export function parseProductKitPricing(
        value: unknown,
        catalogue: ProductKitCatalogue
      ): ProductKitPricingIndex | null;

- [x] **Step 1: Write failing loader and pricing tests**

Add tests that supply a two-record OfflineCatalogueWithHash, intercept exactly
two same-origin requests beside catalog.json, and prove:

      const bundle = await loadProductKitBundle(
        "/catalog/generated/offline-core-v1/catalog.json",
        { records: [baseRecord, lidRecord], catalogSha256: CATALOG_HASH },
        { fetchImpl }
      );
      expect(bundle?.catalogue.packId).toBe("pk1-pilot-drinkware");
      expect(bundle?.runtime.resolvePair({
        kind: "socket",
        kitId: "pk1-tumbler-kit",
        mountFrameId: "pk1-tumbler-lid-frame",
        componentId: "pk1-flat-lid"
      })).toMatchObject({ transform: { scale: 0.7, rotationDegrees: 0 } });
      expect([...bundle!.rasterSources.keys()]).toEqual([
        "89-beverage-container-bases-r03c05",
        "90-beverage-container-add-ons-r04c01"
      ]);

The table-driven denial cases must independently change the catalogue hash,
record hash, record delivery, classroomReviewed, brandFree, master path,
dimensions, sidecar MIME type, Product Kit schema, certification fingerprint,
pricing schema, missing price identity, and duplicate price identity.

- [x] **Step 2: Run the focused tests and verify RED**

Run:

    node_modules/.bin/vitest.cmd run --no-cache --configLoader runner web/src/product-kit/product-kit-loader.test.ts web/src/product-kit/product-kit-pricing.test.ts

Expected: FAIL because both modules are absent.

- [x] **Step 3: Author the exact Product Kit sidecar**

Use this manifest data:

      schema: product-kit@1
      version: 1
      packId: pk1-pilot-drinkware
      catalogPackId: offline-core-v1
      catalogSha256: 8549a4647cb996b6afd6f74f2c8c1e64f74807d915046d7cef7f394c3089d907
      pricingVersion: product-pricing@1
      connectorFormulaVersion: product-kit-connectors@1

The kit is pk1-tumbler-kit, titled Reusable tumbler, in socket mode. Use one
mount frame pk1-tumbler-lid-frame and slot pk1-tumbler-lid-slot. Use this
profile on kit and component:

      familyId: pk1-beverage-containers
      perspectiveId: pk1-front-view
      geometryId: pk1-tumbler-lid
      styleId: pk1-clean-outline

The base price identity is pk1-price-tumbler. The lid component is
pk1-flat-lid with front-layer price identity pk1-price-flat-lid. Use artwork
bounds x 0.36, y 0.58, width 0.28, height 0.25.

The exact certification fingerprint is:

    723aa58c6b5e7403f38b8f56b04020a1f2ed8979025466a822ef033aa030794e

The test must recompute it through computeCertificationFingerprint rather than
trusting this literal.

- [x] **Step 4: Author the exact pricing sidecar**

Use product-pricing@1, packId pk1-pilot-drinkware, pricingVersion 1. Define one
blueprint pk1-tumbler-kit with required base and lid groups. Define:

- pk1-price-tumbler: Product body, base, 480 cents;
- pk1-price-flat-lid: Flat lid, part, 70 cents.

Both choices are compatible only with pk1-tumbler-kit.

- [x] **Step 5: Implement the default-deny loader**

Derive sidecar URLs with new URL(relative, resolvedCatalogueUrl), require
same-origin pathname siblings, fetch application/json, and parse response text
as JSON. Project ProductKitCatalogueContext from the supplied offline records
without accepting any other source:

      const context = {
        catalogPackId: "offline-core-v1",
        catalogSha256: offline.catalogSha256,
        records: offline.records.map((record) => ({
          id: record.id,
          masterSha256: record.masterSha256,
          delivery: record.delivery,
          kind: record.kind,
          files: { master: record.files.master },
          dimensions: { ...record.dimensions },
          classroomReviewed: record.classroomReviewed,
          brandFree: record.brandFree
        }))
      };

Call parseProductKitCatalogue once, create the runtime only from its returned
object, parse the pricing sidecar, and build an immutable exact source map.
Catch network/JSON/validation failures and return null. Do not retry.

- [x] **Step 6: Implement strict logical pricing**

Parse product-pricing@1 through the existing quoteProductBuild validator using
one synthetic valid selection per blueprint, then additionally require every
kit/component priceAssetId to resolve exactly once and belong to that kit's
blueprint. Return a frozen map by price identity; do not use RasterPricingIndex.

- [x] **Step 7: Verify GREEN and record the scoped checkpoint**

Run the focused tests, all web/src/product-kit tests, and tsc --noEmit.
Expected: all pass. Mark Task 1 complete in this plan; do not commit.

**Scoped checkpoint evidence (2026-07-17):**

- RED: the focused command exited 1 for both absent implementation modules.
- Review correction RED: the isolated omitted-group-identity regression failed
  1/11 because the malformed pricing sidecar was accepted.
- Quality review RED: the unused orphan choice failed 1/12, raw literal and
  encoded dot-segment aliases failed 4/24, and byte/UTF-8 admission failed
  4/28 because each malformed input was accepted.
- Final bounded correction RED: the varying catalogue proxy failed 1/29,
  non-canonical raw URLs failed 8/37, bidirectional pricing failed 6/18, and
  chunk-overflow/deadline handling failed 2/39.
- GREEN: focused tests passed 57/57; all `web/src/product-kit` tests passed
  421/421 across 12 files; `tsc --noEmit` exited 0.

### Task 2: Prove raster-to-product matrix math

**Files:**

- Create: web/src/product-kit/product-kit-raster-matrix.ts
- Create: web/src/product-kit/product-kit-raster-matrix.test.ts

**Interfaces:**

- Consumes: ProductKitLayerEntry and the base raster frame.
- Produces:

      export type ProductKitRasterMatrix =
        readonly [number, number, number, number, number, number];

      export function productKitRasterMatrix(
        baseFrame: ProductKitRasterFrame,
        entry: ProductKitBaseRasterEntry | ProductKitComponentRasterEntry
      ): ProductKitRasterMatrix | null;

- [x] **Step 1: Write failing exact-coordinate tests**

For the base entry, assert matrix [1, 0, 0, 1, 0, 109] because the base trim
centre is (200, 359) and the logical-frame centre is (200, 250).

For the certified lid transform, assert that its trimmed bottom-centre maps to
(200, 245) in top-left logical coordinates and its visible width is 163.1
pixels. Add unequal-aspect, rotation, grid, signed-zero, non-finite, malformed
frame, and trim-overflow cases.

- [x] **Step 2: Run the matrix test and verify RED**

Expected: module-not-found failure.

- [x] **Step 3: Implement the pure affine conversion**

For an affine component with source frame S, base frame B, transform M, and
trim centre (cx, cy), return:

      A = B.width  * M.a / S.width
      Bm = B.height * M.b / S.width
      C = B.width  * M.c / S.height
      D = B.height * M.d / S.height
      E = B.width  * (M.a * cx / S.width +
                      M.c * cy / S.height + M.e) - B.width / 2
      F = B.height * (M.b * cx / S.width +
                      M.d * cy / S.height + M.f) - B.height / 2

Base entries use identity M and S equal to B. Grid entries replace M with the
axis-aligned normalizedBounds map. Reject any non-finite result or invalid
frame. Return a frozen six-number tuple.

- [x] **Step 4: Verify GREEN**

Run the focused matrix test, all Product Kit tests, and strict TypeScript.
Expected: all pass. Mark Task 2 complete; do not commit.

**Scoped checkpoint evidence (2026-07-17):**

- RED: the focused suite first failed because the matrix module was absent.
- Review RED cases covered hostile/non-exact input, valid frame disagreement,
  premature overflow, asymmetric cancellation, and one-ULP grid endpoints.
- GREEN: the matrix suite passed 28/28; combined Task 1 and Task 2 focused
  tests passed 85/85; all Product Kit tests passed 421/421 across 12 files;
  strict TypeScript exited 0.
- The final bounded corrections use detached exact-shape snapshots,
  overflow-aware four-term translation summation, exact base-frame identity,
  and two-ULP grid-edge canonicalisation. No further review loop was opened.

### Task 3: Build the PNG-only Fabric compositor

**Files:**

- Create: web/src/product-kit/fabric-product-kit-compositor.ts
- Create: web/src/product-kit/fabric-product-kit-compositor.test.ts

**Interfaces:**

- Consumes: ProductKitLayerPlan, exact rasterSources, root object ID and label.
- Produces:

      export interface FabricProductKitInput {
        readonly id: string;
        readonly accessibleName: string;
        readonly catalogue: ProductKitCatalogue;
        readonly plan: ProductKitLayerPlan;
        readonly rasterSources:
          ReadonlyMap<string, ProductKitRasterSource>;
      }

      export class FabricProductKitCompositor {
        create(input: FabricProductKitInput): Promise<Group>;
      }

- [x] **Step 1: Write failing compositor tests**

Inject a fake PNG loader that returns FabricImage objects with exact natural
dimensions. Assert:

- request order follows rear, body, front, overlay raster entries;
- no URL contains svg and no SVG loader is imported;
- raster source asset ID and SHA must both match the plan entry;
- image-load failure rejects without returning a group;
- the outer group alone has objectId, elementKind product-kit, selectable true;
- children are nonselectable, non-evented, and ordered exactly;
- one artwork-slot child is created from the plan bounds;
- serialize/load preserves Product Kit custom properties and child order.

- [x] **Step 2: Run the compositor test and verify RED**

Expected: module-not-found failure.

- [x] **Step 3: Implement preload, transform, and atomic group creation**

Validate the complete input through snapshotPlainData before loading. Resolve
every raster source first and require a canonical path ending in
/assets/<assetId>/master.png. Load every PNG before creating the group.

For each image:

      image.set({
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        objectCaching: true
      });
      util.applyTransformToObject(image, matrix);

Create artwork-slot groups in the artwork bucket using transparent Fabric Rect
geometry and bounds in the 400 by 500 logical frame. Create one fixed-layout
outer Group centered on the logical frame. Set its semantic Product Kit
properties only after all children are valid.

- [x] **Step 4: Verify GREEN**

Run the focused test, Product Kit suite, and strict TypeScript. Expected: all
pass. Mark Task 3 complete; do not commit.

**Scoped checkpoint evidence (2026-07-17):**

- RED: the focused suite first failed because the compositor module was absent.
- Review corrections each produced the intended RED: deferred catalogue
  mutation exposed raced pack/hash metadata; a second serialise/load cycle
  dropped Product Kit identity; neutralising the affine application changed the
  base translation from 109 to 0; and a misleading PNG-suffix path was admitted.
- GREEN: the compositor suite passed 21/21; all Product Kit tests passed
  442/442 across 13 files; strict TypeScript exited 0.
- Fresh independent re-review returned `SPEC: APPROVED`, `QUALITY: APPROVED`,
  with no findings.

### Task 4: Add semantic reference and economics projection

**Dependency resolution (2026-07-17):** Move the already mandated
`product-kit` addition to `ELEMENT_KINDS` from Task 5 into Task 4 so campaign
parsing and reconciliation can recognise the root they must validate. Keep the
Task 5 custom-property and command work in Task 5. Parse strict references
against the expected admitted catalogue/runtime; reconcile through an optional
Product Kit bundle argument so existing two-argument generic callers remain
unchanged. Quote selection group IDs use the indexed pricing group IDs while
enforcing one consistent pricing group per mount frame.

**Files:**

- Create: web/src/product-kit/product-kit-document.ts
- Create: web/src/product-kit/product-kit-document.test.ts
- Create: web/src/product-kit/product-kit-economics.ts
- Create: web/src/product-kit/product-kit-economics.test.ts
- Modify: web/src/domain/campaign-document.ts
- Modify: web/src/domain/campaign-document.test.ts
- Modify: web/src/domain/editor-object.ts
- Modify: web/src/product-builder/raster-product-build.ts
- Modify: web/src/product-builder/raster-product-build.test.ts

**Interfaces:**

      export interface ProductKitCompositionReference {
        readonly kind: "product-kit-composition";
        readonly version: 1;
        readonly objectId: string;
        readonly productKitPackId: string;
        readonly catalogPackId: string;
        readonly catalogSha256: string;
        readonly request: ProductKitCompositionRequest;
        readonly pricedItems: readonly ProductKitPricedItem[];
      }

      export function quoteProductKitComposition(
        plan: ProductKitLayerPlan,
        pricing: ProductKitPricingIndex
      ): ProductBuildQuote | null;

- [x] **Step 1: Write failing strict-reference and quote tests**

Prove a split component is priced once, repeated placements receive distinct
itemId lines, every price identity is required, totals are safe integers, and
the returned quote is detached/frozen. Prove exact reference round trip and
deny extra keys, stale hash, duplicate placement IDs, changed priced items,
paths, URLs, Fabric JSON, SVG strings, hostile proxies, and sparse arrays.

- [x] **Step 2: Verify RED**

Run the four focused files. Expected: missing modules and unrecognised reference.

- [x] **Step 3: Implement reference and economics modules**

Map each priced item to the exact indexed price. Use itemId as the quote
choiceId and retain priceAssetId only in the semantic reference. Build one
selection group for base and one per mount frame. Use suggestedPriceForCost and
deep-freeze the quote.

Use a strict Zod schema for Product Kit references and integrate only that kind
into campaign-document; leave existing generic references unchanged.

- [x] **Step 4: Reconcile the Product Kit build**

Preserve a Product Kit ProductBuildSnapshot only when:

- primaryObjectId still names an elementKind product-kit root;
- exactly one matching product-kit-composition reference exists;
- its priced items and build cost lines agree;
- pack/pricing identities agree.

Removal or mismatch clears the build, marketed choices, and market route. Never
reinterpret Product Kit child rasters as generic priced catalogue objects.

- [x] **Step 5: Verify GREEN**

Run focused tests, Product Kit tests, campaign-document, raster-product-build,
and strict TypeScript. Mark Task 4 complete; do not commit.

**Scoped checkpoint evidence (2026-07-17):**

- RED: the reference/economics modules were absent; campaign parsing rejected
  `product-kit` roots while accepting malformed Product Kit references through
  the generic fallback; reconciliation failed 5/8 cases by repricing decorative
  child rasters as a generic 2,850-cent product.
- Review correction RED: a component-first hostile plan sharing the base
  pricing group returned one merged selection rather than `null`.
- GREEN: the four Task 4 suites passed 33/33; Product Kit plus campaign and
  reconciliation tests passed 475/475 across 17 files; strict TypeScript exited
  0.
- Fresh independent re-review returned `SPEC: APPROVED`, `QUALITY: APPROVED`,
  with no findings.

### Task 5: Add one atomic Product Kit placement command

**Files:**

- Modify: web/src/domain/editor-object.ts
- Modify: web/src/fabric/fabric-custom-properties.ts
- Modify: web/src/fabric/canvas-port.ts
- Modify: web/src/fabric/fabric-canvas-adapter.ts
- Modify: web/src/fabric/fabric-canvas-adapter.test.ts
- Modify: web/src/fabric/object-command-service.ts
- Modify: web/src/fabric/object-command-service.test.ts
- Modify: web/src/catalogue/catalogue-runtime.ts
- Modify: web/src/catalogue/catalogue-runtime.test.ts

**Interfaces:**

      export interface NewProductKitInput extends FabricProductKitInput {}
      CanvasPort.addProductKit(input: NewProductKitInput): Promise<void>
      ObjectCommandService.addProductKit(
        input: Omit<NewProductKitInput, "id">
      ): Promise<string>
      CataloguePlacementQueue.enqueueProductKit(
        bundle: LoadedProductKitBundle,
        request: ProductKitCompositionRequest
      ): void

- [ ] **Step 1: Write failing port, command, and transaction tests**

Assert one ID allocation, one top-level add mutation, selected outer group, one
history transaction, one strict reference, and one ProductBuildSnapshot. Inject
failures at plan, PNG load, canvas add, document validation, and history commit;
each must restore canvas, campaign document, and history exactly.

- [ ] **Step 2: Verify RED**

Run the three focused suites. Expected: missing APIs.

- [ ] **Step 3: Add the narrow Fabric seams**

Add product-kit to ELEMENT_KINDS. Register only these custom properties:
productKitPackId, productKitId, productKitCatalogSha256, and
productKitComposition. Inject FabricProductKitCompositor into the adapter and
call the existing private atomic add path only after create resolves.

- [ ] **Step 4: Add the queue transaction**

Snapshot bundle/request on enqueue. Inside the existing host transaction:

1. require an open campaign;
2. plan through the admitted runtime;
3. quote through Product Kit pricing;
4. allocate a unique object ID;
5. preload and add the group;
6. create the strict semantic reference;
7. createProductBuildSnapshot with the group ID;
8. parse and commit the next campaign document;
9. verify canvas semantics and reference agreement.

On failure, reuse the queue's existing canvas/document rollback path. Do not add
a second transaction system.

- [ ] **Step 5: Verify GREEN**

Run focused suites, Product Kit tests, full browser tests with one worker, and
strict TypeScript. Mark Task 5 complete; do not commit.

### Task 6: Replace the dormant product builder with the pilot panel

**Files:**

- Create: web/src/product-kit/product-kit-panel.ts
- Create: web/src/product-kit/product-kit-panel.test.ts
- Modify: web/src/main.ts
- Modify: web/src/main.test.ts
- Modify: web/src/styles/editor.css
- Modify: web/src/styles/editor-css.test.ts

**Interfaces:**

      export class ProductKitPanel {
        constructor(
          host: HTMLElement,
          onPlace: (request: ProductKitCompositionRequest) => void
        );
        render(bundle: LoadedProductKitBundle): void;
        unavailable(): void;
      }

- [ ] **Step 1: Write failing accessible-panel tests**

Assert visible base and lid names, cost updates, keyboard-operable selection,
one Make this product action, polite unavailable status, no prohibited
student-facing words, and no HTML/SVG injection. The placement callback must
receive exactly:

      {
        kitId: "pk1-tumbler-kit",
        placements: [{
          kind: "socket",
          placementId: "placement-lid",
          mountFrameId: "pk1-tumbler-lid-frame",
          componentId: "pk1-flat-lid"
        }]
      }

- [ ] **Step 2: Write the failing main round-trip test**

Mock only same-origin JSON/PNG requests. Execute choose, place, money ledger,
save, close, reopen. Assert the same Product Kit root, composition reference,
cost of 550 cents, and visible child order return. Assert zero request URLs end
with .svg or use an SVG MIME type.

- [ ] **Step 3: Verify RED**

Run panel, main, and CSS tests. Expected: missing panel and integration.

- [ ] **Step 4: Implement the one-surface UI**

Mount ProductKitPanel in shell.productBuilderPanel. Leave the legacy SVG
ProductBuilderPanel files untouched but unmounted. Load the Product Kit bundle
only after loadOfflineCatalogueWithHash succeeds; otherwise show unavailable.
Queue placement through enqueueProductKit and existing flush/save ordering.

Use a compact card layout that preserves the existing advertising-studio
identity, visible focus, 44-pixel targets, and text labels. Do not introduce a
second product-builder region.

- [ ] **Step 5: Run complete verification**

Run:

    node_modules/.bin/vitest.cmd run --no-cache --configLoader runner web/src/product-kit web/src/main.test.ts web/src/styles/editor-css.test.ts
    node_modules/.bin/tsc.cmd --noEmit
    node_modules/.bin/vitest.cmd run --no-cache --configLoader runner --maxWorkers=1
    pipeline/.venv/Scripts/python.exe -m pytest pipeline/tests/test_product_kit_schema.py pipeline/tests/test_product_kit_pack.py -q
    npm run build

Expected: every command exits 0, no SVG request occurs in the Product Kit path,
and build/web contains both Product Kit sidecars plus both canonical PNGs.

- [ ] **Step 6: Perform browser smoke verification**

Open the built game through the existing local server. Verify at 1366 by 768:
base and lid are recognisable, lid alignment has no gap or severe overlap,
artwork bounds remain on the tumbler body, cost is readable, placement is one
selectable object, and save/reopen is unchanged. Capture one screenshot and
record any visual defect before expanding the catalogue.

- [ ] **Step 7: Record completion without committing**

Update this plan, the pilot design status, and verification evidence. Do not
stage or commit the shared dirty worktree.
