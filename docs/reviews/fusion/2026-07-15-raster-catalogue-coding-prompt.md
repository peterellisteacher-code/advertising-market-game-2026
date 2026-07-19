Conduct a fresh, independent, adversarial coding and architecture review of the implementation described below. You have no prior review output. Do not assume the author is correct.

## Product requirements

- A classroom web game must ultimately offer at least 2,000 individually searchable and selectable raster product bases and compatible add-ons, sourced from strict 5×5 AI-generated PNG contact sheets.
- Newly generated runtime catalogue art must not be SVG.
- Extraction output uses transparent PNG masters, silhouette masks, and dark ink overlays. Accepted sheets require exactly 25 unique cells, no edge contact, and no safe-inset breaches.
- Every published cell needs an honest row/column-specific label and useful tags. Old reviewed extraction attempts remain preserved, but only the newest review for a source sheet may publish.
- Students choose a body colour. The browser must recolour the raster while preserving generated dark linework, place it on the Fabric canvas, and persist the exact tinted bytes locally with the campaign.
- Catalogue URLs and fetched layers remain canonical and same-origin. Malformed input fails closed. Build targets are additive and may not overwrite nonempty directories.
- Existing `catalog-asset@1` schema and its 20,000-record runtime limit remain authoritative.
- Two students share one computer. The UI needs to stay responsive with 2,000+ assets.

## Implemented Python packaging design

`pipeline/asset_pipeline/raster_catalog.py` introduces `build_raster_catalog(extracted, inventory, out, report)`.

1. It requires plain existing extraction/inventory roots, absent-or-empty output/report targets, non-overlap, and no symlink/reparse target ancestors.
2. It discovers directories matching `*-reviewed-vN`, groups them by the PNG stem stored in each `sheet-report.json`, and selects only the greatest review number. Ignored older review numbers are recorded.
3. For each selected sheet it requires:
   - `generated-raster-sheet@1`, matching directory identity;
   - exact 5×5 grid and 25 assets;
   - zero edge-contact and safe-inset failures;
   - type `base`, `add-on`, or `scene`;
   - source PNG located exactly in the supplied inventory root;
   - source SHA-256 matching the report;
   - same-stem `contact-sheet-inventory@1` JSON with 25 unique coordinates, safe labels, and sorted unique tags.
4. Each extracted cell must have matching sheet/type/category identity, passing per-cell QA, exact filenames `master.png`, `silhouette-mask.png`, `ink-overlay.png`, matching layer dimensions, nonempty master and ink, master alpha exactly equal to silhouette, and a fully transparent outer border.
5. Stable public IDs use `<source-stem>-rNNcNN`, independent of review version. Tags merge extraction tags, inventory tags, and base/add-on/scene type.
6. Preflight completes before output directories are created. Publishing then calls the existing deterministic `normalize_master` for PNG/WebP output and `prepare_masks` for a canonical body mask.
7. Every cell becomes one strict Pydantic `CatalogAsset`:
   - `raster-master` for base/scene, `component` for add-on;
   - canonical `/catalog/generated/offline-core-v1/assets/<id>/...` URLs;
   - `recolourZones: ["body"]`, body mask, `matte-plastic` material, default white-grey body;
   - reviewed/brand-free classroom attribution;
   - no anchors yet.
8. Records are ID-sorted and written using canonical JSON. Existing `verify_catalogue` checks every referenced image, dimensions, master hashes, sorting, counts, and categories. `qa.json` and deterministic source-selection provenance are emitted. Any QA error raises.
9. The builder allows at most 20,000 records and refuses duplicate stable IDs.

Representative selection and publishing pseudocode mirrors the implementation:

```python
versions.sort(key=lambda entry: entry[0])
review, directory, report = versions[-1]
ignored = tuple(item[0] for item in versions[:-1])

selected_sheets = [
    preflight_sheet(directory, payload, inventory_root, review, ignored)
    for directory, payload, review, ignored in select_reports(extracted_root)
]
all_assets = [asset for sheet in selected_sheets for asset in sheet.assets]
if len(all_assets) > 20_000 or len({a.id for a in all_assets}) != len(all_assets):
    raise RasterCatalogError(...)

for asset in sorted(all_assets, key=lambda item: item.id):
    destination = output_path / "assets" / asset.id
    normalized = normalize_master(asset.master, destination)
    prepare_masks(normalized.master_path, {"body": asset.silhouette}, ["body"], destination / "masks")
    records.append(CatalogAsset.model_validate({ ...strict catalogue record... }, strict=True))
```

