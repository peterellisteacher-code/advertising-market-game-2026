# Product Builder Browser Contract Inspection

Date: 2026-07-14 (Australia/Adelaide)

## Scope

- Lazy catalogue parser and 6,144-variant resolver: `189ee02`.
- Non-pruning browser-export shipping: `5ed19a1`.
- Duplicate metadata-form hardening: `1c54bc9`.

## Verification

- Focused Node export/bridge tests: 30 passed.
- TypeScript typecheck: passed.
- Full Vitest suite: 33 files, 371 tests passed.
- Independent closure review: PASS. A canonical single quoted attribute is accepted; unquoted-first, unquoted-second, single-quoted duplicate, and double-quoted duplicate forms are rejected.

## Assembled export

The production assembly was exercised with both product packs required:

```text
OFFLINE_CORE_DEFERRED catalog/generated/offline-core-v1/catalog.json
PRODUCT_SHELLS_COPIED catalog/generated/product-shells-v1-reviewed
PRODUCT_BUILDER_COPIED catalog/generated/product-builder-pilot-v1
WEB_EXPORT_ASSEMBLED_NON_DESTRUCTIVE
```

Static verification returned:

```text
PCK_STALE_SPIKE_EXPORT
WEB_EXPORT_STATIC_VERIFICATION_OK
```

`PCK_STALE_SPIKE_EXPORT` is the known diagnostic for the existing Godot PCK, not a product-builder contract failure. The product-builder pack remained 39 files / 75,162 bytes and was copied without pruning unrelated destination files.

## Visual builder closure

The refreshed Godot 4.7 web export was opened in the browser at 1280×720. The complete pilot path was exercised: Classic Can → Ring Top → Cobalt Citrus → Fabric → Colour base → custom front colour → canvas placement.

- Fabric lower and upper canvases both rendered at 656×369, preserving 16:9.
- The product used tight fixed selection bounds while retaining its component, artwork-slot and material-treatment children.
- The inspector remained visible; product and search placeholders were present.
- Placement changed the action to `Drop another copy` and announced `Classic Can landed · swap driver`.
- The artwork-options region used a contained 18 px internal scroll at 720p; asset results retained 81 px.
- Browser diagnostics contained Godot/Vite startup messages and no errors.
- At 1920×1080 the 320 px library, 1,296 px canvas region and 304 px inspector all remained inside the viewport.

Final verification on the exact tree:

```text
Test Files  36 passed (36)
Tests       406 passed (406)
TypeScript  passed
WEB_EXPORT_STATIC_VERIFICATION_OK
```
