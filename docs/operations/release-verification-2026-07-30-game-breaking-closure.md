# Game-breaking closure release verification — 30 July 2026

## Release identity

- Sanitized public source commit:
  `463ff57381158bdc84b3409589e0705f3b73bed0`
- Authoritative implementation commit before this record:
  `3eccb1a10e830f5b85163a099e41aa152162fa71`
- Release ID: `704bb6ac6954eed61bdb63e77a8c72e2`
- Release-manifest SHA-256:
  `64D5778E38EBF482B11F1DE604FE812923883ADE8AF38CE67728CF7688A84483`
- Godot PCK SHA-256:
  `CE0C4A508643BE2BC0621935AC04511824752354F00AF1A27997E463B7D01C38`
- Godot WASM SHA-256:
  `35116F68540AC41ACF7D71EA457ADDED91B5E960A9CCA3E2ACC72918EAF01277`

GitHub workflow run `30559431114` completed successfully at the exact public
source commit. Its Validate, Export Godot Web and Assemble Complete Web
Artifact jobs all passed. Artifact `8766565148`,
`advertising-market-game-web`, is 207,472,509 bytes and has GitHub digest
`sha256:96ee56183c0533c15eef1ef4cccad3b9e977ca5f22bfd980ff6b23d9088aabe2`.

The downloaded artifact passed `WEB_EXPORT_STATIC_VERIFICATION_OK`.

## Godot verification

GodotIQ Pro 0.5.15 was bound to the authoritative Godot root. Its project
summary found 59 scripts, 11 scenes and 22 assets. Validation of
`res://src/main/main.gd` found zero convention issues across the target, with
59 scripts discovered and the add-on directory excluded.

The native editor was closed, so live-editor error inspection was unavailable.
No Windows Godot executable was launched and no GodotIQ port was allocated or
changed. The Linux GitHub job imported the project, ran the Godot tests and
exported the web build successfully.

## Hosted QA draft

- QA site ID: `8edde91e-88ad-4a96-a49b-ddb8470d27c0`
- QA deploy ID: `6a6b78d6e9b390302b65efd7`
- QA URL:
  `https://6a6b78d6e9b390302b65efd7--codex-browser-qa-harness.netlify.app`

The connector reported the unprotected deploy as ready, with 15 Functions,
five redirects and five header rules. HTTP probes returned 200 for `/student`,
`/teacher` and `/release-manifest.json`. `/api/account/session` returned the
expected 503 `ACCOUNT_NOT_CONFIGURED` result because this isolated QA project
does not hold the production Supabase configuration.

At an exact 1280-by-800 browser viewport, `/student` rendered the Ad Market
welcome screen, username and password inputs, and the login control. The
visible unavailable-account message and the matching console response came
from the expected absent QA configuration.

The in-app browser screenshot command timed out twice. The documented
fresh-tab recovery then failed with `target closed while handling command`.
Browser work stopped at that tool boundary. No candidate screenshot was
written to `C:\tmp\admarket-qa-evidence-463ff57`, and the exact 1440-by-900
visual check remains unmeasured.

## Production publication

- Netlify project ID: `fffc6f57-3fd2-44e3-9247-05a5f746351d`
- Production deploy ID: `6a6b7ad62a7eeecb6d4fef1c`
- Production URL:
  `https://advertising-market-game-2026.netlify.app`
- Student URL:
  `https://advertising-market-game-2026.netlify.app/student`
- Teacher URL:
  `https://advertising-market-game-2026.netlify.app/teacher`

The same downloaded artifact was deployed to production without a rebuild.
The Netlify connector read the deploy back as current and ready, with 15
Functions, five redirects and five header rules.

All-project visitor password protection was enabled. Unauthenticated requests
to `/`, `/student`, `/teacher`, `/api/account/session` and
`/release-manifest.json` returned 401. The configured classroom password was
then exercised through the Netlify form: the POST returned 302, Netlify issued
the site cookie, and authenticated GET requests to `/student`, `/teacher`,
`/release-manifest.json` and `/api/account/session` all returned 200.

The hosted manifest SHA-256 exactly matched the downloaded artifact. The live
account-session response was `{"authenticated":false}`, confirming that the
production account Function is configured while leaving all classroom
accounts unchanged.

## Repository and external-state record

The public repository has one history-free commit. Local `main` and remote
`main` both resolve to `463ff57381158bdc84b3409589e0705f3b73bed0`; the public
worktree is clean and the repository synchronization contract passed.

Production changed only through deploy `6a6b7ad62a7eeecb6d4fef1c` and the
explicitly authorized visitor-password setting. Supabase data and
configuration were not mutated. The OneDrive source was not changed. The
GodotIQ allocation ledger and project port configuration were not changed.

Safari on a school MacBook, the school-wifi path and the missing exact
1440-by-900 screenshot remain field uncertainties.
