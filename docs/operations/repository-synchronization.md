# Public repository synchronization

The Advertising Market Game has two supported public GitHub locations:

- `peterellisteacher-code/advertising-market-game-2026`
- `peterellisteacher-code/advertising-market-game`

Both `main` branches must always resolve to an identical commit SHA. They are
mirrors of one product source, not independent development branches.

## Publish one commit to both repositories

Configure two remotes once:

```powershell
git remote add public-2026 https://github.com/peterellisteacher-code/advertising-market-game-2026.git
git remote add public-short https://github.com/peterellisteacher-code/advertising-market-game.git
```

After the complete release candidate has passed its required checks, push the
same local commit object to both:

```powershell
git push public-2026 HEAD:main
git push public-short HEAD:main
```

Do not make a second commit, merge or cherry-pick between those pushes.

## Mandatory verification

From the exact release checkout, run:

```powershell
corepack pnpm run verify:repo-sync --expect-local-head
```

The command reads both public `main` refs and fails unless they equal each
other and the checked-out commit. A release or source publication is not
complete until this command prints `PUBLIC_REPOSITORIES_SYNCHRONIZED`.

If either push fails, leave publication marked incomplete, repair the remote
without creating divergent history, and rerun the verification. History
replacement requires explicit owner approval and a complete verified private
archive before either public ref is changed.
