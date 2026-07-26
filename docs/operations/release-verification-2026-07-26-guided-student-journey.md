# Guided student journey — final release verification

Date: 2026-07-27 (Australia/Adelaide)

## Decision

The guided-student-journey candidate is ready for Peter's review. The public
source, clean-room build, deterministic QA draft and exact-viewport browser
evidence satisfy the available release gates. Production has not been deployed,
Supabase has not been mutated, and no Windows Godot executable has been
launched.

The remaining acceptance uncertainties are Safari on a student MacBook, school
wifi, real hosted account/cloud behaviour and a browser-controlled offline
reload. These are stated as unmeasured rather than inferred from Chromium or
deterministic tests.

## Source and release identity

- Authoritative branch:
  `agent/admarket-integrated-fixes-20260723`
- Authoritative pre-change commit:
  `fa3e8ec645cfb36181e13abf50bf96d5ddac52da`
- Public repository:
  `https://github.com/peterellisteacher-code/advertising-market-game`
- Public final commit:
  `541d3ee157a384a16192e86e87fb21b4abc696fa`
- Successful GitHub Actions run:
  `30212489622`
- Complete web artifact:
  `8634953230`
- GitHub-reported artifact archive SHA-256:
  `007075fae7364002d2ea966a2ca9859db9ded0514eaac0ecab4b8841bdf5a937`
- Release ID:
  `263e02e28c6cf365e45062afa1632064`
- Static files: `10212`
- Function files: `25`
- Asset records: `10209`
- Core precache entries: `8`
- Service worker: `3746` bytes

The public working tree was clean at the final commit. A normalized-text
comparison found every changed implementation and test file from the
authoritative candidate present and equal in the public snapshot. Internal
planning and this operational evidence record were intentionally excluded from
the public source.

## Changed source groups

1. **Guided instructions and navigation**
   - Added one linked, state-driven route through audience selection, product
     construction, pair contribution, AIDA, price, price evidence, market route
     and final review.
   - Added a permanent **Review all instructions** control.
   - Presented the current action, reason, completion condition and next action
     as separate visual elements rather than a dense paragraph.
   - Preserved access to completed AIDA work while keeping later incomplete
     stages sequentially locked.

2. **Professional student-facing language**
   - Replaced slogan-like onboarding with the factual opening:
     “First you will invent a product, then you will create an advertisement
     for it.”
   - Rewrote the guided route in direct, professional English.
   - Kept the route available as an enduring reference instead of repeating
     long instructions on every screen.

3. **Product, advertisement and price work**
   - Kept the chosen product large enough for a close-up.
   - Rendered supported product words as curved artwork while preserving the
     original editable text.
   - Added audience-led product pricing, a clearly qualified low-confidence
     comparison guide, visible price evidence and an audience-linked market
     route.
   - Presented Attention, Interest, Desire and Action one small step at a time.

4. **Final review and market**
   - Replaced the previous dense final screen with a concise two-column
     five-check review.
   - Required all review checks before the market card can be built.
   - Added the revised market scorecards, results and medal flow.

5. **Account reset**
   - Added a visible reset control scoped to the current account.
   - Required the exact confirmation word `RESET`.
   - Preserved the username and password.
   - Corrected the dialog so that it promises only deletion performed by the
     account reset: game progress, drafts, advertisement designs, uploaded
     images and cloud saves.

6. **Public-source and release hygiene**
   - Published a curated, history-free public source repository with licensing
     and attribution.
   - Removed internal reviews, panel transcripts, temporary evidence and other
     non-build litter from the public snapshot.
   - Kept the workflow read-only and non-deploying.
   - Corrected the public `dev` command to invoke `npx netlify dev`.

## Language evidence

The final student-copy corpus was submitted to the named Plain Language and
Claude Scrubber workflows as an objective scan, without an author-supplied
suspected-defect list or preferred rewrite.

- Plain Language input SHA-256:
  `B3D2589EEC39CC6C95D47452638CAAE839E389EA19E9EE640F0594264D255857`
