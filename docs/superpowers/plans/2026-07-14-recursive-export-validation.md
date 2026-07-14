# Recursive Artwork Export Validation

**Goal:** Make publication validate nested semantic artwork rasters with the same source, catalogue-reference, attribution, Openverse-canonicality, and blob-backed catalogue rules already applied to top-level rasters.

**Architecture:** Reuse the recursive campaign-semantic-object collector. Keep the existing raw object-tree `src` safety walk unchanged so decorative and clip-path sources remain origin-checked. Do not introduce new `sourceHash` rules or require local-blob references for ordinary owned non-catalogue blobs.

## Task 1: Recursive exporter validation

**Files:**

- Modify: `web/src/export/campaign-exporter.ts`
- Modify: `web/src/export/campaign-exporter.test.ts`

### 1. Write failing tests

Add a helper that moves the existing semantic photo under a semantic product shell and decorative artwork-slot group. Prove:

- a nested catalogue raster with a matching catalogue reference publishes;
- a nested image without `src` fails before rendering;
- a nested `/catalog/` raster without a catalogue reference fails;
- a nested canonical Openverse URL mismatch fails;
- a nested blob-backed catalogue raster without a matching local-blob reference fails.

Failure tests must assert that PNG rendering was not attempted. Run only the exporter tests and record the expected RED failures.

### 2. Implement the minimum recursive change

- Import `collectCampaignSemanticObjects` and `campaignSemanticObjectMap`.
- Use the collector for mandatory raster-source checks.
- Use the semantic map for asset-reference identity and catalogue-object matching.
- Iterate the semantic map for catalogue-raster, canonical Openverse, and blob-backed catalogue checks.
- Preserve existing messages and URL predicates.
- Leave the generic recursive `src` walk unchanged.

### 3. Verify

Run:

- focused exporter tests;
- TypeScript `--noEmit`;
- full Vitest suite;
- `git diff --check`.

Commit only the two scoped files.

## Acceptance criteria

- Nested and top-level semantic rasters obey identical publication rules.
- Decorative descendants remain exempt from semantic reference requirements.
- Any nested/decorative/clip-path `src` remains origin-checked by the existing raw safety walk.
- Existing owned non-catalogue blob behaviour is unchanged.
- No new `sourceHash`, schema, checklist, persistence, catalogue, UI, or public-API contract is introduced.
