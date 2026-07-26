# Advertising Market Game release workflow

The GitHub workflow validates source and builds a downloadable artifact. It
does not deploy. Deployment is a separate operator action because the game
requires both the verified static files and the Function bundles bound into
that same release artifact.

## Release sequence

1. Run `Build & Validate Web` for the exact candidate commit.
2. Require the locked dependency install, Python catalogue tests, TypeScript
   check, serialized application suite, web-build contracts, Linux Godot tests,
   web export, artifact assembly and static verifier to pass.
3. Download the `advertising-market-game-web` artifact to a new local path. Do
   not rebuild or modify it.
4. Verify it locally:

   ```powershell
   node scripts/verify-web-export.mjs "C:\path\to\downloaded-artifact"
   ```

5. Create a draft on a caller-owned Netlify site:

   ```powershell
   pnpm run deploy:draft --artifact "C:\path\to\downloaded-artifact" --site-id "<your-netlify-site-id>"
   ```

6. Test that exact hosted draft at the supported classroom viewports. At
   minimum verify login and recovery where configured, product building,
   advert editing, pair-role interaction, save-before-close, required
   Functions and a clean browser console.
7. If production publication is authorised, deploy the same unchanged
   artifact to the same caller-owned site:

   ```powershell
   pnpm run deploy:production --artifact "C:\path\to\downloaded-artifact" --site-id "<your-netlify-site-id>"
   ```

8. Read the resulting deploy record back. Require `state=ready`, the intended
   context and aliases, and the expected Function set.

Never enable an unreviewed static-only auto-deploy. It can appear healthy while
removing the account, market or Image Lab routes.

The deployment commands fail closed unless the caller supplies both
`--artifact` and `--site-id`. They verify the exact release manifest, mirror
its static files and already-bound Function bundles into an isolated Netlify
context, and use the artifact's own `_headers`. They do not silently read
`build/web/` or select a maintainer's site.

## Reference environments

- Vite, `http.server` and static preview servers do not serve `/api/*`.
- `netlify dev` exercises local Function routing but not hosted visitor access,
  edge routing or hosted headers.
- Hosted-only behaviour must be tested on a hosted draft or deploy preview.
- Console evidence is tab-specific; check each entry's URL.
- Keep native Windows Godot quarantined if the working copy is on a filesystem
  known to trigger editor access violations. The Linux CI export is the
  reproducible release surface.

## Optional services

Accounts, cloud progress, the live market and Image Lab require independent
operator configuration. Keep their secrets server-side, begin with the
features disabled, and complete the corresponding operation guide before
student access:

- `docs/operations/advertising-game-account-progress.md`
- `docs/operations/live-market.md`
- `docs/operations/image-lab.md`
