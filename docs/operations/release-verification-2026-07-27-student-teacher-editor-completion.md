# Student, teacher and editor completion verification

Date: 27–28 July 2026
Authoritative worktree:
`C:\tmp\admarket-integrated-fixes-20260723`
Branch: `agent/admarket-integrated-fixes-20260723`

## Candidate identities

- Continuation boundary:
  `a0d0b8cb55fdc7e4fae9e4102550529ce684629d`
- Final application and test candidate:
  `89de81db9c6dd79a47217768ed97cacdf811c719`
- Exact final exported, assembled and browser-tested runtime candidate:
  `89de81db9c6dd79a47217768ed97cacdf811c719`
- CI-only export transport merge:
  `b1261a2cce8fdfb0129756aaf801662155c06c23`
- Public source snapshot:
  `C:\tmp\admarket-public-source-89de81db`

The transport commit has the final candidate as its first parent and changes
only `.github/workflows/build-and-publish.yml`. It preserves the exact Godot
Docker image, template version, export preset and export command while
retaining the raw export through checksummed log chunks after GitHub refused
ordinary artifact upload. The recovered archive hash matches the CI log.

## Completed source groups

### Student and teacher access

- Tasks 1–5 retained the separate `/student`, `/teacher` and
  `/teacher/playtest` routes, independent teacher session, server-only account
  administration, password-preserving selected-pair reset and editable
  classroom credentials.
- `254c801c` added the isolated, resettable complete teacher playtest.
- `e8079a40` kept teacher controls and capabilities off pair devices.
- `b9f5bbc9` bound the hosted teacher playtest client to browser fetch.
- `e8c862a2` and `5426d5fa` kept teacher and role guidance above the workspace
  at the required viewports.

### Image Lab allowances

- `2ea3eff2` through `6019ccef` added the server-authoritative allowance model,
  pair/default/global/batch teacher controls, paid-job settlement, account
  binding and boundary tests.
- `e64ea17c` removed the teacher Image Lab code from student devices.
- `6056d946` made reset and allowance mutations atomic and reconcilable.
- The SQL and Function changes are source-complete but were not applied to the
  shared Supabase project under this programme's no-mutation boundary.

### Studio editor

- `1b139e17` added twelve varied starters.
- `136a7e07` aligned certified rendered component sockets.
- `71e589c6` added proportional pointer/keyboard split panes.
- `efa9c6d0` exposed selected-item Delete through undoable history.
- `6a471cdf` and `016796d4` added bounded, section-aware raster fill.
- `19e87e10` repaired logo prerequisites and focus.
- `6071875c` removed accidental starter preselection after reset.

### Guidance, roles and market flow

- `933031b5`, `1d96cf25`, `9a8ea0e0` and `15ca903d` added linked
  one-action-at-a-time guidance, literal audience-brief definitions and a
  deeper role explanation.
- Both partners have the same unlocked buttons. The Art Director owns
  appearance, images, colour, arrangement and layout. The Strategist owns the
  product name, advertising words, claim, price reasoning and market-route
  reasoning. Swapping changes later responsibility and attribution without
  removing earlier work.
- `4cc4b942` and the later market hardening commits completed publication,
  market navigation, resume, typed errors and keyboard focus.
- `a8210288`, `5f766a76` and `89de81db` aligned practice recovery and its test
  doubles with the persisted role-guide flag.

## Language and independent review

The current student corpus contains 4,379 occurrences and has SHA-256
`595B6BCBD4A4ED7C51602344D8636E9F3D9B7AB4E81C12C68F35BC56EA4441EC`.
The single Plain Language request and ten-section Claude Scrubber MICROCOPY pass
are recorded in:

`reviews/student-copy-language-gate-2026-07-27.md`
SHA-256:
`6D28D4FAC4081818E35ED4636FC86B568E16AD9657AE8E0576EDCCCB6692FFC3`

No extra paid language call was made after the stable corpus.

The one fresh Superpowers source review is:

`reviews/release-readiness-code-review-2026-07-27.md`
SHA-256:
`BF5B78DFAE945F271D9C5D1D24F4F5A10071E457C1D66E2A9804890C4E961181`

