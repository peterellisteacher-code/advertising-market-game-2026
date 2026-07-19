# Live shared-project preflight before Advertising Market migration

Target: existing paid Supabase project `jftpeajvpqmxabuscoml`.

This was a read-only catalog/API inspection. No SQL DDL/DML, migration,
configuration change, project/branch creation, or function deployment occurred.

## Advertising Market collision query

The exact collision query from
`docs/operations/advertising-game-account-progress.md` returned `[]` (zero
rows). At inspection time there was no role
`advertising_game_progress_owner_20260718`, schema `advertising_game`, relation
`advertising_game.progress`, or public function named
`advertising_game_progress_rpc`.

## Signal Lost snapshot

The existing named objects were present before any Advertising Market migration:

- `public.signal_lost_progress_rpc`: function, owner `postgres`, security
  definer enabled, ACL `{postgres=X/postgres,service_role=X/postgres}`.
- `signal_lost.progress`: ordinary table, owner `postgres`, RLS enabled, ACL
  `{postgres=arwdDxtm/postgres}`.
- `signal_lost.settings`: ordinary table, owner `postgres`, RLS enabled, ACL
  `{postgres=arwdDxtm/postgres}`.
- Edge Function `signal-lost-progress`: ACTIVE, version 1, ID
  `70230dc0-a357-43d8-8962-a908b7da564e`, `verify_jwt=false`, deployment hash
  `8bbe75f7f458bd205e8e395654b65bb6b8f7e9b7b327c3cf2e4c0e3ac19e58d1`.

These exact values are the post-migration no-collision comparison baseline.
