# Advertising Market account system — final review evidence

## Neutral review question

Is the current account, account-scoped persistence, cloud progress, and private cloud-asset implementation safe and internally coherent enough to apply its Supabase migration and proceed to live Netlify configuration? Identify concrete correctness, privacy, security, data-loss, cross-account, recovery, or integration defects. Classify each finding by severity and cite exact file and line evidence. If a claim cannot be verified from this evidence, mark it unverified rather than assuming it.

## Required behaviour

- The game remains inaccessible until a valid username/password session is established. Signup also requires the teacher's classroom code.
- Each validated username receives a separate opaque IndexedDB namespace. One account must never read, resume, save, upload, restore, or enqueue another account's work.
- Local persistence completes before cloud enqueue. Cloud/network failure must not invalidate the local save.
- Only offline practice campaign documents may be cloud-saved or cloud-restored. Live-room documents are excluded.
- Cloud progress uses authenticated caller identity and compare-and-swap server revisions. Conflicts preserve local work.
- Every referenced local PNG/JPEG/WebP blob is validated and uploaded to private account storage before its progress JSON. Progress JSON carries descriptors rather than bodies or object URLs.
- A fresh computer may discover the newest authenticated cloud save. Recovery occurs only if the active account has no valid local practice checkpoint, downloads and verifies all referenced assets first, then imports the exact document, blobs, checkpoint, operation, and run atomically. Server CAS metadata is seeded only after successful import.
- Cloud recovery must not claim to reconstruct unavailable historical state. It uses the current account username as team alias, a fresh local continuation token, document revision as the established local operation sequence, and an unlocked UI state.
- Logout or authentication expiry immediately locks game and creator surfaces, fences queued cloud work, isolates local work, and reloads before a different identity can enter.
- Supabase objects are confined to the `advertising_game` schema and named public RPC. Existing `signal_lost` objects in the shared project must not be modified. Database execution is service-role-only; browser code must never receive a Supabase service key.
- Account and asset endpoints are same-origin, exact-contract, size-bounded, and fail closed on malformed or redirected responses.

## Source evidence

Review these files in their current immutable state:

- `web/src/account/account-client.ts`
- `web/src/account/account-asset-client.ts`
- `web/src/account/account-gate.ts`
- `web/src/account/account-bootstrap.ts`
- `web/src/account/cloud-progress-sync.ts`
- `web/src/account/cloud-asset-adapter.ts`
- `web/src/account/cloud-progress-recovery.ts`
- `web/src/persistence/draft-store.ts`
- `web/src/persistence/account-scoped-draft-store.ts`
- `web/src/persistence/serialized-autosave.ts`
- `web/src/persistence/local-practice-service.ts`
- `web/src/main.ts`
- `netlify/functions/account-session.mts`
- `netlify/functions/account-progress.mts`
- `netlify/functions/account-assets.mts`
- `netlify/functions/lib/account-primitives.ts`
- `netlify/functions/lib/account-backend.ts`
- `netlify/functions/lib/account-assets.ts`
- `netlify/functions/lib/netlify-account-assets.ts`
- `docs/operations/advertising-game-account-progress.sql`
- `docs/operations/advertising-game-account-progress.md`
- `netlify.toml`
- the corresponding `*.test.ts` files beside the source files above

## Verification evidence

Commands completed from the project root on 2026-07-17:

- `vitest run --no-cache --configLoader runner`: 114 files, 1,739 tests passed, exit 0.
- `tsc --noEmit --pretty false`: exit 0.
- Node production build-contract suite: 60 tests passed, exit 0.
- Godot headless `res://tests/run_tests.gd`: terminal line `Godot game, Creator bridge, and Market bridge tests passed`; its deliberate malformed-base64 negative test emits the expected engine error, with pre-existing exit leak warnings.

No Supabase migration, Netlify deployment, hosted synthetic-email signup, or live endpoint test has yet occurred. Those are deliberately outside the claim under review.
