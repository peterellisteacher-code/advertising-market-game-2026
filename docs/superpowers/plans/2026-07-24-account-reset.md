# Account Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated pair erase only its Advertising Market Game progress and assets by typing `RESET`, while preserving its username, password, authentication identity, and every other account.

**Architecture:** Implement a replay-safe reset saga keyed by an operation UUID. The server authenticates the existing session, deletes progress through the private service-role RPC, deletes only exact keys from the account’s validated bounded asset index, and returns success only when both stores are empty. The client quiesces autosave across tabs, retries the same operation ID after partial failure, and clears only account-scoped local stores after confirmed server completion.

**Tech Stack:** TypeScript, Netlify Functions, Netlify Blobs, Supabase RPC migration source, IndexedDB, localStorage/sessionStorage, BroadcastChannel-compatible mutation bus, DOM Testing Library, Vitest, and Node build-contract tests.

## Global Constraints

- The required confirmation is the exact uppercase word `RESET`.
- Reset preserves username, password, user ID, session cookies, and authentication identity.
- Reset removes only the authenticated account’s progress, drafts, designs, uploaded game assets, outbox, cloud revision metadata, Image Lab pending state, and Studio Coach session state.
- No live Supabase mutation occurs; update and test migration source only.
- Never call `deleteAll`, delete a prefix, list an unbounded store, or delete a key not returned by the validated authenticated account index.
- Missing progress rows, blobs, or index keys count as successful replay.
- A partial server reset remains retryable with the same operation UUID; local data is not cleared until server success.
- The classroom-NAT-safe rate-limit floor is at least `windowLimit: 300`, `windowSize: 60`, `aggregateBy: ["ip", "domain"]`.
- Production remains unchanged.

---

### Task 1: Extend the private progress RPC with reset

**Files:**
- Modify: `netlify/functions/lib/account-backend.ts`
- Modify: `supabase/functions/advertising-game-backend/handler.ts`
- Modify: `docs/operations/advertising-game-account-progress.sql`
- Test: `netlify/functions/lib/account-backend.test.ts`
- Test: `netlify/functions/lib/account-operation-artifacts.test.ts`
- Test: Supabase edge-handler tests adjacent to `handler.ts`.

**Interfaces:**
- Consumes: `{ operation: "reset", document: null, baseRevision: null }`.
- Produces: `{ status: "reset" }` from `advertising_game_progress_rpc`.

- [ ] **Step 1: Write failing contract tests**

Add:

```ts
expect(await client.progressRpc(identity, {
  operation: "reset",
  document: null,
  baseRevision: null
})).toEqual({ status: "reset" });
```

Assert the SQL contains:

```sql
delete from public.advertising_game_progress
where user_id = p_user_id;
```

and still contains:

```sql
security definer
set search_path = ''
revoke all on function public.advertising_game_progress_rpc from public, anon, authenticated;
grant execute on function public.advertising_game_progress_rpc to service_role;
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:

```powershell
pnpm exec vitest run netlify/functions/lib/account-backend.test.ts netlify/functions/lib/account-operation-artifacts.test.ts --no-cache --configLoader runner
```

Expected: FAIL because `reset` is outside the operation union and absent from SQL.

- [ ] **Step 3: Extend exact types and parsing**

Use:

```ts
export type ProgressRpcInput =
  | { operation: "load"; document: null; baseRevision: null }
  | { operation: "save"; document: CloudProgressDocument; baseRevision: number | null }
  | { operation: "reset"; document: null; baseRevision: null };
