# Independent account and cloud-progress security review evidence

## Neutral review task

Perform a fresh, read-only, adversarial review of the current mandatory account gate, per-account local persistence, private cloud-progress and account-asset transport, recovery and synchronisation lifecycles, Netlify server functions, and proposed Supabase migration for the Advertising Market Game. You have no prior review context. Do not edit files. Try to falsify the acceptance requirements below using concrete code evidence and, where useful, read-only local tests or counterexamples.

Return:

1. findings ordered by severity, with absolute file paths and line numbers;
2. confirmed invariants that survived attack;
3. claims that remain unverified until live deployment;
4. a terminal verdict of `SURVIVES` or `DOES NOT SURVIVE`.

## Product and trust boundaries

- This is a classroom Godot web game hosted through Netlify.
- A student pair creates its own username and password; a teacher-held classroom code authorises signup.
- The game surface must remain hidden and inert until authentication and account-scoped storage activation succeed.
- The browser autosaves locally first and queues private cloud synchronisation. Local progress must remain usable during transient cloud failure.
- Cloud progress and account-uploaded raster assets are private per authenticated account.
- Supabase service credentials must remain server-only and must never be sent across a redirect.
- Browser account/progress/asset calls must reject redirects and bound response bodies without trusting `Content-Length`.
- Authentication expiry discovered by account, progress, asset, recovery, or sync paths must fail closed, isolate the activated store, and return to the locked account boundary.
- Only practice/offline documents may be cloud-saved; live-room documents must not enter account progress.
- Cloud documents must be canonical `CampaignDocumentV1` data with matching identity, offline mode, no room binding, bounded revisions, no transient Fabric `blob:` sources, and exact durable local/cloud raster descriptor pairs.
- Cloud-only recovery must verify all restored blobs, import the document and related local state atomically, then seed compare-and-swap metadata.
- Compare-and-swap revision metadata must remain isolated per account yet survive ordinary logout, return to the same account, and switches between accounts on one classroom computer. A returning local draft must not require a cloud lookup merely to recover its last acknowledged server revision.
- Existing Signal Lost Supabase objects must not be modified. The proposed migration may create only `advertising_game` progress objects and the named public RPC, with least-privilege ownership, grants, and RLS. Its operation contract must reject null and unknown operations.
- No live migration or deployment has occurred yet.

## Primary implementation evidence

Inspect at minimum:

- `web/src/main.ts`
- `web/src/account/account-bootstrap.ts`
- `web/src/account/account-client.ts`
- `web/src/account/account-asset-client.ts`
- `web/src/account/account-gate.ts`
- `web/src/account/account-storage-namespace.ts`
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

Inspect adjacent tests as executable contracts, especially account client, asset client, gate, sync lifecycle, recovery, account-scoped database, atomic cloud import, Netlify functions, backend, progress-document, main integration, and build-contract tests.

## Current local verification evidence

- Strict TypeScript: `tsc --noEmit` exited 0.
- Full Vitest: 115 files, 1,767 tests passed.
- Production build-contract suite: 60 of 60 tests passed.
- A prior unchanged Godot bridge/game run reached its explicit success line; its deliberate malformed-base64 validation case and shutdown leak/resource warnings are outside this account/cloud change but may be assessed for relevance.

## Review constraints

- Read-only: no changes, migrations, network mutations, deployments, commits, cleanup, or secret access.
- Treat tests as evidence, not proof; inspect implementation paths and construct counterexamples where warranted.
- Do not infer live Supabase or Netlify state from source. Separate live-only unknowns explicitly.
- This evidence contains no student-identifying data or credentials.
