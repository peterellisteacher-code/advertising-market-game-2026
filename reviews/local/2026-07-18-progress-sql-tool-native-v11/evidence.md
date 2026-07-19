# Advertising Game progress migration: final isolated review evidence

## Neutral task

Independently try to refute whether the exact migration body and validation
harness are ready for one controlled Supabase `apply_migration` invocation on
the existing shared project `jftpeajvpqmxabuscoml`. Inspect all three complete
artifacts. For each numbered requirement, report CONFIRMED, REFUTED, or
UNVERIFIABLE with exact file-and-line evidence. End with exactly `SURVIVES` only
if no material requirement is refuted or unverifiable; otherwise end with
exactly `DOES_NOT_SURVIVE`.

Do not edit files or call Supabase. This is an isolated, unguided, read-only
review. This evidence contains no prior-review result or preferred verdict.

## Exact immutable artifacts

1. `C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game\docs\operations\advertising-game-account-progress.sql`
   - 367 lines
   - SHA-256 `427ca4dfaeaa730c1e6ed5864dbfeac6fee8ec377215781c4437924f499b8731`
2. `C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game\docs\operations\advertising-game-account-progress.md`
   - 355 lines
   - SHA-256 `14063f26483975b93457976a95ce63f2c9510b7cada6e620e4579765af090657`
3. `C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game\reviews\local\2026-07-17-progress-sql-pglite\validate-progress-sql-rerun.mjs`
   - 420 lines
   - SHA-256 `8478fa3d4f8bad4769ef6bc5b2285bccd68d6d0131e1719a47df9a95896b4f69`

If any hash differs, stop and return UNVERIFIABLE / DOES_NOT_SURVIVE.

## Requirements to attack

1. The SQL is a transaction body suitable for Supabase `apply_migration` and
   contains no top-level transaction-control statement; the caller owns the
   outer transaction and migration-ledger write.
2. The harness lexes top-level SQL without mistaking quoted strings,
   identifiers, comments, or dollar-quoted PL/pgSQL bodies for statements. It
   rejects ordinary and variant transaction-control forms, including controls
   following another statement, while its safe/unsafe fixtures exercise those
   distinctions.
3. Before the successful run, the harness executes the unchanged complete body
   inside a harness-owned transaction, deliberately fails, rolls back, and
   proves the dedicated role, schema, and RPC are absent while the unrelated
   sentinel is unchanged.
4. The harness then applies the unchanged body in a clean committed transaction,
   attempts a second application, proves the collision preflight rejects it,
   rolls back that failed transaction, and proves the originally committed
   targets and unrelated sentinel remain intact.
5. The migration fails closed on role/schema/relation/same-named-function
   collisions and creates only its dedicated owner role, private schema/table,
   table index, and exact seven-argument public RPC.
6. The dedicated role ends NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB,
   NOCREATEROLE, NOREPLICATION, NOBYPASSRLS, without residual memberships; the
   schema, table, and function end owned by it.
7. RLS is enabled with no direct policies or direct API-role data path. The
   SECURITY DEFINER RPC has exactly an empty search path—not merely a setting
   containing the words `search_path`—and only `service_role` among the API
   roles can execute it.
8. Temporary membership and CREATE grants are completely revoked before the
   body ends.
9. The RPC and harness prove metadata-only list/load/save behavior, exact
   identity validation, account isolation, CAS conflict handling, the
   16-document cap, bounded deterministic list order, and direct-access denial.
10. The migration neither references nor changes Signal Lost or unrelated
    application objects. The sentinel remains unchanged after rollback, commit,
    and rejected reapplication.
11. The runbook instructs an operator to run a fresh live collision preflight,
    pass the exact reviewed body once to `apply_migration` without adding a
    transaction wrapper, and complete strict post-application checks before
    deployment.
12. No material defect in the SQL, harness, or documented procedure makes one
    controlled live invocation unsafe or materially under-verified.

## Fresh executable evidence

From the game root, Node.js 24.14.0 ran:

```text
node reviews/local/2026-07-17-progress-sql-pglite/validate-progress-sql-rerun.mjs
```

Result on 2026-07-18: exit code 0; `status: PASS`; PGlite 0.3.16; migration
SHA-256 `427ca4dfaeaa730c1e6ed5864dbfeac6fee8ec377215781c4437924f499b8731`.
The output recorded successful lexical fixtures, deliberate full-body rollback,
transaction-body execution with no embedded control, rejected second
application, restrictive role/catalog/ACL/RLS/function configuration, exact
empty-search-path representation, list/load/save/CAS and cap behavior, account
isolation, direct-access denials, and an unchanged unrelated sentinel.

## Neutral live operational context

A prior invocation with an older body terminated. PostgreSQL logs showed the
migration workflow had already issued `begin` before that older body's own
`begin`; PostgreSQL warned that a transaction was already in progress.
Read-only follow-up checks found zero Advertising Game targets, no matching
migration-ledger row, and no remaining migration session. No retry has occurred.
The current exact SQL omits body-owned transaction control. A fresh read-only
collision query is still required immediately before any controlled invocation.
