# Advertising Game progress migration: fresh adversarial review evidence

## Neutral review task

Independently try to refute whether the exact migration body and its validation
harness are ready for one controlled Supabase `apply_migration` invocation on
the existing shared project `jftpeajvpqmxabuscoml`. Inspect the complete files,
not excerpts. Report each material claim as CONFIRMED, REFUTED, or
UNVERIFIABLE with exact file-and-line evidence. End with exactly `SURVIVES` only
if no material claim is refuted or unverifiable; otherwise end with exactly
`DOES_NOT_SURVIVE`.

Do not edit files. Do not run or call Supabase. This is an isolated, unguided,
read-only review. There is no prior-review output in this evidence.

## Exact immutable artifacts

1. `C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game\docs\operations\advertising-game-account-progress.sql`
   - 367 lines
   - SHA-256 `427ca4dfaeaa730c1e6ed5864dbfeac6fee8ec377215781c4437924f499b8731`
2. `C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game\docs\operations\advertising-game-account-progress.md`
   - 355 lines
   - SHA-256 `14063f26483975b93457976a95ce63f2c9510b7cada6e620e4579765af090657`
3. `C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game\reviews\local\2026-07-17-progress-sql-pglite\validate-progress-sql-rerun.mjs`
   - 260 lines
   - SHA-256 `04a1440623d47b3fc67ac0e7db310d71420a9b6be7995cc58d06de6764f4f3fe`

If any hash differs, stop and return UNVERIFIABLE / DOES_NOT_SURVIVE.

## Required properties to test adversarially

1. The SQL is a transaction body suitable for Supabase `apply_migration` and
   contains no executable `BEGIN`, `COMMIT`, `ROLLBACK`, or
   `START TRANSACTION` statement. Atomicity comes from the caller-owned outer
   transaction.
2. The harness rejects embedded transaction-control statements, executes the
   unchanged body within its own transaction, deliberately fails after the
   complete body, rolls back, and proves that all target objects are absent and
   the unrelated Signal Lost sentinel is unchanged before a clean committed run.
3. The migration fails closed on collisions and creates only the dedicated
   `advertising_game_progress_owner_20260718` role, private
   `advertising_game.progress` storage, and the exact seven-argument
   `public.advertising_game_progress_rpc` function.
4. The owner role is NOLOGIN, NOINHERIT, NOSUPERUSER, NOCREATEDB,
   NOCREATEROLE, NOREPLICATION, and NOBYPASSRLS, with no residual memberships.
   Schema, table, and function ownership end on that role.
5. The table has RLS enabled, no policies, and no direct data path for `anon`,
   `authenticated`, or `service_role`. The SECURITY DEFINER RPC has an empty
   search path and EXECUTE is granted only to `service_role` among those roles.
6. The RPC's list/load/save behavior, document identity checks, account
   isolation, compare-and-swap conflict response, 16-document cap, bounded
   metadata-only list, and deterministic ordering match the runbook.
7. Temporary role membership and CREATE grants needed for object creation and
   ownership transfers are fully revoked before the transaction body ends.
8. The migration does not reference, replace, grant on, revoke from, alter, or
   drop the existing Signal Lost objects or other unrelated application objects.
9. The runbook instructs the operator to pass the exact reviewed body to
   `apply_migration` without adding transaction wrappers, to run a fresh
   collision check, and to perform post-application checks before deployment.
10. No defect in the SQL, harness, or documented procedure makes a single
    controlled live retry unsafe or materially under-verified.

## Executable local evidence

Command (run from the game root with Node.js 24.14.0):

```text
node reviews/local/2026-07-17-progress-sql-pglite/validate-progress-sql-rerun.mjs
```

Fresh result on 2026-07-18: exit code 0, status PASS, PGlite 0.3.16, migration
SHA-256 `427ca4dfaeaa730c1e6ed5864dbfeac6fee8ec377215781c4437924f499b8731`.
The emitted checks reported:

- deliberate division-by-zero after the complete body rolled back every target
  object and left the unrelated sentinel unchanged;
- no embedded transaction control;
- exact owner flags, no memberships, and exact object owners/signature;
- RLS enabled, zero policies, no direct schema/table access for the three API
  roles, SECURITY DEFINER with empty search path, and only `service_role`
  EXECUTE;
- list/load/save/CAS, identity rejection, account isolation, 16-document cap,
  bounded metadata-only ordering, and direct-access denials all passed;
- `public.signal_lost` remained exactly `{id: 7, payload:
  "must-remain-untouched"}`.

## Neutral live operational context

A prior `apply_migration` request reached PostgreSQL but terminated. Server logs
showed the migration workflow had already issued `begin` before the older SQL
body's own `begin`; PostgreSQL warned that a transaction was already in
progress. Read-only follow-up checks found zero Advertising Game target objects,
no Advertising Game migration-ledger row, and no remaining migration session.
No retry has occurred. The current artifacts remove the body-owned transaction
control while preserving caller-owned atomicity and adding executable rollback
proof. The live collision check must be repeated immediately before any retry.
