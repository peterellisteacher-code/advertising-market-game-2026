# Advertising Market Game — final integrated release verification

Date: 2026-07-23
Branch: `agent/admarket-integrated-fixes-20260723`

## Outcome

**CONFIRMED:** The integrated candidate passed fresh TypeScript, full Vitest, exact-artifact verification and current hosted browser QA. Browser QA exposed one real rapid-Undo autosave race; it was reproduced with focused TDD, fixed, rebuilt into a new manifest-bound release, deployed only to the dedicated non-production QA project, and replayed successfully.

**CONFIRMED:** Production, Supabase and the protected Advertising-project draft were not changed. Native Windows Godot was not launched.

## Integrated source groups

The branch contains these bounded source groups:

- `b3bf18fe` — Studio Coach failure refunds and trusted-advice rendering.
- `b97f58cb` — bounded Image Lab requests and persisted idempotent retries.
- `629ad6fa` — audience-led student selling prices and inexpensive AI price guidance.
- `857e98e2` — durable cloud outbox/conflict handling, local retention and quota safeguards.
- `e041d831` and `9b83c5cb` — keyboard canvas controls, focus/accessibility and readable interface text.
- `15fddf88` — large product placement and curved editable product words.
- `e4834c6f` and `91271a1a` — manifest-bound static/Function packaging and the lightweight release service worker.
- final working-tree change — preserve the newest durable revision and timestamp after asynchronous history-canvas loading, with integration regressions for ordinary and queued Undo autosaves.

No unrelated or Claude-owned file was modified or reverted.

## Browser-found defect and TDD

**CONFIRMED browser reproduction:** At exact 1440 × 900, several individually saved keyboard changes followed by rapid Undo actions produced:

`Editor snapshot revision 3 is stale; active revision is 4`

and changed the visible state to `Save paused`.

The first fix preserved durable metadata when selecting a historical state. The fresh hosted replay falsified that as sufficient: an autosave could adopt a newer revision while a later Undo was still awaiting its asynchronous canvas load, after which the Undo overwrote the newly adopted metadata.

The final fix loads the historical canvas first and only then reads the current durable revision and timestamp. The new delayed-load integration regression failed before that change and passed after it.

Focused evidence:

- targeted queued-Undo regression: 1/1 passed
- complete `web/src/main.test.ts`: 41/41 passed
- TypeScript: `tsc --noEmit` passed

## Full test and build evidence

Final source-state evidence:

- TypeScript: passed
- Vitest: 143/143 files, 2,046/2,046 tests, 0 failures
- Vitest duration: 292.15 seconds
- Vitest log: `C:\tmp\admarket-vitest-final-fixed-20260723-1916.stdout.log`
- build-contract suite: 72/72 reused from the unchanged build/deploy scripts
- final static gate: `WEB_EXPORT_STATIC_VERIFICATION_OK`

The full-suite run occurred after the final production-source and test changes. No build/deploy script changed, so the existing 72/72 build-contract result remains applicable.

## Exact final artifact

Staged release:

`C:\tmp\admarket-fixed-release-20260723-02\build\web`

Inventory:

- release ID: `6daa6608ec6e1b47990b49c4cc3ce283`
- manifest-listed static files: 10,212
- static QA publish including `release-manifest.json`: 10,213
- packaged Function files: 23
- asset-manifest records: 10,209
- core precache entries: 8
- service worker: 3,746 bytes
- complete packaged files: 10,236

The original `C:\tmp\admarket-integrated-fixes-20260723\build\web` remained unchanged and still identifies release `96e83f30676c5c3190a4339ecefcd35a`.

The original and final static manifests contain the same 10,212 paths. Exactly four static hashes changed:

- `asset-manifest.json`
- `index.html`
- `service-worker.js`
- `studio/studio.js`

No static path was removed. The final hosted `studio/studio.js` SHA-256 is `eb20c1b7fe512107dae9bdd9d385c503cc2eef465d2e24cd8c05fe020508b8b1`, exactly matching the final release manifest.

## Dedicated non-production QA draft

QA project:

- name: `codex-browser-qa-harness`
- site ID: `8edde91e-88ad-4a96-a49b-ddb8470d27c0`
- team: `peter-ellis-teacher`

Final draft:

- deploy ID: `6a61e8666767f3b63172f54f`
- URL: `https://6a61e8666767f3b63172f54f--codex-browser-qa-harness.netlify.app`
- logs: `https://app.netlify.com/projects/codex-browser-qa-harness/deploys/6a61e8666767f3b63172f54f`
- state: `ready`
- context: `deploy-preview`
- `published_at`: null
- one deterministic QA Function, 10 explicit routes, streaming invocation, Node.js 22
- no edge Functions

