# Repository maintenance rules

## Canonical public repository

This project has one authoritative public GitHub repository:

- `peterellisteacher-code/advertising-market-game-2026`

Do not create or maintain a second public mirror. All source publication,
release automation and issue tracking must use the canonical repository.

Before reporting any source publication or release as complete, run:

```powershell
corepack pnpm run verify:repo-sync --expect-local-head
```

If the command fails, publication is incomplete. Stop and reconcile the refs;
do not publish from an unverified checkout. A public history rewrite
additionally requires the repository owner's explicit approval and a verified
private recovery archive.
