# PGlite SQL validation rerun — 2026-07-18

The earlier failed-run harness and result remain unchanged. This rerun uses the
separate `validate-progress-sql-rerun.mjs` copy, whose only behavioural change
is replacing the obsolete expected `pg_catalog.coalesce` failure with positive
`list` assertions.

Command (working directory: `Codex Advertising Market Game`):

```powershell
node --check reviews/local/2026-07-17-progress-sql-pglite/validate-progress-sql-rerun.mjs
node reviews/local/2026-07-17-progress-sql-pglite/validate-progress-sql-rerun.mjs
```

Result: `PASS` on in-memory PGlite 0.3.16. The exact migration read and
executed had SHA-256
`e61886e7feebc42e0710ded65e3d473ce5ba85a5f031a4ed514fa41da7b91829`.

The bootstrap had the three Supabase-like API roles, two `auth.users`, and the
unrelated `public.signal_lost` sentinel. Role flags/membership, owners/exact
signature, RLS/no policies, schema/table revocations, and the sole
`service_role` RPC grant passed. `list` returned an empty list initially and
then metadata-only records; its final 16 records matched `updated_at DESC,
document_id COLLATE "C" ASC`, contained no document body, and stayed bounded
at 16. Load, save, CAS revision increment/conflict, both missing and empty
`teamId` rejection, account isolation, 17th-document rejection, anon and
authenticated RPC denial, direct table denial for `service_role`, and sentinel
preservation all passed.

This is local execution evidence only; it neither applies nor contacts hosted
Supabase or any live service.