The isolated harness is retained at:

`C:\tmp\admarket-netlify-qa-draft-20260723-05`

Its static publish contains exactly the 10,213 final-release static files and zero production-Function files. Its fake Function contains no environment access, Supabase access, paid endpoint, real account or student data. The hosted `/__qa/state` response returned HTTP 200, `x-qa-harness: deterministic-no-secrets`, and the exact final release ID.

Superseded non-production attempts are not evidence for the final result:

- `6a61e0792544028c611eea75` exposed the incomplete first autosave fix.
- `6a61e69ffc4c86b4fbd3c65b` and `6a61e7a0049161ec3e548734` uploaded the verified static bytes but did not register the fake Function routes correctly because a prebuilt bundle directory was supplied where the CLI expects source Functions.

Those drafts and their retained temp harnesses were not deleted because deletion was not authorised. None was published to production.

## Browser QA

Browser transcript:

`C:\tmp\admarket-netlify-qa-draft-20260723-05\browser-qa-transcript-final.md`

### Exact 1280 × 800

**CONFIRMED:** The full flow produced 31 screenshots under:

`C:\tmp\admarket-netlify-qa-draft-20260723-01`

Evidence covers immediate local practice/onboarding, pair roles and visible progress, genuinely large product placement, curved editable product words, keyboard move/resize/order/lock/hide with visible focus, reload recovery, Level 2 AIDA and one-action visual-technique guidance, and Level 3 audience-led price guidance/placement.

### Exact 1440 × 900

**CONFIRMED:** The full responsive pass produced 11 screenshots under:

`C:\tmp\admarket-netlify-qa-draft-20260723-01`

The final affected replay produced:

- `C:\tmp\admarket-netlify-qa-draft-20260723-05\1440x900-final-01-before-rapid-undo.jpg`
- `C:\tmp\admarket-netlify-qa-draft-20260723-05\1440x900-final-02-after-rapid-undo-saved.jpg`
- `C:\tmp\admarket-netlify-qa-draft-20260723-05\1440x900-final-03-reload-local-state.jpg`

Final replay findings:

- browser measurement: 1440 × 900 CSS pixels, DPR 1.5
- three rapid Undo actions after saved revisions 1–4 completed at saved revision 7
- visible device and fake-cloud state both reported revision 7
- `Save paused` did not appear
- reload reported `Continue from this device · cloud autosave ready` and `Saved pitch restored`
- the placed product returned after reopening Studio
- final-draft console: 0 warnings and 0 errors, filtered by exact deploy URL
- document client/scroll dimensions: 1440 × 900
- no top-level viewport overflow
- 0 visible unlabeled buttons

The final source change affects history durability metadata, not the previously inspected layout/copy/features. CSS and all feature assets retained their prior hashes; only the affected autosave path was replayed after the final fix, as required.

## Reused copy and panel evidence

No paid panel or Plain Language call was repeated.

Reused records:

- `reviews/student-copy-onboarding-2026-07-21/`
- `reviews/final-candidate-verification-2026-07-22.md`
- `reviews/studio-coach-adversarial-2026-07-22/`

The existing record covers the 928-entry final copy map, factual-skeleton rewrite ledger, preserved Plain Language responses and the completed onboarding/Studio Coach panels.

## Browser instrument provenance

The Defender alert during browser setup referred to the signed Codex browser helper command line. The helper file matched the installed Store package and had SHA-256 `F2B2F56FCD1699B0FA32DEC3214A56A1D36B937A2ECF58CC822AB4A904551E03`. Defender reported the item inactive/remediated; the helper was not restored, excluded or manually executed.

## Remaining uncertainty

**UNMEASURED:**

- Safari on a recent school MacBook
- school-wifi latency, filtering and captive-network behaviour
- service-worker controller state and a real offline reload in the current in-app browser
- the protected Advertising-project visitor gate
- hosted edge rate limiting and production headers
- production secrets, production Functions and real Supabase/cloud behaviour

The service worker, core precache and static cache contents passed deterministic artifact verification; that does not convert them into browser-offline evidence.

## External state

- Production: unchanged; no production deploy.
- Supabase: unchanged; no read/write mutation.
- Protected Advertising-project draft/access controls: unchanged.
- Native Windows Godot: not launched.
- Paid AI/panels/OpenRouter/Plain Language: not called.
- Live tunnel: not used for final QA.
- Claude-owned files: not modified or reverted.
