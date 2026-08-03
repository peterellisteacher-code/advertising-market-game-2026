# Agency clarity release verification — 4 August 2026

## Candidate

- Branch: `agent/agency-clarity-tuckability`
- Verified code commit: `be9eacefaf1ac6f650e5f65481b9cb70cb7d0160`
- Pull request: [#15](https://github.com/peterellisteacher-code/advertising-market-game-2026/pull/15)
- GitHub Actions run: [30833874874](https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/30833874874)
- Complete web artifact: ID `8864334317`, SHA-256 `dbd50c02d35ed32029c5bfe7e0015327c40a97c858390bfae28fdd285c0d5b1f`
- Release ID: `1bc11bb1daaf49a77b0476a224b0eefc`
- Release manifest SHA-256: `a199e35b4b58bba6351c77d9a45c097e62a85d9b42e065200353160b7f63f880`

## Automated gates

All three jobs in run 30833874874 passed:

1. **Validate** — catalogue pipeline, TypeScript type-check, application tests and web-build contracts.
2. **Export Godot Web** — Godot import, the complete Godot seam suite and the release web export.
3. **Assemble Complete Web Artifact** — Netlify Function bundles, Creator Studio, logo catalogue, complete artifact assembly and verification.

The downloaded artifact passed `node scripts/verify-web-export.mjs <artifact>` with `WEB_EXPORT_STATIC_VERIFICATION_OK`. Its QA harness passed 10 of 10 tests and contained 10,215 files, 243,836,375 bytes, with tree SHA-256 `7bde392a037135f50b10353acfd88566aa98f98705a8e8a2ab61a076c1dae7bb`.

GodotIQ static analysis reported no issues in the changed runtime scripts. The live editor bridge remained deliberately disconnected under the native-Windows-Godot quarantine; Linux Godot CI and the hosted web export supplied runtime evidence instead.

## Language gates

The final governed language corpus contains 4,879 records. Plain-language and Claude-scrubber checks were completed on the stable corpus before the final HUD lifecycle fix. Re-extraction found no changed student-facing content: all 4,879 normalised records match, with zero content differences and shared normalised SHA-256 `7a8a94b3ddf218a865b793d6d9b1fad1591ed45f6bbec77756a9c7b01da5ff90`.

The raw corpus file hash changed because 113 source-location identifiers moved by eight lines in `main.gd`; the associated audience, path and text fields are unchanged. No paid language pass was repeated.

## Hosted draft QA

- Netlify site: `codex-browser-qa-harness` (`8edde91e-88ad-4a96-a49b-ddb8470d27c0`)
- Deploy: `6a70cb9f018971ce551fe590`
- URL: <https://6a70cb9f018971ce551fe590--codex-browser-qa-harness.netlify.app>
- State confirmed through the Netlify connector: `ready`, deploy-preview context, one QA Function and no edge functions.

Playwright checks at exactly 1440×900 and 1280×800 established:

- the teacher playtest opens on the lobby without agency HUD or station controls leaking through;
- pointer entry of a pair alias and **Practice on this computer** starts the physical agency floor at 0 of 7 required missions;
- all three quick-start screens fit, are clickable and state the first action, movement controls and literal division between Strategist and Art Director;
- both roles retain the same controls and access;
- quick start and the station card can be minimised and restored;
- teacher controls can be revealed, and the exact `RESET` factory reset returns the playtest to the first lobby screen;
- `/student` keeps **Create a pair login** visible even when the intentionally limited QA harness returns account API 404;
- registration explains teacher approval, offers **Back to log in**, and a browser reload from registration reconstructs the main login screen rather than trapping the student;
- the teacher playtest produced no browser-console errors; its required QA API and static asset requests returned 200.

The in-app browser independently reached `Game ready`, showed the clean first-move lobby, reported no leaked campaign surface and no console errors. Its fixed viewport was 1280×720, so it supplements rather than replaces the exact Playwright viewport evidence.

## Screenshot evidence

The retained QA evidence directory is `run-30833874874`. Screenshots are not part of the public source tree; the hashes below bind the reviewed files.

| File | Evidence | SHA-256 |
|---|---|---|
| `qa-current-lobby-1440x900.png` | Clean lobby; no agency HUD leak | `cc5eef678886a9c381e7c5bd284a99f41461e5030d7e929211f1e8dbc425cc16` |
| `qa-quick-start-roles-1440x900.png` | Literal role responsibilities and equal access | `ad2e2ca6fb3ee79f2d9314c9a6d47ffadc9290c35d49f9fb3cc21cf34d247e98` |
| `qa-agency-card-hidden-1440x900.png` | Physical agency floor with station card tucked | `54fbee6cefff4b8297df835b3bfbb27ff2d8c0f75efe0381e48f5250c653d30d` |
| `qa-final-lobby-1280x800.png` | Clean 16:10 lobby | `b73cfe097ec2288efcef060852fe6dc127561ee3713c40a9c87f98659aa3328d` |
| `qa-final-agency-start-1280x800.png` | Campaign start and first quick-start instruction | `9cc7a2b712ae73e03ef5704044b4c2f524595d9a102cfeb965bbf7cf484cb800` |
| `qa-student-registration-1280x800.png` | Student-created pair login and teacher-approval explanation | `9c5102922095c1cc47c2da216094d824f996f0f1664a2bd55943ecb894d24ab1` |

## Release boundary

This record verifies the exact artifact as a release candidate. Production, Supabase data and the OneDrive source were unchanged while gathering this evidence. Final production verification must still exercise the real account Functions, protected routing and production headers. Safari on a student MacBook and school-wifi behaviour remain field uncertainties.
