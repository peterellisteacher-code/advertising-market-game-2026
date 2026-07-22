# Advertising Market Game — copy, onboarding, and navigation milestone

## Outcome

The source candidate now uses the approved factual-skeleton copy, exposes one immediate action and one next unmet requirement, keeps both partner jobs visible, identifies one-MacBook pair play, hides teacher host controls from the default student lobby, removes the unsupported buzzer, and retains all three levels, AIDA meanings, pricing/market rules, persistence states, and teacher-controlled image availability.

## Production source changed

- `godot/src/main/Main.gd`
- `godot/src/main/Main.tscn`
- `web/src/account/account-gate.ts`
- `web/src/ai-image/image-lab-panel.ts`
- `web/src/catalogue/catalogue-runtime.ts`
- `web/src/fabric/fabric-custom-properties.ts`
- `web/src/game/aida-playbook-panel.ts`
- `web/src/game/aida-playbook.ts`
- `web/src/game/audience-briefs.ts`
- `web/src/game/market-route-panel.ts`
- `web/src/game/pair-game-controller.ts`
- `web/src/game/student-copy.ts`
- `web/src/history/fabric-history-bindings.ts`
- `web/src/main.ts`
- `web/src/styles/editor.css`
- `web/src/ui/editor-shell.ts`

Tests changed beside those surfaces, and deterministic corpus/prompt/onboarding contract scripts plus this review record were added. `scripts/student-copy-corpus.mjs` gained a deterministic `--output` path so the final map could be regenerated without shell redirection. The separate Plain Language skill hardening changed:

- `C:\Users\Peter Ellis\.agents\skills\plain-language\SKILL.md`
- `C:\Users\Peter Ellis\.agents\skills\plain-language\scripts\plain_language_contract.cjs`
- `C:\Users\Peter Ellis\.agents\skills\plain-language\scripts\plain_language_contract.test.cjs`

## Copy accountability

- Initial map: 904 source occurrences.
- Plain Language result: 25 IDs changed verbatim; 875 unchanged; 4 rejected because they would remove interpolation values or produce malformed interpolated sentences.
- Full applied-ID and exception record: `rewrite-decisions.json`.
- Final map after onboarding and browser-evidenced corrections: 928 source occurrences across 29 files in `final-copy-map.json`, SHA-256 `A23D439F1DB457E5D65AD08751F8A97F97FE51F5D5D81F50B9BFE902C4379803`.
- The original 25 Plain Language replacements remain verbatim. The four interpolation/factual exceptions remain source-preserving. `rewrite-decisions.json` separately records five post-rewrite evidence groups: corrected Strategist action, next/complete AIDA guidance, price return guidance, progressive market-route instructions, and Level 3 Final check wording.
- Key final IDs include `WEB_SRC_GAME_STUDENT_COPY_TS__L0061__N01`, `WEB_SRC_GAME_AIDA_PLAYBOOK_PANEL_TS__L0111__N01`, `WEB_SRC_GAME_MARKET_ROUTE_PANEL_TS__L0131__N01`, `WEB_SRC_MAIN_TS__L0618__N01`, and `GODOT_SRC_MAIN_MAIN_GD__L0969__N01`.

## Verification and panel

- Build, test, browser, and external-state evidence: `final-verification.md`.
- Requirement-by-requirement status: `completion-audit.md`.
- Exact checked-export freshness and hashes: `export-freshness.md`.
- Final neutral flow: `final-flow-transcript.txt`.
- Current screenshot and viewport index: `browser/final-evidence.md`.
- Panel seat status and generation metadata: `openrouter-panel/status.md`.
- Accepted, rejected, and uncertain panel findings: `openrouter-panel/synthesis.md`.
- Result: the bounded candidate was rebuilt and passed the isolated Godot suite/export, TypeScript, 122 Vitest files / 1,886 tests, 13 task contracts, static export verification, and the full 1366×768 practice replay. A 1440×900 lobby/Level 1/Studio spot check also passed with no clipped visible controls; both final tabs had zero warning/error console entries. The former market-card publication blocker is fixed by serializing the protected price object's `editable` property. Production remains unchanged.
