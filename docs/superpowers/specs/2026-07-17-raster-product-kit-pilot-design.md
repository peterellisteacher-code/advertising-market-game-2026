# Raster Product Kit Pilot Design

**Status:** Approved implementation slice under Peter's standing direction to
continue the one-stop-shop raster product creator.

**Scope:** One honest, playable modular Product Kit carried from reviewed local
PNGs through certified composition, price calculation, campaign save, and
save/reopen in the existing Fabric creator. This slice proves the architecture;
catalogue breadth, cloud synchronisation, AI generation, grid-building UI, and
the full Canva-like editor remain later slices.

## Purpose

Students need to see a product change immediately when they choose a structural
option, while the game keeps enough semantic information to calculate cost and
reconstruct the product. A cup handle, bottle lid, or comparable component must
be a real compatible raster layer attached to a certified base, not a flattened
pretend choice and not an SVG.

The first pilot must demonstrate the complete student loop:

1. choose a base;
2. choose a compatible component;
3. see the PNG layers compose in the product preview;
4. see one logical cost line for each chosen component;
5. place one semantic product on the campaign canvas;
6. save, close, reopen, and recover the same appearance and composition data.

## Approaches considered

1. **Semantic Fabric group backed by the Product Kit runtime — chosen.** The
   certified five-layer plan creates one top-level product group. Its child
   rasters are decorative render parts; the group owns the semantic identity,
   price snapshot, and composition reference. This preserves editability,
   deterministic rebuilding, and one-price-per-logical-component behavior.
2. **Flatten the Product Kit immediately to one PNG.** This is simpler to place
   and publish, but loses structural choices, prevents later editing, and makes
   price/reconciliation data easy to orphan.
3. **Generate each composed product through an online image model.** This can
   make attractive final mockups later, but is unsuitable as the primary editor:
   it adds cost and latency, is non-deterministic, and breaks offline classroom
   operation.

The chosen approach can still produce a flattened PNG for the market card while
retaining the semantic group and composition reference as the authoritative
campaign state.

## Architecture

### Pilot bundle

The existing offline catalogue remains the authority for raster records. Two
same-origin sidecars are added beside its catalog.json:

- product-kit-v1.json: the parsed Product Kit catalogue and certifications;
- product-kit-pricing-v1.json: logical Product Kit price identities and costs.

The loader derives both URLs from the offline catalogue URL, projects exact
offline records into ProductKitCatalogueContext, and admits the Product Kit
catalogue only through parseProductKitCatalogue. It performs no CDN or network
fallback. Every source URL is derived from the exact canonical master.png path
already bound by the catalogue parser.

### Runtime and rendering

createProductKitRuntime remains the only certification-resolution boundary.
The UI sends a semantic ProductKitCompositionRequest and receives an immutable
five-layer ProductKitLayerPlan.

The Fabric compositor loads PNGs only. It restores each trimmed raster to its
declared original frame before mapping it into base-pixel space:

- rear component fragments;
- the base body;
- front component fragments;
- the artwork slot;
- overlay component fragments.

Affine socket/grip entries use the certified normalized transform. Grid entries
use the exact normalized integer-cell bounds. Child order is identical to the
runtime layer order. A failed image load, hash/source mismatch, invalid matrix,
or missing plan aborts the whole addition; no partial group reaches the canvas.

The outer Fabric group is the sole selectable product object. Child rasters are
decorative and carry no independent campaign identity. Generic duplication is
disabled for this pilot so a copied visual cannot escape its price/reference
transaction.

### Pricing

Product Kit priceAssetId values are a separate logical namespace and are not
looked up through RasterPricingIndex. A strict Product Kit pricing parser binds
every base and component price identity used by the admitted catalogue.

Each ProductKitLayerPlan.pricedItems entry becomes exactly one cost line:

- the base is priced once;
- a split rear/front handle is priced once;
- repeated grid placements are priced separately.

The resulting quote is converted through the existing ProductBuildSnapshot
path so the money panel, audience work, AIDA work, route choices, and market
logic continue to consume one established economics representation.

### Semantic campaign reference

One strict product-kit composition reference is stored against the outer group.
It contains:

- reference kind and version;
- root objectId;
- Product Kit pack ID;
- offline catalogue pack ID and hash;
- exact ProductKitCompositionRequest;
- exact priced-item identity to priceAssetId mapping.

It contains no file-system paths, blob URLs, Fabric child JSON, SVG, or external
service data. Fabric JSON remains the immediate visual reload source; the
reference is the authority for later validation, editing, repricing, and stale
catalogue detection.

If the manifest is unavailable during reopen, the already saved Fabric group
remains visible but structural editing becomes unavailable. The game never
trusts or silently rebuilds from stale certification data.

## Integration boundary

New Product Kit modules own loading, pricing, composition, and reference
validation. Existing files receive only narrow seams:

- elementKind gains product-kit;
- Fabric custom properties persist Product Kit identity;
- the canvas port and command service gain one atomic addProductKit operation;
- campaign-document validation recognises the strict reference;
- the placement queue gains one Product Kit command;
- the existing product-builder panel host renders the pilot chooser instead of
  creating a second editor.

No IndexedDB schema migration is required. DraftStore already persists validated
Fabric state and campaign references. Local debounced autosave and remote cloud
synchronisation are separate follow-up slices because they have independent
failure and concurrency semantics.

## Student interaction

The first panel is deliberately small but genuine:

- base cards show only reviewed pilot choices;
- each fixed mount frame shows certified compatible components;
- selecting a component updates preview and cost immediately;
- one primary action places the finished product;
- unavailable or stale combinations are absent rather than disabled mysteries.

Student-facing copy avoids assignment, unit, and task. The panel uses visible
labels and keyboard-operable controls; no meaning depends on colour or hover.
Pair play remains turn-and-role based on one computer.

## Error handling and rollback

- Bundle parsing is all-or-nothing and defaults to unavailable.
- Composition planning is all-or-nothing and returns no partial plan.
- Fabric images are loaded before the canvas transaction commits.
- Canvas addition, semantic reference update, economics snapshot, and history
  commit form one rollback-capable placement transaction.
- Save/reopen keeps a valid rendered group even when the Product Kit sidecar is
  temporarily unavailable, but blocks structural editing until exact identity
  is restored.
- Errors use existing assertive creator feedback and never expose internal
  hashes or paths to students.

## Verification

Implementation follows red-green TDD. Acceptance requires:

- loader denial for wrong hash, path, review flags, dimensions, or unavailable
  same-origin sidecars;
- exact trim/original-frame math for unequal aspect ratios;
- split grip fragments ordered rear/body/front and priced once;
- integer-grid bounds supported by the compositor even though grid authoring UI
  is deferred;
- image-load failure and transaction rollback leaving canvas/document/history
  unchanged;
- strict semantic-reference round trip;
- choose, preview, price, place, save, close, reopen with no SVG request;
- all Product Kit, TypeScript, full browser, build, and export gates green.

## Non-goals

- no SVG loading, generation, conversion, or fallback;
- no external Canva dependency;
- no AI generation in the deterministic composition path;
- no cloud autosave or multiplayer state in this slice;
- no generic duplicate of a Product Kit;
- no grid-building controls yet;
- no full catalogue-scale rollout before the pilot round trip is proven;
- no modification of Claude-owned or unrelated work.
