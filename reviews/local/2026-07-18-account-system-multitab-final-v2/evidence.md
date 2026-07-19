# Advertising Market account system — pre-migration evidence v2

## Neutral review task

Perform a fresh read-only adversarial review of the current filesystem. Attempt
to refute every claim below independently. Return CONFIRMED, REFUTED, or
UNVERIFIABLE per claim with exact absolute paths and line numbers, name the most
load-bearing defect if one exists, and end with `SURVIVES` only when there is no
material local security, isolation, integrity, or migration-readiness defect.
Do not access or mutate live accounts, Supabase data, Netlify, or local files.

## Context and acceptance constraints

- Netlify serves a browser game and same-origin Functions. Supabase-backed
  HttpOnly cookies are shared by all same-origin tabs.
- A tab admitted as classroom account A must never read/write/upload/download
  or log out as B after a second tab replaces the shared cookie with B.
- Account-scoped local drafts and cloud revision metadata must remain isolated.
- No token, email, Supabase user ID, password, or username may be persisted in
  the cross-tab notification value.
- Cloud documents may contain nested and top-level Fabric passthrough fields.
  No transient `blob:` URL may reach Supabase anywhere in that Fabric state.
- The shared paid Supabase project contains unrelated games. Only the exact
  proposed Advertising Market objects may be added.
- The migration and Functions are still unapplied/undeployed.

## Claims

1. Game and Creator surfaces remain hidden/inert until exact session admission,
   account-scoped storage activation, and cloud recovery complete.
2. Session, progress, and asset clients share one canonical in-memory username
   binding; authenticated session/login/signup activates it, unauthenticated
   session and confirmed logout deactivate it.
3. Bound `x-admarket-account` is required on every progress list/load/save,
   asset GET/PUT, and logout. Valid unbound operations fail before fetch.
4. Netlify resolves the cookie session and exact-compares the header before any
   progress RPC, asset service/blob, or logout mutation. A stale/missing header
   yields only 409 `ACCOUNT_IDENTITY_CHANGED`, preserves rotated B cookies, and
   cannot clear or mutate B.
5. Browsers map identity drift to `AUTHENTICATION_REQUIRED` while preserving the
   distinct `REVISION_CONFLICT` CAS path.
6. Login/signup/logout publish only a random storage nonce. Other tabs promptly
   lock, stop cloud state, isolate local work, and reload; session observation
   does not publish. The request header remains the hard boundary if events lag.
7. Sign-out and expiry lock immediately, teardown precedes reload, failed logout
   stays locked, and stale logout cannot terminate a newer identity.
8. Drafts and CAS metadata use preserved SHA-256 account namespaces; late cloud
   acknowledgements are monotonic, original-scope-only, and UI-suppressed after
   account change.
9. Browser and Netlify enforce the full canonical bounded offline campaign
   document, matching document/team identity, and no room binding. The SQL RPC
   deliberately repeats only selected top-level identity/version/mode/revision
   constraints as defense in depth; it is not represented as a second full
   CampaignDocument schema validator and is executable only by the server role.
10. The cloud parser iteratively scans the complete raw Fabric state before
    schema refinement and the complete parsed Fabric state afterward. It catches
    blob protocol case/C0 variants in objects, decorations, clip/background and
    other top-level passthrough nodes; cycles, aliases, depth >100, and >100,000
    nodes fail closed. Semantic object collection is iterative and bounded, so
    it cannot recurse first and exhaust the stack.
11. Every local asset has exactly one bounded descriptor. Asset routes are
    authenticated, account-HMAC-isolated, immutable, signature/MIME/hash checked,
    quota-bound, and reject SVG.
12. Recovery verifies bytes and atomically imports document, blobs, checkpoint,
    run, and operation into the active account.
13. Browser/Supabase transports reject redirects, bound response bodies,
    propagate expiry, and expose only constant public errors.
14. The migration collision-preflights all names; creates one dedicated
    NOLOGIN/NOBYPASSRLS owner, private schema/table/index and exact RPC; keeps an
    empty search path; grants RPC execution only to `service_role`; revokes
    direct schema/table access; and fails closed rather than replacing objects.
15. SQL list/load/save are user-scoped and CAS-atomic, discovery is metadata-only
    and capped at 16, conflicts disclose revision metadata only.
16. Local migration execution preserves an unrelated Signal Lost sentinel. A
    live read-only baseline exists for the two tables, RPC, and Edge Function.
17. The live collision query currently returns zero rows. Hosted synthetic-email
    behavior, final environment values, deployed cookie behavior, and deployed
    two-account behavior remain explicit activation holds—not completion claims.

## Files to inspect

- `web/src/account/account-identity-binding.ts` and test
- `web/src/account/account-client.ts` and test
- `web/src/account/account-asset-client.ts` and test
- `web/src/account/account-gate.ts` and test
- `web/src/account/account-storage-namespace.ts`
- `web/src/account/cloud-progress-sync.ts`
- `web/src/account/cloud-progress-recovery.ts`
- `web/src/account/cloud-asset-adapter.ts`
- `web/src/persistence/account-scoped-draft-store.ts`
- `web/src/persistence/draft-store.ts`
- `web/src/domain/campaign-document.ts`
- `web/src/domain/campaign-semantic-objects.ts` and test
- `web/src/main.ts` and the account bootstrap cases in `web/src/main.test.ts`
- `netlify/functions/lib/account-primitives.ts` and test
- `netlify/functions/account-session.mts` and test
- `netlify/functions/account-progress.mts` and test
- `netlify/functions/account-assets.mts` and test
- `netlify/functions/lib/account-progress-document.ts` and test
- `netlify/functions/lib/account-assets.ts`
- `netlify/functions/lib/netlify-account-assets.ts`
- `netlify/functions/lib/account-backend.ts`
- `docs/operations/advertising-game-account-progress.sql`
- `docs/operations/advertising-game-account-progress.md`
- `reviews/local/2026-07-17-progress-sql-pglite/validate-progress-sql-rerun.mjs`
- `reviews/local/2026-07-17-progress-sql-pglite/result-2026-07-18-rerun.md`
- `reviews/local/2026-07-18-live-preflight-before-migration.md`

## Current evidence

- Strict `tsc --noEmit`: exit 0.
- Focused domain/account/function run: 11 files, 141 tests passed.
- Full serial Vitest after all current changes: 116 files, 1,792 tests passed in
  182.52 seconds.
- Build-contract suite: 60/60 passed.
- Godot 4.7.1 game/Creator/Market suite: exit 0 with explicit pass; only the
  expected malformed-base64 negative-test diagnostic and known shutdown leaks.
- Unapplied SQL SHA-256:
  `e61886e7feebc42e0710ded65e3d473ce5ba85a5f031a4ed514fa41da7b91829`.
- That hash passed the PGlite role/catalog/ACL/RLS/list/load/save/order/CAS/
  cap/team/account-isolation/Signal-Lost-sentinel harness.
- The live read-only name-collision query returned zero rows. No migration,
  project/branch, configuration, or deployment write has occurred.
