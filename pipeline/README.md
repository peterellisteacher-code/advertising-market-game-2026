# Asset pipeline

This package turns authored product images and chroma sheets into deterministic,
browser-ready catalogue assets. It never contacts the network, replaces an
existing output tree, or decides that an image is brand-safe.

## Isolated setup

```powershell
& 'C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m venv pipeline\.venv
pipeline\.venv\Scripts\python.exe -m pip install --no-cache-dir -r pipeline\requirements.txt
pipeline\.venv\Scripts\python.exe -m pip install --no-deps --no-build-isolation -e pipeline
```

All direct commands below use `pipeline\.venv\Scripts\python.exe`.

## Contracts

- `catalog/schemas/catalog-asset-v1.schema.json`: browser catalogue records.
- `catalog/schemas/asset-source-v1.schema.json`: authored source manifests.
- `catalog/schemas/catalog-asset-v1.corpus.json`: shared Python/TypeScript
  positive and negative cases.

Source paths are POSIX-relative to the source directory. IDs are portable
lowercase kebab case. Hashes name the declared source bytes; `masterSha256`
names the canonical normalized `master.png` bytes.

## Build a reviewed source pack

```powershell
pipeline\.venv\Scripts\python.exe -m asset_pipeline.build_pack `
  --source catalog\source\creator-foundation-100 `
  --materials catalog\source\materials-v1 `
  --out catalog\generated\offline-core-v1 `
  --report catalog\reports\creator-foundation-100
```

The output and report directories must be absent or empty. A failed or repeated
run is never pruned automatically.

## Generate the performance fixture

```powershell
pipeline\.venv\Scripts\python.exe -m asset_pipeline.synthetic_catalog `
  --count 15000 `
  --seed 20260710 `
  --out catalog\generated\performance-fixtures\catalog-15000.json
```

The generated fixture is intentionally ignored and rebuilt on demand. It uses
one real master/preview/thumbnail tree for all 15,000 records.

## Verify

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline\tests -q
pipeline\.venv\Scripts\python.exe -m asset_pipeline.qa_report `
  --catalog catalog\generated\performance-fixtures\catalog-15000.json `
  --root . --require-masters 1 --require-categories 10 --require-records 15000
```
