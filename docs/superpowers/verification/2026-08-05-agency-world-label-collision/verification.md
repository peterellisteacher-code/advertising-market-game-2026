# Agency world label and collision — production verification

## Release identity

- Merged pull request: [#21](https://github.com/peterellisteacher-code/advertising-market-game-2026/pull/21)
- Production source commit: `61bf83787712318a699743a4058044b4e85ca50a`
- Main workflow: [30965354696](https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/30965354696)
- Verified artifact: `advertising-market-game-web`, artifact `8914693309`, SHA-256 `4ec11d8a6bb266dd2d98dca07db8e88c407e96f63e5eebcdfec14e59274a2de8`
- Netlify production deploy: `6a7290b141feae1b83d207c0`
- Production URL: <https://advertising-market-game-2026.netlify.app>
- Immutable deploy URL: <https://6a7290b141feae1b83d207c0--advertising-market-game-2026.netlify.app>
- Hosted release-manifest ID: `4013951682eb3b5689581f34e21ce652`
- Hosted `index.pck` SHA-256: `7ee02b4a93e756c2df2156fcddfdd6e6b9be01a05930b55c39a465cbc6c1cd28`

The hosted release-manifest ID and `index.pck` digest matched the downloaded, workflow-verified artifact.

## Automated evidence

- Focused source contract: 12 passed, 0 failed.
- Full local web-build contracts: 143 passed, 0 failed.
- Branch workflow `30964630688`: validation, Linux Godot runtime/export and complete artifact assembly passed.
- Main workflow `30965354696`: validation, Linux Godot runtime/export and complete artifact assembly passed.
- The Linux Godot test asserts all nine direct-arrival positions, full character-capsule clearance at Client Briefing and a real `PhysicsServer2D.body_test_motion` collision against the fixture.

## Hosted browser QA

Reference surface: production `/teacher/playtest`, signed-in isolated teacher playtest, keyboard plus mouse/trackpad.

Verified:

- Direct travel placed both characters below the Client Briefing fixture, not on the wall, shelf or plant.
- The highlighted station showed one compact, backed `Client briefing` label.
- No floating Art Director, Strategist or station-owner role labels remained above the characters.
- The room card remained legible and could be tucked by click.
- The tucked control read `Open Client briefing`.
- Twenty-four upward-arrow inputs stopped the characters below the fixture.
- The current-room accessibility mirror reported `Client briefing`.
- The production console contained no warnings or errors from the hosted origin.
- The teacher-control button bounds remained inside the 1920-pixel viewport.

The first reload immediately after deployment was still controlled by the outgoing service worker and briefly rendered the previous release. Its controller-change refresh replaced that tab. All findings and screenshots below come from a fresh tab that served the matching hosted release manifest.

### Viewports and screenshots

| Viewport under test | Evidence | File output |
| --- | --- | --- |
| 1280×800 | Room/card visible after collision check | [`1280x800-client-briefing.png`](1280x800-client-briefing.png) — 1280×800, SHA-256 `6420c2a78f68764d05178b3c601a51660afd395ce04fdf0532bd550ef29863cb` |
| 1280×800 | Card tucked | [`1280x800-client-briefing-tucked.png`](1280x800-client-briefing-tucked.png) — 1280×800, SHA-256 `d777ba513182d30914967b61c74fe8f1c1ecbbca8449813e1d3a02989d2a8670` |
| 1280×800 | After repeated upward movement | [`1280x800-client-briefing-collision.png`](1280x800-client-briefing-collision.png) — 1280×800, SHA-256 `4dd4224a22573df048842db81d4d1530cc0b866ce22d374e176d49b82ac26200` |
| 1440×900 | Direct-arrival view/card visible | [`1440x900-client-briefing.png`](1440x900-client-briefing.png) — 1440×900, SHA-256 `8ef04d432b71727c4bd1f1891a2c19f9af577545b44b006d4bcfe32ddd273337` |
| 1920×1080 | Room/card visible after collision check | [`1920x1080-client-briefing.png`](1920x1080-client-briefing.png) — viewport verified at 1920×1080; in-app capture output was 1836×1080, SHA-256 `344ba12e5b0d9a7fd5872affab2cc57fe7c88642a48489405d16c23457c56622` |
| 1920×1080 | Card tucked | [`1920x1080-client-briefing-tucked.png`](1920x1080-client-briefing-tucked.png) — viewport verified at 1920×1080; in-app capture output was 1836×1080, SHA-256 `8a48467585e4104b67fbc8391802e75f858659e19f2ec87c6f60ae1a5d0ccaef` |

## Preserved boundaries and remaining field checks

- Supabase and production data were unchanged.
- Netlify visitor-access settings were unchanged.
- OneDrive sources were unchanged.
- No native Windows Godot executable was launched.
- No files or directories were deleted or cleaned up.
- Safari on a student MacBook and the school-wifi path remain field checks; they were not available in this release session.
