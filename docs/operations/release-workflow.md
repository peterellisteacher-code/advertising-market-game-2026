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
4. Download that exact artifact to a new local path. Do not rebuild it before deployment.
5. Run `scripts/verify-web-export.mjs` against the downloaded artifact.
6. Create a Netlify draft with the artifact plus `netlify/deploy-functions/`.
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
   pnpm exec netlify deploy --prod --no-build --dir <downloaded-artifact> --functions netlify/deploy-functions
   ```

10. Read the production deploy record back from Netlify. Require `state=ready`, `context=production`, the expected production alias, and all nine Functions.
11. Run one production smoke through the visitor gate and a retained QA pair account. Confirm cloud restore; do not create a fresh account merely to prove login.

Never enable Git-triggered Netlify publication for this project. A static-only publish can look healthy while silently removing `/api/account/*`, `/api/market/*`, and Image Lab routes.

There is deliberately no `deploy:draft` package shortcut. A command that silently deploys whatever happens to be in a local `build/web/` directory can publish a stale Godot or studio bundle. Every draft and production deployment must name the fresh directory downloaded from the exact successful GitHub Actions run.

## Reference environment rules

- Hosted-only behaviour must be tested on a hosted deploy. The visitor gate, edge routing, rate limits, hosted headers, and deploy-specific secrets do not exist in Vite, Python `http.server`, or `netlify dev`.
- Vite and Python static servers do not serve `/api/*`. Their 404 or 501 responses are not route failures.
- Confirm that browser diagnostics exist in the deployed bundle before inferring anything from an empty console.
- Console entries are tab-specific evidence. Check each entry's URL before attributing it to a hosted page.
- A password-protected draft is immutable. Rotating the site password does not retrofit an older draft; create a fresh draft for the new password.
- Native Windows Godot remains quarantined on the OneDrive working copy. Use the Linux CI export or first move a working copy off OneDrive.

## What went wrong during the July release

There was no single proven browser-code root cause. The expensive failure pattern was reference-environment drift combined with stale deployment evidence:

- local static servers were used to reason about hosted Functions they could not serve;
- a shipped bundle did not contain the diagnostics being searched for;
- an immutable password-protected draft was tested after the visitor password changed;
- HTTP clients proved server routes but could not execute the failing browser path;
- native Godot was relaunched despite a known OneDrive access-violation quarantine; and
- draft, artifact, Function, and secret state were sometimes treated as one environment when they were separate.

The corrective discipline is: name the reference environment, state a falsifier, reproduce there, change one layer, and preserve the goal when replacing a bad method.

## Verified release record — 20 July 2026

- Source commit tested: `71cd2849`
- Merge commit on `main`: `ac8f2cf7db24b8c60b38f68a3e124084782fd52a`
- Pull request: <https://github.com/peterellisteacher-code/advertising-market-game-2026/pull/1>
- GitHub Actions run: <https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/29716354689>
- Hosted QA draft: `6a5da419dee708508ee54146`
- Production deploy: `6a5da9d8f6f76e04e64de775`
- Production verification: ready; nine Functions deployed; QA account restored cloud revision 11.

## Image Lab activation boundary

The fal.ai Image Lab code and Functions are deployed but the feature remains disabled. Enabling it requires school approval, a dedicated capped key, and Peter's continuous physical supervision. Each pair's Image Lab starts closed and requires Peter to enter the server-owned classroom code on that MacBook; it expires after 75 minutes and can be closed immediately. A future direct OpenAI route does not require an approval letter, but it must implement OpenAI's published Under 18 API Guidance before activation. The exact provider-specific checklist is in `docs/operations/image-lab.md`.

