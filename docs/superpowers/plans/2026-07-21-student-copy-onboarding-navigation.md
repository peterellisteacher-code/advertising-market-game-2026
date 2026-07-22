# Student Copy, Onboarding, and Navigation Implementation Plan

> **For agentic workers:** Execute inline in the current task. Do not delegate, deploy production, mutate Supabase, run native Godot, use Fusion, add paid reviewers, or repeat a failed paid call.

**Goal:** Produce one verified student-copy and progressive-onboarding candidate for the Advertising Market Game, using exactly the two authorised Plain Language direct-runner requests and exactly one authorised four-seat OpenRouter panel pass.

**Architecture:** Treat the authored TypeScript, GDScript, and `.tscn` files as the only copy sources. Build a deterministic ID-to-source corpus, relay it once to the frozen Plain Language preset, and apply returned replacements only where meaning and rules remain intact. Keep onboarding in the existing level/role/checklist/market flow through contextual disclosure; verify TypeScript behavior with Vitest and the game shell through the existing web-export/browser route.

**Tech Stack:** Godot 4 source and checked web export; TypeScript 7; Vite 8; Vitest 4; Playwright-driven browser inspection; frozen OpenRouter Plain Language preset.

## Global Constraints

- Student target: Year 10 pairs sharing a recent school MacBook on school wifi.
- Preserve technical identifiers, prices, product data, AIDA meanings, safety requirements, game rules, and assessment/content facts.
- Avoid classroom-facing “assignment” and “unit” framing.
- Preserve the three-level, fun-first advertising-market identity and the existing one-stop-shop architecture.
- Native Godot execution is quarantined; use source plus the verified web-export/browser route.
- Production, Supabase, Claude-owned files, secrets, and student-identifying material remain untouched.
- Plain Language call 1 is one unchunked whole-corpus factual-skeleton request using only the direct runner contract.
- Plain Language call 2 is one unchunked whole-candidate coverage question; its response is recorded verbatim.
- OpenRouter review is one isolated call per intended model family, no retry, fallback, judge, or extra paid review.

---

### Task 1: Establish the complete source corpus

**Files:**
- Create: `reviews/student-copy-onboarding-2026-07-21/copy-map.json`
- Create: `reviews/student-copy-onboarding-2026-07-21/plain-language-whole-corpus-prompt.txt`
- Inspect: `web/src/**/*.ts`, excluding tests and generated output
- Inspect: `godot/src/**/*.gd` and `godot/src/**/*.tscn`

- [ ] Enumerate source files that can emit visible or audible student copy.
- [ ] Assign stable IDs in sorted file and source order, recording file, line, source text, and protection class.
- [ ] Review the inventory against login, onboarding, all three levels, creator tools, market, image generation, empty/loading/save/restore/offline/error, transition, and completion surfaces.
- [ ] Build one UTF-8 prompt containing every mapped rewriteable string and the exact required request.
- [ ] Run the direct runner once and record stdout verbatim.

### Task 2: Protect behavior with failing tests

**Files:**
- Modify focused existing tests beside affected TypeScript modules.
- Modify: `godot/tests/test_game_shell.gd`
- Modify: `godot/tests/test_market_screen.gd`

- [ ] Add assertions for immediate first action, current partner role, current level/progress, contextual next action, and explicit completion conditions.
- [ ] Add assertions that essential AIDA, pricing, market, image-generation availability, and save/offline meanings remain present.
- [ ] Run the focused tests and confirm the new assertions fail for the missing or old behavior.

### Task 3: Apply the approved rewrite and progressive disclosure

**Files:**
- Modify only mapped authored files under `web/src/`, `godot/src/main/`, and `godot/src/market/ui/`.
- Create: `reviews/student-copy-onboarding-2026-07-21/plain-language-whole-corpus-response.txt`
- Create: `reviews/student-copy-onboarding-2026-07-21/rewrite-decisions.json`

- [ ] Apply returned replacement wording verbatim by ID.
- [ ] Record every unchanged item, rejected meaning-loss rewrite, and factual/rule conflict.
- [ ] Keep new guidance inside existing level, role, checklist, creator, and market surfaces.
- [ ] Run focused tests until green, then typecheck.

### Task 4: Build and inspect the stable candidate

**Files:**
- Create browser evidence under `reviews/student-copy-onboarding-2026-07-21/browser/`.
- Create: `reviews/student-copy-onboarding-2026-07-21/flow-transcript.md`

- [ ] Run the integrated non-native test/build matrix supported by the repository.
- [ ] Serve the verified web candidate on the correct local surface for the behavior under test.
- [ ] Inspect at 1440x900 and 1280x800, exercising login/landing, immediate start, Levels 1–3, Build, Place, Design, image controls, market/voting/shop, save/restore/offline/error, transitions, and completion.
- [ ] Capture key-stage screenshots and record DOM/visual facts, console errors, clipping, overflow, dead space, ambiguity, and launch guidance.

### Task 5: Run the authorised whole-candidate coverage question

**Files:**
- Create: `reviews/student-copy-onboarding-2026-07-21/plain-language-coverage-prompt.txt`
- Create: `reviews/student-copy-onboarding-2026-07-21/plain-language-coverage-response.txt`

- [ ] Put the complete candidate copy and flow transcript into one UTF-8 user message.
- [ ] Run the same direct runner exactly once.
- [ ] Preserve its response verbatim and treat it as critique unless it explicitly supplies a register rewrite.

### Task 6: Run the single four-seat adversarial panel

**Files:**
- Create: `reviews/student-copy-onboarding-2026-07-21/panel-evidence.md`
- Create one response record per intended model seat.

- [ ] Query the read-only catalog for the current canonical slug and input modalities of K3, GLM-5.2, Gemini Pro Latest, and Grok 4.5.
- [ ] Seal one neutral evidence packet containing requirements, complete copy, flow transcript, viewport facts, and current key-screen visual evidence.
- [ ] Send the same packet independently to each available intended family exactly once.
- [ ] Record completion, modality actually supplied, and terminal verdict without exposing secrets or private material.
- [ ] Compare all responses against source and browser evidence; reject unsupported recommendations.

### Task 7: Final integration and verification

**Files:**
- Modify only source and tests required by substantiated findings.
- Create: `reviews/student-copy-onboarding-2026-07-21/final-report.md`

- [ ] Add a failing focused test for each accepted behavioral finding, then implement the minimum fix.
- [ ] Rebuild once and rerun focused plus integrated verification after the final edit.
- [ ] Recheck the final browser candidate at 1440x900 and 1280x800.
- [ ] Record source files, IDs, exceptions, viewport evidence, test/build results, panel status, synthesis, uncertainties, and confirmation that production is unchanged.