Its reset-generation, atomic-allowance, uncertain-operation and dialog-focus
findings were closed by `6056d946` and the current focused tests.

The one requested five-model coding panel is:

`reviews/release-readiness-coding-panel-2026-07-27.json`
SHA-256:
`82F764C8BF504AABB88111951C3893A781029EAEC2F997FF4DE74BB5F169C91E`

Generation IDs:

- HY3: `gen-1785160066-vtECN2HyV7hCqwVaFGoY`
- GLM-5.2: `gen-1785160189-XLrV5xNqSazJ8HqjGUYc`
- Kimi K3: `gen-1785160381-kfPKcEUEw60bBEbewHWy`
- DeepSeek V4 Pro: `gen-1785160689-hM7Rsd3I8U99UCjPdu3d`
- Claude Opus 5: `gen-1785160775-AxBpCShRxUy1uNE9XbtR`

No reviewer or panel loop was run.

The later external Kimi repository review inspected an older moving boundary.
Against the current tree:

- H1, H2, M1, M2, M7 and L1 were stale and already fixed.
- H3 correctly observed four editor-guide terminal steps with
  `isComplete: () => false`, but its proposed duplicate editor completion state
  would conflict with the authoritative Godot `GameRun` and market state.
  Current game-shell, live-resume and market tests cover completion and reload.
- The hosted pass found and fixed one additional real issue: the teacher strip
  could sit beneath the studio workspace.

After GitHub's artifact quota blocked the exact final export upload, Peter
explicitly requested one additional recovery-method opinion from K3, GLM-5.2
and HY3. All three independently returned `PROCEED WITH CONDITIONS`. Their
conditions were met by inspecting the unchanged export recipe, matching the
recovered archive to the CI log hash, inventorying the extracted export,
comparing the assembled artifact and rerunning the hosted teacher playtest at
both exact viewports.

Generation IDs:

- K3: `gen-1785190774-qodLnSlPIs23xyfPiiXq`
- GLM-5.2: `gen-1785190951-dZT8cbdfdYUQmzAfuMr0`
- HY3: `gen-1785191010-dGnGGSaJBya0zdxcqJJP`

No further reviewer or model loop was run.

## Deterministic verification

### Local final runtime candidate

On `5426d5fa`:

- `corepack pnpm test`: 168 files, 2,368 tests passed; fifteen Function bundles
  rebuilt.
- `corepack pnpm run typecheck`: `tsc --noEmit` passed.
- `corepack pnpm run test:build-web`: 118 tests passed.
- `node scripts/verify-web-export.mjs build/web`:
  `WEB_EXPORT_STATIC_VERIFICATION_OK`.
- `git diff --check`: passed.

Focused final repairs:

- product and main integration: 64 tests passed;
- editor CSS, product and teacher controller: 40 tests passed;
- practice public API and service: 13 tests passed;
- Godot bridge contracts: 7 tests passed.

### Final Linux workflow

Workflow:
`https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/30304627640`

Head:
`89de81db9c6dd79a47217768ed97cacdf811c719`

Passed:

- 306 Python catalogue tests;
- TypeScript;
- 168 application files and 2,368 tests;
- 118 web-build contracts;
- all twelve Godot seam suites; and
- the Godot web export.

The workflow's final status is failure solely because GitHub refused
`actions/upload-artifact` after export:

`Artifact storage quota has been hit.`

The complete-artifact assembly job was therefore skipped. No retained artifact
was deleted because that requires Peter's explicit approval.

### Exact export recovery

Transport workflow:
`https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/30309296349`

Transport head:
`b1261a2cce8fdfb0129756aaf801662155c06c23`

The transport run succeeded and emitted the exact first-parent
`89de81db` Linux export as checksummed log chunks. The reconstructed retained
archive is:

`C:\tmp\admarket-export-89de81db-30309296349-retry4\advertising-market-game-godot-web-89de81db.tar.gz`

- Archive bytes: 10,648,022
- Archive SHA-256:
  `54CCDE8D8957B2F9F2E6DC4233292003DF1535655B14447AA14534831C548A49`