Tests build 25-cell v1/v2 fixtures, prove v2 byte selection and stable IDs, validate every emitted record and reference, prove cross-root deterministic output/report digests, reject missing/malformed/duplicate-coordinate inventory, refuse nonempty targets without mutation, and reject failed sheet QA before writing. Current result: 4/4 pass.

## Implemented browser tint design

`web/src/catalogue/raster-template-tint.ts` exports:

```ts
validatedRasterColour(value: string): string
tintRasterTemplate(asset: CatalogAssetV1, colour: string, options?): Promise<Blob>
```

The function:

1. Accepts only six-digit hex and normalises it uppercase.
2. Requires an offline asset with a body recolour zone and body mask.
3. Requires exact canonical same-origin master and body-mask paths based on the asset ID, with no credentials, query, or fragment.
4. Fetches both as PNG with same-origin credentials, one 8-second abort signal, a 4 MiB limit per layer, and declared plus actual-size checks.
5. Decodes both with `createImageBitmap`, validates dimensions against catalogue metadata, and always closes decoded layers.
6. Uses a DOM canvas:

```ts
context.fillStyle = colour;
context.fillRect(0, 0, width, height);
context.globalCompositeOperation = "destination-in";
context.drawImage(mask.source, 0, 0, width, height);
context.globalCompositeOperation = "multiply";
context.drawImage(master.source, 0, 0, width, height);
context.globalCompositeOperation = "source-over";
canvas.toBlob(callback, "image/png");
```

7. Requires a nonempty PNG result no larger than 12 MiB.
8. Supports an injected decode/compose backend for deterministic tests.

Tests cover colour validation, exact fetch requests, same-origin canonical rejection before network, result composition inputs, decoded-layer cleanup, and dimension mismatch. Current result: 4/4 pass.

## Placement and persistence integration

`CataloguePlacementQueue.enqueue(asset, { bodyColour })` clones the asset/style and serialises it on the existing placement tail.

Inside catalogue placement:

```ts
const bodyColour = style !== undefined && asset.delivery === "offline" &&
  asset.recolourZones.includes("body")
  ? validatedRasterColour(style.bodyColour)
  : null;

const canvas = await host.getCanvas();
const objectId = createObjectId();
let localBlob;
let placementUrl = asset.files.master;

if (canonicalLivePhoto) {
  // existing bounded live-photo capture
} else if (bodyColour !== null) {
  const blob = await (host.tintRaster ?? tintRasterTemplate)(asset, bodyColour);
  validateNonemptyPngUnder12MiB(blob);
  const objectUrl = createObjectURL(blob);
  localBlob = { blobKey: `catalog-${objectId}`, blob, objectUrl };
  placementUrl = objectUrl;
}

await commands.addRaster({ assetId: asset.id, sameOriginUrl: placementUrl, accessibleName: asset.title });
reconcilePlacedFabricObject();
commit(nextDocumentWithCatalogReferenceAndOptionalLocalBlobReference, localBlob);
```

On any failure after attempted canvas addition it removes the Fabric object. If an object URL was created it revokes it. A successful tinted placement stores both the normal catalogue attribution reference and a `local-blob` reference; the existing draft store persists and rehydrates those bytes and replaces the object URL on reload.

Tests prove the selected uppercase colour reaches the tint renderer, the canvas uses the blob URL, catalogue and local-blob references both commit, attachment bytes are handed to persistence, invalid colour fails before canvas loading/tinting, and existing plain/live/generated placement behaviour remains green. Targeted catalogue/runtime/panel/shell result: 69/69 pass. TypeScript `tsc --noEmit` passes.

## Catalogue UI integration

- A labelled `Piece colour` native colour input defaults to `#e4572e`.
- Clicking any catalogue tile passes its asset plus the current colour. Non-recolourable assets ignore it.
- Reviewed body-mask assets receive a visible `Choose its colour` marker.
- Existing virtualised catalogue mounts at most 72 tiles, independently of the 2,000+ record count.
- Thumbnails remain lazy-loaded and canonical-URL guarded.

## Review request

Review functional correctness, deterministic-build integrity, security boundaries, failure and rollback behaviour, browser compatibility, performance at 2,000+ assets, test adequacy, and maintainability. Distinguish REQUIRED findings from optional improvements and cite the relevant subsystem/function. Finish with `READY` or `NOT READY`. Do not rewrite the product concept and do not propose SVG art.
