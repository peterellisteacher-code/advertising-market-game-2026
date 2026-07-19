# Advertising Market account system — fresh pre-migration evidence

## Review question

Attempt to refute the security, isolation, integrity, and deployment-readiness
claims below by reading the current filesystem implementation and tests. Treat
each claim independently as CONFIRMED, REFUTED, or UNVERIFIABLE, cite exact
absolute paths and line numbers, identify the most load-bearing failure if any,
and finish with `SURVIVES` only if no material local defect remains. This is a
read-only pre-migration review: no live Supabase or Netlify action is authorised.

## Operational context

- The browser runs as a static Netlify site with same-origin Netlify Functions.
- Authentication uses HttpOnly Supabase-backed cookies. Cookies are shared by
  every same-origin tab, while IndexedDB and cloud-revision metadata must remain
  isolated per canonical classroom username.
- Students may open multiple tabs. A request from a tab admitted as account A
  must never write, read, upload, download, or log out as account B after another
  tab replaces the shared cookie session.
- No token, synthetic email, Supabase user ID, password, or username may be
  persisted in the cross-tab mutation signal.
- The existing paid Supabase project is shared. The proposed migration may add
  only its named Advertising Market objects and must not change Signal Lost or
  other application objects.
- The SQL and Netlify Functions remain local and unapplied.

## Claims to attack

1. Cold-start game and Creator surfaces stay hidden and inert until an exact
   account session has activated account-scoped storage and cloud recovery.
2. One shared in-memory account binding is used by session, progress, and asset
   clients. Successful session/login/signup establishes only a canonical
   username; unauthenticated session and confirmed logout deactivate it.
3. Every progress list/load/save, asset GET/PUT, and logout request requires the
   active tab identity in exact header `x-admarket-account`. Unbound operations
   fail before fetch.
4. After resolving the cookie session, Netlify compares that header exactly to
   the resolved canonical username before any progress RPC, asset-service/blob,
   or logout mutation. Missing, malformed, or mismatched identity returns only
   HTTP 409 `ACCOUNT_IDENTITY_CHANGED`, preserves valid rotated current-session
   cookies, and cannot clear or mutate another account.
5. Browser clients map that wire-only identity error to their existing
   `AUTHENTICATION_REQUIRED` boundary without confusing it with progress CAS
   `REVISION_CONFLICT`.
6. Successful login, signup, and logout publish only a random same-origin
   storage nonce. Other tabs promptly lock, isolate account work, stop cloud
   state, and reload; cold session observation does not publish or create a
   reload loop. The request header remains the hard boundary if the event is
   missing or delayed.
7. Explicit sign-out or authentication expiry immediately locks both game
   surfaces. Local/cloud teardown completes before reload, failed logout stays
   locked, and a stale logout cannot terminate a newer cookie identity.
8. IndexedDB drafts and cloud CAS metadata use preserved SHA-256-derived account
   namespaces. Late acknowledgements write monotonically only to the captured
   original-account namespace and cannot update another account's UI state.
9. Browser, Netlify, and SQL accept only bounded canonical offline campaign
   documents with matching document ID, nonempty team ID, and no room binding.
10. No `blob:` URL can cross the cloud boundary anywhere beneath the full nested
    Fabric object graph, including non-semantic decoration nodes and case/C0
    variants. Traversal fails closed on cycles, excessive depth, or excessive
    nodes without recursive stack exhaustion.
11. Every declared local asset has exactly one bounded cloud descriptor;
    private asset routes are authenticated, account-HMAC-namespaced, immutable,
    signature/MIME/hash checked, quota-bound, and reject SVG.
12. Recovery verifies downloaded asset bytes and atomically imports the campaign
    document, blobs, checkpoint, run, and operation into the active account.
13. Browser and Supabase transports reject redirects, bound response bodies,
    propagate authentication expiry, and surface only constant public errors.
14. The migration fails on named collisions; creates one dedicated
    NOLOGIN/NOBYPASSRLS owner, private schema/table/index, and exact RPC; keeps an
    empty function search path; grants RPC execution only to `service_role`; and
    revokes direct schema/table access.
15. SQL list/load/save are user-scoped, CAS-atomic, capped at 16 documents, and
    return revision metadata rather than document data on conflicts.
16. The migration and local validation do not alter the pre-existing Signal Lost
    sentinel or any unrelated named object.
17. Live project collision state, hosted synthetic-email behavior, environment
    configuration, deployed cookies, and deployed two-account behavior remain
    unverified and therefore remain explicit deployment holds rather than local
    claims of completion.

## Primary evidence paths

- `web/src/account/account-identity-binding.ts`
- `web/src/account/account-identity-binding.test.ts`
- `web/src/account/account-client.ts`
- `web/src/account/account-client.test.ts`
- `web/src/account/account-asset-client.ts`
- `web/src/account/account-asset-client.test.ts`
- `web/src/account/account-gate.ts`
- `web/src/account/account-gate.test.ts`
- `web/src/account/account-storage-namespace.ts`
- `web/src/account/cloud-progress-sync.ts`
- `web/src/account/cloud-progress-recovery.ts`
- `web/src/account/cloud-asset-adapter.ts`
- `web/src/persistence/account-scoped-draft-store.ts`
- `web/src/persistence/draft-store.ts`
- `web/src/main.ts`
- `netlify/functions/lib/account-primitives.ts`
- `netlify/functions/account-session.mts`
- `netlify/functions/account-progress.mts`
- `netlify/functions/account-assets.mts`
- `netlify/functions/lib/account-progress-document.ts`
- `netlify/functions/lib/account-assets.ts`
- `netlify/functions/lib/account-backend.ts`
- paired tests beside every Netlify source above
- `docs/operations/advertising-game-account-progress.sql`
- `docs/operations/advertising-game-account-progress.md`
- `reviews/local/2026-07-17-progress-sql-pglite/validate-progress-sql-rerun.mjs`
- `reviews/local/2026-07-17-progress-sql-pglite/result-2026-07-18-rerun.md`

## Fresh local verification

- Strict `tsc --noEmit`: exit 0 on 2026-07-18.
- Focused integrated account/function run: 13 files, 194 tests passed.
- Full serial Vitest run: 116 files, 1,789 tests passed in 150.49 seconds.
- Build-contract Node run: 60/60 passed.
- Godot 4.7.1 headless game/Creator/Market suite: exit 0 and explicit pass.
  It emitted the expected malformed-base64 negative-test diagnostic plus the
  existing shutdown warnings for 7 ObjectDB instances and 3 resources.
- Current unapplied SQL SHA-256:
  `e61886e7feebc42e0710ded65e3d473ce5ba85a5f031a4ed514fa41da7b91829`.
- The current PGlite rerun executes that hash successfully and covers role,
  catalog, ACL, RLS, list/load/save/order/CAS/conflict/16-cap/team-ID/account
  isolation and a preserved Signal Lost sentinel. It does not contact the live
  project.
