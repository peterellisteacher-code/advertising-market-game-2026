# Repository maintenance rules

## Public mirror synchronization

This project is published in two public GitHub repositories:

- `peterellisteacher-code/advertising-market-game-2026`
- `peterellisteacher-code/advertising-market-game`

Their `main` branches must always point to an identical commit SHA. Make one
commit in one checkout and push that same commit object to both repositories.
Do not maintain separate fixes, merges or release commits in the two mirrors.

Before reporting any source publication or release as complete, run:

```powershell
corepack pnpm run verify:repo-sync --expect-local-head
```

If the command fails, publication is incomplete. Stop and reconcile the refs;
do not conceal divergence with separate cherry-picks or equivalent-looking
trees. A public history rewrite additionally requires the repository owner's
explicit approval and a verified private recovery archive.
