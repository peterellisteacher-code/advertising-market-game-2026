# Local PGlite validation: account progress SQL

Run from `Codex Advertising Market Game`:

```powershell
node reviews/local/2026-07-17-progress-sql-pglite/validate-progress-sql.mjs
```

The harness reads and executes the migration file directly, records its SHA-256
in its JSON output, and uses an in-memory PGlite 0.3.16 instance. It creates
only disposable Supabase-like roles/auth table plus an unrelated sentinel; it
never opens a network connection or a hosted database.