```

Reject non-null reset documents/revisions. Extend the response parser to accept only `{ status: "reset" }` for reset.

- [ ] **Step 4: Add transactional SQL reset**

Under the existing per-user advisory lock, delete the authenticated user’s progress row(s) and return:

```sql
return jsonb_build_object('status', 'reset');
```

Do not apply the SQL to live Supabase.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run the Task 1 tests plus the edge-handler tests. Expected: all pass.

### Task 2: Add bounded exact-key asset cleanup

**Files:**
- Modify: `netlify/functions/lib/account-assets.ts`
- Modify: `netlify/functions/lib/netlify-account-assets.ts`
- Test: `netlify/functions/lib/account-assets.test.ts`
- Test: `netlify/functions/lib/netlify-account-assets.test.ts`

**Interfaces:**
- Consumes: one authenticated `userId` and its validated `AccountAssetIndex`.
- Produces: `AccountAssetResetPlan` with exact object keys and exact index key; replay-safe `executeReset(plan): Promise<void>`.

- [ ] **Step 1: Write failing service tests**

```ts
const plan = await service.planReset("user-1");
expect(plan.objectKeys).toEqual([
  "accounts/derived-user-1/assets/digest-a",
  "accounts/derived-user-1/assets/digest-b"
]);
expect(plan.indexKey).toBe("accounts/derived-user-1/index.json");
await service.executeReset(plan);
expect(repository.deletedKeys).toEqual([...plan.objectKeys, plan.indexKey]);
```

Also prove a malformed or over-limit index causes no deletion and a missing index produces an empty replay-safe plan.

- [ ] **Step 2: Run focused tests and confirm RED**

Run the two account-asset test files. Expected: FAIL because repository delete methods and reset plan are absent.

- [ ] **Step 3: Add exact repository methods**

Extend the interface:

```ts
deleteObject(namespace: string, digest: string): Promise<void>;
deleteIndex(namespace: string): Promise<void>;
```

Add:

```ts
export interface AccountAssetResetPlan {
  readonly namespace: string;
  readonly objectDigests: readonly string[];
}
```

`planReset` must validate the bounded index before returning digests. `executeReset` calls `deleteObject` for each digest and `deleteIndex` last.

- [ ] **Step 4: Implement Netlify Blob deletes**

Extend the injected Blob store with:

```ts
delete(key: string): Promise<void>;
```

Call `store.delete(accountAssetObjectKey(namespace, digest))` and `store.delete(accountAssetIndexKey(namespace))`. Treat missing keys as success. Do not enumerate or delete a prefix.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Expected: all account asset tests pass, including exact deletion order and malformed-index fail-closed cases.

### Task 3: Implement the authenticated reset endpoint

**Files:**
- Create: `netlify/functions/account-reset.mts`
- Create: `netlify/functions/account-reset.test.ts`
- Create: `netlify/deploy-functions/account-reset.mts`
- Modify: `netlify.toml`
- Modify: `scripts/build-netlify-functions.test.mjs`
- Modify: deploy-layout contract tests.

**Interfaces:**
- Consumes: authenticated same-origin `POST /api/account/reset` with:

```ts
{
  schema: "advertising-game-account-reset";
  version: 1;
  operationId: string;
  confirmation: "RESET";
}
```

- Produces: `{ status: "reset", operationId }` or a bounded retryable incomplete response.

- [ ] **Step 1: Write failing endpoint tests**

Cover:

```text
405 for non-POST
403 for cross-origin mutation
401 for missing/invalid session
400 for extra keys, wrong schema/version, non-UUID operationId, or confirmation other than RESET
409 retryable incomplete when asset cleanup fails after progress reset
200 reset when progress and exact assets are empty
200 reset when the same operation is replayed
```

Assert that asset planning happens before progress deletion and the asset index is deleted last.

- [ ] **Step 2: Run endpoint tests and confirm RED**

Run:

```powershell
pnpm exec vitest run netlify/functions/account-reset.test.ts --no-cache --configLoader runner
```

Expected: FAIL because the endpoint is absent.

- [ ] **Step 3: Implement strict request parsing**

Use an exact-key guard:

```ts
const RESET_KEYS = ["confirmation", "operationId", "schema", "version"] as const;
```

Require a canonical UUID, exact schema/version, and `confirmation === "RESET"`. Resolve the existing session and verify `x-admarket-account` against its username before planning deletions.

- [ ] **Step 4: Implement ordered replay-safe saga**

Use:

```ts
const plan = await assets.planReset(session.identity.id);
await accounts.progressRpc(session.identity, {
  operation: "reset",
  document: null,
  baseRevision: null
});
await assets.executeReset(plan);
```

Return success only after all three awaits complete. Map post-progress asset failure to a stable retryable code without exposing raw error text.

- [ ] **Step 5: Add route and deploy wrapper**

Map:

```toml
from = "/api/account/reset"
to = "/.netlify/functions/account-reset"
status = 200
force = true
```

Ensure the release function builder includes `account-reset.mts` and no development-only module.

- [ ] **Step 6: Run endpoint and build-contract tests and confirm GREEN**

Run:

```powershell
pnpm exec vitest run netlify/functions/account-reset.test.ts netlify/functions/lib/account-assets.test.ts netlify/functions/lib/netlify-account-assets.test.ts netlify/functions/lib/account-backend.test.ts --no-cache --configLoader runner
node --test scripts/build-netlify-functions.test.mjs
```

Expected: all pass.

### Task 4: Add account-scoped client cleanup and retry state

**Files:**
- Create: `web/src/account/account-reset-coordinator.ts`
- Create: `web/src/account/account-reset-coordinator.test.ts`
- Modify: `web/src/account/account-client.ts`
- Modify: `web/src/account/account-client.test.ts`
- Modify: `web/src/account/account-identity-binding.ts`
- Modify: `web/src/account/account-identity-binding.test.ts`
- Modify: `web/src/account/cloud-progress-sync.ts`
- Modify: `web/src/account/cloud-progress-outbox.ts`
- Modify: `web/src/persistence/account-scoped-draft-store.ts`
- Modify: `web/src/ai-image/browser-image-lab-submission-persistence.ts`
- Modify: `web/src/studio-coach/studio-coach-runtime.ts`
- Test: `web/src/account/account-client.test.ts`
- Test: `web/src/account/account-identity-binding.test.ts`
- Test: `web/src/account/cloud-progress-sync.test.ts`
- Test: `web/src/account/cloud-progress-outbox.test.ts`
- Test: `web/src/persistence/account-scoped-draft-store.test.ts`
- Test: `web/src/ai-image/browser-image-lab-submission-persistence.test.ts`
- Test: `web/src/studio-coach/studio-coach-runtime.test.ts`

**Interfaces:**
- Consumes: authenticated username, exact operation UUID, and injected account stores.
- Produces: `reset(): Promise<"reset">`, same-account reset-pending/complete mutation events, and exact namespace cleanup after server success.

- [ ] **Step 1: Write failing HTTP client tests**

Assert:

```ts
await client.reset({
  operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  confirmation: "RESET"
});
expect(fetcher).toHaveBeenCalledWith("/api/account/reset", expect.objectContaining({
  method: "POST",
  redirect: "error"
}));
```

Inspect the JSON body for exactly the four contract keys and account-identity header.

- [ ] **Step 2: Write failing coordinator tests**

Prove:

```text
reset-pending is persisted and broadcast before network call
autosave/sync quiesce before network call
failed request retains local data and operation UUID
retry reuses the same UUID
server success clears only the active account stores
reset-complete broadcasts after cleanup
authentication client logout is never called
```

- [ ] **Step 3: Write failing storage-isolation tests**

With fake IndexedDB/storage, seed account A and account B. Assert `resetAccount("account-a")` deletes only A’s draft DB, outbox DB, cloud metadata, Image Lab v2 keys, and Studio Coach v3 keys.

- [ ] **Step 4: Run client tests and confirm RED**

Run:

```powershell
pnpm exec vitest run web/src/account/account-reset-coordinator.test.ts web/src/account/account-client.test.ts web/src/account/account-identity-binding.test.ts web/src/account/cloud-progress-sync.test.ts web/src/account/cloud-progress-outbox.test.ts web/src/persistence/account-scoped-draft-store.test.ts web/src/ai-image/browser-image-lab-submission-persistence.test.ts web/src/studio-coach/studio-coach-runtime.test.ts --no-cache --configLoader runner
```

Expected: FAIL on the missing reset API and account-scoped cleanup methods.

- [ ] **Step 5: Implement account reset client**

Add:

```ts
export interface AccountResetInput {
  readonly operationId: string;
  readonly confirmation: "RESET";
}

