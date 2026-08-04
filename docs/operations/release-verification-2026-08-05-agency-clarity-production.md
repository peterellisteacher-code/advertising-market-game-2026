# Agency clarity production verification — 5 August 2026

## Released source and artifact

- Public repository: <https://github.com/peterellisteacher-code/advertising-market-game-2026>
- Pull request: [#18](https://github.com/peterellisteacher-code/advertising-market-game-2026/pull/18)
- Merged `main` commit: `68f67fd10b44d6e57a2289df2d89b968ceed4772`
- GitHub Actions run: [30930670734](https://github.com/peterellisteacher-code/advertising-market-game-2026/actions/runs/30930670734)
- Complete web artifact: ID `8901315610`; 10,246 files
- Release manifest SHA-256: `c2e103df840330de364c811044bb2e02a8e8cad191ad87724561e73d0d034780`
- `index.pck` SHA-256: `ce46d4c4f9f2bbc00d0a155242b4d9bec346a2e86f5f17dfd1ad637eb1a8c79c`
- `index.wasm` SHA-256: `35116f68540ac41acf7d71ea457added91b5e960a9cca3e2acc72918eaf01277`

The run completed all three jobs successfully: **Validate**, **Export Godot Web**, and **Assemble Complete Web Artifact**. The retained stable-candidate evidence also records TypeScript type-checking, 2,391 passing Vitest tests, 136 passing web-build tests, and 32 passing bridge/onboarding contracts. Inputs to those checks did not change before production deployment, so the green suites were not repeated.

## Production deploy

- Site: <https://advertising-market-game-2026.netlify.app>
- Site ID: `fffc6f57-3fd2-44e3-9247-05a5f746351d`
- Production deploy: `6a721bcead831f15180b44f9`
- Published: 4 August 2026 at 17:05:44 UTC
- Netlify state rechecked through the connector on 5 August: `ready`
- Deploy contents: 15 Functions, 5 redirects and 5 header rules

The existing visitor-password setting was retained. No access-control change was made.

## Hosted browser verification

The production site was exercised in the in-app Browser after the deploy, at exact page viewports of 1280×800, 1440×900 and 1920×1080.

### Student access

- `/student` completed its account check and exposed both **Log in** and **Create a pair login**.
- Pointer activation opened registration. The form explains that teacher approval is required and provides **Back to log in**.
- A synthetic invalid login produced an inline credential message; registration remained available.
- Reload after the invalid login reconstructed the clean main login page rather than preserving a trapped error view.
- Three consecutive production reloads reached the ready login form in 1,620 ms, 1,839 ms and 1,480 ms.
- At 1920×1080, the document measured exactly 1920×1080 with no document overflow; the 480×536.25 account panel remained fully inside the viewport.

No pair account was created and no real student credentials were entered.

### Teacher playtest and game guidance

- The authenticated teacher dashboard and isolated `/teacher/playtest` route opened successfully.
- Quick start presents four short pages. The role page states the Strategist's and Art Director's literal responsibilities and makes clear that both partners have the same controls.
- The final **Go to Client Briefing** action was fully visible at 1280×800 and 1440×900. A pointer click moved the pair to Client Briefing and selected **Start task: Read the audience before making anything**.
- The first task presented one action at a time. **Show pair roles** opened and closed by pointer and gave the waiting partner a stated job.
- **Show work details**, the room card, the full guide and the teacher controls each opened and tucked successfully.
- At 1920×1080, the document measured exactly 1920×1080; the game canvas measured 1919×1079 and the compact teacher strip remained within the viewport.

The browser console contained no error entries. Its only warning was the expected HTTP 401 diagnostic produced by the deliberate invalid-login probe. Godot Web started with WebGL 2 and reported the expected single-threaded Emscripten build.

## Screenshot evidence

Screenshots are retained outside the public source tree under `C:\Godot Projects\Advertising Market Game QA\run-30930670734\screenshots`.

| File | Evidence | SHA-256 |
|---|---|---|
| `production-registration-1280x800.png` | Student self-registration and teacher-approval explanation | `7f2edcb71b209d56ff6356493e54bc492970cec127af267a53dfcea0cbbae620` |
| `production-student-after-three-reloads-1440x900.png` | Clean student entry after the bounded reload check | `9580ab6103ad7823b384fa15ca2dbcefa3ba4b7796343010bb8fc380afc6533f` |
| `production-quick-start-page-4-clipped-1280x800.png` | Final quick-start action fully visible at 1280×800 | `07b6337f586244a3c38e61532b46212aa5b283e007879a49306b3a1658c45ebd` |
| `production-quick-start-page-4-1440x900.png` | Final quick-start action fully visible at 1440×900 | `1e5f87a9bd40be714822844754f2277e4bb47b2b62da14fffec5bf5c1124b412` |
| `production-after-go-to-client-briefing-1440x900.png` | Successful pointer navigation to the first room | `e22339e7179d4d9fa59830e756e86d88aea36c3ace967d525f91fe532ce5d1a6` |
| `production-first-task-role-help-1280x800.png` | Contextual pair-role explanation | `470f1eb4b66e03255919e9ceb119efe6365d23f07ab9b230a8b378f47cfe1aab` |
| `production-hud-and-card-tucked-1280x800.png` | Compact HUD and tucked room card with restore control | `e45fcdec84cedbb7ec2f011362884a6a3311731d965a4fa53e5a38f4c49db748` |
| `production-client-briefing-fullpage-1920x1080.png` | Exact 1920×1080 wide production playtest | `97dac6bcf7923c300293683afec41b236db2788e539ad3a7b64e3ab46727b856` |

## Boundaries and remaining field checks

- No Supabase configuration, schema, Edge Function or classroom-account mutation was performed during this verification.
- No production visitor-access change was made.
- The OneDrive source was not modified.
- No native Windows Godot executable was launched by this workflow. Linux Godot CI and the verified web artifact supplied runtime evidence.
- GodotIQ static readiness was established, but project-changing GodotIQ calls were correctly withheld because its active root resolved to a separate dirty checkout rather than this clean release worktree.
- The public repository remains the deliberate sanitised source. Screenshots, raw reviews, panel transcripts, credentials, private-history safety material and internal temporary artifacts remain outside it.
- Safari on a student MacBook and real school-wifi behaviour remain field uncertainties. The hosted Chromium/WebGL checks do not replace those classroom conditions.
