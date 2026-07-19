# Advertising Game progress migration: isolated production-readiness gate

## Neutral task

Try to refute whether the exact migration body, runbook, and executable harness
are ready for one controlled Supabase `apply_migration` invocation on the shared
project `jftpeajvpqmxabuscoml`. Inspect the complete artifacts and independently
rerun the harness. Report each numbered claim as CONFIRMED, REFUTED, or
UNVERIFIABLE with exact file-and-line evidence. End with exactly `SURVIVES` only
if no material claim is refuted or unverifiable; otherwise end with exactly
`DOES_NOT_SURVIVE`.

Do not edit files, call Supabase, seek other reviews, or broaden scope. This is
an isolated, unguided, read-only adversarial gate and contains no earlier review
answer or preferred verdict.

## Immutable artifacts

1. `C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game\docs\operations\advertising-game-account-progress.sql`
   - 367 lines
   - SHA-256 `427ca4dfaeaa730c1e6ed5864dbfeac6fee8ec377215781c4437924f499b8731`
2. `C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game\docs\operations\advertising-game-account-progress.md`
   - 374 lines
   - SHA-256 `0c68f40de7a0ed9d24714fa8a963d7e0ddb01306c23d044494685aaf34b346d5`
3. `C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game\reviews\local\2026-07-17-progress-sql-pglite\validate-progress-sql-rerun.mjs`
   - 523 lines
   - SHA-256 `d3087ba05525ef401eb854ba11cfb5b59db0e995e70696c1d581cc1b6b5977b2`

If any hash or line count differs, return UNVERIFIABLE / DOES_NOT_SURVIVE.

## Claims to attack

1. The SQL is transaction-body input for Supabase `apply_migration`, contains no
   top-level transaction-control statement, and relies on the caller-owned
   transaction and migration-ledger write.
2. The harness's lexical pass distinguishes top-level SQL from line/nested block
   comments, standard and PostgreSQL E escape strings, quoted identifiers, and
   tagged or untagged dollar-quoted bodies. Its fixtures prove safe embedded
   words remain allowed while ordinary and variant controls—including ABORT,
   controls after another statement, and a control exposed after a standard
   backslash string—are rejected.
3. The harness executes the unchanged body inside its own transaction, forces a
   post-body failure, rolls back, and proves every target absent and the
   unrelated sentinel unchanged. It then commits a clean run, rejects a second
   application through collision preflight, rolls back, and proves the original
   targets and sentinel remain intact.
4. Collision handling covers the dedicated role, schema, target relation, and
   every same-named RPC overload. Creation is confined to the dedicated role,
   private schema/table, required index, and exact seven-argument RPC.
5. The dedicated role has all restrictive flags, no residual membership, and
   owns only the intended schema/table/RPC. Temporary membership and CREATE
   grants are revoked. It has no effective CREATE privilege on `public`.
6. The table has RLS with zero policies and no direct API-role path. The SECURITY
   DEFINER RPC has exactly one setting—an empty search path—and only
   `service_role` among the API roles can execute it.
7. The exact index exists once with definition
   `CREATE INDEX advertising_game_progress_updated_at_idx ON advertising_game.progress USING btree (user_id, updated_at DESC)`.
8. Executable tests cover valid metadata-only list/load/save/CAS behavior plus
   every request/document validation predicate: user, operation, envelope
   schema/version, list shape, document ID, expected revision, JSON object,
   schemaVersion, documentId type/match, mode type/value, teamId type/presence,
   room binding, document revision type/range/integer bound, and byte size.
9. Account isolation, atomic 16-document cap, direct-access denial, and
   deterministic ASCII document-ID ordering under deliberately tied timestamps
   are implemented and independently asserted rather than restating the same
   production ORDER BY as an oracle.
10. The SQL does not reference or change Signal Lost or unrelated objects; the
    sentinel survives forced rollback, committed apply, rejected reapply, and
    behavioral testing.
11. The runbook requires fresh collision preflight, exact unwrapped
    `apply_migration` input, and strict post-application holds including role
    flags/membership/ownership scope, no public CREATE, exact index, RLS/policies,
    direct ACL denial, exact empty search path, exact signature/overload count,
    and service-role-only RPC execution before deployment.
12. No material SQL, harness, or procedure defect makes one controlled live
    invocation unsafe or materially under-verified.

## Fresh executable evidence

Node.js 24.14.0 ran from the game root:

```text
node reviews/local/2026-07-17-progress-sql-pglite/validate-progress-sql-rerun.mjs
```

Fresh result on 2026-07-18: exit code 0, status PASS, PGlite 0.3.16, exact
migration hash `427ca4dfaeaa730c1e6ed5864dbfeac6fee8ec377215781c4437924f499b8731`.
The emitted evidence records transaction lexical fixtures, forced rollback,
clean commit, collision rejection, exact role/catalog/index/RLS/ACL/function
posture, complete negative validation branches, valid list/load/save/CAS,
account isolation, tied-timestamp ordering, cap enforcement, direct-access
denials, and an unchanged unrelated sentinel.

## Neutral live context

An older invocation terminated after the Supabase migration workflow opened a
transaction around a body that also opened one. PostgreSQL logged that a
transaction was already in progress. Read-only follow-up found no Advertising
Game targets, no matching migration-ledger row, and no remaining migration
session. No retry has occurred. The exact current body removes body-owned
transaction control. A fresh live collision query remains mandatory immediately
before any invocation.
