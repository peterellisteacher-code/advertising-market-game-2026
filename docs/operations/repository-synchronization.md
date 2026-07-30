# Canonical public repository

The Advertising Market Game has one supported public GitHub location:

- `peterellisteacher-code/advertising-market-game-2026`

Do not create or maintain a second public mirror. The canonical repository is
the sole source for public code, issues and release automation.

## Publish the release commit

Configure the canonical remote:

```powershell
git remote add public https://github.com/peterellisteacher-code/advertising-market-game-2026.git
```

After the complete release candidate has passed its required checks, push the
release commit:

```powershell
git push public HEAD:main
```

## Mandatory verification

From the exact release checkout, run:

```powershell
corepack pnpm run verify:repo-sync --expect-local-head
```

The command reads the canonical public `main` ref and fails unless it equals
the checked-out commit. A release or source publication is not complete until
this command prints `CANONICAL_PUBLIC_REPOSITORY_VERIFIED`.

If the push fails, leave publication marked incomplete, repair the canonical
remote and rerun the verification. History replacement requires explicit
owner approval and a complete verified private archive before the public ref
is changed.