- Plain Language response SHA-256:
  `9FA12AF222351B01C76975E6221233BBB8CDF138A45E60C5E4DB39A3384BEADE`
- Claude Scrubber response matched the input SHA-256:
  `B3D2589EEC39CC6C95D47452638CAAE839E389EA19E9EE640F0594264D255857`
- Result: no further textual change requested.

The later reset correction only removed an inaccurate promise; it did not add
new stylistic copy. The completed objective language scans were therefore not
rerun.

## Test and build evidence

### Focused red/green repair

Before implementation:

- Guided-journey and reset-dialog tests: `2` expected failures, `8` passes.
- Development-preview contract: `1` expected failure, `1` pass.

After implementation:

- Guided-journey and reset-dialog tests: `10/10` passed.
- Development-preview contract: `2/2` passed.
- Netlify deployment-layout contracts: `12/12` passed in both the
  authoritative and public workspaces after building the required Function
  bundles.

The first post-review public run, `30212208049`, exposed one obsolete assertion
that still required the misspelled `npxnetlify` command. It otherwise passed
`2107` application tests. The assertion was corrected without changing product
code, then the complete clean-room run was repeated once.

### Final clean-room run

GitHub Actions run `30212489622` at exact commit `541d3ee…` passed:

- Python catalogue pipeline: `293/293`
- TypeScript typecheck
- Vitest: `149/149` files, `2109/2109` tests
- Web-build contracts: `97/97`
- Godot game, Creator bridge and Market bridge tests
- Godot web export in the pinned Linux container
- Complete manifest-bound artifact assembly
- `WEB_EXPORT_STATIC_VERIFICATION_OK`

The downloaded artifact independently returned
`WEB_EXPORT_STATIC_VERIFICATION_OK`. Native Windows Godot remained quarantined.

## Browser and visual QA

The full browser replay used public source commit `2f9197f6…`, successful run
`30209809044`, release ID `2f40054a94244d63a0e4b54563f8cd7b` and draft
`6a6634fe38fa3db260a2970e`. It covered the complete route from onboarding to
the practice market with deterministic fake state.

Observed:

- immediate onboarding, progress, roles, partner handoff and completion states;
- a genuinely large product close-up;
- curved product words on the product, with accurate editable-text guidance;
- audience-led price position and the qualified price guide;
- one-at-a-time AIDA and visual-technique guidance;
- local practice saving and deterministic hosted account/progress presentation;
- final review, market-card build, scorecards and results;
- exact-word reset confirmation, cancelled without performing a reset;
- nine ordinary Godot/WebGL/build console messages and zero warnings or errors.

### 1280 × 800

- Document: `1280 × 800`
- Scroll position: `0, 0`
- Horizontal overflow: `0`
- Account region right edge: `1269.60`
- No overlap between account controls and **Review all instructions**
- Complete heading, two-column review, instructions and primary action visible

### 1440 × 900

- Document: `1440 × 900`
- Scroll position: `0, 0`
- Horizontal overflow: `0`
- Account region right edge: `1429.60`
- Reset button right edge: `1336.56`
- Logout button right edge: `1417.21`
- No overlap, clipping, orphaned text, ambiguous primary action or unused
  layout void

The practice market also had zero horizontal overflow at both viewports.

Screenshots are retained at:
`C:\tmp\admarket-browser-qa-2f9197f-30209809044\evidence`

- `59-1280x800-large-product-curved-words.jpg`
- `60-1280x800-final-review-account-clearance.jpg`
- `61-1440x900-final-review-account-clearance.jpg`
- `63-1440x900-market-build-focus.jpg`
- `64-1440x900-live-market.jpg`
- `65-1280x800-live-market.jpg`
- `66-1280x800-reset-confirmation.jpg`

Two browser-helper files with `.png` names contain valid JPEG streams. Correctly
labelled `.jpg` copies are retained. Nothing was deleted.

Earlier unchanged keyboard-layer and market-state screenshots are retained at:
`C:\tmp\admarket-browser-qa-14e6e75-30207393269\evidence`

