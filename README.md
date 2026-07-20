# Advertising Market Game

A fun-first Year 10 English advertising game for pairs sharing a school MacBook in Chrome. Teams create and price products, build persuasive campaigns, and then compete in a live classroom market. The project is a Godot 4 web game with a TypeScript creator studio, a large offline asset catalogue, Netlify Functions, and isolated cloud progress storage.

## Repository and deployment model

GitHub is the source of truth for the complete editable project. `build/web/` is generated and intentionally gitignored.

The `Build & Validate Web` GitHub Actions workflow:

1. runs the Node, TypeScript, and web-build checks;
2. runs the Godot test runner inside `barichello/godot-ci`;
3. exports Godot Web in Linux CI;
4. assembles and verifies the complete static web build; and
5. uploads downloadable build artifacts.

It **never deploys to Netlify**. A Git-triggered static deployment could omit `netlify/deploy-functions` and break `/api/account/*`. Netlify deployment is therefore a deliberate CLI operation after the artifact or local build has been verified.

Required GitHub Actions repository variables:

- `GODOT_VERSION=4.7.1`
- `EXPORT_NAME=advertising-market-game`

## Local commands

Install the pinned dependencies:

```powershell
corepack enable
pnpm install --frozen-lockfile
```

Run the non-native verification surfaces:

```powershell
pnpm typecheck
pnpm test
pnpm test:build-web
```

Build the complete web output when a suitable Godot 4.7.1 runtime is available:

```powershell
pnpm build
```

On Peter's current OneDrive working copy, native Godot launches are quarantined because they have produced Windows access violations. Use the CI artifact for a fresh export, or move a working copy off OneDrive before native Godot work.

## Manual Netlify deployment

After GitHub Actions produces a verified complete artifact, download it to a fresh directory and create a draft deploy from the repository root:

```powershell
pnpm deploy:draft -- --artifact C:\path\to\downloaded-artifact
```

After hosted verification, publish the same downloaded artifact deliberately:

```powershell
pnpm deploy:production -- --artifact C:\path\to\downloaded-artifact
```

Both commands require an explicit artifact path, verify it, rebuild the self-contained Function bundles, and preserve its own hosted headers. Never configure GitHub or Netlify to publish `build/web/` automatically.

Teacher access documents and classroom credentials are deliberately excluded from Git history.
