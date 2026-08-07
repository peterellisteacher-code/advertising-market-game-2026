# Tuckability and single-action release verification — 7 August 2026

Status: **candidate verified, hosted QA open and awaiting the behavioural pass.** The
artifact passed every automated gate and the static verifier. Hosted QA was initially
blocked by an unconfigured QA project; the teacher path has since been configured and
reopened. See "Hosted QA blocker and resolution" below. Production publication must not
proceed until the behavioural pass is recorded here.

## Candidate

- Branch: `agent/tuckability-single-action-20260806`
- Verified code commit: `baff2e9f64b1e94e45032d8fe0e6d5f69db6fa25`
- Pull request: [#25](https://github.com/peterellisteacher-code/advertising-market-game-2026/pull/25), base `main`, state `MERGEABLE` / `CLEAN`, 40 files, +2664 / -505
- GitHub Actions run: [31129466373](https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/31129466373), `workflow_dispatch` on the exact candidate commit
- Complete web artifact: ID `8975676095`, 208,859,651 bytes, 10,258 files
- Release ID: `f895f1c31ff55d4f185c269c0c25ebf9`
- Release manifest SHA-256: `c1bdf72b1552c662479f8124acf1812e7af5b8bbedf4ee36689e420fe940b26d`
- `index.pck` SHA-256: `73ef2fe09c13b3917b19a3a308cc7cfb3e977d6136850aac863643f4bc96038b`
- `index.wasm` SHA-256: `35116f68540ac41acf7d71ea457added91b5e960a9cca3e2acc72918eaf01277`
- Retained artifact path: `C:\Godot Projects\Advertising Market Game QA\run-31129466373\advertising-market-game-web`

`index.wasm` is identical to the 5 August production release because both use the
same Godot 4.7.1 export template. `index.pck` differs, as the game code changed.

## PR base

The base is `main`, not `agent/admarket-integrated-fixes-20260723`. Verified
independently of the session handover: `gh repo view` reports `main` as the repository
default, and `origin/main`'s tree is byte-identical to this branch's merge base
`3d8ef7c4`. Nothing on `main` is absent from this branch, so the CI artifact is
exactly what merging the pull request produces. The local `origin/HEAD` symref still
points at the stale integration branch and was ignored.

## Automated gates

Local gates at `baff2e9f`:

| Gate | Result |
|---|---|
| `npx pnpm test` | 176 files, 2,462 tests passed |
| `npx tsc --noEmit` | clean |
| `npx pnpm run test:build-web` | 147 of 147 passed |
| `godot --headless --path godot --script res://tests/run_tests.gd` | game, creator bridge and market bridge suites passed |

All three jobs in run 31129466373 passed: **Validate** (catalogue pipeline, type-check,
application tests, web-build contracts), **Export Godot Web** (import, Godot suite,
release export) and **Assemble Complete Web Artifact** (Function bundles, Creator
Studio, logo catalogue, assembly, verification). The catalogue pipeline tests run only
in CI; no local gate covers them.

The downloaded artifact passed `node scripts/verify-web-export.mjs <artifact>` with
`WEB_EXPORT_STATIC_VERIFICATION_OK`. Its release manifest binds 10,226 static files and
31 Function files. The built `studio/studio.js` contains both the Phase D writer's
statement copy and the Phase A1 "Advertisement toolbar" label, which confirms the
artifact is the candidate build and not a stale one.

## Hosted draft deploys

- Netlify site: `codex-browser-qa-harness` (`8edde91e-88ad-4a96-a49b-ddb8470d27c0`)
- First deploy: `6a751e6d30a172717890f51f` — read back as `ready`, `deploy-preview`
  context, 15 Functions, `published_at: null`. Production was not touched.
- Second deploy: `6a7527b59ba783aa693d26f1` — the identical artifact redeployed only to
  pick up the environment variables added below. No rebuild.
- QA URL: <https://6a7527b59ba783aa693d26f1--codex-browser-qa-harness.netlify.app>

Routing served as authored: `/` redirects 302 to `/student`; `/student`, `/student/*`,
`/teacher` and `/teacher/*` each return the shell at 200.

## Hosted QA blocker and resolution

Hosted behavioural QA of the Phase C lobby and the Phase D writer's statement did not
run. The QA project has **no environment variables set at all** — the Netlify
environment API returns zero keys for site `8edde91e-88ad-4a96-a49b-ddb8470d27c0`.
Both authenticated entry points therefore fail closed:

| Probe | Response |
|---|---|
| `GET /api/account/session` | 503 `ACCOUNT_NOT_CONFIGURED` |
| `GET /api/teacher/session` | 503 `TEACHER_NOT_CONFIGURED` |
| `GET /api/teacher/accounts` | 503 `TEACHER_NOT_CONFIGURED` |

`/student` renders the pair login and reports "Accounts are not ready yet. Ask your
teacher to try again later." That is `account-gate.ts:44` translating
`ACCOUNT_NOT_CONFIGURED`, which `account-session.mts:146` returns for an
`AccountConfigurationError`. The gate is behaving correctly; the release-verification
record of 4 August already classified these responses on this project as expected.

`/teacher` renders the teacher password gate correctly and leaks nothing before
authentication: heading, password field and **Sign in** only, with no account
administration, Image Lab allowance or playtest controls present. It shows "Teacher
access could not be checked", which is the same 503 surfaced honestly. The only browser
console entry was that 503; there were no script errors.

Because `/student` and `/teacher` both serve the same shell and every game surface sits
behind one of those two gates, there is no unauthenticated route to the lobby or the
Creator Studio on this deploy. The teacher password cannot open `/teacher/playtest`
while `ADVERTISING_GAME_TEACHER_PASSWORD` is unset server-side.

`netlify/functions/teacher-session.mts:28-32` requires
`ADVERTISING_GAME_TEACHER_PASSWORD`, `ADVERTISING_GAME_TEACHER_SESSION_SECRET` and
`ADVERTISING_GAME_TEACHER_SESSION_HOURS`. `netlify/functions/teacher-playtest.mts:43-53`
additionally names `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`ADVERTISING_GAME_EDGE_GATEWAY_SECRET`, `ADVERTISING_GAME_USERNAME_HMAC_SECRET`,
`ADVERTISING_GAME_CLASSROOM_CODE` and `ADVERTISING_GAME_ASSET_NAMESPACE_SECRET`.

`netlify/functions/lib/teacher-auth.ts:73-98` rejects a password outside 8 to 128
printable characters, a session secret outside 32 to 256, a session-hours value outside
1 to 24, or a password equal to the session secret. Every one of those failures returns
the same `TEACHER_NOT_CONFIGURED` 503, so the response does not distinguish an unset
variable from an invalid one.

This was a QA-environment gap, not a defect in the release candidate. No code change was
implied or made.

### Resolution

The three teacher variables were set on the QA project with throwaway QA-only values,
scoped to all contexts and scopes. Their values are deliberately not recorded here;
teacher credentials stay out of Git history. The Supabase and account keys were left
unset, so the QA project still holds no production secret and still reaches no
production data.

Two traps are worth recording. `netlify env:set --site <id>` does **not** work from an
unlinked directory: it prints "No project id found" and **exits 0**, so a failed write
looks like a successful one. The write has to go through
`netlify api createEnvVars` with both `account_id` and `site_id`. Netlify Functions also
receive environment variables only from a deploy made after the variables exist, so the
artifact was redeployed unchanged.

After the redeploy, on `6a7527b59ba783aa693d26f1`:

| Probe | Before | After |
|---|---|---|
| `GET /api/teacher/session` | 503 `TEACHER_NOT_CONFIGURED` | 200 `{"authenticated":false}` |
| `GET /api/teacher/accounts` | 503 `TEACHER_NOT_CONFIGURED` | 401 `AUTHENTICATION_REQUIRED` |
| `GET /api/teacher/playtest/progress` | 503 | 401 `AUTHENTICATION_REQUIRED` |
| `GET /api/account/session` | 503 `ACCOUNT_NOT_CONFIGURED` | 503 `ACCOUNT_NOT_CONFIGURED` |

The playtest endpoint returning `AUTHENTICATION_REQUIRED` rather than
`PLAYTEST_NOT_CONFIGURED` establishes that the three teacher variables alone satisfy its
configuration check; the six Supabase and account keys are not needed to open the
playtest. `/student` remains unusable on this project by design, as in the 4 August
record, so the pair login path is verifiable only against production.

The `/teacher` gate now renders with an empty error region and no console output at
1280×800.

The login endpoint was then confirmed working end to end without authenticating. The
same deliberately wrong password was sent twice: without an `Origin` header it returned
403 `CSRF_REJECTED`, and with a matching `Origin` header it returned 401
`INVALID_CREDENTIALS`. Same-origin CSRF therefore accepts a deploy-preview host, and the
endpoint distinguishes a bad password correctly. The stored password value was
separately verified byte for byte against its SHA-256, and
`teacher-auth.ts:100-115` compares the raw string with a constant-time HMAC equality
and no salting. Server-side sign-in is sound; a rejected sign-in on this deploy means
the submitted value differed, most plausibly browser autofill.

### Finding for a future slice: login errors are indistinguishable

`web/src/teacher/teacher-dashboard.ts:149-158` handles sign-in with a bare
`.catch(() => ...)` that discards the error and always renders "The teacher password was
not accepted. Check the password and try again." A wrong password, `CSRF_REJECTED`,
`TEACHER_NOT_CONFIGURED`, a malformed response and a network failure are therefore
indistinguishable to the operator. During this release both a misconfigured server and a
CSRF rejection presented as "check the password", which sent diagnosis down the wrong
path. `web/src/account/account-gate.ts` already maps error codes to distinct copy for
the pair-account gate and is the pattern to follow. Audit-only; no change made here.

## Hosted QA findings, 7 August

The teacher playtest was reached and exercised. It found four defects. Three are fixed
on this branch; the artifact above is therefore superseded and a fresh CI build is
required before any further QA.

1. **The game canvas overflowed the viewport.** `godot/web/godot_shell.html` carried no
   `#canvas` rule at all, so the canvas stayed an inline element laid out from its width
   and height attributes — which Godot writes in device pixels. Measured against the
   shipped markup at 150% display scaling, a 1280×800 viewport received a 1920×1200
   canvas: 640px over on the right and 400px over on the bottom, cutting off the page
   heading, the primary action and the top of the in-game HUD. Fixed by giving
   `body > main` and `#canvas` an explicit block box at 100%. The contract test that
   already claimed to lock gameplay to the viewport now asserts the canvas rule too.
2. **Station hotspots did not match their icons.** `STATION_DATA` in
   `godot/src/agency/agency_world.gd` drives `_station_position()`, which gates the
   near-station check, the interaction test and the nearest-station search, while the
   `Stations` nodes in `AgencyWorld.tscn` draw what the pair sees. Reception and
   StrategyRoom had been corrected in the scene and never in the script, leaving the
   proximity centre 27px and 31px from its own icon. Both now match the scene, and a new
   contract test compares all nine stations across the two files so they cannot drift
   apart again.
3. **Tour instructions were prose with negatives.** Pages 2 to 4 of the Studio tour in
   `web/src/ui/editor-shell.ts` are now bullets that state only what to do. The sentence
   "Swap roles changes responsibility, not permissions" was removed rather than reworded.

The fourth defect is open and needs an authoring decision, recorded below.

### Resolved: the floor art carries 8 markers, only 6 of them for stations

The agency floor art bakes a glowing amber ellipse where a hotspot belongs, and those
markers are the authored ground truth. Detecting them by colour and converting through
the `AgencyFloor` sprite transform (centred at 640,440, scale 0.76555) yields eight. The
earlier reading of "8 markers for 9 stations" was wrong: only six mark stations. Of the
remaining two, one matches `CENTRAL_TRAVEL_POINT` and one sits on the entrance mat,
bound to nothing — the pair spawns at reception (381.4, 290.7), not on the mat.

Six stations were moved onto their marker, a correction of 14px to 40px each. The three
with no marker — client-briefing, media-desk and art-studio — were given one, by
alpha-compositing a copy of the reception marker onto clear floor in the room each
station belongs to. Stamping rather than drawing keeps the new markers identical in
colour and shape to the authored ones.

| Station | Was | Now | Marker |
|---|---|---|---|
| reception | (318, 318) | (319.9, 290.9) | authored |
| client-briefing | (430, 370) | (421.0, 408.0) | stamped, floor by the briefing table |
| strategy-room | (640, 320) | (639.0, 289.4) | authored |
| art-studio | (1040, 310) | (949.3, 301.9) | stamped, floor left of the swatch layout |
| copy-room | — | (226.5, 502.1) | authored |
| production-studio | — | (164.4, 709.1) | authored |
| media-desk | (640, 532) | (635.4, 554.4) | stamped, tile below the lounge rug |
| sound-booth | — | (973.3, 500.9) | authored |
| pitch-theatre | — | (996.6, 671.2) | authored |

Every arrival point (station position plus its `STATION_ARRIVAL_OFFSETS` entry) was
checked to land on walkable floor inside the same room and inside `movement_bounds`
(28,104 to 1252,772). The original media-desk placement pushed its `(+64, 0)` arrival
into the corridor's right wall; moving the station clears it. client-briefing's physics
contract still holds: the pair arrives at (421, 498), 46px below `ClientBriefingFixture`,
so the 90px upward motion test still collides.

### Resolved: the pair figures were destroyed by their downscale, not badly drawn

The figures were judged not good enough, with the Asset Packs proposed as a source of
replacements. Two findings changed that plan.

`C:\Users\Peter Ellis\Documents\Asset Packs` has no usable replacement. Its character
collection is side-view platformer art (Idle/Run/Jump/Attack) and top-down-shooter combat
art; a search of `catalog/files.csv` for four-directional naming returns nothing outside
two unrelated effect and tileset packs. The agency pair needs front, back, left and right
at a high three-quarter camera angle. Swapping would cost the back and side views.

The figures also were not the problem. The atlas shipped at 418x470 per cell and rendered
at `scale = 0.13`, so the GPU resolved each figure into 54x61 pixels by nearest-neighbour
sampling — an 87% reduction that keeps one pixel in eight. That is what produced the
mismatched eyes and broken hands, not the artwork. The atlas is now authored at 108x122
per cell (twice the rendered size, leaving headroom for larger browser windows) by
premultiplied-alpha Lanczos resampling with a light unsharp pass, with `scale = 0.5` and
`texture_filter = 2` (linear). The on-screen footprint is unchanged at 54x61, and the
asset drops from 1.3 MB to 62 KB.

`test_agency_world.gd` asserted the raw `0.13` scale, which coupled the contract to the
source resolution. It now also asserts the rendered footprint (frame size times scale
equals 54x61), verified load-bearing by injecting a 1px error.

### Open: a failed `assert` does not fail the Godot suite

Both regressions above were caught by reading stdout, not by the gate. `run_tests.gd`
calls `quit(1)` only when a suite returns something other than `true`, but a failed
GDScript `assert()` aborts the assertion function and returns control to `run()`, which
carries on and returns `true`. Both times the runner printed `SCRIPT ERROR: Assertion
failed` and then `Godot game, Creator bridge, and Market bridge tests passed`, and exited
0. CI would have gone green on a broken suite. The cheapest fix is to fail the gate when
the runner's output contains `SCRIPT ERROR`; it has not been applied.

Related, not changed: `AgencyFloor` also uses `texture_filter = 1` at scale 0.766, so the
floor art loses roughly a quarter of its pixel rows to the same nearest-neighbour
sampling.

## Outstanding before production

1. Hosted QA of the Phase C lobby staging and the whole Phase D writer's statement at
   1280×800 and 1440×900. Neither has ever run against a web export.
2. Pull request [#24](https://github.com/peterellisteacher-code/advertising-market-game-2026/pull/24)
   is still open against `main` and carries a duplicate of this branch's `aac2cc2d`.
   Whichever merges second will collide; prefer this branch's version.
3. The Supabase migration for teacher batch Image Lab allowances remains unapplied
   (`docs/operations/image-lab.md:305-308`).

## Release boundary

This record verifies the exact artifact as a release candidate on automated and static
evidence only. Production, Supabase data and the OneDrive source were unchanged while
gathering it. Behavioural verification of the account Functions, protected routing and
production headers has not been performed. Safari on a student MacBook and school-wifi
behaviour remain field uncertainties.
