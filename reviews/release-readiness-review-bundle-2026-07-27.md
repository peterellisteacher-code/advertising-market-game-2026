# Advertising Market Game — neutral release-readiness review bundle

## Reviewer task

Perform a read-only release-readiness review of the candidate represented here. Identify concrete bugs, security or privacy risks, data-loss paths, plan deviations, inaccessible behaviour, missing realistic tests, public-snapshot omissions, or unsupported claims. Classify each finding as Critical, Important, or Minor; give a file and line or section reference; explain impact; and finish with a release-readiness verdict. Treat hosted browser checks explicitly marked pending as pending, not as passing or failing. Do not infer correctness from test counts alone.

## Candidate identity and scope

- Pre-programme base: `361b0b9f7befead9d80c7869431305c94ad40c8f`
- Implementation source candidate: `726cfad84fd5a1d12ab2266b220c6a1c2470cc83`
- Private evidence head: `3d0cac2af89a7dab28bb19af3740feda1601e01f`
- Branch: `agent/admarket-integrated-fixes-20260723`
- Product: a Year 10 English paired Advertising Market Game for recent school MacBooks, primarily Safari, over school wifi.
- Review scope: routes and authentication, account controls, isolated teacher playtest, server-side Image Lab allowances, editor completion, student guidance, market completion, public-source curation, and release tooling.

## Acceptance requirements

1. Students have a direct public `/student` link and cannot reach teacher controls.
2. The teacher has a protected `/teacher` link using a configured server-side password.
3. The teacher can create pair accounts with typed passwords and replace those passwords.
4. The teacher can play the complete game in an isolated profile and factory-reset it with exact typed confirmation.
5. The teacher can reset one selected pair without changing its username or password.
6. Image Lab use is controlled server-side by teacher-set draft and final allowances.
7. Students never enter or receive a teacher Image Lab code.
8. Twelve varied starter products are available and visually valid, with no accidental reset selection.
9. Certified product-kit sockets align in rendered artwork.
10. A selected removable object has a visible undoable delete action.
11. Library and design panes resize proportionately by pointer and keyboard without overlap, and their ratio persists per student or teacher-playtest namespace.
12. Eligible product sections fill independently without colour escaping the selected region.
13. A valid logo can be inserted and missing prerequisites are explicit.
14. Art Director and Strategist responsibilities are literally explained before use and remain reviewable; roles share the same unlocked tools but own different decision responsibilities.
15. Every student step belongs to the approved linked argument and presents one action at a time with clear Now, Why, Done, and Next guidance plus a permanent full guide.
16. The market-completion path succeeds and remains complete after reload.
17. A reused device can sign out, remain signed out after reload, and accept the next pair credentials.
18. Every actionable prior playtest finding has a deterministic test or current browser observation.
19. Objective language gates and professional-copy contracts cover the student corpus, with any later user-directed accessibility wording disclosed.
20. Focused checks, a final full suite, build verification, exact-viewport browser QA, and one-pass independent reviews are required.
21. Operations documentation matches released routes and controls.
22. Production, Supabase, repository visibility, and production visitor access remain unchanged in this programme.

## Hard constraints and evidence boundaries

- No Windows Godot executable may be launched; only verified web artifacts are used locally.
- No production deployment, production visitor-access change, production alias change, Supabase mutation, real student data, or live tunnel is authorised.
- The requested hosted QA target is a separate non-production unprotected project with deterministic fake state only.
- A deterministic QA endpoint can prove UI-to-API contracts but not production Functions, real Supabase, production edge routing, password gate, headers, or rate limiting.
- Safari and school-wifi behaviour remain field uncertainties unless directly observed there.
- The public deliverable is a local curated history-free source snapshot; no repository push or visibility change is part of this candidate.
- Private specifications, plans, reviews, panel transcripts, operational evidence, credentials, local deployment identifiers, and personal paths are excluded from the public snapshot.

## Deterministic verification evidence

- Authoritative TypeScript: `tsc --noEmit` passed.
- Authoritative serialized application suite after the final accessibility closure: 167 files and 2,339 tests passed.
- Authoritative Node build and release contracts: 115 tests passed.
- Authoritative Python 3.12 catalogue pipeline: 306 tests passed.
- Fresh history-free public workcopy, installed from the frozen lockfile: TypeScript passed; 167 files and 2,339 tests passed; 115 build contracts passed; 306 Python tests passed.
- Supported local web build: 206 Vite modules transformed; non-destructive assembly succeeded; release ID `06c25dd8fbeed18f32554f67f579d3aa`; `WEB_EXPORT_STATIC_VERIFICATION_OK`. No native Godot export was launched.
- Retained log `01-typecheck.log`: SHA-256 `5a3973f79ed9becd5f23c4feff467513814de7ea381d75a4d2e339aa8b8edca9`.
- Retained log `02e-pytest-python312-isolated-temp.stdout.log`: SHA-256 `ae0b5035b9a1ca4fe360a55b703304e62078cbc547308ed1cc8d03d66355d392`.
- Retained log `03c-node-contracts-green.log`: SHA-256 `6748731d474a7f299d943ab5a40f10fa249f8362e6325747d33edcd23c7dacd7`.
- Retained final application-suite log: SHA-256 `cf1df298df43be5ec79ff69065ab23812fc3c65756b97c07c145d3d0b4851539`.
- Retained log `06-public-snapshot-install.log`: SHA-256 `79a33f4d54f3228b1f4abdbec40ff44ec692e594ee87459d4481d6bef753e31e`.
- Retained log `07-public-snapshot-typecheck.log`: SHA-256 `5a3973f79ed9becd5f23c4feff467513814de7ea381d75a4d2e339aa8b8edca9`.
- Retained log `08-public-snapshot-pnpm-test.log`: SHA-256 `3fed380607f97d243b9f0f52594614432233521d4fdb30a4d01c3027b2ed37be`.
- Retained log `09-public-snapshot-build-contracts.log`: SHA-256 `3c01820fc54b0a03730883e8aa2d1db0d8f6e37cbd0e431aedcef4e08a9d502b`.
- Retained log `10-public-snapshot-pytest.log`: SHA-256 `296704afc33de0409f432fc28fef8939d3dbf91629d5849f8f498b7fcc139be9`.

## Public snapshot evidence

- Existing public reference commit: `541d3ee157a384a16192e86e87fb21b4abc696fa`.
- History-free snapshot tree SHA-256: `7978e3f0d7d943ae1ec0e25351f31de4900eb6b7b3c28ae6c33afc486dd00397`.
- 10,950 allowlisted files; 312 modified and 52 added versus the reference; 0 removed; 12 private candidate paths excluded; 0 source-to-snapshot byte mismatches.
- Privacy scan: 0 forbidden filenames, private-key headers, JWTs, bearer literals, known private project or site identifiers, personal local paths, private plan links, or private review links. One token-shaped match was an `sk-` substring inside a synthetic IndexedDB test name. Ten URL occurrences were one deterministic alphabetic Supabase placeholder used only in tests.
- Workflow: `permissions: contents: read`; 0 secret references; 0 write permissions; 0 deploy commands; all 11 Action uses SHA-pinned.
- Licence decision: retain the project MIT software licence, CREDITS, vendor Tabler MIT licence, 2,503 original offline catalogue records, editable product assets, and project writing under the documented classroom-use terms; no stock-media file is included.

## Language-corpus evidence

- The completed language-gate corpus contained 4,379 occurrences and SHA-256 `595b6bcbd4a4ed7c51602344d8636e9f3d9b7ab4e81c12c68f35bc56ea4441ec`.
- The final source corpus contains 4,384 occurrences and SHA-256 `83ab059053a4384c721b356965dc3654df024b52def4bd938626767597b259cc`.
- The five added review-directed accessibility strings are `Action`, `Tab`, the two split-percentage phrases used by `aria-valuetext`, and the visible keyboard and reset instruction for the split separator. The two paid language workflows were not repeated.

## Pending evidence

- Hosted non-production deployment and in-app browser QA at 1280×800, 1440×900, and 768×900 are pending until after this review gate.
- Production, real Supabase, Safari, student MacBooks, school wifi, production visitor gate, edge limits, and production headers are unmeasured and unchanged.

## Changed paths

```text
M	catalog/generated/offline-core-v1/product-kit-v1.json
A	catalog/generated/offline-core-v1/student-starters-v1.json
M	docs/operations/advertising-game-account-progress.md
A	docs/operations/advertising-game-image-lab-allowances.sql
M	docs/operations/image-lab.md
M	docs/operations/product-kit-certification-fingerprint-v1.md
M	docs/operations/release-workflow.md
M	godot/src/main/GameAccessibilityMirror.gd
M	godot/src/main/Main.gd
M	godot/src/main/Main.tscn
M	godot/src/market/MarketBridge.gd
M	godot/src/market/MarketHost.gd
M	godot/src/market/ui/MarketScreen.gd
M	godot/tests/test_game_shell.gd
M	godot/tests/test_live_resume.gd
M	godot/tests/test_market_bridge.gd
M	godot/tests/test_market_host.gd
M	godot/tests/test_market_screen.gd
M	netlify/deploy-functions/image-lab-jobs.mts
M	netlify/deploy-functions/image-lab-session.mts
A	netlify/deploy-functions/teacher-accounts.mts
A	netlify/deploy-functions/teacher-playtest.mts
A	netlify/deploy-functions/teacher-session.mts
M	netlify/deploy-layout.test.ts
M	netlify/functions/account-session.mts
M	netlify/functions/account-session.test.ts
M	netlify/functions/image-lab-jobs.mts
M	netlify/functions/image-lab-jobs.test.ts
M	netlify/functions/image-lab-session.mts
M	netlify/functions/image-lab-session.test.ts
M	netlify/functions/lib/account-backend.test.ts
M	netlify/functions/lib/account-backend.ts
M	netlify/functions/lib/account-operation-artifacts.test.ts
M	netlify/functions/lib/account-primitives.test.ts
M	netlify/functions/lib/account-primitives.ts
M	netlify/functions/lib/advertising-game-edge-handler.test.ts
M	netlify/functions/lib/fal-image-policy.test.ts
M	netlify/functions/lib/fal-image-policy.ts
A	netlify/functions/lib/image-lab-allowance-store.test.ts
A	netlify/functions/lib/image-lab-allowance-store.ts
M	netlify/functions/lib/image-lab-auth.test.ts
M	netlify/functions/lib/image-lab-auth.ts
A	netlify/functions/lib/image-lab-operation-artifacts.test.ts
M	netlify/functions/lib/image-lab-state.test.ts
M	netlify/functions/lib/image-lab-state.ts
M	netlify/functions/lib/netlify-image-lab-state.test.ts
M	netlify/functions/lib/netlify-image-lab-state.ts
A	netlify/functions/lib/teacher-account-service.test.ts
A	netlify/functions/lib/teacher-account-service.ts
A	netlify/functions/lib/teacher-auth.test.ts
A	netlify/functions/lib/teacher-auth.ts
M	netlify/functions/product-price-guide.mts
M	netlify/functions/product-price-guide.test.ts
M	netlify/functions/studio-coach.mts
M	netlify/functions/studio-coach.test.ts
A	netlify/functions/teacher-accounts.mts
A	netlify/functions/teacher-accounts.test.ts
A	netlify/functions/teacher-playtest.mts
A	netlify/functions/teacher-playtest.test.ts
A	netlify/functions/teacher-session.mts
A	netlify/functions/teacher-session.test.ts
M	package.json
A	pipeline/asset_pipeline/starter_fill_certification.py
A	pipeline/product_kit/socket_contact.py
M	pipeline/tests/test_product_kit_pack.py
A	pipeline/tests/test_product_kit_socket_contact.py
A	pipeline/tests/test_starter_fill_certification.py
A	reviews/claude-playtest-2026-07-24-closure.md
A	reviews/public-snapshot-diff-2026-07-27.txt
A	reviews/public-snapshot-manifest-2026-07-27.txt
A	reviews/public-snapshot-privacy-scan-2026-07-27.txt
A	reviews/student-copy-completion-candidate-v2.json
A	reviews/student-copy-completion-candidate.json
A	reviews/student-copy-language-gate-2026-07-27.md
M	scripts/build-logo-icons.mjs
M	scripts/build-logo-icons.test.mjs
M	scripts/build-netlify-functions.mjs
M	scripts/build-netlify-functions.test.mjs
M	scripts/build-web.mjs
M	scripts/build-web.test.mjs
M	scripts/deploy-netlify-artifact.test.mjs
M	scripts/godot-bridge-contract.test.mjs
M	scripts/onboarding-source.test.mjs
A	scripts/production-catalogue-safety.mjs
A	scripts/production-catalogue-safety.test.mjs
M	scripts/student-copy-corpus.mjs
M	scripts/student-copy-corpus.test.mjs
M	scripts/student-copy-professional-contract.test.mjs
A	scripts/student-copy-scrub-sections.mjs
A	scripts/student-copy-scrub-sections.test.mjs
M	scripts/student-copy-source-coverage.test.mjs
M	scripts/verify-web-export.mjs
A	scripts/verify_product_kit_sockets.py
A	scripts/verify_starter_fill_regions.py
M	supabase/functions/advertising-game-backend/handler.ts
M	web/src/account/account-asset-client.ts
M	web/src/account/account-client.test.ts
M	web/src/account/account-client.ts
M	web/src/account/account-gate.test.ts
M	web/src/account/account-gate.ts
M	web/src/account/account.css
M	web/src/account/cloud-progress-recovery.test.ts
M	web/src/account/cloud-progress-recovery.ts
M	web/src/ai-image/image-lab-client.test.ts
M	web/src/ai-image/image-lab-client.ts
M	web/src/ai-image/image-lab-panel.test.ts
M	web/src/ai-image/image-lab-panel.ts
M	web/src/ai-image/image-lab-runtime.test.ts
M	web/src/ai-image/image-lab-runtime.ts
A	web/src/app/app-route.test.ts
A	web/src/app/app-route.ts
M	web/src/bridge/creator-public-api.test.ts
M	web/src/bridge/creator-public-api.ts
M	web/src/catalogue/catalogue-runtime.test.ts
M	web/src/catalogue/catalogue-runtime.ts
M	web/src/domain/campaign-document.test.ts
M	web/src/domain/campaign-document.ts
M	web/src/export/campaign-exporter.test.ts
M	web/src/fabric/canvas-port.ts
M	web/src/fabric/fabric-canvas-adapter.test.ts
M	web/src/fabric/fabric-canvas-adapter.ts
M	web/src/fabric/fabric-custom-properties.test.ts
M	web/src/fabric/fabric-custom-properties.ts
M	web/src/fabric/object-command-service.test.ts
M	web/src/fabric/object-command-service.ts
M	web/src/fabric/object-factory.test.ts
M	web/src/fabric/object-factory.ts
M	web/src/game/creator-stage.test.ts
M	web/src/game/creator-stage.ts
M	web/src/game/guided-journey-controller.test.ts
M	web/src/game/guided-journey-controller.ts
M	web/src/game/guided-journey.test.ts
M	web/src/game/guided-journey.ts
A	web/src/game/instruction-argument.test.ts
A	web/src/game/instruction-argument.ts
M	web/src/game/pair-game-controller.test.ts
M	web/src/game/pair-game-controller.ts
A	web/src/game/role-guide-controller.test.ts
A	web/src/game/role-guide-controller.ts
M	web/src/game/student-copy.test.ts
M	web/src/game/student-copy.ts
M	web/src/logo-lab/logo-lab-panel.test.ts
M	web/src/logo-lab/logo-lab-panel.ts
M	web/src/main.test.ts
M	web/src/main.ts
M	web/src/market/market-client.test.ts
M	web/src/market/market-client.ts
M	web/src/market/market-public-api.test.ts
M	web/src/market/market-public-api.ts
M	web/src/persistence/local-practice-service.test.ts
M	web/src/product-builder/product-money-panel.test.ts
M	web/src/product-builder/product-money-panel.ts
M	web/src/product-kit/connector-transform.test.ts
M	web/src/product-kit/fabric-product-kit-compositor.test.ts
M	web/src/product-kit/product-kit-loader.test.ts
M	web/src/product-kit/product-kit-loader.ts
M	web/src/product-kit/product-kit-panel.test.ts
M	web/src/product-kit/product-kit-panel.ts
M	web/src/product-kit/product-kit-raster-matrix.test.ts
A	web/src/product-kit/student-starter-catalogue.test.ts
A	web/src/product-kit/student-starter-catalogue.ts
M	web/src/styles/editor-css.test.ts
M	web/src/styles/editor.css
A	web/src/teacher/teacher-client.test.ts
A	web/src/teacher/teacher-client.ts
A	web/src/teacher/teacher-dashboard.test.ts
A	web/src/teacher/teacher-dashboard.ts
A	web/src/teacher/teacher-playtest-client.test.ts
A	web/src/teacher/teacher-playtest-client.ts
A	web/src/teacher/teacher-playtest-controller.test.ts
A	web/src/teacher/teacher-playtest-controller.ts
A	web/src/teacher/teacher.css
A	web/src/tools/connected-region-fill.test.ts
A	web/src/tools/connected-region-fill.ts
A	web/src/tools/raster-section-fill-renderer.ts
A	web/src/tools/section-fill-controller.test.ts
A	web/src/tools/section-fill-controller.ts
M	web/src/ui/canvas-accessibility-controller.test.ts
M	web/src/ui/canvas-accessibility-controller.ts
M	web/src/ui/editor-shell.test.ts
M	web/src/ui/editor-shell.ts
A	web/src/ui/studio-split-pane.test.ts
A	web/src/ui/studio-split-pane.ts
M	web/src/ui/studio-tool-drawer.test.ts
M	web/src/ui/studio-tool-drawer.ts
```

## Diff statistic

```text
 .../generated/offline-core-v1/product-kit-v1.json  |     4 +-
 .../offline-core-v1/student-starters-v1.json       |   123 +
 .../advertising-game-account-progress.md           |    53 +
 .../advertising-game-image-lab-allowances.sql      |   827 +
 docs/operations/image-lab.md                       |   224 +-
 .../product-kit-certification-fingerprint-v1.md    |    30 +
 docs/operations/release-workflow.md                |    38 +-
 godot/src/main/GameAccessibilityMirror.gd          |    29 +-
 godot/src/main/Main.gd                             |   227 +-
 godot/src/main/Main.tscn                           |    62 +-
 godot/src/market/MarketBridge.gd                   |    16 +-
 godot/src/market/MarketHost.gd                     |     4 +
 godot/src/market/ui/MarketScreen.gd                |   113 +
 godot/tests/test_game_shell.gd                     |    70 +-
 godot/tests/test_live_resume.gd                    |    58 +
 godot/tests/test_market_bridge.gd                  |    28 +
 godot/tests/test_market_host.gd                    |    11 +
 godot/tests/test_market_screen.gd                  |    40 +
 netlify/deploy-functions/image-lab-jobs.mts        |     6 +-
 netlify/deploy-functions/image-lab-session.mts     |     2 +-
 netlify/deploy-functions/teacher-accounts.mts      |    20 +
 netlify/deploy-functions/teacher-playtest.mts      |    14 +
 netlify/deploy-functions/teacher-session.mts       |    14 +
 netlify/deploy-layout.test.ts                      |   164 +-
 netlify/functions/account-session.mts              |    18 +
 netlify/functions/account-session.test.ts          |   105 +-
 netlify/functions/image-lab-jobs.mts               |   596 +-
 netlify/functions/image-lab-jobs.test.ts           |   529 +-
 netlify/functions/image-lab-session.mts            |   257 +-
 netlify/functions/image-lab-session.test.ts        |   266 +-
 netlify/functions/lib/account-backend.test.ts      |   179 +
 netlify/functions/lib/account-backend.ts           |   221 +
 .../lib/account-operation-artifacts.test.ts        |    21 +
 netlify/functions/lib/account-primitives.test.ts   |    14 +-
 netlify/functions/lib/account-primitives.ts        |    12 +-
 .../lib/advertising-game-edge-handler.test.ts      |   358 +
 netlify/functions/lib/fal-image-policy.test.ts     |    12 +-
 netlify/functions/lib/fal-image-policy.ts          |    16 -
 .../lib/image-lab-allowance-store.test.ts          |   214 +
 netlify/functions/lib/image-lab-allowance-store.ts |   383 +
 netlify/functions/lib/image-lab-auth.test.ts       |    70 +-
 netlify/functions/lib/image-lab-auth.ts            |    52 +-
 .../lib/image-lab-operation-artifacts.test.ts      |   160 +
 netlify/functions/lib/image-lab-state.test.ts      |   144 +-
 netlify/functions/lib/image-lab-state.ts           |   302 +-
 .../functions/lib/netlify-image-lab-state.test.ts  |    17 +-
 netlify/functions/lib/netlify-image-lab-state.ts   |     4 +-
 .../functions/lib/teacher-account-service.test.ts  |   497 +
 netlify/functions/lib/teacher-account-service.ts   |   817 +
 netlify/functions/lib/teacher-auth.test.ts         |   166 +
 netlify/functions/lib/teacher-auth.ts              |   264 +
 netlify/functions/product-price-guide.mts          |   187 +-
 netlify/functions/product-price-guide.test.ts      |    53 +-
 netlify/functions/studio-coach.mts                 |   172 +-
 netlify/functions/studio-coach.test.ts             |    70 +-
 netlify/functions/teacher-accounts.mts             |   574 +
 netlify/functions/teacher-accounts.test.ts         |   466 +
 netlify/functions/teacher-playtest.mts             |   520 +
 netlify/functions/teacher-playtest.test.ts         |   319 +
 netlify/functions/teacher-session.mts              |   156 +
 netlify/functions/teacher-session.test.ts          |   171 +
 package.json                                       |     4 +-
 .../asset_pipeline/starter_fill_certification.py   |   153 +
 pipeline/product_kit/socket_contact.py             |   690 +
 pipeline/tests/test_product_kit_pack.py            |    36 +
 pipeline/tests/test_product_kit_socket_contact.py  |   158 +
 pipeline/tests/test_starter_fill_certification.py  |    84 +
 reviews/claude-playtest-2026-07-24-closure.md      |    32 +
 reviews/public-snapshot-diff-2026-07-27.txt        |   396 +
 reviews/public-snapshot-manifest-2026-07-27.txt    | 10960 +++++++
 .../public-snapshot-privacy-scan-2026-07-27.txt    |    40 +
 reviews/student-copy-completion-candidate-v2.json  | 30655 +++++++++++++++++++
 reviews/student-copy-completion-candidate.json     | 30501 ++++++++++++++++++
 reviews/student-copy-language-gate-2026-07-27.md   |   140 +
 scripts/build-logo-icons.mjs                       |     2 +-
 scripts/build-logo-icons.test.mjs                  |    21 +-
 scripts/build-netlify-functions.mjs                |     5 +-
 scripts/build-netlify-functions.test.mjs           |    23 +-
 scripts/build-web.mjs                              |    19 +-
 scripts/build-web.test.mjs                         |    97 +-
 scripts/deploy-netlify-artifact.test.mjs           |    25 +-
 scripts/godot-bridge-contract.test.mjs             |    25 +-
 scripts/onboarding-source.test.mjs                 |   115 +-
 scripts/production-catalogue-safety.mjs            |   126 +
 scripts/production-catalogue-safety.test.mjs       |    74 +
 scripts/student-copy-corpus.mjs                    |   141 +-
 scripts/student-copy-corpus.test.mjs               |    55 +-
 .../student-copy-professional-contract.test.mjs    |     9 +
 scripts/student-copy-scrub-sections.mjs            |   211 +
 scripts/student-copy-scrub-sections.test.mjs       |   156 +
 scripts/student-copy-source-coverage.test.mjs      |   150 +-
 scripts/verify-web-export.mjs                      |   149 +-
 scripts/verify_product_kit_sockets.py              |    56 +
 scripts/verify_starter_fill_regions.py             |    98 +
 .../functions/advertising-game-backend/handler.ts  |   539 +
 web/src/account/account-asset-client.ts            |    49 +-
 web/src/account/account-client.test.ts             |    53 +
 web/src/account/account-client.ts                  |    42 +-
 web/src/account/account-gate.test.ts               |    82 +-
 web/src/account/account-gate.ts                    |   104 +-
 web/src/account/account.css                        |     8 +-
 web/src/account/cloud-progress-recovery.test.ts    |     5 +-
 web/src/account/cloud-progress-recovery.ts         |     2 +-
 web/src/ai-image/image-lab-client.test.ts          |   133 +-
 web/src/ai-image/image-lab-client.ts               |   179 +-
 web/src/ai-image/image-lab-panel.test.ts           |   185 +-
 web/src/ai-image/image-lab-panel.ts                |   288 +-
 web/src/ai-image/image-lab-runtime.test.ts         |   128 +-
 web/src/ai-image/image-lab-runtime.ts              |   137 +-
 web/src/app/app-route.test.ts                      |    60 +
 web/src/app/app-route.ts                           |    61 +
 web/src/bridge/creator-public-api.test.ts          |    32 +-
 web/src/bridge/creator-public-api.ts               |    21 +-
 web/src/catalogue/catalogue-runtime.test.ts        |   110 +-
 web/src/catalogue/catalogue-runtime.ts             |    31 +-
 web/src/domain/campaign-document.test.ts           |    20 +-
 web/src/domain/campaign-document.ts                |     6 +-
 web/src/export/campaign-exporter.test.ts           |     6 +-
 web/src/fabric/canvas-port.ts                      |    31 +
 web/src/fabric/fabric-canvas-adapter.test.ts       |   237 +
 web/src/fabric/fabric-canvas-adapter.ts            |   253 +-
 web/src/fabric/fabric-custom-properties.test.ts    |    38 +-
 web/src/fabric/fabric-custom-properties.ts         |    15 +-
 web/src/fabric/object-command-service.test.ts      |    91 +-
 web/src/fabric/object-command-service.ts           |    59 +-
 web/src/fabric/object-factory.test.ts              |    30 +
 web/src/fabric/object-factory.ts                   |    19 +-
 web/src/game/creator-stage.test.ts                 |    58 +-
 web/src/game/creator-stage.ts                      |    59 +-
 web/src/game/guided-journey-controller.test.ts     |   162 +-
 web/src/game/guided-journey-controller.ts          |   179 +-
 web/src/game/guided-journey.test.ts                |   170 +-
 web/src/game/guided-journey.ts                     |   277 +-
 web/src/game/instruction-argument.test.ts          |   102 +
 web/src/game/instruction-argument.ts               |   330 +
 web/src/game/pair-game-controller.test.ts          |    51 +-
 web/src/game/pair-game-controller.ts               |    40 +-
 web/src/game/role-guide-controller.test.ts         |   120 +
 web/src/game/role-guide-controller.ts              |   155 +
 web/src/game/student-copy.test.ts                  |     6 +
 web/src/game/student-copy.ts                       |    38 +-
 web/src/logo-lab/logo-lab-panel.test.ts            |    80 +-
 web/src/logo-lab/logo-lab-panel.ts                 |    84 +-
 web/src/main.test.ts                               |   981 +-
 web/src/main.ts                                    |   690 +-
 web/src/market/market-client.test.ts               |    34 +
 web/src/market/market-client.ts                    |    16 +-
 web/src/market/market-public-api.test.ts           |    92 +-
 web/src/market/market-public-api.ts                |   123 +-
 web/src/persistence/local-practice-service.test.ts |     3 +-
 .../product-builder/product-money-panel.test.ts    |    52 +-
 web/src/product-builder/product-money-panel.ts     |    64 +-
 web/src/product-kit/connector-transform.test.ts    |    35 +
 .../fabric-product-kit-compositor.test.ts          |     2 +-
 web/src/product-kit/product-kit-loader.test.ts     |    72 +-
 web/src/product-kit/product-kit-loader.ts          |    93 +-
 web/src/product-kit/product-kit-panel.test.ts      |    51 +-
 web/src/product-kit/product-kit-panel.ts           |   235 +-
 .../product-kit/product-kit-raster-matrix.test.ts  |    47 +
 .../product-kit/student-starter-catalogue.test.ts  |   142 +
 web/src/product-kit/student-starter-catalogue.ts   |   184 +
 web/src/styles/editor-css.test.ts                  |    27 +-
 web/src/styles/editor.css                          |   107 +-
 web/src/teacher/teacher-client.test.ts             |   305 +
 web/src/teacher/teacher-client.ts                  |   669 +
 web/src/teacher/teacher-dashboard.test.ts          |   363 +
 web/src/teacher/teacher-dashboard.ts               |  1024 +
 web/src/teacher/teacher-playtest-client.test.ts    |   160 +
 web/src/teacher/teacher-playtest-client.ts         |   278 +
 .../teacher/teacher-playtest-controller.test.ts    |   246 +
 web/src/teacher/teacher-playtest-controller.ts     |   206 +
 web/src/teacher/teacher.css                        |   432 +
 web/src/tools/connected-region-fill.test.ts        |   214 +
 web/src/tools/connected-region-fill.ts             |   205 +
 web/src/tools/raster-section-fill-renderer.ts      |   311 +
 web/src/tools/section-fill-controller.test.ts      |   294 +
 web/src/tools/section-fill-controller.ts           |   340 +
 web/src/ui/canvas-accessibility-controller.test.ts |   116 +-
 web/src/ui/canvas-accessibility-controller.ts      |    99 +-
 web/src/ui/editor-shell.test.ts                    |   106 +-
 web/src/ui/editor-shell.ts                         |   176 +-
 web/src/ui/studio-split-pane.test.ts               |   333 +
 web/src/ui/studio-split-pane.ts                    |   307 +
 web/src/ui/studio-tool-drawer.test.ts              |    26 +-
 web/src/ui/studio-tool-drawer.ts                   |    36 +-
 185 files changed, 97697 insertions(+), 2529 deletions(-)
```

## Main application integration diff

```diff
diff --git a/web/src/main.ts b/web/src/main.ts
index c3b41843..0d0a767b 100644
--- a/web/src/main.ts
+++ b/web/src/main.ts
@@ -1,5 +1,14 @@
 import "./styles/editor.css";
 import "./account/account.css";
+import "./teacher/teacher.css";
+import { runAdvertisingGameRoute } from "./app/app-route";
+import { HttpTeacherClient } from "./teacher/teacher-client";
+import { TeacherDashboard } from "./teacher/teacher-dashboard";
+import { TeacherPlaytestController } from "./teacher/teacher-playtest-controller";
+import {
+  HttpTeacherPlaytestClient,
+  type TeacherPlaytestClient
+} from "./teacher/teacher-playtest-client";
 import {
   cloudStatusMessage,
   createAccountBootstrap,
@@ -24,7 +33,6 @@ import {
   CloudProgressAssetRestore
 } from "./account/cloud-asset-adapter";
 import { AccountAccessController } from "./account/account-gate";
-import { AccountResetCoordinator } from "./account/account-reset-coordinator";
 import {
   CloudProgressRecovery,
   cloudRecoveryStatusMessage
@@ -72,6 +80,7 @@ import {
   formatMarketBucks,
   ProductMoneyPanel
 } from "./product-builder/product-money-panel";
+import { evaluatePricePlacementState } from "./game/creator-stage";
 import { ProductPriceGuideClient } from "./product-builder/product-price-guide-client";
 import {
   createProductPriceSubject,
@@ -87,6 +96,7 @@ import {
 } from "./product-builder/virtual-product-variant";
 import {
   loadProductKitBundle,
+  sectionFillForStudentStarter,
   type LoadedProductKitBundle
 } from "./product-kit/product-kit-loader";
 import { ProductKitPanel } from "./product-kit/product-kit-panel";
@@ -97,7 +107,10 @@ import {
 } from "./logo-lab/logo-icon-catalogue";
 import { LogoLabPanel } from "./logo-lab/logo-lab-panel";
 import type { LogoMarkDesign } from "./logo-lab/logo-mark-model";
-import type { LogoMarkSnapshot } from "./fabric/canvas-port";
+import type {
+  CanvasSelectionSnapshot,
+  LogoMarkSnapshot
+} from "./fabric/canvas-port";
 import { ImageLabClient } from "./ai-image/image-lab-client";
 import { ImageLabPanel } from "./ai-image/image-lab-panel";
 import { ImageLabRuntime, type ImageLabPairIdentity } from "./ai-image/image-lab-runtime";
@@ -113,7 +126,10 @@ import {
 } from "./market/market-public-api";
 import type { GeneratedRasterPlacement } from "./catalogue/catalogue-runtime";
 import type { FabricCanvasAdapter } from "./fabric/fabric-canvas-adapter";
-import { ObjectCommandService } from "./fabric/object-command-service";
+import {
+  canvasRemovalState,
+  ObjectCommandService
+} from "./fabric/object-command-service";
 import {
   CanvasAccessibilityController,
   type CanvasAccessibilityAction
@@ -152,20 +168,37 @@ import { SerializedAutosave } from "./persistence/serialized-autosave";
 import { createEditorShell, type EditorShell } from "./ui/editor-shell";
 import { registerReleaseServiceWorker } from "./service-worker-registration";
 import { createStudioToolDrawer } from "./ui/studio-tool-drawer";
+import {
+  STUDENT_STUDIO_SPLIT_STORAGE_KEY,
+  StudioSplitPane,
+  TEACHER_PLAYTEST_STUDIO_SPLIT_STORAGE_KEY
+} from "./ui/studio-split-pane";
 import { STUDENT_COPY } from "./game/student-copy";
 import {
   applyCreatorLevelAccess,
   creatorStageAllows
 } from "./game/creator-level-access";
 import { GuidedJourneyController } from "./game/guided-journey-controller";
+import { RoleGuideController } from "./game/role-guide-controller";
+import { SectionFillController } from "./tools/section-fill-controller";
 
 const RETURN_TO_GAME_EVENT = "ad-market-creator:return-to-game";
 
 interface CanvasRuntime {
   adapter: FabricCanvasAdapter;
+  refreshDisplay(): void;
   dispose(): Promise<void>;
 }
 
+interface CanvasRemovalHistoryTransition {
+  readonly beforeState: string;
+  readonly afterState: string;
+  readonly selection: CanvasSelectionSnapshot;
+}
+
+const canvasStateKey = (state: Record<string, unknown>): string =>
+  JSON.stringify(state);
+
 function hasLocalBlobReferences(document: CampaignDocumentV1): boolean {
   return document.assetReferences.some((reference) => reference.kind === "local-blob");
 }
@@ -193,6 +226,10 @@ async function createCanvasRuntime(canvasElement: HTMLCanvasElement): Promise<Ca
   const adapter = new FabricCanvasAdapter(canvas);
   return {
     adapter,
+    refreshDisplay() {
+      canvas.calcOffset();
+      canvas.requestRenderAll();
+    },
     async dispose() {
       let failure: unknown;
       try {
@@ -222,7 +259,10 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
   #runtimePromise: Promise<CanvasRuntime> | null = null;
   #releaseOwnedRasterUrls: (() => void) | null = null;
   #history: FabricHistoryBindings<CampaignDocumentV1> | null = null;
+  #removalHistory: CanvasRemovalHistoryTransition[] = [];
   #canvasAccessibility: CanvasAccessibilityController | null = null;
+  #sectionFill: SectionFillController | null = null;
+  #sectionFillPreviewActive = false;
   #unsubscribeCanvasSelectionStatus: (() => void) | null = null;
   #pairGame: PairGameController | null = null;
   #logoLab: LogoLabPanel | null = null;
@@ -233,6 +273,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
   #aidaPlaybookPanel: AidaPlaybookPanel | null = null;
   #productKitPanel: ProductKitPanel | null = null;
   #guidedJourney: GuidedJourneyController | null = null;
+  #roleGuide: RoleGuideController | null = null;
   #aidaStage: AidaStage = "attention";
   #rasterPricing: RasterPricingIndex | null = null;
   #productKitBundle: LoadedProductKitBundle | null = null;
@@ -295,6 +336,9 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
       onProductVariantPlaced: (_objectId, product) => {
         this.#showProductVariantSummary(`${product.paletteTitle} ${product.bodyTitle}`);
       },
+      sectionFillForAsset: (asset) => this.#productKitBundle === null
+        ? undefined
+        : sectionFillForStudentStarter(this.#productKitBundle, asset),
       onError: (error) => { this.shell.assertive.textContent = error.message; }
     });
     if (practice !== null) {
@@ -335,6 +379,11 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
   }
 
   queueCataloguePlacement(asset: CatalogAssetV1, bodyColour?: string): void {
+    if (this.#sectionFillPreviewActive) {
+      this.shell.assertive.textContent =
+        "Apply or cancel the fill preview before changing the canvas.";
+      return;
+    }
     if (asset.delivery === "offline" && !this.#rasterPricing?.byAssetId.has(asset.id)) {
       this.shell.assertive.textContent = "That product piece is missing its Market Buck clue.";
       return;
@@ -383,6 +432,11 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
   }
 
   queueProductKitPlacement(request: ProductKitCompositionRequest): void {
+    if (this.#sectionFillPreviewActive) {
+      this.shell.assertive.textContent =
+        "Apply or cancel the fill preview before changing the canvas.";
+      return;
+    }
     if (this.#productKitBundle === null) {
       this.shell.assertive.textContent = "Product maker unavailable";
       return;
@@ -452,6 +506,14 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
     this.#refreshGuidedJourney();
   }
 
+  attachRoleGuide(controller: RoleGuideController): void {
+    if (this.#roleGuide !== null && this.#roleGuide !== controller) {
+      throw new Error("Partner role guide is already attached");
+    }
+    this.#roleGuide = controller;
+    this.#refreshRoleGuide();
+  }
+
   showMessage(message: string): void {
     this.shell.assertive.textContent = message;
   }
@@ -644,11 +706,6 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
       const priceObjectIds = this.#priceLabelObjectIds(current);
       if (priceCents === null) {
         priceObjectIds.forEach((objectId) => commands.remove(objectId));
-      } else {
-        const label = formatMarketBucks(priceCents);
-        priceObjectIds.forEach((objectId) => {
-          runtime.adapter.setText(objectId, label, `Market price ${label}`, false);
-        });
       }
       this.#document = parseCampaignDocument({
         ...structuredClone(current),
@@ -660,7 +717,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
         fabricState: commands.serialize(),
         evidence: {
           ...structuredClone(current.evidence),
-          price: priceCents === null ? [] : priceObjectIds
+          price: priceCents === null ? [] : [...current.evidence.price]
         }
       });
     };
@@ -672,6 +729,10 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
     this.schedulePracticeAutosave();
   }
 
+  refreshCanvasDisplay(): void {
+    this.#runtime?.refreshDisplay();
+  }
+
   async setProductPricePosition(position: ProductPricePosition | null): Promise<void> {
     this.#assertStageAllows("price");
     await this.#placements.flush();
@@ -772,6 +833,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
         objectId = existing[0]!;
         runtime.adapter.setText(objectId, label, `Market price ${label}`, false);
         existing.slice(1).forEach((duplicateId) => commands.remove(duplicateId));
+        commands.setHidden(objectId, false);
         commands.select(objectId);
       }
       this.#document = parseCampaignDocument({
@@ -785,6 +847,9 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
     };
     if (this.#history === null) await commit();
     else await this.#history.transaction(commit);
+    this.#refreshMoneyCheck();
+    this.#refreshMarketRoute();
+    this.#refreshStudioCoachCampaign();
     this.shell.polite.textContent = `${label} added to the design. Return to the game to see the next step.`;
     this.schedulePracticeAutosave();
   }
@@ -796,6 +861,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
     this.#editorOpen = false;
     this.#practiceSaveMatched = false;
     this.shell.saveStatus.textContent = "";
+    this.#removalHistory = [];
     await this.#placements.flush();
     const requested = parseCampaignDocument(structuredClone(value));
     let document = requested;
@@ -908,6 +974,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
       if (this.#imageLab !== null) void this.#imageLab.initialise();
       this.#setOpen(true);
       this.#refreshGuidedJourney();
+      this.#refreshRoleGuide();
     } catch (error) {
       this.#pairGame?.close();
       this.#destroyCanvasAccessibility();
@@ -937,6 +1004,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
       this.#blobs.clear();
       this.#document = null;
       this.#guidedJourney?.setCampaign(null);
+      this.#roleGuide?.setCampaign(null);
       this.#refreshMoneyCheck();
       this.#refreshMarketRoute();
       this.#refreshAidaPlaybook();
@@ -989,6 +1057,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
   }
 
   async addText(value: string): Promise<void> {
+    this.#assertCanvasMutationAvailable();
     await this.#placements.flush();
     const runtime = this.#runtime;
     if (runtime === null) throw new Error("Campaign creator is not open");
@@ -998,6 +1067,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
   async addProductText(
     value: string
   ): Promise<"added" | "updated" | "product-required"> {
+    this.#assertCanvasMutationAvailable();
     await this.#placements.flush();
     const runtime = this.#runtime;
     if (runtime === null || this.#history === null) {
@@ -1022,6 +1092,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
   }
 
   async addLogoMark(design: LogoMarkDesign, icon: LogoIconRecord): Promise<string> {
+    this.#assertCanvasMutationAvailable();
     await this.#placements.flush();
     const runtime = this.#runtime;
     if (runtime === null) throw new Error("Campaign creator is not open");
@@ -1033,6 +1104,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
     design: LogoMarkDesign,
     icon: LogoIconRecord
   ): Promise<void> {
+    this.#assertCanvasMutationAvailable();
     await this.#placements.flush();
     const runtime = this.#runtime;
     if (runtime === null) throw new Error("Campaign creator is not open");
@@ -1040,30 +1112,55 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
   }
 
   async undo(): Promise<boolean> {
+    this.#assertCanvasMutationAvailable();
     await this.#placements.flush();
     if (this.#history === null) throw new Error("Campaign creator is not open");
+    const runtime = this.#runtime;
+    const beforeState = runtime === null ? null : canvasStateKey(runtime.adapter.serialize());
     const changed = await this.#history.undo();
     if (changed) {
+      if (runtime !== null && beforeState !== null) {
+        const afterState = canvasStateKey(runtime.adapter.serialize());
+        const removal = [...this.#removalHistory].reverse().find((candidate) =>
+          candidate.afterState === beforeState &&
+          candidate.beforeState === afterState
+        );
+        if (removal !== undefined) runtime.adapter.restoreSelection(removal.selection);
+      }
       this.#refreshLogoMarks();
       this.#refreshMoneyCheck();
       this.#refreshMarketRoute();
+      if (this.#document !== null) this.#restoreProductShellRegions(this.#snapshot());
     }
     return changed;
   }
 
   async redo(): Promise<boolean> {
+    this.#assertCanvasMutationAvailable();
     await this.#placements.flush();
     if (this.#history === null) throw new Error("Campaign creator is not open");
+    const runtime = this.#runtime;
+    const beforeState = runtime === null ? null : canvasStateKey(runtime.adapter.serialize());
     const changed = await this.#history.redo();
     if (changed) {
+      if (runtime !== null && beforeState !== null) {
+        const afterState = canvasStateKey(runtime.adapter.serialize());
+        const removal = [...this.#removalHistory].reverse().find((candidate) =>
+          candidate.beforeState === beforeState &&
+          candidate.afterState === afterState
+        );
+        if (removal !== undefined) runtime.adapter.setSelected(null);
+      }
       this.#refreshLogoMarks();
       this.#refreshMoneyCheck();
       this.#refreshMarketRoute();
+      if (this.#document !== null) this.#restoreProductShellRegions(this.#snapshot());
     }
     return changed;
   }
 
   async resizeSelectedObject(factor: number): Promise<void> {
+    this.#assertCanvasMutationAvailable();
     await this.#placements.flush();
     const runtime = this.#runtime;
     if (!this.#editorOpen || runtime === null || this.#history === null) {
@@ -1078,6 +1175,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
   }
 
   async applyCanvasAccessibilityAction(action: CanvasAccessibilityAction): Promise<void> {
+    this.#assertCanvasMutationAvailable();
     await this.#placements.flush();
     const runtime = this.#runtime;
     if (!this.#editorOpen || runtime === null || this.#history === null) {
@@ -1085,6 +1183,10 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
     }
     const summary = runtime.adapter.listObjectSummaries().find(({ id }) => id === action.id);
     if (!summary) throw new Error("That canvas layer is no longer available");
+    if (action.type === "remove") {
+      await this.#removeCanvasObject(action.id, runtime);
+      return;
+    }
     const commands = new ObjectCommandService(runtime.adapter);
     await this.#history.transaction(async () => {
       switch (action.type) {
@@ -1112,9 +1214,6 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
         case "set-locked":
           commands.setLocked(action.id, action.locked);
           break;
-        case "remove":
-          commands.remove(action.id);
-          break;
       }
     });
     this.#refreshCanvasEmptyState(runtime.adapter.serialize());
@@ -1122,7 +1221,25 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
     this.schedulePracticeAutosave();
   }
 
+  async deleteSelected(): Promise<void> {
+    this.#assertCanvasMutationAvailable();
+    await this.#placements.flush();
+    const runtime = this.#runtime;
+    if (!this.#editorOpen || runtime === null || this.#history === null) {
+      throw new Error("Campaign creator is not open");
+    }
+    const removal = canvasRemovalState(
+      runtime.adapter.getSelectedObjectId(),
+      runtime.adapter.listObjectSummaries()
+    );
+    if (!removal.removable || removal.selectedId === null) {
+      throw new Error(removal.reason);
+    }
+    await this.#removeCanvasObject(removal.selectedId, runtime);
+  }
+
   async fillSelectedImage(): Promise<void> {
+    this.#assertCanvasMutationAvailable();
     await this.#placements.flush();
     const runtime = this.#runtime;
     if (!this.#editorOpen || runtime === null || this.#history === null) {
@@ -1185,6 +1302,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
     this.#studioCoach?.clearCampaign();
     await this.flushPracticeAutosave();
     this.#editorOpen = false;
+    this.#removalHistory = [];
     let cleanupError: Error | null = null;
     try {
       await this.#placements.flush();
@@ -1237,7 +1355,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
       priceCents: null,
       pricePosition: null,
       priceGuide: null,
-      priceOnDesign: false,
+      pricePlacement: { status: "pending" },
       audienceNeed: "",
       audienceValues: []
     });
@@ -1260,6 +1378,7 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
     });
     attempt(() => this.#logoLab?.setMarks([]));
     attempt(() => this.#guidedJourney?.setCampaign(null));
+    attempt(() => this.#roleGuide?.setCampaign(null));
     attempt(() => this.#setOpen(false));
     attempt(() => this.gameCanvas?.focus({ preventScroll: true }));
     if (cleanupError !== null) throw cleanupError;
@@ -1382,6 +1501,27 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
     this.schedulePracticeAutosave();
   }
 
+  async #removeCanvasObject(id: string, runtime: CanvasRuntime): Promise<void> {
+    if (this.#history === null) throw new Error("Campaign creator is not open");
+    const removal = canvasRemovalState(id, runtime.adapter.listObjectSummaries());
+    if (!removal.removable) throw new Error(removal.reason);
+    const beforeState = canvasStateKey(runtime.adapter.serialize());
+    const selection = runtime.adapter.captureSelection();
+    await this.#history.transaction(async () => {
+      new ObjectCommandService(runtime.adapter).remove(id);
+    });
+    this.#removalHistory.push({
+      beforeState,
+      afterState: canvasStateKey(runtime.adapter.serialize()),
+      selection
+    });
+    this.#refreshCanvasEmptyState(runtime.adapter.serialize());
+    this.#refreshLogoMarks();
+    if (this.#document !== null) this.#restoreProductShellRegions(this.#snapshot());
+    this.#refreshStudioCoachCampaign();
+    this.schedulePracticeAutosave();
+  }
+
   #commitPlacement(document: CampaignDocumentV1, localBlob?: LocalCatalogueBlob): void {
     const reconciled = this.#invalidateStaleProductPricing(this.#rasterPricing === null
       ? document
@@ -1426,7 +1566,9 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
       priceCents: document?.product.priceCents ?? null,
       pricePosition: document?.product.pricePosition ?? null,
       priceGuide: document?.product.priceGuide ?? null,
-      priceOnDesign: document !== null && this.#priceLabelObjectIds(document).length === 1,
+      pricePlacement: document === null
+        ? { status: "pending" }
+        : evaluatePricePlacementState(document),
       audienceNeed: document?.brief.audienceNeeds.join(" ") ?? "",
       audienceValues: document?.brief.audienceValues ?? []
     });
@@ -1444,6 +1586,18 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
     this.#guidedJourney.setCampaign(document);
   }
 
+  #refreshRoleGuide(): void {
+    if (this.#roleGuide === null) return;
+    if (this.#document === null) {
+      this.#roleGuide.setCampaign(null);
+      return;
+    }
+    const document = this.#runtime === null
+      ? this.#document
+      : this.#snapshot();
+    this.#roleGuide.setCampaign(document);
+  }
+
   #refreshMarketRoute(feedback?: MarketRouteFeedback | null): void {
     if (!this.#marketRoutePanel) return;
     const document = this.#document;
@@ -1603,13 +1757,42 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
       canvasRegion: this.shell.canvasRegion,
       host: this.shell.layers,
       toggle: this.shell.layersToggle,
+      deleteButton: this.shell.deleteSelected,
+      deleteStatus: this.shell.deleteStatus,
       port: runtime.adapter,
       runAction: (action) => this.applyCanvasAccessibilityAction(action),
+      deleteSelected: () => this.deleteSelected(),
+      announce: (message, priority) => {
+        (priority === "assertive" ? this.shell.assertive : this.shell.polite).textContent = message;
+      }
+    });
+    this.#sectionFill = new SectionFillController({
+      host: this.shell.sectionFillPanel,
+      canvas: this.shell.canvasRegion,
+      port: runtime.adapter,
+      transaction: async (operation) => {
+        if (this.#history === null) throw new Error("Campaign creator is not open");
+        await this.#history.transaction(operation);
+        this.schedulePracticeAutosave();
+      },
       announce: (message, priority) => {
         (priority === "assertive" ? this.shell.assertive : this.shell.polite).textContent = message;
+      },
+      mutationControls: [...this.root.querySelectorAll<HTMLButtonElement>("button")]
+        .filter((control) => !this.shell.sectionFillPanel.contains(control)),
+      onPreviewStateChange: (active) => {
+        this.#sectionFillPreviewActive = active;
+        if (active) this.root.dataset.sectionFillPreview = "true";
+        else delete this.root.dataset.sectionFillPreview;
       }
     });
     this.#unsubscribeCanvasSelectionStatus = runtime.adapter.subscribeSelection(({ objectIds }) => {
+      void this.#sectionFill?.setSelection(objectIds.length === 1 ? objectIds[0]! : null)
+        .catch((error: unknown) => {
+          this.shell.assertive.textContent = error instanceof Error
+            ? error.message
+            : "Selected-item fill controls could not be updated.";
+        });
       if (objectIds.length === 0) {
         this.shell.zoomStatus.textContent = "Select a product or image";
         return;
@@ -1626,17 +1809,143 @@ class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
       this.shell.zoomStatus.textContent =
         `Selected: ${accessibleName || "Canvas layer"}`;
     });
+    void this.#sectionFill.setSelection(runtime.adapter.getSelectedObjectId())
+      .catch((error: unknown) => {
+        this.shell.assertive.textContent = error instanceof Error
+          ? error.message
+          : "Selected-item fill controls could not be updated.";
+      });
   }
 
   #destroyCanvasAccessibility(): void {
     this.#unsubscribeCanvasSelectionStatus?.();
     this.#unsubscribeCanvasSelectionStatus = null;
     this.shell.zoomStatus.textContent = "Select a product or image";
+    this.#sectionFill?.destroy();
+    this.#sectionFill = null;
+    this.#sectionFillPreviewActive = false;
+    delete this.root.dataset.sectionFillPreview;
     this.#canvasAccessibility?.destroy();
     this.#canvasAccessibility = null;
   }
+
+  #assertCanvasMutationAvailable(): void {
+    if (this.#sectionFillPreviewActive) {
+      throw new Error("Apply or cancel the fill preview before changing the canvas.");
+    }
+  }
+}
+
+declare global {
+  interface Window {
+    AdMarketCreator: CreatorPublicApi;
+    AdMarketPractice: PracticePublicApi;
+    AdMarketRoom: MarketPublicApi;
+    AdMarketAccount: AccountBootstrapPublicApi;
+  }
 }
 
+function renderRouteBoundary(
+  kind: "teacher-dashboard" | "teacher-playtest" | "not-found",
+  heading: string,
+  description: string
+): void {
+  const main = document.createElement("main");
+  main.dataset.admarketRoute = kind;
+  main.tabIndex = -1;
+
+  const title = document.createElement("h1");
+  title.textContent = heading;
+  main.append(title);
+
+  const summary = document.createElement("p");
+  summary.textContent = description;
+  main.append(summary);
+
+  if (kind === "not-found") {
+    const studentLink = document.createElement("a");
+    studentLink.href = "/student";
+    studentLink.textContent = "Open student sign-in";
+    main.append(studentLink);
+  }
+
+  document.body.replaceChildren(main);
+  main.focus();
+}
+
+export function bootTeacherDashboard(): void {
+  const root = document.createElement("div");
+  root.id = "teacher-dashboard-root";
+  document.body.replaceChildren(root);
+  const dashboard = new TeacherDashboard(root, new HttpTeacherClient());
+  void dashboard.mount();
+}
+
+export function bootTeacherPlaytest(): void {
+  const root = document.createElement("div");
+  root.id = "teacher-playtest-root";
+  document.body.prepend(root);
+  const playtestClient = new HttpTeacherPlaytestClient();
+  let game: TeacherPlaytestGameHandle | null = null;
+  const controller = new TeacherPlaytestController({
+    root,
+    sessionClient: new HttpTeacherClient(),
+    playtestClient,
+    startGame: async () => {
+      game = await bootGameApplication({
+        kind: "teacher-playtest",
+        client: playtestClient
+      });
+    },
+    resetLocalState: async () => {
+      if (game === null) throw new Error("Teacher playtest is not ready");
+      await game.resetLocalState();
+    },
+    openFirstScreen: () => window.location.reload()
+  });
+  void controller.mount();
+}
+
+export function renderNotFoundApplication(): void {
+  renderRouteBoundary(
+    "not-found",
+    "Page not found",
+    "This address does not match a student or teacher page."
+  );
+}
+
+type GameApplicationMode =
+  | { readonly kind: "student" }
+  | {
+      readonly kind: "teacher-playtest";
+      readonly client: TeacherPlaytestClient;
+    };
+
+interface TeacherPlaytestGameHandle {
+  resetLocalState(): Promise<void>;
+}
+
+const TEACHER_PLAYTEST_BROWSER_NAMESPACE = "teacher-playtest";
+
+export function bootStudentApplication(): void {
+  bootGameApplication({ kind: "student" });
+}
+
+function bootGameApplication(
+  mode: { readonly kind: "student" }
+): null;
+function bootGameApplication(
+  mode: {
+    readonly kind: "teacher-playtest";
+    readonly client: TeacherPlaytestClient;
+  }
+): Promise<TeacherPlaytestGameHandle>;
+function bootGameApplication(
+  mode: GameApplicationMode
+): Promise<TeacherPlaytestGameHandle> | null {
+if (mode.kind === "teacher-playtest") {
+  Reflect.deleteProperty(window, "AdMarketAccount");
+}
 const root = document.querySelector<HTMLElement>("#creator-root");
 if (!root) throw new Error("Missing #creator-root");
 
@@ -1649,8 +1958,25 @@ registerReleaseServiceWorker({
   }
 });
 const studioTools = createStudioToolDrawer(shell.overlay);
-shell.overlay.querySelector<HTMLButtonElement>("[data-studio-collapse]")
-  ?.addEventListener("click", () => studioTools.collapse());
+const studioSplitPane = new StudioSplitPane({
+  root: shell.workspace,
+  browsePane: shell.library,
+  designPane: shell.canvasRegion,
+  separator: shell.workspaceSeparator,
+  storage: (() => {
+    try {
+      return window.localStorage;
+    } catch {
+      return null;
+    }
+  })(),
+  storageKey: mode.kind === "teacher-playtest"
+    ? TEACHER_PLAYTEST_STUDIO_SPLIT_STORAGE_KEY
+    : STUDENT_STUDIO_SPLIT_STORAGE_KEY
+});
+shell.overlay.querySelector(".creator__tool-rail")?.addEventListener("click", () => {
+  studioSplitPane.selectNarrowPane("browse");
+});
 const gameSurface = document.querySelector<HTMLElement>('main[aria-label="Advertising Market Game"]');
 const gameCanvas = document.querySelector<HTMLCanvasElement>("#canvas");
 if (!gameSurface || !gameCanvas) throw new Error("Missing locked game surface for account access");
@@ -1663,8 +1989,12 @@ const ensureAccountRoot = (id: string, tagName: "div" | "section"): HTMLElement
   document.body.prepend(root);
   return root;
 };
-const accountGateRoot = ensureAccountRoot("account-gate-root", "div");
-const accountStatusRoot = ensureAccountRoot("account-session-root", "section");
+const accountGateRoot = mode.kind === "student"
+  ? ensureAccountRoot("account-gate-root", "div")
+  : null;
+const accountStatusRoot = mode.kind === "student"
+  ? ensureAccountRoot("account-session-root", "section")
+  : null;
 root.hidden = true;
 
 const drafts = new AccountScopedDraftStore();
@@ -1686,21 +2016,33 @@ const studioCoachRuntime = new StudioCoachRuntime({
   client: new StudioCoachClient(),
   capture: () => handler.captureStudioCoachCanvas()
 });
-const cloudClient = new HttpCloudProgressClient(
-  accountIdentity,
-  undefined,
-  accountCookieRequests
-);
+const cloudClient = mode.kind === "teacher-playtest"
+  ? mode.client
+  : new HttpCloudProgressClient(
+      accountIdentity,
+      undefined,
+      accountCookieRequests
+    );
 const cloudMetadata = new BrowserCloudSyncMetadataStore();
 const cloudOutbox = typeof globalThis.indexedDB === "undefined"
   ? undefined
   : new BrowserCloudProgressOutbox();
-const accountAssets = new HttpAccountAssetClient(
-  accountIdentity,
-  undefined,
-  accountCookieRequests
-);
+const accountAssets = mode.kind === "teacher-playtest"
+  ? mode.client
+  : new HttpAccountAssetClient(
+      accountIdentity,
+      undefined,
+      accountCookieRequests
+    );
 const cloudAssetRestore = new CloudProgressAssetRestore({ client: accountAssets });
+const setCloudMessage = (message: string): void => {
+  if (mode.kind === "student") {
+    accountController?.setCloudMessage(message);
+    return;
+  }
+  shell.saveStatus.textContent = message;
+  shell.saveStatus.title = message;
+};
 const cloudSync = new CloudProgressSync({
   client: cloudClient,
   metadata: cloudMetadata,
@@ -1711,6 +2053,12 @@ const cloudSync = new CloudProgressSync({
   }),
   onState: (state) => {
     if (state.phase === "conflict") {
+      if (mode.kind === "teacher-playtest") {
+        setCloudMessage(
+          "Saved on this device · another cloud copy needs review. Nothing was replaced."
+        );
+        return;
+      }
       accountController?.setCloudConflict({
         documentId: state.documentId,
         cloudAvailable: state.remote !== undefined,
@@ -1725,7 +2073,7 @@ const cloudSync = new CloudProgressSync({
       });
       return;
     }
-    accountController?.setCloudMessage(cloudStatusMessage(state));
+    setCloudMessage(cloudStatusMessage(state));
   },
   onUseCloud: async (remote) => {
     await handler.flushPracticeAutosave();
@@ -1737,7 +2085,10 @@ const cloudSync = new CloudProgressSync({
     });
     await handler.open(adopted.document);
   },
-  onAuthenticationRequired: () => accountController?.requireReauthentication()
+  onAuthenticationRequired: () => {
+    if (mode.kind === "student") accountController?.requireReauthentication();
+    else window.location.assign("/teacher");
+  }
 });
 const cloudRecovery = new CloudProgressRecovery({
   client: cloudClient,
@@ -1745,89 +2096,70 @@ const cloudRecovery = new CloudProgressRecovery({
   assets: cloudAssetRestore,
   metadata: cloudMetadata
 });
-const accountReset = new AccountResetCoordinator({
-  client: accountClient,
-  identity: accountIdentity,
-  mutations: accountMutations,
-  stores: [
-    drafts,
-    cloudMetadata,
-    ...(cloudOutbox === undefined ? [] : [cloudOutbox]),
-    imageLabSubmissionPersistence,
-    studioCoachRuntime
-  ],
-  quiesce: async () => {
-    cloudSync.signOut();
-    try {
-      await handler.isolateAccountWork();
-    } finally {
-      drafts.deactivateAccount();
-      imageLabSubmissionPersistence.deactivateAccount();
-      studioCoachRuntime.deactivateAccount();
-    }
-  }
-});
-accountController = new AccountAccessController({
-  client: accountClient,
-  gateRoot: accountGateRoot,
-  statusRoot: accountStatusRoot,
-  gameSurface,
-  gameCanvas,
-  creatorRoot: root,
-  onSession: async (username) => {
-    try {
-      await drafts.activateAccount(username);
-      await imageLabSubmissionPersistence.activateAccount(username);
-      await studioCoachRuntime.activateAccount(username);
-    } catch (error) {
-      drafts.deactivateAccount();
-      imageLabSubmissionPersistence.deactivateAccount();
-      studioCoachRuntime.deactivateAccount();
-      throw error;
-    }
-    try {
-      await cloudSync.setAccount(username);
-    } catch (error) {
-      cloudSync.signOut();
-      if ((error instanceof AccountClientError || error instanceof AccountAssetClientError) &&
-        error.code === "AUTHENTICATION_REQUIRED") {
+if (mode.kind === "student") {
+  if (accountGateRoot === null || accountStatusRoot === null) {
+    throw new Error("Missing student account surfaces");
+  }
+  accountController = new AccountAccessController({
+    client: accountClient,
+    gateRoot: accountGateRoot,
+    statusRoot: accountStatusRoot,
+    gameSurface,
+    gameCanvas,
+    creatorRoot: root,
+    onSession: async (username) => {
+      try {
+        await drafts.activateAccount(username);
+        await imageLabSubmissionPersistence.activateAccount(username);
+        await studioCoachRuntime.activateAccount(username);
+      } catch (error) {
         drafts.deactivateAccount();
         imageLabSubmissionPersistence.deactivateAccount();
         studioCoachRuntime.deactivateAccount();
-        throw new AccountClientError("AUTHENTICATION_REQUIRED");
+        throw error;
       }
-      accountController?.setCloudMessage("Saved on this device · cloud copy paused");
-      return;
-    }
-    try {
-      const recovery = await cloudRecovery.recoverLatest(username);
-      accountController?.setCloudMessage(cloudRecoveryStatusMessage(recovery));
-    } catch (error) {
-      if ((error instanceof AccountClientError || error instanceof AccountAssetClientError) &&
-        error.code === "AUTHENTICATION_REQUIRED") {
+      try {
+        await cloudSync.setAccount(username);
+      } catch (error) {
         cloudSync.signOut();
+        if ((error instanceof AccountClientError || error instanceof AccountAssetClientError) &&
+          error.code === "AUTHENTICATION_REQUIRED") {
+          drafts.deactivateAccount();
+          imageLabSubmissionPersistence.deactivateAccount();
+          studioCoachRuntime.deactivateAccount();
+          throw new AccountClientError("AUTHENTICATION_REQUIRED");
+        }
+        accountController?.setCloudMessage("Saved on this device · cloud copy paused");
+        return;
+      }
+      try {
+        const recovery = await cloudRecovery.recoverLatest(username);
+        accountController?.setCloudMessage(cloudRecoveryStatusMessage(recovery));
+      } catch (error) {
+        if ((error instanceof AccountClientError || error instanceof AccountAssetClientError) &&
+          error.code === "AUTHENTICATION_REQUIRED") {
+          cloudSync.signOut();
+          drafts.deactivateAccount();
+          imageLabSubmissionPersistence.deactivateAccount();
+          studioCoachRuntime.deactivateAccount();
+          throw new AccountClientError("AUTHENTICATION_REQUIRED");
+        }
+        accountController?.setCloudMessage("Saved on this device · cloud copy paused");
+      }
+    },
+    onSignedOut: async (_explicit) => {
+      cloudSync.signOut();
+      try {
+        await handler.isolateAccountWork();
+      } finally {
         drafts.deactivateAccount();
         imageLabSubmissionPersistence.deactivateAccount();
         studioCoachRuntime.deactivateAccount();
-        throw new AccountClientError("AUTHENTICATION_REQUIRED");
       }
-      accountController?.setCloudMessage("Saved on this device · cloud copy paused");
     }
-  },
-  onSignedOut: async (_explicit) => {
-    cloudSync.signOut();
-    try {
-      await handler.isolateAccountWork();
-    } finally {
-      drafts.deactivateAccount();
-      imageLabSubmissionPersistence.deactivateAccount();
-      studioCoachRuntime.deactivateAccount();
-    }
-  },
-  onReset: () => accountReset.reset("RESET")
-});
-const accountPublicApi = createAccountBootstrap(accountController);
-window.AdMarketAccount = accountPublicApi;
+  });
+  window.AdMarketAccount = createAccountBootstrap(accountController);
+}
 const handler = new BrowserCreatorHandler(
   root,
   shell,
@@ -1837,11 +2169,64 @@ const handler = new BrowserCreatorHandler(
   practiceService,
   cloudSync
 );
+const canvasResizeObserver = typeof globalThis.ResizeObserver === "function"
+  ? new ResizeObserver((entries) => {
+      const size = entries[0]?.contentRect ??
+        shell.canvasRegion.getBoundingClientRect();
+      const width = Math.min(
+        1280,
+        Math.max(0, size.width - 32),
+        Math.max(0, size.height - 32) * 16 / 9
+      );
+      if (width > 0) {
+        shell.canvasRegion.style.setProperty(
+          "--studio-canvas-display-width",
+          `${Math.floor(width)}px`
+        );
+      }
+      handler.refreshCanvasDisplay();
+    })
+  : null;
+canvasResizeObserver?.observe(shell.canvasRegion);
+const teacherReady = mode.kind === "teacher-playtest"
+  ? (async (): Promise<void> => {
+      const username = TEACHER_PLAYTEST_BROWSER_NAMESPACE;
+      try {
+        await drafts.activateAccount(username);
+        await imageLabSubmissionPersistence.activateAccount(username);
+        await studioCoachRuntime.activateAccount(username);
+        await cloudSync.setAccount(username);
+        const recovery = await cloudRecovery.recoverLatest(username);
+        setCloudMessage(cloudRecoveryStatusMessage(recovery));
+      } catch (error) {
+        cloudSync.signOut();
+        drafts.deactivateAccount();
+        imageLabSubmissionPersistence.deactivateAccount();
+        studioCoachRuntime.deactivateAccount();
+        throw error;
+      }
+      gameSurface.hidden = false;
+      gameSurface.inert = false;
+      gameSurface.removeAttribute("aria-hidden");
+      gameCanvas.tabIndex = 0;
+      root.hidden = false;
+      root.inert = false;
+      root.removeAttribute("aria-hidden");
+    })()
+  : null;
 const guidedJourney = new GuidedJourneyController(shell.overlay, (step) => {
   if (step.tool === "game") {
     shell.overlay.querySelector<HTMLButtonElement>('[data-command="return"]')?.click();
     return;
   }
+  if (step.id === "roles") {
+    shell.overlay.querySelector<HTMLButtonElement>("[data-role-guide-open]")?.click();
+    return;
+  }
+  if (step.id === "product-name") {
+    shell.overlay.querySelector<HTMLInputElement>('input[aria-label="Product name"]')?.focus();
+    return;
+  }
   if (step.aidaStage !== undefined) {
     handler.selectAidaStage(step.aidaStage);
     studioTools.select("aida");
@@ -1877,24 +2262,26 @@ shell.zoomFill.addEventListener("click", () => {
 shell.zoomIn.addEventListener("click", () => {
   runCanvasSizeAction(() => handler.resizeSelectedObject(1.2));
 });
-accountMutations.subscribe((mutation) => {
-  if (mutation.kind === "session") {
-    accountController?.requireReauthentication();
-    return;
-  }
-  if (accountIdentity.current() !== mutation.username) return;
-  if (mutation.kind === "reset-pending") {
-    accountController?.holdForReset();
-    cloudSync.signOut();
-    void handler.isolateAccountWork().finally(() => {
-      drafts.deactivateAccount();
-      imageLabSubmissionPersistence.deactivateAccount();
-      studioCoachRuntime.deactivateAccount();
-    });
-    return;
-  }
-  accountController?.completeReset();
-});
+if (mode.kind === "student") {
+  accountMutations.subscribe((mutation) => {
+    if (mutation.kind === "session") {
+      accountController?.requireReauthentication();
+      return;
+    }
+    if (accountIdentity.current() !== mutation.username) return;
+    if (mutation.kind === "reset-pending") {
+      accountController?.holdForReset();
+      cloudSync.signOut();
+      void handler.isolateAccountWork().finally(() => {
+        drafts.deactivateAccount();
+        imageLabSubmissionPersistence.deactivateAccount();
+        studioCoachRuntime.deactivateAccount();
+      });
+      return;
+    }
+    accountController?.completeReset();
+  });
+}
 const productPriceGuideClient = new ProductPriceGuideClient();
 const moneyPanel = new ProductMoneyPanel(
   shell.moneyCheckPanel,
@@ -1921,6 +2308,16 @@ const pairGame = new PairGameController(
   () => handler.schedulePracticeAutosave()
 );
 handler.attachPairGame(pairGame);
+const roleGuide = new RoleGuideController(
+  root,
+  shell.overlay,
+  () => {
+    pairGame.acknowledgeRoleGuide();
+    handler.schedulePracticeAutosave();
+  },
+  () => shell.overlay.querySelector<HTMLButtonElement>("[data-guide-open-tool]")?.focus()
+);
+handler.attachRoleGuide(roleGuide);
 const imageLabRuntime = new ImageLabRuntime({
   client: new ImageLabClient(),
   exportDesign: (pair) => handler.exportDesignDataUrl(pair),
@@ -1969,7 +2366,8 @@ const catalogueRuntime = new CatalogueRuntime({
 });
 const productKitPanel = new ProductKitPanel(
   shell.productBuilderPanel,
-  (request) => handler.queueProductKitPlacement(request)
+  (request) => handler.queueProductKitPlacement(request),
+  (asset) => handler.queueCataloguePlacement(asset)
 );
 productKitPanel.unavailable();
 handler.attachProductKitPanel(productKitPanel);
@@ -2044,14 +2442,46 @@ root.querySelector<HTMLButtonElement>('[data-command="return"]')
     }));
   });
 
-declare global {
-  interface Window {
-    AdMarketCreator: CreatorPublicApi;
-    AdMarketPractice: PracticePublicApi;
-    AdMarketRoom: MarketPublicApi;
-    AdMarketAccount: AccountBootstrapPublicApi;
+window.AdMarketCreator = publicApi;
+window.AdMarketRoom = marketPublicApi;
+
+if (mode.kind === "teacher-playtest") {
+  if (teacherReady === null) {
+    throw new Error("Teacher playtest storage is not ready");
   }
+  return teacherReady.then(() => {
+    return {
+      resetLocalState: async () => {
+        cloudSync.signOut();
+        try {
+          await handler.isolateAccountWork();
+        } finally {
+          drafts.deactivateAccount();
+          imageLabSubmissionPersistence.deactivateAccount();
+          studioCoachRuntime.deactivateAccount();
+        }
+        await Promise.all([
+          drafts.resetAccount(TEACHER_PLAYTEST_BROWSER_NAMESPACE),
+          cloudMetadata.resetAccount(TEACHER_PLAYTEST_BROWSER_NAMESPACE),
+          ...(cloudOutbox === undefined
+            ? []
+            : [cloudOutbox.resetAccount(TEACHER_PLAYTEST_BROWSER_NAMESPACE)]),
+          imageLabSubmissionPersistence.resetAccount(
+            TEACHER_PLAYTEST_BROWSER_NAMESPACE
+          ),
+          studioCoachRuntime.resetAccount(TEACHER_PLAYTEST_BROWSER_NAMESPACE)
+        ]);
+      }
+    };
+  });
+}
+return null;
 }
 
-window.AdMarketCreator = publicApi;
-window.AdMarketRoom = marketPublicApi;
+runAdvertisingGameRoute(window.location.pathname, {
+  replace: (location) => window.location.replace(location),
+  bootStudent: bootStudentApplication,
+  bootTeacherDashboard,
+  bootTeacherPlaytest,
+  renderNotFound: renderNotFoundApplication
+});
```

## File: `docs/operations/advertising-game-account-progress.md`

```markdown
# Account, progress and asset activation

The optional account service adds pair credentials, cloud progress and owned
image storage. Each installation must use its own Supabase project, Netlify
site, secrets and disposable validation accounts.

## Routes and sessions

Pairs sign in only at `/student`. Teachers sign in only at `/teacher`.
Teacher authentication uses a separate secure, HttpOnly session and never
reuses a pair cookie or classroom provisioning code.

Configure these additional teacher-only server values:

```text
ADVERTISING_GAME_TEACHER_PASSWORD=<8 to 128 byte teacher password>
ADVERTISING_GAME_TEACHER_SESSION_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_TEACHER_SESSION_HOURS=<whole number from 1 to 24>
```

The teacher password and session secret must remain server-only. Do not put
either value in Vite variables, browser code, HTML, logs or source control.

`/teacher/playtest` is protected by the same teacher session but stores the
game under the reserved server identity `teacher-playtest`. That username
cannot be created, replaced or reset through ordinary pair administration.
The server resolves its password and Supabase user ID; neither is returned to
the browser. Its cloud progress, owned assets and browser storage namespace
are separate from every pair account.

## Pair credentials and resets

The teacher dashboard creates a pair with a teacher-entered password or an
optional generated password. Plaintext is shown only in the immediate
credential panel so the teacher can copy it; later account listings do not
return it.

Replacing a pair password immediately invalidates the old password and the
existing pair session. The pair must sign in again with the replacement
password.

Resetting a selected pair requires the teacher to type that pair's exact
username. It removes that account's progress, drafts, advertisement designs,
uploaded images and cloud saves while retaining its username and password.
This operation is separate from a pair's own exact-`RESET` account reset.

The teacher playtest factory reset also requires exact `RESET`. It resets the
reserved account's server progress and assets first, then clears only the
isolated teacher-playtest browser state and opens the first game screen.
Cancellation changes no remote or local state.

## Database foundation

Choose the target explicitly:

```text
SUPABASE_PROJECT_REF=<project-ref>
```

Run a read-only shared-project collision preflight before applying anything.
Stop if the `advertising_game` schema, `advertising_game.progress`,
`advertising_game.backend_gateway`,
`public.advertising_game_progress_rpc` or
`public.advertising_game_backend_authorized` already exists unexpectedly.
Never modify unrelated schemas or application objects.

Migration `20260719071834` uses the exact transaction body in
`docs/operations/advertising-game-account-progress.sql`; apply exactly once
through the chosen migration system. The file deliberately omits `BEGIN`,
`COMMIT` and migration-ledger statements because the migration runner supplies
the outer transaction. Apply the Edge gateway migration exactly once as a
separate, reviewed step.

After application, use read-only catalogue checks to confirm:

- the migration ledger contains one `20260719071834` row;
- the schema, table, index and exact RPC signatures exist once;
- row-level security is enabled and there are no direct table policies;
- `has_schema_privilege` is false for browser-facing roles;
- `has_table_privilege` is false for browser-facing roles and `service_role`;
- only `service_role` can execute the narrowly scoped RPCs;
- each security-definer Function has an empty `search_path`; and
- no unexpected owner, overload, role, grant or neighbouring object changed.

The progress RPC enforces per-user ownership, a 16-document cap, bounded JSON,
compare-and-swap revisions and advisory-lock ordering. The reset operation
deletes only the authenticated user's progress while holding the same lock.

## Server-only environment

Configure these values in the server runtime:

```text
SUPABASE_URL=<project HTTPS API URL>
SUPABASE_PUBLISHABLE_KEY=<project publishable key>
ADVERTISING_GAME_EDGE_GATEWAY_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_USERNAME_HMAC_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_CLASSROOM_CODE=<8 to 128 character classroom access code>
ADVERTISING_GAME_ASSET_NAMESPACE_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_TEACHER_PASSWORD=<8 to 128 byte teacher password>
ADVERTISING_GAME_TEACHER_SESSION_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_TEACHER_SESSION_HOURS=<whole number from 1 to 24>
```

Never place a Supabase secret key, gateway secret, classroom code or HMAC
secret in Vite variables, browser code, HTML, logs or source control. The
Supabase Edge broker keeps its secret key inside Supabase and accepts only the
account-creation and progress envelopes used by this application.

Account provisioning is teacher-only. The server maps a pair username to an
HMAC-derived synthetic address under `accounts.admarket.invalid`, then creates
a confirmed password account. Before activation, verify that the chosen
Supabase Auth configuration accepts this domain and the generated password
format through the exact server and sign-in paths.

The response deliberately distinguishes an unavailable username. This is an
accepted username-enumeration trade-off only while provisioning requires the
teacher setup code, is rate-limited and returns no synthetic email, user ID or
token. Reassess that trade-off before exposing provisioning more broadly.

## Progress and assets

Cloud saves accept only bounded offline `CampaignDocumentV1` snapshots. The
document identity in the request must match the document, and cloud identifiers
use the narrower safe-ID contract enforced by both browser and server.
Compare-and-swap revisions remain isolated per account.

Owned images use the strongly consistent Netlify Blobs store
`advertising-game-account-assets-v1`. The namespace secret must differ from
the username HMAC secret. The API accepts signature-verified PNG, JPEG or WebP
data at immutable SHA-256 URLs. Limits are 4 MiB per asset, 32 assets per
account and 32 MiB total per account. SVG is rejected, repeated identical PUTs
are idempotent, and there is no delete endpoint.

## Hosted validation gate

Before student access, use disposable accounts on a fresh hosted preview:

1. Save and load one document under two accounts; confirm strict isolation.
2. Verify discovery returns at most 16 metadata records and never returns
   document bodies, user IDs, email addresses or tokens.
3. Verify current revisions advance, stale writes return only
   `REVISION_CONFLICT` plus the current revision, and the 17th document fails.
4. Race two independent saves at the 16-document boundary. Exactly one must
   succeed and the final list must contain exactly 16 documents.
5. Switch accounts in a second tab while progress, asset and logout requests
   are delayed. Stale requests must fail with `ACCOUNT_IDENTITY_CHANGED`
   without mutating the new session.
6. Verify refresh rotates the secure HttpOnly cookies and terminal expiry
   clears them.
7. Upload valid PNG, JPEG and WebP data; verify byte-exact reads, idempotent
   duplicate PUTs, signature/MIME/digest rejection and all byte/count limits.
8. Inspect responses and logs. Confirm they expose no synthetic address,
   Supabase user ID, token, URL, publishable key or secret.

Rotate classroom codes between cohorts. Rotate either HMAC secret only with an
explicit migration plan because doing so changes login identities or asset
namespaces.

Password replacement and reset requests carry idempotent operation IDs. If an
operator receives an uncertain response, inspect the account and operation
state before issuing a new mutation. Do not assume a browser timeout means the
server did nothing.

## Rollback boundary

Disable the account routes first and decide whether progress must be retained.
An authorised operator may then revoke only the exact RPC grants and remove
only the named Advertising Market objects. Stop rather than use `CASCADE` or
alter unrelated data.
```

## File: `docs/operations/image-lab.md`

```markdown
# Image Lab: teacher-controlled account allowances

Image Lab is built into the creator, but it is disabled by default. The normal product maker, Logo Lab, drawing tools and asset catalogue remain available while it is off.

Access has two independent server-side gates. `IMAGE_LAB_ENABLED` is the deployment kill switch. The teacher dashboard controls the global allowance-ledger setting and the separate Object Forge and Make It Real allowances for each pair account. A paid request requires an authenticated pair account, the global ledger setting to be on, and at least one available use for that request's stage.

Student devices do not receive a teacher code, an unlock control, a raw account ID, a provider key or an unlimited session capability. The teacher makes every availability change from `/teacher`. New accounts receive zero uses unless the teacher changes the defaults for future accounts. Changing those defaults does not alter existing accounts.

The password-protected game, physical teacher supervision, account-bound access and server-authoritative allowance ledger form part of the classroom access and age-assurance layer. They do not override a provider's eligibility or minor-use terms.

## Teacher-controlled allowance gate

Image Lab may operate only while the teacher is physically present. The retired `IMAGE_LAB_FAL_MINOR_USE_APPROVED` and classroom-code gates are not read by the student routes. Activation requires `IMAGE_LAB_SCHOOL_APPROVED=true`, the deployment kill switch, a valid account session and the teacher-controlled ledger setting.

The current fal.ai Acceptable Use Policy says people under 18 may not use the service and makes account holders responsible for their users. Removing the technical letter gate records a supervised operating decision; it is not a claim that fal.ai has changed or waived its policy.

A direct OpenAI API route has a different published framework: OpenAI's Under 18 API Guidance does not require an approval letter. It requires additional safeguards for minor-facing products, including age-appropriate disclosure, content filtering, reasonable monitoring and reporting/escalation, and age assurance where appropriate. Personal data of children under 13 or the applicable age of digital consent must not be processed without Zero Data Retention. The account allowance gate satisfies only part of that framework; the remaining controls must be implemented before enabling a direct OpenAI route.

References:

- [fal.ai Acceptable Use Policy](https://fal.ai/legal/acceptable-use-policy)
- [fal.ai server-side integration guidance](https://fal.ai/docs/documentation/model-apis/inference/server-side)
- [fal.ai queue API](https://fal.ai/docs/documentation/model-apis/inference/queue)
- [fal.ai GPT Image 2](https://fal.ai/models/openai/gpt-image-2)
- [fal.ai GPT Image 2 Edit](https://fal.ai/models/openai/gpt-image-2/edit)
- [OpenAI Under 18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)

## Server-owned profiles

Students cannot choose a model, slug, dimensions, step count, guidance, quality tier, output count or safety setting.

| Game power | Stable profile ID | fal model | Fixed request | Verified return |
| --- | --- | --- | --- | --- |
| Object Forge | `object-forge-gpt-image-2-low-v1` | `openai/gpt-image-2` | exact 1024×1024, low quality, one PNG | 1024×1024 PNG |
| Make It Real | `make-it-real-gpt-image-2-high-v2` | `openai/gpt-image-2/edit` | one 1024×576 canvas reference, exact `{ width: 1280, height: 720 }`, high quality, one PNG | exact 1280×720 PNG |

The two endpoints do not share one generic payload. Object Forge sends `prompt`, `image_size`, `quality`, `num_images` and `output_format`. Make It Real sends those fields plus `image_urls`. The production adapter uses an explicit `{ width, height }` object, not a named aspect-ratio preset.

GPT Image 2 concrete output sizes must use multiples of 16, keep each edge at or below 3840 pixels, keep the aspect ratio at or below 3:1, and contain 655,360–8,294,400 pixels. The server checks all four rules before reserving an allowance or dispatching to fal. A 1024×576 output request is below the pixel floor; the earlier 1088×608 return was fal's deterministic rescale of that invalid request, not a canonical 16:9 output. The smallest exact 16:9 size above the floor is 1280×720. A supervised validation request returned an exact 1280×720 PNG, measured from the saved PNG header.

The browser's 512×512 Object Forge processing canvas is a local post-generation asset size, not a GPT Image 2 request. The 1024×576 Make It Real canvas is the reference image sent to the edit endpoint. Neither value is used as the GPT Image 2 output `image_size`.

The fixed profiles are defined in source and must change only after a new supervised evaluation of output quality, silhouette fidelity, safety and cost.

Two server-only experimental profiles are available for an adult-operated blind A/B test. They are not browser choices and do not replace the defaults merely because they cost less.

| A/B profile ID | fal model | Fixed output | Fixed limits |
| --- | --- | --- | --- |
| `z-image-lora-v1` | `fal-ai/z-image/turbo/lora` | 512×512 PNG | 8 steps, one image, safety on, regular acceleration, prompt expansion off, exactly one server-owned LoRA at scale 1 |
| `flux2-turbo-edit-v1` | `fal-ai/flux-2/turbo/edit` | 1024×576 PNG | guidance 2.5, one image, safety on, prompt expansion off, exactly one canvas reference |

Leave the selectors absent to retain the current profiles. For a controlled adult A/B run only, set one or both of:

```text
IMAGE_LAB_OBJECT_PROFILE_ID=z-image-lora-v1
IMAGE_LAB_Z_LORA_URL=<trimmed public HTTPS URL for the approved shared adapter>
IMAGE_LAB_REALISE_PROFILE_ID=flux2-turbo-edit-v1
```

Only those profile IDs are accepted. An unknown selector, or a missing or unsafe LoRA URL while `z-image-lora-v1` is selected, fails closed before allowance is reserved or a fal request is submitted. The adapter URL is server-only and is never returned to the browser. Existing job tokens retain their original stable profile ID, so status and result requests continue using the submitted model after selectors change.

The browser sends constrained creative choices under its same-origin account session. Make It Real also sends a locally prepared 1024×576 reference image of the current canvas. It does not send a pair alias, account ID, teacher credential or allowance count. The fal key, model identity, prompt wrapper, paid media URL and upstream request ID remain server-side.

## Required Netlify environment

```text
IMAGE_LAB_ENABLED=true
IMAGE_LAB_SCHOOL_APPROVED=true
IMAGE_LAB_ACCOUNT_CAP_USD=5
IMAGE_LAB_SIGNING_SECRET=<at least 32 random characters>
FAL_KEY=<server-only fal key>
```

The account-service variables documented in `advertising-game-account-progress.md` are also required because every status, submission, poll, result and reconciliation request resolves the signed-in pair from the account cookies.

`IMAGE_LAB_ACCOUNT_CAP_USD` is an activation acknowledgement, not a billing control. Configure a real hard spending limit on the fal account or dedicated key before enabling the feature. The allowance ledger does not replace that provider-side cap. Never put `FAL_KEY` in Vite variables, HTML, client code or a public repository.

## Allowance lifecycle

Object Forge and Make It Real have independent counters for every pair:

- `granted` is the total authorised use count;
- `available` is `granted - consumed - reserved`;
- `reserved` is held while a paid job may be in progress;
- `consumed` records a confirmed completed deliverable;
- `refunded` is a terminal operation that releases a reservation after a confirmed failure;
- `uncertain` keeps the reservation in place until the existing job is checked.

The teacher dashboard can set the exact available count, add uses or revoke only unconsumed and unreserved uses. It can also add uses to selected pairs, switch Image Lab on or off globally, and set separate defaults for accounts created later. All counts are whole numbers from 0 to 100. Every mutation has an idempotent operation identity; a replay with different data is rejected.

Defaults apply only when a new account is created through the teacher dashboard. An existing account that first reaches Image Lab later starts at zero, even if the future-account default has changed.

## Reconciliation

Submission is never repeated automatically. If the browser cannot determine whether a paid request started, it retains the original job token and shows **Check request**. That action sends the existing token once to `POST /api/image-lab/jobs/reconcile` under the same pair account.

- A confirmed completed job is consumed once.
- A confirmed failed job is refunded once.
- A queued or running job remains reserved.
- An unknown provider outcome remains uncertain and reserved.

Do not create a replacement request while the original reservation is uncertain. First use **Check request** from the same account and device. If the teacher dashboard reports an uncertain allowance mutation, retain the entered values and use **Refresh allowances**; do not repeat the mutation with a new operation ID.

## Expected classroom cost

At the live prices checked on 20 July 2026, a 1024×1024 Object Forge image at low quality is US$0.006. Budget US$0.211 for each 1280×720 high-quality edit unless the fal dashboard shows a newer lower price.

For 15 pairs, six Object Forge images each cost about US$0.54 in total. One final Make It Real image each adds up to about US$3.17, giving a conservative session ceiling of about **US$3.71** before price changes. Raising the final allowance to two would raise that ceiling to about **US$6.87**. Confirm current pricing before every activation.

The cheaper FLUX and Z-Image candidates remain available only as adult-operated A/B profiles. The live benchmark found that their lower price did not compensate for weaker silhouette reliability and poorer catalogue-style fit. The shared Z-Image LoRA remains a possible future consistency experiment, not a current cost-saving or production recommendation.

Alternative-profile trials remain teacher-operated and must never create an ungated student-access path.

## Security properties and limits

- Image jobs use authenticated encrypted browser tokens; the upstream fal request ID is not readable in the token.
- Every public image-generation request resolves the signed-in account from `HttpOnly`, `SameSite=Strict` account cookies. The status and job routes reject browser-supplied aliases, user IDs, session IDs and team IDs.
- The private allowance tables and RPC are reachable only through the service-role broker. Browser roles have no schema, table or function access.
- Generated media is fetched by the server from an allowlisted `fal.media` HTTPS host, checked for type, signature, byte limit and the exact dimensions pinned to the submitted profile, then proxied same-origin with `no-store`.
- Accepted images become owned local blobs in the campaign draft. Saved campaigns do not depend on expiring fal URLs.
- Submission is not retried automatically.
- Reservation, completion and refund use advisory locks and an operation journal, so concurrent replay is atomic and idempotent. The external fal account cap remains mandatory.
- All automated verification uses injected fake responses. It performs no paid fal inference.

## Activation check

1. Confirm school approval and the teacher's physical supervision for the complete session.
2. Reserve the four named database objects, apply the allowance migration once, run the schema and grant checks below, and release the shared-project reservation.
3. Create a dedicated server-side fal key and apply a hard account or key spending cap at the provider.
4. Configure the account-service variables, `IMAGE_LAB_ENABLED=true`, `IMAGE_LAB_SCHOOL_APPROVED=true`, the activation acknowledgement, a new signing secret and the server-only fal key.
5. Verify that the deployed function manifest exposes `/api/image-lab/session`, `/api/image-lab/jobs`, `/api/image-lab/jobs/reconcile` and `/api/image-lab/assets`, with no unlock or lock route.
6. Sign in at `/teacher`. Keep the global ledger setting off and both future-account defaults at zero while preparing the class.
7. Use a designated demonstration pair account to test one Object Forge use, one Make It Real use and **Check request** before students arrive. Confirm the resulting available and reserved counts in the teacher dashboard.
8. Keep the default profiles unless sealed teacher-operated blind A/B evidence supports a change.
9. Allocate only the required uses to the named pair aliases, then switch the global ledger setting on immediately before the supervised activity.
10. After the activity, switch the global ledger setting off. Reconcile every reserved or uncertain job before revoking unused availability. Disable the deployment kill switch when Image Lab is no longer required.

## Atomic allowance ledger migration

The deterministic source is
`docs/operations/advertising-game-image-lab-allowances.sql`. It contains only
the transaction body for one `apply_migration` call. Do not add migration-ledger
statements or transaction-control statements to that file.

The migration is limited to these Advertising objects:

```text
advertising_game.image_lab_settings
advertising_game.image_lab_allowance
advertising_game.image_lab_operation
public.advertising_game_image_lab_rpc
```

Before applying it, reserve those four names for the Advertising lane in the
shared-project coordination channel. Do not proceed while another lane holds a
database-mutation reservation.

Run this read-only shared-project collision preflight:

```sql
select n.nspname as schema_name, c.relname, c.relkind
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'advertising_game'
  and c.relname in (
    'image_lab_settings',
    'image_lab_allowance',
    'image_lab_operation'
  ))
or (n.nspname <> 'advertising_game'
  and c.relname in (
    'image_lab_settings',
    'image_lab_allowance',
    'image_lab_operation'
  ))
order by n.nspname, c.relname;

select n.nspname as schema_name,
       p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where p.proname = 'advertising_game_image_lab_rpc';
```

The expected result is no matching relation and no matching function. Also
confirm that `advertising_game.progress` and
`public.advertising_game_progress_rpc` still exist; they are neighbouring
Advertising objects and are not part of this migration.

After one approved application, verify the object boundary and grants:

```sql
select n.nspname as schema_name,
       c.relname,
       c.relrowsecurity
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'advertising_game'
  and c.relname in (
    'image_lab_settings',
    'image_lab_allowance',
    'image_lab_operation'
  )
order by c.relname;

select conrelid::pg_catalog.regclass::text as relation_name,
       conname,
       pg_catalog.pg_get_constraintdef(oid) as definition
from pg_catalog.pg_constraint
where conrelid in (
  'advertising_game.image_lab_settings'::pg_catalog.regclass,
  'advertising_game.image_lab_allowance'::pg_catalog.regclass,
  'advertising_game.image_lab_operation'::pg_catalog.regclass
)
order by relation_name, conname;

select p.oid::pg_catalog.regprocedure::text as signature,
       p.prosecdef as security_definer,
       p.proowner::pg_catalog.regrole::text as owner,
       p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'advertising_game_image_lab_rpc';

select
  pg_catalog.has_schema_privilege('anon', 'advertising_game', 'USAGE')
    as anon_schema_usage,
  pg_catalog.has_schema_privilege('authenticated', 'advertising_game', 'USAGE')
    as authenticated_schema_usage,
  pg_catalog.has_table_privilege(
    'anon',
    'advertising_game.image_lab_allowance',
    'SELECT,INSERT,UPDATE,DELETE'
  ) as anon_table_access,
  pg_catalog.has_table_privilege(
    'authenticated',
    'advertising_game.image_lab_allowance',
    'SELECT,INSERT,UPDATE,DELETE'
  ) as authenticated_table_access,
  pg_catalog.has_function_privilege(
    'anon',
    'public.advertising_game_image_lab_rpc(uuid,text,text,integer,text,text,text)',
    'EXECUTE'
  ) as anon_rpc_execute,
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.advertising_game_image_lab_rpc(uuid,text,text,integer,text,text,text)',
    'EXECUTE'
  ) as authenticated_rpc_execute,
  pg_catalog.has_function_privilege(
    'service_role',
    'public.advertising_game_image_lab_rpc(uuid,text,text,integer,text,text,text)',
    'EXECUTE'
  ) as service_rpc_execute;
```

All three `relrowsecurity` values must be true. Every browser-role result in
the last query must be false, and `service_rpc_execute` must be true. The
function must be owned by `postgres`, be security-definer, and include
`search_path=""` in `proconfig`.

If verification fails before the application is released, rollback is limited
to the same four names and must not use `CASCADE`:

```sql
drop function public.advertising_game_image_lab_rpc(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text
);
drop table advertising_game.image_lab_operation;
drop table advertising_game.image_lab_allowance;
drop table advertising_game.image_lab_settings;
```

Before rollback, confirm that no paid job remains reserved or uncertain.
After verification or rollback, release the shared-project reservation
immediately. Never include any neighbouring schema, table, function, account,
asset bucket, or migration-ledger row in this rollback.
```

## File: `docs/operations/release-workflow.md`

```markdown
# Advertising Market Game release workflow

The GitHub workflow validates source and builds a downloadable artifact. It
does not deploy. Deployment is a separate operator action because the game
requires both the verified static files and the Function bundles bound into
that same release artifact.

## Public routes and authority boundaries

- `/student` is the pair sign-in and game route. It must not expose teacher
  account, password, reset or Image Lab allowance controls.
- `/teacher` has an independent server-authenticated teacher session. It opens
  account administration, Image Lab allowances and the teacher playtest only
  after the teacher password has been accepted.
- `/teacher/playtest` uses the reserved server identity
  `teacher-playtest`. The browser receives neither that account's password nor
  its Supabase user ID, and its progress, assets and browser storage are
  isolated from every pair account.

Configure `ADVERTISING_GAME_TEACHER_PASSWORD`, a separate
`ADVERTISING_GAME_TEACHER_SESSION_SECRET`, and
`ADVERTISING_GAME_TEACHER_SESSION_HOURS` from 1 to 24 only in the server
runtime. None of those values belongs in Vite variables, static files, browser
storage, logs or the public source snapshot.

The teacher dashboard can create a pair with a typed password or generate one
for the teacher to copy. It can replace a password, which makes the old
password and existing pair session unusable, and can reset one pair's saved
work after the teacher types that pair's exact username. The selected-pair
reset retains the username and password. The teacher playtest factory reset is
separate, requires exact `RESET`, and clears only its reserved remote and local
state.

Image Lab remains server-authoritative. The teacher controls its global
availability, future-account defaults, individual pair allowances and batch
allocations from `/teacher`. Student devices receive no teacher code or
unlimited activation control. See `docs/operations/image-lab.md` for
reservation and uncertain-outcome handling.

## Release sequence

1. Run `Build & Validate Web` for the exact candidate commit.
2. Require the locked dependency install, Python catalogue tests, TypeScript
   check, serialized application suite, web-build contracts, Linux Godot tests,
   web export, artifact assembly and static verifier to pass.
3. Download the `advertising-market-game-web` artifact to a new local path. Do
   not rebuild or modify it.
4. Verify it locally:

   ```powershell
   node scripts/verify-web-export.mjs "C:\path\to\downloaded-artifact"
   ```

5. Create a draft on the dedicated non-production QA site:

   ```powershell
   pnpm run deploy:draft --artifact "C:\path\to\downloaded-artifact" --site-id "<your-netlify-site-id>"
   ```

6. Test that exact hosted draft at the supported classroom viewports. At
   minimum verify login and recovery where configured, product building,
   advert editing, pair-role interaction, save-before-close, required
   Functions and a clean browser console.
7. Production publication is a separate action. Run it only after the project
   owner has reviewed the draft and explicitly authorised that exact artifact:

   ```powershell
   pnpm run deploy:production --artifact "C:\path\to\downloaded-artifact" --site-id "<your-netlify-site-id>"
   ```

8. Read the resulting deploy record back. Require `state=ready`, the intended
   context and aliases, and the expected Function set.

Never enable an unreviewed static-only auto-deploy. It can appear healthy while
removing the account, market or Image Lab routes.

The deployment commands fail closed unless the caller supplies both
`--artifact` and `--site-id`. They verify the exact release manifest, mirror
its static files and already-bound Function bundles into an isolated Netlify
context, and use the artifact's own `_headers`. They do not silently read
`build/web/` or select a maintainer's site.

## Reference environments

- Vite, `http.server` and static preview servers do not serve `/api/*`.
- `netlify dev` exercises local Function routing but not hosted visitor access,
  edge routing or hosted headers.
- Hosted-only behaviour must be tested on a hosted draft or deploy preview.
- Console evidence is tab-specific; check each entry's URL.
- Keep native Windows Godot quarantined if the working copy is on a filesystem
  known to trigger editor access violations. The Linux CI export is the
  reproducible release surface.

## Optional services

Accounts, cloud progress, the live market and Image Lab require independent
operator configuration. Keep their secrets server-side, begin with the
features disabled, and complete the corresponding operation guide before
student access:

- `docs/operations/advertising-game-account-progress.md`
- `docs/operations/live-market.md`
- `docs/operations/image-lab.md`
```

## File: `docs/operations/advertising-game-image-lab-allowances.sql`

```sql
-- Advertising Market Game Image Lab allowance ledger.
-- Apply this transaction-body SQL exactly once after the account-progress
-- foundation. Supabase apply_migration supplies the outer transaction and
-- migration-ledger write. Do not add transaction-control statements here.

do $collision_preflight$
declare
  v_name text;
begin
  if (
    select pg_catalog.count(*)
      from pg_catalog.pg_namespace
      where nspname = 'advertising_game'
  ) = 0 then
    raise exception using
      errcode = '3F000',
      message = 'Advertising Game schema is missing';
  end if;

  foreach v_name in array array[
    'image_lab_settings',
    'image_lab_allowance',
    'image_lab_operation'
  ] loop
    if exists (
      select 1
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'advertising_game'
          and c.relname = v_name
    ) then
      raise exception using
        errcode = '42P07',
        message = 'Advertising Game Image Lab relation collision';
    end if;
  end loop;

  if exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'advertising_game_image_lab_rpc'
  ) then
    raise exception using
      errcode = '42723',
      message = 'Advertising Game Image Lab function collision';
  end if;
end;
$collision_preflight$;

revoke all on schema advertising_game from public, anon, authenticated, service_role;

create table advertising_game.image_lab_settings (
  singleton_id boolean primary key default true
    check (singleton_id),
  enabled boolean not null default false,
  object_default integer not null default 0
    check (object_default between 0 and 100),
  realise_default integer not null default 0
    check (realise_default between 0 and 100),
  updated_at timestamptz not null default statement_timestamp()
);

create table advertising_game.image_lab_allowance (
  user_id uuid primary key references auth.users (id) on delete cascade,
  object_granted integer not null default 0
    check (object_granted between 0 and 100),
  object_consumed integer not null default 0
    check (object_consumed between 0 and 100),
  object_reserved integer not null default 0
    check (object_reserved between 0 and 100),
  realise_granted integer not null default 0
    check (realise_granted between 0 and 100),
  realise_consumed integer not null default 0
    check (realise_consumed between 0 and 100),
  realise_reserved integer not null default 0
    check (realise_reserved between 0 and 100),
  updated_at timestamptz not null default statement_timestamp(),
  constraint advertising_game_image_lab_object_total_check
    check (object_consumed + object_reserved <= object_granted),
  constraint advertising_game_image_lab_realise_total_check
    check (realise_consumed + realise_reserved <= realise_granted)
);

create table advertising_game.image_lab_operation (
  operation_id text primary key,
  ledger_operation text not null,
  user_id uuid references auth.users (id) on delete cascade,
  stage text,
  amount integer,
  job_key text,
  request_hash text not null,
  operation_status text not null,
  outcome_uncertain boolean not null default false,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint advertising_game_image_lab_operation_id_check
    check (operation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint advertising_game_image_lab_operation_kind_check
    check (ledger_operation in ('set_global', 'set', 'add', 'revoke', 'reserve')),
  constraint advertising_game_image_lab_operation_stage_check
    check (stage is null or stage in ('object', 'realise')),
  constraint advertising_game_image_lab_operation_amount_check
    check (amount is null or amount between 0 and 100),
  constraint advertising_game_image_lab_operation_job_key_check
    check (job_key is null or job_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint advertising_game_image_lab_operation_request_hash_check
    check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint advertising_game_image_lab_operation_status_check
    check (operation_status in ('reserved', 'completed', 'refunded')),
  constraint advertising_game_image_lab_operation_result_check
    check (pg_catalog.jsonb_typeof(result) = 'object'),
  constraint advertising_game_image_lab_operation_timestamps_check
    check (updated_at >= created_at)
);

alter table advertising_game.image_lab_settings enable row level security;
alter table advertising_game.image_lab_allowance enable row level security;
alter table advertising_game.image_lab_operation enable row level security;

revoke all on table advertising_game.image_lab_settings
  from public, anon, authenticated, service_role;
revoke all on table advertising_game.image_lab_allowance
  from public, anon, authenticated, service_role;
revoke all on table advertising_game.image_lab_operation
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema advertising_game
  from public, anon, authenticated, service_role;

create index advertising_game_image_lab_operation_user_idx
  on advertising_game.image_lab_operation (user_id, created_at desc);
create unique index advertising_game_image_lab_operation_job_idx
  on advertising_game.image_lab_operation (user_id, job_key)
  where job_key is not null and ledger_operation = 'reserve';

insert into advertising_game.image_lab_settings (
  singleton_id,
  enabled,
  object_default,
  realise_default
) values (true, false, 0, 0);

create function public.advertising_game_image_lab_rpc(
  p_user_id uuid,
  p_operation text,
  p_stage text,
  p_amount integer,
  p_operation_id text,
  p_job_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_settings advertising_game.image_lab_settings%rowtype;
  v_allowance advertising_game.image_lab_allowance%rowtype;
  v_existing_operation advertising_game.image_lab_operation%rowtype;
  v_status text;
  v_result jsonb;
  v_accounts jsonb;
begin
  if p_operation is null or p_operation not in (
    'status',
    'global_status',
    'set_global',
    'set',
    'add',
    'revoke',
    'reserve',
    'complete',
    'refund',
    'mark_uncertain',
    'list'
  ) then
    raise exception using errcode = '22023', message = 'invalid operation';
  end if;
  if p_operation_id is null
    or p_operation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_request_hash is null
    or p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid operation identity';
  end if;
  if p_stage is not null and p_stage not in ('object', 'realise') then
    raise exception using errcode = '22023', message = 'invalid stage';
  end if;
  if p_amount is not null
    and (p_amount < 0 or p_amount > 100) then
    raise exception using errcode = '22023', message = 'invalid amount';
  end if;
  if p_job_key is not null
    and p_job_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception using errcode = '22023', message = 'invalid job key';
  end if;

  if p_operation in ('status', 'set', 'add', 'revoke')
    and (
      p_user_id is null
      or p_job_key is not null
      or (
        p_operation = 'status'
        and (p_stage is not null or p_amount is not null)
      )
      or (
        p_operation <> 'status'
        and (
          p_stage is null
          or p_amount is null
          or (p_operation in ('add', 'revoke') and p_amount < 1)
        )
      )
    ) then
    raise exception using errcode = '22023', message = 'invalid account operation';
  end if;

  if p_operation in ('reserve', 'complete', 'refund', 'mark_uncertain')
    and (
      p_user_id is null
      or p_stage is null
      or p_amount is distinct from 1
      or p_job_key is null
    ) then
    raise exception using errcode = '22023', message = 'invalid reservation operation';
  end if;

  if p_operation in ('global_status', 'list')
    and (
      p_user_id is not null
      or p_stage is not null
      or p_amount is not null
      or p_job_key is not null
    ) then
    raise exception using errcode = '22023', message = 'invalid global read';
  end if;

  if p_operation = 'set_global'
    and (
      p_user_id is not null
      or p_job_key is not null
      or p_amount is null
      or (p_stage is null and p_amount not in (0, 1))
    ) then
    raise exception using errcode = '22023', message = 'invalid global mutation';
  end if;

  if p_operation in (
    'set_global',
    'set',
    'add',
    'revoke',
    'reserve',
    'complete',
    'refund',
    'mark_uncertain'
  ) then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('image-lab-global', 741927)
    );
    if p_user_id is not null then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_user_id::text, 741927)
      );
    end if;

    if exists (
      select 1
        from advertising_game.image_lab_operation
        where image_lab_operation.operation_id = p_operation_id
          and (
            image_lab_operation.user_id is distinct from p_user_id
            or image_lab_operation.stage is distinct from p_stage
            or image_lab_operation.amount is distinct from p_amount
            or image_lab_operation.job_key is distinct from p_job_key
            or image_lab_operation.request_hash is distinct from p_request_hash
            or (
              p_operation in ('set_global', 'set', 'add', 'revoke', 'reserve')
              and image_lab_operation.ledger_operation is distinct from p_operation
            )
            or (
              p_operation in ('complete', 'refund', 'mark_uncertain')
              and image_lab_operation.ledger_operation is distinct from 'reserve'
            )
          )
    ) then
      raise exception using errcode = '22023', message = 'operation replay mismatch';
    end if;

    select image_lab_operation.*
      into v_existing_operation
      from advertising_game.image_lab_operation
      where image_lab_operation.operation_id = p_operation_id;

    if found then
      if p_operation in ('set_global', 'set', 'add', 'revoke', 'reserve') then
        return v_existing_operation.result;
      end if;

      if v_existing_operation.operation_status in ('completed', 'refunded') then
        if (
          p_operation = 'complete'
          and v_existing_operation.operation_status = 'completed'
        ) or (
          p_operation = 'refund'
          and v_existing_operation.operation_status = 'refunded'
        ) then
          return v_existing_operation.result;
        end if;
        raise exception using errcode = '22023', message = 'terminal operation conflict';
      end if;

      if p_operation = 'mark_uncertain' then
        if v_existing_operation.operation_status is distinct from 'reserved' then
          raise exception using errcode = '22023', message = 'reservation is not open';
        end if;
        if v_existing_operation.outcome_uncertain then
          return v_existing_operation.result;
        end if;

        select *
          into v_settings
          from advertising_game.image_lab_settings
          where singleton_id = true;
        select *
          into v_allowance
          from advertising_game.image_lab_allowance
          where user_id = p_user_id;
        if not found then
          raise exception using errcode = 'P0002', message = 'allowance row missing';
        end if;

        v_result := pg_catalog.jsonb_build_object(
          'status', 'uncertain',
          'enabled', v_settings.enabled,
          'object', pg_catalog.jsonb_build_object(
            'granted', v_allowance.object_granted,
            'consumed', v_allowance.object_consumed,
            'reserved', v_allowance.object_reserved,
            'remaining', v_allowance.object_granted
              - v_allowance.object_consumed
              - v_allowance.object_reserved
          ),
          'realise', pg_catalog.jsonb_build_object(
            'granted', v_allowance.realise_granted,
            'consumed', v_allowance.realise_consumed,
            'reserved', v_allowance.realise_reserved,
            'remaining', v_allowance.realise_granted
              - v_allowance.realise_consumed
              - v_allowance.realise_reserved
          )
        );
        update advertising_game.image_lab_operation
          set outcome_uncertain = true,
              result = v_result,
              updated_at = pg_catalog.clock_timestamp()
          where image_lab_operation.operation_id = p_operation_id;
        return v_result;
      end if;

      if v_existing_operation.operation_status is distinct from 'reserved' then
        raise exception using errcode = '22023', message = 'reservation is not open';
      end if;

      if p_operation = 'complete' then
        if p_stage = 'object' then
          update advertising_game.image_lab_allowance
            set object_reserved = object_reserved - 1,
                object_consumed = object_consumed + 1,
                updated_at = pg_catalog.clock_timestamp()
            where user_id = p_user_id
              and object_reserved >= 1
            returning * into v_allowance;
        else
          update advertising_game.image_lab_allowance
            set realise_reserved = realise_reserved - 1,
                realise_consumed = realise_consumed + 1,
                updated_at = pg_catalog.clock_timestamp()
            where user_id = p_user_id
              and realise_reserved >= 1
            returning * into v_allowance;
        end if;
        v_status := 'completed';
      elsif p_operation = 'refund' then
        if p_stage = 'object' then
          update advertising_game.image_lab_allowance
            set object_reserved = object_reserved - 1,
                updated_at = pg_catalog.clock_timestamp()
            where user_id = p_user_id
              and object_reserved >= 1
            returning * into v_allowance;
        else
          update advertising_game.image_lab_allowance
            set realise_reserved = realise_reserved - 1,
                updated_at = pg_catalog.clock_timestamp()
            where user_id = p_user_id
              and realise_reserved >= 1
            returning * into v_allowance;
        end if;
        v_status := 'refunded';
      end if;
      if not found then
        raise exception using errcode = '23514', message = 'reserved counter mismatch';
      end if;

      select *
        into v_settings
        from advertising_game.image_lab_settings
        where singleton_id = true;
      v_result := pg_catalog.jsonb_build_object(
        'status', v_status,
        'enabled', v_settings.enabled,
        'object', pg_catalog.jsonb_build_object(
          'granted', v_allowance.object_granted,
          'consumed', v_allowance.object_consumed,
          'reserved', v_allowance.object_reserved,
          'remaining', v_allowance.object_granted
            - v_allowance.object_consumed
            - v_allowance.object_reserved
        ),
        'realise', pg_catalog.jsonb_build_object(
          'granted', v_allowance.realise_granted,
          'consumed', v_allowance.realise_consumed,
          'reserved', v_allowance.realise_reserved,
          'remaining', v_allowance.realise_granted
            - v_allowance.realise_consumed
            - v_allowance.realise_reserved
        )
      );
      update advertising_game.image_lab_operation
        set operation_status = v_status,
            result = v_result,
            updated_at = pg_catalog.clock_timestamp()
        where image_lab_operation.operation_id = p_operation_id;
      return v_result;
    elsif p_operation in ('complete', 'refund', 'mark_uncertain') then
      raise exception using errcode = 'P0002', message = 'reservation operation missing';
    end if;
  end if;

  select *
    into v_settings
    from advertising_game.image_lab_settings
    where singleton_id = true;
  if not found then
    raise exception using errcode = 'P0002', message = 'Image Lab settings missing';
  end if;

  if p_operation = 'global_status' then
    return pg_catalog.jsonb_build_object(
      'status', case when v_settings.enabled then 'available' else 'disabled' end,
      'enabled', v_settings.enabled,
      'object', pg_catalog.jsonb_build_object(
        'granted', v_settings.object_default,
        'consumed', 0,
        'reserved', 0,
        'remaining', v_settings.object_default
      ),
      'realise', pg_catalog.jsonb_build_object(
        'granted', v_settings.realise_default,
        'consumed', 0,
        'reserved', 0,
        'remaining', v_settings.realise_default
      )
    );
  end if;

  if p_operation = 'list' then
    select pg_catalog.coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'userId', listed.user_id,
          'object', pg_catalog.jsonb_build_object(
            'granted', listed.object_granted,
            'consumed', listed.object_consumed,
            'reserved', listed.object_reserved,
            'remaining', listed.object_granted
              - listed.object_consumed
              - listed.object_reserved
          ),
          'realise', pg_catalog.jsonb_build_object(
            'granted', listed.realise_granted,
            'consumed', listed.realise_consumed,
            'reserved', listed.realise_reserved,
            'remaining', listed.realise_granted
              - listed.realise_consumed
              - listed.realise_reserved
          )
        )
        order by listed.user_id
      ),
      '[]'::pg_catalog.jsonb
    )
      into v_accounts
      from advertising_game.image_lab_allowance as listed;
    return pg_catalog.jsonb_build_object(
      'status', case when v_settings.enabled then 'available' else 'disabled' end,
      'enabled', v_settings.enabled,
      'object', pg_catalog.jsonb_build_object(
        'granted', v_settings.object_default,
        'consumed', 0,
        'reserved', 0,
        'remaining', v_settings.object_default
      ),
      'realise', pg_catalog.jsonb_build_object(
        'granted', v_settings.realise_default,
        'consumed', 0,
        'reserved', 0,
        'remaining', v_settings.realise_default
      ),
      'accounts', v_accounts
    );
  end if;

  if p_operation = 'set_global' then
    if p_stage is null then
      update advertising_game.image_lab_settings
        set enabled = (p_amount = 1),
            updated_at = pg_catalog.clock_timestamp()
        where singleton_id = true
        returning * into v_settings;
    elsif p_stage = 'object' then
      update advertising_game.image_lab_settings
        set object_default = p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where singleton_id = true
        returning * into v_settings;
    else
      update advertising_game.image_lab_settings
        set realise_default = p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where singleton_id = true
        returning * into v_settings;
    end if;
    v_result := pg_catalog.jsonb_build_object(
      'status', case when v_settings.enabled then 'available' else 'disabled' end,
      'enabled', v_settings.enabled,
      'object', pg_catalog.jsonb_build_object(
        'granted', v_settings.object_default,
        'consumed', 0,
        'reserved', 0,
        'remaining', v_settings.object_default
      ),
      'realise', pg_catalog.jsonb_build_object(
        'granted', v_settings.realise_default,
        'consumed', 0,
        'reserved', 0,
        'remaining', v_settings.realise_default
      )
    );
    insert into advertising_game.image_lab_operation (
      operation_id,
      ledger_operation,
      user_id,
      stage,
      amount,
      job_key,
      request_hash,
      operation_status,
      result
    ) values (
      p_operation_id,
      p_operation,
      p_user_id,
      p_stage,
      p_amount,
      p_job_key,
      p_request_hash,
      'completed',
      v_result
    );
    return v_result;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('image-lab-global', 741927)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 741927)
  );
  insert into advertising_game.image_lab_allowance (
    user_id,
    object_granted,
    realise_granted
  ) values (
    p_user_id,
    0,
    0
  ) on conflict (user_id) do nothing;
  select *
    into v_allowance
    from advertising_game.image_lab_allowance
    where user_id = p_user_id;

  if p_operation = 'status' then
    return pg_catalog.jsonb_build_object(
      'status', case when v_settings.enabled then 'available' else 'disabled' end,
      'enabled', v_settings.enabled,
      'object', pg_catalog.jsonb_build_object(
        'granted', v_allowance.object_granted,
        'consumed', v_allowance.object_consumed,
        'reserved', v_allowance.object_reserved,
        'remaining', v_allowance.object_granted
          - v_allowance.object_consumed
          - v_allowance.object_reserved
      ),
      'realise', pg_catalog.jsonb_build_object(
        'granted', v_allowance.realise_granted,
        'consumed', v_allowance.realise_consumed,
        'reserved', v_allowance.realise_reserved,
        'remaining', v_allowance.realise_granted
          - v_allowance.realise_consumed
          - v_allowance.realise_reserved
      )
    );
  end if;

  if p_operation = 'set' then
    if p_stage = 'object' then
      if v_allowance.object_consumed + v_allowance.object_reserved + p_amount > 100 then
        raise exception using errcode = '22023', message = 'object allowance exceeds limit';
      end if;
      update advertising_game.image_lab_allowance
        set object_granted = object_consumed + object_reserved + p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    else
      if v_allowance.realise_consumed + v_allowance.realise_reserved + p_amount > 100 then
        raise exception using errcode = '22023', message = 'realise allowance exceeds limit';
      end if;
      update advertising_game.image_lab_allowance
        set realise_granted = realise_consumed + realise_reserved + p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    end if;
    v_status := 'available';
  elsif p_operation = 'add' then
    if p_stage = 'object' then
      if v_allowance.object_granted + p_amount > 100 then
        raise exception using errcode = '22023', message = 'object allowance exceeds limit';
      end if;
      update advertising_game.image_lab_allowance
        set object_granted = object_granted + p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    else
      if v_allowance.realise_granted + p_amount > 100 then
        raise exception using errcode = '22023', message = 'realise allowance exceeds limit';
      end if;
      update advertising_game.image_lab_allowance
        set realise_granted = realise_granted + p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    end if;
    v_status := 'available';
  elsif p_operation = 'revoke' then
    if p_stage = 'object' then
      if v_allowance.object_granted
        - v_allowance.object_consumed
        - v_allowance.object_reserved < p_amount then
        raise exception using errcode = '22023', message = 'object availability too low';
      end if;
      update advertising_game.image_lab_allowance
        set object_granted = object_granted - p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    else
      if v_allowance.realise_granted
        - v_allowance.realise_consumed
        - v_allowance.realise_reserved < p_amount then
        raise exception using errcode = '22023', message = 'realise availability too low';
      end if;
      update advertising_game.image_lab_allowance
        set realise_granted = realise_granted - p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    end if;
    v_status := 'available';
  elsif p_operation = 'reserve' then
    if not v_settings.enabled then
      return pg_catalog.jsonb_build_object(
        'status', 'disabled',
        'enabled', false,
        'object', pg_catalog.jsonb_build_object(
          'granted', v_allowance.object_granted,
          'consumed', v_allowance.object_consumed,
          'reserved', v_allowance.object_reserved,
          'remaining', v_allowance.object_granted
            - v_allowance.object_consumed
            - v_allowance.object_reserved
        ),
        'realise', pg_catalog.jsonb_build_object(
          'granted', v_allowance.realise_granted,
          'consumed', v_allowance.realise_consumed,
          'reserved', v_allowance.realise_reserved,
          'remaining', v_allowance.realise_granted
            - v_allowance.realise_consumed
            - v_allowance.realise_reserved
        )
      );
    end if;
    if p_stage = 'object' then
      update advertising_game.image_lab_allowance
        set object_reserved = object_reserved + 1,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
          and object_granted - object_consumed - object_reserved >= 1
        returning * into v_allowance;
    else
      update advertising_game.image_lab_allowance
        set realise_reserved = realise_reserved + 1,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
          and realise_granted - realise_consumed - realise_reserved >= 1
        returning * into v_allowance;
    end if;
    if not found then
      select *
        into v_allowance
        from advertising_game.image_lab_allowance
        where user_id = p_user_id;
      return pg_catalog.jsonb_build_object(
        'status', 'available',
        'enabled', v_settings.enabled,
        'object', pg_catalog.jsonb_build_object(
          'granted', v_allowance.object_granted,
          'consumed', v_allowance.object_consumed,
          'reserved', v_allowance.object_reserved,
          'remaining', v_allowance.object_granted
            - v_allowance.object_consumed
            - v_allowance.object_reserved
        ),
        'realise', pg_catalog.jsonb_build_object(
          'granted', v_allowance.realise_granted,
          'consumed', v_allowance.realise_consumed,
          'reserved', v_allowance.realise_reserved,
          'remaining', v_allowance.realise_granted
            - v_allowance.realise_consumed
            - v_allowance.realise_reserved
        )
      );
    end if;
    v_status := 'reserved';
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'status', v_status,
    'enabled', v_settings.enabled,
    'object', pg_catalog.jsonb_build_object(
      'granted', v_allowance.object_granted,
      'consumed', v_allowance.object_consumed,
      'reserved', v_allowance.object_reserved,
      'remaining', v_allowance.object_granted
        - v_allowance.object_consumed
        - v_allowance.object_reserved
    ),
    'realise', pg_catalog.jsonb_build_object(
      'granted', v_allowance.realise_granted,
      'consumed', v_allowance.realise_consumed,
      'reserved', v_allowance.realise_reserved,
      'remaining', v_allowance.realise_granted
        - v_allowance.realise_consumed
        - v_allowance.realise_reserved
    )
  );
  insert into advertising_game.image_lab_operation (
    operation_id,
    ledger_operation,
    user_id,
    stage,
    amount,
    job_key,
    request_hash,
    operation_status,
    result
  ) values (
    p_operation_id,
    p_operation,
    p_user_id,
    p_stage,
    p_amount,
    p_job_key,
    p_request_hash,
    case when p_operation = 'reserve' then 'reserved' else 'completed' end,
    v_result
  );
  return v_result;
end;
$function$;

alter function public.advertising_game_image_lab_rpc(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text
) owner to postgres;

revoke all on function public.advertising_game_image_lab_rpc(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.advertising_game_image_lab_rpc(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text
) to service_role;
```

## File: `.github/workflows/build-and-publish.yml`

```yaml
# Advertising Market Game — validation and web artifact build (NO auto-deploy).
#
# GitHub is the source of truth. This workflow validates the project and builds
# a downloadable web artifact, but it deliberately never deploys to Netlify.
# Manual Netlify CLI deployment must publish build/web AND bundle
# netlify/deploy-functions. A static-only auto-deploy would silently remove the
# /api/account/* Functions and break classroom accounts.
#
# The toolchain version and artifact name are pinned here so a clean public
# snapshot builds without repository-specific variables.

name: "Build & Validate Web"

on:
  push:
    branches:
      - "main"
  workflow_dispatch:

permissions:
  contents: read

env:
  GODOT_VERSION: "4.7.1"
  EXPORT_NAME: "advertising-market-game"

jobs:
  validate:
    name: Validate
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6

      - name: Set up Node
        uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version: "22.12.0"

      - name: Set up pnpm
        uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6
        with:
          version: "11.7.0"

      - name: Install locked dependencies
        run: pnpm install --frozen-lockfile

      - name: Set up Python
        uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1 # v6
        with:
          python-version: "3.12"

      - name: Install locked catalogue QA dependencies
        run: |
          python -m pip install --requirement pipeline/requirements.txt
          python -m pip install --no-deps --no-build-isolation --editable pipeline

      - name: Run catalogue pipeline tests
        run: python -m pytest pipeline/tests -q

      - name: Type-check
        run: pnpm typecheck

      - name: Run application tests
        run: pnpm test

      - name: Run web-build contract tests
        run: pnpm test:build-web

  export-web:
    name: Export Godot Web
    needs: validate
    runs-on: ubuntu-24.04
    container:
      image: barichello/godot-ci:4.7.1@sha256:622e5ca81b54cd8038ecf7de5d157b47efc800d7cf635af2eec18a6aee4bab7e
    steps:
      - name: Checkout
        uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6

      - name: Set up export templates
        run: |
          mkdir -v -p ~/.local/share/godot/export_templates/
          mkdir -v -p ~/.config/
          if [ -d /root/.config/godot ]; then
            mv -v /root/.config/godot ~/.config/godot
          fi
          TEMPLATE_SOURCE="/root/.local/share/godot/export_templates/${GODOT_VERSION}.stable"
          if [ ! -d "$TEMPLATE_SOURCE" ]; then
            echo "Missing Godot export templates: $TEMPLATE_SOURCE" >&2
            exit 1
          fi
          mv -v "$TEMPLATE_SOURCE" \
               ~/.local/share/godot/export_templates/${GODOT_VERSION}.stable

      - name: Run Godot tests
        run: godot --headless --path godot --script res://tests/run_tests.gd

      - name: Export Web build
        run: |
          mkdir -v -p build/web
          EXPORT_DIR="$(readlink -f build/web)"
          godot --headless --path godot --export-release "Web" "$EXPORT_DIR/index.html"

      - name: Upload raw Godot export
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: ${{ env.EXPORT_NAME }}-godot-web
          path: build/web/
          if-no-files-found: error
          retention-days: 30

  assemble-web:
    name: Assemble Complete Web Artifact
    needs: export-web
    runs-on: ubuntu-24.04
    steps:
      - name: Checkout
        uses: actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6

      - name: Set up Node
        uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version: "22.12.0"

      - name: Set up pnpm
        uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6
        with:
          version: "11.7.0"

      - name: Install locked dependencies
        run: pnpm install --frozen-lockfile

      - name: Download Godot export
        uses: actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093 # v4
        with:
          name: ${{ env.EXPORT_NAME }}-godot-web
          path: build/web/

      - name: Build account Function bundle
        run: pnpm build:functions

      - name: Build creator studio
        run: pnpm build:studio

      - name: Build logo catalogue
        run: pnpm build:logo-icons

      - name: Assemble complete web export
        run: >-
          node scripts/build-web.mjs
          --require-offline-core
          --minimum-offline-records=2000
          --require-product-shells
          --require-product-builder
          --require-logo-icons

      - name: Verify complete web export
        run: node scripts/verify-web-export.mjs build/web

      - name: Upload complete web artifact
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: ${{ env.EXPORT_NAME }}-web
          path: build/web/
          if-no-files-found: error
          include-hidden-files: true
          retention-days: 90

      # NO deploy step. Production and draft deploys remain manual Netlify CLI
      # operations from a verified repository checkout so static files and
      # netlify/deploy-functions are published together.
```

## File: `netlify/functions/lib/teacher-auth.ts`

```typescript
import {
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

export const TEACHER_SESSION_COOKIE = "admarket_teacher";
const MAX_TEACHER_SESSION_SECONDS = 24 * 60 * 60;
const PASSWORD_COMPARISON_KEY = "ad-market-teacher-password-comparison-v1";
const CLAIM_KEYS = [
  "expiresAt",
  "issuedAt",
  "nonce",
  "schema",
  "version"
] as const;

export interface TeacherSessionClaims {
  readonly schema: "ad-market-teacher-session";
  readonly version: 1;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
}

export interface TeacherEnvironment {
  readonly password: string;
  readonly sessionSecret: string;
  readonly sessionHours: number;
}

export type TeacherEnvironmentRecord = Readonly<Record<string, string | undefined>>;

export class TeacherAuthError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "TeacherAuthError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  record: Record<string, unknown>,
  expected: readonly string[]
): boolean => {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
};

const boundedPrintable = (
  value: string | undefined,
  minimumBytes: number,
  maximumBytes: number
): string => {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !/^[\x20-\x7e]+$/u.test(value)
  ) {
    throw new TeacherAuthError("TEACHER_NOT_CONFIGURED", 503);
  }
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes < minimumBytes || bytes > maximumBytes) {
    throw new TeacherAuthError("TEACHER_NOT_CONFIGURED", 503);
  }
  return value;
};

export function parseTeacherEnvironment(
  environment: TeacherEnvironmentRecord
): TeacherEnvironment {
  const password = boundedPrintable(
    environment.ADVERTISING_GAME_TEACHER_PASSWORD,
    8,
    128
  );
  const sessionSecret = boundedPrintable(
    environment.ADVERTISING_GAME_TEACHER_SESSION_SECRET,
    32,
    256
  );
  const hours = environment.ADVERTISING_GAME_TEACHER_SESSION_HOURS;
  if (hours === undefined || !/^(?:[1-9]|1\d|2[0-4])$/u.test(hours)) {
    throw new TeacherAuthError("TEACHER_NOT_CONFIGURED", 503);
  }
  if (password === sessionSecret) {
    throw new TeacherAuthError("TEACHER_NOT_CONFIGURED", 503);
  }
  return {
    password,
    sessionSecret,
    sessionHours: Number(hours)
  };
}

export function secureTeacherPasswordMatches(
  candidate: unknown,
  expected: string
): boolean {
  const validCandidate = typeof candidate === "string" &&
    Buffer.byteLength(candidate, "utf8") >= 1 &&
    Buffer.byteLength(candidate, "utf8") <= 128 &&
    /^[\x20-\x7e]+$/u.test(candidate);
  const candidateDigest = createHmac("sha256", PASSWORD_COMPARISON_KEY)
    .update(validCandidate ? candidate as string : "", "utf8")
    .digest();
  const expectedDigest = createHmac("sha256", PASSWORD_COMPARISON_KEY)
    .update(expected, "utf8")
    .digest();
  return validCandidate && timingSafeEqual(candidateDigest, expectedDigest);
}

const canonicalNonce = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{22}$/u.test(value)) return false;
  const bytes = Buffer.from(value, "base64url");
  return bytes.byteLength === 16 && bytes.toString("base64url") === value;
};

const validClaims = (value: unknown): value is TeacherSessionClaims => {
  if (!isRecord(value) || !hasExactKeys(value, CLAIM_KEYS)) return false;
  if (
    value.schema !== "ad-market-teacher-session" ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.issuedAt) ||
    !Number.isSafeInteger(value.expiresAt) ||
    (value.issuedAt as number) < 0 ||
    (value.expiresAt as number) <= (value.issuedAt as number) ||
    (value.expiresAt as number) - (value.issuedAt as number) >
      MAX_TEACHER_SESSION_SECONDS ||
    !canonicalNonce(value.nonce)
  ) {
    return false;
  }
  return true;
};

const canonicalClaims = (claims: TeacherSessionClaims): TeacherSessionClaims => ({
  schema: "ad-market-teacher-session",
  version: 1,
  issuedAt: claims.issuedAt,
  expiresAt: claims.expiresAt,
  nonce: claims.nonce
});

const sign = (payload: string, secret: string): string =>
  createHmac("sha256", secret).update(payload, "utf8").digest("base64url");

export function createTeacherSessionToken(
  claims: TeacherSessionClaims,
  secret: string
): string {
  if (!validClaims(claims)) throw new TeacherAuthError("INVALID_SESSION", 500);
  const payload = Buffer.from(
    JSON.stringify(canonicalClaims(claims)),
    "utf8"
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

const decodeCanonicalBase64Url = (value: string): Buffer | null => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  return decoded.byteLength > 0 && decoded.toString("base64url") === value
    ? decoded
    : null;
};

export function verifyTeacherSessionToken(
  token: unknown,
  secret: string,
  nowSeconds: number
): TeacherSessionClaims | null {
  if (
    typeof token !== "string" ||
    token.length < 3 ||
    token.length > 4_096 ||
    !Number.isSafeInteger(nowSeconds) ||
    nowSeconds < 0
  ) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const payloadBytes = decodeCanonicalBase64Url(parts[0]!);
  const signatureBytes = decodeCanonicalBase64Url(parts[1]!);
  if (payloadBytes === null || signatureBytes?.byteLength !== 32) return null;
  const expected = createHmac("sha256", secret).update(parts[0]!, "utf8").digest();
  if (!timingSafeEqual(signatureBytes, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBytes.toString("utf8")) as unknown;
  } catch {
    return null;
  }
  if (!validClaims(parsed)) return null;
  if (parsed.issuedAt > nowSeconds || parsed.expiresAt <= nowSeconds) return null;
  return canonicalClaims(parsed);
}

export function createTeacherSessionClaims(
  nowSeconds: number,
  lifetimeSeconds: number,
  nonce = randomBytes(16).toString("base64url")
): TeacherSessionClaims {
  return canonicalClaims({
    schema: "ad-market-teacher-session",
    version: 1,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + lifetimeSeconds,
    nonce
  });
}

export function serialiseTeacherCookie(token: string, maxAgeSeconds: number): string {
  return [
    `${TEACHER_SESSION_COOKIE}=${token}`,
    "Path=/api/teacher",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ].join("; ");
}

export function clearTeacherCookie(): string {
  return serialiseTeacherCookie("", 0);
}

function teacherCookie(request: Request): string | null {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${TEACHER_SESSION_COOKIE}=`))
    .map((part) => part.slice(TEACHER_SESSION_COOKIE.length + 1));
  return values.length === 1 && values[0] ? values[0] : null;
}

export function readTeacherSession(
  request: Request,
  environment: TeacherEnvironment,
  nowSeconds = Math.floor(Date.now() / 1_000)
): TeacherSessionClaims | null {
  const token = teacherCookie(request);
  return token === null
    ? null
    : verifyTeacherSessionToken(token, environment.sessionSecret, nowSeconds);
}

export function requireTeacherSession(
  request: Request,
  environment: TeacherEnvironment,
  nowSeconds = Math.floor(Date.now() / 1_000)
): TeacherSessionClaims {
  const session = readTeacherSession(request, environment, nowSeconds);
  if (session === null) {
    throw new TeacherAuthError("AUTHENTICATION_REQUIRED", 401);
  }
  return session;
}
```

## File: `netlify/functions/lib/teacher-account-service.ts`

```typescript
import { createHash, createHmac } from "node:crypto";
import { getStore } from "@netlify/blobs";
import {
  SupabaseAccountError,
  type AccountAdminRecord,
  type ProgressRpcInput
} from "./account-backend";
import type { AccountAssetResetPlan } from "./account-assets";
import {
  type ImageLabAllowanceCounts,
  type ImageLabAllowanceSnapshot,
  type ImageLabAllowanceStore,
  type ImageLabAllowanceStage,
  type TeacherImageLabAccount
} from "./image-lab-allowance-store";
import {
  deriveSyntheticAccountEmail,
  normaliseAccountUsername
} from "./account-primitives";

const OPERATION_STORE_NAME = "advertising-game-teacher-operations-v1";
const OPERATION_SCHEMA = "ad-market-teacher-operation";
const OPERATION_CONTEXT = "ad-market-teacher-operation-v1\0";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const TEACHER_PLAYTEST_USERNAME = "teacher-playtest";

export interface TeacherPairSummary {
  readonly username: string;
  readonly createdAt: string;
  readonly lastSignInAt: string | null;
}

export interface TeacherImageLabOverview {
  readonly enabled: boolean;
  readonly defaults: {
    readonly object: number;
    readonly realise: number;
  };
  readonly accounts: readonly TeacherImageLabAccount[];
}

export type TeacherImageLabAccountOperation = "set" | "add" | "revoke";

export type TeacherImageLabMutationResult =
  | {
      readonly status: "updated";
      readonly operationId: string;
      readonly operation: "global";
      readonly enabled: boolean;
      readonly defaults: {
        readonly object: number;
        readonly realise: number;
      };
    }
  | {
      readonly status: "updated";
      readonly operationId: string;
      readonly operation: TeacherImageLabAccountOperation;
      readonly alias: string;
      readonly account: TeacherImageLabAccount;
    }
  | {
      readonly status: "updated";
      readonly operationId: string;
      readonly operation: "batch-add";
      readonly aliases: readonly string[];
      readonly accounts: readonly TeacherImageLabAccount[];
    };

export type TeacherAccountMutationResult =
  | {
      readonly status: "created";
      readonly operationId: string;
      readonly account: TeacherPairSummary;
    }
  | {
      readonly status: "password-replaced" | "reset";
      readonly operationId: string;
      readonly username: string;
    };

type TeacherAccountOperationAction = "create" | "password" | "reset";

export interface TeacherAccountOperationRecord {
  readonly schema: typeof OPERATION_SCHEMA;
  readonly version: 1;
  readonly action: TeacherAccountOperationAction;
  readonly username: string;
  readonly requestDigest: string;
  readonly state: "started" | "completed";
  readonly result?: TeacherAccountMutationResult;
}

export interface TeacherAccountOperationEntry {
  readonly value: unknown;
  readonly etag: string;
}

export interface TeacherAccountOperationStore {
  read(key: string): Promise<TeacherAccountOperationEntry | null>;
  create(key: string, value: TeacherAccountOperationRecord): Promise<boolean>;
  compareAndSwap(
    key: string,
    value: TeacherAccountOperationRecord,
    etag: string
  ): Promise<boolean>;
}

export interface TeacherAccountClient {
  listAdvertisingGameUsers(): Promise<readonly AccountAdminRecord[]>;
  findAdvertisingGameUser(username: string): Promise<AccountAdminRecord | null>;
  createConfirmedUser(email: string, password: string, username: string): Promise<void>;
  replaceAdvertisingGamePassword(username: string, password: string): Promise<void>;
  progressRpc(input: ProgressRpcInput): Promise<unknown>;
}

export interface TeacherAccountAssetService {
  planReset(userId: string): Promise<AccountAssetResetPlan>;
  executeReset(plan: AccountAssetResetPlan): Promise<void>;
}

export class TeacherAccountServiceError extends Error {
  constructor(
    readonly code:
      | "ACCOUNT_NOT_FOUND"
      | "IDEMPOTENCY_CONFLICT"
      | "OPERATION_INCOMPLETE"
      | "RESET_INCOMPLETE"
      | "TEACHER_UNAVAILABLE"
      | "USERNAME_UNAVAILABLE"
      | "IMAGE_LAB_MUTATION_UNCERTAIN",
    readonly status: number,
    readonly retryable = false,
    readonly retryAfter?: number
  ) {
    super(code);
    this.name = "TeacherAccountServiceError";
  }
}

interface TeacherAccountServiceDependencies {
  readonly client: TeacherAccountClient;
  readonly assets: TeacherAccountAssetService;
  readonly allowances: ImageLabAllowanceStore;
  readonly operations: TeacherAccountOperationStore;
  readonly usernameHmacSecret: string;
  readonly operationSecret: string;
}

interface MutationInput {
  readonly operationId: string;
  readonly username: string;
  readonly password?: string;
}

interface ImageLabGlobalMutationInput {
  readonly operationId: string;
  readonly enabled: boolean;
  readonly objectDefault: number;
  readonly realiseDefault: number;
}

interface ImageLabAccountMutationInput {
  readonly operationId: string;
  readonly alias: string;
  readonly object: number;
  readonly realise: number;
}

interface ImageLabBatchMutationInput {
  readonly operationId: string;
  readonly aliases: readonly string[];
  readonly object: number;
  readonly realise: number;
}

interface ClaimedOperation {
  readonly key: string;
  readonly etag: string;
  readonly record: TeacherAccountOperationRecord;
}

const summary = (record: AccountAdminRecord): TeacherPairSummary => ({
  username: record.username,
  createdAt: record.createdAt,
  lastSignInAt: record.lastSignInAt
});

const validPassword = (value: unknown): value is string =>
  typeof value === "string" &&
  !value.includes("\0") &&
  Buffer.byteLength(value, "utf8") >= 8 &&
  Buffer.byteLength(value, "utf8") <= 128;

const validAllowanceAmount = (value: unknown, minimum = 0): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= minimum &&
  value <= 100;

const imageLabAccount = (
  alias: string,
  snapshot: ImageLabAllowanceSnapshot
): TeacherImageLabAccount => ({
  alias,
  object: snapshot.object,
  realise: snapshot.realise
});

const imageLabDefaults = (
  snapshot: ImageLabAllowanceSnapshot
): TeacherImageLabOverview["defaults"] => ({
  object: snapshot.object.granted,
  realise: snapshot.realise.granted
});

const operationFailure = (action: TeacherAccountOperationAction): TeacherAccountServiceError =>
  action === "reset"
    ? new TeacherAccountServiceError("RESET_INCOMPLETE", 409, false)
    : new TeacherAccountServiceError("OPERATION_INCOMPLETE", 409, false);

const parseStoredOperation = (value: unknown): TeacherAccountOperationRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
  }
  const record = value as Record<string, unknown>;
  const baseValid =
    record.schema === OPERATION_SCHEMA &&
    record.version === 1 &&
    (record.action === "create" || record.action === "password" || record.action === "reset") &&
    typeof record.username === "string" &&
    typeof record.requestDigest === "string" &&
    SHA256_PATTERN.test(record.requestDigest) &&
    (record.state === "started" || record.state === "completed");
  if (!baseValid) {
    throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
  }
  if (
    (record.state === "started" && record.result !== undefined) ||
    (record.state === "completed" && record.result === undefined)
  ) {
    throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
  }
  return record as unknown as TeacherAccountOperationRecord;
};

export class TeacherAccountService {
  constructor(private readonly dependencies: TeacherAccountServiceDependencies) {
    for (const secret of [
      dependencies.usernameHmacSecret,
      dependencies.operationSecret
    ]) {
      if (
        typeof secret !== "string" ||
        secret.trim() !== secret ||
        Buffer.byteLength(secret, "utf8") < 32 ||
        Buffer.byteLength(secret, "utf8") > 256
      ) {
        throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
      }
    }
  }

  async listAccounts(): Promise<readonly TeacherPairSummary[]> {
    const users = await this.dependencies.client.listAdvertisingGameUsers();
    return users
      .map(summary)
      .sort((left, right) => left.username.localeCompare(right.username));
  }

  async createAccount(input: Required<MutationInput>): Promise<TeacherAccountMutationResult> {
    const parsed = this.parseMutation(input, true);
    const claimed = await this.claim("create", parsed);
    if ("replay" in claimed) return claimed.replay;
    try {
      if (await this.dependencies.client.findAdvertisingGameUser(parsed.username) !== null) {
        throw new TeacherAccountServiceError("USERNAME_UNAVAILABLE", 409);
      }
      await this.dependencies.client.createConfirmedUser(
        deriveSyntheticAccountEmail(parsed.username, this.dependencies.usernameHmacSecret),
        parsed.password!,
        parsed.username
      );
      const created = await this.dependencies.client.findAdvertisingGameUser(parsed.username);
      if (created === null || created.username !== parsed.username) {
        throw new TeacherAccountServiceError("OPERATION_INCOMPLETE", 409);
      }
      const defaults = await this.dependencies.allowances.globalStatus();
      await this.applyImageLabStage(
        "set",
        created,
        "object",
        defaults.object.granted,
        parsed.operationId,
        "teacher-create-object"
      );
      await this.applyImageLabStage(
        "set",
        created,
        "realise",
        defaults.realise.granted,
        parsed.operationId,
        "teacher-create-realise"
      );
      const result: TeacherAccountMutationResult = {
        status: "created",
        operationId: parsed.operationId,
        account: summary(created)
      };
      await this.complete(claimed, result);
      return result;
    } catch (error) {
      if (error instanceof TeacherAccountServiceError) throw error;
      if (error instanceof SupabaseAccountError && error.kind === "duplicate_user") {
        throw new TeacherAccountServiceError("USERNAME_UNAVAILABLE", 409);
      }
      throw operationFailure("create");
    }
  }

  async replacePassword(input: Required<MutationInput>): Promise<TeacherAccountMutationResult> {
    const parsed = this.parseMutation(input, true);
    const claimed = await this.claim("password", parsed);
    if ("replay" in claimed) return claimed.replay;
    try {
      if (await this.dependencies.client.findAdvertisingGameUser(parsed.username) === null) {
        throw new TeacherAccountServiceError("ACCOUNT_NOT_FOUND", 404);
      }
      await this.dependencies.client.replaceAdvertisingGamePassword(
        parsed.username,
        parsed.password!
      );
      const result: TeacherAccountMutationResult = {
        status: "password-replaced",
        operationId: parsed.operationId,
        username: parsed.username
      };
      await this.complete(claimed, result);
      return result;
    } catch (error) {
      if (error instanceof TeacherAccountServiceError) throw error;
      throw operationFailure("password");
    }
  }

  async resetAccount(input: Omit<MutationInput, "password">): Promise<TeacherAccountMutationResult> {
    const parsed = this.parseMutation(input, false);
    const claimed = await this.claim("reset", parsed);
    if ("replay" in claimed) return claimed.replay;
    try {
      const user = await this.dependencies.client.findAdvertisingGameUser(parsed.username);
      if (user === null) throw new TeacherAccountServiceError("ACCOUNT_NOT_FOUND", 404);
      const plan = await this.dependencies.assets.planReset(user.userId);
      await this.dependencies.client.progressRpc({
        userId: user.userId,
        operation: "reset",
        schema: "advertising-game-progress",
        version: 1
      });
      await this.dependencies.assets.executeReset(plan);
      const result: TeacherAccountMutationResult = {
        status: "reset",
        operationId: parsed.operationId,
        username: parsed.username
      };
      await this.complete(claimed, result);
      return result;
    } catch (error) {
      if (
        error instanceof TeacherAccountServiceError &&
        error.code === "ACCOUNT_NOT_FOUND"
      ) {
        throw error;
      }
      throw operationFailure("reset");
    }
  }

  async imageLabStatus(): Promise<TeacherImageLabOverview> {
    try {
      const [global, accounts] = await Promise.all([
        this.dependencies.allowances.globalStatus(),
        this.dependencies.allowances.list()
      ]);
      return {
        enabled: global.enabled,
        defaults: imageLabDefaults(global),
        accounts: [...accounts].sort((left, right) =>
          left.alias.localeCompare(right.alias))
      };
    } catch {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
    }
  }

  async setImageLabGlobal(
    input: ImageLabGlobalMutationInput
  ): Promise<TeacherImageLabMutationResult> {
    if (
      !UUID_PATTERN.test(input.operationId) ||
      typeof input.enabled !== "boolean" ||
      !validAllowanceAmount(input.objectDefault) ||
      !validAllowanceAmount(input.realiseDefault)
    ) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    try {
      await this.dependencies.allowances.setGlobal({
        target: "enabled",
        enabled: input.enabled,
        ...this.imageLabIdentity(input.operationId, "teacher-global-enabled", {
          enabled: input.enabled
        })
      });
      await this.dependencies.allowances.setGlobal({
        target: "default",
        stage: "object",
        amount: input.objectDefault,
        ...this.imageLabIdentity(input.operationId, "teacher-global-object", {
          stage: "object",
          amount: input.objectDefault
        })
      });
      const snapshot = await this.dependencies.allowances.setGlobal({
        target: "default",
        stage: "realise",
        amount: input.realiseDefault,
        ...this.imageLabIdentity(input.operationId, "teacher-global-realise", {
          stage: "realise",
          amount: input.realiseDefault
        })
      });
      return {
        status: "updated",
        operationId: input.operationId,
        operation: "global",
        enabled: snapshot.enabled,
        defaults: imageLabDefaults(snapshot)
      };
    } catch {
      throw new TeacherAccountServiceError(
        "IMAGE_LAB_MUTATION_UNCERTAIN",
        409,
        false
      );
    }
  }

  async mutateImageLabAccount(
    operation: TeacherImageLabAccountOperation,
    input: ImageLabAccountMutationInput
  ): Promise<TeacherImageLabMutationResult> {
    const alias = this.parseImageLabAlias(input.alias);
    const minimum = operation === "set" ? 0 : 1;
    if (
      !UUID_PATTERN.test(input.operationId) ||
      !validAllowanceAmount(input.object) ||
      !validAllowanceAmount(input.realise) ||
      (minimum === 1 && input.object === 0 && input.realise === 0)
    ) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }

    let user: AccountAdminRecord;
    try {
      const found = await this.dependencies.client.findAdvertisingGameUser(alias);
      if (found === null) {
        throw new TeacherAccountServiceError("ACCOUNT_NOT_FOUND", 404);
      }
      user = found;
    } catch (error) {
      if (error instanceof TeacherAccountServiceError) throw error;
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
    }

    try {
      let snapshot: ImageLabAllowanceSnapshot | null = null;
      if (operation === "set" || input.object > 0) {
        snapshot = await this.applyImageLabStage(
          operation,
          user,
          "object",
          input.object,
          input.operationId,
          `teacher-${operation}-object`
        );
      }
      if (operation === "set" || input.realise > 0) {
        snapshot = await this.applyImageLabStage(
          operation,
          user,
          "realise",
          input.realise,
          input.operationId,
          `teacher-${operation}-realise`
        );
      }
      if (snapshot === null) {
        throw new Error("No Image Lab mutation was selected.");
      }
      return {
        status: "updated",
        operationId: input.operationId,
        operation,
        alias,
        account: imageLabAccount(alias, snapshot)
      };
    } catch {
      throw new TeacherAccountServiceError(
        "IMAGE_LAB_MUTATION_UNCERTAIN",
        409,
        false
      );
    }
  }

  async batchAddImageLab(
    input: ImageLabBatchMutationInput
  ): Promise<TeacherImageLabMutationResult> {
    if (
      !UUID_PATTERN.test(input.operationId) ||
      !Array.isArray(input.aliases) ||
      input.aliases.length < 1 ||
      input.aliases.length > 100 ||
      !validAllowanceAmount(input.object) ||
      !validAllowanceAmount(input.realise) ||
      (input.object === 0 && input.realise === 0)
    ) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    const aliases = input.aliases.map((alias) => this.parseImageLabAlias(alias));
    if (new Set(aliases).size !== aliases.length) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }

    let users: AccountAdminRecord[];
    try {
      users = await Promise.all(aliases.map(async (alias) => {
        const user = await this.dependencies.client.findAdvertisingGameUser(alias);
        if (user === null) {
          throw new TeacherAccountServiceError("ACCOUNT_NOT_FOUND", 404);
        }
        return user;
      }));
    } catch (error) {
      if (error instanceof TeacherAccountServiceError) throw error;
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
    }

    try {
      const accounts: TeacherImageLabAccount[] = [];
      for (let index = 0; index < users.length; index += 1) {
        const user = users[index]!;
        const alias = aliases[index]!;
        let snapshot: ImageLabAllowanceSnapshot | null = null;
        if (input.object > 0) {
          snapshot = await this.applyImageLabStage(
            "add",
            user,
            "object",
            input.object,
            input.operationId,
            `teacher-batch-${index}-object`
          );
        }
        if (input.realise > 0) {
          snapshot = await this.applyImageLabStage(
            "add",
            user,
            "realise",
            input.realise,
            input.operationId,
            `teacher-batch-${index}-realise`
          );
        }
        if (snapshot === null) {
          throw new Error("No Image Lab batch mutation was selected.");
        }
        accounts.push(imageLabAccount(alias, snapshot));
      }
      return {
        status: "updated",
        operationId: input.operationId,
        operation: "batch-add",
        aliases,
        accounts
      };
    } catch {
      throw new TeacherAccountServiceError(
        "IMAGE_LAB_MUTATION_UNCERTAIN",
        409,
        false
      );
    }
  }

  private parseMutation(
    input: MutationInput,
    passwordRequired: boolean
  ): Required<MutationInput> {
    let username: string;
    try {
      username = normaliseAccountUsername(input.username);
    } catch {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    if (
      username === TEACHER_PLAYTEST_USERNAME ||
      !UUID_PATTERN.test(input.operationId) ||
      (passwordRequired && !validPassword(input.password)) ||
      (!passwordRequired && input.password !== undefined)
    ) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    return {
      operationId: input.operationId,
      username,
      password: input.password ?? ""
    };
  }

  private parseImageLabAlias(value: unknown): string {
    let alias: string;
    try {
      alias = normaliseAccountUsername(value);
    } catch {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    if (alias === TEACHER_PLAYTEST_USERNAME) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    return alias;
  }

  private imageLabIdentity(
    rootOperationId: string,
    action: string,
    request: Readonly<Record<string, unknown>>
  ): { readonly operationId: string; readonly requestHash: string } {
    return {
      operationId: `${rootOperationId}:${action}`,
      requestHash: createHash("sha256")
        .update(JSON.stringify({
          schema: "ad-market-teacher-image-lab-mutation",
          version: 1,
          rootOperationId,
          action,
          request
        }), "utf8")
        .digest("hex")
    };
  }

  private async applyImageLabStage(
    operation: TeacherImageLabAccountOperation,
    user: AccountAdminRecord,
    stage: ImageLabAllowanceStage,
    amount: number,
    rootOperationId: string,
    action: string
  ): Promise<ImageLabAllowanceSnapshot> {
    const identity = this.imageLabIdentity(rootOperationId, action, {
      alias: user.username,
      userId: user.userId,
      stage,
      amount,
      operation
    });
    return this.dependencies.allowances[operation]({
      userId: user.userId,
      stage,
      amount,
      ...identity
    });
  }

  private operationDigest(
    action: TeacherAccountOperationAction,
    input: Required<MutationInput>
  ): string {
    return createHmac("sha256", this.dependencies.operationSecret)
      .update(OPERATION_CONTEXT, "utf8")
      .update(action, "utf8")
      .update("\0", "utf8")
      .update(input.operationId, "utf8")
      .update("\0", "utf8")
      .update(input.username, "utf8")
      .digest("hex");
  }

  private requestDigest(
    action: TeacherAccountOperationAction,
    input: Required<MutationInput>
  ): string {
    return createHmac("sha256", this.dependencies.operationSecret)
      .update("ad-market-teacher-request-v1\0", "utf8")
      .update(JSON.stringify({
        action,
        operationId: input.operationId,
        username: input.username,
        password: input.password
      }), "utf8")
      .digest("hex");
  }

  private async claim(
    action: TeacherAccountOperationAction,
    input: Required<MutationInput>
  ): Promise<ClaimedOperation | { readonly replay: TeacherAccountMutationResult }> {
    const key = `operation/${this.operationDigest(action, input)}`;
    const requestDigest = this.requestDigest(action, input);
    const started: TeacherAccountOperationRecord = {
      schema: OPERATION_SCHEMA,
      version: 1,
      action,
      username: input.username,
      requestDigest,
      state: "started"
    };
    let createdByThisCall = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const existing = await this.dependencies.operations.read(key);
      if (existing === null) {
        if (await this.dependencies.operations.create(key, started)) {
          createdByThisCall = true;
        }
        continue;
      }
      if (
        typeof existing.etag !== "string" ||
        existing.etag.length < 1 ||
        existing.etag.length > 256
      ) {
        throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
      }
      const record = parseStoredOperation(existing.value);
      if (
        record.action !== action ||
        record.username !== input.username ||
        record.requestDigest !== requestDigest
      ) {
        throw new TeacherAccountServiceError("IDEMPOTENCY_CONFLICT", 409);
      }
      if (record.state === "completed" && record.result !== undefined) {
        return { replay: record.result };
      }
      if (createdByThisCall) {
        return { key, etag: existing.etag, record };
      }
      return Promise.reject(operationFailure(action));
    }
    throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
  }

  private async complete(
    claimed: ClaimedOperation,
    result: TeacherAccountMutationResult
  ): Promise<void> {
    const completed: TeacherAccountOperationRecord = {
      ...claimed.record,
      state: "completed",
      result
    };
    if (!await this.dependencies.operations.compareAndSwap(
      claimed.key,
      completed,
      claimed.etag
    )) {
      throw operationFailure(claimed.record.action);
    }
  }
}

interface NetlifyOperationStore {
  getWithMetadata(
    key: string,
    options: { type: "json" }
  ): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(
    key: string,
    value: TeacherAccountOperationRecord,
    options: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<{ modified: boolean }>;
}

export function createNetlifyTeacherAccountOperationStore(
  store: NetlifyOperationStore
): TeacherAccountOperationStore {
  return {
    async read(key) {
      const entry = await store.getWithMetadata(key, { type: "json" });
      if (entry === null) return null;
      if (typeof entry.etag !== "string") {
        throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
      }
      return { value: entry.data, etag: entry.etag };
    },
    async create(key, value) {
      return (await store.setJSON(key, value, { onlyIfNew: true })).modified;
    },
    async compareAndSwap(key, value, etag) {
      return (await store.setJSON(key, value, { onlyIfMatch: etag })).modified;
    }
  };
}

let sharedOperationStore: TeacherAccountOperationStore | null = null;

export function defaultTeacherAccountOperationStore(): TeacherAccountOperationStore {
  sharedOperationStore ??= createNetlifyTeacherAccountOperationStore(
    getStore({ name: OPERATION_STORE_NAME, consistency: "strong" }) as unknown as
      NetlifyOperationStore
  );
  return sharedOperationStore;
}
```

## File: `netlify/functions/lib/image-lab-allowance-store.ts`

```typescript
import { createHash } from "node:crypto";
import type {
  ImageLabLedgerRpcInput,
  SupabaseAccountClient
} from "./account-backend";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const ALIAS = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const MAX_ALLOWANCE = 100;
const MAX_ACCOUNTS = 1_000;

export type ImageLabAllowanceStage = "object" | "realise";
export type ImageLabAllowanceStatus =
  | "available"
  | "disabled"
  | "reserved"
  | "completed"
  | "refunded"
  | "uncertain";

export interface ImageLabAllowanceCounts {
  readonly granted: number;
  readonly consumed: number;
  readonly reserved: number;
  readonly remaining: number;
}

export interface ImageLabAllowanceSnapshot {
  readonly status: ImageLabAllowanceStatus;
  readonly enabled: boolean;
  readonly object: ImageLabAllowanceCounts;
  readonly realise: ImageLabAllowanceCounts;
}

export interface TeacherImageLabAccount {
  readonly alias: string;
  readonly object: ImageLabAllowanceCounts;
  readonly realise: ImageLabAllowanceCounts;
}

interface MutationIdentity {
  readonly operationId: string;
  readonly requestHash: string;
}

export type SetImageLabGlobalInput =
  | (MutationIdentity & {
      readonly target: "enabled";
      readonly enabled: boolean;
    })
  | (MutationIdentity & {
      readonly target: "default";
      readonly stage: ImageLabAllowanceStage;
      readonly amount: number;
    });

export interface SetImageLabAllowanceInput extends MutationIdentity {
  readonly userId: string;
  readonly stage: ImageLabAllowanceStage;
  readonly amount: number;
}

export type AddImageLabAllowanceInput = SetImageLabAllowanceInput;
export type RevokeImageLabAllowanceInput = SetImageLabAllowanceInput;

export interface ReserveImageLabAllowanceInput extends MutationIdentity {
  readonly userId: string;
  readonly stage: ImageLabAllowanceStage;
  readonly jobKey: string;
}

export type TerminalImageLabReservationInput = ReserveImageLabAllowanceInput;
export type ImageLabReservation = ImageLabAllowanceSnapshot;

export interface ImageLabAllowanceStore {
  status(userId: string): Promise<ImageLabAllowanceSnapshot>;
  globalStatus(): Promise<ImageLabAllowanceSnapshot>;
  list(): Promise<readonly TeacherImageLabAccount[]>;
  setGlobal(input: SetImageLabGlobalInput): Promise<ImageLabAllowanceSnapshot>;
  set(input: SetImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot>;
  add(input: AddImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot>;
  revoke(input: RevokeImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot>;
  reserve(input: ReserveImageLabAllowanceInput): Promise<ImageLabReservation>;
  complete(input: TerminalImageLabReservationInput): Promise<ImageLabReservation>;
  refund(input: TerminalImageLabReservationInput): Promise<ImageLabReservation>;
  markUncertain(input: TerminalImageLabReservationInput): Promise<ImageLabReservation>;
}

export class ImageLabAllowanceStoreError extends Error {
  constructor(readonly code: "IMAGE_LAB_ALLOWANCE_INVALID" | "IMAGE_LAB_ALLOWANCE_UNAVAILABLE") {
    super(code);
    this.name = "ImageLabAllowanceStoreError";
  }
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
};

function invalid(): never {
  throw new ImageLabAllowanceStoreError("IMAGE_LAB_ALLOWANCE_INVALID");
}

function unavailable(): never {
  throw new ImageLabAllowanceStoreError("IMAGE_LAB_ALLOWANCE_UNAVAILABLE");
}

const assertMutationIdentity = (input: MutationIdentity): void => {
  if (
    typeof input.operationId !== "string" ||
    !SAFE_ID.test(input.operationId) ||
    typeof input.requestHash !== "string" ||
    !SHA256.test(input.requestHash)
  ) invalid();
};

function assertStage(value: unknown): asserts value is ImageLabAllowanceStage {
  if (value !== "object" && value !== "realise") invalid();
}

function assertUserId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !UUID.test(value)) invalid();
}

function assertAmount(value: unknown, minimum: number): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > MAX_ALLOWANCE
  ) invalid();
}

const parseCounts = (value: unknown): ImageLabAllowanceCounts => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(
    candidate,
    ["granted", "consumed", "reserved", "remaining"]
  )) unavailable();
  const { granted, consumed, reserved, remaining } = candidate;
  if (
    ![granted, consumed, reserved, remaining].every((count) =>
      typeof count === "number" &&
      Number.isInteger(count) &&
      count >= 0 &&
      count <= MAX_ALLOWANCE
    ) ||
    (consumed as number) + (reserved as number) > (granted as number) ||
    remaining !== (granted as number) - (consumed as number) - (reserved as number)
  ) unavailable();
  return {
    granted: granted as number,
    consumed: consumed as number,
    reserved: reserved as number,
    remaining: remaining as number
  };
};

const parseSnapshot = (value: unknown): ImageLabAllowanceSnapshot => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(
    candidate,
    ["status", "enabled", "object", "realise"]
  )) unavailable();
  if (
    candidate.status !== "available" &&
    candidate.status !== "disabled" &&
    candidate.status !== "reserved" &&
    candidate.status !== "completed" &&
    candidate.status !== "refunded" &&
    candidate.status !== "uncertain"
  ) unavailable();
  if (typeof candidate.enabled !== "boolean") unavailable();
  if (candidate.status === "disabled" && candidate.enabled) unavailable();
  return {
    status: candidate.status,
    enabled: candidate.enabled,
    object: parseCounts(candidate.object),
    realise: parseCounts(candidate.realise)
  };
};

const parseAccount = (value: unknown): TeacherImageLabAccount => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["alias", "object", "realise"]) ||
    typeof candidate.alias !== "string" ||
    !ALIAS.test(candidate.alias) ||
    candidate.alias === "teacher-playtest"
  ) unavailable();
  return {
    alias: candidate.alias,
    object: parseCounts(candidate.object),
    realise: parseCounts(candidate.realise)
  };
};

const readIdentity = (
  ledgerOperation: "status" | "global_status" | "list",
  userId?: string
): Pick<ImageLabLedgerRpcInput, "operationId" | "requestHash"> => {
  const requestHash = createHash("sha256")
    .update(JSON.stringify({
      schema: "advertising-game-image-lab-read",
      version: 1,
      ledgerOperation,
      userId: userId ?? null
    }))
    .digest("hex");
  return {
    operationId: `${ledgerOperation.replace("_", "-")}:${requestHash}`,
    requestHash
  };
};

const parseList = (value: unknown): readonly TeacherImageLabAccount[] => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(
    candidate,
    ["status", "enabled", "object", "realise", "accounts"]
  ) || !Array.isArray(candidate.accounts) || candidate.accounts.length > MAX_ACCOUNTS) {
    unavailable();
  }
  parseSnapshot({
    status: candidate.status,
    enabled: candidate.enabled,
    object: candidate.object,
    realise: candidate.realise
  });
  const accounts = candidate.accounts.map(parseAccount);
  const aliases = new Set(accounts.map(({ alias }) => alias));
  if (aliases.size !== accounts.length) unavailable();
  return accounts;
};

export class SupabaseImageLabAllowanceStore implements ImageLabAllowanceStore {
  constructor(
    private readonly client: Pick<SupabaseAccountClient, "imageLabRpc">
  ) {}

  async status(userId: string): Promise<ImageLabAllowanceSnapshot> {
    assertUserId(userId);
    return parseSnapshot(await this.client.imageLabRpc({
      userId,
      ledgerOperation: "status",
      ...readIdentity("status", userId)
    }));
  }

  async globalStatus(): Promise<ImageLabAllowanceSnapshot> {
    return parseSnapshot(await this.client.imageLabRpc({
      ledgerOperation: "global_status",
      ...readIdentity("global_status")
    }));
  }

  async list(): Promise<readonly TeacherImageLabAccount[]> {
    return parseList(await this.client.imageLabRpc({
      ledgerOperation: "list",
      ...readIdentity("list")
    }));
  }

  async setGlobal(input: SetImageLabGlobalInput): Promise<ImageLabAllowanceSnapshot> {
    const candidate = record(input);
    if (candidate === null || (
      input.target === "enabled"
        ? !hasExactKeys(candidate, ["target", "enabled", "operationId", "requestHash"]) ||
          typeof input.enabled !== "boolean"
        : input.target === "default"
          ? !hasExactKeys(
              candidate,
              ["target", "stage", "amount", "operationId", "requestHash"]
            )
          : true
    )) invalid();
    assertMutationIdentity(input);
    if (input.target === "enabled") {
      return parseSnapshot(await this.client.imageLabRpc({
        ledgerOperation: "set_global",
        amount: input.enabled ? 1 : 0,
        operationId: input.operationId,
        requestHash: input.requestHash
      }));
    }
    assertStage(input.stage);
    assertAmount(input.amount, 0);
    return parseSnapshot(await this.client.imageLabRpc({
      ledgerOperation: "set_global",
      stage: input.stage,
      amount: input.amount,
      operationId: input.operationId,
      requestHash: input.requestHash
    }));
  }

  async set(input: SetImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot> {
    return this.accountMutation("set", input, 0);
  }

  async add(input: AddImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot> {
    return this.accountMutation("add", input, 1);
  }

  async revoke(input: RevokeImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot> {
    return this.accountMutation("revoke", input, 1);
  }

  async reserve(input: ReserveImageLabAllowanceInput): Promise<ImageLabReservation> {
    return this.reservationMutation("reserve", input);
  }

  async complete(input: TerminalImageLabReservationInput): Promise<ImageLabReservation> {
    return this.reservationMutation("complete", input);
  }

  async refund(input: TerminalImageLabReservationInput): Promise<ImageLabReservation> {
    return this.reservationMutation("refund", input);
  }

  async markUncertain(input: TerminalImageLabReservationInput): Promise<ImageLabReservation> {
    return this.reservationMutation("mark_uncertain", input);
  }

  private async accountMutation(
    ledgerOperation: "set" | "add" | "revoke",
    input: SetImageLabAllowanceInput,
    minimum: number
  ): Promise<ImageLabAllowanceSnapshot> {
    const candidate = record(input);
    if (candidate === null || !hasExactKeys(
      candidate,
      ["userId", "stage", "amount", "operationId", "requestHash"]
    )) invalid();
    assertUserId(input.userId);
    assertStage(input.stage);
    assertAmount(input.amount, minimum);
    assertMutationIdentity(input);
    return parseSnapshot(await this.client.imageLabRpc({
      userId: input.userId,
      ledgerOperation,
      stage: input.stage,
      amount: input.amount,
      operationId: input.operationId,
      requestHash: input.requestHash
    }));
  }

  private async reservationMutation(
    ledgerOperation: "reserve" | "complete" | "refund" | "mark_uncertain",
    input: ReserveImageLabAllowanceInput
  ): Promise<ImageLabReservation> {
    const candidate = record(input);
    if (candidate === null || !hasExactKeys(
      candidate,
      ["userId", "stage", "operationId", "jobKey", "requestHash"]
    )) invalid();
    assertUserId(input.userId);
    assertStage(input.stage);
    assertMutationIdentity(input);
    if (typeof input.jobKey !== "string" || !SAFE_ID.test(input.jobKey)) invalid();
    return parseSnapshot(await this.client.imageLabRpc({
      userId: input.userId,
      ledgerOperation,
      stage: input.stage,
      amount: 1,
      operationId: input.operationId,
      jobKey: input.jobKey,
      requestHash: input.requestHash
    }));
  }
}
```

## File: `netlify/functions/teacher-session.mts`

```typescript
import type { Config, Context } from "@netlify/functions";
import {
  ACCOUNT_JSON_LIMIT,
  AccountRequestError,
  accountJson,
  accountNoContent,
  assertSameOriginPost,
  readAccountJson
} from "./lib/account-backend";
import {
  TeacherAuthError,
  clearTeacherCookie,
  createTeacherSessionClaims,
  createTeacherSessionToken,
  parseTeacherEnvironment,
  readTeacherSession,
  secureTeacherPasswordMatches,
  serialiseTeacherCookie,
  type TeacherEnvironment,
  type TeacherEnvironmentRecord
} from "./lib/teacher-auth";

const TEACHER_SESSION_ROUTES = [
  "/api/teacher/login",
  "/api/teacher/session",
  "/api/teacher/logout"
] as const;
const ENVIRONMENT_KEYS = [
  "ADVERTISING_GAME_TEACHER_PASSWORD",
  "ADVERTISING_GAME_TEACHER_SESSION_SECRET",
  "ADVERTISING_GAME_TEACHER_SESSION_HOURS"
] as const;

interface TeacherSessionDependencies {
  readonly environment?: TeacherEnvironment | TeacherEnvironmentRecord;
  readonly nowSeconds?: () => number;
  readonly nonce?: () => string;
}

const runtimeEnvironment = (): TeacherEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const configuredEnvironment = (
  dependency: TeacherEnvironment | TeacherEnvironmentRecord | undefined
): TeacherEnvironment => {
  if (
    dependency &&
    typeof dependency.password === "string" &&
    typeof dependency.sessionSecret === "string" &&
    typeof dependency.sessionHours === "number"
  ) {
    return dependency as TeacherEnvironment;
  }
  return parseTeacherEnvironment(
    dependency === undefined ? runtimeEnvironment() : dependency as TeacherEnvironmentRecord
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const loginPassword = (value: unknown): unknown => {
  if (!isRecord(value) || Object.keys(value).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(value, "password")) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value.password;
};

const routeError = (error: unknown): Response => {
  if (error instanceof AccountRequestError) {
    return accountJson({ error: error.code }, error.status);
  }
  if (error instanceof TeacherAuthError) {
    return accountJson({ error: error.code }, error.status);
  }
  return accountJson({ error: "TEACHER_UNAVAILABLE" }, 503);
};

export function createTeacherSessionHandler(
  dependencies: TeacherSessionDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!TEACHER_SESSION_ROUTES.includes(path as typeof TEACHER_SESSION_ROUTES[number])) {
      return accountJson({ error: "NOT_FOUND" }, 404);
    }
    if (url.search !== "" || url.hash !== "" || request.url.endsWith("?")) {
      return accountJson({ error: "INVALID_REQUEST" }, 400);
    }
    const allowedMethod = path === "/api/teacher/session" ? "GET" : "POST";
    if (request.method !== allowedMethod) {
      return accountJson({ error: "METHOD_NOT_ALLOWED" }, 405, [], {
        allow: allowedMethod
      });
    }

    try {
      const environment = configuredEnvironment(dependencies.environment);
      const nowSeconds = dependencies.nowSeconds?.() ?? Math.floor(Date.now() / 1_000);

      if (path === "/api/teacher/login") {
        assertSameOriginPost(request);
        const password = loginPassword(await readAccountJson(request, ACCOUNT_JSON_LIMIT));
        if (!secureTeacherPasswordMatches(password, environment.password)) {
          return accountJson({ error: "INVALID_CREDENTIALS" }, 401);
        }
        const lifetimeSeconds = environment.sessionHours * 60 * 60;
        const claims = createTeacherSessionClaims(
          nowSeconds,
          lifetimeSeconds,
          dependencies.nonce?.()
        );
        const token = createTeacherSessionToken(claims, environment.sessionSecret);
        return accountJson(
          { authenticated: true },
          200,
          [serialiseTeacherCookie(token, lifetimeSeconds)]
        );
      }

      if (path === "/api/teacher/logout") {
        assertSameOriginPost(request);
        if (request.body !== null) throw new AccountRequestError("INVALID_REQUEST", 400);
        return accountNoContent([clearTeacherCookie()]);
      }

      if (request.body !== null) throw new AccountRequestError("INVALID_REQUEST", 400);
      const authenticated = readTeacherSession(request, environment, nowSeconds) !== null;
      return accountJson(
        { authenticated },
        200,
        authenticated || !request.headers.get("cookie") ? [] : [clearTeacherCookie()]
      );
    } catch (error) {
      return routeError(error);
    }
  };
}

export default createTeacherSessionHandler();

export const config: Config = {
  path: [
    "/api/teacher/login",
    "/api/teacher/session",
    "/api/teacher/logout"
  ],
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
```

## File: `netlify/functions/teacher-accounts.mts`

```typescript
import type { Config, Context } from "@netlify/functions";
import {
  ACCOUNT_JSON_LIMIT,
  AccountConfigurationError,
  AccountRequestError,
  SupabaseAccountClient,
  SupabaseAccountError,
  accountJson,
  assertSameOriginMutation,
  readAccountJson,
  type AccountEnvironmentRecord
} from "./lib/account-backend";
import {
  parseAccountAssetEnvironment,
  type AccountAssetEnvironment
} from "./lib/account-assets";
import { defaultAccountAssetService } from "./lib/netlify-account-assets";
import { normaliseAccountUsername } from "./lib/account-primitives";
import { SupabaseImageLabAllowanceStore } from "./lib/image-lab-allowance-store";
import {
  TeacherAuthError,
  parseTeacherEnvironment,
  requireTeacherSession,
  type TeacherEnvironment,
  type TeacherEnvironmentRecord
} from "./lib/teacher-auth";
import {
  TeacherAccountService,
  TeacherAccountServiceError,
  defaultTeacherAccountOperationStore
} from "./lib/teacher-account-service";

const ACCOUNT_LIST_PATH = "/api/teacher/accounts";
const ACCOUNT_ACTION_PATH =
  /^\/api\/teacher\/accounts\/([a-z0-9][a-z0-9_-]{2,23})\/(password|reset)$/u;
const IMAGE_LAB_PATH = "/api/teacher/image-lab";
const IMAGE_LAB_GLOBAL_PATH = "/api/teacher/image-lab/global";
const IMAGE_LAB_BATCH_PATH = "/api/teacher/image-lab/batch";
const IMAGE_LAB_ACCOUNT_PATH =
  /^\/api\/teacher\/image-lab\/accounts\/([a-z0-9][a-z0-9_-]{2,23})(?:\/(add|revoke))?$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const TEACHER_PLAYTEST_USERNAME = "teacher-playtest";
const ENVIRONMENT_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "ADVERTISING_GAME_EDGE_GATEWAY_SECRET",
  "ADVERTISING_GAME_USERNAME_HMAC_SECRET",
  "ADVERTISING_GAME_CLASSROOM_CODE",
  "ADVERTISING_GAME_ASSET_NAMESPACE_SECRET",
  "ADVERTISING_GAME_TEACHER_PASSWORD",
  "ADVERTISING_GAME_TEACHER_SESSION_SECRET",
  "ADVERTISING_GAME_TEACHER_SESSION_HOURS"
] as const;

interface TeacherAccountsService {
  listAccounts(): Promise<unknown>;
  createAccount(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<unknown>;
  replacePassword(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<unknown>;
  resetAccount(input: {
    operationId: string;
    username: string;
  }): Promise<unknown>;
  imageLabStatus(): Promise<unknown>;
  setImageLabGlobal(input: {
    operationId: string;
    enabled: boolean;
    objectDefault: number;
    realiseDefault: number;
  }): Promise<unknown>;
  mutateImageLabAccount(
    action: "set" | "add" | "revoke",
    input: {
      operationId: string;
      alias: string;
      object: number;
      realise: number;
    }
  ): Promise<unknown>;
  batchAddImageLab(input: {
    operationId: string;
    aliases: readonly string[];
    object: number;
    realise: number;
  }): Promise<unknown>;
}

interface TeacherAccountsDependencies {
  readonly environment?: AccountEnvironmentRecord;
  readonly teacherEnvironment?: TeacherEnvironment | TeacherEnvironmentRecord;
  readonly accountEnvironment?: AccountAssetEnvironment | AccountEnvironmentRecord;
  readonly fetcher?: typeof fetch;
  readonly service?: TeacherAccountsService;
  readonly serviceFactory?: (
    accountEnvironment: AccountAssetEnvironment,
    teacherEnvironment: TeacherEnvironment
  ) => Promise<TeacherAccountsService>;
  readonly nowSeconds?: () => number;
}

interface ParsedRoute {
  readonly kind:
    | "list"
    | "create"
    | "password"
    | "reset"
    | "image-lab-status"
    | "image-lab-global"
    | "image-lab-set"
    | "image-lab-add"
    | "image-lab-revoke"
    | "image-lab-batch";
  readonly username?: string;
  readonly allowedMethod: "GET" | "POST" | "PUT";
}

const runtimeEnvironment = (): AccountEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const configuredTeacherEnvironment = (
  value: TeacherEnvironment | TeacherEnvironmentRecord
): TeacherEnvironment => {
  if (
    typeof (value as TeacherEnvironment).password === "string" &&
    typeof (value as TeacherEnvironment).sessionSecret === "string" &&
    typeof (value as TeacherEnvironment).sessionHours === "number"
  ) {
    return value as TeacherEnvironment;
  }
  return parseTeacherEnvironment(value as TeacherEnvironmentRecord);
};

const configuredAccountEnvironment = (
  value: AccountAssetEnvironment | AccountEnvironmentRecord
): AccountAssetEnvironment => {
  if (
    typeof (value as AccountAssetEnvironment).supabaseUrl === "string" &&
    typeof (value as AccountAssetEnvironment).assetNamespaceSecret === "string"
  ) {
    return value as AccountAssetEnvironment;
  }
  return parseAccountAssetEnvironment(value as AccountEnvironmentRecord);
};

const routeFor = (pathname: string): ParsedRoute | null => {
  if (pathname === ACCOUNT_LIST_PATH) {
    return { kind: "list", allowedMethod: "GET" };
  }
  if (pathname === IMAGE_LAB_PATH) {
    return { kind: "image-lab-status", allowedMethod: "GET" };
  }
  if (pathname === IMAGE_LAB_GLOBAL_PATH) {
    return { kind: "image-lab-global", allowedMethod: "PUT" };
  }
  if (pathname === IMAGE_LAB_BATCH_PATH) {
    return { kind: "image-lab-batch", allowedMethod: "POST" };
  }
  const imageLabAccount = IMAGE_LAB_ACCOUNT_PATH.exec(pathname);
  if (imageLabAccount !== null) {
    const username = imageLabAccount[1]!;
    if (imageLabAccount[2] === "add") {
      return { kind: "image-lab-add", username, allowedMethod: "POST" };
    }
    if (imageLabAccount[2] === "revoke") {
      return { kind: "image-lab-revoke", username, allowedMethod: "POST" };
    }
    return { kind: "image-lab-set", username, allowedMethod: "PUT" };
  }
  const match = ACCOUNT_ACTION_PATH.exec(pathname);
  if (match === null) return null;
  const username = match[1]!;
  return match[2] === "password"
    ? { kind: "password", username, allowedMethod: "PUT" }
    : { kind: "reset", username, allowedMethod: "POST" };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
};

const parseOperationId = (value: unknown): string => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value;
};

const parsePassword = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") < 8 ||
    Buffer.byteLength(value, "utf8") > 128
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value;
};

const parseCreateBody = (value: unknown) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "operationId",
      "username",
      "password"
    ]) ||
    value.schema !== "ad-market-teacher-account-create" ||
    value.version !== 1
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  let username: string;
  try {
    username = normaliseAccountUsername(value.username);
  } catch {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  if (username === TEACHER_PLAYTEST_USERNAME) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    username,
    password: parsePassword(value.password)
  };
};

const parsePasswordBody = (value: unknown, username: string) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schema", "version", "operationId", "password"]) ||
    value.schema !== "ad-market-teacher-password-replace" ||
    value.version !== 1
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    username,
    password: parsePassword(value.password)
  };
};

const parseResetBody = (value: unknown, username: string) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schema", "version", "operationId", "confirmation"]) ||
    value.schema !== "ad-market-teacher-account-reset" ||
    value.version !== 1 ||
    value.confirmation !== username
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    username
  };
};

const parseAllowanceAmount = (value: unknown): number => {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value;
};

const parseImageLabGlobalBody = (value: unknown) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "operationId",
      "enabled",
      "objectDefault",
      "realiseDefault"
    ]) ||
    value.schema !== "ad-market-teacher-image-lab-global" ||
    value.version !== 1 ||
    typeof value.enabled !== "boolean"
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    enabled: value.enabled,
    objectDefault: parseAllowanceAmount(value.objectDefault),
    realiseDefault: parseAllowanceAmount(value.realiseDefault)
  };
};

const parseImageLabAccountBody = (
  value: unknown,
  username: string,
  action: "set" | "add" | "revoke"
) => {
  const schema = `ad-market-teacher-image-lab-account-${action}`;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "operationId",
      "object",
      "realise"
    ]) ||
    value.schema !== schema ||
    value.version !== 1
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  const object = parseAllowanceAmount(value.object);
  const realise = parseAllowanceAmount(value.realise);
  if (action !== "set" && object === 0 && realise === 0) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  if (username === TEACHER_PLAYTEST_USERNAME) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    alias: username,
    object,
    realise
  };
};

const parseImageLabBatchBody = (value: unknown) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "operationId",
      "aliases",
      "object",
      "realise"
    ]) ||
    value.schema !== "ad-market-teacher-image-lab-batch-add" ||
    value.version !== 1 ||
    !Array.isArray(value.aliases) ||
    value.aliases.length < 1 ||
    value.aliases.length > 100
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  const aliases = value.aliases.map((candidate) => {
    try {
      const alias = normaliseAccountUsername(candidate);
      if (alias === TEACHER_PLAYTEST_USERNAME) throw new Error("reserved");
      return alias;
    } catch {
      throw new AccountRequestError("INVALID_REQUEST", 400);
    }
  });
  const object = parseAllowanceAmount(value.object);
  const realise = parseAllowanceAmount(value.realise);
  if (
    new Set(aliases).size !== aliases.length ||
    (object === 0 && realise === 0)
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    aliases,
    object,
    realise
  };
};

const routeError = (error: unknown, operationId?: string): Response => {
  if (error instanceof AccountRequestError) {
    return accountJson({ error: error.code }, error.status);
  }
  if (error instanceof TeacherAuthError) {
    return accountJson({ error: error.code }, error.status);
  }
  if (error instanceof TeacherAccountServiceError) {
    const body = {
      error: error.code,
      ...(operationId === undefined ? {} : { operationId }),
      ...(error.retryable || error.code === "RESET_INCOMPLETE"
        ? { retryable: error.retryable }
        : {}),
      ...(error.code === "IMAGE_LAB_MUTATION_UNCERTAIN"
        ? { retryable: false, refreshRequired: true }
        : {})
    };
    const headers = error.retryAfter !== undefined &&
      Number.isInteger(error.retryAfter) &&
      error.retryAfter >= 1 &&
      error.retryAfter <= 3_600
      ? { "retry-after": String(error.retryAfter) }
      : {};
    return accountJson(body, error.status, [], headers);
  }
  if (error instanceof AccountConfigurationError) {
    return accountJson({ error: "TEACHER_NOT_CONFIGURED" }, 503);
  }
  if (error instanceof SupabaseAccountError) {
    return accountJson({
      error: error.kind === "duplicate_user"
        ? "USERNAME_UNAVAILABLE"
        : "TEACHER_UNAVAILABLE"
    }, error.kind === "duplicate_user" ? 409 : 503);
  }
  return accountJson({ error: "TEACHER_UNAVAILABLE" }, 503);
};

const defaultService = async (
  accountEnvironment: AccountAssetEnvironment,
  teacherEnvironment: TeacherEnvironment,
  fetcher: typeof fetch
): Promise<TeacherAccountsService> => {
  const client = new SupabaseAccountClient(accountEnvironment, fetcher);
  return new TeacherAccountService({
    client,
    assets: await defaultAccountAssetService(accountEnvironment.assetNamespaceSecret),
    allowances: new SupabaseImageLabAllowanceStore(client),
    operations: defaultTeacherAccountOperationStore(),
    usernameHmacSecret: accountEnvironment.usernameHmacSecret,
    operationSecret: teacherEnvironment.sessionSecret
  });
};

export function createTeacherAccountsHandler(
  dependencies: TeacherAccountsDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const route = routeFor(url.pathname);
    if (route === null) return accountJson({ error: "NOT_FOUND" }, 404);
    if (url.search !== "" || url.hash !== "" || request.url.endsWith("?")) {
      return accountJson({ error: "INVALID_REQUEST" }, 400);
    }
    const expectedMethod = url.pathname === ACCOUNT_LIST_PATH
      ? (request.method === "POST" ? "POST" : "GET")
      : route.allowedMethod;
    const routeWithMethod = url.pathname === ACCOUNT_LIST_PATH && request.method === "POST"
      ? { ...route, kind: "create" as const, allowedMethod: "POST" as const }
      : route;
    if (request.method !== expectedMethod) {
      return accountJson({ error: "METHOD_NOT_ALLOWED" }, 405, [], {
        allow: url.pathname === ACCOUNT_LIST_PATH ? "GET, POST" : route.allowedMethod
      });
    }

    let operationId: string | undefined;
    try {
      const combinedEnvironment = dependencies.environment ?? runtimeEnvironment();
      const teacherEnvironment = configuredTeacherEnvironment(
        dependencies.teacherEnvironment ?? combinedEnvironment
      );
      requireTeacherSession(
        request,
        teacherEnvironment,
        dependencies.nowSeconds?.() ?? Math.floor(Date.now() / 1_000)
      );
      if (request.method === "GET") {
        if (request.body !== null) throw new AccountRequestError("INVALID_REQUEST", 400);
      } else {
        assertSameOriginMutation(request, request.method as "POST" | "PUT");
      }

      const accountEnvironment = dependencies.service === undefined
        ? configuredAccountEnvironment(
            dependencies.accountEnvironment ?? combinedEnvironment
          )
        : undefined;
      const service = dependencies.service ?? await (
        dependencies.serviceFactory !== undefined
          ? dependencies.serviceFactory(accountEnvironment!, teacherEnvironment)
          : defaultService(
              accountEnvironment!,
              teacherEnvironment,
              dependencies.fetcher ?? fetch
            )
      );

      if (routeWithMethod.kind === "list") {
        return accountJson({ accounts: await service.listAccounts() });
      }
      if (routeWithMethod.kind === "image-lab-status") {
        return accountJson(await service.imageLabStatus());
      }
      const body = await readAccountJson(request, ACCOUNT_JSON_LIMIT);
      if (routeWithMethod.kind === "create") {
        const input = parseCreateBody(body);
        operationId = input.operationId;
        return accountJson(await service.createAccount(input), 201);
      }
      if (routeWithMethod.kind === "password") {
        const input = parsePasswordBody(body, routeWithMethod.username!);
        operationId = input.operationId;
        return accountJson(await service.replacePassword(input));
      }
      if (routeWithMethod.kind === "reset") {
        const input = parseResetBody(body, routeWithMethod.username!);
        operationId = input.operationId;
        return accountJson(await service.resetAccount(input));
      }
      if (routeWithMethod.kind === "image-lab-global") {
        const input = parseImageLabGlobalBody(body);
        operationId = input.operationId;
        return accountJson(await service.setImageLabGlobal(input));
      }
      if (
        routeWithMethod.kind === "image-lab-set" ||
        routeWithMethod.kind === "image-lab-add" ||
        routeWithMethod.kind === "image-lab-revoke"
      ) {
        const action = routeWithMethod.kind.replace("image-lab-", "") as
          "set" | "add" | "revoke";
        const input = parseImageLabAccountBody(
          body,
          routeWithMethod.username!,
          action
        );
        operationId = input.operationId;
        return accountJson(await service.mutateImageLabAccount(action, input));
      }
      const input = parseImageLabBatchBody(body);
      operationId = input.operationId;
      return accountJson(await service.batchAddImageLab(input));
    } catch (error) {
      return routeError(error, operationId);
    }
  };
}

export default createTeacherAccountsHandler();

export const config: Config = {
  path: [
    "/api/teacher/accounts",
    "/api/teacher/accounts/:username/password",
    "/api/teacher/accounts/:username/reset",
    "/api/teacher/image-lab",
    "/api/teacher/image-lab/global",
    "/api/teacher/image-lab/accounts/:username",
    "/api/teacher/image-lab/accounts/:username/add",
    "/api/teacher/image-lab/accounts/:username/revoke",
    "/api/teacher/image-lab/batch"
  ],
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
```

## File: `netlify/functions/teacher-playtest.mts`

```typescript
import { createHmac } from "node:crypto";
import type { Config, Context } from "@netlify/functions";
import {
  PROGRESS_JSON_LIMIT,
  AccountConfigurationError,
  AccountRequestError,
  SupabaseAccountClient,
  accountJson,
  assertSameOriginMutation,
  readAccountJson,
  type AccountAdminRecord,
  type AccountEnvironmentRecord,
  type ProgressRpcInput
} from "./lib/account-backend";
import {
  ACCOUNT_ASSET_LIMITS,
  AccountAssetError,
  parseAccountAssetEnvironment,
  type AccountAssetDescriptor,
  type AccountAssetEnvironment,
  type AccountAssetManifest,
  type AccountAssetResetPlan
} from "./lib/account-assets";
import { parseCloudProgressDocument } from "./lib/account-progress-document";
import { defaultAccountAssetService } from "./lib/netlify-account-assets";
import {
  TeacherAuthError,
  parseTeacherEnvironment,
  requireTeacherSession,
  type TeacherEnvironment,
  type TeacherEnvironmentRecord
} from "./lib/teacher-auth";
import { isCloudProgressDocumentId } from "../../web/src/domain/practice-identity";

const PROGRESS_PATH = "/api/teacher/playtest/progress";
const RESET_PATH = "/api/teacher/playtest/reset";
const ASSET_PATH =
  /^\/api\/teacher\/playtest\/assets\/([a-f0-9]{64})$/u;
const TEACHER_PLAYTEST_USERNAME = "teacher-playtest";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SUPPORTED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ENVIRONMENT_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "ADVERTISING_GAME_EDGE_GATEWAY_SECRET",
  "ADVERTISING_GAME_USERNAME_HMAC_SECRET",
  "ADVERTISING_GAME_CLASSROOM_CODE",
  "ADVERTISING_GAME_ASSET_NAMESPACE_SECRET",
  "ADVERTISING_GAME_TEACHER_PASSWORD",
  "ADVERTISING_GAME_TEACHER_SESSION_SECRET",
  "ADVERTISING_GAME_TEACHER_SESSION_HOURS"
] as const;

interface TeacherPlaytestClient {
  ensureAdvertisingGameUser(
    username: string,
    password: string
  ): Promise<AccountAdminRecord>;
  progressRpc(input: ProgressRpcInput): Promise<unknown>;
}

interface TeacherPlaytestAssetService {
  put(
    userId: string,
    digest: string,
    contentType: string,
    bytes: Uint8Array
  ): Promise<{ created: boolean; manifest: AccountAssetManifest }>;
  get(
    userId: string,
    digest: string
  ): Promise<{ descriptor: AccountAssetDescriptor; bytes: Uint8Array }>;
  planReset(userId: string): Promise<AccountAssetResetPlan>;
  executeReset(plan: AccountAssetResetPlan): Promise<void>;
}

interface TeacherPlaytestDependencies {
  readonly environment?: AccountEnvironmentRecord;
  readonly teacherEnvironment?: TeacherEnvironment | TeacherEnvironmentRecord;
  readonly accountEnvironment?: AccountAssetEnvironment | AccountEnvironmentRecord;
  readonly fetcher?: typeof fetch;
  readonly client?: TeacherPlaytestClient;
  readonly assets?: TeacherPlaytestAssetService;
  readonly assetFactory?: (namespaceSecret: string) => Promise<TeacherPlaytestAssetService>;
  readonly nowSeconds?: () => number;
}

interface SaveProgressBody {
  readonly documentId: string;
  readonly expectedRevision: number;
  readonly document: Readonly<Record<string, unknown>>;
}

const runtimeEnvironment = (): AccountEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const configuredTeacherEnvironment = (
  value: TeacherEnvironment | TeacherEnvironmentRecord
): TeacherEnvironment => {
  if (
    typeof (value as TeacherEnvironment).password === "string" &&
    typeof (value as TeacherEnvironment).sessionSecret === "string" &&
    typeof (value as TeacherEnvironment).sessionHours === "number"
  ) return value as TeacherEnvironment;
  return parseTeacherEnvironment(value as TeacherEnvironmentRecord);
};

const configuredAccountEnvironment = (
  value: AccountAssetEnvironment | AccountEnvironmentRecord
): AccountAssetEnvironment => {
  if (
    typeof (value as AccountAssetEnvironment).supabaseUrl === "string" &&
    typeof (value as AccountAssetEnvironment).assetNamespaceSecret === "string"
  ) return value as AccountAssetEnvironment;
  return parseAccountAssetEnvironment(value as AccountEnvironmentRecord);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
};

const parseDocumentId = (value: unknown): string => {
  if (!isCloudProgressDocumentId(value)) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value;
};

const parseProgressDocumentId = (url: URL): string | undefined => {
  const keys = [...url.searchParams.keys()];
  if (keys.length === 0) return undefined;
  if (
    keys.length !== 1 ||
    keys[0] !== "documentId" ||
    url.searchParams.getAll("documentId").length !== 1
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return parseDocumentId(url.searchParams.get("documentId"));
};

const parseSaveBody = (value: unknown): SaveProgressBody => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "documentId",
      "expectedRevision",
      "document"
    ]) ||
    value.schema !== "advertising-game-progress" ||
    value.version !== 1 ||
    typeof value.expectedRevision !== "number" ||
    !Number.isSafeInteger(value.expectedRevision) ||
    value.expectedRevision < 0 ||
    !isRecord(value.document)
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  const documentId = parseDocumentId(value.documentId);
  try {
    return {
      documentId,
      expectedRevision: value.expectedRevision,
      document: parseCloudProgressDocument(value.document, documentId)
    };
  } catch {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
};

const validRevision = (value: unknown, allowZero = false): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= (allowZero ? 0 : 1);

const validUpdatedAt = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length >= 20 &&
  value.length <= 64 &&
  Number.isFinite(Date.parse(value));

const parseMetadata = (value: unknown): readonly Record<string, unknown>[] | null => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["status", "documents"]) ||
    value.status !== "listed" ||
    !Array.isArray(value.documents) ||
    value.documents.length > 16
  ) return null;
  const result: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const candidate of value.documents) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ["documentId", "revision", "updatedAt"]) ||
      !isCloudProgressDocumentId(candidate.documentId) ||
      !validRevision(candidate.revision) ||
      !validUpdatedAt(candidate.updatedAt) ||
      seen.has(candidate.documentId)
    ) return null;
    seen.add(candidate.documentId);
    result.push({
      documentId: candidate.documentId,
      revision: candidate.revision,
      updatedAt: candidate.updatedAt
    });
  }
  return result;
};

const playtestCreationPassword = (sessionSecret: string): string =>
  createHmac("sha256", sessionSecret)
    .update("ad-market-teacher-playtest-creation-v1\0", "utf8")
    .update(TEACHER_PLAYTEST_USERNAME, "utf8")
    .digest("base64url");

const readBoundedAsset = async (request: Request): Promise<Uint8Array> => {
  if (request.body === null) throw new AccountAssetError("UNSUPPORTED_ASSET");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > ACCOUNT_ASSET_LIMITS.maxAssetBytes) {
      await reader.cancel();
      throw new AccountAssetError("ASSET_TOO_LARGE");
    }
    chunks.push(value);
  }
  if (total < 1) throw new AccountAssetError("UNSUPPORTED_ASSET");
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

const assetBinary = (
  descriptor: AccountAssetDescriptor,
  bytes: Uint8Array
): Response => {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    status: 200,
    headers: {
      "cache-control": "private, no-store",
      "content-length": String(bytes.byteLength),
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "content-type": descriptor.contentType,
      "cross-origin-resource-policy": "same-origin",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff"
    }
  });
};

const parseResetBody = (value: unknown): string => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "operationId",
      "confirmation"
    ]) ||
    value.schema !== "ad-market-teacher-playtest-reset" ||
    value.version !== 1 ||
    typeof value.operationId !== "string" ||
    !UUID_PATTERN.test(value.operationId) ||
    value.confirmation !== "RESET"
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value.operationId;
};

const assetError = (error: AccountAssetError): Response => {
  const status = error.code === "ASSET_NOT_FOUND"
    ? 404
    : error.code === "ASSET_TOO_LARGE"
      ? 413
      : error.code === "UNSUPPORTED_ASSET"
        ? 415
        : error.code === "ASSET_HASH_MISMATCH"
          ? 422
          : error.code === "ASSET_QUOTA_EXCEEDED"
            ? 409
            : 503;
  return accountJson({ error: error.code }, status);
};

export function createTeacherPlaytestHandler(
  dependencies: TeacherPlaytestDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const assetMatch = ASSET_PATH.exec(url.pathname);
    const route = url.pathname === PROGRESS_PATH
      ? "progress"
      : url.pathname === RESET_PATH
        ? "reset"
        : assetMatch !== null
          ? "asset"
          : null;
    if (route === null) return accountJson({ error: "NOT_FOUND" }, 404);
    const allowed = route === "reset" ? ["POST"] : ["GET", "PUT"];
    if (!allowed.includes(request.method)) {
      return accountJson({ error: "METHOD_NOT_ALLOWED" }, 405, [], {
        allow: allowed.join(", ")
      });
    }

    let operationId: string | undefined;
    let progressReset = false;
    try {
      const combined = dependencies.environment ?? runtimeEnvironment();
      const teacherEnvironment = configuredTeacherEnvironment(
        dependencies.teacherEnvironment ?? combined
      );
      requireTeacherSession(
        request,
        teacherEnvironment,
        dependencies.nowSeconds?.() ?? Math.floor(Date.now() / 1_000)
      );

      let documentId: string | undefined;
      let saveBody: SaveProgressBody | undefined;
      let assetBytes: Uint8Array | undefined;
      let assetContentType: string | undefined;
      if (route === "progress") {
        if (request.method === "GET") {
          documentId = parseProgressDocumentId(url);
        } else {
          assertSameOriginMutation(request, "PUT");
          if (url.search !== "") throw new AccountRequestError("INVALID_REQUEST", 400);
          saveBody = parseSaveBody(await readAccountJson(request, PROGRESS_JSON_LIMIT));
          documentId = saveBody.documentId;
        }
      } else if (route === "asset") {
        if (url.search !== "") throw new AccountRequestError("INVALID_REQUEST", 400);
        if (request.method === "PUT") {
          assertSameOriginMutation(request, "PUT");
          assetContentType = request.headers.get("content-type")?.trim().toLowerCase();
          if (
            assetContentType === undefined ||
            !SUPPORTED_CONTENT_TYPES.has(assetContentType) ||
            ![null, "identity"].includes(request.headers.get("content-encoding"))
          ) {
            throw new AccountAssetError("UNSUPPORTED_ASSET");
          }
          assetBytes = await readBoundedAsset(request);
        }
      } else {
        assertSameOriginMutation(request, "POST");
        if (url.search !== "") throw new AccountRequestError("INVALID_REQUEST", 400);
        operationId = parseResetBody(await readAccountJson(request, PROGRESS_JSON_LIMIT));
      }

      const accountEnvironment = configuredAccountEnvironment(
        dependencies.accountEnvironment ?? combined
      );
      const client = dependencies.client ??
        new SupabaseAccountClient(accountEnvironment, dependencies.fetcher ?? fetch);
      const assets = dependencies.assets ?? await (
        dependencies.assetFactory ?? defaultAccountAssetService
      )(accountEnvironment.assetNamespaceSecret);
      const playtestUser = await client.ensureAdvertisingGameUser(
        TEACHER_PLAYTEST_USERNAME,
        playtestCreationPassword(teacherEnvironment.sessionSecret)
      );

      if (route === "progress") {
        const result = await client.progressRpc({
          userId: playtestUser.userId,
          operation: request.method === "GET"
            ? (documentId === undefined ? "list" : "load")
            : "save",
          ...(documentId === undefined ? {} : { documentId }),
          schema: "advertising-game-progress",
          version: 1,
          ...(saveBody === undefined ? {} : {
            expectedRevision: saveBody.expectedRevision,
            document: saveBody.document
          })
        });
        if (request.method === "GET" && documentId === undefined) {
          const documents = parseMetadata(result);
          return documents === null
            ? accountJson({ error: "PROGRESS_UNAVAILABLE" }, 503)
            : accountJson({
                schema: "advertising-game-progress",
                version: 1,
                documents
              });
        }
        if (request.method === "GET") {
          if (isRecord(result) && result.status === "not_found") {
            return accountJson({ error: "PROGRESS_NOT_FOUND" }, 404);
          }
          if (
            !isRecord(result) ||
            result.status !== "found" ||
            !validRevision(result.revision) ||
            !isRecord(result.document) ||
            !validUpdatedAt(result.updatedAt)
          ) return accountJson({ error: "PROGRESS_UNAVAILABLE" }, 503);
          return accountJson({
            schema: "advertising-game-progress",
            version: 1,
            documentId,
            revision: result.revision,
            document: parseCloudProgressDocument(result.document, documentId!),
            updatedAt: result.updatedAt
          });
        }
        if (isRecord(result) && result.status === "conflict" &&
          validRevision(result.currentRevision, true)) {
          return accountJson({
            error: "REVISION_CONFLICT",
            currentRevision: result.currentRevision
          }, 409);
        }
        if (
          !isRecord(result) ||
          result.status !== "saved" ||
          !validRevision(result.revision) ||
          !validUpdatedAt(result.updatedAt)
        ) return accountJson({ error: "PROGRESS_UNAVAILABLE" }, 503);
        return accountJson({
          schema: "advertising-game-progress",
          version: 1,
          documentId,
          revision: result.revision,
          updatedAt: result.updatedAt
        });
      }

      if (route === "asset") {
        const digest = assetMatch![1]!;
        if (request.method === "PUT") {
          const result = await assets.put(
            playtestUser.userId,
            digest,
            assetContentType!,
            assetBytes!
          );
          return accountJson({
            ...result.manifest,
            asset: {
              ...result.manifest.asset,
              href: `/api/teacher/playtest/assets/${digest}`
            }
          }, result.created ? 201 : 200);
        }
        const result = await assets.get(playtestUser.userId, digest);
        return assetBinary(result.descriptor, result.bytes);
      }

      const plan = await assets.planReset(playtestUser.userId);
      await client.progressRpc({
        userId: playtestUser.userId,
        operation: "reset",
        schema: "advertising-game-progress",
        version: 1
      });
      progressReset = true;
      await assets.executeReset(plan);
      return accountJson({ status: "reset", operationId });
    } catch (error) {
      if (progressReset && operationId !== undefined) {
        return accountJson({
          error: "RESET_INCOMPLETE",
          operationId,
          retryable: false
        }, 409);
      }
      if (error instanceof TeacherAuthError) {
        return accountJson({ error: error.code }, error.status);
      }
      if (error instanceof AccountRequestError) {
        return accountJson({ error: error.code }, error.status);
      }
      if (error instanceof AccountAssetError) return assetError(error);
      if (error instanceof AccountConfigurationError) {
        return accountJson({ error: "PLAYTEST_NOT_CONFIGURED" }, 503);
      }
      return accountJson({ error: "PLAYTEST_UNAVAILABLE" }, 503);
    }
  };
}

export default createTeacherPlaytestHandler();

export const config: Config = {
  path: [
    "/api/teacher/playtest/progress",
    "/api/teacher/playtest/assets/:digest",
    "/api/teacher/playtest/reset"
  ],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
```

## File: `netlify/functions/image-lab-jobs.mts`

```typescript
import type { Config, Context } from "@netlify/functions";
import { createHash } from "node:crypto";
import {
  FAL_IMAGE_MAX_BYTES,
  FLUX2_TURBO_EDIT_PROFILE,
  FalImagePolicyError,
  MAKE_IT_REAL_PROFILE,
  OBJECT_FORGE_PROFILE,
  Z_IMAGE_LORA_PROFILE,
  assertGptImage2ConcreteSize,
  composeMakeItRealPrompt,
  composeObjectForgePrompt,
  parseFalImageRequest,
  type FalImageRequest,
  type MakeItRealRequest,
  type ObjectForgeRequest
} from "./lib/fal-image-policy";
import {
  createJobToken,
  parseImageLabEnvironment,
  readJobToken,
  type ImageLabJobToken,
  type ImageLabStage,
  type ReadyImageLabEnvironment
} from "./lib/image-lab-auth";
import {
  AccountConfigurationError,
  SupabaseAccountClient,
  SupabaseAccountError,
  parseAccountCookies,
  parseAccountEnvironment,
  resolveAccountSession,
  type ResolvedAccountSession
} from "./lib/account-backend";
import {
  clearAccountAccessCookie,
  clearAccountRefreshCookie,
  serialiseAccountAccessCookie,
  serialiseAccountRefreshCookie
} from "./lib/account-primitives";
import {
  ImageLabAllowanceStoreError,
  SupabaseImageLabAllowanceStore,
  type ImageLabAllowanceSnapshot,
  type ImageLabAllowanceStage,
  type ImageLabAllowanceStore,
  type TerminalImageLabReservationInput
} from "./lib/image-lab-allowance-store";
import {
  ImageLabStateError,
  type ImageLabJobReservation,
  type ImageLabSubmissionClaim,
  type ImageLabStoredJob
} from "./lib/image-lab-state";
import { defaultImageLabStateService } from "./lib/netlify-image-lab-state";
import {
  FalQueueError,
  falImageUrl,
  falJobStatus,
  submitFalJob
} from "./lib/fal-queue";
import {
  OpenverseError,
  countedImageStream,
  parseSafeImageContentType,
  readValidatedImageHeader
} from "./lib/openverse";

export const OBJECT_FORGE_PROFILE_ID = "object-forge-gpt-image-2-low-v1";
export const LEGACY_MAKE_IT_REAL_PROFILE_ID = "make-it-real-gpt-image-2-high-v1";
export const MAKE_IT_REAL_PROFILE_ID = "make-it-real-gpt-image-2-high-v2";
export const Z_IMAGE_LORA_PROFILE_ID = "z-image-lora-v1";
export const FLUX2_TURBO_EDIT_PROFILE_ID = "flux2-turbo-edit-v1";
export const IMAGE_LAB_ASSET_MAX_BYTES = 8 * 1_048_576;

const JOB_JSON_MAX_BYTES = 4 * Math.ceil(FAL_IMAGE_MAX_BYTES / 3) + 16 * 1_024;
const JOB_TOKEN_MAX_LENGTH = 4_096;
const JOB_LIFETIME_SECONDS = 3_600;
const UPSTREAM_TIMEOUT_MS = 12_000;
const FAL_START_TIMEOUT_SECONDS = 30;
const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const ENVIRONMENT_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "ADVERTISING_GAME_EDGE_GATEWAY_SECRET",
  "ADVERTISING_GAME_USERNAME_HMAC_SECRET",
  "ADVERTISING_GAME_CLASSROOM_CODE",
  "IMAGE_LAB_ENABLED",
  "IMAGE_LAB_SCHOOL_APPROVED",
  "IMAGE_LAB_ACCOUNT_CAP_USD",
  "IMAGE_LAB_SIGNING_SECRET",
  "IMAGE_LAB_OBJECT_PROFILE_ID",
  "IMAGE_LAB_REALISE_PROFILE_ID",
  "IMAGE_LAB_Z_LORA_URL",
  "FAL_KEY"
] as const;

type ImageLabEnvironmentRecord = Readonly<Record<string, string | undefined>>;
type DeadlineOperation = "submit" | "status" | "asset";

export interface ImageLabJobsDependencies {
  environment?: ImageLabEnvironmentRecord;
  fetch?: typeof fetch;
  nowSeconds?: () => number;
  createDeadlineSignal?: (operation: DeadlineOperation) => AbortSignal;
  state?: ImageLabJobsState;
  resolveSession?: (request: Request) => Promise<ResolvedAccountSession>;
  allowances?: ImageLabAllowanceStore;
}

export interface ImageLabJobsState {
  reserve(
    identity: { userId: string },
    input: {
      idempotencyKey: string;
      requestHash: string;
      stage: ImageLabStage;
      profileId: string;
      nowSeconds: number;
    }
  ): Promise<ImageLabJobReservation>;
  markReserved(
    identity: { userId: string },
    jobId: string
  ): Promise<ImageLabStoredJob>;
  beginSubmission(
    identity: { userId: string },
    jobId: string
  ): Promise<ImageLabSubmissionClaim>;
  attachRequest(
    identity: { userId: string },
    jobId: string,
    requestId: string
  ): Promise<ImageLabStoredJob>;
  markUncertain(
    identity: { userId: string },
    jobId: string,
    requestId?: string
  ): Promise<ImageLabStoredJob>;
  markCompleted(
    identity: { userId: string },
    jobId: string
  ): Promise<ImageLabStoredJob>;
  markRefunded(
    identity: { userId: string },
    jobId: string
  ): Promise<ImageLabStoredJob>;
  markDenied(
    identity: { userId: string },
    jobId: string
  ): Promise<ImageLabStoredJob>;
  getJob(
    identity: { userId: string },
    jobId: string
  ): Promise<ImageLabStoredJob>;
}

interface ResolvedDependencies {
  environment?: ImageLabEnvironmentRecord;
  fetch: typeof fetch;
  nowSeconds: () => number;
  createDeadlineSignal: (operation: DeadlineOperation) => AbortSignal;
  state?: ImageLabJobsState;
  resolveSession?: (request: Request) => Promise<ResolvedAccountSession>;
  allowances?: ImageLabAllowanceStore;
}

interface JobBinding {
  job: ImageLabJobToken;
  stored: ImageLabStoredJob;
  modelId: string;
  width: number;
  height: number;
}

interface SubmissionProfile {
  readonly profileId: string;
  readonly modelId: string;
  readonly width: number;
  readonly height: number;
  readonly input: Readonly<Record<string, unknown>>;
}

class ImageLabJobsError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code);
    this.name = "ImageLabJobsError";
  }
}

const runtimeEnvironment = (): ImageLabEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const json = (
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
  cookies: readonly string[] = []
): Response => {
  const responseHeaders = new Headers({
    "cache-control": "no-store",
    ...Object.fromEntries(new Headers(headers))
  });
  for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);
  return Response.json(body, { status, headers: responseHeaders });
};

const methodNotAllowed = (allow: string): Response =>
  json({ error: "METHOD_NOT_ALLOWED" }, 405, { allow });

const resolveDependencies = (dependencies: ImageLabJobsDependencies): ResolvedDependencies => ({
  ...(dependencies.environment === undefined ? {} : { environment: dependencies.environment }),
  fetch: dependencies.fetch ?? ((input, init) => fetch(input, init)),
  nowSeconds: dependencies.nowSeconds ?? (() => Math.floor(Date.now() / 1_000)),
  createDeadlineSignal: dependencies.createDeadlineSignal ?? (() => AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)),
  ...(dependencies.state === undefined ? {} : { state: dependencies.state }),
  ...(dependencies.resolveSession === undefined ? {} : { resolveSession: dependencies.resolveSession }),
  ...(dependencies.allowances === undefined ? {} : { allowances: dependencies.allowances })
});

function requireReadyEnvironment(record: ImageLabEnvironmentRecord): ReadyImageLabEnvironment {
  const environment = parseImageLabEnvironment(record);
  if (!environment.enabled) throw new ImageLabJobsError("IMAGE_LAB_DISABLED", 503);
  return environment;
}

type AuthenticatedAccountSession = Extract<ResolvedAccountSession, { authenticated: true }>;

const rotatedAccountCookies = (
  session: AuthenticatedAccountSession
): readonly string[] => session.rotatedTokens === undefined
  ? []
  : [
      serialiseAccountAccessCookie(
        session.rotatedTokens.accessToken,
        session.rotatedTokens.expiresIn,
        true
      ),
      serialiseAccountRefreshCookie(
        session.rotatedTokens.refreshToken,
        REFRESH_COOKIE_MAX_AGE_SECONDS,
        true
      )
    ];

const expiredAccountCookies = (): readonly string[] => [
  clearAccountAccessCookie(true),
  clearAccountRefreshCookie(true)
];

function withCookies(response: Response, cookies: readonly string[]): Response {
  if (cookies.length === 0) return response;
  const headers = new Headers(response.headers);
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function stateFailure(error: unknown): ImageLabJobsError {
  if (!(error instanceof ImageLabStateError)) {
    return new ImageLabJobsError("IMAGE_STATE_UNAVAILABLE", 503);
  }
  switch (error.code) {
    case "IDEMPOTENCY_CONFLICT": return new ImageLabJobsError("IDEMPOTENCY_CONFLICT", 409);
    case "JOB_NOT_FOUND": return new ImageLabJobsError("JOB_NOT_FOUND", 404);
    case "JOB_LIMIT_REACHED": return new ImageLabJobsError("JOB_LIMIT_REACHED", 429);
    case "INVALID_TRANSITION": return new ImageLabJobsError("IMAGE_STATE_CONFLICT", 409);
    default: return new ImageLabJobsError("IMAGE_STATE_UNAVAILABLE", 503);
  }
}

function requireNoQuery(url: URL): void {
  if ([...url.searchParams.keys()].length !== 0) {
    throw new ImageLabJobsError("INVALID_PARAMETERS", 400);
  }
}

function requireJobQuery(url: URL): string {
  const keys = [...url.searchParams.keys()];
  const values = url.searchParams.getAll("job");
  if (keys.length !== 1 || keys[0] !== "job" || values.length !== 1 ||
    !values[0] || values[0].length > JOB_TOKEN_MAX_LENGTH) {
    throw new ImageLabJobsError("INVALID_PARAMETERS", 400);
  }
  return values[0];
}

function hasUntrustedIdentityHeaders(request: Request): boolean {
  return request.headers.has("x-admarket-account") ||
    request.headers.has("x-image-lab-code") ||
    request.headers.has("x-image-lab-user-id") ||
    request.headers.has("x-image-lab-session-id") ||
    request.headers.has("x-image-lab-team-id");
}

async function readRequestJson(request: Request): Promise<unknown> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const encoding = request.headers.get("content-encoding")?.trim().toLowerCase();
  if (mediaType !== "application/json" || encoding && encoding !== "identity") {
    throw new ImageLabJobsError("UNSUPPORTED_MEDIA_TYPE", 415);
  }
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > JOB_JSON_MAX_BYTES)) {
    throw new ImageLabJobsError("REQUEST_TOO_LARGE", 413);
  }
  if (!request.body) throw new ImageLabJobsError("INVALID_REQUEST", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      byteLength += next.value.byteLength;
      if (byteLength > JOB_JSON_MAX_BYTES) {
        await reader.cancel();
        throw new ImageLabJobsError("REQUEST_TOO_LARGE", 413);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new ImageLabJobsError("INVALID_REQUEST", 400);
  }
}

function jobStage(request: FalImageRequest): ImageLabStage {
  return request.stage === "object" ? "object-forge" : "make-it-real";
}

function gptImage2InputSize(size: { width: number; height: number }): Readonly<{
  width: number;
  height: number;
}> {
  try {
    return assertGptImage2ConcreteSize(size);
  } catch (error) {
    if (error instanceof FalImagePolicyError && error.code === "INVALID_PROFILE_DIMENSIONS") {
      throw new ImageLabJobsError("IMAGE_PROFILE_CONFIGURATION_INVALID", 503);
    }
    throw error;
  }
}

function objectForgeInput(request: ObjectForgeRequest): Readonly<Record<string, unknown>> {
  return {
    prompt: composeObjectForgePrompt(request),
    image_size: gptImage2InputSize({
      width: OBJECT_FORGE_PROFILE.width,
      height: OBJECT_FORGE_PROFILE.height
    }),
    quality: OBJECT_FORGE_PROFILE.quality,
    num_images: OBJECT_FORGE_PROFILE.images,
    output_format: OBJECT_FORGE_PROFILE.outputFormat
  };
}

function zImageLoraInput(
  request: ObjectForgeRequest,
  loraUrl: string
): Readonly<Record<string, unknown>> {
  return {
    prompt: composeObjectForgePrompt(request),
    image_size: { width: Z_IMAGE_LORA_PROFILE.width, height: Z_IMAGE_LORA_PROFILE.height },
    num_inference_steps: Z_IMAGE_LORA_PROFILE.steps,
    num_images: Z_IMAGE_LORA_PROFILE.images,
    enable_safety_checker: Z_IMAGE_LORA_PROFILE.safetyChecker,
    output_format: Z_IMAGE_LORA_PROFILE.outputFormat,
    acceleration: Z_IMAGE_LORA_PROFILE.acceleration,
    enable_prompt_expansion: Z_IMAGE_LORA_PROFILE.promptExpansion,
    loras: [{ path: loraUrl, scale: Z_IMAGE_LORA_PROFILE.loraScale }]
  };
}

function makeItRealInput(request: MakeItRealRequest): Readonly<Record<string, unknown>> {
  return {
    image_urls: [request.designDataUrl],
    image_size: gptImage2InputSize(MAKE_IT_REAL_PROFILE.imageSize),
    quality: MAKE_IT_REAL_PROFILE.quality,
    output_format: MAKE_IT_REAL_PROFILE.outputFormat,
    num_images: MAKE_IT_REAL_PROFILE.images,
    prompt: composeMakeItRealPrompt(request)
  };
}

function flux2TurboEditInput(request: MakeItRealRequest): Readonly<Record<string, unknown>> {
  return {
    image_urls: [request.designDataUrl],
    image_size: {
      width: FLUX2_TURBO_EDIT_PROFILE.width,
      height: FLUX2_TURBO_EDIT_PROFILE.height
    },
    guidance_scale: FLUX2_TURBO_EDIT_PROFILE.guidance,
    enable_safety_checker: FLUX2_TURBO_EDIT_PROFILE.safetyChecker,
    output_format: FLUX2_TURBO_EDIT_PROFILE.outputFormat,
    num_images: FLUX2_TURBO_EDIT_PROFILE.images,
    enable_prompt_expansion: FLUX2_TURBO_EDIT_PROFILE.promptExpansion,
    prompt: composeMakeItRealPrompt(request)
  };
}

const PROFILE_URL_MAX_LENGTH = 2_048;

function requireSafeLoraUrl(value: string | undefined): string {
  if (typeof value !== "string" || value.length < 1 || value.length > PROFILE_URL_MAX_LENGTH ||
    value !== value.trim() || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) {
    throw new ImageLabJobsError("IMAGE_PROFILE_CONFIGURATION_INVALID", 503);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port || url.hash) {
      throw new Error("unsafe URL");
    }
  } catch {
    throw new ImageLabJobsError("IMAGE_PROFILE_CONFIGURATION_INVALID", 503);
  }
  return value;
}

function resolveSubmissionProfile(
  request: FalImageRequest,
  environment: ImageLabEnvironmentRecord
): SubmissionProfile {
  const objectProfileId = environment.IMAGE_LAB_OBJECT_PROFILE_ID ?? OBJECT_FORGE_PROFILE_ID;
  const realiseProfileId = environment.IMAGE_LAB_REALISE_PROFILE_ID ?? MAKE_IT_REAL_PROFILE_ID;
  if (objectProfileId !== OBJECT_FORGE_PROFILE_ID && objectProfileId !== Z_IMAGE_LORA_PROFILE_ID ||
    realiseProfileId !== MAKE_IT_REAL_PROFILE_ID && realiseProfileId !== FLUX2_TURBO_EDIT_PROFILE_ID) {
    throw new ImageLabJobsError("IMAGE_PROFILE_CONFIGURATION_INVALID", 503);
  }

  if (request.stage === "object") {
    if (objectProfileId === Z_IMAGE_LORA_PROFILE_ID) {
      return {
        profileId: Z_IMAGE_LORA_PROFILE_ID,
        modelId: Z_IMAGE_LORA_PROFILE.model,
        width: Z_IMAGE_LORA_PROFILE.width,
        height: Z_IMAGE_LORA_PROFILE.height,
        input: zImageLoraInput(request, requireSafeLoraUrl(environment.IMAGE_LAB_Z_LORA_URL))
      };
    }
    return {
      profileId: OBJECT_FORGE_PROFILE_ID,
      modelId: OBJECT_FORGE_PROFILE.model,
      width: OBJECT_FORGE_PROFILE.width,
      height: OBJECT_FORGE_PROFILE.height,
      input: objectForgeInput(request)
    };
  }

  if (realiseProfileId === FLUX2_TURBO_EDIT_PROFILE_ID) {
    return {
      profileId: FLUX2_TURBO_EDIT_PROFILE_ID,
      modelId: FLUX2_TURBO_EDIT_PROFILE.model,
      width: FLUX2_TURBO_EDIT_PROFILE.width,
      height: FLUX2_TURBO_EDIT_PROFILE.height,
      input: flux2TurboEditInput(request)
    };
  }
  return {
    profileId: MAKE_IT_REAL_PROFILE_ID,
    modelId: MAKE_IT_REAL_PROFILE.model,
    width: MAKE_IT_REAL_PROFILE.width,
    height: MAKE_IT_REAL_PROFILE.height,
    input: makeItRealInput(request)
  };
}

function canonicalRequestHash(request: FalImageRequest, profile: SubmissionProfile): string {
  return createHash("sha256").update(JSON.stringify({
    stage: jobStage(request),
    profileId: profile.profileId,
    modelId: profile.modelId,
    input: profile.input
  }), "utf8").digest("hex");
}

function serviceFailure(signal: AbortSignal): ImageLabJobsError {
  return signal.aborted
    ? new ImageLabJobsError("IMAGE_SERVICE_TIMEOUT", 504)
    : new ImageLabJobsError("IMAGE_SERVICE_UNAVAILABLE", 502);
}

async function readReconcileJobToken(request: Request): Promise<string> {
  const value = await readRequestJson(request);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ImageLabJobsError("INVALID_REQUEST", 400);
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 1 ||
    typeof record.jobToken !== "string" ||
    record.jobToken.length < 1 ||
    record.jobToken.length > JOB_TOKEN_MAX_LENGTH
  ) {
    throw new ImageLabJobsError("INVALID_REQUEST", 400);
  }
  return record.jobToken;
}

const ledgerStage = (stage: ImageLabStage): ImageLabAllowanceStage =>
  stage === "object-forge" ? "object" : "realise";

const remainingAllowance = (snapshot: ImageLabAllowanceSnapshot): {
  object: number;
  realise: number;
} => ({
  object: snapshot.object.remaining,
  realise: snapshot.realise.remaining
});

function ledgerIdentity(
  userId: string,
  stored: ImageLabStoredJob
): TerminalImageLabReservationInput {
  const stage = ledgerStage(stored.stage);
  const operationHash = createHash("sha256")
    .update(userId, "utf8")
    .update("\0")
    .update(stage, "utf8")
    .update("\0")
    .update(stored.id, "utf8")
    .digest("hex");
  return {
    userId,
    stage,
    operationId: `image-job:${operationHash}`,
    jobKey: stored.id,
    requestHash: stored.requestHash
  };
}

async function allowanceCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new ImageLabJobsError("IMAGE_ALLOWANCE_UNAVAILABLE", 503);
  }
}

async function stateCall<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw stateFailure(error);
  }
}

function acceptedJobResponse(
  stored: ImageLabStoredJob,
  snapshot: ImageLabAllowanceSnapshot,
  environment: ReadyImageLabEnvironment,
  nowSeconds: number,
  userId: string
): Response {
  const token = createJobToken({
    jobId: stored.id,
    stage: stored.stage,
    profileId: stored.profileId,
    userId,
    expiresAt: nowSeconds + JOB_LIFETIME_SECONDS
  }, environment.signingSecret);
  return json({
    jobToken: token,
    stage: stored.stage === "object-forge" ? "object" : "realise",
    remaining: remainingAllowance(snapshot)
  }, 202);
}

async function submitJob(
  request: Request,
  url: URL,
  dependencies: ResolvedDependencies,
  environment: ReadyImageLabEnvironment,
  environmentRecord: ImageLabEnvironmentRecord,
  account: AuthenticatedAccountSession,
  nowSeconds: number,
  state: ImageLabJobsState,
  allowances: ImageLabAllowanceStore
): Promise<Response> {
  requireNoQuery(url);
  let parsed: FalImageRequest;
  try {
    parsed = parseFalImageRequest(await readRequestJson(request));
  } catch (error) {
    if (error instanceof ImageLabJobsError) throw error;
    if (error instanceof FalImagePolicyError) {
      throw new ImageLabJobsError(
        error.code === "IMAGE_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_REQUEST",
        error.code === "IMAGE_TOO_LARGE" ? 413 : 400
      );
    }
    throw error;
  }
  const profile = resolveSubmissionProfile(parsed, environmentRecord);
  const stage = jobStage(parsed);
  const identity = { userId: account.identity.userId };
  const reservation = await stateCall(() => state.reserve(identity, {
      idempotencyKey: parsed.idempotencyKey,
      requestHash: canonicalRequestHash(parsed, profile),
      stage,
      profileId: profile.profileId,
      nowSeconds
    }));
  let stored = reservation.stored;
  let allowance: ImageLabAllowanceSnapshot;

  if (stored.state === "reserving") {
    allowance = await allowanceCall(() => allowances.reserve(
      ledgerIdentity(identity.userId, stored)
    ));
    if (allowance.status === "disabled") {
      await stateCall(() => state.markDenied(identity, stored.id));
      throw new ImageLabJobsError("IMAGE_LAB_DISABLED", 503);
    }
    if (allowance.status !== "reserved") {
      await stateCall(() => state.markDenied(identity, stored.id));
      throw new ImageLabJobsError("ALLOWANCE_EXHAUSTED", 429);
    }
    stored = await stateCall(() => state.markReserved(identity, stored.id));
  } else {
    allowance = await allowanceCall(() => allowances.status(identity.userId));
  }

  if (stored.state === "denied") {
    throw new ImageLabJobsError("ALLOWANCE_EXHAUSTED", 429);
  }
  if (stored.state === "refunded") {
    throw new ImageLabJobsError("JOB_FAILED", 422);
  }
  if (stored.state === "submitted" || stored.state === "uncertain" ||
    stored.state === "completed") {
    return acceptedJobResponse(stored, allowance, environment, nowSeconds, identity.userId);
  }

  const claim = await stateCall(() => state.beginSubmission(identity, stored.id));
  stored = claim.stored;
  if (!claim.began) {
    if (stored.state === "submitting") {
      allowance = await allowanceCall(() => allowances.markUncertain(
        ledgerIdentity(identity.userId, stored)
      ));
      stored = await stateCall(() => state.markUncertain(identity, stored.id));
    }
    return acceptedJobResponse(stored, allowance, environment, nowSeconds, identity.userId);
  }

  if (claim.began) {
    const signal = dependencies.createDeadlineSignal("submit");
    let requestId: string;
    try {
      requestId = await submitFalJob({
        fetch: dependencies.fetch,
        falKey: environment.falKey,
        modelId: profile.modelId,
        input: profile.input,
        startTimeoutSeconds: FAL_START_TIMEOUT_SECONDS,
        signal
      });
    } catch (error) {
      if (error instanceof FalQueueError && error.code === "UPSTREAM_ERROR") {
        await allowanceCall(() => allowances.refund(ledgerIdentity(identity.userId, stored)));
        await stateCall(() => state.markRefunded(identity, stored.id));
      } else {
        await allowanceCall(() => allowances.markUncertain(ledgerIdentity(identity.userId, stored)));
        await stateCall(() => state.markUncertain(identity, stored.id));
      }
      throw serviceFailure(signal);
    }
    try {
      stored = await state.attachRequest(identity, stored.id, requestId);
    } catch (error) {
      await allowanceCall(() => allowances.markUncertain(ledgerIdentity(identity.userId, stored)));
      await state.markUncertain(identity, stored.id, requestId).catch(() => undefined);
      throw stateFailure(error);
    }
  }

  return acceptedJobResponse(stored, allowance, environment, nowSeconds, identity.userId);
}

async function requireBoundJob(
  token: string,
  account: AuthenticatedAccountSession,
  environment: ReadyImageLabEnvironment,
  nowSeconds: number,
  state: ImageLabJobsState
): Promise<JobBinding> {
  let job: ImageLabJobToken;
  try {
    job = readJobToken(token, environment.signingSecret, {
      userId: account.identity.userId,
      nowSeconds
    });
  } catch {
    throw new ImageLabJobsError("JOB_NOT_FOUND", 404);
  }
  let stored: ImageLabStoredJob;
  try {
    stored = await state.getJob({ userId: account.identity.userId }, job.jobId);
  } catch (error) {
    throw stateFailure(error);
  }
  if (stored.id !== job.jobId || stored.stage !== job.stage || stored.profileId !== job.profileId) {
    throw new ImageLabJobsError("JOB_NOT_FOUND", 404);
  }
  if (job.stage === "object-forge" && job.profileId === OBJECT_FORGE_PROFILE_ID) {
    return {
      job,
      stored,
      modelId: OBJECT_FORGE_PROFILE.model,
      width: OBJECT_FORGE_PROFILE.width,
      height: OBJECT_FORGE_PROFILE.height
    };
  }
  if (job.stage === "object-forge" && job.profileId === Z_IMAGE_LORA_PROFILE_ID) {
    return {
      job,
      stored,
      modelId: Z_IMAGE_LORA_PROFILE.model,
      width: Z_IMAGE_LORA_PROFILE.width,
      height: Z_IMAGE_LORA_PROFILE.height
    };
  }
  if (job.stage === "make-it-real" && job.profileId === MAKE_IT_REAL_PROFILE_ID) {
    return {
      job,
      stored,
      modelId: MAKE_IT_REAL_PROFILE.model,
      width: MAKE_IT_REAL_PROFILE.width,
      height: MAKE_IT_REAL_PROFILE.height
    };
  }
  if (job.stage === "make-it-real" && job.profileId === LEGACY_MAKE_IT_REAL_PROFILE_ID) {
    return {
      job,
      stored,
      modelId: MAKE_IT_REAL_PROFILE.model,
      width: 1_088,
      height: 608
    };
  }
  if (job.stage === "make-it-real" && job.profileId === FLUX2_TURBO_EDIT_PROFILE_ID) {
    return {
      job,
      stored,
      modelId: FLUX2_TURBO_EDIT_PROFILE.model,
      width: FLUX2_TURBO_EDIT_PROFILE.width,
      height: FLUX2_TURBO_EDIT_PROFILE.height
    };
  }
  throw new ImageLabJobsError("JOB_NOT_FOUND", 404);
}

async function readStatus(
  binding: JobBinding,
  dependencies: ResolvedDependencies,
  environment: ReadyImageLabEnvironment,
  account: AuthenticatedAccountSession,
  state: ImageLabJobsState,
  allowances: ImageLabAllowanceStore
): Promise<Response> {
  const identity = { userId: account.identity.userId };
  const terminalInput = ledgerIdentity(identity.userId, binding.stored);
  if (binding.stored.state === "refunded" || binding.stored.state === "denied") {
    return json({ status: "failed" });
  }
  if (binding.stored.state === "completed") return json({ status: "completed" });
  if (binding.stored.state === "uncertain" && !binding.stored.requestId) {
    return json({ status: "unknown" });
  }
  if (
    binding.stored.state === "reserving" ||
    binding.stored.state === "reserved" ||
    binding.stored.state === "submitting" ||
    !binding.stored.requestId
  ) {
    return json({ status: "queued" });
  }
  const signal = dependencies.createDeadlineSignal("status");
  try {
    const status = await falJobStatus({
      fetch: dependencies.fetch,
      falKey: environment.falKey,
      modelId: binding.modelId,
      requestId: binding.stored.requestId,
      signal
    });
    if (status.status === "failed") {
      await allowanceCall(() => allowances.refund(terminalInput));
      await stateCall(() => state.markRefunded(identity, binding.stored.id));
    }
    return json(status);
  } catch {
    await allowanceCall(() => allowances.markUncertain(terminalInput));
    await stateCall(() => state.markUncertain(
      identity,
      binding.stored.id,
      binding.stored.requestId
    ));
    return json({ status: "unknown" });
  }
}

function isAllowedFalMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
      (host === "fal.media" || host.endsWith(".fal.media"));
  } catch {
    return false;
  }
}

function declaredAssetLengthIsInvalid(response: Response): boolean {
  const value = response.headers.get("content-length");
  return value !== null && (!/^\d+$/.test(value) || Number(value) > IMAGE_LAB_ASSET_MAX_BYTES);
}

async function readAsset(
  binding: JobBinding,
  dependencies: ResolvedDependencies,
  environment: ReadyImageLabEnvironment,
  account: AuthenticatedAccountSession,
  state: ImageLabJobsState,
  allowances: ImageLabAllowanceStore
): Promise<Response> {
  const identity = { userId: account.identity.userId };
  const terminalInput = ledgerIdentity(identity.userId, binding.stored);
  const invalidResult = async (): Promise<never> => {
    await allowanceCall(() => allowances.refund(terminalInput));
    await stateCall(() => state.markRefunded(identity, binding.stored.id));
    throw new ImageLabJobsError("INVALID_IMAGE_RESULT", 502);
  };
  const uncertainResult = async (signal: AbortSignal): Promise<never> => {
    await allowanceCall(() => allowances.markUncertain(terminalInput));
    await stateCall(() => state.markUncertain(
      identity,
      binding.stored.id,
      binding.stored.requestId
    ));
    throw serviceFailure(signal);
  };

  if (binding.stored.state === "refunded" || binding.stored.state === "denied") {
    throw new ImageLabJobsError("JOB_FAILED", 422);
  }
  if (binding.stored.state === "uncertain" && !binding.stored.requestId) {
    throw new ImageLabJobsError("JOB_OUTCOME_UNCERTAIN", 409);
  }
  if (
    binding.stored.state === "reserving" ||
    binding.stored.state === "reserved" ||
    binding.stored.state === "submitting" ||
    !binding.stored.requestId
  ) {
    throw new ImageLabJobsError("JOB_NOT_READY", 409);
  }
  const signal = dependencies.createDeadlineSignal("asset");
  let status;
  try {
    status = await falJobStatus({
      fetch: dependencies.fetch,
      falKey: environment.falKey,
      modelId: binding.modelId,
      requestId: binding.stored.requestId,
      signal
    });
  } catch {
    return uncertainResult(signal);
  }
  if (status.status === "failed") {
    await allowanceCall(() => allowances.refund(terminalInput));
    await stateCall(() => state.markRefunded(identity, binding.stored.id));
    throw new ImageLabJobsError("JOB_FAILED", 422);
  }
  if (status.status !== "completed") throw new ImageLabJobsError("JOB_NOT_READY", 409);

  let mediaUrl: string;
  try {
    mediaUrl = await falImageUrl({
      fetch: dependencies.fetch,
      falKey: environment.falKey,
      modelId: binding.modelId,
      requestId: binding.stored.requestId,
      signal
    });
  } catch (error) {
    if (error instanceof FalQueueError && error.code === "INVALID_RESPONSE") {
      return invalidResult();
    }
    return uncertainResult(signal);
  }
  if (!isAllowedFalMediaUrl(mediaUrl)) return invalidResult();

  let mediaResponse: Response;
  try {
    mediaResponse = await dependencies.fetch(mediaUrl, {
      method: "GET",
      redirect: "error",
      signal,
      headers: { accept: "image/png, image/jpeg, image/webp" }
    });
  } catch {
    return uncertainResult(signal);
  }
  if (!mediaResponse.ok || declaredAssetLengthIsInvalid(mediaResponse)) {
    await mediaResponse.body?.cancel().catch(() => undefined);
    return invalidResult();
  }
  const contentType = parseSafeImageContentType(mediaResponse.headers.get("content-type"));
  if (!contentType || !mediaResponse.body) {
    await mediaResponse.body?.cancel().catch(() => undefined);
    return invalidResult();
  }

  try {
    const { reader, initialChunks, dimensions } = await readValidatedImageHeader(
      mediaResponse.body,
      contentType,
      signal
    );
    if (dimensions.width !== binding.width || dimensions.height !== binding.height) {
      await reader.cancel();
      reader.releaseLock();
      return invalidResult();
    }
    const bytes = new Uint8Array(await new Response(countedImageStream(
      reader,
      initialChunks,
      signal,
      IMAGE_LAB_ASSET_MAX_BYTES
    )).arrayBuffer());
    if (binding.stored.state !== "completed") {
      await allowanceCall(() => allowances.complete(terminalInput));
      await stateCall(() => state.markCompleted(identity, binding.stored.id));
    }
    return new Response(bytes, {
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    if (error instanceof ImageLabJobsError) throw error;
    if (error instanceof OpenverseError) {
      return invalidResult();
    }
    return uncertainResult(signal);
  }
}

export function createImageLabJobsHandler(
  suppliedDependencies: ImageLabJobsDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  const dependencies = resolveDependencies(suppliedDependencies);
  return async (request) => {
    const url = new URL(request.url);
    const isJobs = url.pathname === "/api/image-lab/jobs";
    const isReconcile = url.pathname === "/api/image-lab/jobs/reconcile";
    const isAssets = url.pathname === "/api/image-lab/assets";
    if (!isJobs && !isReconcile && !isAssets) return json({ error: "NOT_FOUND" }, 404);
    if (isJobs && request.method !== "GET" && request.method !== "POST") {
      return methodNotAllowed("GET, POST");
    }
    if (isReconcile && request.method !== "POST") return methodNotAllowed("POST");
    if (isAssets && request.method !== "GET") return methodNotAllowed("GET");
    if (hasUntrustedIdentityHeaders(request)) {
      return json({ error: "INVALID_REQUEST" }, 400);
    }

    let responseCookies: readonly string[] = [];
    try {
      const environmentRecord = dependencies.environment ?? runtimeEnvironment();
      const environment = requireReadyEnvironment(environmentRecord);
      const nowSeconds = Math.floor(dependencies.nowSeconds());
      let accountClient: SupabaseAccountClient | undefined;
      const accountSession = dependencies.resolveSession === undefined
        ? await (() => {
            accountClient = new SupabaseAccountClient(
              parseAccountEnvironment(environmentRecord),
              dependencies.fetch
            );
            return resolveAccountSession(accountClient, parseAccountCookies(request));
          })()
        : await dependencies.resolveSession(request);
      if (!accountSession.authenticated) {
        return json(
          { error: "AUTHENTICATION_REQUIRED" },
          401,
          {},
          accountSession.clearCookies ? expiredAccountCookies() : []
        );
      }
      responseCookies = rotatedAccountCookies(accountSession);
      let state: ImageLabJobsState;
      try {
        state = dependencies.state ?? await defaultImageLabStateService();
      } catch {
        throw new ImageLabJobsError("IMAGE_STATE_UNAVAILABLE", 503);
      }
      const allowances = dependencies.allowances ??
        new SupabaseImageLabAllowanceStore(accountClient ?? new SupabaseAccountClient(
          parseAccountEnvironment(environmentRecord),
          dependencies.fetch
        ));
      let response: Response;
      if (isJobs && request.method === "POST") {
        response = await submitJob(
          request,
          url,
          dependencies,
          environment,
          environmentRecord,
          accountSession,
          nowSeconds,
          state,
          allowances
        );
        return withCookies(response, responseCookies);
      }

      let token: string;
      if (isReconcile) {
        requireNoQuery(url);
        token = await readReconcileJobToken(request);
      } else {
        token = requireJobQuery(url);
      }
      const binding = await requireBoundJob(
        token,
        accountSession,
        environment,
        nowSeconds,
        state
      );
      response = isAssets
        ? await readAsset(
            binding,
            dependencies,
            environment,
            accountSession,
            state,
            allowances
          )
        : await readStatus(
            binding,
            dependencies,
            environment,
            accountSession,
            state,
            allowances
          );
      return withCookies(response, responseCookies);
    } catch (error) {
      if (error instanceof ImageLabJobsError) {
        return withCookies(json({ error: error.code }, error.status), responseCookies);
      }
      if (
        error instanceof AccountConfigurationError ||
        error instanceof SupabaseAccountError ||
        error instanceof ImageLabAllowanceStoreError
      ) {
        return withCookies(
          json({ error: "IMAGE_LAB_UNAVAILABLE" }, 503),
          responseCookies
        );
      }
      return withCookies(json({ error: "INTERNAL_ERROR" }, 500), responseCookies);
    }
  };
}

export default createImageLabJobsHandler();

export const config: Config = {
  path: [
    "/api/image-lab/jobs",
    "/api/image-lab/jobs/reconcile",
    "/api/image-lab/assets"
  ],
  rateLimit: {
    windowLimit: 1_200,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
```

## File: `supabase/functions/advertising-game-backend/handler.ts`

```typescript
const REQUEST_LIMIT = 280 * 1_024;
const RESPONSE_LIMIT = 280 * 1_024;
const AUTHORIZATION_RPC = "/rest/v1/rpc/advertising_game_backend_authorized";
const PROGRESS_RPC = "/rest/v1/rpc/advertising_game_progress_rpc";
const IMAGE_LAB_RPC = "/rest/v1/rpc/advertising_game_image_lab_rpc";
const ADMIN_USERS = "/auth/v1/admin/users";

const PROJECT_URL_PATTERN = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/u;
const MODERN_SECRET_PATTERN = /^sb_secret_[A-Za-z0-9_-]{24,256}$/u;
const GATEWAY_SECRET_PATTERN = /^[A-Za-z0-9_-]{32,256}$/u;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const SYNTHETIC_EMAIL_PATTERN = /^[a-f0-9]{64}@accounts\.admarket\.invalid$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DOCUMENT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const SAFE_OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SESSION_EPOCH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const TEACHER_PLAYTEST_USERNAME = "teacher-playtest";
const ADMIN_USERS_LIMIT = 1_000;
const ADMIN_USERS_RESPONSE_LIMIT = 1_024 * 1_024;

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "cross-origin-resource-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};

export interface AdvertisingGameBackendDependencies {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly fetcher?: typeof fetch;
  readonly randomUUID?: () => string;
}

interface EdgeEnvironment {
  readonly supabaseUrl: string;
  readonly serviceKey: string;
}

class InvalidRequestError extends Error {}
class UpstreamError extends Error {}
class ConfigurationError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

const jsonResponse = (body: unknown, status: number): Response => Response.json(body, {
  status,
  headers: SECURITY_HEADERS
});

const noContent = (): Response => new Response(null, { status: 204, headers: SECURITY_HEADERS });

const decodeBase64Url = (value: string): string => {
  const padded = value.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );
  return atob(padded);
};

const legacyServiceRoleKey = (value: string): boolean => {
  if (value.length < 80 || value.length > 2_048) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/u.test(part))) return false;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]!)) as unknown;
    return isRecord(payload) && payload.role === "service_role";
  } catch {
    return false;
  }
};

const parseEnvironment = (
  environment: Readonly<Record<string, string | undefined>>
): EdgeEnvironment => {
  const supabaseUrl = environment.SUPABASE_URL;
  if (typeof supabaseUrl !== "string" || !PROJECT_URL_PATTERN.test(supabaseUrl)) {
    throw new ConfigurationError();
  }

  let modernKey: unknown;
  try {
    const keys = environment.SUPABASE_SECRET_KEYS === undefined
      ? undefined
      : JSON.parse(environment.SUPABASE_SECRET_KEYS) as unknown;
    modernKey = isRecord(keys) ? keys.default : undefined;
  } catch {
    throw new ConfigurationError();
  }
  const legacyKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  const serviceKey = typeof modernKey === "string" && MODERN_SECRET_PATTERN.test(modernKey)
    ? modernKey
    : typeof legacyKey === "string" && legacyServiceRoleKey(legacyKey)
      ? legacyKey
      : undefined;
  if (serviceKey === undefined) throw new ConfigurationError();
  return { supabaseUrl, serviceKey };
};

const serviceHeaders = (serviceKey: string): Record<string, string> => {
  const headers: Record<string, string> = {
    apikey: serviceKey,
    "content-type": "application/json"
  };
  if (!serviceKey.startsWith("sb_secret_")) headers.authorization = `Bearer ${serviceKey}`;
  return headers;
};

const readBoundedBytes = async (
  body: ReadableStream<Uint8Array> | null,
  maximumBytes: number
): Promise<Uint8Array> => {
  if (body === null) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new InvalidRequestError();
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

const parseJsonBytes = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new InvalidRequestError();
  }
};

const safeFetch = async (
  fetcher: typeof fetch,
  url: string,
  init: RequestInit
): Promise<Response> => {
  try {
    const response = await fetcher(url, { ...init, redirect: "error" });
    if (response.redirected) throw new UpstreamError();
    return response;
  } catch {
    throw new UpstreamError();
  }
};

const upstreamJson = async (response: Response, limit = RESPONSE_LIMIT): Promise<unknown> => {
  if (!response.ok) throw new UpstreamError();
  try {
    return parseJsonBytes(await readBoundedBytes(response.body, limit));
  } catch {
    throw new UpstreamError();
  }
};

const gatewayAuthorised = async (
  environment: EdgeEnvironment,
  gatewaySecret: string,
  fetcher: typeof fetch
): Promise<boolean> => {
  const response = await safeFetch(fetcher, `${environment.supabaseUrl}${AUTHORIZATION_RPC}`, {
    method: "POST",
    headers: serviceHeaders(environment.serviceKey),
    body: JSON.stringify({ p_candidate: gatewaySecret })
  });
  const result = await upstreamJson(response, 16);
  if (typeof result !== "boolean") throw new UpstreamError();
  return result;
};

interface CreateUserInput {
  readonly operation: "create_user";
  readonly email: string;
  readonly password: string;
  readonly username: string;
}

const parseCreateUser = (record: Record<string, unknown>): CreateUserInput => {
  if (!hasExactKeys(record, ["operation", "email", "password", "username"]) ||
    record.operation !== "create_user" ||
    typeof record.email !== "string" || !SYNTHETIC_EMAIL_PATTERN.test(record.email) ||
    typeof record.username !== "string" || !USERNAME_PATTERN.test(record.username) ||
    record.username === TEACHER_PLAYTEST_USERNAME ||
    typeof record.password !== "string" || record.password.includes("\0") ||
    byteLength(record.password) < 8 || byteLength(record.password) > 128) {
    throw new InvalidRequestError();
  }
  return {
    operation: "create_user",
    email: record.email,
    password: record.password,
    username: record.username
  };
};

type AccountAdminOperation =
  | { readonly operation: "list_users" }
  | {
      readonly operation: "find_user";
      readonly email: string;
      readonly username: string;
    }
  | {
      readonly operation: "replace_password";
      readonly email: string;
      readonly username: string;
      readonly password: string;
    }
  | {
      readonly operation: "ensure_user";
      readonly email: string;
      readonly username: typeof TEACHER_PLAYTEST_USERNAME;
      readonly password: string;
    };

interface AccountAdminRecord {
  readonly userId: string;
  readonly username: string;
  readonly createdAt: string;
  readonly lastSignInAt: string | null;
}

interface ParsedAdminUser {
  readonly record: AccountAdminRecord;
  readonly email: string;
}

const validPassword = (value: unknown): value is string =>
  typeof value === "string" &&
  !value.includes("\0") &&
  byteLength(value) >= 8 &&
  byteLength(value) <= 128;

const parseAccountAdminOperation = (
  record: Record<string, unknown>
): AccountAdminOperation => {
  if (record.operation === "list_users") {
    if (!hasExactKeys(record, ["operation"])) throw new InvalidRequestError();
    return { operation: "list_users" };
  }
  if (
    record.operation !== "find_user" &&
    record.operation !== "replace_password" &&
    record.operation !== "ensure_user"
  ) {
    throw new InvalidRequestError();
  }
  const includesPassword = record.operation !== "find_user";
  const keys = includesPassword
    ? ["operation", "email", "username", "password"]
    : ["operation", "email", "username"];
  if (
    !hasExactKeys(record, keys) ||
    typeof record.email !== "string" ||
    !SYNTHETIC_EMAIL_PATTERN.test(record.email) ||
    typeof record.username !== "string" ||
    !USERNAME_PATTERN.test(record.username) ||
    (includesPassword && !validPassword(record.password))
  ) {
    throw new InvalidRequestError();
  }
  if (
    (record.operation === "ensure_user") !==
    (record.username === TEACHER_PLAYTEST_USERNAME)
  ) {
    throw new InvalidRequestError();
  }
  if (
    record.operation === "replace_password" &&
    record.username === TEACHER_PLAYTEST_USERNAME
  ) {
    throw new InvalidRequestError();
  }
  return record as AccountAdminOperation;
};

const validIsoTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
  Number.isFinite(Date.parse(value));

const parseAdminUser = (value: unknown): ParsedAdminUser | null => {
  if (!isRecord(value)) return null;
  const metadata = isRecord(value.app_metadata) ? value.app_metadata : null;
  const username = metadata?.advertising_game_username;
  const lastSignInAt = value.last_sign_in_at;
  if (
    typeof value.id !== "string" ||
    !UUID_PATTERN.test(value.id) ||
    typeof value.email !== "string" ||
    !SYNTHETIC_EMAIL_PATTERN.test(value.email) ||
    typeof username !== "string" ||
    !USERNAME_PATTERN.test(username) ||
    !validIsoTimestamp(value.created_at) ||
    (lastSignInAt !== null && !validIsoTimestamp(lastSignInAt))
  ) {
    return null;
  }
  return {
    email: value.email,
    record: {
      userId: value.id,
      username,
      createdAt: value.created_at,
      lastSignInAt
    }
  };
};

const listAdminUsers = async (
  environment: EdgeEnvironment,
  fetcher: typeof fetch
): Promise<readonly ParsedAdminUser[]> => {
  const response = await safeFetch(
    fetcher,
    `${environment.supabaseUrl}${ADMIN_USERS}?page=1&per_page=${ADMIN_USERS_LIMIT}`,
    {
      method: "GET",
      headers: serviceHeaders(environment.serviceKey)
    }
  );
  const body = await upstreamJson(response, ADMIN_USERS_RESPONSE_LIMIT);
  if (!isRecord(body) || !Array.isArray(body.users) ||
    body.users.length >= ADMIN_USERS_LIMIT ||
    (body.next_page !== undefined && body.next_page !== null && body.next_page !== 0)) {
    throw new UpstreamError();
  }

  const result: ParsedAdminUser[] = [];
  for (const candidate of body.users) {
    const parsed = parseAdminUser(candidate);
    if (parsed !== null) {
      result.push(parsed);
      continue;
    }
    if (isRecord(candidate)) {
      const metadata = isRecord(candidate.app_metadata) ? candidate.app_metadata : null;
      if (
        (typeof candidate.email === "string" &&
          SYNTHETIC_EMAIL_PATTERN.test(candidate.email)) ||
        (typeof metadata?.advertising_game_username === "string" &&
          USERNAME_PATTERN.test(metadata.advertising_game_username))
      ) {
        throw new UpstreamError();
      }
    }
  }
  const identifiers = new Set<string>();
  for (const user of result) {
    for (const identity of [
      `id:${user.record.userId}`,
      `email:${user.email}`,
      `username:${user.record.username}`
    ]) {
      if (identifiers.has(identity)) throw new UpstreamError();
      identifiers.add(identity);
    }
  }
  return result;
};

const findAdminUser = (
  users: readonly ParsedAdminUser[],
  email: string,
  username: string
): ParsedAdminUser | null => {
  const matches = users.filter((user) =>
    user.email === email && user.record.username === username
  );
  if (
    matches.length > 1 ||
    users.some((user) =>
      (user.email === email || user.record.username === username) &&
      (user.email !== email || user.record.username !== username))
  ) {
    throw new UpstreamError();
  }
  return matches[0] ?? null;
};

const accountAdmin = async (
  input: AccountAdminOperation,
  environment: EdgeEnvironment,
  fetcher: typeof fetch,
  randomUUID: () => string
): Promise<Response> => {
  const users = await listAdminUsers(environment, fetcher);
  if (input.operation === "list_users") {
    return jsonResponse({
      users: users
        .filter(({ record }) => record.username !== TEACHER_PLAYTEST_USERNAME)
        .map(({ record }) => record)
        .sort((left, right) => left.username.localeCompare(right.username))
    }, 200);
  }

  const current = findAdminUser(users, input.email, input.username);
  if (input.operation === "find_user") {
    return jsonResponse({ user: current?.record ?? null }, 200);
  }
  if (input.operation === "ensure_user") {
    if (current !== null) return jsonResponse({ user: current.record }, 200);
    const response = await safeFetch(fetcher, `${environment.supabaseUrl}${ADMIN_USERS}`, {
      method: "POST",
      headers: serviceHeaders(environment.serviceKey),
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        email_confirm: true,
        app_metadata: { advertising_game_username: input.username }
      })
    });
    const created = parseAdminUser(await upstreamJson(response));
    if (
      created === null ||
      created.email !== input.email ||
      created.record.username !== input.username
    ) {
      throw new UpstreamError();
    }
    return jsonResponse({ user: created.record }, 200);
  }
  if (current === null) {
    return jsonResponse({ error: "ACCOUNT_NOT_FOUND" }, 404);
  }
  const epoch = randomUUID();
  if (!SESSION_EPOCH_PATTERN.test(epoch)) throw new UpstreamError();
  const response = await safeFetch(
    fetcher,
    `${environment.supabaseUrl}${ADMIN_USERS}/${current.record.userId}`,
    {
      method: "PUT",
      headers: serviceHeaders(environment.serviceKey),
      body: JSON.stringify({
        password: input.password,
        app_metadata: {
          advertising_game_username: input.username,
          advertising_game_session_epoch: epoch
        }
      })
    }
  );
  if (!response.ok) throw new UpstreamError();
  return noContent();
};

interface ProgressInput {
  readonly userId: string;
  readonly operation: "list" | "load" | "save" | "reset";
  readonly documentId?: string;
  readonly schema: "advertising-game-progress";
  readonly version: 1;
  readonly expectedRevision?: number;
  readonly document?: Record<string, unknown>;
}

const parseProgress = (record: Record<string, unknown>): ProgressInput => {
  if (!hasExactKeys(record, ["operation", "input"]) || record.operation !== "progress" ||
    !isRecord(record.input)) throw new InvalidRequestError();
  const input = record.input;
  if (typeof input.userId !== "string" || !UUID_PATTERN.test(input.userId) ||
    input.schema !== "advertising-game-progress" || input.version !== 1 ||
    (input.operation !== "list" && input.operation !== "load" &&
      input.operation !== "save" && input.operation !== "reset")) {
    throw new InvalidRequestError();
  }

  const expectedKeys = input.operation === "list"
    ? ["userId", "operation", "schema", "version"]
    : input.operation === "load"
      ? ["userId", "operation", "documentId", "schema", "version"]
      : input.operation === "reset"
        ? ["userId", "operation", "schema", "version"]
        : ["userId", "operation", "documentId", "schema", "version", "expectedRevision", "document"];
  if (!hasExactKeys(input, expectedKeys)) throw new InvalidRequestError();
  if (input.operation !== "list" && input.operation !== "reset" &&
    (typeof input.documentId !== "string" || !DOCUMENT_ID_PATTERN.test(input.documentId))) {
    throw new InvalidRequestError();
  }
  if (input.operation === "save" &&
    (typeof input.expectedRevision !== "number" ||
      !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
      !isRecord(input.document))) {
    throw new InvalidRequestError();
  }
  return input as unknown as ProgressInput;
};

type ImageLabLedgerOperation =
  | "status"
  | "global_status"
  | "set_global"
  | "set"
  | "add"
  | "revoke"
  | "reserve"
  | "complete"
  | "refund"
  | "mark_uncertain"
  | "list";

interface ImageLabLedgerInput {
  readonly userId?: string;
  readonly ledgerOperation: ImageLabLedgerOperation;
  readonly stage?: "object" | "realise";
  readonly amount?: number;
  readonly operationId: string;
  readonly jobKey?: string;
  readonly requestHash: string;
}

interface ImageLabCounts {
  readonly granted: number;
  readonly consumed: number;
  readonly reserved: number;
  readonly remaining: number;
}

interface ImageLabSnapshot {
  readonly status: "available" | "disabled" | "reserved" | "completed" | "refunded" | "uncertain";
  readonly enabled: boolean;
  readonly object: ImageLabCounts;
  readonly realise: ImageLabCounts;
}

interface ImageLabPrivateAccount {
  readonly userId: string;
  readonly object: ImageLabCounts;
  readonly realise: ImageLabCounts;
}

const imageLabBaseKeys = ["ledgerOperation", "operationId", "requestHash"] as const;

const parseImageLab = (record: Record<string, unknown>): ImageLabLedgerInput => {
  if (!hasExactKeys(record, ["operation", "input"]) ||
    record.operation !== "image_lab" || !isRecord(record.input)) {
    throw new InvalidRequestError();
  }
  const input = record.input;
  const ledgerOperation = input.ledgerOperation;
  if (
    ledgerOperation !== "status" &&
    ledgerOperation !== "global_status" &&
    ledgerOperation !== "set_global" &&
    ledgerOperation !== "set" &&
    ledgerOperation !== "add" &&
    ledgerOperation !== "revoke" &&
    ledgerOperation !== "reserve" &&
    ledgerOperation !== "complete" &&
    ledgerOperation !== "refund" &&
    ledgerOperation !== "mark_uncertain" &&
    ledgerOperation !== "list"
  ) throw new InvalidRequestError();
  if (
    typeof input.operationId !== "string" ||
    !SAFE_OPERATION_ID_PATTERN.test(input.operationId) ||
    typeof input.requestHash !== "string" ||
    !SHA256_PATTERN.test(input.requestHash)
  ) throw new InvalidRequestError();

  const accountMutation = ledgerOperation === "set" ||
    ledgerOperation === "add" ||
    ledgerOperation === "revoke";
  const reservationMutation = ledgerOperation === "reserve" ||
    ledgerOperation === "complete" ||
    ledgerOperation === "refund" ||
    ledgerOperation === "mark_uncertain";
  const expectedKeys = ledgerOperation === "status"
    ? [...imageLabBaseKeys, "userId"]
    : ledgerOperation === "global_status" || ledgerOperation === "list"
      ? [...imageLabBaseKeys]
      : ledgerOperation === "set_global"
        ? input.stage === undefined
          ? [...imageLabBaseKeys, "amount"]
          : [...imageLabBaseKeys, "stage", "amount"]
        : accountMutation
          ? [...imageLabBaseKeys, "userId", "stage", "amount"]
          : [...imageLabBaseKeys, "userId", "stage", "amount", "jobKey"];
  if (!hasExactKeys(input, expectedKeys)) throw new InvalidRequestError();

  if (
    (ledgerOperation === "status" || accountMutation || reservationMutation) &&
    (typeof input.userId !== "string" || !UUID_PATTERN.test(input.userId))
  ) throw new InvalidRequestError();
  if (
    (accountMutation || reservationMutation ||
      (ledgerOperation === "set_global" && input.stage !== undefined)) &&
    input.stage !== "object" &&
    input.stage !== "realise"
  ) throw new InvalidRequestError();
  if (
    ledgerOperation === "set_global" &&
    input.stage === undefined &&
    input.amount !== 0 &&
    input.amount !== 1
  ) throw new InvalidRequestError();
  if (
    (ledgerOperation === "set_global" || accountMutation) &&
    (
      typeof input.amount !== "number" ||
      !Number.isInteger(input.amount) ||
      input.amount < (ledgerOperation === "add" || ledgerOperation === "revoke" ? 1 : 0) ||
      input.amount > 100
    )
  ) throw new InvalidRequestError();
  if (
    reservationMutation &&
    (
      input.amount !== 1 ||
      typeof input.jobKey !== "string" ||
      !SAFE_OPERATION_ID_PATTERN.test(input.jobKey)
    )
  ) throw new InvalidRequestError();
  return input as unknown as ImageLabLedgerInput;
};

const parseImageLabCounts = (value: unknown): ImageLabCounts => {
  if (!isRecord(value) ||
    !hasExactKeys(value, ["granted", "consumed", "reserved", "remaining"])) {
    throw new UpstreamError();
  }
  const { granted, consumed, reserved, remaining } = value;
  if (
    ![granted, consumed, reserved, remaining].every((count) =>
      typeof count === "number" &&
      Number.isInteger(count) &&
      count >= 0 &&
      count <= 100
    ) ||
    (consumed as number) + (reserved as number) > (granted as number) ||
    remaining !== (granted as number) - (consumed as number) - (reserved as number)
  ) throw new UpstreamError();
  return {
    granted: granted as number,
    consumed: consumed as number,
    reserved: reserved as number,
    remaining: remaining as number
  };
};

const parseImageLabSnapshotFields = (
  value: Record<string, unknown>
): ImageLabSnapshot => {
  if (
    value.status !== "available" &&
    value.status !== "disabled" &&
    value.status !== "reserved" &&
    value.status !== "completed" &&
    value.status !== "refunded" &&
    value.status !== "uncertain"
  ) throw new UpstreamError();
  if (typeof value.enabled !== "boolean" ||
    (value.status === "disabled" && value.enabled)) throw new UpstreamError();
  return {
    status: value.status,
    enabled: value.enabled,
    object: parseImageLabCounts(value.object),
    realise: parseImageLabCounts(value.realise)
  };
};

const parseImageLabSnapshot = (value: unknown): ImageLabSnapshot => {
  if (!isRecord(value) ||
    !hasExactKeys(value, ["status", "enabled", "object", "realise"])) {
    throw new UpstreamError();
  }
  return parseImageLabSnapshotFields(value);
};

const parseImageLabList = (
  value: unknown
): { readonly snapshot: ImageLabSnapshot; readonly accounts: readonly ImageLabPrivateAccount[] } => {
  if (!isRecord(value) ||
    !hasExactKeys(value, ["status", "enabled", "object", "realise", "accounts"]) ||
    !Array.isArray(value.accounts) ||
    value.accounts.length > ADMIN_USERS_LIMIT) {
    throw new UpstreamError();
  }
  const accounts = value.accounts.map((candidate): ImageLabPrivateAccount => {
    if (!isRecord(candidate) ||
      !hasExactKeys(candidate, ["userId", "object", "realise"]) ||
      typeof candidate.userId !== "string" ||
      !UUID_PATTERN.test(candidate.userId)) throw new UpstreamError();
    return {
      userId: candidate.userId,
      object: parseImageLabCounts(candidate.object),
      realise: parseImageLabCounts(candidate.realise)
    };
  });
  if (new Set(accounts.map(({ userId }) => userId)).size !== accounts.length) {
    throw new UpstreamError();
  }
  return {
    snapshot: parseImageLabSnapshotFields(value),
    accounts
  };
};

const createUser = async (
  input: CreateUserInput,
  environment: EdgeEnvironment,
  fetcher: typeof fetch
): Promise<Response> => {
  const response = await safeFetch(fetcher, `${environment.supabaseUrl}${ADMIN_USERS}`, {
    method: "POST",
    headers: serviceHeaders(environment.serviceKey),
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { advertising_game_username: input.username }
    })
  });
  if (response.ok) return noContent();
  if (response.status === 409) return jsonResponse({ error: "USERNAME_UNAVAILABLE" }, 409);
  if (response.status === 422) {
    let body: unknown;
    try {
      body = parseJsonBytes(await readBoundedBytes(response.body, 8 * 1_024));
    } catch {
      throw new UpstreamError();
    }
    if (isRecord(body) && (body.code === "email_exists" || body.code === "user_already_exists")) {
      return jsonResponse({ error: "USERNAME_UNAVAILABLE" }, 409);
    }
  }
  throw new UpstreamError();
};

const progress = async (
  input: ProgressInput,
  environment: EdgeEnvironment,
  fetcher: typeof fetch
): Promise<Response> => {
  const response = await safeFetch(fetcher, `${environment.supabaseUrl}${PROGRESS_RPC}`, {
    method: "POST",
    headers: serviceHeaders(environment.serviceKey),
    body: JSON.stringify({
      p_user_id: input.userId,
      p_operation: input.operation,
      p_document_id: input.documentId ?? null,
      p_document_schema: input.schema,
      p_schema_version: input.version,
      ...(input.expectedRevision === undefined
        ? {}
        : { p_expected_revision: input.expectedRevision }),
      ...(input.document === undefined ? {} : { p_document: input.document })
    })
  });
  const result = await upstreamJson(response);
  if (!isRecord(result) || typeof result.status !== "string") throw new UpstreamError();
  return jsonResponse(result, 200);
};

const imageLab = async (
  input: ImageLabLedgerInput,
  environment: EdgeEnvironment,
  fetcher: typeof fetch
): Promise<Response> => {
  const response = await safeFetch(fetcher, `${environment.supabaseUrl}${IMAGE_LAB_RPC}`, {
    method: "POST",
    headers: serviceHeaders(environment.serviceKey),
    body: JSON.stringify({
      p_user_id: input.userId ?? null,
      p_operation: input.ledgerOperation,
      p_stage: input.stage ?? null,
      p_amount: input.amount ?? null,
      p_operation_id: input.operationId,
      p_job_key: input.jobKey ?? null,
      p_request_hash: input.requestHash
    })
  });
  const result = await upstreamJson(response);
  if (input.ledgerOperation !== "list") {
    return jsonResponse(parseImageLabSnapshot(result), 200);
  }

  const ledger = parseImageLabList(result);
  const pairUsers = (await listAdminUsers(environment, fetcher))
    .filter(({ record }) => record.username !== TEACHER_PLAYTEST_USERNAME);
  const pairById = new Map(pairUsers.map((user) => [user.record.userId, user] as const));
  if (ledger.accounts.some(({ userId }) => !pairById.has(userId))) {
    throw new UpstreamError();
  }
  const allowanceById = new Map(ledger.accounts.map((account) => [account.userId, account] as const));
  const zero: ImageLabCounts = {
    granted: 0,
    consumed: 0,
    reserved: 0,
    remaining: 0
  };
  return jsonResponse({
    ...ledger.snapshot,
    accounts: pairUsers
      .map(({ record }) => {
        const allowance = allowanceById.get(record.userId);
        return {
          alias: record.username,
          object: allowance?.object ?? zero,
          realise: allowance?.realise ?? zero
        };
      })
      .sort((left, right) => left.alias.localeCompare(right.alias))
  }, 200);
};

export function createAdvertisingGameBackendHandler(
  dependencies: AdvertisingGameBackendDependencies = {}
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      if (request.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
      const url = new URL(request.url);
      if (url.search !== "" || url.hash !== "") throw new InvalidRequestError();
      if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
        "application/json") throw new InvalidRequestError();
      const declaredLength = request.headers.get("content-length");
      if (declaredLength !== null &&
        (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > REQUEST_LIMIT)) {
        throw new InvalidRequestError();
      }

      const gatewaySecret = request.headers.get("x-advertising-game-gateway-secret");
      if (gatewaySecret === null || !GATEWAY_SECRET_PATTERN.test(gatewaySecret)) {
        return jsonResponse({ error: "AUTHENTICATION_REQUIRED" }, 401);
      }
      const environment = parseEnvironment(dependencies.environment ?? {});
      const fetcher = dependencies.fetcher ?? fetch;
      if (!await gatewayAuthorised(environment, gatewaySecret, fetcher)) {
        return jsonResponse({ error: "AUTHENTICATION_REQUIRED" }, 401);
      }

      const body = parseJsonBytes(await readBoundedBytes(request.body, REQUEST_LIMIT));
      if (!isRecord(body)) throw new InvalidRequestError();
      if (body.operation === "create_user") {
        return await createUser(parseCreateUser(body), environment, fetcher);
      }
      if (body.operation === "progress") {
        return await progress(parseProgress(body), environment, fetcher);
      }
      if (body.operation === "image_lab") {
        return await imageLab(parseImageLab(body), environment, fetcher);
      }
      if (
        body.operation === "list_users" ||
        body.operation === "find_user" ||
        body.operation === "replace_password" ||
        body.operation === "ensure_user"
      ) {
        return await accountAdmin(
          parseAccountAdminOperation(body),
          environment,
          fetcher,
          dependencies.randomUUID ?? (() => crypto.randomUUID())
        );
      }
      throw new InvalidRequestError();
    } catch (error) {
      if (error instanceof InvalidRequestError) return jsonResponse({ error: "INVALID_REQUEST" }, 400);
      return jsonResponse({ error: "BACKEND_UNAVAILABLE" }, 503);
    }
  };
}
```

## File: `web/src/app/app-route.ts`

```typescript
export type AdvertisingGameRoute =
  | { readonly kind: "redirect"; readonly location: "/student" }
  | { readonly kind: "student" }
  | { readonly kind: "teacher-dashboard" }
  | { readonly kind: "teacher-playtest" }
  | { readonly kind: "not-found" };

export interface AdvertisingGameRouteActions {
  readonly replace: (location: "/student") => void;
  readonly bootStudent: () => void;
  readonly bootTeacherDashboard: () => void;
  readonly bootTeacherPlaytest: () => void;
  readonly renderNotFound: () => void;
}

function removeOneTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

export function resolveAdvertisingGameRoute(pathname: string): AdvertisingGameRoute {
  const normalised = removeOneTrailingSlash(pathname);
  switch (normalised) {
    case "/":
      return { kind: "redirect", location: "/student" };
    case "/student":
      return { kind: "student" };
    case "/teacher":
      return { kind: "teacher-dashboard" };
    case "/teacher/playtest":
      return { kind: "teacher-playtest" };
    default:
      return { kind: "not-found" };
  }
}

export function runAdvertisingGameRoute(
  pathname: string,
  actions: AdvertisingGameRouteActions
): AdvertisingGameRoute {
  const route = resolveAdvertisingGameRoute(pathname);
  switch (route.kind) {
    case "redirect":
      actions.replace(route.location);
      break;
    case "student":
      actions.bootStudent();
      break;
    case "teacher-dashboard":
      actions.bootTeacherDashboard();
      break;
    case "teacher-playtest":
      actions.bootTeacherPlaytest();
      break;
    case "not-found":
      actions.renderNotFound();
      break;
  }
  return route;
}
```

## File: `web/src/teacher/teacher-client.ts`

```typescript
export interface TeacherPairSummary {
  readonly username: string;
  readonly createdAt: string;
  readonly lastSignInAt: string | null;
}

export interface TeacherImageLabCounts {
  readonly granted: number;
  readonly consumed: number;
  readonly reserved: number;
  readonly remaining: number;
}

export interface TeacherImageLabAccount {
  readonly alias: string;
  readonly object: TeacherImageLabCounts;
  readonly realise: TeacherImageLabCounts;
}

export interface TeacherImageLabOverview {
  readonly enabled: boolean;
  readonly defaults: {
    readonly object: number;
    readonly realise: number;
  };
  readonly accounts: readonly TeacherImageLabAccount[];
}

export interface TeacherImageLabGlobalResult {
  readonly status: "updated";
  readonly operationId: string;
  readonly operation: "global";
  readonly enabled: boolean;
  readonly defaults: {
    readonly object: number;
    readonly realise: number;
  };
}

export interface TeacherImageLabAccountResult {
  readonly status: "updated";
  readonly operationId: string;
  readonly operation: "set" | "add" | "revoke";
  readonly alias: string;
  readonly account: TeacherImageLabAccount;
}

export interface TeacherImageLabBatchResult {
  readonly status: "updated";
  readonly operationId: string;
  readonly operation: "batch-add";
  readonly aliases: readonly string[];
  readonly accounts: readonly TeacherImageLabAccount[];
}

interface TeacherImageLabAccountMutationInput {
  readonly operationId: string;
  readonly alias: string;
  readonly object: number;
  readonly realise: number;
}

export interface TeacherClient {
  session(): Promise<{ authenticated: boolean }>;
  login(password: string): Promise<void>;
  logout(): Promise<void>;
  listAccounts(): Promise<readonly TeacherPairSummary[]>;
  createAccount(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<TeacherPairSummary>;
  replacePassword(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<void>;
  resetAccount(input: {
    operationId: string;
    username: string;
    confirmation: string;
  }): Promise<void>;
  imageLabStatus(): Promise<TeacherImageLabOverview>;
  setImageLabGlobal(input: {
    operationId: string;
    enabled: boolean;
    objectDefault: number;
    realiseDefault: number;
  }): Promise<TeacherImageLabGlobalResult>;
  setImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult>;
  addImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult>;
  revokeImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult>;
  batchAddImageLab(input: {
    operationId: string;
    aliases: readonly string[];
    object: number;
    realise: number;
  }): Promise<TeacherImageLabBatchResult>;
}

export class TeacherClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryable = false,
    readonly refreshRequired = false
  ) {
    super(code);
    this.name = "TeacherClientError";
  }
}

interface HttpTeacherClientOptions {
  readonly fetcher?: typeof fetch;
  readonly delay?: (milliseconds: number) => Promise<void>;
  readonly timeoutMilliseconds?: number;
}

const RESPONSE_LIMIT = 64 * 1_024;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (record: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
};

const validIsoTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
  Number.isFinite(Date.parse(value));

const parseSummary = (value: unknown): TeacherPairSummary => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["username", "createdAt", "lastSignInAt"]) ||
    typeof value.username !== "string" ||
    !USERNAME_PATTERN.test(value.username) ||
    !validIsoTimestamp(value.createdAt) ||
    (value.lastSignInAt !== null && !validIsoTimestamp(value.lastSignInAt))
  ) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  return {
    username: value.username,
    createdAt: value.createdAt,
    lastSignInAt: value.lastSignInAt
  };
};

const validAllowanceAmount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 100;

const parseImageLabCounts = (value: unknown): TeacherImageLabCounts => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["granted", "consumed", "reserved", "remaining"]) ||
    !validAllowanceAmount(value.granted) ||
    !validAllowanceAmount(value.consumed) ||
    !validAllowanceAmount(value.reserved) ||
    !validAllowanceAmount(value.remaining) ||
    value.consumed + value.reserved > value.granted ||
    value.remaining !== value.granted - value.consumed - value.reserved
  ) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  return {
    granted: value.granted,
    consumed: value.consumed,
    reserved: value.reserved,
    remaining: value.remaining
  };
};

const parseImageLabAccount = (value: unknown): TeacherImageLabAccount => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["alias", "object", "realise"]) ||
    typeof value.alias !== "string" ||
    !USERNAME_PATTERN.test(value.alias) ||
    value.alias === "teacher-playtest"
  ) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  return {
    alias: value.alias,
    object: parseImageLabCounts(value.object),
    realise: parseImageLabCounts(value.realise)
  };
};

const parseImageLabDefaults = (
  value: unknown
): TeacherImageLabOverview["defaults"] => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["object", "realise"]) ||
    !validAllowanceAmount(value.object) ||
    !validAllowanceAmount(value.realise)
  ) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  return { object: value.object, realise: value.realise };
};

const parseImageLabOverview = (value: unknown): TeacherImageLabOverview => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["enabled", "defaults", "accounts"]) ||
    typeof value.enabled !== "boolean" ||
    !Array.isArray(value.accounts) ||
    value.accounts.length > 1_000
  ) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  const accounts = value.accounts.map(parseImageLabAccount);
  if (new Set(accounts.map(({ alias }) => alias)).size !== accounts.length) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  return {
    enabled: value.enabled,
    defaults: parseImageLabDefaults(value.defaults),
    accounts: accounts.sort((left, right) => left.alias.localeCompare(right.alias))
  };
};

const readBoundedJson = async (response: Response): Promise<unknown> => {
  if (response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/json") {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > RESPONSE_LIMIT)) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  if (response.body === null) throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > RESPONSE_LIMIT) {
      await reader.cancel();
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
};

const responseError = async (response: Response): Promise<TeacherClientError> => {
  let code = "TEACHER_UNAVAILABLE";
  let retryable = response.status >= 500 || response.status === 429;
  let refreshRequired = false;
  try {
    const value = await readBoundedJson(response);
    if (isRecord(value) && typeof value.error === "string" &&
      /^[A-Z][A-Z0-9_]{1,63}$/u.test(value.error)) {
      code = value.error;
    }
    if (isRecord(value) && typeof value.retryable === "boolean") {
      retryable = value.retryable;
    }
    if (isRecord(value) && typeof value.refreshRequired === "boolean") {
      refreshRequired = value.refreshRequired;
    }
  } catch {
    // A bounded generic error is safer than reflecting an invalid upstream body.
  }
  return new TeacherClientError(code, response.status, retryable, refreshRequired);
};

export class HttpTeacherClient implements TeacherClient {
  readonly #fetcher: typeof fetch;
  readonly #delay: (milliseconds: number) => Promise<void>;
  readonly #timeoutMilliseconds: number;

  constructor(options: HttpTeacherClientOptions = {}) {
    this.#fetcher = options.fetcher ?? fetch;
    this.#delay = options.delay ?? ((milliseconds) =>
      new Promise((resolve) => window.setTimeout(resolve, milliseconds)));
    this.#timeoutMilliseconds = options.timeoutMilliseconds ?? 8_000;
    if (
      !Number.isInteger(this.#timeoutMilliseconds) ||
      this.#timeoutMilliseconds < 1_000 ||
      this.#timeoutMilliseconds > 30_000
    ) {
      throw new Error("Teacher request timeout is invalid");
    }
  }

  async session(): Promise<{ authenticated: boolean }> {
    const value = await this.#requestJson("/api/teacher/session", "GET");
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["authenticated"]) ||
      typeof value.authenticated !== "boolean"
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return { authenticated: value.authenticated };
  }

  async login(password: string): Promise<void> {
    const value = await this.#requestJson("/api/teacher/login", "POST", { password });
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["authenticated"]) ||
      value.authenticated !== true
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
  }

  async logout(): Promise<void> {
    await this.#requestNoContent("/api/teacher/logout", "POST");
  }

  async listAccounts(): Promise<readonly TeacherPairSummary[]> {
    const value = await this.#requestJson("/api/teacher/accounts", "GET");
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["accounts"]) ||
      !Array.isArray(value.accounts) ||
      value.accounts.length > 1_000
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    const accounts = value.accounts.map(parseSummary);
    if (
      new Set(accounts.map(({ username }) => username)).size !== accounts.length
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return accounts.sort((left, right) => left.username.localeCompare(right.username));
  }

  async createAccount(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<TeacherPairSummary> {
    const value = await this.#requestJson("/api/teacher/accounts", "POST", {
      schema: "ad-market-teacher-account-create",
      version: 1,
      operationId: input.operationId,
      username: input.username,
      password: input.password
    });
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["status", "operationId", "account"]) ||
      value.status !== "created" ||
      value.operationId !== input.operationId
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return parseSummary(value.account);
  }

  async replacePassword(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<void> {
    const value = await this.#requestJson(
      `/api/teacher/accounts/${encodeURIComponent(input.username)}/password`,
      "PUT",
      {
        schema: "ad-market-teacher-password-replace",
        version: 1,
        operationId: input.operationId,
        password: input.password
      }
    );
    this.#assertMutationResult(value, "password-replaced", input);
  }

  async resetAccount(input: {
    operationId: string;
    username: string;
    confirmation: string;
  }): Promise<void> {
    const value = await this.#requestJson(
      `/api/teacher/accounts/${encodeURIComponent(input.username)}/reset`,
      "POST",
      {
        schema: "ad-market-teacher-account-reset",
        version: 1,
        operationId: input.operationId,
        confirmation: input.confirmation
      }
    );
    this.#assertMutationResult(value, "reset", input);
  }

  async imageLabStatus(): Promise<TeacherImageLabOverview> {
    return parseImageLabOverview(
      await this.#requestJson("/api/teacher/image-lab", "GET")
    );
  }

  async setImageLabGlobal(input: {
    operationId: string;
    enabled: boolean;
    objectDefault: number;
    realiseDefault: number;
  }): Promise<TeacherImageLabGlobalResult> {
    const value = await this.#requestJson("/api/teacher/image-lab/global", "PUT", {
      schema: "ad-market-teacher-image-lab-global",
      version: 1,
      operationId: input.operationId,
      enabled: input.enabled,
      objectDefault: input.objectDefault,
      realiseDefault: input.realiseDefault
    });
    if (
      !isRecord(value) ||
      !hasExactKeys(value, [
        "status",
        "operationId",
        "operation",
        "enabled",
        "defaults"
      ]) ||
      value.status !== "updated" ||
      value.operationId !== input.operationId ||
      value.operation !== "global" ||
      typeof value.enabled !== "boolean"
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return {
      status: "updated",
      operationId: input.operationId,
      operation: "global",
      enabled: value.enabled,
      defaults: parseImageLabDefaults(value.defaults)
    };
  }

  async setImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult> {
    return this.#mutateImageLabAccount("set", input);
  }

  async addImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult> {
    return this.#mutateImageLabAccount("add", input);
  }

  async revokeImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult> {
    return this.#mutateImageLabAccount("revoke", input);
  }

  async batchAddImageLab(input: {
    operationId: string;
    aliases: readonly string[];
    object: number;
    realise: number;
  }): Promise<TeacherImageLabBatchResult> {
    const value = await this.#requestJson("/api/teacher/image-lab/batch", "POST", {
      schema: "ad-market-teacher-image-lab-batch-add",
      version: 1,
      operationId: input.operationId,
      aliases: input.aliases,
      object: input.object,
      realise: input.realise
    });
    if (
      !isRecord(value) ||
      !hasExactKeys(value, [
        "status",
        "operationId",
        "operation",
        "aliases",
        "accounts"
      ]) ||
      value.status !== "updated" ||
      value.operationId !== input.operationId ||
      value.operation !== "batch-add" ||
      !Array.isArray(value.aliases) ||
      !Array.isArray(value.accounts)
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    const aliases = value.aliases as unknown[];
    const rawAccounts = value.accounts as unknown[];
    if (
      aliases.length !== rawAccounts.length ||
      !aliases.every((alias) =>
        typeof alias === "string" && USERNAME_PATTERN.test(alias)) ||
      aliases.some((alias, index) => alias !== input.aliases[index])
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    const accounts = rawAccounts.map(parseImageLabAccount);
    if (accounts.some((account, index) => account.alias !== aliases[index])) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return {
      status: "updated",
      operationId: input.operationId,
      operation: "batch-add",
      aliases: aliases as string[],
      accounts
    };
  }

  async #mutateImageLabAccount(
    operation: "set" | "add" | "revoke",
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult> {
    const suffix = operation === "set" ? "" : `/${operation}`;
    const value = await this.#requestJson(
      `/api/teacher/image-lab/accounts/${encodeURIComponent(input.alias)}${suffix}`,
      operation === "set" ? "PUT" : "POST",
      {
        schema: `ad-market-teacher-image-lab-account-${operation}`,
        version: 1,
        operationId: input.operationId,
        object: input.object,
        realise: input.realise
      }
    );
    if (
      !isRecord(value) ||
      !hasExactKeys(value, [
        "status",
        "operationId",
        "operation",
        "alias",
        "account"
      ]) ||
      value.status !== "updated" ||
      value.operationId !== input.operationId ||
      value.operation !== operation ||
      value.alias !== input.alias
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    const account = parseImageLabAccount(value.account);
    if (account.alias !== input.alias) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return {
      status: "updated",
      operationId: input.operationId,
      operation,
      alias: input.alias,
      account
    };
  }

  #assertMutationResult(
    value: unknown,
    status: "password-replaced" | "reset",
    input: { operationId: string; username: string }
  ): void {
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["status", "operationId", "username"]) ||
      value.status !== status ||
      value.operationId !== input.operationId ||
      value.username !== input.username
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
  }

  async #requestJson(
    path: string,
    method: "GET" | "POST" | "PUT",
    body?: Readonly<Record<string, unknown>>
  ): Promise<unknown> {
    const response = await this.#request(path, method, body, method === "GET");
    if (!response.ok) throw await responseError(response);
    return readBoundedJson(response);
  }

  async #requestNoContent(path: string, method: "POST"): Promise<void> {
    const response = await this.#request(path, method, undefined, false);
    if (!response.ok) throw await responseError(response);
    if (response.status !== 204 || response.body !== null) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
  }

  async #request(
    path: string,
    method: "GET" | "POST" | "PUT",
    body: Readonly<Record<string, unknown>> | undefined,
    safeRetry: boolean
  ): Promise<Response> {
    for (let attempt = 0; attempt < (safeRetry ? 2 : 1); attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), this.#timeoutMilliseconds);
      let response: Response;
      try {
        response = await this.#fetcher(path, {
          method,
          credentials: "same-origin",
          redirect: "error",
          headers: body === undefined
            ? { accept: "application/json" }
            : {
                accept: "application/json",
                "content-type": "application/json"
              },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal
        });
      } catch {
        throw new TeacherClientError("TEACHER_UNAVAILABLE", 503, true);
      } finally {
        window.clearTimeout(timeout);
      }
      if (response.redirected) {
        throw new TeacherClientError("TEACHER_UNAVAILABLE", 503, true);
      }
      if (response.status === 429 && safeRetry && attempt === 0) {
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter !== null && /^(?:[1-5])$/u.test(retryAfter)) {
          await this.#delay(Number(retryAfter) * 1_000);
          continue;
        }
      }
      return response;
    }
    throw new TeacherClientError("TEACHER_UNAVAILABLE", 503, true);
  }
}

export function createTeacherOperationId(): string {
  const value = crypto.randomUUID();
  if (!UUID_PATTERN.test(value)) throw new Error("Operation ID is unavailable");
  return value;
}
```

## File: `web/src/teacher/teacher-dashboard.ts`

```typescript
import {
  createTeacherOperationId,
  TeacherClientError,
  type TeacherClient,
  type TeacherImageLabAccount,
  type TeacherImageLabOverview,
  type TeacherPairSummary
} from "./teacher-client";

interface TeacherDashboardOptions {
  readonly createOperationId?: () => string;
  readonly clipboard?: Pick<Clipboard, "writeText">;
  readonly navigate?: (path: string) => void;
}

interface DialogSurface {
  readonly dialog: HTMLDialogElement;
  readonly close: () => void;
  readonly setPending: (pending: boolean) => void;
}

const passwordBytes = (value: string): number =>
  new TextEncoder().encode(value).byteLength;

const validPassword = (value: string): boolean => {
  const bytes = passwordBytes(value);
  return bytes >= 8 && bytes <= 128 && !value.includes("\0");
};

const button = (text: string, type: "button" | "submit" = "button"): HTMLButtonElement => {
  const element = document.createElement("button");
  element.type = type;
  element.textContent = text;
  return element;
};

const field = (
  labelText: string,
  input: HTMLInputElement,
  description?: string
): { wrapper: HTMLDivElement; error: HTMLParagraphElement } => {
  const wrapper = document.createElement("div");
  wrapper.className = "teacher-field";
  const label = document.createElement("label");
  label.textContent = labelText;
  label.append(input);
  wrapper.append(label);
  if (description !== undefined) {
    const help = document.createElement("p");
    help.className = "teacher-field__help";
    help.textContent = description;
    wrapper.append(help);
  }
  const error = document.createElement("p");
  error.className = "teacher-field__error";
  error.setAttribute("role", "alert");
  error.setAttribute("aria-live", "assertive");
  error.hidden = true;
  wrapper.append(error);
  return { wrapper, error };
};

const showFieldError = (target: HTMLParagraphElement, message: string): void => {
  target.textContent = message;
  target.hidden = message === "";
};

const errorMessage = (fallback: string): string => fallback;

export class TeacherDashboard {
  readonly #root: HTMLElement;
  readonly #client: TeacherClient;
  readonly #createOperationId: () => string;
  readonly #clipboard: Pick<Clipboard, "writeText"> | undefined;
  readonly #navigate: (path: string) => void;
  #accounts: readonly TeacherPairSummary[] = [];
  #imageLab: TeacherImageLabOverview | null = null;
  #imageLabLoadError = "";
  #imageLabAudit = "";
  #announcement: HTMLParagraphElement | null = null;

  constructor(
    root: HTMLElement,
    client: TeacherClient,
    options: TeacherDashboardOptions = {}
  ) {
    this.#root = root;
    this.#client = client;
    this.#createOperationId = options.createOperationId ?? createTeacherOperationId;
    this.#clipboard = options.clipboard ?? navigator.clipboard;
    this.#navigate = options.navigate ?? ((path) => window.location.assign(path));
  }

  async mount(): Promise<void> {
    this.#root.dataset.admarketRoute = "teacher-dashboard";
    this.#root.replaceChildren();
    const loading = document.createElement("p");
    loading.textContent = "Checking teacher access…";
    loading.setAttribute("role", "status");
    this.#root.append(loading);
    try {
      const session = await this.#client.session();
      if (session.authenticated) {
        await this.#loadDashboard();
      } else {
        this.#renderLogin();
      }
    } catch {
      this.#renderLogin("Teacher access could not be checked. Check the connection and try again.");
    }
  }

  #renderLogin(initialError = ""): void {
    const main = document.createElement("main");
    main.className = "teacher-page teacher-login";
    main.tabIndex = -1;
    const eyebrow = document.createElement("p");
    eyebrow.className = "teacher-eyebrow";
    eyebrow.textContent = "AD MARKET";
    const heading = document.createElement("h1");
    heading.textContent = "Teacher access";
    const explanation = document.createElement("p");
    explanation.textContent =
      "Enter the teacher password to manage classroom accounts and open the teacher playtest.";
    const form = document.createElement("form");
    form.className = "teacher-card teacher-login__form";
    const password = document.createElement("input");
    password.type = "password";
    password.name = "teacher-password";
    password.autocomplete = "current-password";
    password.required = true;
    const passwordField = field("Teacher password", password);
    const submit = button("Sign in", "submit");
    const error = document.createElement("p");
    error.className = "teacher-form-error";
    error.setAttribute("role", "alert");
    error.setAttribute("aria-live", "assertive");
    error.hidden = initialError === "";
    error.textContent = initialError;
    form.append(passwordField.wrapper, submit, error);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      submit.disabled = true;
      password.disabled = true;
      error.hidden = true;
      void this.#client.login(password.value)
        .then(() => this.#loadDashboard())
        .catch(() => {
          submit.disabled = false;
          password.disabled = false;
          error.hidden = false;
          error.textContent =
            "The teacher password was not accepted. Check the password and try again.";
          password.focus();
        });
    });
    main.append(eyebrow, heading, explanation, form);
    this.#root.replaceChildren(main);
    main.focus();
  }

  async #loadDashboard(): Promise<void> {
    const [accounts, imageLab] = await Promise.allSettled([
      this.#client.listAccounts(),
      this.#client.imageLabStatus()
    ]);
    if (accounts.status === "fulfilled") {
      this.#accounts = accounts.value;
    }
    if (imageLab.status === "fulfilled") {
      this.#imageLab = imageLab.value;
      this.#imageLabLoadError = "";
    } else {
      this.#imageLab = null;
      this.#imageLabLoadError =
        "Image Lab allowances could not be loaded. Check the connection and refresh the allowances.";
    }
    this.#renderDashboard(accounts.status === "rejected"
      ? "Classroom accounts could not be loaded. Check the connection and refresh this page."
      : "");
  }

  #renderDashboard(initialError = ""): void {
    const main = document.createElement("main");
    main.className = "teacher-page";
    main.tabIndex = -1;
    const header = document.createElement("header");
    header.className = "teacher-header";
    const identity = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "teacher-eyebrow";
    eyebrow.textContent = "AD MARKET";
    const heading = document.createElement("h1");
    heading.textContent = "Classroom accounts";
    const summary = document.createElement("p");
    summary.textContent =
      "Create pair logins, replace passwords and reset one pair's saved work.";
    identity.append(eyebrow, heading, summary);
    const headerActions = document.createElement("div");
    headerActions.className = "teacher-header__actions";
    const playtest = button("Open teacher playtest");
    playtest.addEventListener("click", () => this.#navigate("/teacher/playtest"));
    const logout = button("Sign out");
    logout.addEventListener("click", () => {
      logout.disabled = true;
      void this.#client.logout()
        .then(() => this.#renderLogin())
        .catch(() => {
          logout.disabled = false;
          this.#announce("Sign out did not finish. Check the connection and try again.");
        });
    });
    headerActions.append(playtest, logout);
    header.append(identity, headerActions);

    const toolbar = document.createElement("section");
    toolbar.className = "teacher-toolbar teacher-card";
    const toolbarCopy = document.createElement("div");
    const toolbarHeading = document.createElement("h2");
    toolbarHeading.textContent = "Pair logins";
    const toolbarSummary = document.createElement("p");
    toolbarSummary.textContent =
      `${this.#accounts.length} ${this.#accounts.length === 1 ? "account" : "accounts"}`;
    toolbarCopy.append(toolbarHeading, toolbarSummary);
    const create = button("Create account");
    create.addEventListener("click", () => this.#openCreateDialog(create));
    toolbar.append(toolbarCopy, create);

    const accountRegion = document.createElement("section");
    accountRegion.className = "teacher-accounts";
    accountRegion.setAttribute("aria-label", "Pair accounts");
    if (this.#accounts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "teacher-card teacher-empty";
      empty.textContent = "No pair accounts have been created.";
      accountRegion.append(empty);
    } else {
      for (const account of this.#accounts) {
        accountRegion.append(this.#accountCard(account));
      }
    }

    this.#announcement = document.createElement("p");
    this.#announcement.className = "teacher-announcement";
    this.#announcement.setAttribute("role", initialError === "" ? "status" : "alert");
    this.#announcement.setAttribute("aria-live", initialError === "" ? "polite" : "assertive");
    this.#announcement.textContent = initialError;

    main.append(
      header,
      toolbar,
      this.#announcement,
      accountRegion,
      this.#imageLabRegion()
    );
    this.#root.replaceChildren(main);
    main.focus();
  }

  #imageLabRegion(): HTMLElement {
    const region = document.createElement("section");
    region.className = "teacher-image-lab teacher-card";
    region.setAttribute("aria-label", "Image Lab allowances");
    const heading = document.createElement("h2");
    heading.textContent = "Image Lab allowances";
    const explanation = document.createElement("p");
    explanation.textContent =
      "Control whether pairs can use Image Lab and set separate Object Forge and Make It Real allowances.";
    const feedback = document.createElement("p");
    feedback.className = "teacher-image-lab__feedback";
    feedback.setAttribute("role", this.#imageLabLoadError === "" ? "status" : "alert");
    feedback.setAttribute("aria-live", this.#imageLabLoadError === "" ? "polite" : "assertive");
    feedback.textContent = this.#imageLabLoadError || this.#imageLabAudit;
    region.append(heading, explanation, feedback);

    if (this.#imageLab === null) {
      const refresh = button("Refresh allowances");
      refresh.addEventListener("click", () => {
        void this.#refreshImageLab(region);
      });
      region.append(refresh);
      return region;
    }

    const status = document.createElement("p");
    status.className = "teacher-image-lab__status";
    status.textContent = this.#imageLab.enabled
      ? "Image Lab is available to pairs."
      : "Image Lab is unavailable to pairs.";

    const globalForm = document.createElement("form");
    globalForm.className = "teacher-image-lab__global";
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = this.#imageLab.enabled;
    const enabledField = field("Image Lab available to pairs", enabled);
    const objectDefault = this.#allowanceInput(this.#imageLab.defaults.object);
    const objectDefaultField = field("Default Object Forge uses", objectDefault);
    const realiseDefault = this.#allowanceInput(this.#imageLab.defaults.realise);
    const realiseDefaultField = field("Default Make It Real uses", realiseDefault);
    const saveGlobal = button("Save Image Lab settings", "submit");
    globalForm.append(
      enabledField.wrapper,
      objectDefaultField.wrapper,
      realiseDefaultField.wrapper,
      saveGlobal
    );
    globalForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = this.#readAllowancePair(
        objectDefault,
        realiseDefault,
        feedback,
        true
      );
      if (values === null) return;
      void this.#runImageLabMutation(
        region,
        () => this.#client.setImageLabGlobal({
          operationId: this.#createOperationId(),
          enabled: enabled.checked,
          objectDefault: values.object,
          realiseDefault: values.realise
        }),
        (result) => {
          this.#imageLab = {
            ...this.#imageLab!,
            enabled: result.enabled,
            defaults: result.defaults
          };
          this.#imageLabAudit =
            `Settings saved — Image Lab ${result.enabled ? "available" : "unavailable"}; ` +
            `future accounts receive ${result.defaults.object} Object Forge and ` +
            `${result.defaults.realise} Make It Real uses.`;
        }
      );
    });

    const table = document.createElement("table");
    table.setAttribute("aria-label", "Pair Image Lab allowances");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of [
      "Select",
      "Pair",
      "Object Forge",
      "Make It Real",
      "Change uses"
    ]) {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = label;
      headRow.append(cell);
    }
    head.append(headRow);
    const body = document.createElement("tbody");
    for (const account of this.#imageLab.accounts) {
      body.append(this.#imageLabRow(region, account, feedback));
    }
    table.append(head, body);
    const tableScroll = document.createElement("div");
    tableScroll.className = "teacher-image-lab__table-scroll";
    tableScroll.append(table);

    const batch = document.createElement("form");
    batch.className = "teacher-image-lab__batch";
    const batchHeading = document.createElement("h3");
    batchHeading.textContent = "Add uses to selected pairs";
    const batchObject = this.#allowanceInput(0);
    const batchObjectField = field("Batch Object Forge uses", batchObject);
    const batchRealise = this.#allowanceInput(0);
    const batchRealiseField = field("Batch Make It Real uses", batchRealise);
    const batchSubmit = button("Add uses to selected pairs", "submit");
    batch.append(
      batchHeading,
      batchObjectField.wrapper,
      batchRealiseField.wrapper,
      batchSubmit
    );
    batch.addEventListener("submit", (event) => {
      event.preventDefault();
      const aliases = [...region.querySelectorAll<HTMLInputElement>(
        'input[data-image-lab-batch-alias]:checked'
      )].map((input) => input.dataset.imageLabBatchAlias!);
      const values = this.#readAllowancePair(
        batchObject,
        batchRealise,
        feedback,
        false
      );
      if (values === null) return;
      if (aliases.length === 0) {
        this.#setImageLabFeedback(
          feedback,
          "Select at least one pair before adding uses.",
          true
        );
        return;
      }
      void this.#runImageLabMutation(
        region,
        () => this.#client.batchAddImageLab({
          operationId: this.#createOperationId(),
          aliases,
          object: values.object,
          realise: values.realise
        }),
        (result) => {
          this.#replaceImageLabAccounts(result.accounts);
          this.#imageLabAudit =
            `Added uses to ${result.aliases.length} selected ` +
            `${result.aliases.length === 1 ? "pair" : "pairs"}.`;
        }
      );
    });

    const refresh = button("Refresh allowances");
    refresh.hidden = true;
    refresh.addEventListener("click", () => {
      void this.#refreshImageLab(region);
    });
    region.append(status, globalForm, tableScroll, batch, refresh);
    return region;
  }

  #imageLabRow(
    region: HTMLElement,
    account: TeacherImageLabAccount,
    feedback: HTMLParagraphElement
  ): HTMLTableRowElement {
    const row = document.createElement("tr");
    const selectCell = document.createElement("td");
    selectCell.className = "teacher-image-lab__select";
    const selected = document.createElement("input");
    selected.type = "checkbox";
    selected.dataset.imageLabBatchAlias = account.alias;
    selected.setAttribute("aria-label", `Select ${account.alias} for batch grant`);
    selectCell.append(selected);
    const alias = document.createElement("th");
    alias.scope = "row";
    alias.textContent = account.alias;
    const objectStatus = document.createElement("td");
    objectStatus.textContent =
      `${account.object.remaining} available; ${account.object.reserved} reserved`;
    const realiseStatus = document.createElement("td");
    realiseStatus.textContent =
      `${account.realise.remaining} available; ${account.realise.reserved} reserved`;
    const controls = document.createElement("td");
    const controlGroup = document.createElement("div");
    controlGroup.className = "teacher-image-lab__controls";
    const object = this.#allowanceInput(account.object.remaining);
    object.setAttribute("aria-label", `Object Forge uses for ${account.alias}`);
    const realise = this.#allowanceInput(account.realise.remaining);
    realise.setAttribute("aria-label", `Make It Real uses for ${account.alias}`);
    const set = button(`Set uses for ${account.alias}`);
    const add = button(`Add uses for ${account.alias}`);
    const revoke = button(`Revoke available uses for ${account.alias}`);
    const mutate = (
      operation: "set" | "add" | "revoke",
      invoke: TeacherClient[
        "setImageLabAccount" | "addImageLabAccount" | "revokeImageLabAccount"
      ]
    ): void => {
      const values = this.#readAllowancePair(
        object,
        realise,
        feedback,
        operation === "set"
      );
      if (values === null) return;
      void this.#runImageLabMutation(
        region,
        () => invoke.call(this.#client, {
          operationId: this.#createOperationId(),
          alias: account.alias,
          object: values.object,
          realise: values.realise
        }),
        (result) => {
          this.#replaceImageLabAccounts([result.account]);
          const label = operation === "set"
            ? "Set"
            : operation === "add"
              ? "Add"
              : "Revoke";
          this.#imageLabAudit =
            `${label} — ${account.alias}: ` +
            `Object Forge ${result.account.object.remaining} available, ` +
            `${result.account.object.reserved} reserved; ` +
            `Make It Real ${result.account.realise.remaining} available, ` +
            `${result.account.realise.reserved} reserved.`;
        }
      );
    };
    set.addEventListener("click", () =>
      mutate("set", this.#client.setImageLabAccount));
    add.addEventListener("click", () =>
      mutate("add", this.#client.addImageLabAccount));
    revoke.addEventListener("click", () =>
      mutate("revoke", this.#client.revokeImageLabAccount));
    controlGroup.append(object, realise, set, add, revoke);
    controls.append(controlGroup);
    row.append(selectCell, alias, objectStatus, realiseStatus, controls);
    return row;
  }

  #allowanceInput(value: number): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.value = String(value);
    return input;
  }

  #readAllowancePair(
    object: HTMLInputElement,
    realise: HTMLInputElement,
    feedback: HTMLParagraphElement,
    allowBothZero: boolean
  ): { readonly object: number; readonly realise: number } | null {
    const objectValue = Number(object.value);
    const realiseValue = Number(realise.value);
    if (
      !Number.isInteger(objectValue) ||
      objectValue < 0 ||
      objectValue > 100 ||
      !Number.isInteger(realiseValue) ||
      realiseValue < 0 ||
      realiseValue > 100
    ) {
      this.#setImageLabFeedback(
        feedback,
        "Enter whole numbers from 0 to 100 for both stages.",
        true
      );
      return null;
    }
    if (!allowBothZero && objectValue === 0 && realiseValue === 0) {
      this.#setImageLabFeedback(
        feedback,
        "Enter at least one use to add or revoke.",
        true
      );
      return null;
    }
    return { object: objectValue, realise: realiseValue };
  }

  async #runImageLabMutation<T>(
    region: HTMLElement,
    mutation: () => Promise<T>,
    applyResult: (result: T) => void
  ): Promise<void> {
    const controls = [...region.querySelectorAll<HTMLButtonElement>("button")];
    controls.forEach((control) => {
      control.disabled = true;
    });
    const feedback = region.querySelector<HTMLParagraphElement>(
      ".teacher-image-lab__feedback"
    )!;
    this.#setImageLabFeedback(feedback, "", false);
    try {
      applyResult(await mutation());
      region.replaceWith(this.#imageLabRegion());
    } catch (error) {
      controls.forEach((control) => {
        control.disabled = false;
      });
      const refresh = [...region.querySelectorAll<HTMLButtonElement>("button")]
        .find((control) => control.textContent === "Refresh allowances");
      if (error instanceof TeacherClientError && error.refreshRequired) {
        this.#setImageLabFeedback(
          feedback,
          "The result is uncertain. Keep these values and refresh allowances before another change.",
          true
        );
        if (refresh !== undefined) refresh.hidden = false;
      } else {
        this.#setImageLabFeedback(
          feedback,
          "The allowance change did not finish. Check the connection and try again.",
          true
        );
      }
    }
  }

  async #refreshImageLab(region: HTMLElement): Promise<void> {
    const controls = [...region.querySelectorAll<HTMLButtonElement>("button")];
    controls.forEach((control) => {
      control.disabled = true;
    });
    try {
      this.#imageLab = await this.#client.imageLabStatus();
      this.#imageLabLoadError = "";
      this.#imageLabAudit = "Allowances refreshed.";
      region.replaceWith(this.#imageLabRegion());
    } catch {
      controls.forEach((control) => {
        control.disabled = false;
      });
      const feedback = region.querySelector<HTMLParagraphElement>(
        ".teacher-image-lab__feedback"
      );
      if (feedback !== null) {
        this.#setImageLabFeedback(
          feedback,
          "Allowances could not be refreshed. Check the connection and try again.",
          true
        );
      }
    }
  }

  #replaceImageLabAccounts(accounts: readonly TeacherImageLabAccount[]): void {
    if (this.#imageLab === null) return;
    const replacements = new Map(accounts.map((account) => [account.alias, account]));
    this.#imageLab = {
      ...this.#imageLab,
      accounts: this.#imageLab.accounts.map((account) =>
        replacements.get(account.alias) ?? account)
    };
  }

  #setImageLabFeedback(
    target: HTMLParagraphElement,
    message: string,
    error: boolean
  ): void {
    target.textContent = message;
    target.setAttribute("role", error ? "alert" : "status");
    target.setAttribute("aria-live", error ? "assertive" : "polite");
  }

  #accountCard(account: TeacherPairSummary): HTMLElement {
    const article = document.createElement("article");
    article.className = "teacher-account teacher-card";
    const details = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = account.username;
    const activity = document.createElement("p");
    activity.textContent = account.lastSignInAt === null
      ? "Not used yet"
      : `Last used ${new Date(account.lastSignInAt).toLocaleString()}`;
    details.append(heading, activity);
    const actions = document.createElement("div");
    actions.className = "teacher-account__actions";
    const replace = button(`Change password for ${account.username}`);
    replace.addEventListener("click", () =>
      this.#openPasswordDialog(replace, account.username));
    const reset = button(`Reset progress for ${account.username}`);
    reset.className = "teacher-button--danger";
    reset.addEventListener("click", () =>
      this.#openResetDialog(reset, account.username));
    actions.append(replace, reset);
    article.append(details, actions);
    return article;
  }

  #openDialog(trigger: HTMLButtonElement, titleText: string): DialogSurface {
    const dialog = document.createElement("dialog");
    dialog.className = "teacher-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const title = document.createElement("h2");
    title.id = `teacher-dialog-${this.#createOperationId()}`;
    title.textContent = titleText;
    dialog.setAttribute("aria-labelledby", title.id);
    dialog.append(title);
    this.#root.append(dialog);
    let pending = false;
    const close = () => {
      if (pending) return;
      dialog.remove();
      trigger.focus();
    };
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    });
    dialog.setAttribute("open", "");
    return {
      dialog,
      close,
      setPending(value) {
        pending = value;
      }
    };
  }

  #passwordControls(
    passwordLabel: string,
    confirmationLabel: string
  ): {
    wrapper: DocumentFragment;
    password: HTMLInputElement;
    confirmation: HTMLInputElement;
    passwordError: HTMLParagraphElement;
    confirmationError: HTMLParagraphElement;
  } {
    const wrapper = document.createDocumentFragment();
    const password = document.createElement("input");
    password.type = "password";
    password.autocomplete = "new-password";
    password.maxLength = 128;
    const passwordField = field(
      passwordLabel,
      password,
      "Use 8 to 128 UTF-8 bytes."
    );
    const confirmation = document.createElement("input");
    confirmation.type = "password";
    confirmation.autocomplete = "new-password";
    confirmation.maxLength = 128;
    const confirmationField = field(confirmationLabel, confirmation);
    const controls = document.createElement("div");
    controls.className = "teacher-password-controls";
    const generate = button("Generate password");
    generate.addEventListener("click", () => {
      const generated = `Pair-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
      password.value = generated;
      confirmation.value = generated;
      showFieldError(passwordField.error, "");
      showFieldError(confirmationField.error, "");
    });
    const show = button("Show password");
    show.addEventListener("click", () => {
      const visible = password.type === "text";
      password.type = visible ? "password" : "text";
      confirmation.type = visible ? "password" : "text";
      show.textContent = visible ? "Show password" : "Hide password";
    });
    controls.append(generate, show);
    wrapper.append(
      passwordField.wrapper,
      confirmationField.wrapper,
      controls
    );
    return {
      wrapper,
      password,
      confirmation,
      passwordError: passwordField.error,
      confirmationError: confirmationField.error
    };
  }

  #openCreateDialog(trigger: HTMLButtonElement): void {
    const surface = this.#openDialog(trigger, "Create pair account");
    const form = document.createElement("form");
    const introduction = document.createElement("p");
    introduction.textContent =
      "Choose the username and password that this pair will use on the student site.";
    const username = document.createElement("input");
    username.type = "text";
    username.autocomplete = "off";
    username.spellcheck = false;
    username.maxLength = 24;
    const usernameField = field(
      "Username",
      username,
      "Use 3 to 24 lowercase letters, numbers, hyphens or underscores."
    );
    const passwords = this.#passwordControls("Password", "Confirm password");
    const formError = document.createElement("p");
    formError.className = "teacher-form-error";
    formError.setAttribute("role", "alert");
    formError.setAttribute("aria-live", "assertive");
    formError.hidden = true;
    const actions = document.createElement("div");
    actions.className = "teacher-dialog__actions";
    const cancel = button("Cancel");
    cancel.addEventListener("click", surface.close);
    const submit = button("Create account", "submit");
    actions.append(cancel, submit);
    form.append(
      introduction,
      usernameField.wrapper,
      passwords.wrapper,
      formError,
      actions
    );
    surface.dialog.append(form);
    queueMicrotask(() => username.focus());

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const normalisedUsername = username.value.normalize("NFKC").trim().toLowerCase();
      const usernameValid = /^[a-z0-9][a-z0-9_-]{2,23}$/u.test(normalisedUsername) &&
        normalisedUsername !== "teacher-playtest";
      showFieldError(
        usernameField.error,
        usernameValid ? "" : "Enter a valid pair username."
      );
      showFieldError(
        passwords.passwordError,
        validPassword(passwords.password.value) ? "" : "Use 8 to 128 UTF-8 bytes."
      );
      showFieldError(
        passwords.confirmationError,
        passwords.confirmation.value === passwords.password.value
          ? ""
          : "Passwords must match."
      );
      if (
        !usernameValid ||
        !validPassword(passwords.password.value) ||
        passwords.confirmation.value !== passwords.password.value
      ) return;

      surface.setPending(true);
      for (const control of form.elements) {
        if (control instanceof HTMLInputElement || control instanceof HTMLButtonElement) {
          control.disabled = true;
        }
      }
      formError.hidden = true;
      const plaintextPassword = passwords.password.value;
      void this.#client.createAccount({
        operationId: this.#createOperationId(),
        username: normalisedUsername,
        password: plaintextPassword
      }).then((created) => {
        this.#accounts = [...this.#accounts, created]
          .sort((left, right) => left.username.localeCompare(right.username));
        surface.dialog.replaceChildren();
        const title = document.createElement("h2");
        title.id = `teacher-dialog-success-${this.#createOperationId()}`;
        title.textContent = "Account created";
        surface.dialog.setAttribute("aria-labelledby", title.id);
        const explanation = document.createElement("p");
        explanation.textContent =
          "Copy these credentials now. The password will be removed from this page when you close this panel.";
        const credentials = document.createElement("dl");
        const usernameTerm = document.createElement("dt");
        usernameTerm.textContent = "Username";
        const usernameValue = document.createElement("dd");
        usernameValue.textContent = normalisedUsername;
        const passwordTerm = document.createElement("dt");
        passwordTerm.textContent = "Password";
        const passwordValue = document.createElement("dd");
        passwordValue.textContent = plaintextPassword;
        credentials.append(
          usernameTerm,
          usernameValue,
          passwordTerm,
          passwordValue
        );
        const copyStatus = document.createElement("p");
        copyStatus.setAttribute("role", "status");
        copyStatus.setAttribute("aria-live", "polite");
        const copy = button("Copy username and password");
        copy.addEventListener("click", () => {
          if (this.#clipboard === undefined) {
            copyStatus.textContent = "Clipboard access is unavailable. Copy the credentials manually.";
            return;
          }
          void this.#clipboard.writeText(
            `Username: ${normalisedUsername}\nPassword: ${plaintextPassword}`
          ).then(() => {
            copyStatus.textContent = "Username and password copied.";
          }).catch(() => {
            copyStatus.textContent =
              "The credentials could not be copied. Copy them manually.";
          });
        });
        const done = button("Done");
        done.addEventListener("click", () => {
          surface.setPending(false);
          copyStatus.textContent = "";
          surface.close();
          this.#announce(`Account created for ${normalisedUsername}.`);
        });
        surface.dialog.append(
          title,
          explanation,
          credentials,
          copy,
          copyStatus,
          done
        );
        queueMicrotask(() => copy.focus());
      }).catch(() => {
        surface.setPending(false);
        for (const control of form.elements) {
          if (control instanceof HTMLInputElement || control instanceof HTMLButtonElement) {
            control.disabled = false;
          }
        }
        formError.hidden = false;
        formError.textContent = errorMessage(
          "The account could not be created. Check the details and connection, then try again."
        );
        submit.focus();
      });
    });
  }

  #openPasswordDialog(trigger: HTMLButtonElement, username: string): void {
    const surface = this.#openDialog(trigger, `Replace password for ${username}`);
    const warning = document.createElement("p");
    warning.className = "teacher-warning";
    warning.textContent =
      "After this change, the old password will stop working and the pair must sign in again.";
    const form = document.createElement("form");
    const passwords = this.#passwordControls("New password", "Confirm new password");
    const formError = document.createElement("p");
    formError.setAttribute("role", "alert");
    formError.setAttribute("aria-live", "assertive");
    formError.hidden = true;
    const actions = document.createElement("div");
    actions.className = "teacher-dialog__actions";
    const cancel = button("Cancel");
    cancel.addEventListener("click", surface.close);
    const submit = button("Replace password", "submit");
    actions.append(cancel, submit);
    form.append(passwords.wrapper, formError, actions);
    surface.dialog.append(warning, form);
    queueMicrotask(() => passwords.password.focus());
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      showFieldError(
        passwords.passwordError,
        validPassword(passwords.password.value) ? "" : "Use 8 to 128 UTF-8 bytes."
      );
      showFieldError(
        passwords.confirmationError,
        passwords.confirmation.value === passwords.password.value
          ? ""
          : "Passwords must match."
      );
      if (
        !validPassword(passwords.password.value) ||
        passwords.confirmation.value !== passwords.password.value
      ) return;
      surface.setPending(true);
      void this.#client.replacePassword({
        operationId: this.#createOperationId(),
        username,
        password: passwords.password.value
      }).then(() => {
        surface.setPending(false);
        surface.close();
        this.#announce(`Password replaced for ${username}. The pair must sign in again.`);
      }).catch(() => {
        surface.setPending(false);
        formError.hidden = false;
        formError.textContent =
          "The password was not replaced. Check the connection and try again.";
        submit.focus();
      });
    });
  }

  #openResetDialog(trigger: HTMLButtonElement, username: string): void {
    const surface = this.#openDialog(trigger, `Reset progress for ${username}`);
    const scope = document.createElement("p");
    scope.textContent =
      "This deletes this account's game progress, drafts, advertisement designs, uploaded images and cloud saves. The username and password remain.";
    const instruction = document.createElement("p");
    instruction.textContent = `Type ${username} to confirm.`;
    const confirmation = document.createElement("input");
    confirmation.type = "text";
    confirmation.autocomplete = "off";
    confirmation.spellcheck = false;
    confirmation.maxLength = 24;
    const confirmationField = field(`Type ${username} to confirm`, confirmation);
    const error = document.createElement("p");
    error.setAttribute("role", "alert");
    error.setAttribute("aria-live", "assertive");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "teacher-dialog__actions";
    const cancel = button("Cancel");
    cancel.addEventListener("click", surface.close);
    const confirm = button("Reset progress");
    confirm.disabled = true;
    confirmation.addEventListener("input", () => {
      confirm.disabled = confirmation.value !== username;
    });
    confirm.addEventListener("click", () => {
      if (confirmation.value !== username) return;
      surface.setPending(true);
      confirmation.disabled = true;
      cancel.disabled = true;
      confirm.disabled = true;
      void this.#client.resetAccount({
        operationId: this.#createOperationId(),
        username,
        confirmation: username
      }).then(() => {
        surface.setPending(false);
        surface.close();
        this.#announce(`Progress reset for ${username}. The login has not changed.`);
      }).catch(() => {
        surface.setPending(false);
        confirmation.disabled = false;
        cancel.disabled = false;
        confirm.disabled = false;
        error.hidden = false;
        error.textContent =
          "The reset did not finish. Refresh the account list before trying another reset.";
        confirmation.focus();
      });
    });
    actions.append(cancel, confirm);
    surface.dialog.append(
      scope,
      instruction,
      confirmationField.wrapper,
      error,
      actions
    );
    queueMicrotask(() => confirmation.focus());
  }

  #announce(message: string): void {
    if (this.#announcement !== null) this.#announcement.textContent = message;
  }
}
```

## File: `web/src/teacher/teacher-playtest-client.ts`

```typescript
import {
  AccountClientError,
  HttpCloudProgressClient,
  type CloudProgressClient,
  type CloudProgressDocumentMetadata,
  type CloudProgressLoadResult,
  type CloudProgressSaveResult
} from "../account/account-client";
import {
  HttpAccountAssetClient,
  type AccountAssetClient,
  type AccountAssetClientDeadlines,
  type AccountAssetDescriptor,
  type AccountAssetDownload
} from "../account/account-asset-client";
import type { AccountCookieRequestSerialiser } from
  "../account/account-cookie-request-serialiser";
import type { CampaignDocumentV1 } from "../domain/campaign-document";

const PROGRESS_PATH = "/api/teacher/playtest/progress";
const RESET_PATH = "/api/teacher/playtest/reset";
const RESPONSE_LIMIT = 16 * 1_024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export interface TeacherPlaytestResetInput {
  readonly operationId: string;
  readonly confirmation: "RESET";
}

export interface TeacherPlaytestClient extends CloudProgressClient, AccountAssetClient {
  reset(input: TeacherPlaytestResetInput): Promise<"reset">;
}

export class TeacherPlaytestClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryable = false
  ) {
    super(code);
    this.name = "TeacherPlaytestClientError";
  }
}

export interface HttpTeacherPlaytestClientOptions {
  readonly fetcher?: typeof fetch;
  readonly timeoutMilliseconds?: number;
  readonly assetDeadlines?: AccountAssetClientDeadlines;
}

const immediateRequests: AccountCookieRequestSerialiser = {
  run: <T>(operation: () => Promise<T>): Promise<T> => operation()
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
};

const readBoundedJson = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json" || response.body === null) {
    throw new TeacherPlaytestClientError("INVALID_RESPONSE", 503, true);
  }
  const declared = response.headers.get("content-length");
  if (
    declared !== null &&
    (!/^\d+$/u.test(declared) || Number(declared) > RESPONSE_LIMIT)
  ) {
    throw new TeacherPlaytestClientError("INVALID_RESPONSE", 503, true);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > RESPONSE_LIMIT) {
      await reader.cancel().catch(() => undefined);
      throw new TeacherPlaytestClientError("INVALID_RESPONSE", 503, true);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new TeacherPlaytestClientError("INVALID_RESPONSE", 503, true);
  }
};

const errorFor = async (response: Response): Promise<TeacherPlaytestClientError> => {
  if (response.status === 401) {
    return new TeacherPlaytestClientError("AUTHENTICATION_REQUIRED", 401);
  }
  let code = response.status >= 500 ? "PLAYTEST_UNAVAILABLE" : "INVALID_RESPONSE";
  let retryable = response.status >= 500 || response.status === 429;
  try {
    const body = await readBoundedJson(response);
    if (
      isRecord(body) &&
      typeof body.error === "string" &&
      /^[A-Z][A-Z0-9_]{1,63}$/u.test(body.error)
    ) {
      code = body.error;
    }
    if (isRecord(body) && typeof body.retryable === "boolean") {
      retryable = body.retryable;
    }
  } catch {
    // Invalid error bodies are not reflected to the caller.
  }
  return new TeacherPlaytestClientError(code, response.status, retryable);
};

const boundedFetcher = (
  fetcher: typeof fetch,
  timeoutMilliseconds: number
): typeof fetch => {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const external = init?.signal;
    const onAbort = (): void => controller.abort(external?.reason);
    if (external?.aborted) onAbort();
    else external?.addEventListener("abort", onAbort, { once: true });
    const timer = globalThis.setTimeout(() => {
      controller.abort(new DOMException("Teacher playtest request timed out", "TimeoutError"));
    }, timeoutMilliseconds);
    try {
      return await fetcher.call(globalThis, input, {
        ...init,
        signal: controller.signal
      });
    } finally {
      globalThis.clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    }
  }) as typeof fetch;
};

export class HttpTeacherPlaytestClient implements TeacherPlaytestClient {
  readonly #fetcher: typeof fetch;
  readonly #progress: CloudProgressClient;
  readonly #assets: AccountAssetClient;

  constructor(options: HttpTeacherPlaytestClientOptions = {}) {
    const timeoutMilliseconds = options.timeoutMilliseconds ?? 12_000;
    if (
      !Number.isInteger(timeoutMilliseconds) ||
      timeoutMilliseconds < 1_000 ||
      timeoutMilliseconds > 30_000
    ) {
      throw new Error("Teacher playtest request timeout is invalid");
    }
    const fetcher = options.fetcher ?? globalThis.fetch;
    this.#fetcher = boundedFetcher(fetcher, timeoutMilliseconds);
    this.#progress = new HttpCloudProgressClient(
      null,
      this.#fetcher,
      immediateRequests,
      {
        path: PROGRESS_PATH,
        includeAccountIdentityHeader: false
      }
    );
    this.#assets = new HttpAccountAssetClient(
      null,
      fetcher,
      immediateRequests,
      options.assetDeadlines,
      {
        path: (digest) => `/api/teacher/playtest/assets/${digest}`,
        includeAccountIdentityHeader: false
      }
    );
  }

  save(
    document: CampaignDocumentV1,
    expectedRevision: number
  ): Promise<CloudProgressSaveResult> {
    return this.#progress.save(document, expectedRevision);
  }

  load(documentId: string): Promise<CloudProgressLoadResult> {
    return this.#progress.load(documentId);
  }

  list(): Promise<readonly CloudProgressDocumentMetadata[]> {
    return this.#progress.list();
  }

  put(
    blob: Blob,
    options?: { signal?: AbortSignal }
  ): Promise<AccountAssetDescriptor> {
    return this.#assets.put(blob, options);
  }

  get(
    sha256: string,
    options?: { signal?: AbortSignal }
  ): Promise<AccountAssetDownload> {
    return this.#assets.get(sha256, options);
  }

  async reset(input: TeacherPlaytestResetInput): Promise<"reset"> {
    if (
      input.confirmation !== "RESET" ||
      !UUID_PATTERN.test(input.operationId)
    ) {
      throw new TeacherPlaytestClientError("INVALID_REQUEST", 400);
    }
    let response: Response;
    try {
      response = await this.#fetcher(RESET_PATH, {
        method: "POST",
        credentials: "same-origin",
        redirect: "error",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          schema: "ad-market-teacher-playtest-reset",
          version: 1,
          operationId: input.operationId,
          confirmation: input.confirmation
        })
      });
    } catch {
      throw new TeacherPlaytestClientError("PLAYTEST_UNAVAILABLE", 503, true);
    }
    if (response.redirected) {
      throw new TeacherPlaytestClientError("PLAYTEST_UNAVAILABLE", 503, true);
    }
    if (!response.ok) throw await errorFor(response);
    const value = await readBoundedJson(response);
    if (
      !isRecord(value) ||
      !exactKeys(value, ["status", "operationId"]) ||
      value.status !== "reset" ||
      value.operationId !== input.operationId
    ) {
      throw new TeacherPlaytestClientError("INVALID_RESPONSE", 503, true);
    }
    return "reset";
  }
}

export function createTeacherPlaytestOperationId(): string {
  const value = crypto.randomUUID();
  if (!UUID_PATTERN.test(value)) {
    throw new AccountClientError("INVALID_REQUEST");
  }
  return value;
}
```

## File: `web/src/teacher/teacher-playtest-controller.ts`

```typescript
import type { TeacherClient } from "./teacher-client";
import {
  createTeacherPlaytestOperationId,
  type TeacherPlaytestClient
} from "./teacher-playtest-client";

export interface TeacherPlaytestControllerOptions {
  readonly root: HTMLElement;
  readonly sessionClient: Pick<TeacherClient, "session">;
  readonly playtestClient: Pick<TeacherPlaytestClient, "reset">;
  readonly startGame: () => void | Promise<void>;
  readonly resetLocalState: () => Promise<void>;
  readonly openFirstScreen: () => void;
  readonly navigate?: (path: "/teacher") => void;
  readonly createOperationId?: () => string;
}

const actionButton = (label: string): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  return button;
};

export class TeacherPlaytestController {
  readonly #root: HTMLElement;
  readonly #sessionClient: Pick<TeacherClient, "session">;
  readonly #playtestClient: Pick<TeacherPlaytestClient, "reset">;
  readonly #startGame: () => void | Promise<void>;
  readonly #resetLocalState: () => Promise<void>;
  readonly #openFirstScreen: () => void;
  readonly #navigate: (path: "/teacher") => void;
  readonly #createOperationId: () => string;

  constructor(options: TeacherPlaytestControllerOptions) {
    this.#root = options.root;
    this.#sessionClient = options.sessionClient;
    this.#playtestClient = options.playtestClient;
    this.#startGame = options.startGame;
    this.#resetLocalState = options.resetLocalState;
    this.#openFirstScreen = options.openFirstScreen;
    this.#navigate = options.navigate ?? ((path) => window.location.assign(path));
    this.#createOperationId =
      options.createOperationId ?? createTeacherPlaytestOperationId;
  }

  async mount(): Promise<void> {
    this.#root.dataset.admarketRoute = "teacher-playtest";
    this.#root.replaceChildren();
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent = "Checking teacher access…";
    this.#root.append(status);

    let authenticated = false;
    try {
      authenticated = (await this.#sessionClient.session()).authenticated;
    } catch {
      this.#renderBoundary(
        "Teacher playtest unavailable",
        "Teacher access could not be checked. Check the connection and try again."
      );
      return;
    }
    if (!authenticated) {
      this.#renderBoundary(
        "Teacher sign-in required",
        "Sign in on the teacher dashboard before opening the teacher playtest."
      );
      return;
    }

    this.#renderStrip();
    try {
      await this.#startGame();
    } catch {
      this.#renderBoundary(
        "Teacher playtest unavailable",
        "The teacher playtest could not open. Return to the dashboard and try again."
      );
    }
  }

  #renderBoundary(headingText: string, message: string): void {
    const main = document.createElement("main");
    main.className = "teacher-page teacher-login";
    main.tabIndex = -1;
    const heading = document.createElement("h1");
    heading.textContent = headingText;
    const explanation = document.createElement("p");
    explanation.textContent = message;
    const returnButton = actionButton("Return to teacher dashboard");
    returnButton.addEventListener("click", () => this.#navigate("/teacher"));
    main.append(heading, explanation, returnButton);
    this.#root.replaceChildren(main);
    main.focus();
  }

  #renderStrip(): void {
    const strip = document.createElement("header");
    strip.className = "teacher-playtest-strip";
    strip.setAttribute("role", "banner");
    strip.setAttribute("aria-label", "Teacher playtest");
    const identity = document.createElement("strong");
    identity.textContent = "Teacher playtest";
    const description = document.createElement("span");
    description.textContent = "Isolated from every pair account.";
    const actions = document.createElement("div");
    actions.className = "teacher-playtest-strip__actions";
    const dashboard = actionButton("Return to teacher dashboard");
    dashboard.addEventListener("click", () => this.#navigate("/teacher"));
    const reset = actionButton("Factory reset playtest");
    reset.className = "teacher-button--danger";
    reset.addEventListener("click", () => this.#openResetDialog(reset));
    actions.append(dashboard, reset);
    strip.append(identity, description, actions);
    this.#root.replaceChildren(strip);
  }

  #openResetDialog(trigger: HTMLButtonElement): void {
    const operationId = this.#createOperationId();
    const dialog = document.createElement("dialog");
    dialog.className = "teacher-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("open", "");
    const title = document.createElement("h2");
    title.id = `teacher-playtest-reset-${operationId}`;
    title.textContent = "Factory reset teacher playtest";
    dialog.setAttribute("aria-labelledby", title.id);
    const explanation = document.createElement("p");
    explanation.textContent =
      "This removes the teacher playtest's saved campaign progress and campaign assets " +
      "from cloud storage and this browser. Student pair accounts and their work remain unchanged.";
    const form = document.createElement("form");
    form.setAttribute("aria-label", "Confirm teacher playtest factory reset");
    const label = document.createElement("label");
    label.textContent = "Type RESET to confirm";
    const confirmation = document.createElement("input");
    confirmation.type = "text";
    confirmation.autocomplete = "off";
    confirmation.spellcheck = false;
    label.append(confirmation);
    const error = document.createElement("p");
    error.className = "teacher-form-error";
    error.setAttribute("role", "alert");
    error.setAttribute("aria-live", "assertive");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "teacher-dialog__actions";
    const cancel = actionButton("Cancel");
    const confirm = document.createElement("button");
    confirm.type = "submit";
    confirm.textContent = "Factory reset playtest";
    confirm.className = "teacher-button--danger";
    actions.append(cancel, confirm);
    form.append(label, error, actions);
    dialog.append(title, explanation, form);
    this.#root.append(dialog);

    let pending = false;
    const close = (): void => {
      if (pending) return;
      dialog.remove();
      trigger.focus();
    };
    cancel.addEventListener("click", close);
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (pending) return;
      if (confirmation.value !== "RESET") {
        error.textContent = "Type RESET exactly to confirm.";
        error.hidden = false;
        confirmation.focus();
        return;
      }
      pending = true;
      confirmation.disabled = true;
      cancel.disabled = true;
      confirm.disabled = true;
      error.hidden = true;
      void this.#playtestClient.reset({
        operationId,
        confirmation: "RESET"
      }).then(async () => {
        await this.#resetLocalState();
        this.#openFirstScreen();
      }).catch(() => {
        pending = false;
        confirmation.disabled = false;
        cancel.disabled = false;
        confirm.disabled = false;
        error.textContent =
          "The teacher playtest could not be reset. Check the connection and try again.";
        error.hidden = false;
        confirmation.focus();
      });
    });
    confirmation.focus();
  }
}
```

## File: `web/src/ui/studio-split-pane.ts`

```typescript
export interface StudioSplitPaneStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StudioSplitPaneOptions {
  readonly root: HTMLElement;
  readonly browsePane: HTMLElement;
  readonly designPane: HTMLElement;
  readonly separator: HTMLElement;
  readonly narrowQuery?: MediaQueryList;
  readonly initialPercent?: number;
  readonly minimumPercent?: number;
  readonly maximumPercent?: number;
  readonly storage?: StudioSplitPaneStorage | null;
  readonly storageKey?: string;
}

type NarrowPane = "browse" | "edit";

const DEFAULT_NARROW_QUERY = "(max-width: 900px)";
export const STUDENT_STUDIO_SPLIT_STORAGE_KEY = "admarket:studio-split:student:v1";
export const TEACHER_PLAYTEST_STUDIO_SPLIT_STORAGE_KEY =
  "admarket:studio-split:teacher-playtest:v1";

function finitePercent(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function browseFraction(percent: number): string {
  const ratio = percent / (100 - percent);
  return `${Number(ratio.toFixed(6))}fr`;
}

export class StudioSplitPane {
  readonly #root: HTMLElement;
  readonly #browsePane: HTMLElement;
  readonly #designPane: HTMLElement;
  readonly #separator: HTMLElement;
  readonly #narrowQuery: MediaQueryList | null;
  readonly #tabs: HTMLElement | null;
  readonly #browseTab: HTMLButtonElement | null;
  readonly #editTab: HTMLButtonElement | null;
  readonly #minimumPercent: number;
  readonly #maximumPercent: number;
  readonly #defaultPercent: number;
  readonly #storage: StudioSplitPaneStorage | null;
  readonly #storageKey: string | null;
  #percent: number;
  #narrowPane: NarrowPane = "browse";
  #activePointerId: number | null = null;
  #destroyed = false;

  constructor(options: StudioSplitPaneOptions) {
    this.#root = options.root;
    this.#browsePane = options.browsePane;
    this.#designPane = options.designPane;
    this.#separator = options.separator;
    this.#minimumPercent = finitePercent(options.minimumPercent, 25);
    this.#maximumPercent = finitePercent(options.maximumPercent, 75);
    if (
      this.#minimumPercent < 0 ||
      this.#maximumPercent > 100 ||
      this.#minimumPercent >= this.#maximumPercent
    ) {
      throw new Error("Studio split-pane percentage limits are invalid.");
    }
    this.#defaultPercent = this.#clamp(finitePercent(options.initialPercent, 40));
    this.#storage = options.storage ?? null;
    this.#storageKey = typeof options.storageKey === "string" && options.storageKey.length > 0
      ? options.storageKey
      : null;
    this.#percent = this.#readStoredPercent() ?? this.#defaultPercent;
    this.#narrowQuery = options.narrowQuery ??
      (typeof globalThis.matchMedia === "function"
        ? globalThis.matchMedia(DEFAULT_NARROW_QUERY)
        : null);
    this.#tabs = this.#root.querySelector<HTMLElement>("[data-studio-pane-tabs]");
    this.#browseTab = this.#root.querySelector<HTMLButtonElement>(
      '[data-studio-pane-tab="browse"]'
    );
    this.#editTab = this.#root.querySelector<HTMLButtonElement>(
      '[data-studio-pane-tab="edit"]'
    );

    this.#separator.setAttribute("role", "separator");
    this.#separator.setAttribute(
      "aria-label",
      "Resize the library and design areas"
    );
    this.#separator.setAttribute("aria-orientation", "vertical");
    this.#separator.setAttribute("aria-valuemin", String(this.#minimumPercent));
    this.#separator.setAttribute("aria-valuemax", String(this.#maximumPercent));
    const hint = this.#root.querySelector<HTMLElement>("[data-studio-split-hint]");
    if (hint?.id) this.#separator.setAttribute("aria-describedby", hint.id);
    this.#separator.addEventListener("pointerdown", this.#onPointerDown);
    this.#separator.addEventListener("keydown", this.#onKeyDown);
    this.#separator.addEventListener("dblclick", this.#onDoubleClick);
    this.#browseTab?.addEventListener("click", this.#onBrowseClick);
    this.#editTab?.addEventListener("click", this.#onEditClick);
    this.#narrowQuery?.addEventListener("change", this.#onNarrowChange);
    this.#renderPercent();
    this.#renderMode();
  }

  setPercent(percent: number): void {
    if (this.#destroyed || !Number.isFinite(percent)) return;
    this.#percent = this.#clamp(percent);
    this.#renderPercent();
    this.#persistPercent();
  }

  getPercent(): number {
    return this.#percent;
  }

  reset(): void {
    if (this.#destroyed) return;
    this.#percent = this.#defaultPercent;
    this.#renderPercent();
    if (this.#storage === null || this.#storageKey === null) return;
    try {
      this.#storage.removeItem(this.#storageKey);
    } catch {
      // The layout remains usable when browser preference storage is unavailable.
    }
  }

  selectNarrowPane(pane: NarrowPane): void {
    if (this.#destroyed || (pane !== "browse" && pane !== "edit")) return;
    this.#narrowPane = pane;
    if (this.#narrowQuery?.matches) this.#renderNarrowPane();
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#finishPointer();
    this.#separator.removeEventListener("pointerdown", this.#onPointerDown);
    this.#separator.removeEventListener("keydown", this.#onKeyDown);
    this.#separator.removeEventListener("dblclick", this.#onDoubleClick);
    this.#browseTab?.removeEventListener("click", this.#onBrowseClick);
    this.#editTab?.removeEventListener("click", this.#onEditClick);
    this.#narrowQuery?.removeEventListener("change", this.#onNarrowChange);
    delete this.#root.dataset.studioNarrow;
    this.#browsePane.hidden = false;
    this.#designPane.hidden = false;
    if (this.#tabs) this.#tabs.hidden = true;
    this.#separator.tabIndex = 0;
  }

  #clamp(percent: number): number {
    return Math.min(this.#maximumPercent, Math.max(this.#minimumPercent, percent));
  }

  #readStoredPercent(): number | null {
    if (this.#storage === null || this.#storageKey === null) return null;
    try {
      const stored = this.#storage.getItem(this.#storageKey);
      if (stored === null || !/^\d+(?:\.\d+)?$/.test(stored)) return null;
      const percent = Number(stored);
      return Number.isFinite(percent) ? this.#clamp(percent) : null;
    } catch {
      return null;
    }
  }

  #persistPercent(): void {
    if (this.#storage === null || this.#storageKey === null) return;
    try {
      this.#storage.setItem(
        this.#storageKey,
        String(Number(this.#percent.toFixed(4)))
      );
    } catch {
      // The resize succeeds even when browser preference storage is unavailable.
    }
  }

  #renderPercent(): void {
    this.#root.style.setProperty("--studio-browse-percent", `${this.#percent}%`);
    this.#root.style.setProperty("--studio-browse-width", browseFraction(this.#percent));
    this.#separator.setAttribute("aria-valuenow", String(this.#percent));
    this.#separator.setAttribute(
      "aria-valuetext",
      `${Number(this.#percent.toFixed(2))} percent library, ` +
      `${Number((100 - this.#percent).toFixed(2))} percent design`
    );
  }

  #renderMode(): void {
    if (this.#narrowQuery?.matches) {
      this.#root.dataset.studioNarrow = "true";
      this.#separator.tabIndex = -1;
      if (this.#tabs) this.#tabs.hidden = false;
      this.#renderNarrowPane();
      return;
    }
    delete this.#root.dataset.studioNarrow;
    this.#separator.tabIndex = 0;
    if (this.#tabs) this.#tabs.hidden = true;
    this.#browsePane.hidden = false;
    this.#designPane.hidden = false;
  }

  #renderNarrowPane(): void {
    const browseSelected = this.#narrowPane === "browse";
    this.#browsePane.hidden = !browseSelected;
    this.#designPane.hidden = browseSelected;
    if (this.#browseTab) {
      this.#browseTab.setAttribute("aria-selected", String(browseSelected));
      this.#browseTab.tabIndex = browseSelected ? 0 : -1;
    }
    if (this.#editTab) {
      this.#editTab.setAttribute("aria-selected", String(!browseSelected));
      this.#editTab.tabIndex = browseSelected ? -1 : 0;
    }
  }

  #finishPointer(): void {
    const pointerId = this.#activePointerId;
    if (pointerId === null) return;
    this.#activePointerId = null;
    window.removeEventListener("pointermove", this.#onPointerMove);
    window.removeEventListener("pointerup", this.#onPointerEnd);
    window.removeEventListener("pointercancel", this.#onPointerEnd);
    try {
      this.#separator.releasePointerCapture(pointerId);
    } catch {
      // The browser may already have released capture after cancellation.
    }
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (this.#destroyed || event.button !== 0 || this.#narrowQuery?.matches) return;
    event.preventDefault();
    this.#finishPointer();
    this.#activePointerId = event.pointerId;
    try {
      this.#separator.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; window listeners retain the drag.
    }
    window.addEventListener("pointermove", this.#onPointerMove);
    window.addEventListener("pointerup", this.#onPointerEnd);
    window.addEventListener("pointercancel", this.#onPointerEnd);
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.#activePointerId) return;
    const bounds = this.#root.getBoundingClientRect();
    if (!Number.isFinite(bounds.width) || bounds.width <= 0) return;
    const browseBounds = this.#browsePane.getBoundingClientRect();
    const separatorBounds = this.#separator.getBoundingClientRect();
    const browseLeft = Number.isFinite(browseBounds.left) &&
      browseBounds.left >= bounds.left &&
      browseBounds.left <= bounds.right
      ? browseBounds.left
      : bounds.left;
    const separatorWidth = Number.isFinite(separatorBounds.width)
      ? Math.max(0, separatorBounds.width)
      : 0;
    const availableWidth = bounds.right - browseLeft - separatorWidth;
    if (availableWidth <= 0) return;
    const browseWidth = event.clientX - browseLeft - separatorWidth / 2;
    this.setPercent((browseWidth / availableWidth) * 100);
  };

  readonly #onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.#activePointerId) return;
    this.#finishPointer();
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      this.reset();
      return;
    }
    let percent: number | null = null;
    const step = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowLeft") percent = this.#percent - step;
    if (event.key === "ArrowRight") percent = this.#percent + step;
    if (event.key === "Home") percent = this.#minimumPercent;
    if (event.key === "End") percent = this.#maximumPercent;
    if (percent === null) return;
    event.preventDefault();
    this.setPercent(percent);
  };

  readonly #onDoubleClick = (): void => {
    this.reset();
  };

  readonly #onBrowseClick = (): void => {
    this.selectNarrowPane("browse");
  };

  readonly #onEditClick = (): void => {
    this.selectNarrowPane("edit");
  };

  readonly #onNarrowChange = (): void => {
    if (!this.#destroyed) this.#renderMode();
  };
}
```

## File: `web/src/tools/section-fill-controller.ts`

```typescript
import type {
  CanvasObjectSummary,
  CanvasPoint,
  FillableRasterSnapshot,
  RasterSectionFillRecipe
} from "../fabric/canvas-port";

type AnnouncementPriority = "polite" | "assertive";

interface SectionFillPort {
  listObjectSummaries(): readonly CanvasObjectSummary[];
  getFillableRaster(id: string): Promise<FillableRasterSnapshot | null>;
  rasterSourcePoint(id: string, clientPoint: CanvasPoint): CanvasPoint;
  previewRasterSectionFill(id: string, recipe: RasterSectionFillRecipe): Promise<void>;
  cancelRasterSectionFillPreview(id: string): void;
  applyRasterSectionFill(id: string, recipe: RasterSectionFillRecipe): Promise<void>;
}

export interface SectionFillControllerOptions {
  readonly host: HTMLElement;
  readonly canvas: HTMLElement;
  readonly port: SectionFillPort;
  readonly transaction: (operation: () => Promise<void>) => Promise<void>;
  readonly announce: (message: string, priority: AnnouncementPriority) => void;
  readonly mutationControls?: readonly HTMLButtonElement[];
  readonly onPreviewStateChange?: (active: boolean) => void;
}

type FillPhase = "idle" | "choose-section" | "preview";

const DEFAULT_FILL_COLOUR = "#e4572e";

function unavailableReason(summary: CanvasObjectSummary): string {
  if (summary.accessibleName.startsWith("Market price ")) {
    return "Price styling uses the Price controls.";
  }
  switch (summary.elementKind) {
    case "text": return "Text uses its own colour controls.";
    case "logo-mark": return "Logo colours are edited in Logo Lab.";
    case "drawing": return "Drawing colour is fixed when the stroke is created.";
    case "product-shell":
    case "product-kit":
      return "Product Kit colours use their named product controls.";
    case "shape": return "Shape colour is fixed when the shape is created.";
    case "masked-component": return "This product component uses its product controls.";
    case "image": return "Section fill is unavailable for this image.";
  }
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function recipeFor(
  raster: FillableRasterSnapshot,
  colour: string,
  point: CanvasPoint
): RasterSectionFillRecipe {
  return Object.freeze({
    schema: "raster-section-fill",
    version: 1,
    fillProfile: raster.sectionMode === "connected"
      ? "bounded-linework-v1"
      : "opaque-body-v1",
    sourceAssetId: raster.assetId,
    sourceSha256: raster.sourceSha256,
    seedX: Math.floor(point.x),
    seedY: Math.floor(point.y),
    colour: colour.toUpperCase(),
    colourDistance: raster.sectionMode === "connected" ? 48 : 0
  });
}

export class SectionFillController {
  readonly #host: HTMLElement;
  readonly #canvas: HTMLElement;
  readonly #port: SectionFillPort;
  readonly #transaction: SectionFillControllerOptions["transaction"];
  readonly #announce: SectionFillControllerOptions["announce"];
  readonly #mutationControls: readonly HTMLButtonElement[];
  readonly #onPreviewStateChange: (active: boolean) => void;
  readonly #handleCanvasClick = (event: MouseEvent): void => {
    if (this.#phase !== "choose-section" || this.#raster === null) return;
    event.preventDefault();
    event.stopPropagation();
    const point = this.#port.rasterSourcePoint(this.#raster.id, {
      x: event.clientX,
      y: event.clientY
    });
    void this.#preview(recipeFor(this.#raster, this.#colour(), point));
  };
  readonly #handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || this.#phase === "idle") return;
    event.preventDefault();
    void this.#cancel();
  };
  #selectionId: string | null = null;
  #raster: FillableRasterSnapshot | null = null;
  #phase: FillPhase = "idle";
  #recipe: RasterSectionFillRecipe | null = null;
  #beginButton: HTMLButtonElement | null = null;
  #colourInput: HTMLInputElement | null = null;
  #disabledStates = new Map<HTMLButtonElement, boolean>();
  #generation = 0;

  constructor(options: SectionFillControllerOptions) {
    this.#host = options.host;
    this.#canvas = options.canvas;
    this.#port = options.port;
    this.#transaction = options.transaction;
    this.#announce = options.announce;
    this.#mutationControls = options.mutationControls ?? [];
    this.#onPreviewStateChange = options.onPreviewStateChange ?? (() => undefined);
    this.#canvas.addEventListener("click", this.#handleCanvasClick, true);
    document.addEventListener("keydown", this.#handleKeydown);
    this.#host.hidden = true;
  }

  async setSelection(id: string | null): Promise<void> {
    const generation = ++this.#generation;
    if (this.#phase !== "idle" && this.#selectionId !== null) {
      this.#port.cancelRasterSectionFillPreview(this.#selectionId);
    }
    this.#restoreMutationControls();
    this.#canvas.style.cursor = "";
    this.#phase = "idle";
    this.#onPreviewStateChange(false);
    this.#recipe = null;
    this.#selectionId = id;
    this.#raster = null;
    this.#beginButton = null;
    this.#colourInput = null;
    this.#host.replaceChildren();
    if (id === null) {
      this.#host.hidden = true;
      return;
    }
    const summary = this.#port.listObjectSummaries().find((candidate) => candidate.id === id);
    if (!summary) {
      this.#host.hidden = true;
      return;
    }
    const fillable = await this.#port.getFillableRaster(id);
    if (generation !== this.#generation || this.#selectionId !== id) return;
    this.#host.hidden = false;
    if (fillable === null) {
      this.#renderUnavailable(summary);
      return;
    }
    this.#raster = fillable;
    this.#renderEligible(summary, fillable);
  }

  destroy(): void {
    if (this.#phase !== "idle" && this.#selectionId !== null) {
      this.#port.cancelRasterSectionFillPreview(this.#selectionId);
    }
    this.#restoreMutationControls();
    this.#onPreviewStateChange(false);
    this.#canvas.style.cursor = "";
    this.#canvas.removeEventListener("click", this.#handleCanvasClick, true);
    document.removeEventListener("keydown", this.#handleKeydown);
    this.#host.replaceChildren();
    this.#host.hidden = true;
  }

  #renderUnavailable(summary: CanvasObjectSummary): void {
    const heading = node("h3", undefined, "Colour selected item");
    const status = node("p", "creator__section-fill-status", unavailableReason(summary));
    this.#host.replaceChildren(heading, status);
  }

  #renderEligible(
    summary: CanvasObjectSummary,
    raster: FillableRasterSnapshot
  ): void {
    const heading = node("h3", undefined, "Colour selected item");
    const status = node(
      "p",
      "creator__section-fill-status",
      raster.sectionMode === "connected"
        ? "Choose a closed product section, then preview a colour."
        : "Preview one colour across this product object."
    );
    status.dataset.sectionFillStatus = "";
    const label = node("label", "creator__section-fill-colour", "Fill colour");
    const colour = node("input");
    colour.type = "color";
    colour.value = DEFAULT_FILL_COLOUR;
    colour.setAttribute("aria-label", "Fill colour");
    label.append(colour);
    const actions = node("div", "creator__section-fill-actions");
    const begin = node(
      "button",
      undefined,
      raster.sectionMode === "connected" ? "Fill section" : "Fill object"
    );
    begin.type = "button";
    begin.addEventListener("click", () => {
      if (raster.sectionMode === "connected") {
        this.#phase = "choose-section";
        this.#onPreviewStateChange(true);
        this.#canvas.style.cursor = "crosshair";
        this.#setMutationControlsDisabled(true);
        status.textContent = "Choose a closed section on the product.";
        this.#renderChoosingActions();
        this.#announce(
          `Choose one bounded section of ${summary.accessibleName}.`,
          "polite"
        );
      } else {
        void this.#preview(recipeFor(raster, this.#colour(), {
          x: raster.width / 2,
          y: raster.height / 2
        }));
      }
    });
    this.#beginButton = begin;
    this.#colourInput = colour;
    actions.append(begin);
    this.#host.replaceChildren(heading, status, label, actions);
  }

  async #preview(recipe: RasterSectionFillRecipe): Promise<void> {
    const raster = this.#raster;
    if (raster === null || raster.id !== this.#selectionId) return;
    this.#setMutationControlsDisabled(true);
    this.#onPreviewStateChange(true);
    try {
      await this.#port.previewRasterSectionFill(raster.id, recipe);
      if (raster.id !== this.#selectionId) return;
      this.#recipe = recipe;
      this.#phase = "preview";
      this.#canvas.style.cursor = "";
      this.#renderPreviewActions();
      this.#announce("Fill preview ready. Apply it or cancel.", "polite");
    } catch (error) {
      this.#phase = raster.sectionMode === "connected" ? "choose-section" : "idle";
      this.#recipe = null;
      this.#canvas.style.cursor = this.#phase === "choose-section" ? "crosshair" : "";
      if (this.#phase === "idle") this.#restoreMutationControls();
      if (this.#phase === "idle") this.#onPreviewStateChange(false);
      const message = error instanceof Error ? error.message : "The fill preview could not be created.";
      const status = this.#host.querySelector<HTMLElement>("[data-section-fill-status]");
      if (status) status.textContent = `${message} Choose another section.`;
      this.#announce(message, "assertive");
    }
  }

  #renderPreviewActions(): void {
    const actions = this.#host.querySelector<HTMLElement>(".creator__section-fill-actions");
    if (!actions) return;
    const apply = node("button", undefined, "Apply fill");
    apply.type = "button";
    apply.addEventListener("click", () => { void this.#apply(); });
    const cancel = node("button", undefined, "Cancel fill");
    cancel.type = "button";
    cancel.addEventListener("click", () => { void this.#cancel(); });
    actions.replaceChildren(apply, cancel);
    const status = this.#host.querySelector<HTMLElement>("[data-section-fill-status]");
    if (status) status.textContent = "Preview shown. Apply the fill or cancel it.";
  }

  #renderChoosingActions(): void {
    const actions = this.#host.querySelector<HTMLElement>(".creator__section-fill-actions");
    if (!actions) return;
    const cancel = node("button", undefined, "Cancel fill");
    cancel.type = "button";
    cancel.addEventListener("click", () => { void this.#cancel(); });
    actions.replaceChildren(cancel);
  }

  async #apply(): Promise<void> {
    const raster = this.#raster;
    const recipe = this.#recipe;
    if (raster === null || recipe === null || raster.id !== this.#selectionId) return;
    try {
      this.#port.cancelRasterSectionFillPreview(raster.id);
      await this.#transaction(async () => {
        await this.#port.applyRasterSectionFill(raster.id, recipe);
      });
      this.#phase = "idle";
      this.#onPreviewStateChange(false);
      this.#recipe = null;
      this.#restoreMutationControls();
      this.#canvas.style.cursor = "";
      this.#announce("Fill applied.", "polite");
      await this.setSelection(raster.id);
    } catch (error) {
      this.#phase = "idle";
      this.#onPreviewStateChange(false);
      this.#recipe = null;
      this.#restoreMutationControls();
      this.#canvas.style.cursor = "";
      const message = error instanceof Error ? error.message : "The fill could not be applied.";
      this.#announce(message, "assertive");
      await this.setSelection(raster.id);
    }
  }

  async #cancel(): Promise<void> {
    const id = this.#selectionId;
    if (id !== null) this.#port.cancelRasterSectionFillPreview(id);
    this.#phase = "idle";
    this.#onPreviewStateChange(false);
    this.#recipe = null;
    this.#restoreMutationControls();
    this.#canvas.style.cursor = "";
    if (this.#raster !== null && id !== null) await this.setSelection(id);
    this.#beginButton?.focus();
    this.#announce("Fill cancelled. The image is unchanged.", "polite");
  }

  #colour(): string {
    return this.#colourInput?.value || DEFAULT_FILL_COLOUR;
  }

  #setMutationControlsDisabled(disabled: boolean): void {
    if (!disabled) {
      this.#restoreMutationControls();
      return;
    }
    for (const control of this.#mutationControls) {
      if (!this.#disabledStates.has(control)) this.#disabledStates.set(control, control.disabled);
      control.disabled = true;
    }
  }

  #restoreMutationControls(): void {
    for (const [control, disabled] of this.#disabledStates) control.disabled = disabled;
    this.#disabledStates.clear();
  }
}
```

## File: `web/src/game/guided-journey-controller.ts`

```typescript
import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { creatorStageAllows } from "./creator-level-access";
import {
  evaluateGuidedJourney,
  type GuidedJourneyStep
} from "./guided-journey";
import { INSTRUCTION_ARGUMENT } from "./instruction-argument";
import { ROLE_GUIDE } from "./role-guide-controller";
import { STUDENT_COPY } from "./student-copy";

type OpenGuidedJourneyStep = (step: GuidedJourneyStep) => void;

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Guided journey is missing ${selector}`);
  return element;
}

export class GuidedJourneyController {
  readonly #guide: HTMLElement;
  readonly #progress: HTMLElement;
  readonly #title: HTMLElement;
  readonly #now: HTMLElement;
  readonly #why: HTMLElement;
  readonly #done: HTMLElement;
  readonly #next: HTMLElement;
  readonly #methods: HTMLDetailsElement;
  readonly #methodList: HTMLUListElement;
  readonly #openTool: HTMLButtonElement;
  readonly #reviewButtons: readonly HTMLButtonElement[];
  readonly #dialog: HTMLElement;
  readonly #close: HTMLButtonElement;
  readonly #reference: HTMLElement;
  readonly #lockStatus: HTMLElement;
  readonly #protectedSurfaces: readonly HTMLElement[];
  #current: GuidedJourneyStep | null = null;
  #returnFocus: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly openStep: OpenGuidedJourneyStep
  ) {
    this.#guide = required(root, "[data-guide]");
    this.#progress = required(root, "[data-guide-progress]");
    this.#title = required(root, "[data-guide-title]");
    this.#now = required(root, "[data-guide-now]");
    this.#why = required(root, "[data-guide-why]");
    this.#done = required(root, "[data-guide-done]");
    this.#next = required(root, "[data-guide-next]");
    this.#methods = required(root, "[data-guide-methods]");
    this.#methodList = required(root, "[data-guide-method-list]");
    this.#openTool = required(root, "[data-guide-open-tool]");
    this.#reviewButtons = Object.freeze([
      required<HTMLButtonElement>(root, "[data-guide-review]"),
      required<HTMLButtonElement>(root, "[data-guide-review-top]")
    ]);
    this.#dialog = required(root, "[data-guide-dialog]");
    this.#close = required(root, "[data-guide-close]");
    this.#reference = required(root, "[data-guide-reference]");
    this.#lockStatus = required(root, "[data-locked-actions-status]");
    const dialogParent = this.#dialog.parentElement;
    if (dialogParent === null) throw new Error("Guided journey dialog has no parent");
    this.#protectedSurfaces = Object.freeze(
      [...dialogParent.children].filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== this.#dialog
      )
    );
    this.#renderReference();

    this.#openTool.addEventListener("click", this.#onOpenTool);
    for (const button of this.#reviewButtons) {
      button.addEventListener("click", this.#onReview);
    }
    this.#close.addEventListener("click", this.#onClose);
    this.#dialog.addEventListener("keydown", this.#onDialogKeydown);
  }

  setCampaign(document: CampaignDocumentV1 | null): void {
    if (document === null) {
      this.#current = null;
      this.#guide.hidden = true;
      this.#closeDialog();
      return;
    }

    const state = evaluateGuidedJourney(document);
    this.#current = state.current;
    this.#guide.hidden = false;
    this.#progress.textContent = state.progressLabel;
    this.#title.textContent = state.current.title;
    this.#now.textContent = state.current.now;
    this.#why.textContent = state.current.why;
    this.#done.textContent = state.current.done;
    this.#next.textContent = state.current.next;
    const methods = state.current.optionalMethods ?? [];
    this.#methodList.replaceChildren(...methods.map((method) => {
      const item = this.#methodList.ownerDocument.createElement("li");
      item.textContent = method;
      return item;
    }));
    this.#methods.hidden = methods.length === 0;
    if (this.#methods.hidden) this.#methods.open = false;
    this.#openTool.textContent = state.current.actionLabel ??
      `${state.current.complete ? "Review" : "Open"} ${state.current.title}`;

    const completed = new Map(state.steps.map((step) => [step.id, step.complete]));
    this.#applySequentialAccess(document, completed);
  }

  destroy(): void {
    this.#openTool.removeEventListener("click", this.#onOpenTool);
    for (const button of this.#reviewButtons) {
      button.removeEventListener("click", this.#onReview);
    }
    this.#close.removeEventListener("click", this.#onClose);
    this.#dialog.removeEventListener("keydown", this.#onDialogKeydown);
    this.#closeDialog();
  }

  #applySequentialAccess(
    document: CampaignDocumentV1,
    completed: ReadonlyMap<string, boolean>
  ): void {
    const unavailable: Array<{
      readonly button: HTMLButtonElement;
      readonly label: string;
      readonly reason: string;
    }> = [];
    const setAvailability = (
      button: HTMLButtonElement,
      disabled: boolean,
      reason: string
    ): void => {
      button.disabled = disabled;
      button.removeAttribute("title");
      if (button.getAttribute("aria-describedby") === this.#lockStatus.id) {
        button.removeAttribute("aria-describedby");
      }
      if (disabled && !button.hidden) {
        unavailable.push({
          button,
          label: button.textContent?.trim() || button.getAttribute("aria-label") || "Action",
          reason
        });
      }
    };

    const aidaAllowed = creatorStageAllows(document.gameplay.stage, "aida") &&
      completed.get("pair-contribution") === true;
    const aidaOrder = ["attention", "interest", "desire", "action"] as const;
    for (const [index, stage] of aidaOrder.entries()) {
      const priorComplete = index === 0 || completed.get(aidaOrder[index - 1]!) === true;
      const stageComplete = completed.get(stage) === true;
      const button = required<HTMLButtonElement>(this.root, `[data-slot="${stage}"]`);
      const disabled = !stageComplete && (!aidaAllowed || !priorComplete);
      setAvailability(
        button,
        disabled,
        `Complete ${index === 0 ? "the pair contribution" : aidaOrder[index - 1]} first.`
      );
    }

    const allAidaComplete = aidaOrder.every((stage) => completed.get(stage) === true);
    const priceAllowed = creatorStageAllows(document.gameplay.stage, "price") && allAidaComplete;
    const priceChecklist = required<HTMLButtonElement>(this.root, '[data-slot="price"]');
    setAvailability(
      priceChecklist,
      !priceAllowed,
      "Complete Attention, Interest, Desire and Action first."
    );

    const routeTool = required<HTMLButtonElement>(this.root, '[data-studio-tool="route"]');
    const routeAllowed = creatorStageAllows(document.gameplay.stage, "route") &&
      completed.get("visible-price") === true;
    setAvailability(
      routeTool,
      !routeAllowed,
      "Set the product price and make it visible on the canvas first."
    );

    this.#lockStatus.textContent = unavailable
      .map(({ label, reason }) => `${label}: ${reason}`)
      .join(" ");
    this.#lockStatus.hidden = unavailable.length === 0;
    for (const { button } of unavailable) {
      button.setAttribute("aria-describedby", this.#lockStatus.id);
    }
  }

  #renderReference(): void {
    const fragment = document.createDocumentFragment();
    const foundations = document.createElement("div");
    foundations.className = "creator__guide-foundations";
    const foundationParagraphs = [
      [
        "What you are making: ",
        STUDENT_COPY.guideFoundations.product
      ],
      [
        "How to read this guide: ",
        `${STUDENT_COPY.guideFoundations.terms} ${STUDENT_COPY.guideFoundations.termsReassurance} Complete each linked action in order. You may return to completed work at any time.`
      ],
      [
        "How the pair roles work: ",
        `${ROLE_GUIDE.sharedAccess} ${ROLE_GUIDE.sameButtons} The Art Director leads decisions about how the product and advertisement look. The Strategist leads decisions about what the product and advertisement say, what they cost and why the offer is credible. ${ROLE_GUIDE.activeTurn} ${ROLE_GUIDE.recordedRole} ${ROLE_GUIDE.physicalUser}`
      ],
      [
        "How to read the audience brief: ",
        `${STUDENT_COPY.audienceBriefDefinitions.context} ${STUDENT_COPY.audienceBriefDefinitions.need} ${STUDENT_COPY.audienceBriefDefinitions.values} ${STUDENT_COPY.audienceBriefDefinitions.intendedEffect}`
      ]
    ] as const;
    for (const [labelText, bodyText] of foundationParagraphs) {
      const paragraph = document.createElement("p");
      const label = document.createElement("strong");
      label.textContent = labelText;
      paragraph.append(label, bodyText);
      foundations.append(paragraph);
    }
    fragment.append(foundations);

    for (const subargument of INSTRUCTION_ARGUMENT) {
      const section = document.createElement("section");
      section.dataset.instructionSubargument = subargument.id;
      const heading = document.createElement("h3");
      heading.textContent = `${subargument.id}. ${subargument.title}`;
      section.append(heading);

      const explanation = document.createElement("p");
      explanation.className = "creator__instruction-explanation";
      explanation.textContent = subargument.plainExplanation;
      section.append(explanation);

      const premises = subargument.claims.filter(({ kind }) => kind === "premise");
      const list = document.createElement("ol");
      if (premises.length > 0) {
        list.start = Number.parseInt(premises[0]!.id.slice(1), 10);
      }
      for (const premise of premises) {
        const item = document.createElement("li");
        item.value = Number.parseInt(premise.id.slice(1), 10);
        item.dataset.instructionClaimId = premise.id;
        item.textContent = premise.text;
        list.append(item);
      }
      section.append(list);

      const conclusion = subargument.claims.find(
        ({ id }) => id === subargument.conclusionId
      );
      if (conclusion !== undefined) {
        const paragraph = document.createElement("p");
        paragraph.dataset.instructionClaimId = conclusion.id;
        const label = document.createElement("strong");
        label.textContent = conclusion.kind === "overall-conclusion"
          ? "Overall conclusion: "
          : `Intermediate conclusion ${subargument.id}: `;
        paragraph.append(label, conclusion.text);
        section.append(paragraph);
      }
      fragment.append(section);
    }

    this.#reference.replaceChildren(fragment);
  }

  readonly #onOpenTool = (): void => {
    if (this.#current !== null) this.openStep(this.#current);
  };

  readonly #onReview = (event: Event): void => {
    this.#returnFocus = event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : null;
    for (const surface of this.#protectedSurfaces) surface.inert = true;
    this.#dialog.hidden = false;
    this.#dialog.setAttribute("open", "");
    this.#close.focus();
  };

  readonly #onClose = (): void => {
    this.#closeDialog(true);
  };

  readonly #onDialogKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.#closeDialog(true);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      this.#close.focus();
    }
  };

  #closeDialog(restoreFocus = false): void {
    if (!this.#dialog.hidden) {
      this.#dialog.hidden = true;
      this.#dialog.removeAttribute("open");
    }
    for (const surface of this.#protectedSurfaces) surface.inert = false;
    if (restoreFocus) this.#returnFocus?.focus();
    this.#returnFocus = null;
  }
}
```

## File: `web/src/game/role-guide-controller.ts`

```typescript
import type { CampaignDocumentV1 } from "../domain/campaign-document";

export const ROLE_GUIDE = Object.freeze({
  sharedAccess:
    "Both partners can use the same tools that are unlocked for the current level.",
  sameButtons:
    "The roles do not unlock different buttons.",
  activeTurn:
    "The partner in the active role should use the keyboard or trackpad for the next canvas change.",
  recordedRole:
    "The site labels each canvas change with the role that is active.",
  physicalUser:
    "It does not block tools or identify which person physically touched the device.",
  swapEffect:
    "Swap roles changes the active responsibility and the role recorded for later canvas changes.",
  retainedWork:
    "Earlier work and recorded contributions stay in the campaign.",
  artDirector: Object.freeze({
    label: "Art Director",
    responsibilities:
      "Controls the product's appearance, images, colour, arrangement and layout.",
    example:
      "For example, the Art Director can choose a product image, enlarge it, change a colour and decide where the headline sits."
  }),
  strategist: Object.freeze({
    label: "Strategist",
    responsibilities:
      "Controls the product name, advertising words, claim, price reasoning and market-route reasoning.",
    example:
      "For example, the Strategist can name the product, write its benefit, choose a suitable price and add a proof point."
  })
});

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Role guide is missing ${selector}`);
  return element;
}

export class RoleGuideController {
  readonly #layer: HTMLElement;
  readonly #dialog: HTMLElement;
  readonly #assignment: HTMLElement;
  readonly #openButton: HTMLButtonElement;
  readonly #closeButton: HTMLButtonElement;
  readonly #beginButton: HTMLButtonElement;
  #required = false;
  #hasCampaign = false;
  #returnFocus: HTMLElement | null = null;

  constructor(
    root: ParentNode,
    private readonly protectedSurface: HTMLElement,
    private readonly acknowledge: () => void,
    private readonly focusCurrentAction: () => void
  ) {
    this.#layer = required(root, "[data-role-guide-layer]");
    this.#dialog = required(root, "[data-role-guide-dialog]");
    this.#assignment = required(root, "[data-role-guide-assignment]");
    this.#openButton = required(root, "[data-role-guide-open]");
    this.#closeButton = required(root, "[data-role-guide-close]");
    this.#beginButton = required(root, "[data-role-guide-begin]");

    this.#openButton.addEventListener("click", this.#onOpen);
    this.#closeButton.addEventListener("click", this.#onClose);
    this.#beginButton.addEventListener("click", this.#onBegin);
    this.#dialog.addEventListener("keydown", this.#onKeydown);
  }

  setCampaign(document: CampaignDocumentV1 | null): void {
    this.#close(false);
    this.#hasCampaign = document !== null;
    if (document === null) return;

    const startingRole = document.gameplay.pair.activeRole === "art-director"
      ? ROLE_GUIDE.artDirector.label
      : ROLE_GUIDE.strategist.label;
    this.#assignment.textContent = `The ${startingRole} is the active role first.`;
    if (!document.gameplay.pair.roleGuideAcknowledged) {
      this.#open(true);
    }
  }

  destroy(): void {
    this.#openButton.removeEventListener("click", this.#onOpen);
    this.#closeButton.removeEventListener("click", this.#onClose);
    this.#beginButton.removeEventListener("click", this.#onBegin);
    this.#dialog.removeEventListener("keydown", this.#onKeydown);
    this.#close(false);
    this.#hasCampaign = false;
  }

  readonly #onOpen = (event: Event): void => {
    if (!this.#hasCampaign) return;
    this.#returnFocus = event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : null;
    this.#open(false);
  };

  readonly #onClose = (): void => {
    if (!this.#required) this.#close(true);
  };

  readonly #onBegin = (): void => {
    if (this.#required) {
      this.acknowledge();
      this.#required = false;
    }
    this.#close(false);
    this.focusCurrentAction();
  };

  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      if (this.#required) return;
      event.preventDefault();
      this.#close(true);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = [this.#closeButton, this.#beginButton]
      .filter((button) => !button.hidden);
    const activeIndex = focusable.indexOf(
      this.#dialog.ownerDocument.activeElement as HTMLButtonElement
    );
    const nextIndex = event.shiftKey
      ? (activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1)
      : (activeIndex + 1) % focusable.length;
    event.preventDefault();
    focusable[nextIndex]?.focus();
  };

  #open(requiredGuide: boolean): void {
    this.#required = requiredGuide;
    this.#closeButton.hidden = requiredGuide;
    this.#beginButton.textContent = requiredGuide ? "Begin work" : "Return to work";
    this.#layer.hidden = false;
    this.#dialog.setAttribute("open", "");
    this.protectedSurface.inert = true;
    this.#dialog.scrollTop = 0;
    (requiredGuide ? this.#dialog : this.#closeButton).focus();
  }

  #close(restoreFocus: boolean): void {
    const wasOpen = !this.#layer.hidden;
    this.#layer.hidden = true;
    this.#dialog.removeAttribute("open");
    this.protectedSurface.inert = false;
    this.#required = false;
    if (restoreFocus && wasOpen) this.#returnFocus?.focus();
    this.#returnFocus = null;
  }
}
```

## File: `web/src/game/guided-journey.ts`

```typescript
import type {
  CampaignDocumentV1,
  CampaignGameplayStage
} from "../domain/campaign-document";
import { hasPlacedProduct } from "../product-builder/product-price-subject";
import type { AidaStage } from "./aida-playbook";
import type { InstructionClaimId } from "./instruction-argument";

export const GUIDED_JOURNEY_ORDER = Object.freeze([
  "sign-in",
  "audience",
  "roles",
  "starter-product",
  "product-edit",
  "product-name",
  "pair-contribution",
  "attention",
  "interest",
  "desire",
  "action",
  "price-position",
  "visible-price",
  "market-route",
  "proof-point",
  "final-review",
  "market-entry",
  "scoring",
  "sign-out"
] as const);

export type GuidedJourneyRouteStepId = typeof GUIDED_JOURNEY_ORDER[number];

export type GuidedJourneyStepId =
  | GuidedJourneyRouteStepId
  | "finish-level-1"
  | "finish-level-2"
  | "finish-level-3";

export interface GuidedJourneyStep {
  readonly id: GuidedJourneyStepId;
  readonly stage: CampaignGameplayStage;
  readonly title: string;
  readonly now: string;
  readonly why: string;
  readonly done: string;
  readonly next: string;
  readonly tool: string;
  readonly claimIds: readonly InstructionClaimId[];
  readonly optionalMethods?: readonly string[];
  readonly aidaStage?: AidaStage;
  readonly actionLabel?: string;
  readonly complete: boolean;
}

export interface GuidedJourneyState {
  readonly steps: readonly GuidedJourneyStep[];
  readonly current: GuidedJourneyStep;
  readonly currentIndex: number;
  readonly allComplete: boolean;
  readonly progressLabel: string;
}

interface GuidedJourneyDefinition extends Omit<GuidedJourneyStep, "complete"> {
  readonly isComplete: (document: CampaignDocumentV1) => boolean;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function hasEvidence(document: CampaignDocumentV1, slot: AidaStage | "price"): boolean {
  return document.evidence[slot].some(hasText);
}

function hasAida(document: CampaignDocumentV1, stage: AidaStage): boolean {
  return hasText(document.strategy.aidaPlan[stage]) && hasEvidence(document, stage);
}

function claimIds(
  ...ids: readonly InstructionClaimId[]
): readonly InstructionClaimId[] {
  return Object.freeze(ids);
}

function aidaStep(
  id: AidaStage,
  why: string,
  next: string,
  claimIds: readonly InstructionClaimId[]
): GuidedJourneyDefinition {
  const title = id[0]!.toUpperCase() + id.slice(1);
  return Object.freeze({
    id,
    stage: "sell",
    title,
    now: `Complete ${title} by applying one visible technique and recording its explanation.`,
    why,
    done: `The ${title} explanation and its visible canvas evidence are recorded.`,
    next,
    tool: "aida",
    claimIds: Object.freeze([...claimIds]),
    aidaStage: id,
    actionLabel: "Open AIDA",
    isComplete: (document: CampaignDocumentV1) => hasAida(document, id)
  });
}

const DEFINITIONS: readonly GuidedJourneyDefinition[] = Object.freeze([
  Object.freeze({
    id: "sign-in",
    stage: "invent",
    title: "Sign in",
    now: "Sign in with the pair username and password supplied by the teacher.",
    why: "Signing in opens the saved campaign before the Audience brief.",
    done: "The pair name appears in the account status.",
    next: "Read the Audience brief.",
    tool: "account",
    claimIds: claimIds("P1"),
    actionLabel: "Sign in",
    isComplete: () => true
  }),
  Object.freeze({
    id: "audience",
    stage: "invent",
    title: "Audience brief",
    now: "Read the audience situation, need and values.",
    why: "The Audience brief establishes the evidence needed to confirm the Partner roles and later product choices.",
    done: "An audience brief is selected and its need and values are visible.",
    next: "Confirm the Partner roles.",
    tool: "audience",
    claimIds: claimIds("P2"),
    actionLabel: "Open audience brief",
    isComplete: (document: CampaignDocumentV1) => hasText(document.brief.targetAudienceId)
  }),
  Object.freeze({
    id: "roles",
    stage: "invent",
    title: "Partner roles",
    now: "Open the Role guide and confirm the Art Director and Strategist responsibilities.",
    why: "The Partner roles assign responsibility before the Starter product is chosen.",
    done: "The role guide has been acknowledged and the starting role is visible.",
    next: "Choose a Starter product.",
    tool: "roles",
    claimIds: claimIds("P3", "ICA"),
    actionLabel: "Open Role guide",
    isComplete: (document: CampaignDocumentV1) =>
      document.gameplay.pair.roleGuideAcknowledged
  }),
  Object.freeze({
    id: "starter-product",
    stage: "invent",
    title: "Starter product",
    now: "Place one starter product on the canvas.",
    why: "The Starter product supplies a workable object for the Product edit.",
    done: "One product appears on the canvas.",
    next: "Complete the Product edit.",
    tool: "product",
    claimIds: claimIds("P5", "P6"),
    actionLabel: "Open Build",
    isComplete: hasPlacedProduct
  }),
  Object.freeze({
    id: "product-edit",
    stage: "invent",
    title: "Product edit",
    now: "Change the placed product by moving, resizing, filling or replacing one part.",
    why: "The Product edit adapts the object for the audience before the Product name is added.",
    done: "The placed product shows a deliberate change after its initial placement.",
    next: "Add the Product name.",
    tool: "product",
    claimIds: claimIds("P7"),
    optionalMethods: Object.freeze([
      "Use Fill to change an eligible product section.",
      "Use Delete selected item to remove an unwanted part.",
      "Use Logo Lab to add a saved logo when the advertisement needs one.",
      "Image Lab is optional; its panel displays the pair's remaining uses."
    ]),
    actionLabel: "Open Build",
    isComplete: (document: CampaignDocumentV1) =>
      hasPlacedProduct(document) && document.gameplay.pair.artDirectorActions > 1
  }),
  Object.freeze({
    id: "product-name",
    stage: "invent",
    title: "Product name",
    now: "Enter a clear name in the Product name field.",
    why: "The Product name gives the advertisement a subject before the Pair contribution is completed.",
    done: "The Product name field contains saved text.",
    next: "Complete the Pair contribution.",
    tool: "product-name",
    claimIds: claimIds("P8", "ICB"),
    actionLabel: "Focus Product name",
    isComplete: (document: CampaignDocumentV1) => hasText(document.product.name)
  }),
  Object.freeze({
    id: "pair-contribution",
    stage: "invent",
    title: "Pair contribution",
    now: "Record one Art Director visual change, one Strategist message or strategy change, and one role swap.",
    why: "The Pair contribution combines deliberate visual and message decisions in the advertisement before Attention.",
    done: "Both partners have a recorded contribution and the roles have been swapped.",
    next: "Complete Attention.",
    tool: "pair",
    claimIds: claimIds("P10", "P11", "P12"),
    actionLabel: "Open pair controls",
    isComplete: (document: CampaignDocumentV1) =>
      document.gameplay.pair.handoffCount > 0 &&
      document.gameplay.pair.artDirectorActions > 0 &&
      document.gameplay.pair.strategistActions > 0
  }),
  aidaStep(
    "attention",
    "Attention gives the audience a reason to notice the advertisement before Interest.",
    "Complete Interest.",
    ["P13"]
  ),
  aidaStep(
    "interest",
    "Interest supplies evidence that prepares the audience to consider the product's value before Desire.",
    "Complete Desire.",
    ["P13"]
  ),
  aidaStep(
    "desire",
    "Desire links a product benefit to an audience need before Action.",
    "Complete Action.",
    ["P13"]
  ),
  aidaStep(
    "action",
    "Action states what the audience should do and completes the message before the offer receives a Price position.",
    "Choose the Price position.",
    ["P13", "ICC"]
  ),
  Object.freeze({
    id: "price-position",
    stage: "irresistible",
    title: "Price position",
    now: "Choose one audience price position.",
    why: "The Price position explains the offer before the Visible price is added.",
    done: "One price position is selected.",
    next: "Complete the Visible price.",
    tool: "price",
    claimIds: claimIds("P15", "P16"),
    actionLabel: "Open Price",
    isComplete: (document: CampaignDocumentV1) => document.product.pricePosition !== null
  }),
  Object.freeze({
    id: "visible-price",
    stage: "irresistible",
    title: "Visible price",
    now: "Complete the visible price by setting the amount and choosing Add price to design.",
    why: "The Visible price makes the offer clear before the Market route is chosen.",
    done: "The saved amount and one price label are present.",
    next: "Choose the Market route.",
    tool: "price",
    claimIds: claimIds("P16"),
    actionLabel: "Open Price",
    isComplete: (document: CampaignDocumentV1) =>
      document.product.priceCents !== null && hasEvidence(document, "price")
  }),
  Object.freeze({
    id: "market-route",
    stage: "irresistible",
    title: "Market route",
    now: "Choose one market zone and one or more advertising media.",
    why: "The Market route identifies where the audience will encounter the advertisement before the Proof point.",
    done: "A market zone and at least one advertising medium are recorded.",
    next: "Add the Proof point.",
    tool: "route",
    claimIds: claimIds("P17"),
    actionLabel: "Open Market Route",
    isComplete: (document: CampaignDocumentV1) =>
      document.strategy.marketRoute?.committed === true &&
      hasText(document.strategy.marketRoute.zoneId) &&
      document.strategy.marketRoute.mediaIds.length > 0
  }),
  Object.freeze({
    id: "proof-point",
    stage: "irresistible",
    title: "Proof point",
    now: "Submit the market route with one accurate proof point.",
    why: "The Proof point supports the main claim before the Final review.",
    done: "The submitted route contains a saved proof point.",
    next: "Complete the Final review.",
    tool: "route",
    claimIds: claimIds("P18", "ICD"),
    actionLabel: "Open Market Route",
    isComplete: (document: CampaignDocumentV1) =>
      document.strategy.marketRoute?.committed === true &&
      hasText(document.strategy.marketRoute.proofPoint)
  }),
  Object.freeze({
    id: "final-review",
    stage: "publish-check",
    title: "Final review",
    now: "Check all five final-review statements and build the market card.",
    why: "The Final review tests the saved evidence before Market entry.",
    done: "All five statements are confirmed and the market card is built.",
    next: "Complete Market entry.",
    tool: "game",
    claimIds: claimIds("P20", "P21", "P22"),
    actionLabel: "Return to game",
    isComplete: () => false
  }),
  Object.freeze({
    id: "market-entry",
    stage: "publish-check",
    title: "Market entry",
    now: "Select Enter market.",
    why: "Market entry makes the completed campaign available before Scoring.",
    done: "The campaign appears in the market.",
    next: "Begin Scoring.",
    tool: "game",
    claimIds: claimIds("P23"),
    actionLabel: "Enter market",
    isComplete: () => false
  }),
  Object.freeze({
    id: "scoring",
    stage: "publish-check",
    title: "Scoring",
    now: "Score every other advertisement using the five review criteria.",
    why: "Scoring applies the same criteria to every advertisement before Sign out.",
    done: "Every other advertisement has five scores and a medal decision.",
    next: "Complete Sign out.",
    tool: "game",
    claimIds: claimIds("P24", "C"),
    actionLabel: "Open scoring",
    isComplete: () => false
  }),
  Object.freeze({
    id: "sign-out",
    stage: "publish-check",
    title: "Sign out",
    now: "Select Sign out when the pair has finished.",
    why: "Sign out closes the pair's work so the next pair can use the device.",
    done: "The pair sign-in form is visible and the previous pair's work is closed.",
    next: "The guided route is complete.",
    tool: "account",
    claimIds: claimIds("C"),
    actionLabel: "Sign out",
    isComplete: () => false
  })
]);

const LEVEL_TRANSITIONS: Readonly<Record<
  CampaignGameplayStage,
  { readonly step: GuidedJourneyStep; readonly progressLabel: string }
>> = Object.freeze({
  invent: Object.freeze({
    progressLabel: "Level 1 studio work complete",
    step: Object.freeze({
      id: "finish-level-1",
      stage: "invent",
      title: "Finish Level 1",
      now: "Return to the game and lock Level 1.",
      why: "Locking Level 1 records the product and opens Level 2, where the pair will create the AIDA message.",
      done: "Level 1 is locked and Level 2 is available.",
      next: "Open the creative studio and complete Attention.",
      tool: "game",
      claimIds: claimIds("ICB"),
      actionLabel: "Return to game",
      complete: false
    })
  }),
  sell: Object.freeze({
    progressLabel: "Level 2 studio work complete",
    step: Object.freeze({
      id: "finish-level-2",
      stage: "sell",
      title: "Finish Level 2",
      now: "Return to the game and lock Level 2.",
      why: "Locking Level 2 records the AIDA message and opens Level 3, where the pair will set the price and market route.",
      done: "Level 2 is locked and Level 3 is available.",
      next: "Open the creative studio and complete the Price position.",
      tool: "game",
      claimIds: claimIds("ICC"),
      actionLabel: "Return to game",
      complete: false
    })
  }),
  irresistible: Object.freeze({
    progressLabel: "Level 3 studio work complete",
    step: Object.freeze({
      id: "finish-level-3",
      stage: "irresistible",
      title: "Finish Level 3",
      now: "Return to the game and lock Level 3.",
      why: "Locking Level 3 records the complete offer and opens the Final review.",
      done: "Level 3 is locked and the Final review is available.",
      next: "Complete the Final review.",
      tool: "game",
      claimIds: claimIds("ICD"),
      actionLabel: "Return to game",
      complete: false
    })
  }),
  "publish-check": Object.freeze({
    progressLabel: "Studio work complete",
    step: Object.freeze({
      id: "final-review",
      stage: "publish-check",
      title: "Final review",
      now: "Return to the game. Check all five final-review statements, then build the market card.",
      why: "The five statements connect the product, AIDA choices, price, market route and proof point to the final judgement.",
      done: "All five statements are confirmed and the market card is built.",
      next: "Open the market and score every other advertisement.",
      tool: "game",
      claimIds: claimIds("P20", "P21", "P22", "P23", "P24", "C"),
      actionLabel: "Return to game",
      complete: false
    })
  })
});

const STAGE_INDEX: Readonly<Record<CampaignGameplayStage, number>> = Object.freeze({
  invent: 0,
  sell: 1,
  irresistible: 2,
  "publish-check": 3
});

export function evaluateGuidedJourney(
  document: CampaignDocumentV1
): GuidedJourneyState {
  const steps = Object.freeze(DEFINITIONS.map((definition): GuidedJourneyStep => {
    const { isComplete, ...step } = definition;
    return Object.freeze({ ...step, complete: isComplete(document) });
  }));
  const incompleteIndex = steps.findIndex(({ complete }) => !complete);
  const allComplete = incompleteIndex === -1;
  const currentIndex = allComplete ? steps.length - 1 : incompleteIndex;
  const nextStep = steps[currentIndex]!;
  const transitionRequired = allComplete ||
    STAGE_INDEX[nextStep.stage] > STAGE_INDEX[document.gameplay.stage];
  const transition = LEVEL_TRANSITIONS[document.gameplay.stage];
  const current = transitionRequired ? transition.step : nextStep;
  const progressLabel = transitionRequired
    ? transition.progressLabel
    : `Step ${currentIndex + 1} of ${steps.length}`;

  return Object.freeze({
    steps,
    current,
    currentIndex,
    allComplete,
    progressLabel
  });
}
```

## File: `scripts/build-netlify-functions.mjs`

```javascript
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = resolve(scriptDirectory, "..");

export const NETLIFY_FUNCTION_NAMES = Object.freeze([
  "account-assets",
  "account-progress",
  "account-reset",
  "account-session",
  "image-lab-jobs",
  "image-lab-session",
  "market-room",
  "market-session",
  "openverse-image",
  "openverse-search",
  "product-price-guide",
  "studio-coach",
  "teacher-accounts",
  "teacher-playtest",
  "teacher-session"
]);

function digest(relativePath, bytes) {
  return {
    path: relativePath.replaceAll(path.sep, "/"),
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

async function assertExactFiles(directory, expected, label, { ignored = [] } = {}) {
  const entries = await readdir(directory, { withFileTypes: true });
  if (!entries.every((entry) => entry.isFile())) {
    throw new Error(`${label} must contain files only`);
  }
  const ignoredSet = new Set(ignored);
  const actual = entries.map(({ name }) => name)
    .filter((name) => !ignoredSet.has(name))
    .sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} file set mismatch: ${JSON.stringify({ actual, expected: wanted })}`);
  }
}

export async function buildNetlifyFunctions({
  root = defaultProjectRoot,
  log = console.log
} = {}) {
  const projectRoot = path.resolve(root);
  const outputDirectory = resolve(projectRoot, "netlify", "function-bundles");
  const wrapperDirectory = resolve(projectRoot, "netlify", "deploy-functions");
  await mkdir(outputDirectory, { recursive: true });
  await assertExactFiles(
    wrapperDirectory,
    NETLIFY_FUNCTION_NAMES.map((name) => `${name}.mts`),
    "Netlify deploy wrapper directory"
  );

  const functions = [];
  for (const functionName of NETLIFY_FUNCTION_NAMES) {
    const entryPath = resolve(projectRoot, "netlify", "functions", `${functionName}.mts`);
    const outputName = `${functionName}.mjs`;
    const outputPath = resolve(outputDirectory, outputName);
    const result = await build({
      configFile: false,
      root: projectRoot,
      logLevel: "warn",
      build: {
        ssr: entryPath,
        write: false,
        target: "node22",
        minify: false,
        sourcemap: false,
        rollupOptions: {
          output: {
            format: "es",
            entryFileNames: outputName,
            codeSplitting: false
          }
        }
      },
      ssr: {
        noExternal: true
      }
    });

    const rollupOutputs = Array.isArray(result) ? result : [result];
    const emitted = rollupOutputs.flatMap((output) => output.output ?? []);
    if (emitted.length !== 1 || emitted[0].type !== "chunk" || !emitted[0].isEntry) {
      throw new Error(`${functionName}: expected exactly one entry chunk, received ${emitted.length}.`);
    }

    const [chunk] = emitted;
    if (chunk.fileName !== outputName) {
      throw new Error(`${functionName}: unexpected bundle filename: ${chunk.fileName}`);
    }
    const unsupportedImports = chunk.imports.filter(
      (specifier) => !specifier.startsWith("node:") && !builtinModules.includes(specifier)
    );
    const referencedFiles = chunk.referencedFiles ?? [];
    if (
      unsupportedImports.length !== 0 ||
      chunk.dynamicImports.length !== 0 ||
      referencedFiles.length !== 0 ||
      /\bimport\s*\(/u.test(chunk.code) ||
      /\brequire\s*\(/u.test(chunk.code)
    ) {
      throw new Error(`${functionName} bundle is not self-contained: ${JSON.stringify({
        unsupportedImports,
        dynamicImports: chunk.dynamicImports,
        referencedFiles
      })}`);
    }

    await writeFile(outputPath, chunk.code, "utf8");
    const wrapperName = `${functionName}.mts`;
    const wrapperBytes = await readFile(resolve(wrapperDirectory, wrapperName));
    const bundleBytes = Buffer.from(chunk.code, "utf8");
    functions.push({
      name: functionName,
      wrapper: digest(`deploy-functions/${wrapperName}`, wrapperBytes),
      bundle: digest(`function-bundles/${outputName}`, bundleBytes)
    });
  }

  await assertExactFiles(
    outputDirectory,
    NETLIFY_FUNCTION_NAMES.map((name) => `${name}.mjs`),
    "Netlify function bundle directory",
    { ignored: ["function-manifest.json"] }
  );
  const manifest = {
    schema: "ad-market-function-manifest@1",
    functions
  };
  const manifestPath = resolve(outputDirectory, "function-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  log(JSON.stringify(functions.map(({ name, bundle }) => ({
    name,
    outputPath: resolve(outputDirectory, `${name}.mjs`),
    bytes: bundle.bytes,
    sha256: bundle.sha256
  }))));
  return { manifest, manifestPath };
}

async function main() {
  await buildNetlifyFunctions();
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
```

## File: `scripts/deploy-netlify-artifact.mjs`

```javascript
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assertPathHasNoIndirection } from "./filesystem-safety.mjs";
import { verifyReleaseArtifact, verifyWebExport } from "./verify-web-export.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const CONFIG_TEMPLATE_PATH = path.join(PROJECT_ROOT, "netlify.artifact.toml");
const DEFAULT_DEPLOY_CONTEXT_ROOT = path.join(tmpdir(), "advertising-market-game-netlify-deploy-context");

async function writeBoundFile(root, relative, bytes, label) {
  const destination = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(destination), { recursive: true });
  await assertPathHasNoIndirection(path.dirname(destination), { label });
  const existing = await assertPathHasNoIndirection(destination, {
    allowMissing: true,
    label,
    rejectHardLinkedFile: true
  });
  if (existing && !existing.isFile()) {
    throw new Error(`Refusing non-file ${label}: ${relative}`);
  }
  await writeFile(destination, bytes);
  await assertPathHasNoIndirection(destination, {
    label,
    rejectHardLinkedFile: true
  });
}

async function listExactFiles(directory, prefix = "") {
  const files = [];
  await assertPathHasNoIndirection(directory, { label: "deploy context" });
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing deploy-context indirection: ${relative}`);
    }
    if (entry.isDirectory()) {
      files.push(...await listExactFiles(absolute, relative));
    } else if (entry.isFile()) {
      await assertPathHasNoIndirection(absolute, {
        label: "deploy context",
        rejectHardLinkedFile: true
      });
      files.push(relative);
    } else {
      throw new Error(`Refusing special deploy-context file: ${relative}`);
    }
  }
  return files;
}

function assertExactFileSet(actual, expected, label) {
  const orderedActual = [...actual].sort((left, right) => left.localeCompare(right));
  const orderedExpected = [...expected].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(orderedActual) !== JSON.stringify(orderedExpected)) {
    throw new Error(`${label} contains missing or unexpected files`);
  }
}

export async function prepareArtifactDeployContext({
  artifactDir,
  deployContextRoot = DEFAULT_DEPLOY_CONTEXT_ROOT,
}) {
  const resolvedArtifactDir = path.resolve(artifactDir);
  const resolvedDeployContextRoot = path.resolve(deployContextRoot);
  const contextRelativeToArtifact = path.relative(resolvedArtifactDir, resolvedDeployContextRoot);
  if (
    contextRelativeToArtifact === "" ||
    (!contextRelativeToArtifact.startsWith("..") && !path.isAbsolute(contextRelativeToArtifact))
  ) {
    throw new Error("Artifact deploy context must be outside the uploaded artifact directory");
  }

  const release = await verifyReleaseArtifact(resolvedArtifactDir);
  const resolvedDeployContextDir = path.join(resolvedDeployContextRoot, release.releaseId);
  const publishDir = path.join(resolvedDeployContextDir, "publish");
  const functionsDir = path.join(resolvedDeployContextDir, "functions");
  const template = await readFile(CONFIG_TEMPLATE_PATH, "utf8");
  await mkdir(publishDir, { recursive: true });
  await mkdir(functionsDir, { recursive: true });
  await assertPathHasNoIndirection(resolvedDeployContextDir, { label: "deploy context" });
  await writeBoundFile(
    resolvedDeployContextDir,
    "netlify.toml",
    Buffer.from(template, "utf8"),
    "deploy config"
  );

  for (const [relative, bytes] of release.staticFiles) {
    await writeBoundFile(publishDir, relative, bytes, "bound static file");
  }
  await writeBoundFile(
    publishDir,
    "release-manifest.json",
    Buffer.from(`${JSON.stringify(release.manifest, null, 2)}\n`, "utf8"),
    "release manifest"
  );
  for (const [relative, bytes] of release.functionFiles) {
    await writeBoundFile(functionsDir, relative, bytes, "bound function file");
  }

  assertExactFileSet(
    await listExactFiles(publishDir),
    [...release.staticFiles.keys(), "release-manifest.json"],
    "Static deploy context"
  );
  assertExactFileSet(
    await listExactFiles(functionsDir),
    release.functionFiles.keys(),
    "Function deploy context"
  );
  return resolvedDeployContextDir;
}

export function buildNetlifyDeployInvocation({
  artifactDir,
  deployContextDir,
  message,
  mode,
  nodeExecutable = process.execPath,
  platform = process.platform,
  projectRoot = PROJECT_ROOT,
  siteId,
}) {
  if (mode !== "draft" && mode !== "production") {
    throw new Error(`Deployment mode must be draft or production, received: ${mode}`);
  }
  if (!deployContextDir) throw new Error("Deployment requires a prepared Netlify context directory");
  if (typeof siteId !== "string" || siteId.trim() === "") {
    throw new Error("Deployment requires an explicit --site-id owned by the caller");
  }

  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const resolvedProjectRoot = pathApi.resolve(projectRoot);
  const resolvedDeployContextDir = pathApi.resolve(deployContextDir);
  const args = [
    pathApi.join(resolvedProjectRoot, "node_modules", "netlify", "bin", "run.js"),
    "deploy",
    "--no-build",
    "--dir",
    pathApi.join(resolvedDeployContextDir, "publish"),
    "--functions",
    pathApi.join(resolvedDeployContextDir, "functions", "deploy-functions"),
    "--site",
    siteId.trim(),
    "--skip-functions-cache",
    "--json",
  ];

  if (mode === "production") args.push("--prod");
  if (message) args.push("--message", message);

  return {
    args,
    command: nodeExecutable,
    cwd: resolvedDeployContextDir,
  };
}

export function parseDeployArgs(args) {
  let artifactDir;
  let message;
  let mode;
  let siteId;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--artifact") {
      artifactDir = args[index + 1];
      index += 1;
    } else if (arg === "--site-id") {
      siteId = args[index + 1];
      index += 1;
    } else if (arg === "--message") {
      message = args[index + 1];
      index += 1;
    } else if (arg === "--draft") {
      if (mode) throw new Error("Choose exactly one deployment mode");
      mode = "draft";
    } else if (arg === "--prod") {
      if (mode) throw new Error("Choose exactly one deployment mode");
      mode = "production";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!artifactDir) throw new Error("Usage requires --artifact <absolute-or-relative-path>");
  if (!mode) throw new Error("Usage requires exactly one of --draft or --prod");
  if (typeof siteId !== "string" || siteId.trim() === "" || siteId.startsWith("--")) {
    throw new Error("Usage requires an explicit --site-id <your-netlify-site-id>");
  }
  if (message === undefined) {
    message = mode === "production" ? "Verified Advertising Market Game release" : "Advertising Market Game release candidate";
  }

  return { artifactDir: path.resolve(artifactDir), message, mode, siteId: siteId.trim() };
}

async function runInvocation(invocation, label) {
  await new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`));
    });
  });
}

async function main() {
  const options = parseDeployArgs(process.argv.slice(2));
  const verification = await verifyWebExport(options.artifactDir, PROJECT_ROOT);
  if (verification.warnings.length > 0) {
    throw new Error(`Artifact verification warnings must be resolved before deployment: ${verification.warnings.join("; ")}`);
  }

  const deployContextDir = await prepareArtifactDeployContext({ artifactDir: options.artifactDir });
  await runInvocation(buildNetlifyDeployInvocation({
    artifactDir: options.artifactDir,
    deployContextDir,
    message: options.message,
    mode: options.mode,
    siteId: options.siteId,
  }), "Netlify deploy");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
```

## File: `scripts/verify-web-export.mjs`

```javascript
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { JSDOM, VirtualConsole } from "jsdom";
import { parseAst } from "vite";
import { isSafeColourableSvgBody } from "./logo-icon-svg-safety.mjs";
import { assertPathHasNoIndirection } from "./filesystem-safety.mjs";
import {
  decodeHtmlAttributeValue,
  inspectHtmlAttribute,
  scanHtmlStartTags
} from "./html-start-tags.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const STALE_SPIKE_PCK_HASH =
  "e8b1d3f2729a16f0d001f8b1483aa4fbc150dcb1b3411b5aacd7456b6cb92459";
const REQUIRED_FILES = [
  "index.html",
  "index.js",
  "index.wasm",
  "index.pck",
  "_headers",
  "studio/studio.css",
  "studio/studio.js"
];
const PRODUCT_SHELL_PREFIX = "catalog/generated/product-shells-v1-reviewed";
const PRODUCT_BUILDER_PREFIX = "catalog/generated/product-builder-pilot-v1";
const LOGO_ICON_PREFIX = "catalog/generated/logo-icons-v1-reviewed";
const LOGO_ICON_COUNT = 4205;
const MAX_LOGO_CATALOGUE_BYTES = 3 * 1024 * 1024;
const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[a-f0-9]{64}$/;
export const APPLICATION_REDIRECTS = [
  "/                 /student             302",
  "/student          /index.html          200",
  "/student/*        /index.html          200",
  "/teacher          /index.html          200",
  "/teacher/*        /index.html          200",
  ""
].join("\n");
const LOGO_ICON_CATEGORIES = new Set([
  "beauty-care",
  "drinks-snacks",
  "fashion-footwear",
  "fast-food-hospitality",
  "general",
  "home-lifestyle",
  "pets-animals",
  "shops-services",
  "sport-outdoors",
  "tech-gadgets",
  "travel-transport"
]);

function asText(value) {
  return typeof value === "string" ? value : Buffer.isBuffer(value) ? value.toString("utf8") : "";
}

function count(text, pattern) {
  return text.match(pattern)?.length ?? 0;
}

function orderedRecords(records) {
  return [...records].map(({ path: relative, bytes, sha256 }) => ({
    path: relative,
    bytes,
    sha256
  })).sort((left, right) => left.path.localeCompare(right.path));
}

export function computeReleaseId({ staticFiles, functionFiles }) {
  return createHash("sha256").update(JSON.stringify({
    schema: "ad-market-release-id@1",
    staticFiles: orderedRecords(staticFiles),
    functionFiles: orderedRecords(functionFiles)
  })).digest("hex").slice(0, 32);
}

export function verifyApplicationRouteContract(files) {
  const errors = [];
  const redirects = asText(files.get("_redirects"));
  if (/^\/api(?:\/|\s)[^\r\n]*\s+\/index\.html\s+200\s*$/imu.test(redirects)) {
    errors.push("an API route must not rewrite to the application shell");
  }
  if (redirects !== APPLICATION_REDIRECTS) {
    errors.push("the student and teacher rewrites do not match the release contract");
  }

  const manifestText = asText(files.get("manifest.webmanifest"));
  try {
    const manifest = JSON.parse(manifestText);
    if (manifest?.start_url !== "/student" || manifest?.scope !== "/") {
      errors.push("the web manifest must start at /student within the root scope");
    }
  } catch {
    errors.push("manifest.webmanifest is not valid JSON");
  }

  const worker = asText(files.get("service-worker.js"));
  if (!/url\.pathname\.startsWith\(["']\/api\/["']\)/u.test(worker)) {
    errors.push("the service worker must bypass every API request");
  }
  if (!/request\.mode\s*===\s*["']navigate["']/u.test(worker) ||
    !/cache\.match\(["']\/index\.html["']\)/u.test(worker)) {
    errors.push("the service worker must retain the shared static navigation shell");
  }

  if (errors.length > 0) {
    throw new Error(`Application route verification failed:\n- ${errors.join("\n- ")}`);
  }
}

function assertReleaseRecords(records, label) {
  if (!Array.isArray(records)) throw new Error(`${label} files must be an array`);
  let previous = "";
  const seen = new Set();
  for (const record of records) {
    if (!record || typeof record !== "object" ||
      typeof record.path !== "string" ||
      !Number.isSafeInteger(record.bytes) || record.bytes < 0 ||
      typeof record.sha256 !== "string" || !SHA256.test(record.sha256)) {
      throw new Error(`${label} file record is invalid`);
    }
    if (!record.path || record.path.startsWith("/") || record.path.includes("\\") ||
      record.path.split("/").some((part) => !part || part === "." || part === "..")) {
      throw new Error(`${label} file path is unsafe: ${record.path}`);
    }
    if (seen.has(record.path)) throw new Error(`${label} file path is duplicated: ${record.path}`);
    if (previous && previous.localeCompare(record.path) >= 0) {
      throw new Error(`${label} file records must be sorted`);
    }
    seen.add(record.path);
    previous = record.path;
  }
}

function verifyBoundFiles(files, records, label) {
  const expected = new Set(records.map(({ path: relative }) => relative));
  for (const record of records) {
    const value = files.get(record.path);
    if (value === undefined) throw new Error(`Missing bound ${label} file: ${record.path}`);
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    if (bytes.byteLength !== record.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== record.sha256) {
      throw new Error(`${label[0].toUpperCase()}${label.slice(1)} file hash mismatch: ${record.path}`);
    }
  }
  for (const relative of files.keys()) {
    if (!expected.has(relative)) throw new Error(`Unexpected ${label} file: ${relative}`);
  }
}

function verifyBoundFunctionManifest(files, releaseRecords) {
  const raw = files.get("function-manifest.json");
  if (raw === undefined) throw new Error("Missing bound function file: function-manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(asText(raw));
  } catch {
    throw new Error("Bound function manifest is not valid JSON");
  }
  if (manifest?.schema !== "ad-market-function-manifest@1" ||
    !Array.isArray(manifest.functions)) {
    throw new Error("Bound function manifest schema is invalid");
  }
  const expected = new Map(releaseRecords
    .filter(({ path: relative }) => relative !== "function-manifest.json")
    .map((record) => [record.path, record]));
  const names = new Set();
  for (const entry of manifest.functions) {
    if (!entry || typeof entry !== "object" || !PORTABLE_ID.test(entry.name ?? "") ||
      names.has(entry.name)) {
      throw new Error("Bound function manifest function identity is invalid");
    }
    names.add(entry.name);
    for (const [part, suffix] of [["wrapper", ".mts"], ["bundle", ".mjs"]]) {
      const record = entry[part];
      if (!record || typeof record.path !== "string" ||
        !record.path.endsWith(`/${entry.name}${suffix}`)) {
        throw new Error(`Bound function manifest ${part} path is invalid`);
      }
      const releaseRecord = expected.get(record.path);
      if (!releaseRecord ||
        Object.keys(record).sort().join(",") !== "bytes,path,sha256" ||
        releaseRecord.path !== record.path ||
        releaseRecord.bytes !== record.bytes ||
        releaseRecord.sha256 !== record.sha256) {
        throw new Error(`Bound function manifest ${part} does not match the release`);
      }
      expected.delete(record.path);
    }
  }
  if (expected.size !== 0) {
    throw new Error(`Bound function manifest omits release files: ${[...expected.keys()].join(", ")}`);
  }
}

export async function verifyReleaseArtifact(exportDir) {
  const manifestPath = path.join(exportDir, "release-manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("Missing release-manifest.json");
    throw new Error("release-manifest.json is not valid JSON");
  }
  if (manifest?.schema !== "ad-market-release@1" ||
    manifest?.functions?.root !== ".release/functions" ||
    !manifest?.static || !manifest?.functions) {
    throw new Error("Release manifest schema is invalid");
  }
  assertReleaseRecords(manifest.static.files, "Static");
  assertReleaseRecords(manifest.functions.files, "Function");
  if (manifest.static.files.some(({ path: relative }) =>
    relative === "release-manifest.json" || relative.startsWith(".release/"))) {
    throw new Error("Static release records include private release metadata");
  }
  const expectedReleaseId = computeReleaseId({
    staticFiles: manifest.static.files,
    functionFiles: manifest.functions.files
  });
  if (manifest.releaseId !== expectedReleaseId) {
    throw new Error("Release manifest ID does not match its bound files");
  }

  const allFiles = await readTreeIfPresent(exportDir);
  const staticFiles = new Map([...allFiles].filter(([relative]) =>
    relative !== "release-manifest.json" && !relative.startsWith(".release/")));
  const functionFiles = await readTreeIfPresent(
    path.join(exportDir, ".release", "functions")
  );
  verifyBoundFiles(staticFiles, manifest.static.files, "static");
  verifyBoundFiles(functionFiles, manifest.functions.files, "function");
  verifyBoundFunctionManifest(functionFiles, manifest.functions.files);
  verifyApplicationRouteContract(staticFiles);
  return {
    manifest,
    releaseId: manifest.releaseId,
    staticFiles,
    functionFiles
  };
}

function isExecutableInlineScript(tag) {
  if (tag.name !== "script" || tag.inertDepth !== 0 ||
    tag.attributes.some((attribute) => attribute.name === "src")) {
    return false;
  }
  const type = tag.attributes.find((attribute) => attribute.name === "type")?.value;
  if (type === undefined) return true;
  return ["", "module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"]
    .includes(decodeHtmlAttributeValue(type).trim().toLowerCase());
}

function getExecutableInlineScriptBodies(html) {
  return scanHtmlStartTags(html).filter(isExecutableInlineScript).map((tag) => {
    const closingStart = html.lastIndexOf("</", (tag.elementEnd ?? tag.end) - 1);
    if (closingStart < tag.end || !/^<\/script\s*>$/i.test(html.slice(closingStart, tag.elementEnd))) {
      throw new Error("executable inline bootstrap script must have a closing </script> tag");
    }
    return html.slice(tag.end, closingStart);
  });
}

function makeNetlifyHeaders(inlineScriptBody) {
  const hash = createHash("sha256").update(Buffer.from(inlineScriptBody, "utf8")).digest("base64");
  return `/*\n  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'sha256-${hash}' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'none'; form-action 'self'; frame-ancestors 'self';\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n  Cross-Origin-Resource-Policy: same-origin\n  Cache-Control: public, max-age=0, must-revalidate\n\n/service-worker.js\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/asset-manifest.json\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/release-manifest.json\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/manifest.webmanifest\n  Cache-Control: no-cache, must-revalidate\n`;
}

function verifyNetlifyHeaders(html, headers, errors) {
  let inlineScriptBodies;
  try {
    inlineScriptBodies = getExecutableInlineScriptBodies(html);
  } catch (error) {
    errors.push(`index.html inline bootstrap cannot be parsed: ${error instanceof Error ? error.message : error}`);
    return;
  }
  if (inlineScriptBodies.length !== 1) {
    errors.push("index.html must contain exactly one executable inline bootstrap script");
    return;
  }
  const scriptPolicy = headers.match(/^\s*Content-Security-Policy:\s*([^\r\n]*)/mi)?.[1] ?? "";
  if (/\bscript-src\b[^;\r\n]*'unsafe-inline'/i.test(scriptPolicy)) {
    errors.push("Netlify CSP has an unsafe inline script policy");
    return;
  }
  if (headers !== makeNetlifyHeaders(inlineScriptBodies[0])) {
    errors.push("Netlify CSP hash does not match the inline bootstrap or required isolation policy");
  }
}

const FUNCTION_NODE_TYPES = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression"
]);
const CONDITIONAL_EXECUTION_NODE_TYPES = new Set([
  "AwaitExpression",
  "ConditionalExpression",
  "DoWhileStatement",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
  "IfStatement",
  "PropertyDefinition",
  "SwitchStatement",
  "TryStatement",
  "WhileStatement"
]);

function isImmediatelyInvokedFunction(node, parent) {
  return !node.async && !node.generator && parent?.type === "CallExpression" && parent.callee === node;
}

function assignmentIsSynchronous(ancestors) {
  for (let index = 0; index < ancestors.length; index += 1) {
    const current = ancestors[index];
    const parent = ancestors[index + 1];
    if (FUNCTION_NODE_TYPES.has(current.type) && !isImmediatelyInvokedFunction(current, parent)) {
      return false;
    }
    if (CONDITIONAL_EXECUTION_NODE_TYPES.has(current.type) ||
      (current.type === "LogicalExpression" && ["&&", "||", "??"].includes(current.operator))) {
      return false;
    }
  }
  return true;
}

function walkJavaScript(node, ancestors, visit) {
  if (!node || typeof node !== "object" || typeof node.type !== "string") return;
  visit(node, ancestors);
  const nextAncestors = [node, ...ancestors];
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "start", "end"].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const child of value) walkJavaScript(child, nextAncestors, visit);
    } else {
      walkJavaScript(value, nextAncestors, visit);
    }
  }
}

function inspectBridgeAssignments(source) {
  let program;
  try {
    program = parseAst(source, { allowReturnOutsideFunction: false });
  } catch {
    return { parseError: true, assignments: new Map() };
  }
  const assignments = new Map([
    ["AdMarketCreator", []],
    ["AdMarketPractice", []]
  ]);
  walkJavaScript(program, [], (node, ancestors) => {
    if (node.type === "AssignmentExpression" && node.operator === "=" &&
      node.left?.type === "MemberExpression" && !node.left.computed &&
      node.left.object?.type === "Identifier" &&
      ["window", "globalThis"].includes(node.left.object.name) &&
      node.left.property?.type === "Identifier" &&
      assignments.has(node.left.property.name)) {
      assignments.get(node.left.property.name).push({
        synchronous: assignmentIsSynchronous(ancestors)
      });
    }
  });
  return { parseError: false, assignments };
}

function installsUsableBridgeGlobalsSynchronously(source) {
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(
    '<!doctype html><html><body><main aria-label="Advertising Market Game"><canvas id="canvas"></canvas></main><div id="creator-root" data-offline-catalogue-url="/catalog/never.json"></div></body></html>',
    {
    url: "https://classroom.invalid/student",
    runScripts: "outside-only",
    virtualConsole
    }
  );
  const browser = dom.window;
  const neverAbortSignal = Object.freeze({
    timeout: () => new globalThis.AbortController().signal
  });
  Object.defineProperties(browser, {
    indexedDB: { configurable: true, value: new IDBFactory() },
    IDBKeyRange: { configurable: true, value: IDBKeyRange },
    fetch: { configurable: true, value: () => new Promise(() => {}) },
    AbortController: { configurable: true, value: globalThis.AbortController },
    AbortSignal: { configurable: true, value: neverAbortSignal },
    structuredClone: { configurable: true, value: globalThis.structuredClone },
    TextEncoder: { configurable: true, value: globalThis.TextEncoder },
    TextDecoder: { configurable: true, value: globalThis.TextDecoder },
    requestAnimationFrame: { configurable: true, value: () => 0 },
    cancelAnimationFrame: { configurable: true, value: () => undefined }
  });
  try {
    const script = new vm.Script(source, { filename: "studio.js" });
    script.runInContext(dom.getInternalVMContext(), { timeout: 3_000 });
    return [browser.AdMarketCreator, browser.AdMarketPractice].every((bridge) =>
      bridge !== null && typeof bridge === "object" &&
      typeof bridge.handle === "function" && Object.isFrozen(bridge));
  } catch {
    return false;
  } finally {
    browser.close();
  }
}

function verifyOfflineCatalogue(files, errors, minimumRecords = 0) {
  const catalogPath = "catalog/generated/offline-core-v1/catalog.json";
  const pricingPath = "catalog/generated/offline-core-v1/pricing.json";
  if (!files.has(catalogPath)) return;
  const catalogValue = files.get(catalogPath);
  const catalogBytes = Buffer.isBuffer(catalogValue)
    ? catalogValue
    : Buffer.from(String(catalogValue));
  let records;
  try {
    records = JSON.parse(catalogBytes.toString("utf8"));
  } catch {
    errors.push("offline catalogue JSON is malformed");
    return;
  }
  if (!Array.isArray(records) || records.length > 20_000) {
    errors.push("offline catalogue must be an array of at most 20000 records");
    return;
  }
  if (records.length < minimumRecords) {
    errors.push(`offline catalogue must contain at least ${minimumRecords} records`);
  }
  const expectedRoles = new Map();
  for (const [index, record] of records.entries()) {
    if (!record || typeof record !== "object" || Array.isArray(record) ||
      !record.files || typeof record.files !== "object" || Array.isArray(record.files)) {
      errors.push(`offline catalogue record ${index} has no file contract`);
      continue;
    }
    if (typeof record.id !== "string" || !PORTABLE_ID.test(record.id) || expectedRoles.has(record.id)) {
      errors.push(`offline catalogue record ${index} has an invalid or duplicate id`);
    } else {
      const tags = Array.isArray(record.tags) ? record.tags : [];
      const role = record.kind === "component" && tags.includes("add-on")
        ? "part"
        : record.kind === "raster-master" && tags.includes("placement-frame")
          ? "media"
          : record.kind === "raster-master" && (tags.includes("base") || tags.includes("scene"))
            ? "base"
            : null;
      if (role === null) errors.push(`offline catalogue record ${index} has no pricing role`);
      else expectedRoles.set(record.id, role);
    }
    const references = [record.files.master, record.files.preview, record.files.thumbnail];
    if (record.files.masks && typeof record.files.masks === "object" && !Array.isArray(record.files.masks)) {
      references.push(...Object.values(record.files.masks));
    }
    for (const reference of references) {
      if (typeof reference !== "string" ||
        !reference.startsWith("/catalog/generated/offline-core-v1/") ||
        reference.includes("\\") || reference.includes("..") || reference.includes("?") || reference.includes("#")) {
        errors.push(`offline catalogue record ${index} has a noncanonical file reference`);
        continue;
      }
      if (!files.has(reference.slice(1))) {
        errors.push(`offline catalogue references missing file: ${reference}`);
      }
    }
    const masterKey = typeof record.files.master === "string" ? record.files.master.slice(1) : "";
    const master = files.get(masterKey);
    if (typeof record.masterSha256 !== "string" || !/^[0-9a-f]{64}$/.test(record.masterSha256)) {
      errors.push(`offline catalogue record ${index} has no valid masterSha256`);
    } else if (master !== undefined) {
      const bytes = Buffer.isBuffer(master) ? master : Buffer.from(String(master));
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== record.masterSha256) {
        errors.push(`offline catalogue master hash mismatch: ${record.files.master}`);
      }
    }
  }

  if (!files.has(pricingPath)) {
    errors.push("missing offline pricing: pricing.json");
    return;
  }
  let pricing;
  try {
    pricing = JSON.parse(asText(files.get(pricingPath)));
  } catch {
    errors.push("offline pricing JSON is malformed");
    return;
  }
  const exactPricingKeys = ["schema", "packId", "pricingVersion", "catalogSha256", "entries"];
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing) ||
    Object.keys(pricing).length !== exactPricingKeys.length ||
    !exactPricingKeys.every((key) => Object.hasOwn(pricing, key)) ||
    pricing.schema !== "raster-production-pricing@1" || pricing.packId !== "offline-core-v1" ||
    !Number.isSafeInteger(pricing.pricingVersion) || pricing.pricingVersion < 1 ||
    pricing.pricingVersion > 1_000_000 || !Array.isArray(pricing.entries) ||
    pricing.entries.length !== records.length || pricing.entries.length > 20_000) {
    errors.push("offline pricing has an invalid contract");
    return;
  }
  const actualCatalogHash = createHash("sha256").update(catalogBytes).digest("hex");
  if (pricing.catalogSha256 !== actualCatalogHash) {
    errors.push("offline pricing catalog hash mismatch");
  }
  const pricedIds = new Set();
  let previousId = "";
  let productRecords = 0;
  for (const [index, entry] of pricing.entries.entries()) {
    const valid = entry && typeof entry === "object" && !Array.isArray(entry) &&
      Object.keys(entry).length === 3 &&
      ["assetId", "costCents", "role"].every((key) => Object.hasOwn(entry, key)) &&
      typeof entry.assetId === "string" && PORTABLE_ID.test(entry.assetId) &&
      entry.assetId > previousId && !pricedIds.has(entry.assetId) &&
      Number.isSafeInteger(entry.costCents) && entry.costCents > 0 && entry.costCents <= 1_000_000 &&
      ["base", "part", "media"].includes(entry.role) && expectedRoles.get(entry.assetId) === entry.role;
    if (!valid) {
      errors.push(`offline pricing entry ${index} is invalid or mismatched`);
      continue;
    }
    previousId = entry.assetId;
    pricedIds.add(entry.assetId);
    if (entry.role !== "media") productRecords += 1;
  }
  if (pricedIds.size !== expectedRoles.size || [...expectedRoles.keys()].some((id) => !pricedIds.has(id))) {
    errors.push("offline pricing must cover every catalogue record exactly once");
  }
  if (productRecords < minimumRecords) {
    errors.push(`offline pricing must contain at least ${minimumRecords} product records`);
  }
  verifyStudentStarterManifest(files, records, errors);
}

export function verifyStudentStarterManifest(files, records, errors) {
  const prefix = "catalog/generated/offline-core-v1";
  const kitPath = `${prefix}/product-kit-v1.json`;
  const starterPath = `${prefix}/student-starters-v1.json`;
  if (!files.has(kitPath)) {
    if (files.has(starterPath)) {
      errors.push("student starter manifest requires the Product Kit sidecar");
    }
    return;
  }
  if (!files.has(starterPath)) {
    errors.push("missing student starter manifest: student-starters-v1.json");
    return;
  }
  let kits;
  let manifest;
  try {
    kits = JSON.parse(asText(files.get(kitPath)));
    manifest = JSON.parse(asText(files.get(starterPath)));
  } catch {
    errors.push("student starter or Product Kit JSON is malformed");
    return;
  }
  const bounded = manifest?.fillProfiles?.["bounded-linework-v1"];
  const opaque = manifest?.fillProfiles?.["opaque-body-v1"];
  const exactProfiles = bounded?.lineDarknessThreshold === 220 &&
    bounded?.minimumAlpha === 200 && bounded?.colourDistance === 48 &&
    bounded?.minimumRegionPixels === 20 && bounded?.maximumRegionFraction === 0.95 &&
    Object.keys(bounded ?? {}).length === 5 && opaque?.minimumAlpha === 200 &&
    Object.keys(opaque ?? {}).length === 1;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
    Object.keys(manifest).length !== 4 ||
    manifest.schema !== "student-product-starters@1" || manifest.version !== 1 ||
    !exactProfiles || !Array.isArray(manifest.starters) ||
    manifest.starters.length !== 12 || !Array.isArray(kits?.kits) ||
    !Array.isArray(kits?.components)) {
    errors.push("student starter manifest has an invalid contract");
    return;
  }
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const kitsById = new Map(kits.kits.map((kit) => [kit?.id, kit]));
  const componentsById = new Map(kits.components.map((component) => [component?.id, component]));
  const ids = new Set();
  const titles = new Set();
  const categories = new Map();
  let kitCount = 0;
  let rasterCount = 0;
  let connectedCount = 0;
  for (const [index, starter] of manifest.starters.entries()) {
    if (!starter || typeof starter !== "object" || Array.isArray(starter) ||
      typeof starter.id !== "string" || !PORTABLE_ID.test(starter.id) ||
      typeof starter.title !== "string" || starter.title !== starter.title.trim() ||
      starter.title.length === 0 || typeof starter.category !== "string" ||
      !PORTABLE_ID.test(starter.category) || ids.has(starter.id) ||
      titles.has(starter.title)) {
      errors.push(`student starter ${index} has an invalid or duplicate identity`);
      continue;
    }
    ids.add(starter.id);
    titles.add(starter.title);
    categories.set(starter.category, (categories.get(starter.category) ?? 0) + 1);
    if (starter.kind === "kit") {
      kitCount += 1;
      const kit = kitsById.get(starter.kitId);
      const component = componentsById.get(starter.defaultComponentId);
      if (Object.keys(starter).length !== 6 || !kit || !component ||
        !Array.isArray(kit.mountFrames) ||
        !kit.mountFrames.some((frame) => frame?.slotId === component.slotId)) {
        errors.push(`student kit starter ${starter.id} does not resolve`);
      }
      continue;
    }
    if (starter.kind !== "raster") {
      errors.push(`student starter ${starter.id} has an invalid kind`);
      continue;
    }
    rasterCount += 1;
    const record = recordsById.get(starter.assetId);
    const pair = `${starter.fillMode}:${starter.fillProfile}`;
    if (pair === "connected-sections:bounded-linework-v1") connectedCount += 1;
    if (Object.keys(starter).length !== 7 ||
      !new Set([
        "connected-sections:bounded-linework-v1",
        "whole-object:opaque-body-v1",
        "none:none"
      ]).has(pair) || !record || record.delivery !== "offline" ||
      record.kind !== "raster-master" || record.classroomReviewed !== true ||
      record.brandFree !== true || record.attribution?.sourceUrl !== "local" ||
      record.files?.master !==
        `/catalog/generated/offline-core-v1/assets/${starter.assetId}/master.png` ||
      record.files?.masks?.body !==
        `/catalog/generated/offline-core-v1/assets/${starter.assetId}/masks/body.png`) {
      errors.push(`student raster starter ${starter.id} does not resolve`);
    }
  }
  if (kitCount !== 3 || rasterCount !== 9 || connectedCount < 4 ||
    categories.size < 6 || [...categories.values()].some((count) => count > 2)) {
    errors.push("student starter manifest does not meet the 3/9 category and fill invariants");
  }
}

function verifyProductShellCatalogue(files, errors) {
  const catalogPath = `${PRODUCT_SHELL_PREFIX}/catalog.json`;
  if (!files.has(catalogPath)) return;
  let catalog;
  try {
    catalog = JSON.parse(asText(files.get(catalogPath)));
  } catch {
    errors.push("product shell catalogue JSON is malformed");
    return;
  }
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog) ||
    catalog.schema !== "product-shell-catalog@1" ||
    !Array.isArray(catalog.shells) || catalog.shells.length > 5_000) {
    errors.push("product shell catalogue has an invalid catalog contract");
    return;
  }
  const ids = new Set();
  for (const [index, shell] of catalog.shells.entries()) {
    if (!shell || typeof shell !== "object" || Array.isArray(shell) ||
      typeof shell.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(shell.id) ||
      ids.has(shell.id)) {
      errors.push(`product shell catalogue record ${index} has an invalid or duplicate id`);
      continue;
    }
    ids.add(shell.id);
    for (const field of ["authoringSvg", "previewSvg"]) {
      const reference = shell[field];
      if (typeof reference !== "string" ||
        !/^shells\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:authoring|preview)\.svg$/.test(reference) ||
        reference.includes("..")) {
        errors.push(`product shell catalogue record ${index} has a noncanonical ${field}`);
        continue;
      }
      const expectedName = field === "authoringSvg" ? "authoring.svg" : "preview.svg";
      if (!reference.endsWith(`/${expectedName}`)) {
        errors.push(`product shell catalogue record ${index} has a mismatched ${field}`);
      } else if (!files.has(`${PRODUCT_SHELL_PREFIX}/${reference}`)) {
        errors.push(`product shell catalogue references missing file: ${reference}`);
      }
    }
  }
}

function verifyProductShellMetadata(html, files, errors) {
  const catalogPath = `${PRODUCT_SHELL_PREFIX}/catalog.json`;
  const attribute = /\bdata-product-shell-catalogue-url\s*=\s*["'][^"']*["']/gi;
  const attributes = html.match(attribute) ?? [];
  const expected = `data-product-shell-catalogue-url="/${catalogPath}"`;
  if (files.has(catalogPath)) {
    if (attributes.length !== 1 || attributes[0] !== expected) {
      errors.push("index.html must reference the reviewed product shell catalogue exactly once");
    }
  } else if (attributes.length > 0) {
    errors.push("index.html references an absent product shell catalogue");
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectUniqueIds(records, label, errors) {
  const ids = new Set();
  for (const [index, record] of records.entries()) {
    if (!isRecord(record) || typeof record.id !== "string" ||
      !PORTABLE_ID.test(record.id) || ids.has(record.id)) {
      errors.push(`product builder catalogue has an invalid or duplicate ${label} id at record ${index}`);
      continue;
    }
    ids.add(record.id);
  }
  return ids;
}

function verifyProductBuilderCatalogue(files, errors) {
  const cataloguePath = `${PRODUCT_BUILDER_PREFIX}/catalogue.json`;
  if (!files.has(cataloguePath)) return;
  let catalogue;
  try {
    catalogue = JSON.parse(asText(files.get(cataloguePath)));
  } catch {
    errors.push("product builder catalogue JSON is malformed");
    return;
  }
  if (!isRecord(catalogue) || catalogue.schema !== "product-builder-catalogue@1" ||
    catalogue.version !== 1 || catalogue.packId !== "product-builder-pilot-v1") {
    errors.push("product builder catalogue has an invalid schema, version, or pack ID");
    return;
  }

  const fixedCounts = [
    ["families", 3],
    ["bodies", 12],
    ["parts", 12],
    ["palettes", 16],
    ["materials", 8]
  ];
  for (const [field, expected] of fixedCounts) {
    if (!Array.isArray(catalogue[field]) || catalogue[field].length !== expected) {
      errors.push(`product builder catalogue must contain exactly ${expected} ${field}`);
    }
  }
  if (fixedCounts.some(([field]) => !Array.isArray(catalogue[field]))) return;
  if (catalogue.virtualCount !== 6144) {
    errors.push("product builder catalogue virtualCount must equal 6144");
  }

  const familyIds = collectUniqueIds(catalogue.families, "family", errors);
  const bodyIds = collectUniqueIds(catalogue.bodies, "body", errors);
  const partIds = collectUniqueIds(catalogue.parts, "part", errors);
  collectUniqueIds(catalogue.palettes, "palette", errors);
  collectUniqueIds(catalogue.materials, "material", errors);

  const families = new Map();
  for (const family of catalogue.families) {
    if (!isRecord(family) || !familyIds.has(family.id) ||
      typeof family.componentSlotId !== "string" || !PORTABLE_ID.test(family.componentSlotId)) {
      errors.push("product builder catalogue has an invalid family slot");
      continue;
    }
    families.set(family.id, family);
  }

  const partsByFamily = new Map([...familyIds].map((id) => [id, []]));
  for (const [index, part] of catalogue.parts.entries()) {
    if (!isRecord(part) || !partIds.has(part.id)) continue;
    const family = families.get(part.familyId);
    if (!family || part.slotId !== family.componentSlotId) {
      errors.push(`product builder catalogue part ${index} has an incompatible family or slot`);
      continue;
    }
    const expectedPath = `components/${part.id}.svg`;
    if (part.componentSvg !== expectedPath) {
      errors.push(`product builder catalogue part ${index} has a noncanonical componentSvg`);
    } else if (!files.has(`${PRODUCT_BUILDER_PREFIX}/${expectedPath}`)) {
      errors.push(`product builder catalogue references missing file: ${expectedPath}`);
    }
    partsByFamily.get(part.familyId)?.push(part);
  }

  const bodiesByFamily = new Map([...familyIds].map((id) => [id, []]));
  for (const [index, body] of catalogue.bodies.entries()) {
    if (!isRecord(body) || !bodyIds.has(body.id)) continue;
    const family = families.get(body.familyId);
    if (!family || body.componentSlotId !== family.componentSlotId) {
      errors.push(`product builder catalogue body ${index} has an incompatible family or slot`);
    } else {
      bodiesByFamily.get(body.familyId)?.push(body);
    }
    for (const [field, fileName] of [["authoringSvg", "authoring.svg"], ["previewSvg", "preview.svg"]]) {
      const expectedPath = `bodies/${body.id}/${fileName}`;
      if (body[field] !== expectedPath) {
        errors.push(`product builder catalogue body ${index} has a noncanonical ${field}`);
      } else if (!files.has(`${PRODUCT_BUILDER_PREFIX}/${expectedPath}`)) {
        errors.push(`product builder catalogue references missing file: ${expectedPath}`);
      }
    }
  }

  for (const familyId of familyIds) {
    const familyParts = partsByFamily.get(familyId) ?? [];
    const familyBodies = bodiesByFamily.get(familyId) ?? [];
    if (familyParts.length !== 4 || familyBodies.length !== 4) {
      errors.push(`product builder catalogue family ${familyId} must bind four bodies and four parts`);
    }
    const expectedPartIds = new Set(familyParts.map((part) => part.id));
    for (const body of familyBodies) {
      const compatible = Array.isArray(body.compatiblePartIds) ? body.compatiblePartIds : [];
      const compatibleIds = new Set(compatible);
      if (compatible.length !== 4 || compatibleIds.size !== 4 ||
        [...expectedPartIds].some((id) => !compatibleIds.has(id)) ||
        [...compatibleIds].some((id) => !expectedPartIds.has(id))) {
        errors.push(`product builder catalogue body ${body.id} has an incompatible part graph`);
      }
    }
  }

  const computedVirtualCount = catalogue.bodies.reduce((total, body) =>
    total + (Array.isArray(body?.compatiblePartIds) ? body.compatiblePartIds.length : 0) *
      catalogue.palettes.length * catalogue.materials.length, 0);
  if (computedVirtualCount !== 6144 || catalogue.virtualCount !== computedVirtualCount) {
    errors.push("product builder catalogue count graph does not resolve exactly 6144 variants");
  }
}

function verifyProductBuilderQa(files, errors) {
  const qaPath = `${PRODUCT_BUILDER_PREFIX}/qa.json`;
  const sourcePath = `${PRODUCT_BUILDER_PREFIX}/source.json`;
  if (!files.has(qaPath)) {
    errors.push("missing product builder QA record: qa.json");
    return;
  }
  if (!files.has(sourcePath)) errors.push("missing product builder source snapshot: source.json");

  let qa;
  try {
    qa = JSON.parse(asText(files.get(qaPath)));
  } catch {
    errors.push("product builder QA JSON is malformed");
    return;
  }
  if (isRecord(qa?.sha256) && Object.hasOwn(qa.sha256, "qa.json")) {
    errors.push("product builder QA must not hash qa.json");
  }
  if (!isRecord(qa) || qa.schema !== "product-builder-qa@1" ||
    qa.packId !== "product-builder-pilot-v1" || qa.bodyCount !== 12 ||
    qa.componentCount !== 12 || qa.renderedSvgCount !== 36 ||
    qa.virtualCount !== 6144 || qa.fileCount !== 39 || !isRecord(qa.sha256)) {
    errors.push("product builder QA record has invalid metadata or counts");
    return;
  }

  let catalogue;
  try {
    catalogue = JSON.parse(asText(files.get(`${PRODUCT_BUILDER_PREFIX}/catalogue.json`)));
  } catch {
    return;
  }
  if (!isRecord(catalogue) || !Array.isArray(catalogue.bodies) || !Array.isArray(catalogue.parts)) return;
  const expectedRelativePaths = [
    "catalogue.json",
    "source.json",
    ...catalogue.bodies.flatMap((body) => [body.authoringSvg, body.previewSvg]),
    ...catalogue.parts.map((part) => part.componentSvg)
  ];
  const expected = new Set(expectedRelativePaths);
  if (expected.size !== 38) {
    errors.push("product builder QA must cover exactly 38 declared non-self files");
    return;
  }
  for (const relative of Object.keys(qa.sha256)) {
    if (!expected.has(relative)) {
      errors.push(`product builder QA hashes an unknown or self file: ${relative}`);
    }
  }
  for (const relative of expectedRelativePaths) {
    const declared = qa.sha256[relative];
    if (typeof declared !== "string" || !/^[0-9a-f]{64}$/.test(declared)) {
      errors.push(`product builder QA has no valid hash for: ${relative}`);
      continue;
    }
    const value = files.get(`${PRODUCT_BUILDER_PREFIX}/${relative}`);
    if (value === undefined) continue;
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== declared) {
      errors.push(`product builder QA hash mismatch: ${relative}`);
    }
  }
}

function verifyProductBuilderMetadata(html, files, errors) {
  const cataloguePath = `${PRODUCT_BUILDER_PREFIX}/catalogue.json`;
  const attributePattern = /\bdata-product-builder-catalogue-url\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi;
  const attributes = html.match(attributePattern) ?? [];
  if (!files.has(cataloguePath)) {
    if (attributes.length > 0) {
      errors.push("index.html references an absent product builder catalogue");
    }
    return;
  }

  const expected = `data-product-builder-catalogue-url="/${cataloguePath}"`;
  if (attributes.length !== 1) {
    errors.push("index.html must reference the product builder catalogue exactly once");
    return;
  }
  if (attributes[0] !== expected) {
    errors.push("index.html must use the canonical product builder catalogue URL");
  }
  const creatorRoot = html.match(/<[a-z][^>]*\bid\s*=\s*["']creator-root["'][^>]*>/i)?.[0] ?? "";
  if (!creatorRoot.includes(expected)) {
    errors.push("product builder catalogue metadata must be on #creator-root");
  }
}

function verifyLogoIconCatalogue(files, errors) {
  const cataloguePath = `${LOGO_ICON_PREFIX}/catalog.json`;
  const raw = files.get(cataloguePath);
  if (raw === undefined) return;
  const bytes = Buffer.isBuffer(raw) ? raw.byteLength : Buffer.byteLength(String(raw));
  if (bytes > MAX_LOGO_CATALOGUE_BYTES) {
    errors.push("logo icon catalogue exceeds 3 MiB");
    return;
  }

  let catalogue;
  try {
    catalogue = JSON.parse(asText(raw));
  } catch {
    errors.push("logo icon catalogue JSON is malformed");
    return;
  }
  if (!isRecord(catalogue) || catalogue.schema !== "logo-icon-catalog@1" ||
    catalogue.packId !== "tabler-logo-icons-v1" || catalogue.version !== 1) {
    errors.push("logo icon catalogue has an invalid schema, version, or pack ID");
    return;
  }
  const expectedSource = {
    name: "Tabler Icons",
    package: "@iconify-json/tabler",
    packageVersion: "1.2.35",
    sourceVersion: "3.44.0",
    licence: "MIT",
    url: "https://github.com/tabler/tabler-icons"
  };
  if (!isRecord(catalogue.source) || Object.entries(expectedSource)
    .some(([key, value]) => catalogue.source[key] !== value)) {
    errors.push("logo icon catalogue does not match pinned source metadata");
  }
  if (!Array.isArray(catalogue.icons) || catalogue.icons.length !== LOGO_ICON_COUNT) {
    errors.push(`logo icon catalogue must contain exactly ${LOGO_ICON_COUNT} icons`);
    if (!Array.isArray(catalogue.icons)) return;
  }

  const ids = new Set();
  for (const [index, icon] of catalogue.icons.entries()) {
    if (!isRecord(icon) || typeof icon.id !== "string" || icon.id.length > 100 ||
      !PORTABLE_ID.test(icon.id) || ids.has(icon.id)) {
      errors.push(`logo icon catalogue has an invalid or duplicate icon id at record ${index}`);
      continue;
    }
    ids.add(icon.id);
    if (icon.id.startsWith("brand-")) {
      errors.push(`logo icon catalogue contains a brand icon at record ${index}`);
    }
    if (typeof icon.title !== "string" || !icon.title.trim() || icon.title.length > 120) {
      errors.push(`logo icon catalogue record ${index} has an invalid title`);
    }
    if (!isSafeColourableSvgBody(icon.body)) {
      errors.push(`logo icon catalogue record ${index} has an unsafe or non-colourable SVG body`);
    }
    if (!Number.isInteger(icon.width) || !Number.isInteger(icon.height) ||
      icon.width < 1 || icon.height < 1 || icon.width > 512 || icon.height > 512) {
      errors.push(`logo icon catalogue record ${index} has invalid dimensions`);
    }
    if (!Array.isArray(icon.categories) || icon.categories.length < 1 ||
      icon.categories.length > 10 || new Set(icon.categories).size !== icon.categories.length ||
      icon.categories.some((category) => typeof category !== "string" ||
        !LOGO_ICON_CATEGORIES.has(category))) {
      errors.push(`logo icon catalogue record ${index} has invalid categories`);
    }
  }
}

function verifyLogoIconMetadata(html, files, errors) {
  const cataloguePath = `${LOGO_ICON_PREFIX}/catalog.json`;
  let inspection;
  try {
    inspection = inspectHtmlAttribute(html, "data-logo-icon-catalogue-url");
  } catch (error) {
    errors.push(`index.html logo metadata cannot be parsed: ${error instanceof Error ? error.message : error}`);
    return;
  }
  const { creatorRoots, occurrences } = inspection;
  if (!files.has(cataloguePath)) {
    if (occurrences.length > 0) errors.push("index.html references an absent logo icon catalogue");
    return;
  }
  const expected = `data-logo-icon-catalogue-url="/${cataloguePath}"`;
  if (occurrences.length !== 1) {
    errors.push("index.html must reference the logo icon catalogue exactly once");
    return;
  }
  const occurrence = occurrences[0];
  if (occurrence.attribute.raw !== expected ||
    occurrence.attribute.value !== `/${cataloguePath}`) {
    errors.push("index.html must use the canonical logo icon catalogue URL");
  }
  if (creatorRoots.length !== 1 || !occurrence.onCreatorRoot) {
    errors.push("logo icon catalogue metadata must be on #creator-root");
  }
}

/** Verifies a complete offline-core directory without requiring a Godot shell. */
export async function verifyOfflineCoreDirectory(directory, { minimumRecords = 0 } = {}) {
  if (!Number.isSafeInteger(minimumRecords) || minimumRecords < 0 || minimumRecords > 20_000) {
    throw new Error("Offline catalogue minimum must be an integer from 0 to 20000");
  }
  const prefix = "catalog/generated/offline-core-v1";
  const files = await readTreeIfPresent(directory, prefix);
  if (!files.has(`${prefix}/catalog.json`)) {
    throw new Error("Offline catalogue verification failed:\n- missing offline catalogue: catalog.json");
  }
  const errors = [];
  verifyOfflineCatalogue(files, errors, minimumRecords);
  if (errors.length > 0) {
    throw new Error(`Offline catalogue verification failed:\n- ${errors.join("\n- ")}`);
  }
  return files;
}

/** Verifies a complete reviewed product-shell directory without requiring a Godot shell. */
export async function verifyProductShellDirectory(directory) {
  const files = await readTreeIfPresent(directory, PRODUCT_SHELL_PREFIX);
  if (!files.has(`${PRODUCT_SHELL_PREFIX}/catalog.json`)) {
    throw new Error("Product shell verification failed:\n- missing product shell catalogue: catalog.json");
  }
  const errors = [];
  verifyProductShellCatalogue(files, errors);
  if (errors.length > 0) {
    throw new Error(`Product shell verification failed:\n- ${errors.join("\n- ")}`);
  }
  return files;
}

/** Verifies the complete product-builder pilot without requiring a Godot shell. */
export async function verifyProductBuilderDirectory(directory) {
  const files = await readTreeIfPresent(directory, PRODUCT_BUILDER_PREFIX);
  if (!files.has(`${PRODUCT_BUILDER_PREFIX}/catalogue.json`)) {
    throw new Error("Product builder verification failed:\n- missing product builder catalogue: catalogue.json");
  }
  const errors = [];
  verifyProductBuilderCatalogue(files, errors);
  verifyProductBuilderQa(files, errors);
  if (errors.length > 0) {
    throw new Error(`Product builder verification failed:\n- ${errors.join("\n- ")}`);
  }
  return files;
}

/** Verifies the pinned reviewed logo-icon pack without requiring a Godot shell. */
export async function verifyLogoIconDirectory(directory) {
  const files = await readTreeIfPresent(directory, LOGO_ICON_PREFIX);
  if (!files.has(`${LOGO_ICON_PREFIX}/catalog.json`)) {
    throw new Error("Logo icon verification failed:\n- missing logo icon catalogue: catalog.json");
  }
  const errors = [];
  verifyLogoIconCatalogue(files, errors);
  if (errors.length > 0) {
    throw new Error(`Logo icon verification failed:\n- ${errors.join("\n- ")}`);
  }
  return files;
}

/** Pure verification core. It verifies static export evidence, not an end-to-end browser bridge. */
export function inspectExportContents({ files, pckHash }) {
  const errors = [];
  const warnings = [];
  for (const name of REQUIRED_FILES) {
    if (!files.has(name)) errors.push(`missing required export file: ${name}`);
  }

  const html = asText(files.get("index.html"));
  const headers = asText(files.get("_headers"));
  const runtime = asText(files.get("index.js"));
  const studio = asText(files.get("studio/studio.js"));
  const preset = asText(files.get("godot/export_presets.cfg"));

  if (count(html, /(?:href|src)=["']\.\/studio\/studio\.css["']/gi) !== 1) {
    errors.push("index.html must reference ./studio/studio.css exactly once");
  }
  let htmlTags = [];
  try {
    htmlTags = scanHtmlStartTags(html);
  } catch (error) {
    errors.push(`index.html start tags cannot be parsed: ${error instanceof Error ? error.message : error}`);
  }
  const studioScripts = htmlTags.filter((tag) => tag.name === "script" &&
    tag.attributes.some((attribute) =>
      attribute.name === "src" &&
      decodeHtmlAttributeValue(attribute.value) === "./studio/studio.js"));
  const executableStudioScripts = studioScripts.filter((tag) =>
    tag.inertDepth === 0 &&
    tag.raw === '<script src="./studio/studio.js">' &&
    tag.attributes.length === 1);
  if (studioScripts.length !== 1 || executableStudioScripts.length !== 1) {
    errors.push("index.html must contain exactly one executable classic synchronous Studio script");
  }
  const studioScriptIndex = executableStudioScripts[0]?.start ?? -1;
  const godotScripts = htmlTags.filter((tag) => tag.name === "script" &&
    tag.attributes.some((attribute) =>
      attribute.name === "src" && ["index.js", "./index.js"].includes(
        decodeHtmlAttributeValue(attribute.value)
      )));
  const executableGodotScripts = godotScripts.filter((tag) =>
    tag.inertDepth === 0 && tag.attributes.length === 1 &&
    ['<script src="index.js">', '<script src="./index.js">'].includes(tag.raw));
  const godotScriptIndex = executableGodotScripts[0]?.start ?? -1;
  if (godotScripts.length !== 1 || executableGodotScripts.length !== 1) {
    errors.push("index.html must reference the local Godot index.js runtime");
  } else if (studioScriptIndex < 0 || studioScriptIndex > godotScriptIndex) {
    errors.push("studio bridge must load before Godot index.js");
  }
  const startGameIndex = html.search(/\bengine\s*\.\s*startGame\s*\(/i);
  if (startGameIndex >= 0 && godotScriptIndex > startGameIndex) {
    errors.push("Godot index.js must load before engine.startGame()");
  }
  if (/<iframe\b/i.test(html)) errors.push("iframes are forbidden");
  if (/<(?:script|link)\b[^>]*(?:src|href)=["'](?:https?:)?\/\//i.test(html)) {
    errors.push("remote runtime dependencies are forbidden");
  }
  if (/\$GODOT_[A-Z0-9_]+/i.test(html)) errors.push("unresolved Godot shell tokens are forbidden");
  verifyNetlifyHeaders(html, headers, errors);

  const bridgeInspection = inspectBridgeAssignments(studio);
  if (bridgeInspection.parseError) {
    errors.push("studio.js cannot be parsed as JavaScript");
  }
  for (const name of ["AdMarketCreator", "AdMarketPractice"]) {
    const assignments = bridgeInspection.assignments.get(name) ?? [];
    if (assignments.length !== 1) {
      errors.push(`studio.js must assign the production ${name} global exactly once (found ${assignments.length})`);
    }
  }
  if (!installsUsableBridgeGlobalsSynchronously(studio)) {
    errors.push("studio.js must install usable production bridge globals synchronously");
  }
  if (/AdMarketCreatorSpike/.test(`${html}\n${runtime}\n${studio}`)) {
    errors.push("legacy AdMarketCreatorSpike output is forbidden");
  }

  if (!/^variant\/thread_support=false\s*$/m.test(preset)) {
    errors.push("godot/export_presets.cfg must contain variant/thread_support=false");
  }
  if (!runtime.includes("wasm32.nothreads")) errors.push("index.js lacks wasm32.nothreads evidence");
  if (/pthread/i.test(runtime) || [...files.keys()].some((name) => /pthread.*worker|worker.*pthread/i.test(name))) {
    errors.push("pthread worker output is forbidden");
  }
  if (!runtime.includes("AudioWorklet") || !files.has("index.audio.worklet.js")) {
    errors.push("no-thread AudioWorklet evidence is missing");
  }

  verifyOfflineCatalogue(files, errors);
  verifyProductShellCatalogue(files, errors);
  verifyProductShellMetadata(html, files, errors);
  if (files.has(`${PRODUCT_BUILDER_PREFIX}/catalogue.json`)) {
    verifyProductBuilderCatalogue(files, errors);
    verifyProductBuilderQa(files, errors);
  }
  verifyProductBuilderMetadata(html, files, errors);
  verifyLogoIconCatalogue(files, errors);
  verifyLogoIconMetadata(html, files, errors);

  if (pckHash === STALE_SPIKE_PCK_HASH) warnings.push("PCK_STALE_SPIKE_EXPORT");
  if (errors.length > 0) {
    throw new Error(`Web export verification failed:\n- ${errors.join("\n- ")}`);
  }
  return { warnings };
}

async function listRootFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

async function readIfPresent(filePath, binary = false) {
  try {
    return await readFile(filePath, binary ? undefined : "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function readTreeIfPresent(directory, prefix = "") {
  const metadata = await assertPathHasNoIndirection(directory, {
    allowMissing: true,
    label: "source"
  });
  if (!metadata) return new Map();
  if (!metadata.isDirectory()) {
    throw new Error(`Expected catalogue directory: ${directory}`);
  }
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return new Map();
    throw error;
  }
  const result = new Map();
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`Refusing symbolic link in web export: ${path.join(prefix, entry.name)}`);
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [name, value] of await readTreeIfPresent(absolute, relative)) result.set(name, value);
    } else if (entry.isFile()) {
      await assertPathHasNoIndirection(absolute, {
        label: "source",
        rejectHardLinkedFile: true
      });
      result.set(relative, await readFile(absolute));
    } else {
      throw new Error(`Refusing special file in web export: ${relative}`);
    }
  }
  return result;
}

export async function verifyWebExport(exportDir, projectRoot = DEFAULT_ROOT) {
  const release = await verifyReleaseArtifact(exportDir);
  const files = new Map();
  const rootNames = await listRootFiles(exportDir);
  for (const name of new Set([...rootNames, "index.audio.worklet.js"])) {
    const value = await readIfPresent(path.join(exportDir, name), name === "index.wasm" || name === "index.pck");
    if (value !== undefined) files.set(name, value);
  }
  for (const name of ["studio/studio.css", "studio/studio.js"]) {
    const value = await readIfPresent(path.join(exportDir, ...name.split("/")));
    if (value !== undefined) files.set(name, value);
  }
  for (const [name, value] of await readTreeIfPresent(path.join(exportDir, "catalog"), "catalog")) {
    files.set(name, value);
  }
  const preset = await readIfPresent(path.join(projectRoot, "godot", "export_presets.cfg"));
  if (preset !== undefined) files.set("godot/export_presets.cfg", preset);

  const pck = files.get("index.pck");
  const pckHash = Buffer.isBuffer(pck)
    ? createHash("sha256").update(pck).digest("hex")
    : "";
  return {
    ...inspectExportContents({ files, pckHash }),
    releaseId: release.releaseId
  };
}

async function main() {
  if (process.argv.length > 3) throw new Error("Usage: node scripts/verify-web-export.mjs [export-directory]");
  const exportDir = path.resolve(process.argv[2] ?? path.join(DEFAULT_ROOT, "build", "web"));
  const result = await verifyWebExport(exportDir, DEFAULT_ROOT);
  for (const warning of result.warnings) console.warn(warning);
  console.log("WEB_EXPORT_STATIC_VERIFICATION_OK");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
```
