# Independent coding review: live-room reliability plan

Review the proposed architecture below as an independent, adversarial technical reviewer. Assess correctness, security, race safety, replay semantics, classroom recoverability, schema compatibility, and test sufficiency. Identify any blocking flaw, unnecessary complexity, or missing invariant. Return a severity-ranked verdict and a concrete corrected architecture where needed.

## Product context

- Browser-exported Godot 4 classroom game hosted on Netlify.
- Pairs share one classroom computer for a 50–60 minute advertising market.
- A teacher creates a room; teams join, design and publish a product advertisement; the teacher reviews; teams buy other teams' products; the server reveals revenue standings.
- A classroom session must survive reloads, slow/lost responses and ordinary retries without duplicate seats, duplicate purchases, stale approvals or state regression.
- Same-origin Netlify functions remain authoritative. No student-identifying material is included in this review.

## Current operational contract

- Create/join issue one signed session in a same-origin HTTP-only cookie.
- All same-origin tabs therefore share whichever room cookie was written most recently.
- Join creates a fresh team before returning; the request carries no idempotency identity.
- Browser requests have no deadline.
- Server snapshots include a monotonic integer room revision; the Godot host currently accepts any response from the active room generation.
- Purchase commands already use an actor-scoped request ID and canonical-payload replay check.
- Publish, finish, review and phase controls are not replay-safe.
- Campaign review identifies only campaign ID and desired status, while returned campaigns can be replaced under the same campaign ID.
- Teacher `canOpenMarket` is computed more loosely than the authoritative domain mutation.
- Market/reveal readiness and standings currently iterate every joined team.
- Creator autosave persists practice-mode documents but not room-mode drafts.

## Proposed implementation

### Milestone 1: per-tab session lifecycle

1. Add a browser `MarketSessionStore` backed by `sessionStorage`, containing a bounded opaque signed token and stable per-tab client ID.
2. Create/join return the signed token in JSON. `MarketClient` validates and stores it only if that request is still the newest local room intent, strips it from the value returned through `window.AdMarketRoom`, and sends it thereafter as a bounded Bearer token.
3. Server auth reads Bearer first; a cookie may be accepted only as a temporary compatibility input. New create/join responses no longer set the shared cookie.
4. Join carries the stable per-tab client ID. The room persists it privately on the team. Repeating the same room/client ID and canonical alias returns the existing team and a fresh token without revision/seat growth; a different canonical payload returns `IDEMPOTENCY_CONFLICT`.
5. A new `resumeSession` bridge method quietly returns null when no token exists, otherwise calls snapshot and returns role + room code + snapshot. Godot invokes it on startup and restores the correct live role/screen.
6. Every request gets a finite AbortController deadline and stable `REQUEST_TIMEOUT` error; timers are always cleared.
7. Godot accepts snapshots only when revision is an integer and is at least the last accepted revision for the current room generation; the gate resets on session change.

### Milestone 2: replay-safe domain commands

1. Identical publish replays return the existing campaign/current snapshot without a revision change. Changed submissions are accepted only from `returned`.
2. Each campaign carries a monotonic submission version. Teacher review submits the displayed version. A stale version conflicts; identical review retries are no-op successes.
3. Finish and phase controls are no-op successes when the requested canonical state already holds; mismatched command reuse still conflicts.
4. Snapshot readiness flags call the same exported predicates as the domain mutations.
5. Opening the market freezes `marketTeamIds` to teams with approved campaigns. Purchases, finish/reveal readiness and standings use the frozen set; joined-but-inactive teams are excluded.

### Milestone 3: local room draft recovery

1. Autosave room creator documents locally by room/team/document identity.
2. Resume hydrates the matching local draft before opening Studio.
3. Ambiguous timeouts trigger one canonical snapshot reconciliation before the UI reports failure or offers retry.

## Acceptance constraints

- Two same-origin tabs can hold different roles/rooms without overwriting each other.
- A lost join response followed by retry does not consume another seat.
- A stale join response cannot replace the active tab's session.
- Reload restores the prior role, room and team without asking the student to join again.
- No token appears in Godot bridge JSON, logs, snapshots or exported assets.
- Lower-revision snapshots never overwrite higher-revision state.
- Retrying a committed publish/finish/review/control does not duplicate or spuriously fail.
- A teacher cannot approve content submitted after the reviewed snapshot.
- Teacher readiness controls exactly match server authority.
- A team without an approved campaign when market opens cannot block reveal or enter standings.
- Existing purchase idempotency and server-side price/wallet authority remain intact.
- Tests cover lost acknowledgement, replay conflict, cross-tab isolation, reload resume, stale review and out-of-order snapshots.

