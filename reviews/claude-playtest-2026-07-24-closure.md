# Claude playtest closure — 24 July 2026

This table traces the fourteen actionable findings and four retained strengths in
Section 16 of the approved completion design. “Browser evidence required” names
the replay in Task 9 of the integrated verification plan. A focused test does
not close an item that depends on rendered layout, focus, navigation or hosted
runtime behaviour.

| Finding | Classification | Source/test evidence | Browser evidence required | Status |
| --- | --- | --- | --- | --- |
| Market Gate loops forever | Actionable | `godot/src/main/Main.gd`; `scripts/onboarding-source.test.mjs` — “market completion has one explicit, keyboard-ordered transition”; `godot/tests/test_live_resume.gd` — `_completed_market_resume_is_idempotent` | Task 9 Step 2 item 16 at 1280×800: final review → publication → market entry → reload completed market; Task 9 Step 3: market view at 1440×900 | requires current hosted browser observation |
| Used device cannot start the next pair | Actionable | `web/src/account/account-gate.ts`; `web/src/account/account-gate.test.ts` — “locks both account surfaces immediately and reloads only after logout isolation”; `web/src/teacher/teacher-dashboard.test.ts` — “explains account reset scope, requires the exact username and restores focus on Escape” | Task 9 Step 2 item 2 at 1280×800: sign out → reload still signed out → different fake pair signs in; Task 9 Step 5 item 7: selected-pair reset | requires current hosted browser observation |
| QA price fixtures appear to students | Actionable | `scripts/production-catalogue-safety.mjs`; `scripts/production-catalogue-safety.test.mjs` — “scans every catalogue, pricing manifest and starter manifest copied into a release” | None beyond the final immutable-artifact catalogue scan; Task 9 Step 2 item 5 remains a visual starter check | contextual harness artefact, production scan clean |
| Raw `HANDLER_ERROR` is exposed | Actionable | `web/src/bridge/creator-public-api.ts`; `web/src/bridge/creator-public-api.test.ts` — “never exposes HANDLER_ERROR tokens through the public response”; `scripts/godot-bridge-contract.test.mjs` — “CreatorHost never prefixes student diagnostics with internal bridge codes or raw close errors” | None; this is a fail-closed public-boundary contract. Task 9 Step 8 still checks the hosted console for owned errors | changed and test-passing |
| Market Gate keyboard dead zone | Actionable | `godot/src/market/ui/MarketScreen.gd`; `godot/tests/test_market_screen.gd` — `_keyboard_order_and_dialog_focus_are_stable`; `scripts/onboarding-source.test.mjs` — “market completion has one explicit, keyboard-ordered transition” | Task 9 Step 2 item 16 at 1280×800 using keyboard traversal through final review, Enter market, scorecards and medal controls; Task 9 Step 3 market view at 1440×900 | requires current hosted browser observation |
| Canvas screens lack assistive state | Actionable | `godot/src/main/GameAccessibilityMirror.gd`; `scripts/onboarding-source.test.mjs` — “the accessibility mirror carries instruction, completion, focus and keyboard context”; `web/src/ui/canvas-accessibility-controller.test.ts` — “offers keyboard-operable show, unlock, reorder and delete controls” | Task 9 Step 2 items 9–10 at 1280×800 plus Task 9 Step 7 visible-focus and disabled-state audit | requires current hosted browser observation |
| First AIDA lock loses apparent selection | Actionable | `web/src/main.ts`; `web/src/main.test.ts` — “uses the latest Fabric selection for status, Layers and AIDA, then clears it everywhere” and “preserves a selected placed product when the pair opens AIDA and locks Attention” | Task 9 Step 2 item 14 at 1280×800: select a canvas item → open AIDA → lock Attention while selection, handles and status remain coherent | requires current hosted browser observation |
| Price action has no done state | Actionable | `web/src/product-builder/product-money-panel.ts`; `web/src/product-builder/product-money-panel.test.ts` — “shows one stable completed state after the selected price is on the design” and “names the single repair action when a later price no longer matches the design” | Task 9 Step 2 item 15 at 1280×800: audience-led price pending → complete → needs-attention states | requires current hosted browser observation |
| Two revision counters disagree | Actionable | `web/src/account/account-bootstrap.ts`; `web/src/account/account-bootstrap.test.ts` — “keeps internal cloud revisions out of student status copy” | Task 9 Step 2 item 17 at 1280×800 and Task 9 Step 7: inspect ordinary save/resume presentation for implementation revision numbers | requires current hosted browser observation |
| Full brief overlaps Hide library | Actionable | `web/src/ui/editor-shell.ts`; `web/src/ui/editor-shell.test.ts` — “opens and closes the full brief without adding a floating drawer control”; `web/src/ui/studio-split-pane.test.ts` — “uses Browse and Edit tabs in narrow mode and removes the separator from tab order” | Task 9 Step 2 item 3 at 1280×800; Task 9 Step 3 opening/instruction and expanded/contracted split at 1440×900; Task 9 Step 4 narrow fallback at 768×900 | requires current hosted browser observation |
| Vague `Follow the highlighted tool step` | Actionable | `web/src/game/guided-journey-controller.ts`; `web/src/game/guided-journey-controller.test.ts` — “renders the current Now, Why, Done and Next reference and opens its tool”; `scripts/student-copy-professional-contract.test.mjs` — “student copy uses direct factual wording without obsolete promotional phrases” | Task 9 Step 2 item 14 at 1280×800: one concrete current action with Now, Why, Done and Next | requires current hosted browser observation |
| Live-room join error blames two causes | Actionable | `godot/src/main/Main.gd`; `scripts/godot-bridge-contract.test.mjs` — “room join failures keep their typed code until Main chooses student copy”; `scripts/onboarding-source.test.mjs` — “typed room and polling failures have distinct student copy” | Task 9 Step 6 typed-error replay at 1280×800: invalid room-code format, unavailable room, timeout and connection failure each produce their own bounded message | requires current hosted browser observation |
| Curved-label wording over-promises | Actionable | `web/src/fabric/fabric-canvas-adapter.ts`; `web/src/fabric/fabric-canvas-adapter.test.ts` — “renders, edits and round-trips tumbler words as curved artwork”; `scripts/student-copy-professional-contract.test.mjs` rejects “final wrapping” and “wraps perfectly” | Task 9 Step 2 item 7 at 1280×800: add and edit visibly curved product words without any physical-wrapping claim | requires current hosted browser observation |
| Large product placement and Undo/Redo | Actionable | `web/src/tools/canvas-object-zoom.ts`; `web/src/tools/canvas-object-zoom.test.ts` — “enlarges the selected product while preserving its centre”; `web/src/history/history-controller.test.ts` — “undoes and redoes twelve mixed edits in exact order” | Task 9 Step 2 item 7 and item 10 at 1280×800: genuinely large placement, Delete and Undo; Task 9 Step 3 starter/product split at 1440×900 | requires current hosted browser observation |
| Strong AIDA teaching | Strength | `web/src/game/aida-playbook.ts`; `web/src/game/aida-playbook-panel.test.ts` — “presents five techniques first, preserves the written plan when expanded, and saves it”; `web/src/studio-coach/technique-catalogue.test.ts` — “provides brief factual help and a visual example description for one technique at a time” | Task 9 Step 2 item 14 at 1280×800: one-action-at-a-time AIDA and visual-technique guidance | requires current hosted browser observation |
| Ethical move guardrails | Strength | `web/src/game/aida-playbook.ts`; `web/src/game/aida-playbook-panel.test.ts` — “presents five techniques first, preserves the written plan when expanded, and saves it” (including factual-evidence, non-exclusion and real-urgency instructions) | Task 9 Step 2 item 14 at 1280×800: inspect the available AIDA moves without adding moralising filler | requires current hosted browser observation |
| Strong role contribution tracking | Strength | `web/src/game/pair-game-controller.ts`; `web/src/game/pair-game-controller.test.ts` — “tracks both roles across text, canvas changes, handoff and reopen”; `web/src/game/role-guide-controller.test.ts` — “requires acknowledgement on first entry and states both responsibilities” | Task 9 Step 2 item 4 at 1280×800: definitions, current role, recorded contribution and swap | requires current hosted browser observation |
| Reliable autosave and resume | Strength | `web/src/account/cloud-progress-sync.ts`; `web/src/account/cloud-progress-sync.test.ts` — “keeps the 300ms serialized local save successful when cloud is offline”; `web/src/persistence/draft-store.test.ts` — “begins and resumes one offline local-practice run from an exact checkpoint” | Task 9 Step 2 item 17 at 1280×800 and Task 9 Step 6: local autosave, fake cloud-state presentation and browser-controlled offline reload where supported | requires current hosted browser observation |

