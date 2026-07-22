# Advertising Market Game — final candidate verification

Date: 2026-07-22

## Outcome

The bounded copy, onboarding, navigation, product-zoom, medal-market and two-turn Studio Coach milestone is implemented and verified as a no-deploy candidate. Production and Supabase remain unchanged. Native Windows Godot was not used.

Final candidate:

- branch: `agent/admarket-studio-coach-final-qa-20260722`
- base: `e4f02cf8f632697dc43eff5c9de40cd450069704`
- verified source commit: `0a5be8c687d00a14b077cbda8266024e2f2369e0`
- successful no-deploy workflow: `29933979869`
- run URL: `https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/29933979869`

## Source implementation

The change set from the base contains 236 source, test, script and evidence files. Core production paths are:

- Godot game and market shell: `godot/src/game/GameRun.gd`, `godot/src/main/Main.gd`, `godot/src/main/Main.tscn`, `godot/src/market/LocalMarketSession.gd`, `MarketBridge.gd`, `MarketHost.gd`, `MarketViewState.gd`, `ui/MarketScreen.gd`, and `ui/MarketScreen.tscn`.
- Server contracts and state: `netlify/functions/lib/fal-image-policy.ts`, `market-contracts.ts`, `market-http.ts`, `market-state.ts`, `netlify-studio-coach-state.ts`, `studio-coach-state.ts`, `netlify/functions/market-room.mts`, and `netlify/functions/studio-coach.mts`.
- Shared Coach contract: `shared/studio-coach-contract.ts`.
- Studio and onboarding: `web/src/account/account-gate.ts`, `account/cloud-progress-recovery.ts`, `ai-image/image-lab-panel.ts`, `catalogue/catalogue-runtime.ts`, `fabric/fabric-custom-properties.ts`, `game/aida-playbook-panel.ts`, `aida-playbook.ts`, `audience-briefs.ts`, `creator-level-access.ts`, `market-route-panel.ts`, `market-route.ts`, `pair-game-controller.ts`, `student-copy.ts`, `history/fabric-history-bindings.ts`, `main.ts`, `market/market-client.ts`, `market-public-api.ts`, `product-builder/product-money-panel.ts`, `product-kit/product-kit-panel.ts`, `studio-coach/*`, `styles/editor.css`, `tools/canvas-object-zoom.ts`, and `ui/editor-shell.ts`.

Implemented product flow:

1. Invent a priced product from constrained components.
2. Place it on the advertisement and enlarge or reduce it; the final browser replay reached a clear 288% close-up.
3. Complete the partner handoff and add canvas words.
4. Apply AIDA and visual-advertising techniques in the same studio.
5. Use the image-aware Studio Coach for exactly two paid attempts: one visual move, then one comparison against the revision. The hard prompt and server-side output policy prohibit new slogan or advertising copy, bundled moves and turn-two advice.
6. Complete the final price/route evidence, publish the market card, score ads against five checks, and award one Gold, one Silver and one Bronze to different ads.

## Complete student-copy pass

Authoritative records:

- initial corpus and response: `reviews/student-copy-onboarding-2026-07-21/`
- rewrite ledger: `rewrite-decisions.json`
- final deterministic corpus: `final-copy-map.json`
- coverage response, preserved verbatim: `plain-language-coverage-response.txt`

Results:

- initial mapped corpus: 904 IDs; all 904 returned
- factual-skeleton rewrites applied verbatim: 25
- unchanged: 875
- source-preserving meaning/template exceptions: 4
- final corpus after browser-evidenced additions: 928 entries across 29 authored files
- final corpus SHA-256: `A23D439F1DB457E5D65AD08751F8A97F97FE51F5D5D81F50B9BFE902C4379803`
- exactly two whole-candidate Plain Language calls were used: one rewrite and one coverage critique; the corpus was never chunked

Applied preset IDs:

