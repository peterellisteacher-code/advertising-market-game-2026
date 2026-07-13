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
