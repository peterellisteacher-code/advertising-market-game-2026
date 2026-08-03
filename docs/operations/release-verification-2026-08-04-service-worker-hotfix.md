# Service-worker hotfix release verification — 4 August 2026

## Change and cause

- Hotfix commit: `e646c901c75ceae6c5220b66bfad7d3c90837e87`
- Pull request: [#16](https://github.com/peterellisteacher-code/advertising-market-game-2026/pull/16)
- Merge commit on `main`: `a98b323ecfff39ddf8996690f384b27e720213fe`

A fresh production browser profile reached the student login, while a profile carrying the previous `ad-market-*` cache entered the failing update path. The generated service worker deleted the old cache, claimed the active tab and navigated it during startup; the controlled stale-cache reproduction then remained unresponsive for more than 100 seconds.

The hotfix retains complete core pre-caching, SHA-256 verification, `skipWaiting()` and stale-release cache deletion. It removes `clients.claim()` and `client.navigate()` from activation. An open page therefore remains usable while the new release installs, and the new worker controls the next normal navigation.

## Automated evidence

- Focused red/green worker test: 58 of 58 tests passed after the implementation change.
- Full web-build contract command: 133 of 133 tests passed.
- TypeScript: `tsc --noEmit` passed.
- GitHub Actions: [run 30839187567](https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/30839187567), all three jobs passed:
  1. Validate;
  2. Export Godot Web, including Godot tests;
  3. Assemble Complete Web Artifact.
- Complete artifact: ID `8866380781`, archive SHA-256 `e67f9ea0807b425117088ce37ebc9d88aef82a396f3ce705aa23a6e6676a74ad`.
- Release ID: `1f11a1bde8957c92cc0fe03de92a5b38`.
- Cache version: `10a8656f81b1f306a71af06e`.
- Release-manifest SHA-256: `1b88366aa263c2a20f5117d5a4efa260f9f048b1bfdec57a7d861413de6052c5`.
- Generated service-worker SHA-256: `14c11e09bb3ecddfbbc894a17395b7648789f00c1f81a7ef3f9cbb33312c0fc2`.
- Downloaded artifact: 10,246 files, 245,425,061 bytes; `WEB_EXPORT_STATIC_VERIFICATION_OK`.

The changed files are release-builder code and its regression test, not Godot runtime files. Existing GodotIQ static findings therefore remained applicable. Linux Godot CI nevertheless reran the Godot tests and web export for this exact commit. The native Windows Godot editor remained quarantined.

## Hosted QA and production

The exact artifact was deployed first to the unprotected QA project:

- QA deploy: `6a70e02822e8c239b073cd2e`
- QA URL: <https://6a70e02822e8c239b073cd2e--codex-browser-qa-harness.netlify.app>
- Netlify connector state: `ready`, deploy-preview context, 15 Functions, no edge functions.

Playwright at exactly 1280×800 established that a simulated old release cache was removed and the new worker activated in 13.8 seconds while the login remained usable. There was exactly one navigation: the explicit initial navigation. A normal reload then used the new controller. At exactly 1440×900, **Create a pair login** opened the teacher-approval registration form, and reloading that form returned to the main login. The QA project's expected `ACCOUNT_NOT_CONFIGURED` responses were confined to the deliberately unconfigured QA account Functions.

The same artifact was then published to production:

- Production deploy: `6a70e184c924c2d41e2e2d81`
- Production URL: <https://advertising-market-game-2026.netlify.app/student>
- Netlify connector state: `ready` and current, production context, 15 Functions, no edge functions.

Production Playwright evidence included the actual upgrade from the previous cache `a78c990add21a1cea504f5d7`. It reached cache `10a8656f81b1f306a71af06e` in 11.6 seconds, retained the student login, made only the explicit reload and produced no console or page errors. In a fresh 1440×900 profile, the visitor-password page reached the student login in 3.1 seconds, remained stable after 15 seconds, exposed registration, and returned to the main login after a reload. No student account was submitted. The in-app browser independently found the correct production login DOM and an empty console log; its screenshot command timed out at the browser-tool layer, so the exact viewport screenshots below remain the visual evidence.

## Screenshot evidence

The screenshots are retained outside the public source tree in `run-30839187567`.

| File | Evidence | SHA-256 |
|---|---|---|
| `qa-service-worker-update-1280x800.png` | Login remains usable after stale-cache replacement | `acc25f308b7d3ce9aa80d7a0ab86371e3880809a669c9059d0fba60df7c7000f` |
| `qa-registration-1440x900.png` | Student-created pair login and teacher approval | `654a1d0d1b210832ca00d8920a21c1ba31d5926c890ed835491f1cb46c43ad98` |
| `qa-login-after-registration-reload-1440x900.png` | Reload escapes registration to the main login | `dec5883f14352f945e835fdefdf5fec6041e9f9546d13d789a22aa93671b24aa` |
| `production-upgrade-1280x800.png` | Real old-to-new production cache upgrade | `0c53ba6c56b8d7676c6d08aaf0c3091d2b82fdf503121d6d4b63a17c42b78e62` |
| `production-password-to-login-1440x900.png` | Fresh production visitor gate to student login | `18a6e896768facae989fe8f27a3ac03d8d076feecd265945d5d1f979a294994c` |

## Boundaries and residual uncertainty

No Supabase data, real student data, visitor-access rule, production password or OneDrive source file was changed. No native Windows Godot executable was launched. The public GitHub repository and production Netlify site now contain the hotfix. Safari on a student MacBook and school-wifi behaviour remain final field uncertainties.