The earlier 1366×768 playtest is contextual evidence only.

## Final closure — 28 July 2026

The status column above records the pre-QA gate. The final candidate closes all
fourteen actionable findings through the following current evidence:

| Finding | Final evidence | Final status |
| --- | --- | --- |
| Market Gate loops forever | `godot/tests/test_live_resume.gd`; `godot/tests/test_game_shell.gd`; `scripts/onboarding-source.test.mjs`; Linux Godot run `30304627640` passed the complete twelve-suite seam test before export | closed by deterministic resume and completion tests |
| Used device cannot start the next pair | `web/src/main.test.ts` covers pair A → sign out → pair B isolation; hosted `/student` reopened at the isolated pair gate | closed |
| QA price fixtures appear to students | `scripts/production-catalogue-safety.test.mjs` passed against the final release catalogue | closed |
| Raw `HANDLER_ERROR` is exposed | creator public-boundary and Godot bridge contracts passed; current QA console contained no owned warning or error | closed |
| Market Gate keyboard dead zone | market screen, game-shell and onboarding keyboard-order tests passed in Linux Godot and the build-contract suite | closed by deterministic keyboard and focus tests |
| Canvas screens lack assistive state | canvas accessibility tests passed; selected-item Delete and Undo were visible and operable in the hosted studio | closed |
| First AIDA lock loses apparent selection | `web/src/main.test.ts` selection/AIDA regressions passed in the 2,368-test application suite | closed |
| Price action has no done state | product-money-panel pending, complete and needs-attention regressions passed | closed |
| Two revision counters disagree | account-bootstrap student-status regressions passed; no internal revision counter appeared in the hosted pair flow | closed |
| Full brief overlaps Hide library | hosted full guide, 1440×900 studio and 768×900 Browse/Edit screenshots show no overlay or inaccessible separator | closed |
| Vague `Follow the highlighted tool step` | current hosted guide shows one concrete action with permanent complete reference; professional-copy contracts passed | closed |
| Live-room join error blames two causes | typed room and polling error contracts passed in the 118-test build suite | closed |
| Curved-label wording over-promises | curved artwork round-trip tests and professional-copy prohibitions passed | closed |
| Large product placement and Undo/Redo | hosted product, Delete and Undo screenshots plus history regressions passed | closed |