`GODOT_SRC_MAIN_MAIN_GD__L0170__N01`, `GODOT_SRC_MAIN_MAIN_GD__L0180__N01`, `GODOT_SRC_MAIN_MAIN_TSCN__L0143__N01`, `WEB_SRC_ACCOUNT_ACCOUNT_GATE_TS__L0273__N01`, `WEB_SRC_AI_IMAGE_IMAGE_LAB_PANEL_TS__L0139__N01`, `WEB_SRC_AI_IMAGE_IMAGE_LAB_PANEL_TS__L0172__N01`, `WEB_SRC_CATALOGUE_CATALOGUE_RUNTIME_TS__L0296__N01`, `WEB_SRC_CATALOGUE_CATALOGUE_RUNTIME_TS__L0617__N01`, `WEB_SRC_GAME_AIDA_PLAYBOOK_TS__L0033__N02`, `WEB_SRC_GAME_AIDA_PLAYBOOK_TS__L0034__N01`, `WEB_SRC_GAME_AIDA_PLAYBOOK_TS__L0046__N01`, `WEB_SRC_GAME_AIDA_PLAYBOOK_TS__L0056__N02`, `WEB_SRC_GAME_AIDA_PLAYBOOK_TS__L0079__N02`, `WEB_SRC_GAME_AIDA_PLAYBOOK_TS__L0102__N02`, `WEB_SRC_GAME_AUDIENCE_BRIEFS_TS__L0022__N01`, `WEB_SRC_GAME_STUDENT_COPY_TS__L0056__N01`, `WEB_SRC_GAME_STUDENT_COPY_TS__L0081__N01`, `WEB_SRC_HISTORY_FABRIC_HISTORY_BINDINGS_TS__L0068__N01`, `WEB_SRC_HISTORY_FABRIC_HISTORY_BINDINGS_TS__L0068__N02`, `WEB_SRC_HISTORY_FABRIC_HISTORY_BINDINGS_TS__L0073__N01`, `WEB_SRC_HISTORY_FABRIC_HISTORY_BINDINGS_TS__L0079__N01`, `WEB_SRC_HISTORY_FABRIC_HISTORY_BINDINGS_TS__L0111__N01`, `WEB_SRC_MAIN_TS__L0914__N01`, `WEB_SRC_MAIN_TS__L0920__N01`, `WEB_SRC_MAIN_TS__L0927__N01`.

Exceptions:

| ID | Decision | Reason |
|---|---|---|
| `WEB_SRC_ACCOUNT_ACCOUNT_GATE_TS__L0037__N01` | Preserve source | The extracted span crosses the real retry-count interpolation. |
| `WEB_SRC_GAME_AIDA_PLAYBOOK_PANEL_TS__L0103__N01` | Preserve source | Capitalisation would break a sentence following the interpolated AIDA label. |
| `WEB_SRC_LOGO_LAB_LOGO_LAB_PANEL_TS__L0412__N01` | Preserve source | Capitalisation would break a sentence following the interpolated logo name. |
| `WEB_SRC_LOGO_LAB_LOGO_LAB_PANEL_TS__L0419__N01` | Preserve source | Same interpolated-name conflict. |

The ledger also records 15 later source/browser-evidenced corrections covering the counted canvas-word action, next-AIDA navigation, price return path, progressive route requirements and Level 3/final-check language. These were evidence corrections, not local polishing of the preset response.

## Plain Language runner improvement

The 68,978-character response was valid; only the shell/tool presentation boundary truncated displayed stdout. The skill now supports `--output-file <absolute path>` so the runner writes the validated UTF-8 response byte-for-byte with exclusive `wx` creation and emits the exact success token `plain_language_response_saved\n`. Endpoint, preset, request body, retry behaviour, secrets and transport did not change. Runner tests passed 11/11 and `quick_validate.py` returned `Skill is valid!`. Full details are in `reviews/student-copy-onboarding-2026-07-21/plain-language-skill-change.md`.

## Adversarial review records

### Final multimodal onboarding panel — four of four complete

Every seat received the same 81,408-byte prompt plus the same five JPEG contact sheets as actual image inputs.

| Requested seat | Served model | Status |
|---|---|---|
| `~google/gemini-pro-latest` | `google/gemini-3.1-pro-preview` | Complete, HTTP 200 |
| `x-ai/grok-4.5` | `x-ai/grok-4.5` | Complete, HTTP 200 |
| `anthropic/claude-opus-4.8` | `anthropic/claude-opus-4.8` | Complete, HTTP 200 |
| `moonshotai/kimi-k3` | `moonshotai/kimi-k3` | Complete, HTTP 200 |

All four returned `REVISE`. Supported findings were implemented: primary practice route, changing partner jobs, pair-complete guidance, reserved price placement, grammatical route output, no duplicate product-body receipt, level-gated Price, above-fold placement action, coherent game identity, one cloud-pause phrase, and removal of purchase-era completion language.

### Visual-feedback agent-design options — six paid plus one local seat complete

