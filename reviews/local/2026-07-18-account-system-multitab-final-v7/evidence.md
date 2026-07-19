# Advertising Market account system — local pre-migration gate v7

## Reviewer task

Perform a fresh, read-only, unguided adversarial review. Attempt to refute every
claim from the current filesystem using exact absolute paths and line numbers.
Report `CONFIRMED`, `REFUTED`, or `UNVERIFIABLE` per claim. Finish with
`SURVIVES` only when no material local defect remains. Items explicitly labelled
as deployment holds are not represented as completed. Do not inspect older
review output, edit files, contact live services, or infer missing evidence.

## Operational scope

- Same-origin HttpOnly cookies are shared across tabs. An older response from
  tab A must not land after a newer login response from tab B and clear, replace,
  or rotate B's cookies.
- A tab admitted as A must never operate as B after another tab replaces the
  cookie.
- Cloud JSON must be accepted only when local recovery can deterministically
  import it, including arbitrary Fabric passthrough data.
- The paid Supabase project is shared with other games. The unapplied migration
  may add only its exact named objects.

## Claims

1. Production shell, game, and Creator are initially hidden/inert; mandatory
   account access unlocks them only after scoped storage and recovery complete.
2. Session, progress, and asset clients share one canonical in-memory username
   binding. Authenticated session/login/signup activates it; unauthenticated
   session and confirmed logout deactivate it.
3. Progress list/load/save, asset GET/PUT, and logout require the bound
   `x-admarket-account`; valid unbound operations fail before fetch.
4. Netlify resolves cookie identity and exact-compares that header before every
   progress RPC, asset service, or logout mutation. Drift yields only 409
   `ACCOUNT_IDENTITY_CHANGED`, preserves current-account cookies, and cannot
   mutate or log out the newer account.
5. Every production browser request whose response can refresh, rotate, or clear
   the shared HttpOnly cookies—session, login, signup, logout, progress list/load/
   save, and asset GET/PUT—holds one named origin-wide exclusive Web Lock through
   the complete request and response consumption. All three production clients
   receive the same serialiser. Web Locks queue across tabs, so a newer login
   cannot begin until every older protected response has landed. Missing Web
   Locks fail closed with a route-family unavailable error before fetch.
6. Browser drift maps to `AUTHENTICATION_REQUIRED` without masking exact CAS
   `REVISION_CONFLICT` responses.
7. Login/signup/logout publish only a random cross-tab nonce. Peers lock, stop
   cloud state, isolate local work and reload; session observation does not
   publish. The identity header and response-order lock remain hard boundaries
   if events are delayed.
8. Sign-out/expiry locks immediately, isolation precedes reload, failed logout
   remains locked, and stale logout cannot terminate another identity.
9. Drafts and CAS metadata use SHA-256 account namespaces. Late acknowledgements
   are monotonic and original-scope-only, with no next-account UI emission.
10. Local practice IDs use the shared 128-character safe alphabet. Cloud progress
   deliberately adds a narrower lowercase/no-colon 64-character document-key
   rule. Browser save/load, Netlify save/load, cloud recovery, and atomic cloud
   import share one cloud predicate; SQL repeats its exact document-key regex.
   Document/session/team identities are pairwise distinct, non-reserved, and
   safe. Four bounded run-ID candidates guarantee one is distinct from the three
   occupied document identities. Game-created practice document IDs satisfy the
   narrower cloud rule; broader synthetic local-only IDs are not cloud-addressable.
11. The server iteratively scans complete raw Fabric before Zod and complete
   parsed Fabric afterward. Blob case/C0 variants, cycles, aliases, depth over
   100 and over 100,000 nodes fail closed. Semantic collection is also bounded,
   iterative, order-preserving and cycle/alias-rejecting.
12. Durable assets form a restore-safe bijection: every local descriptor has one
   matching cloud descriptor and exact semantic source; every local source is
   the same parsed object selected by the semantic map and has that pair.
13. Private assets are authenticated, account-HMAC-isolated, immutable,
   signature/MIME/hash checked, quota-bound and non-SVG. Recovery verifies bytes
   and atomically imports document, blobs, checkpoint, run and operation.
14. Browser and Supabase transports reject redirects, bound response bodies,
   propagate expiry and expose only constant public errors.
15. The migration collision-preflights role/schema/table/RPC; creates a dedicated
   NOLOGIN/NOBYPASSRLS owner, private schema/table/index and exact RPC; uses an
   empty search path; grants only service-role execution; revokes direct access;
   and fails closed instead of replacing objects.
16. SQL list/load/save are user-scoped and CAS-atomic; discovery is metadata-only
   and capped at 16; conflicts expose revision metadata only. SQL repeats
   selected top-level constraints, not the full TypeScript schema.
17. The exact SQL hash passed executable PGlite role/catalog/ACL/RLS/CRUD/CAS/
   cap/isolation tests and preserved a Signal Lost sentinel. A read-only live
   baseline records the existing Signal Lost tables, RPC and Edge Function.
18. The live read-only collision query recorded zero Advertising Market names.
   Hosted synthetic-email behaviour, environment values, deployed cookies, and
   deployed two-account behaviour remain explicit deployment holds.

## Evidence paths

- `godot/web/godot_shell.html`
- `scripts/build-web.test.mjs`, `scripts/verify-web-export.mjs`
- `web/src/main.ts`, `web/src/main.test.ts`
- all sources and tests under `web/src/account/`, especially
  `account-cookie-request-serialiser.ts` and its test
- `web/src/domain/campaign-document.ts`
- `web/src/domain/campaign-semantic-objects.ts` and test
- `web/src/domain/practice-identity.ts` and test
- `web/src/bridge/practice-contracts.ts`
- `web/src/persistence/local-practice-service.ts` and test
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

- Response-order regressions were observed red before the lock implementation,
  then passed.
- Strict `tsc --noEmit`: exit 0.
- Focused account/main integration: 4 files, 83 tests passed.
- The focused suite includes delayed logout→login, progress→login, and
  asset→login ordering proofs plus exact named exclusive-lock and unavailable-
  lock fail-closed tests.
- Full serial Vitest after all current changes: 118 files, 1,808 tests passed in
  114.71 seconds.
- Build contracts after current account changes: 60/60 passed.
- A fresh Godot 4.7.1 invocation did not produce game-test evidence because the
  engine itself crashed at native startup with signal 11; redirecting its log to
  `C:\tmp` did not change the crash. This web/account change does not claim a
  fresh Godot pass.
- Unapplied SQL SHA-256:
  `e61886e7feebc42e0710ded65e3d473ce5ba85a5f031a4ed514fa41da7b91829`.
- Live read-only collision preflight: zero rows; no migration/deployment write.
