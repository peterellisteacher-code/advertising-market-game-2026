# Advertising Market Game release workflow

This runbook records the deployment path that was proven on 20 July 2026. It is deliberately narrower than a generic Netlify workflow because this game combines a Godot Web export with nine Netlify Functions.

## Canonical surfaces

- Private source: `peterellisteacher-code/advertising-market-game-2026`
- Netlify site: `advertising-market-game-2026`
- Netlify site ID: `fffc6f57-3fd2-44e3-9247-05a5f746351d`
- Generated web artifact: `build/web/` locally, or the `advertising-market-game-web` GitHub Actions artifact
- Function source used for deployment: `netlify/deploy-functions/`
- Production URL: <https://advertising-market-game-2026.netlify.app/>

GitHub is the source of truth, but GitHub does not deploy this project. The workflow builds and verifies a downloadable artifact only. A deliberate Netlify CLI deployment must attach the static artifact and `netlify/deploy-functions/` together.

## Release sequence

1. Push a bounded branch to the private repository.
2. Run the `Build & Validate Web` workflow for the exact head commit.
3. Require all of the following from that one workflow run:
   - locked Node installation;
   - TypeScript checking;
   - all application and web-build tests;
   - Godot 4.7.1 headless tests in Linux;
   - Godot Web export;
   - complete artifact assembly and static verification; and
   - artifact upload.
4. Download that exact artifact to a new local path. Do not rebuild it before deployment. When using the GitHub connector, retain its returned `structuredContent.file_uri.download_url` and run exactly one download process. If a shell command returns a session ID, poll that session instead of starting the command again.
5. Run `scripts/verify-web-export.mjs` against the downloaded artifact.
6. Create a Netlify draft with the artifact plus `netlify/deploy-functions/`:

   ```powershell
   pnpm run deploy:draft --artifact "<downloaded-artifact>"
   ```
7. Test the hosted draft at a MacBook-class viewport. At minimum verify:
   - the site visitor gate;
   - pair login and cloud restore;
   - the product-builder controls do not overlap the launch path;
   - multi-layer products remain inside their preview frame;
   - products place onto the advert;
   - both pair roles can make a visible change;
   - Return to game completes its save-before-close sequence;
   - the browser console is clean; and
   - the account and market Functions are present.
8. Merge the tested commit into `main`.
9. Publish the same downloaded artifact with the same Function directory:

   ```powershell
   pnpm run deploy:production --artifact "<downloaded-artifact>"
   ```

10. Read the production deploy record back from Netlify. Require `state=ready`, `context=production`, the expected production alias, and all nine Functions.
11. Run one production smoke through the visitor gate and a retained QA pair account. Confirm cloud restore; do not create a fresh account merely to prove login.

Never enable Git-triggered Netlify publication for this project. A static-only publish can look healthy while silently removing `/api/account/*`, `/api/market/*`, and Image Lab routes.

The `deploy:draft` and `deploy:production` shortcuts fail closed unless the caller supplies `--artifact`. They verify that exact downloaded artifact, rebuild the nine self-contained Function bundles from current source, and mirror the artifact's own `_headers` into an isolated Netlify context. Neither command silently reads a local `build/web/` directory.

## Reference environment rules

- Hosted-only behaviour must be tested on a hosted deploy. The visitor gate, edge routing, rate limits, hosted headers, and deploy-specific secrets do not exist in Vite, Python `http.server`, or `netlify dev`.
- Vite and Python static servers do not serve `/api/*`. Their 404 or 501 responses are not route failures.
- Confirm that browser diagnostics exist in the deployed bundle before inferring anything from an empty console.
- Console entries are tab-specific evidence. Check each entry's URL before attributing it to a hosted page.
- A password-protected draft is immutable. Rotating the site password does not retrofit an older draft; create a fresh draft for the new password.
- Native Windows Godot remains quarantined on the OneDrive working copy. Use the Linux CI export or first move a working copy off OneDrive.

## What went wrong during the July release

The early account investigation was prolonged by reference-environment drift and stale deployment evidence:

- local static servers were used to reason about hosted Functions they could not serve;
- a shipped bundle did not contain the diagnostics being searched for;
- an immutable password-protected draft was tested after the visitor password changed;
- HTTP clients proved server routes but could not execute the failing browser path;
- native Godot was relaunched despite a known OneDrive access-violation quarantine; and
- draft, artifact, Function, and secret state were sometimes treated as one environment when they were separate.

The corrective discipline is: name the reference environment, state a falsifier, reproduce there, change one layer, and preserve the goal when replacing a bad method.

The final fresh-origin restore failure did have one proven browser-code cause. Netlify served the saved PNG with `content-type: image/png` but no `Content-Length`. The asset request returned 200, then `HttpAccountAssetClient` rejected the response before reading, hashing, or importing it. `Content-Length` is optional and can be removed by a host or intermediary. The client now accepts its absence while retaining the streaming 4 MiB ceiling, signature and MIME checks, and SHA-256 verification. A regression test covers the hosted response shape.

The documented pnpm commands also used `-- --artifact`. Under pnpm 11 that forwards a literal `--` to the script and the fail-closed parser rejects it. Use `pnpm run deploy:draft --artifact ...` and `pnpm run deploy:production --artifact ...` exactly as shown above.

## Verified release record — 21 July 2026

- Source commit tested: `d1698e64de58322d9f35a67e7e666e3b6dfb6cb4`
- Merge commit on `main`: `cd556169a19d1c7c48627d47f243b827b560e887`
- Pull request: <https://github.com/peterellisteacher-code/advertising-market-game-2026/pull/4>
- GitHub Actions run: <https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/29759062658>
- Artifact: `advertising-market-game-web`, ID `8468276563`, SHA-256 `239c0dadd2bafa8ca9b1418dce76ab2c75430c11c0190ebea739a17637ab137f`
- Hosted QA draft: `6a5e4e39a56ff87ce2748286`
- Production deploy: `6a5e4f37316e8f7b425f27a3`
- Production verification: ready; QA account restored cloud revision 16 and its catalogue PNG into a fresh origin; all account requests returned 200; the browser reported zero warnings or errors.

## Image Lab activation boundary

The fal.ai Image Lab code and Functions are deployed behind a teacher-controlled session gate. Each pair starts with Image Lab closed. Peter opens it on that MacBook with the server-owned classroom code while physically supervising the pair; access expires after 75 minutes and can be closed immediately. The retired `IMAGE_LAB_FAL_MINOR_USE_APPROVED` approval-letter switch is not part of the runtime. Image Lab is currently disabled because `FAL_KEY` is absent and `IMAGE_LAB_ENABLED=false`; Peter must install a dedicated capped key directly in Netlify before enabling a supervised session. The safeguards in `docs/operations/image-lab.md` still apply.