- Extracted files: 9
- Extracted bytes: 40,269,835
- Gzip integrity: passed
- `index.pck` bytes: 424,756
- `index.pck` SHA-256:
  `6B81028133DD08F4EA4376999EB520F5AD1DDE62FE34776E8E861C435310B32F`
- `index.wasm` SHA-256:
  `35116F68540AC41ACF7D71EA457ADDED91B5E960A9CCA3E2ACC72918EAF01277`

The exact export was assembled with the final source tree. Fifteen Function
bundles, the studio, 4,205 logo icons and the complete offline web shell built
successfully. `WEB_EXPORT_STATIC_VERIFICATION_OK` passed before and after the
artifact copy, and the deterministic QA Function tests passed 4 of 4.

## Verified runtime artifact

Retained artifact:

`C:\tmp\admarket-browser-qa-89de81db-full-20260728\artifact`

- Files: 10,246
- Bytes: 238,790,040
- Aggregate SHA-256 over the sorted file-hash manifest:
  `FC20E03FC40667C5B5846F422B41BFE027DCE02AC9DE25C7A1DF9772ADCCCF97`
- Release ID: `87fed2c9e28346f82a2dab8f1ebda4f9`
- `index.pck`:
  `6B81028133DD08F4EA4376999EB520F5AD1DDE62FE34776E8E861C435310B32F`
- `index.wasm`:
  `35116F68540AC41ACF7D71EA457ADDED91B5E960A9CCA3E2ACC72918EAF01277`
- `studio/studio.js`:
  `7C2462028F83785CB817D8DF0E11100F0B850B36E640DD435F4CCB6FB93F7E49`
- `studio/studio.css`:
  `B5FABFADDCE692AF7F477432E9B0F1FBA3AB29AA467992703B9CA95CC1DA47F9`
- `release-manifest.json`:
  `80C170EEF7E3142A7B64D415B34B8E75CF0BE121FA8A904BDD59971740FC4785`
- `service-worker.js`:
  `866F640CB164425DE2594A2F02E7EBED3A06E24890A2C8C10C4B5A1FA49BAD23`
- Static verification: passed.

Against the earlier fully browser-tested artifact, all 10,246 paths are the
same and 10,240 are byte-identical. The six derived changes are `_headers`,
`asset-manifest.json`, `index.html`, `index.pck`, `release-manifest.json` and
`service-worker.js`. The PCK has the same 79 paths; 75 are byte-identical and
the four changes are the two canonicalised test fixtures plus compiled
`Main.scn` and `MarketScreen.scn` dependencies. The application Godot source,
all Function bundles, deploy wrappers, studio JavaScript/CSS, catalogues and
assets are unchanged. The exact final artifact nevertheless received a fresh
hosted teacher-playtest replay.

No Windows Godot executable was launched.

## Non-production hosted QA

- QA project: `codex-browser-qa-harness`
- Project ID: `8edde91e-88ad-4a96-a49b-ddb8470d27c0`
- Deploy ID: `6a67e63269b5e7626b269afc`
- URL:
  `https://6a67e63269b5e7626b269afc--codex-browser-qa-harness.netlify.app`
- Context: deploy preview
- `published_at`: null
- Functions: deterministic `qa-api` only
- Edge Functions: none
- QA-project environment variables: none
- Production project, alias, secrets and access controls: untouched

Current transcript:

`C:\tmp\admarket-browser-qa-89de81db-full-20260728\evidence\browser-qa-findings.md`

Hosted readiness passed for `/student`, `/teacher` and `/teacher/playtest`.
Each returned HTTP 200 with the exact final shell, CSP, COOP, COEP and CORP.
The hosted release manifest, service worker, PCK, studio JavaScript and studio
CSS hashes matched the local final artifact.

At exact browser inner sizes `1280x800` and `1440x900`, fresh isolated
Playwright contexts authenticated through the deterministic QA stub and opened
the complete teacher playtest without a pair gate. Both reached `Game ready`,
showed the persistent teacher strip, Return and Factory reset controls, literal
Art Director and Strategist duties, twelve starters with zero selected, and
full-width canvas buffers at DPR 1. Document and body widths matched the
viewport. There were no application console warnings/errors and no page
exceptions.

