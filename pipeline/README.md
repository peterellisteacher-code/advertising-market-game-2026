# Asset pipeline

This package turns authored product images and manifests into deterministic,
browser-ready catalogue assets. It does not contact the network, replace an
existing output tree or decide that an image is brand-safe.

The game build consumes the reviewed outputs committed under
`catalog/generated/`. Pipeline commands are authoring tools; they require
explicit source and destination paths and refuse a non-empty destination.

## Isolated setup

```powershell
python -m venv pipeline\.venv
pipeline\.venv\Scripts\python.exe -m pip install --requirement pipeline\requirements.txt
pipeline\.venv\Scripts\python.exe -m pip install --no-deps --no-build-isolation --editable pipeline
```

## Contracts

- `catalog/schemas/catalog-asset-v1.schema.json`: browser catalogue records
- `catalog/schemas/asset-source-v1.schema.json`: authored source manifests
- `catalog/schemas/catalog-asset-v1.corpus.json`: shared Python and TypeScript
  positive and negative cases

Source paths are POSIX-relative to their source directory. IDs are portable
lowercase kebab case. Hashes name the declared source bytes; `masterSha256`
names the canonical normalized `master.png` bytes.

Use each authoring command's `--help` output for its required explicit inputs:

```powershell
pipeline\.venv\Scripts\python.exe -m asset_pipeline.build_pack --help
pipeline\.venv\Scripts\python.exe -m asset_pipeline.product_builder --help
pipeline\.venv\Scripts\python.exe -m asset_pipeline.product_shells --help
pipeline\.venv\Scripts\python.exe scripts\build_raster_catalog.py --help
```

Generated QA reports belong in `catalog/reports/`, which is intentionally
ignored. Reviewed runtime outputs belong in a new versioned directory under
`catalog/generated/`.

## Generate the performance fixture

```powershell
pipeline\.venv\Scripts\python.exe -m asset_pipeline.synthetic_catalog `
  --count 15000 `
  --seed 20260710 `
  --out catalog\generated\performance-fixtures\catalog-15000.json
```

The fixture is ignored and rebuilt on demand.

## Verify

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline\tests -q
pipeline\.venv\Scripts\python.exe -m asset_pipeline.qa_report `
  --catalog catalog\generated\performance-fixtures\catalog-15000.json `
  --root . --require-masters 1 --require-categories 10 --require-records 15000
```
