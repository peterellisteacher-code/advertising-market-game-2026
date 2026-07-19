# Independent account and cloud-progress security review evidence

## Neutral review task

Perform a fresh, read-only, adversarial review of the current account gate, per-account local persistence, private cloud-progress transport, private account-asset transport, recovery path, Netlify server functions, and proposed Supabase migration for the Advertising Market Game. Do not edit files. Do not rely on any prior review or conversation. Try to falsify the acceptance requirements below using concrete code evidence and, where useful, read-only local tests or reproductions.

Return:

1. findings ordered by severity, with absolute file paths and line numbers;
2. confirmed invariants that survived attack;
3. claims that remain unverified until live deployment;
4. a terminal verdict of `SURVIVES` or `DOES NOT SURVIVE`.

## Product and trust boundaries

- This is a classroom Godot web game hosted through Netlify.
- A student pair creates its own username and password, and a teacher-held classroom code authorises signup.
- The game surface must remain hidden and inert until account authentication and account-scoped storage activation both succeed.
- The browser autosaves locally first and queues private cloud synchronisation. Local progress must remain usable through transient cloud failure.
- Cloud progress and account-uploaded raster assets are private per authenticated account.
- Supabase service credentials must remain server-only and must never be sent across a redirect.
- Browser account/progress/asset calls must reject redirects and bound response bodies without trusting `Content-Length`.
- Authentication expiry discovered by any account, progress, asset, recovery, or synchronisation path must fail closed, isolate the activated account store, and return the locked shell to login.
- Practice/offline documents may be cloud-saved. Live-room documents must never be cloud-saved through this account-progress system.
- Saved documents must be canonical `CampaignDocumentV1` data: correct document identity and revision; offline mode; no room identifier; and every local raster reference that requires private restoration must have one consistent cloud descriptor. Fabric image sources for those blobs must remain durable `local-blob:` references rather than browser object URLs.
- Cloud-only recovery must verify restored blobs, import the document and all related state atomically into the account-scoped IndexedDB database, then seed compare-and-swap metadata.
- Existing Signal Lost Supabase objects are out of scope and must not be modified. The proposed migration must create only `advertising_game` progress objects and the named public RPC, with least-privilege ownership/grants/RLS.
- No live migration or deployment has occurred yet.

## Primary implementation evidence

Inspect at minimum:

- `web/src/main.ts`
- `web/src/account/account-bootstrap.ts`
- `web/src/account/account-client.ts`
- `web/src/account/account-asset-client.ts`
- `web/src/account/account-gate.ts`
- `web/src/account/cloud-asset-adapter.ts`
- `web/src/account/cloud-progress-recovery.ts`
- `web/src/account/cloud-progress-sync.ts`
- `web/src/persistence/account-scoped-draft-store.ts`
- `web/src/persistence/draft-store.ts`
- `web/src/domain/campaign-document.ts`
- `netlify/functions/account-session.mts`
- `netlify/functions/account-progress.mts`
- `netlify/functions/account-assets.mts`
- `netlify/functions/lib/account-backend.ts`
- `netlify/functions/lib/account-progress-document.ts`
- `netlify/functions/lib/account-assets.ts`
- `netlify/functions/lib/netlify-account-assets.ts`
- `docs/operations/advertising-game-account-progress.sql`
- `docs/operations/advertising-game-account-progress.md`
- `godot/web/godot_shell.html`
- `netlify.toml`

Inspect the adjacent tests as executable contracts, especially account client, asset client, gate, sync, recovery, persistence import, Netlify function, backend, progress-document, main integration, and build-contract tests.

## Current local verification evidence

- Strict TypeScript: `tsc --noEmit` exited 0.
- Full Vitest: 115 files, 1,762 tests passed.
- Production build-contract suite: 60 of 60 tests passed.
- Godot bridge/game tests reached their explicit success line. The run also emitted the existing deliberate malformed-base64 validation error and shutdown leak/resource warnings; assess whether either changes this account/cloud review.

## Review constraints

- Read-only: make no changes, migrations, network mutations, deployments, commits, cleanup, or secret access.
- Treat tests as evidence, not proof; inspect implementation paths and construct counterexamples where warranted.
- Do not infer live Supabase or Netlify state from local source. Separate unverified live-only claims explicitly.
- This evidence contains no student-identifying data or credentials.