Four Chromium/ANGLE `ReadPixels` performance notices appeared only in the
headless `1280x800` context at line 0 and are retained separately as
browser-driver warnings. The in-app browser run and `1440x900` Playwright
context produced none. Fresh visual inspection found no clipping, overlap or
floating obstruction.

The earlier full student route and teacher-reset journeys remain valid because
their Function bundles, deploy wrappers, studio assets, catalogues and
application source are unchanged. That evidence covers the isolated pair gate,
permanent guide, audience definitions, product placement, visible Delete/Undo,
role swap, exact `RESET` ordering/cancel behaviour and the `768x900`
Browse/Edit fallback.

Primary screenshots:

- `C:\tmp\admarket-browser-qa-89de81db-full-20260728\evidence\03-teacher-playtest-exact-final-1280x800.png`
- `C:\tmp\admarket-browser-qa-89de81db-full-20260728\evidence\04-teacher-playtest-exact-final-1440x900.png`
- `C:\tmp\admarket-browser-qa-89de81db-full-20260728\evidence\playwright-exact-viewports.json`
- `C:\tmp\admarket-browser-qa-6071875c-full-20260728\evidence\02-teacher-playtest-reset-dialog-1280x800.png`
- `C:\tmp\admarket-browser-qa-a8210288-full-20260728\evidence\15-full-guide-1280x800.png`
- `C:\tmp\admarket-browser-qa-a8210288-full-20260728\evidence\18-studio-role-state-1440x900.png`
- `C:\tmp\admarket-browser-qa-a8210288-full-20260728\evidence\19-narrow-studio-768x900.png`
- `C:\tmp\admarket-browser-qa-a8210288-full-20260728\evidence\20-narrow-edit-768x900.png`

All fourteen actionable Claude playtest findings are closed in
`reviews/claude-playtest-2026-07-24-closure.md` with deterministic or current
hosted evidence.

## Sanitized public source snapshot

Path:
`C:\tmp\admarket-public-source-89de81db`

- Files: 10,954
- Bytes: 349,524,679
- Aggregate SHA-256:
  `54B53FCEA0F5F1BD2D605EA3805CD1401EEB74E628A80FC28C3634F29ED8A3C8`
- File-set differences from the previously validated allowlist: 0
- Final overlaid file hashes matching authoritative source: 2 of 2
- Forbidden structural paths: 0
- Known private/deployment identifier hits: 0
- Credential-like assignments outside tests/fixtures/examples: 0
- `scripts/public-release-contract.test.mjs`: 4 tests passed

The snapshot is history-free and excludes `.git`, `.netlify`, dependencies,
reviews, plans, internal verification records, environment files, deployment
identifiers and secrets.

The root MIT licence applies to original software. `CREDITS.md` separately
defines classroom asset permission and excludes third-party relicensing. The
vendored Tabler notice is retained. No stock-media licence was silently
broadened.

The snapshot was validated only. The authoritative repository was not made
public or repointed.

## External-state and uncertainty ledger

Unchanged:

- production Netlify project, deploy, aliases, visitor gate, secrets and access
  controls;
- shared Supabase data, schema and deployed Functions;
- real student data;
- OneDrive project source; and
- native-Godot quarantine.

One redundant screenshot was accidentally written to the OneDrive Advertising
folder:

`C:\Users\Peter Ellis\OneDrive\Teaching\2026\10ESH - 2026\Semester 2\Advertising\08-image-lab-allowance-confirmed-1280x800.png`

A safe retained copy exists at:

`C:\tmp\admarket-browser-qa-b9f5bbc9-full-20260728\evidence\08-image-lab-allowance-confirmed-1280x800.png`

The redundant OneDrive file has not been deleted because Peter has not given
the required explicit deletion approval.

Still unmeasured:

- Safari/WebKit rendering, storage and download behaviour on a current student
  MacBook;
- school-wifi latency, filtering and interruption;
- browser-controlled offline reload;
- real production Functions and Supabase allowance objects;
- production visitor gate, headers, edge routing and rate limiting.

No production deployment is authorised by this record.