The retained current transcript is:

`C:\tmp\admarket-browser-qa-89de81db-full-20260728\evidence\browser-qa-findings.md`

The exact final source SHA `89de81db9c6dd79a47217768ed97cacdf811c719`
was exported on Linux, assembled, statically verified and deployed to the
non-production QA draft. Fresh isolated Playwright contexts then opened the
complete teacher playtest at literal `1280×800` and `1440×900`. Both reached
`Game ready`, presented the clarified Art Director and Strategist duties,
showed twelve unselected starters, retained the teacher strip, had no
horizontal overflow, produced no application console warning/error, and raised
no page exception. The exact screenshots are:

- `C:\tmp\admarket-browser-qa-89de81db-full-20260728\evidence\03-teacher-playtest-exact-final-1280x800.png`
- `C:\tmp\admarket-browser-qa-89de81db-full-20260728\evidence\04-teacher-playtest-exact-final-1440x900.png`

The transcript also cites the retained `768×900` fallback and the full student,
reset, market, guidance, product, Delete/Undo and role-swap evidence whose
application inputs remain unchanged. Four line-zero Chromium/ANGLE performance
notices from the headless `1280×800` context are recorded separately from
application output in `playwright-exact-viewports.json`; the in-app browser and
`1440×900` context produced none.

This closure does not claim Safari, school wifi, browser-controlled offline
reload, real Supabase, the production visitor gate, production Functions,
production edge routing/rate limiting or production-hosted evidence.
