# Plan: tuckability + single-action redesign

Branch: `agent/tuckability-single-action-20260806`. Spec: `docs/superpowers/specs/2026-08-06-studio-tuckability-single-action-design.md`.

- **A1 — Tuck shell core (Studio top zone):** `tuck-shell.ts` primitive (TDD) + convert top bar and pair strip to default-tucked top-edge tabs; relocate undo/redo + save state to the canvas toolbar; keep tour/guided-journey working via untuck hooks; persistence, a11y, reduced motion; update affected tests.
- **A2 — Studio side zone + overlays:** active-tool-tab tucks drawer (remove "Hide tools"), drawer default per journey step, overlay exclusivity group (layers/inspector/section-fill/display).
- **B — First-entry pacing:** clean stage during tour, per-step auto-untuck via guided journey, staged reveal of edge tabs.
- **C — Godot surfaces:** lobby staging, HUD chip + tuck conformance, RunPanel audit. GodotIQ is wired locally (addon port 6105) but deliberately NOT shipped: the addon, its rule files and `godot/.godotiq.json` are gitignored, and `godot/project.godot` now carries three LOCAL-ONLY hunks (stock header comment rewrite from first editor open, `GodotIQRuntime` autoload, `[editor_plugins]` enable) — never stage that file as-is; hand-compose any real Phase C setting change without those hunks so the public tree (and the CI Linux export built from it) stays addon-free.
- **D — Task-loop finish:** writer's-statement evidence surface (mission + coach evidence roll-up), sound-booth decision (wire as optional audio step or retire), market screen conformance pass.
- **E — Release:** full gates, PR to main, CI artifact verification, draft Netlify QA (Peter enters the site password), production deploy + smoke at 1280x800/1440x900.

Each phase lands as its own reviewed commit series; suites stay green between phases.