reset(input: AccountResetInput): Promise<"reset">;
```

Use the existing cookie serialiser and bounded request policy. Preserve `redirect: "error"` and the account identity header.

- [ ] **Step 6: Implement exact local cleanup**

Add:

```ts
resetAccount(username: string): Promise<void>
```

to the draft store, outbox, and cloud metadata store. Derive the same SHA-256 namespace already used for normal access, close active handles, and delete only the exact derived database or key prefix.

Upgrade Image Lab persistence to `ad-market:image-lab-submission:v2:<account-namespace>:` and Studio Coach session keys to `v3:<account-namespace>:`. Migrate a legacy entry only when the currently opened campaign proves ownership; reset deletes only the new account-scoped namespace.

- [ ] **Step 7: Implement coordinator ordering**

Expose:

```ts
export class AccountResetCoordinator {
  reset(confirmation: "RESET"): Promise<void>;
  retry(): Promise<void>;
}
```

The coordinator stores `{ phase: "pending", operationId }`, broadcasts pending, quiesces sync, calls the server, clears local stores on success, broadcasts complete, and reloads without logging out.

- [ ] **Step 8: Run client tests and confirm GREEN**

Expected: every reset, storage isolation, and existing autosave/outbox test passes.

### Task 5: Add the accessible typed-confirmation dialog

**Files:**
- Create: `web/src/account/account-reset-dialog.ts`
- Create: `web/src/account/account-reset-dialog.test.ts`
- Modify: `web/src/account/account-gate.ts`
- Modify: `web/src/styles/account.css`
- Modify: `web/src/main.ts`
- Test: `web/src/account/account-gate.test.ts`

**Interfaces:**
- Consumes: `onConfirm(): Promise<void>` from `AccountResetCoordinator`.
- Produces: `Reset progress` beside `Log out`, exact typed confirmation, cancel/Escape focus restoration, announced pending/failure state.

- [ ] **Step 1: Write failing dialog tests**

Assert:

```ts
expect(getByRole(root, "dialog", { name: "Reset account progress" })).toBeTruthy();
expect(confirmButton.disabled).toBe(true);
fireEvent.input(input, { target: { value: "reset" } });
expect(confirmButton.disabled).toBe(true);
fireEvent.input(input, { target: { value: "RESET" } });
expect(confirmButton.disabled).toBe(false);
```

Also assert Cancel and Escape return focus to `Reset progress`; rejection keeps the dialog open with `role="alert"`; username/password preservation and deleted-data scope are visible.

- [ ] **Step 2: Run dialog tests and confirm RED**

Run the dialog and account-gate tests. Expected: FAIL because the reset control is absent.

- [ ] **Step 3: Implement the modal**

Use native `<dialog>` when supported and the project’s existing fallback pattern otherwise. The confirm button is enabled only when:

```ts
input.value === "RESET"
```

While pending, disable Cancel, input, and confirm; announce progress. On retryable failure, re-enable Cancel and confirm without clearing the input or operation ID.

- [ ] **Step 4: Wire account runtime**

Place `Reset progress` beside `Log out` for an authenticated session. Pass the active username and runtime stores into `AccountResetCoordinator`. Do not call logout before or after reset.

- [ ] **Step 5: Run UI tests and confirm GREEN**

Run:

```powershell
pnpm exec vitest run web/src/account/account-reset-dialog.test.ts web/src/account/account-gate.test.ts web/src/account/account-reset-coordinator.test.ts --no-cache --configLoader runner
```

Expected: all pass with deterministic focus assertions.

### Task 6: Integrate copy, verify, and commit reset

**Files:**
- Modify: reset source/tests after the unguided copy workflow.
- Modify: `reviews/student-language-adjudication-2026-07-24.md`
- Create: `reviews/final-verification-2026-07-24.md`

**Interfaces:**
- Consumes: the Student Language plan’s accepted new-copy mapping.
- Produces: a tested reset slice with no live mutations.

- [ ] **Step 1: Run the new-copy workflow**

Extract every new visible, alert, status, label, placeholder, and accessibility string from the reset implementation. Run the named Plain Language workflow first and Claude Scrubber MICROCOPY second, each on raw unannotated text only. Update exact-copy tests before updating source.

- [ ] **Step 2: Run focused reset verification**

Run:

```powershell
pnpm exec vitest run web/src/account/account-reset-dialog.test.ts web/src/account/account-reset-coordinator.test.ts web/src/account/account-client.test.ts web/src/account/account-identity-binding.test.ts web/src/account/cloud-progress-outbox.test.ts web/src/account/cloud-progress-sync.test.ts web/src/persistence/account-scoped-draft-store.test.ts web/src/ai-image/browser-image-lab-submission-persistence.test.ts web/src/studio-coach/studio-coach-runtime.test.ts netlify/functions/account-reset.test.ts netlify/functions/lib/account-assets.test.ts netlify/functions/lib/netlify-account-assets.test.ts netlify/functions/lib/account-backend.test.ts netlify/functions/lib/account-operation-artifacts.test.ts --no-cache --configLoader runner
node --test scripts/build-netlify-functions.test.mjs
pnpm typecheck
git diff --check
```

Expected: all pass with no network, Supabase, paid API, or production call.

- [ ] **Step 3: Inspect the safety diff**

Confirm:

```text
no deleteAll
no unbounded list
no prefix deletion
no logout call in reset
no live migration command
no production deploy command
exact RESET comparison
exact account-derived local deletion
```

- [ ] **Step 4: Commit**

```powershell
git add web/src/account web/src/persistence web/src/ai-image web/src/studio-coach web/src/main.ts web/src/styles/account.css netlify/functions netlify/deploy-functions supabase/functions docs/operations netlify.toml scripts/build-netlify-functions.test.mjs reviews/student-language-adjudication-2026-07-24.md
git commit -m "feat(account): add replay-safe progress reset"
```
