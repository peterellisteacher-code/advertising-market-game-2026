# Advertising Market account system — local pre-migration gate v5

## Reviewer task

Perform a fresh, read-only, unguided adversarial review. Attempt to refute every
claim from the current filesystem using exact absolute paths and line numbers.
Report `CONFIRMED`, `REFUTED`, or `UNVERIFIABLE` per claim. Finish with
`SURVIVES` only when no material local defect remains. Items explicitly labelled
as deployment holds are not represented as completed. Do not inspect any older
review output, edit files, contact live services, or infer evidence not present
in the supplied paths.

## Operational scope

- Same-origin HttpOnly cookies are shared across tabs. A tab admitted as account
  A must never operate as B after another tab replaces the shared cookie.
- Stored cloud campaign JSON must be accepted only when local recovery can
  deterministically import it, including arbitrary Fabric passthrough data.
- The paid Supabase project is shared with other games. The unapplied migration
  may add only its exact named objects.

## Claims

1. Production shell, game, and Creator surfaces are initially hidden and inert;
   mandatory account access unlocks them only after account-scoped storage and
   cloud recovery complete.
2. Session, progress, and asset clients share one in-memory canonical username
   binding. Authenticated session/login/signup activates it; unauthenticated
   session and confirmed logout deactivate it.
3. Progress list/load/save, asset GET/PUT, and logout require the bound
   `x-admarket-account`; valid unbound operations fail before fetch.
4. Netlify resolves cookie identity and exact-compares that header before any
   progress RPC, asset/blob service, or logout mutation. A stale or missing header
   yields only 409 `ACCOUNT_IDENTITY_CHANGED`, preserves current-account cookies,
   and cannot mutate or log out the newer account.
5. Browser identity drift maps to `AUTHENTICATION_REQUIRED` without masking the
   exact `REVISION_CONFLICT` CAS response.
6. Login/signup/logout publish only a random cross-tab storage nonce. Peers lock,
   stop cloud state, isolate local work and reload; session observation does not
   publish. The header binding remains the hard boundary if the event is delayed.
7. Sign-out or expiry locks immediately, isolation precedes reload, failed logout
   remains locked, and stale logout cannot terminate another identity.
8. Drafts and CAS metadata use preserved SHA-256 account namespaces. Late cloud
   acknowledgements are monotonic and original-scope-only, with no next-account
   UI emission.
9. Browser save/load, Netlify save/load, recovery orchestration, checkpoint
   schema, and atomic import share the same local-practice safe-ID alphabet and
   128-character bound. Cloud document/session/team identities must be present,
   pairwise distinct and not `classroom-campaign`. Recovery chooses the first of
   four bounded run-ID candidates not occupied by those three identities, so an
   accepted cloud document is not rejected merely because the first candidate
   collides. Offline/no-room, envelope document, and team requirements also match.
10. Before Zod refinement, the server iteratively scans the complete raw Fabric
    state; afterward it scans the complete parsed state. Blob-protocol case/C0
    variants anywhere are rejected. Cycles, aliases, depth greater than 100 and
    more than 100,000 nodes fail closed. Semantic collection is also iterative,
    bounded, order-preserving and cycle/alias-rejecting.
11. Durable local assets form a restore-safe bijection: every local descriptor
    has exactly one matching cloud descriptor and exact semantic Fabric source;
    every local source anywhere is the same parsed object instance selected by
    the semantic map for its objectId and has the matching descriptor pair.
12. Private assets are authenticated, account-HMAC-isolated, immutable,
    signature/MIME/hash checked, quota-bound and non-SVG. Recovery verifies bytes
    and atomically imports document, blobs, checkpoint, run and operation.
13. Browser and Supabase transports reject redirects, bound response bodies,
    propagate expiry and expose only constant public errors.
14. The migration collision-preflights its role/schema/table/RPC; creates a
    dedicated NOLOGIN/NOBYPASSRLS owner, private schema/table/index and exact RPC;
    uses an empty search path; grants only service-role execution; revokes direct
    access; and fails closed instead of replacing existing objects.
15. SQL list/load/save are user-scoped and CAS-atomic; discovery is metadata-only
    and capped at 16; conflicts expose revision metadata only. SQL intentionally
    repeats selected top-level checks, not the full TypeScript campaign schema.
16. The exact SQL hash passed executable PGlite role/catalog/ACL/RLS/CRUD/CAS/
    cap/account-isolation tests and preserved a Signal Lost sentinel. A read-only
    live baseline records the existing Signal Lost tables, RPC and Edge Function.
17. The live read-only collision query recorded zero Advertising Market names.
    Hosted synthetic-email behaviour, final environment values, deployed cookies,
    and deployed two-account behaviour remain explicit post-migration/deployment
    holds, not claims of completion.

## Evidence paths

- `godot/web/godot_shell.html`
- `scripts/build-web.test.mjs`, `scripts/verify-web-export.mjs`
- `web/src/main.ts`, `web/src/main.test.ts`
- all sources and tests under `web/src/account/`
- `web/src/domain/campaign-document.ts`
- `web/src/domain/campaign-semantic-objects.ts` and test
- `web/src/domain/practice-identity.ts` and test
- `web/src/bridge/practice-contracts.ts`
- `web/src/persistence/account-scoped-draft-store.ts`
- `web/src/persistence/draft-store.ts` and test
- `netlify/functions/account-session.mts` and test
- `netlify/functions/account-progress.mts` and test
- `netlify/functions/account-assets.mts` and test
- `netlify/functions/lib/account-primitives.ts` and test
- `netlify/functions/lib/account-progress-document.ts` and test
- `netlify/functions/lib/account-assets.ts` and test
- `netlify/functions/lib/netlify-account-assets.ts` and test
- `netlify/functions/lib/account-backend.ts` and test
- `docs/operations/advertising-game-account-progress.sql`
- `docs/operations/advertising-game-account-progress.md`
- `reviews/local/2026-07-17-progress-sql-pglite/validate-progress-sql-rerun.mjs`
- `reviews/local/2026-07-17-progress-sql-pglite/result-2026-07-18-rerun.md`
- `reviews/local/2026-07-18-live-preflight-before-migration.md`

## Verification

- New incompatible-identity and run-collision regressions were observed red and
  then passed after the shared invariant was implemented.
- Strict `tsc --noEmit`: exit 0.
- Focused account/domain/Netlify/main integration: 38 files, 628 tests passed.
- Full serial Vitest after all current changes: 117 files, 1,801 tests passed in
  139.98 seconds.
- Build contracts after all current changes: 60/60 passed.
- Godot 4.7.1 game/Creator/Market suite: exit 0 with explicit pass; only its
  expected malformed-base64 negative diagnostic and known shutdown warnings.
- Unapplied SQL SHA-256:
  `e61886e7feebc42e0710ded65e3d473ce5ba85a5f031a4ed514fa41da7b91829`.
- Live read-only collision preflight: zero rows; no migration or deployment write
  has occurred.
