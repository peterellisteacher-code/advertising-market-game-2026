# Advertising Market account system — local pre-migration gate v3

## Reviewer task

Fresh, read-only, unguided adversarial review. Attempt to refute each claim from
the current filesystem, using exact absolute paths and line numbers. Report
CONFIRMED, REFUTED, or UNVERIFIABLE per claim and finish with `SURVIVES` only if
no material local defect remains. External activation items explicitly labelled
as holds are not represented as completed. Do not inspect older review outputs,
edit files, or contact live services.

## Threat and scope

- Same-origin HttpOnly cookies are shared across browser tabs. A tab admitted as
  A must never operate under B after another tab replaces the shared cookie.
- Cloud campaign JSON has arbitrary nested/top-level Fabric passthrough data.
  It must contain neither transient browser object URLs nor untracked local
  assets that cannot be restored.
- The paid Supabase project is shared with other games. The unapplied migration
  may add only its exact named objects.

## Claims

1. Production shell, game, and Creator surfaces are initially hidden/inert and
   mandatory account access unlocks them only after account-scoped storage and
   cloud recovery complete.
2. Session, progress, and asset clients share one in-memory canonical username
   binding. Authenticated session/login/signup activates it; unauthenticated
   session and confirmed logout deactivate it.
3. Progress list/load/save, asset GET/PUT, and logout require the bound
   `x-admarket-account`; valid unbound operations fail before fetch.
4. Netlify resolves cookie identity and exact-compares that header before any
   progress RPC, asset/blob service, or logout mutation. A stale/missing header
   yields only 409 `ACCOUNT_IDENTITY_CHANGED`, preserves rotated current-account
   cookies, and cannot mutate/logout the newer account.
5. Browser identity drift maps to `AUTHENTICATION_REQUIRED` without masking the
   exact `REVISION_CONFLICT` CAS response.
6. Login/signup/logout publish only a random cross-tab storage nonce. Peers lock,
   stop cloud state, isolate local work and reload; session observation does not
   publish. Header binding remains the hard boundary if the event lags/fails.
7. Sign-out/expiry lock immediately, isolation precedes reload, failed logout
   remains locked, and stale logout cannot terminate another identity.
8. Drafts and CAS metadata use preserved SHA-256 account namespaces. Late cloud
   acknowledgements are monotonic and original-scope-only, with no next-account
   UI emission.
9. Browser and Netlify enforce the full bounded canonical offline campaign,
   matching document/team identity and no room binding. SQL intentionally repeats
   only selected top-level constraints as server-role-only defense in depth; it
   is not claimed to duplicate the full CampaignDocument schema.
10. Before Zod refinement, the server iteratively scans the complete raw Fabric
    state; afterward it scans the complete parsed state. Blob-protocol case/C0
    variants anywhere—including top-level passthrough—are rejected. Cycles,
    aliases, depth >100 and >100,000 nodes fail closed. Semantic collection is
    also iterative, bounded, order-preserving and cycle/alias-rejecting.
11. Durable local assets form a bijection: every local descriptor has exactly one
    matching cloud descriptor and exact semantic Fabric `local-blob:` source;
    every `local-blob:` `src` anywhere in Fabric has that descriptor pair. An
    untracked/local-only source cannot be saved. HTTPS/data sources remain valid.
12. Private assets are authenticated, account-HMAC-isolated, immutable,
    signature/MIME/hash checked, quota-bound and non-SVG. Recovery verifies bytes
    and atomically imports document, blobs, checkpoint, run and operation.
13. Browser/Supabase transports reject redirects, bound response bodies,
    propagate expiry and surface only constant public errors.
14. The migration collision-preflights its role/schema/table/RPC; creates a
    dedicated NOLOGIN/NOBYPASSRLS owner, private schema/table/index and exact
    RPC; uses empty search path; grants only service-role execution; revokes
    direct access; and fails closed rather than replacing objects.
15. SQL list/load/save are user-scoped and CAS-atomic; discovery is metadata-only
    and capped at 16; conflicts expose revision metadata only.
16. The exact SQL hash passed executable PGlite role/catalog/ACL/RLS/CRUD/CAS/
    cap/account-isolation tests and preserved a Signal Lost sentinel. A read-only
    live baseline records the existing Signal Lost tables, RPC and Edge Function.
17. The live read-only collision query recorded zero Advertising Market names.
    Hosted synthetic-email behavior, final environment values, deployed cookies,
    and deployed two-account behavior remain explicit post-migration/deployment
    holds—not claims of completion.

## Evidence paths

- `godot/web/godot_shell.html`
- `scripts/build-web.test.mjs`
- `scripts/verify-web-export.mjs`
- `web/src/main.ts`, `web/src/main.test.ts`
- all sources/tests under `web/src/account/`
- `web/src/persistence/account-scoped-draft-store.ts`
- `web/src/persistence/draft-store.ts`
- `web/src/domain/campaign-document.ts`
- `web/src/domain/campaign-semantic-objects.ts` and test
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

- Strict `tsc --noEmit`: exit 0.
- Focused domain/account/Netlify/main integration: 15 files, 215 tests passed.
- Full serial Vitest after all current changes: 116 files, 1,794 tests passed in
  118.01 seconds.
- Build contracts: 60/60 passed.
- Godot 4.7.1 game/Creator/Market suite: exit 0, explicit pass; only the expected
  malformed-base64 negative diagnostic and known shutdown leak warnings.
- Unapplied SQL SHA-256:
  `e61886e7feebc42e0710ded65e3d473ce5ba85a5f031a4ed514fa41da7b91829`.
- Live read-only collision preflight: zero rows; no migration/deployment write.
