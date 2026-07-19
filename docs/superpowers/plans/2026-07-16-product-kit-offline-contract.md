# Product Kit Offline Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mirror the approved browser `product-kit@1` contract in the offline Python authoring pipeline and prove both runtimes accept and reject the same shared corpus.

**Architecture:** New files under `pipeline/product_kit/` provide strict Pydantic 2 models and a catalogue-binding graph validator. A Draft 2020-12 structural schema and shared corpus under `catalog/schemas/` prevent contract drift; semantic checks that JSON Schema cannot express remain explicitly tested in Python and TypeScript.

**Tech Stack:** Python 3.12, Pydantic 2.13.4, jsonschema 4.26, pytest, TypeScript 7, Zod 4.4.3, Vitest 4.

## Global Constraints

- Do not modify existing `asset_pipeline` schema code or the generic `catalog-asset@1` contract.
- Create only `pipeline/product_kit/**`, `pipeline/tests/test_product_kit_schema.py`, `pipeline/tests/test_product_kit_pack.py`, `catalog/schemas/product-kit-v1.*`, and a product-kit shared-corpus browser test.
- Mirror all exact browser literals, bounds, discriminators and additional-property prohibitions.
- JSON input uses camelCase; Python attributes use snake_case and canonical output returns camelCase.
- Validate without coercion, NaN or infinity.
- Bind only reviewed, brand-free, offline canonical PNG assets with exact hashes and trim dimensions.
- Enforce globally unique frame IDs, sorted/unique IDs and layers, exact certified profiles/slots/types, feasible socket/grip transforms, and valid grid edges/footprints.
- Keep compatibility default-deny; no tag-based or fuzzy approval.
- Canonical serialization is UTF-8, sorted-key, compact JSON with one final LF.
- Generated pack writes must fail if their versioned destination already exists; destructive overwrite is forbidden.

---

### Task 1: Add strict Pydantic models and graph validation

**Files:**
- Create: `pipeline/product_kit/__init__.py`
- Create: `pipeline/product_kit/schema.py`
- Create: `pipeline/tests/test_product_kit_schema.py`

- [ ] Write a failing valid-four-mode test and table-driven invalid syntax/graph tests matching the approved browser cases.
- [ ] Implement strict extra-forbid camelCase Pydantic models for raster frames, profiles, constraints, socket/grip/grid frames, kits, components and certifications.
- [ ] Implement catalogue binding, global frame identity, exact certification, connector feasibility and grid compatibility.
- [ ] Implement canonical JSON serialization and assert deterministic camelCase bytes.
- [ ] Run `pipeline\.venv\Scripts\python.exe -m pytest pipeline\tests\test_product_kit_schema.py -q` and require all tests green.

### Task 2: Add the shared cross-language corpus

**Files:**
- Create: `catalog/schemas/product-kit-v1.corpus.json`
- Modify: `pipeline/tests/test_product_kit_schema.py`
- Create: `web/src/product-kit/product-kit-corpus.test.ts`

- [ ] Store one canonical four-mode value/context plus derived invalid mutations with exact paths and values.
- [ ] Make Python validate every corpus case against the Pydantic/graph contract.
- [ ] Make TypeScript apply the same mutations and assert the same verdicts through `parseProductKitCatalogue`.
- [ ] Include syntax, bounds, identity, catalogue binding, transform, grid and default-deny cases.

### Task 3: Add Draft 2020-12 structural schema parity

**Files:**
- Create: `catalog/schemas/product-kit-v1.schema.json`
- Modify: `pipeline/tests/test_product_kit_schema.py`

- [ ] Encode exact keys, discriminators, numeric bounds, tuple lengths, path-free raster references and collection limits.
- [ ] Validate the schema with `Draft202012Validator.check_schema`.
- [ ] Assert all structurally valid corpus values pass and all structural invalid cases fail.
- [ ] Document semantic-only cases in corpus metadata and prove Pydantic/TypeScript reject them.

### Task 4: Add fail-no-overwrite pack writing

**Files:**
- Create: `pipeline/product_kit/pack.py`
- Create: `pipeline/tests/test_product_kit_pack.py`

- [ ] Write failing tests for canonical output, missing parent, existing destination, invalid manifest and no partial output.
- [ ] Validate before writing, create only a previously absent versioned destination, write through a sibling temporary file, then atomically rename.
- [ ] On any error, leave neither a destination file nor temporary residue.
- [ ] Run the two focused product-kit Python test files, then the full pipeline suite.

### Task 5: Cross-runtime verification and review

- [ ] Run all product-kit browser tests and strict TypeScript checking.
- [ ] Run all product-kit Python tests and the full existing pipeline suite.
- [ ] Confirm only new low-collision paths changed.
- [ ] Request a fresh read-only contract review; both specification and quality verdicts must approve before authoring the pilot manifest.

## Self-Review

- The plan covers strict syntax, semantic graph checks, shared runtime parity, structural JSON Schema, deterministic serialization and non-overwriting pack output.
- No existing generic catalogue schema or dirty integration surface is modified.
- Certification fingerprint computation remains a separate milestone; this contract validates its exact SHA-256 shape and pair inputs.
