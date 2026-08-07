# Tuckability and single-action release verification — 7 August 2026

Status: **candidate verified, hosted QA open and awaiting the behavioural pass.** The
artifact passed every automated gate and the static verifier. Hosted QA was initially
blocked by an unconfigured QA project; the teacher path has since been configured and
reopened. See "Hosted QA blocker and resolution" below. A teacher playtest on the
reopened draft then found four defects, all fixed and recorded under "Hosted QA
findings, 7 August" — the candidate below is the post-fix build, and none of the four
has yet been re-tested on a hosted deploy. Production publication must not proceed until
the behavioural pass is recorded here.

## Candidate

- Branch: `agent/tuckability-single-action-20260806`
- Verified code commit: `92024750`
- Pull request: [#25](https://github.com/peterellisteacher-code/advertising-market-game-2026/pull/25), base `main`, state `MERGEABLE` / `CLEAN`, 57 files, +3969 / -584
- GitHub Actions run: [31147722264](https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/31147722264), `workflow_dispatch` on the exact candidate commit, all three jobs green
- Complete web artifact: ID `8982317387`, 208,349,356 bytes
- Raw Godot web export: ID `8982268322`, 17,794,221 bytes
- Release ID: `8ba17b338194f6b0f90b6a8a01813a8e`
- Release manifest SHA-256: `8f44ad49f77dbdf09c3718a15bd8d60bce15021ff4f92f6b4dfd02589a15b0b3`
- `index.pck` SHA-256: `e1b2741221e3db7105dea0f76126e56e23cacd9f0b933e2d689d6d2debe59ede`
- `index.wasm` SHA-256: `35116f68540ac41acf7d71ea457added91b5e960a9cca3e2acc72918eaf01277`
- Retained artifact path:
  `C:\Godot Projects\Advertising Market Game QA\run-31147722264\advertising-market-game-web`
  (deploy from here — the earlier retained folders all predate the playtest fixes)
- Retained raw Godot export:
  `C:\Godot Projects\Advertising Market Game QA\run-31147722264\godot-web`

`index.wasm` is identical to the 5 August production release and to every earlier
candidate here, because all of them use the same Godot 4.7.1 export template.
`index.pck` differs, as the game code and the assets changed.

The Linux export was checked against the two assets this pass replaced, by scanning the
pck for `GST2` texture headers: the 776x1104 walk atlas is present, the 1672x941 floor art
carrying the three newly stamped markers is present, and the superseded 432x244 still
sheet appears nowhere. All eight animation names (`art-front` … `strategy-right`) are in
the pck, so the scene references the atlas rows rather than a stale single-frame sheet.
The same check was run on both artifacts and both `index.pck` files hash identically, so
the assembly step passes the Godot export through unaltered.

Superseded candidates, verified the same way earlier the same day: `baff2e9f` (run
[31129466373](https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/31129466373))
and `9e9ff150` (run
[31145537978](https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/31145537978)).

## PR base

The base is `main`, not `agent/admarket-integrated-fixes-20260723`. Verified
independently of the session handover: `gh repo view` reports `main` as the repository
default, and `origin/main`'s tree is byte-identical to this branch's merge base
`3d8ef7c4`. Nothing on `main` is absent from this branch, so the CI artifact is
exactly what merging the pull request produces. The local `origin/HEAD` symref still
points at the stale integration branch and was ignored.

## Automated gates

Local gates at `92024750`:

| Gate | Result |
|---|---|
| `npx pnpm test` | 176 files, 2,468 tests passed |
| `npx tsc --noEmit` | clean |
| `npx pnpm run test:build-web` | 153 of 153 passed |
| `npx pnpm test:godot` | `GODOT_TESTS_OK` — game, creator bridge and market bridge suites passed |

All three jobs in run 31147722264 passed: **Validate** (catalogue pipeline, type-check,
application tests, web-build contracts), **Export Godot Web** (import, Godot suite,
release export) and **Assemble Complete Web Artifact** (Function bundles, Creator
Studio, logo catalogue, assembly, verification). The catalogue pipeline tests run only
in CI; no local gate covers them.

The Godot gate now runs in CI as well as locally, on Node 22.12.0 supplied by
`actions/setup-node` inside the `barichello/godot-ci` container. That combination was
untested — the container ships no Node — and the job log confirms both the Node version
and the gate's `GODOT_TESTS_OK` line.

The **Verify complete web export** step of the Assemble job runs
`node scripts/verify-web-export.mjs build/web` against the exact tree that becomes the
artifact, and printed `WEB_EXPORT_STATIC_VERIFICATION_OK` for this candidate. The
downloaded copy was then re-verified locally with the same script and also passed. Its
release manifest binds 10,226 static files and 31 Function files, and the built
`studio/studio.js` contains both the Phase D writer's statement copy and the Phase A1
"Advertisement toolbar" label, which confirms the artifact is the candidate build and
not a stale one.

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

The teacher playtest was reached and exercised. It found four defects. All four are fixed
on this branch, and the candidate recorded above is the CI build that carries the fixes.

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

The fourth defect — the floor markers and the pair figures — needed an authoring
decision and is recorded below.

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
| copy-room | (228, 518) | (226.5, 502.1) | authored |
| production-studio | (178, 706) | (164.4, 709.1) | authored |
| media-desk | (640, 532) | (635.4, 554.4) | stamped, tile below the lounge rug |
| sound-booth | (982, 518) | (973.3, 500.9) | authored |
| pitch-theatre | (1012, 708) | (996.6, 671.2) | authored |

`CENTRAL_TRAVEL_POINT` also moved, from (640, 430) to (618.3, 413.4), onto the marker
in the central corridor. "Was" is the position before this QA round; reception and
strategy-room were nudged once already in `c276017f` before being placed exactly here.

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
mismatched eyes and broken hands, not the artwork. The atlas is now authored at roughly
twice the rendered size, leaving headroom for larger browser windows, with `scale = 0.5`
and `texture_filter = 2` (linear).

What remained after that was a second complaint the downscale had masked: the pair was two
static figures that a sine bob had to pretend were walking. Each of the eight facings now
carries an eight-frame walk cycle. The stills were animated as image-to-video on fal.ai
(Kling 2.5 Turbo Pro, `license_type: commercial`, USD 2.80 for the eight clips), extracted
to sprite sheets, and packed into one 776x1104 atlas of 97x138 cells. Frames are chosen by
finding the segment of each clip whose first and last frames differ least, so the cycle
closes on itself; both characters are padded to a common cell aligned on the foot line
rather than the frame edge, so they stand on the same floor. The bob and lean stay — they
carry the weight shift — but the frames advance only while the pair is walking, and
reduced motion holds the standing pose for the same reason it holds the bob. Every
`AtlasTexture` sets `filter_clip = true`, so linear filtering cannot bleed between
neighbouring cells.

One extraction defect is worth recording because it produced a false quality judgement.
The sprite-sheet packer writes each cell with 2px edge extrusion on every side, so the
grid stride is `frame + 4`, not `frame`. Cropping on the bare frame size walked off the
grid and mixed adjacent poses, which read as wobbly proportions and an incoherent gait —
a measurement artefact, not a model failure. Corrected to `stride = frame + 4, origin +2`,
the frames are single clean figures with stable proportions.

`test_agency_world.gd` asserted the raw `0.13` scale, which coupled the contract to the
source resolution. It now also asserts the rendered footprint (frame size times scale
equals 48.5x69), verified load-bearing by injecting a 1px error. Provenance, hashes and
the superseded assets are recorded in `godot/assets/agency/ASSET-SOURCES.md`.

### Resolved: a failed `assert` did not fail the Godot suite

Both regressions above were caught by reading stdout, not by the gate. `run_tests.gd`
calls `quit(1)` only when a suite returns something other than `true`, but a failed
GDScript `assert()` aborts the assertion function and returns control to `run()`, which
carries on and returns `true`. Both times the runner printed `SCRIPT ERROR: Assertion
failed` and then `Godot game, Creator bridge, and Market bridge tests passed`, and exited
0. CI would have gone green on a broken suite.

`scripts/run-godot-tests.mjs` now fails the gate when the suite output contains
`SCRIPT ERROR`, when the completion line is absent, or when the runner exits non-zero.
Re-injecting the 1px footprint error exits 1 with the reason named, against the same
stdout that still ends in the completion line.

Related, not changed: `AgencyFloor` also uses `texture_filter = 1` at scale 0.766, so the
floor art loses roughly a quarter of its pixel rows to the same nearest-neighbour
sampling.

### Resolved: the local Godot gate could pass against a stale import cache

`godot --headless --script res://tests/run_tests.gd` does not re-import changed assets.
After the atlas was resized from 1672x941 to 432x244, the suite passed while
`godot/.godot/imported/` still held the two-day-old 1,028,352-byte `.ctex` built from
the original image. Nothing in the suite reads the imported texture — the footprint
assertion reads the `AtlasTexture` region out of the scene file — so a scene pointing at
regions that no longer exist in the source image would still have passed.

Running `godot --headless --path godot --import` first rebuilt the cache (pair 58,770
bytes, floor refreshed) and the suite was re-run clean against the real textures. CI is
unaffected: it checks out fresh with no `.godot/` cache, so it always imports.

`scripts/run-godot-tests.mjs` now imports before it runs the suites, so a local run
carries the same weight. Emptying `godot/.godot/imported/` and running the gate rebuilds
all 36 files, including the 58,770-byte pair `.ctex`, before the first suite loads.

### The gate now has one entry point

`pnpm test:godot` and the workflow's **Run Godot import and tests** step both run
`node scripts/run-godot-tests.mjs`, which resolves the Godot binary the same way the web
export does. `scripts/github-workflow.test.mjs` fails if the workflow calls
`godot --headless --path godot --import` or `--script` directly again, so the CI step and
the local gate cannot drift apart. `scripts/run-godot-tests.test.mjs` pins the
import-before-tests order and the three failure verdicts.

## Outstanding before production

1. Hosted QA of the Phase C lobby staging and the whole Phase D writer's statement at
   1280×800 and 1440×900. Neither has ever run against a web export.
2. Hosted re-test of the four playtest defects above. The canvas sizing in particular can
   only be proved at real display scaling — the local and CI evidence is static. The
   walk cycle and the marker-derived station positions have been verified in the headless
   suite and by rendering the atlas at ship size, but not yet seen moving in a browser.
3. Pull request [#24](https://github.com/peterellisteacher-code/advertising-market-game-2026/pull/24)
   is still open against `main` and carries a duplicate of this branch's `aac2cc2d`.
   Whichever merges second will collide; prefer this branch's version.
4. The Supabase migration for teacher batch Image Lab allowances remains unapplied
   (`docs/operations/image-lab.md:305-308`).

## Release boundary

This record verifies the exact artifact as a release candidate on automated and static
evidence only. Production, Supabase data and the OneDrive source were unchanged while
gathering it. Behavioural verification of the account Functions, protected routing and
production headers has not been performed. Safari on a student MacBook and school-wifi
behaviour remain field uncertainties.
