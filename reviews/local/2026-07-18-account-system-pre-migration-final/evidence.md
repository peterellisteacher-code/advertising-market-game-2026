# Account/cloud system pre-migration review evidence

Review the actual current filesystem implementation. This is a fresh, isolated,
unguided adversarial review. Do not edit files or use prior reviewer output.

## Decision

Is the current account, account-scoped local persistence, private cloud progress,
private cloud asset, and proposed Supabase migration system safe and coherent
enough to begin the documented live collision preflight and migration process?

## Requirements and acceptance constraints

- The production game remains hidden and inert until a valid account session and
  account-scoped local/cloud recovery activation complete.
- Classroom pairs create a bounded username and password. Server-managed session
  cookies are HttpOnly, Secure in production, SameSite=Strict, and never exposed
  to browser JavaScript.
- Explicit logout and session expiry lock both game surfaces before identity
  changes. A failed server logout must not reload or unlock another identity.
- IndexedDB drafts and local compare-and-swap metadata are isolated by an opaque,
  SHA-256-derived account namespace. Logout must not erase an account's data or
  let another account reuse it.
- A cloud save that is acknowledged after account lock/switch may advance only
  its captured original-account revision metadata; it must not emit state into
  the next account or lower an existing revision.
- Cloud progress accepts only canonical offline CampaignDocumentV1 snapshots
  with a matching document ID, nonempty team ID, no room binding, no transient
  Fabric `blob:` source, and exact durable asset descriptors. Browser, Netlify,
  and SQL boundaries fail closed.
- Browser/Netlify transports reject redirects, bound streamed response bodies,
  propagate authentication expiry, and do not leak tokens, secrets, synthetic
  email addresses, Supabase user IDs, or private documents in errors.
- Private assets are authenticated, account-namespaced, immutable by digest,
  MIME/signature verified, quota-bound, and never SVG. Recovery verifies bytes
  and imports document/assets/checkpoint/run/operation atomically.
- The shared paid Supabase project is `jftpeajvpqmxabuscoml`. The migration must
  create only its uniquely named dedicated NOLOGIN/NOBYPASSRLS owner role,
  private schema/table, index, and exact public RPC. It must fail on every
  pre-existing named role/schema/relation/function overload rather than reuse or
  replace it.
- The SECURITY DEFINER RPC has an empty search path, is executable only by
  `service_role`, and operates through the dedicated table owner. Direct schema
  and table access remains revoked, RLS remains enabled, and the dedicated role
  has no login, elevated capability, or membership after commit.
- List/load/save remain user-ID scoped. Save uses atomic per-account CAS and a
  16-document cap. A stale write returns revision metadata only. Signal Lost
  objects and all unrelated project objects remain untouched.
- No migration or deployment has yet been performed. Live object state, hosted
  Auth behavior, environment configuration, and live two-account behavior must
  be classified as unverified rather than inferred.

## Primary implementation to inspect

- `godot/web/godot_shell.html`
- `web/src/main.ts`
- `web/src/account/account-gate.ts`
- `web/src/account/account-client.ts`
- `web/src/account/account-storage-namespace.ts`
- `web/src/account/cloud-progress-sync.ts`
- `web/src/account/cloud-progress-recovery.ts`
- `web/src/account/cloud-asset-adapter.ts`
- `web/src/account/account-asset-client.ts`
- `web/src/persistence/account-scoped-draft-store.ts`
- `web/src/persistence/draft-store.ts`
- `netlify/functions/account-session.mts`
- `netlify/functions/account-progress.mjs`
- `netlify/functions/account-assets.mts`
- `netlify/functions/lib/account-backend.ts`
- `netlify/functions/lib/account-progress-document.ts`
- `netlify/functions/lib/account-assets.ts`
- `netlify/functions/lib/account-primitives.ts`
- `docs/operations/advertising-game-account-progress.sql`
- `docs/operations/advertising-game-account-progress.md`
- `reviews/local/2026-07-17-progress-sql-pglite/validate-progress-sql-rerun.mjs`
- `reviews/local/2026-07-17-progress-sql-pglite/result-2026-07-18-rerun.md`

Inspect their directly corresponding tests and any referenced production modules
needed to validate a claim. Treat comments and test assertions as claims, not as
proof, unless implementation and execution evidence agree.

## Fresh verification evidence

- Strict TypeScript `tsc --noEmit`: exit 0.
- Full Vitest with `--maxWorkers=1`: 115 files, 1,778 tests passed, 0 failed.
- Build-contract Node suite: 60 passed, 0 failed.
- Godot 4.7.1 headless game/Creator/Market bridge suite: explicit pass, exit 0.
  Its malformed-base64 diagnostic is an intentional negative validation case;
  shutdown reports seven ObjectDB instances and three resources still in use.
- The repaired SQL migration SHA-256 is
  `e61886e7feebc42e0710ded65e3d473ce5ba85a5f031a4ed514fa41da7b91829`.
  The fresh PGlite rerun positively exercised migration execution, role/catalog
  invariants, grants/RLS, list/load/save, ordering/bounds, CAS/conflict, team ID,
  per-account isolation, 16-document cap, RPC role isolation, and an unrelated
  Signal Lost sentinel.

## Required review output

Attempt to refute each materially relevant invariant using concrete filesystem
evidence or a reproducible counterexample. Report findings by severity with full
Windows paths and line numbers, then confirmed invariants, live-only unknowns,
and one terminal verdict: `SURVIVES` or `DOES NOT SURVIVE`.
