# Live-room reliability implementation plan

**Goal:** Make a 50–60 minute paired classroom market recoverable from reloads, slow or lost responses, concurrent browser tabs, and teacher/student retries without regressing authoritative room state.

**Constraints:** Preserve same-origin Netlify functions and server authority; keep each browser tab independent; never expose bearer tokens through Godot bridge JSON, logs, snapshots, or assets; preserve the six-hour room expiry and purchase idempotency; migrate strict persisted state without invalidating live rooms; use test-first changes and one coherent schema migration.

## Review resolution

- The coding Fusion request returned `panel_incomplete`; it was not retried.
- A fresh unguided adversarial Sol review rejected the earlier plan because it lacked domain command IDs, schema migration, startup arbitration, response-body deadlines, bearer/XSS safeguards, and explicit spectator semantics.
- Accepted corrections: one unified v1→v2 room normalizer; replay-first actor-scoped command receipts; deterministic create/join intents; bearer-first authentication with no invalid-bearer cookie fallback; CSP; live-before-practice startup arbitration; frozen buyer/seller/campaign cohorts.
- Already implemented and verified: all browser requests remain timed until response bodies finish; Godot accepts only present nonnegative integer snapshot revisions and rejects lower revisions within the active room generation.

## Milestone 1 — One backward-compatible stored schema

1. Keep the storage-envelope `version: 1`; introduce strict `MarketRoomV1Schema`, strict `MarketRoomV2Schema`, and `normalizeMarketRoom(value)`.
2. Add private v2 session bindings for deterministic create/join replay, `submissionVersion` on campaigns, nullable `marketCohort`, and a bounded actor-scoped command-receipt ledger.
3. Normalize valid v1 state in memory. Building rooms receive no cohort; live legacy rooms retain all legacy teams as buyers while approved sellers/campaigns form the seller side. Campaigns become submission version 1. Invalid v1/v2 fails closed.
4. Reads do not rewrite. The next successful CAS mutation persists v2 with the original expiry. No bulk migration is needed because rooms expire after six hours.

## Milestone 2 — Safe per-tab session lifecycle

1. Add a bounded browser `MarketSessionStore` backed by `sessionStorage`. It holds a stable per-tab client ID, one retained create/join intent (`operationId` plus canonical input fingerprint), and an active bearer envelope.
2. Create/join bodies carry `clientId` and `operationId`. The client preserves an uncertain intent and reuses it until its result is known; a changed payload receives a new intent.
3. Derive create-room candidates deterministically from a domain-separated HMAC of the create intent. Matching creator binding replays the existing room without extending expiry; collision advances through the bounded candidate sequence.
4. Store join intent binding and team creation in the same room CAS. An identical replay returns the original team without consuming a seat or revision; a different canonical payload returns `IDEMPOTENCY_CONFLICT`. Removing a team removes its join bindings.
5. Create/join responses contain an internal session token envelope. `MarketClient` validates and stores it before returning only `{ role, roomCode, snapshot }`; `MarketPublicApi` independently reconstructs that exact safe shape.
6. New protected requests send `Authorization: Bearer …`. If an Authorization header is present, it is authoritative: malformed, tampered, or expired bearer fails and never falls back to a cookie. Cookie auth remains only for bounded legacy compatibility.
7. Add `GET /api/market/resume`. It returns `{ role, roomCode, snapshot }`, does not rotate or extend expiry, and terminal invalid/expired/removed sessions clear matching local session state. Transient failures retain state.
8. Generate a Godot-compatible CSP for the inline bootstrap hash, same-origin scripts/assets, WASM, workers and blobs; retain COOP/COEP/CORP isolation headers. Add a token-free `BroadcastChannel` collision check before a duplicated tab’s first market request.

## Milestone 3 — Deterministic startup and room-draft recovery

1. Replace direct practice recovery with one generation-gated startup state machine: live resume → exact live-team hydration → practice resume → lobby. A transient live error stops at the lobby rather than silently opening unrelated practice state.
2. Add `resumeSession` to the browser API, Godot bridge and host with a dedicated validated result signal. Manual create/join or practice start invalidates older startup callbacks.
3. For a resumed team, derive the canonical room/team document identity, restore only matching versioned live progress, then `loadLatest(documentId)` and accept only exact room/team/session identity. Enable Studio only after hydration completes.
4. Wire the existing `WebRunProgressStore.gd` and fake to a bounded live-progress envelope. Save after live begin/lock/advance and creator-state updates. Never clear progress on a transient network error or an identity mismatch.
5. Preserve exact revision/blob recovery, save-before-close, practice recovery validation, monotonic room-generation snapshot gates, and manual route-race guards.

## Milestone 4 — Replay-safe commands and authoritative review

1. Add a stable actor-scoped `commandId` to publish, finish, review and teacher controls. The bridge transport `requestId` remains separate.
2. Canonicalize each semantic payload with a versioned fixed property order. For every transition, check an existing receipt before revision, phase, version or eligibility rules. Same actor/ID/payload replays; different payload or operation conflicts.
3. Append the bounded receipt and domain effect in the same single-revision CAS commit. Store only a compact postcondition, never a snapshot. Reject new commands when the fixed 512-receipt ledger is full; do not evict unsafe retry history.
4. First publish creates submission version 1; returned resubmission increments it. Reviews carry the displayed version. A new stale review conflicts, while a previously successful identical command replays safely even after later changes.
5. Godot retains each logical command ID across an ambiguous result until its postcondition is observed. A changed semantic payload creates a new ID. Preserve purchase’s existing request ID, replay-first order and receipt behavior unchanged.

## Milestone 5 — Frozen market participants and spectators

1. On `openMarket`, freeze sorted buyer team IDs, seller team IDs and campaign IDs. For new rooms, teams with approved campaigns are both buyers and sellers; other joined teams become spectators. Require at least three sellers and evaluate affordability only within the frozen cohort.
2. Purchases require eligible buyers and frozen campaigns; finish/reveal/readiness/standings use only the buyer cohort. Legacy normalized live rooms keep all original teams as buyers.
3. Expose strict eligibility in team and teacher snapshots. Student UI shows a clear spectator state with buying/finish disabled; teacher readiness counts only required buyers.
4. Export one set of domain predicates for `canOpenMarket`, `canOpenReveal` and `canCloseMarket`, and use them for both snapshots and mutations.

## Verification

- Contracts/migration: strict v1/v2 acceptance, lazy normalization, malformed-state rejection, unchanged expiry, CAS upgrade, private data absent from snapshots.
- Sessions/auth: deterministic create replay, atomic join replay/conflict, two tabs with different bearer identities despite one shared cookie, invalid bearer never falls back, resume/expiry/removal, token stripped at both client and public API boundaries, duplicated-tab collision handling.
- Commands: first commit, identical stale-revision replay, replay after later phase/version, mismatched reuse conflict, concurrent CAS, full ledger, stale moderation, command-ID retention after timeouts.
- Cohort: approved teams shop; unfinished/unapproved teams spectate and never block reveal; affordability, finish and standings use exactly the frozen cohort; legacy behavior remains compatible.
- Startup/browser/Godot: live resume wins over practice; exact room draft hydration before Studio; terminal cleanup versus transient retention; late callbacks cannot replace selected state; delayed snapshots cannot regress state.
- Project gates: focused Vitest suites, complete Vitest suite, TypeScript, complete Godot headless suite, non-destructive web build, export verifier, multi-tab browser playtest, CSP/isolation smoke test, and secret scan of bridge JSON/logs/static assets.
