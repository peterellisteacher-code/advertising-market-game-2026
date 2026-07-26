# Advertising Market Game

Advertising Market Game is a classroom game for Year 10 English. Students work
in pairs. First they invent a product, then they create an advertisement for
it, and finally they judge how products perform in a classroom market.

The project combines:

- a Godot 4 market game;
- a TypeScript and Fabric.js product-and-advertisement studio;
- an offline catalogue of editable product parts and visual assets;
- optional Netlify Functions and Supabase-backed account progress; and
- a deterministic build pipeline for a self-contained web artifact.

No classroom passwords, student records, production secrets or deployment
credentials are stored in this repository.

## Project structure

| Path | Purpose |
| --- | --- |
| `godot/` | Godot game project, scenes, scripts and tests |
| `web/` | Browser-based creator studio and account client |
| `catalog/` | Offline classroom asset catalogue |
| `netlify/` | Source for the account and progress Functions |
| `supabase/` | Database migrations and server-side policies |
| `pipeline/` | Catalogue validation and processing tools |
| `scripts/` | Build, verification and deployment scripts |

## Requirements

- Node.js 22.12 or later
- pnpm 11.7
- Python 3.12 for catalogue-pipeline tests
- Godot 4.7.1 with web export templates for a complete game export

## Install and verify

```powershell
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm test:build-web
```

Catalogue-pipeline tests can be run separately:

```powershell
python -m pip install --requirement pipeline/requirements.txt
python -m pip install --no-deps --no-build-isolation --editable pipeline
python -m pytest pipeline/tests -q
```

## Build the complete web game

With Godot 4.7.1 and its web export templates available:

```powershell
pnpm build
```

The generated output is written to `build/web/` and is intentionally excluded
from Git. The build verifies the Godot export, creator studio, offline asset
catalogue, service worker and release manifest as one artifact.

## GitHub Actions

The `Build & Validate Web` workflow validates the source, exports Godot in
Linux CI, assembles the complete web game and uploads downloadable artifacts.
It never deploys the project.

Set these repository variables before running the workflow:

- `GODOT_VERSION=4.7.1`
- `EXPORT_NAME=advertising-market-game`

## Deployment

Deployment is deliberately separate from the build workflow. A complete
deployment must publish both the verified static artifact and the bundled
account Functions. Do not configure an automatic static-only deployment.

Create a draft from a downloaded, verified artifact:

```powershell
pnpm run deploy:draft --artifact "C:\path\to\downloaded-artifact"
```

Publishing to production is a separate, explicit command:

```powershell
pnpm run deploy:production --artifact "C:\path\to\downloaded-artifact"
```

Anyone using the optional account system must provide their own Netlify and
Supabase configuration. Do not reuse classroom accounts or credentials from
another installation.

## Contributing

Bug reports and focused improvements are welcome. Read
[`CONTRIBUTING.md`](CONTRIBUTING.md) before submitting a pull request. Security
issues should be reported as described in [`SECURITY.md`](SECURITY.md).

## Licence

Original software source code is available under the MIT Licence in
[`LICENSE`](LICENSE). Original classroom writing and project-specific visual
assets are provided for non-commercial classroom use with attribution unless a
file states otherwise. Third-party software and remote media retain their
original licences; see [`CREDITS.md`](CREDITS.md).
