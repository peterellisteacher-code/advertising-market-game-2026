# Advertising Market account system — local pre-migration gate v8

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
- Every server-admitted cloud document must be safe for deterministic local
  recovery, including arbitrary schema-permitted non-Fabric JSON.
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
   shared HttpOnly cookies—session, login, signup, logout, progress list/load/save,
   and asset GET/PUT—uses the same named origin-wide exclusive Web Lock. The lock
   starts before fetch and lasts until fetch has exposed the response headers;
   all client-consumed bodies are also parsed while it remains held. The Fetch
   Standard processes response `Set-Cookie` headers before exposing a response,
   so this is the cookie-mutation ordering boundary; intentionally ignored 401
   bodies need not be downloaded for cookie ordering. Missing Web Locks fail
   closed with a route-family unavailable error before fetch.
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
   adds a narrower lowercase/no-colon 64-character document-key rule. Browser,
   Netlify, recovery and atomic import share the cloud predicate; SQL repeats its
   exact document-key regex. Document/session/team identities are pairwise
   distinct, non-reserved and safe; four run-ID candidates guarantee a distinct
   run identity.
11. One shared iterative campaign-JSON guard runs before and after browser/server
   schema parsing and before canonical hashing. It bounds the complete document
   at 128 object/array levels and 120,000 object/array nodes and rejects cycles,
   aliases, sparse arrays, accessors, non-plain objects, non-finite numbers and
   non-JSON primitives. Valid inputs retain the pre-guard canonical hash.
12. Fabric receives additional complete raw and parsed scans for transient blob
   protocols and local-source collection. Those scans and semantic collection
   are bounded, iterative, order-preserving and cycle/alias-rejecting.
13. Durable assets form a restore-safe bijection: every local descriptor has one
   matching cloud descriptor and exact semantic source; every local source is
   the same parsed object selected by the semantic map and has that pair.
14. Private assets are authenticated, account-HMAC-isolated, immutable,
   signature/MIME/hash checked, quota-bound and non-SVG. Recovery verifies bytes
   and atomically imports document, blobs, checkpoint, run and operation. The
   complete-document guard ensures every admitted document reaches hashing and
   recovery without recursive traversal overflow.
15. Browser and Supabase transports reject redirects; every body they consume is
   byte-bounded; 401 bodies deliberately ignored by progress/assets are not
   parsed; expiry propagates; and only constant public errors are exposed.
16. The migration collision-preflights role/schema/table/RPC; creates a dedicated
   NOLOGIN/NOBYPASSRLS owner, private schema/table/index and exact RPC; uses an
   empty search path; grants only service-role execution; revokes direct access;
   and fails closed instead of replacing objects.
17. SQL list/load/save are user-scoped and CAS-atomic; discovery is metadata-only
   and capped at 16; conflicts expose revision metadata only. The exact SQL hash
   passed executable PGlite role/catalog/ACL/RLS/CRUD/CAS/cap/isolation tests and
   preserved a Signal Lost sentinel.
18. A read-only live baseline records the existing Signal Lost tables, RPC and
   Edge Function, and the live collision query recorded zero Advertising Market
   names. Hosted synthetic-email behaviour, environment values, deployed cookies,
   and deployed two-account behaviour remain explicit deployment holds.

## Evidence paths

- `godot/web/godot_shell.html`
- `scripts/build-web.test.mjs`, `scripts/verify-web-export.mjs`
- `web/src/main.ts`, `web/src/main.test.ts`
- all sources and tests under `web/src/account/`, especially
  `account-cookie-request-serialiser.ts` and its test
- `web/src/domain/bounded-campaign-json.ts` and test
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
- Fetch Standard §3.1 cookies and Fetch API response handoff:
  `https://fetch.spec.whatwg.org/#cookies` and
  `https://fetch.spec.whatwg.org/#fetch-api`

## Verification

- Response-order and non-Fabric-depth regressions were observed red before their
  respective implementations, then passed.
- Strict `tsc --noEmit`: exit 0.
- Focused account/domain/persistence/Netlify/main integration: 7 files,
  171 tests passed.
- Focused coverage includes delayed logout→login, progress→login and asset→login
  ordering; exact named exclusive-lock and all three unavailable-lock fail-closed
  paths; complete-document depth/node/cycle/alias/non-JSON guards; deep generic
  asset metadata; and valid near-boundary server admission and canonical hashing.
- Full serial Vitest after all current changes: 119 files, 1,822 tests passed in
  125.27 seconds.
- Build contracts after current account changes: 60/60 passed.
- A fresh Godot 4.7.1 invocation did not produce game-test evidence because the
  engine itself crashed at native startup with signal 11; redirecting its log to
  `C:\tmp` did not change the crash. This web/account change does not claim a
  fresh Godot pass.
- Unapplied SQL SHA-256:
  `e61886e7feebc42e0710ded65e3d473ce5ba85a5f031a4ed514fa41da7b91829`.
- Live read-only collision preflight: zero rows; no migration/deployment write.