The final public artifact differs from the visually replayed artifact only in:

- the completed-AIDA access condition;
- removal of the inaccurate words “and pending AI work” from the reset dialog;
- development-command and regression-test corrections.

No CSS, visual hierarchy or final-review composition changed. The shorter reset
sentence cannot introduce new overflow. The affected behaviour was repeated
through focused regression tests and the final clean-room suite. The finalized
browser session was not restarted solely to repeat unchanged visual QA.

The earlier keyboard interaction sequence was observed during browser replay,
and the final-state screenshots are retained, but that earlier run did not
produce a separate neutral keystroke transcript. Automated keyboard and focus
tests remain the durable interaction evidence for that part of the claim.

## Review evidence and adjudication

### Fresh local release review

A fresh, isolated `superpowers:requesting-code-review` adversarial pass used
`gpt-5.6-sol` at xhigh reasoning.

- Critical findings: none
- Genuine Important findings:
  1. completed AIDA work could become inaccessible;
  2. reset copy overpromised deletion of pending AI work;
  3. Safari/student-Mac/school-wifi acceptance remained unmeasured.
- Resolution:
  1 and 2 were repaired with focused TDD; 3 remains an explicit field gate.

Minor observations about a custom modal focus trap, operational identifiers in
synthetic test fixtures and the missing historic keyboard transcript were
recorded without expanding this bounded repair round.

### Five-model coding consensus panel

Each model received the same neutral, isolated evidence. All five returned
`READY` with no Critical or Important finding:

- HY3 — `gen-1785084213-zttntAgnhGXADwHB53mg`
- GLM-5.2 — `gen-1785084390-9kGhtwmJkUmDa4h7UtiH`
- Kimi K3 — `gen-1785084472-hNjVT5CDT2R3X1NL4gyb`
- DeepSeek V4 Pro — `gen-1785084878-FvHM4M7bAZEaiFRpdJg6`
- Claude Opus 5 — `gen-1785085269-r4TGBW05nob7azeC3sEk`

The repeated minor finding was the malformed public `dev` command. It was
repaired and protected by two contracts. No reviewer loop was run after the
bounded repairs.

## Final non-production QA draft

- Project: `codex-browser-qa-harness`
- Project ID: `8edde91e-88ad-4a96-a49b-ddb8470d27c0`
- Draft deploy ID: `6a664623495871c2faddc5c5`
- URL:
  `https://6a664623495871c2faddc5c5--codex-browser-qa-harness.netlify.app`
- State: `ready`
- Context: `deploy-preview`
- `published_at`: `null`
- Functions: exactly one deterministic fake `qa-api`
- Edge Functions: none

Hosted read-only checks returned:

- index: HTTP `200`, expected game title present;
- fake session: authenticated `qa_pair`;
- release manifest:
  `263e02e28c6cf365e45062afa1632064`;
- service worker: HTTP `200`, `3746` bytes;
- visitor password gate encountered: no.

The fresh retained QA root is:
`C:\tmp\admarket-browser-qa-541d3ee-30212489622`

An earlier unused preflight-only directory is also retained:
`C:\tmp\admarket-browser-qa-4c1697c-30212208049`

It was created before run `30212208049` exposed the obsolete test assertion.
No artifact was downloaded or deployed from that directory. It was not deleted
because deletion requires Peter's explicit approval.

No local tunnel or background QA server was started for the final draft, so
there was no helper process to terminate.

## Evidence boundary and remaining field gates

The QA draft proves the exact static artifact and deterministic stub contract.
It does not prove:

- Safari rendering and behaviour on a student MacBook;
- school-wifi latency, filtering or cache behaviour;
- real Supabase persistence, conflict handling or account reset;
- production Function configuration or secrets;
- visitor protection, edge rate limiting or production headers;
- a browser-controlled offline reload.

Service-worker integrity, core-cache construction and the offline artifact
contract passed deterministically. The original production site, its visitor
controls and its deployed version were not changed. No Supabase project,
account, row, Blob or secret was read or mutated during this QA workflow.