`google/gemini-3.1-pro-preview`, `x-ai/grok-4.5`, `moonshotai/kimi-k3`, `moonshotai/kimi-k2.7-code`, and `anthropic/claude-opus-4.8` received the screenshot as an image input; `z-ai/glm-5.2` received text evidence only; local `gpt-5.6-sol` inspected the image locally. The synthesis supported reusing the left drawer, technique examples, a technique/whole-ad choice, image-aware advice, and exactly one before/after comparison rather than a conversation.

### Studio Coach code and prompt panels — five of five complete in each panel

The code panel used a 175,809-byte immutable code packet. The prompt panel used a separate 3,528-byte immutable system-prompt packet. Both were text/code reviews; no visual-review claim is made.

| Model | Code | Prompt |
|---|---|---|
| `tencent/hy3` | Complete, HTTP 200 | Complete, HTTP 200 |
| `moonshotai/kimi-k3` | Complete, HTTP 200 | Complete, HTTP 200 |
| `z-ai/glm-5.2` | Complete, HTTP 200 | Complete, HTTP 200 |
| `deepseek/deepseek-v4-pro` | Complete, HTTP 200 | Complete, HTTP 200 |
| `anthropic/claude-opus-4.8` | Complete, HTTP 200 | Complete, HTTP 200 |

The primary synthesis implemented authenticated pair-wide two-turn accounting, stale-reservation recovery, the verified Gemini Flash request slug, concise Year 10 prompt constraints, stored first advice for comparison, exact idempotent replay after an ambiguous browser timeout, timeout taxonomy, bounded streaming, schema/parser alignment, conservative transformed-object evidence, and recoverable store initialisation. Raw attempts and the primary synthesis are under `reviews/studio-coach-adversarial-2026-07-22/`.

### Local Codensus

The isolated local `gpt-5.6-sol` reviewer (`xhigh`, no inherited turns) returned `REVISE` against source `1962fd6dff2a86d24f307281d31294c1ee0cdf4a`. The primary task independently substantiated and corrected three findings: semantic output enforcement, exact pending-request persistence and canvas-revision tracking. Its proposed semantic-turn accounting was not adopted because Peter's explicit cost rule makes a failed provider attempt consume its turn. The corrected client persists that state and explains the remaining turn accurately. The complete raw verdict and adjudication are in `reviews/studio-coach-adversarial-2026-07-22/local-codensus-final-candidate.md`.

The resulting source commit is `0a5be8c687d00a14b077cbda8266024e2f2369e0`. Focused Coach tests passed 31/31; the full suite, integrated workflow and exact-artifact replay below all passed. The Plain Language skill edit separately received its required local Sol Codensus proposal review and resolved every substantiated finding.

Post-review source and test changes were confined to:

- `netlify/functions/studio-coach.mts`
- `netlify/functions/studio-coach.test.ts`
- `web/src/studio-coach/studio-coach-runtime.ts`
- `web/src/studio-coach/studio-coach-runtime.test.ts`
- `web/src/studio-coach/studio-coach-panel.ts`
- `web/src/studio-coach/studio-coach-panel.test.ts`

## Final build and test evidence

Successful run `29933979869` at exact head `0a5be8c687d00a14b077cbda8266024e2f2369e0`:

- catalogue pipeline: 293 passed
- TypeScript type-check: passed
- Vitest: 133 files, 1,963 tests passed
- web-build contracts: 69 passed
- Linux Godot seam suite: `Godot game, Creator bridge, and Market bridge tests passed`
- Linux Godot web export: passed
- complete web assembly: `WEB_EXPORT_ASSEMBLED_NON_DESTRUCTIVE`
- workflow static gate: `WEB_EXPORT_STATIC_VERIFICATION_OK`

The first final run (`29927620719`) exposed a completion-state assertion. An instrumented retry (`29928589658`) proved the real state: medal submission advanced the run to `reveal` before Creator close, so the handler fell through to stale Level 1 guidance. The correction handles `reveal` with the existing factual copy `The market podium is ready for the reveal.` and preserves the live-room `Market card delivered` state after host acceptance. Run `29929485231` passed that candidate. After the one required local Codensus review, run `29933979869` passed the corrected source and produced the final artifact below. Three of the five authorised workflow retries were used.

## Exact artifact

