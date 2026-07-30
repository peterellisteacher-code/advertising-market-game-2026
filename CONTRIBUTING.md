# Contributing

Thank you for helping improve Advertising Market Game.

## Before you begin

- Use an issue to discuss substantial changes before investing in a large
  implementation.
- Keep changes suitable for pairs of Year 10 students using a modern browser.
- Do not commit passwords, access tokens, production configuration, real
  account details, student information or identifying classroom data.
- Do not add automatic production deployment. The build workflow must remain
  validation-and-artifact only.

## Development setup

Use Node.js 22.12 or later and pnpm 11.7:

```powershell
corepack enable
pnpm install --frozen-lockfile
```

Run the checks relevant to your change:

```powershell
pnpm typecheck
pnpm test
pnpm test:build-web
```

Changes to the Godot game should also pass the headless Godot tests and a web
export using Godot 4.7.1. Changes to the catalogue pipeline should pass:

```powershell
python -m pytest pipeline/tests -q
```

## Pull requests

Please describe:

1. the student-facing or technical problem;
2. the change you made;
3. the verification you ran; and
4. any browser, network or accessibility limitations that remain.

Keep pull requests focused. Do not include generated `build/web/` output.

By contributing original source code, you agree that it may be distributed
under the repository's MIT Licence. Do not submit third-party content unless
its licence permits redistribution and its attribution is recorded.
