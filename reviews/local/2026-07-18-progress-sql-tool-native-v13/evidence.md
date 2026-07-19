# Advertising-game progress migration: controlled-apply evidence

Date: 2026-07-18

## Review boundary

Assess whether the exact SQL transaction body is safe for **one controlled Supabase `apply_migration` invocation followed immediately by catalog verification**. This is not a claim that Netlify deployment or student access is complete. The staged same-account concurrent 16th/17th save race remains a mandatory deployment hold before student access.

## Exact artifacts

| Artifact | SHA-256 | Lines | Bytes |
| --- | --- | ---: | ---: |
| `docs/operations/advertising-game-account-progress.sql` | `427ca4dfaeaa730c1e6ed5864dbfeac6fee8ec377215781c4437924f499b8731` | 367 | 12,160 |
| `docs/operations/advertising-game-account-progress.md` | `f58e92def7f6c16b23ca4c105eca4be07f70cc898e20946393d451cf8198d9e8` | 408 | 20,530 |
| `reviews/local/2026-07-17-progress-sql-pglite/validate-progress-sql-rerun.mjs` | `ee6163b9add7a8a504b9ada4ba306db253e86a0d59131161ee60b8a7e532e10b` | 601 | 28,340 |

Absolute project root:

`C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\Codex Advertising Market Game`

## Local executable evidence

Fresh command:

`C:\Users\Peter Ellis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe reviews\local\2026-07-17-progress-sql-pglite\validate-progress-sql-rerun.mjs`

Fresh result: exit code 0, `status: PASS`, PGlite `0.3.16`.

The harness verified:

- no embedded top-level transaction-control statement, including lexical fixtures for comments, ordinary strings, E strings, quoted identifiers, and dollar-quoted bodies;
- a complete harness-owned transaction rollback and an unchanged unrelated Signal Lost sentinel;
- a clean commit followed by rejected second application;
- exact role flags and no memberships;
- exact schema/table/function ownership, exact seven-argument RPC signature, exact index definition, RLS and direct-grant posture, public `CREATE` denial, and exact empty function `search_path`;
- owner scope including the target table, primary-key index, ordered index, and PostgreSQL-dependent TOAST table/index, with no unrelated role-owned schema/relation/function;
- compiled RPC structure contains exactly one per-account `pg_advisory_xact_lock`, placed before the save branch's revision lookup, document count, insert, and update;
- request/document rejection branches, list/load/save/CAS, account isolation, 16-document cap, deterministic tied-timestamp list ordering, metadata-only discovery, direct-access denial, and unchanged Signal Lost sentinel.

The harness is explicitly single-connection. It does not claim to simulate inter-session scheduling. The runbook now requires a live, independently concurrent two-request boundary test after staged deployment and before student access: preload 15 documents, race different 16th/17th IDs, require exactly one success, one `DOCUMENT_LIMIT_REACHED`, and exactly 16 discovered documents.

## Fresh live read-only state

Project: `jftpeajvpqmxabuscoml`.

A fresh collision query returned zero rows for:

- role `advertising_game_progress_owner_20260718`;
- schema/table namespace `advertising_game` / `progress`;
- public function name `advertising_game_progress_rpc`.

Fresh Signal Lost baseline:

- `public.signal_lost_progress_rpc(text,text,jsonb,bigint,text)`: owner `postgres`, `SECURITY DEFINER=true`, ACL `{postgres=X/postgres,service_role=X/postgres}`;
- `signal_lost.progress`: owner `postgres`, RLS true, ACL `{postgres=arwdDxtm/postgres}`;
- `signal_lost.settings`: owner `postgres`, RLS true, ACL `{postgres=arwdDxtm/postgres}`.

The apply must stop after one tool invocation. On tool timeout or error, do not retry automatically; query catalog and migration-ledger state before any further decision. Post-apply verification must recheck exact advertising-game objects and the Signal Lost baseline above.