- artifact: `advertising-market-game-web`
- artifact ID: `8535644367`
- archive size: 199,771,105 bytes
- archive digest: `sha256:42fd20a31bb76e2df86df397a06a76e03fe8c3e80ca831e66c4522cc216fc1a9`
- downloaded unchanged to: `C:\tmp\admarket-qa-0a5be8c6-20260722`
- local inventory: 10,209 files, 232,249,758 bytes
- `index.pck`: 382,724 bytes; SHA-256 `8473BD0C05E01B10EEE40C542919F7B2F56B8D52D6E6CDE738BB44F9ED14ACD2`
- local static verification: `WEB_EXPORT_STATIC_VERIFICATION_OK`

## Final MacBook browser replay

Reference surface: the exact downloaded artifact, served locally with COOP/COEP, a deterministic account-session response and a deterministic Studio Coach stub. The stub delayed each new Coach request beyond the real 16-second client timeout and cached the response by idempotency key, allowing recovery to be tested without paid inference. This surface does not run hosted Netlify Functions, the password gate or edge routing; no hosted claim is inferred.

Inspected CSS viewports:

- 1280 × 800: clean signed-in lobby; immediate local-practice start; Level 1; studio; and the completed Coach state. `innerWidth/innerHeight`, client dimensions and document scroll dimensions were all 1280 × 800. The Coach drawer scrolls internally; the page has no horizontal or vertical overflow.
- 1440 × 900: complete product build/place, partner role swap, canvas words, return/lock/next-level path, Level 2, progressive AIDA and both Coach checks. `innerWidth/innerHeight`, client dimensions and document scroll dimensions were all 1440 × 900.

Neutral flow transcript:

1. Enter a pair alias and choose `Practice on this computer`.
2. Level 1 immediately says to build a product in the studio.
3. Choose a base and lid, see the component price and total, name the product, and place it on the ad.
4. The placed product opens as a clear close-up; the visible zoom controls remain available to choose the crop.
5. Swap roles, add canvas words, and observe `Both roles contributed.`
6. Return to the game, lock Level 1, and reveal Level 2.
7. Level 2 names the next AIDA action. Studio Coach offers `Two checks for this ad`, eleven technique choices, one first-advice action and one revision-comparison action. No slogan-writing control exists.
8. The first request exceeds 16 seconds. The drawer explains the timeout and offers exactly one action: `Resume first check`; it says the same captured advertisement will be resent without using another turn.
9. Reload the page. Device recovery returns to Level 2, and reopening Coach restores the exact pending request as `The first check was interrupted` with the same one-action resume path.
10. Resume the request. The server log records the same idempotency key, and the drawer returns one evidence-grounded visual move plus a yes/no self-check.
11. `Check my revision (2 of 2)` remains disabled until the canvas changes. Moving the existing text increments the saved revision and enables the final check.
12. The final check receives the same timeout/recovery treatment. `Resume final check` replays the exact saved comparison; the result contains only `What changed` and `Effect`, followed by `Coach session complete.`

Current screenshots are under `C:\Users\PETERE~1\AppData\Local\Temp\admarket-final-browser-qa-0a5be8c6\`. The two delayed/replayed requests used distinct keys, and each replay reused its original key. The inspected tab produced only the normal Godot 4.7.1, WebGL and Emscripten startup logs; there were zero console warnings or errors for `http://127.0.0.1:4195/`.

The earlier exact artifact at commit `a9472c91` was replayed end to end through all three levels, final check, medal gallery, distinct Gold/Silver/Bronze awards and completion at both target sizes. The final `0a5be8c6` artifact received the proportional source-sensitive replay above, specifically covering every local Codensus correction plus the Level 1-to-Level 2 launch path.

## Primary judgment and remaining uncertainty

The candidate now gives pairs one immediate action, reveals the next required action contextually, keeps partner roles and progress visible, makes the product large enough for ad design, teaches AIDA and visual techniques inside the act of designing, and replaces incompatible $100 shopping with rubric-led Gold/Silver/Bronze judging while retaining product price as value evidence.

Remaining uncertainty is environmental, not an observed candidate failure:

- no paid live Studio Coach inference was made during the final correction pass; transport and response constraints are deterministic-test evidence rather than wording calibration
- the final artifact was inspected in the Codex Chromium browser, not Safari on a school MacBook or school wifi
- the local QA server does not prove hosted password-gate, edge-rate-limit or Netlify Function behaviour
- same-tab Coach comparison evidence survives reload through `sessionStorage`; cross-tab, closed-browser and different-MacBook restoration is intentionally outside this bounded design

## External state

- Production: unchanged; no deploy was performed.
- Supabase: unchanged; no mutation was performed.
- Native Windows Godot: not launched.
- Claude-owned files: not modified or reverted.
- Fusion: not used.
