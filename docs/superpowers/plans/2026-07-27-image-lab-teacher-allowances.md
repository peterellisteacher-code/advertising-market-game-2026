# Image Lab Teacher Allowances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared student-entered Image Lab code with teacher-controlled, account-bound Object Forge and Make It Real allowances enforced atomically on the server.

**Architecture:** The existing paid-provider request validation, fixed profiles, queue polling, result checks, idempotent job state and owned-asset handling remain in place. A new private Supabase allowance ledger becomes the sole authority for whether an authenticated pair may reserve a draft or final image. Teacher controls call teacher-only Netlify routes; student routes can read their own remaining/reserved counts but cannot grant or alter them. Every generation has one idempotent reservation, one terminal debit after a valid deliverable, or one refund after a confirmed terminal failure. Unknown outcomes remain visibly reserved until reconciliation and are never submitted again automatically.

**Tech Stack:** PostgreSQL/Supabase RPC, Supabase Edge Functions, Netlify Functions, TypeScript 7, Vitest 4, Netlify Blobs job state, existing fal queue adapter with injected fake responses for tests.

**Approved specification:** `docs/superpowers/specs/2026-07-27-student-teacher-editor-completion-design.md`

**Dependency:** Implement after `2026-07-27-student-teacher-access-and-account-controls.md`; this plan consumes `requireTeacherSession`, pair account lookup, and the teacher dashboard.

## Global Constraints

- Students must never enter or receive a teacher code.
- New pair accounts receive zero Object Forge and zero Make It Real uses unless Peter changes a teacher default or grants uses.
- Keep draft (`object`) and final (`realise`) counts separate.
- The Supabase ledger is the sole allowance authority. A signed cookie or browser value is not a budget.
- A reservation reduces displayed available uses but is not consumed until one verified image deliverable is returned.
- A confirmed provider failure or confirmed unusable/no-deliverable result refunds exactly once.
- A timeout, interrupted connection or unknown upstream outcome remains reserved and offers reconcile/refresh. It must not be automatically resubmitted.
- Idempotency keys and request hashes must match on replay; mismatched replay fails closed.
- Provider keys, model IDs selected by the server, prompt wrappers, upstream request IDs, Supabase identifiers and service keys remain server-only.
- Preserve the existing fixed provider profiles, image signature/dimension checks, same-origin proxy, byte limits, deadlines and no automatic paid submission retry.
- No paid inference call is part of testing.
- Before a real schema change, reserve only the named Advertising objects in shared Supabase project `jftpeajvpqmxabuscoml`, verify collisions read-only, and release the reservation immediately afterward.
- Do not touch any `signal_lost` object.
- Do not apply the schema or change Netlify environment during ordinary local implementation.
- Do not delete or move any file without Peter's explicit deletion approval and notification.

---

### Task 1: Specify and test the private atomic allowance ledger

**Files:**
- Create: `docs/operations/advertising-game-image-lab-allowances.sql`
- Create: `netlify/functions/lib/image-lab-operation-artifacts.test.ts`
- Modify: `docs/operations/image-lab.md`

**Private objects:**

```text
advertising_game.image_lab_settings
advertising_game.image_lab_allowance
advertising_game.image_lab_operation
public.advertising_game_image_lab_rpc
```

**Logical allowance row:**

```sql
user_id uuid primary key references auth.users(id) on delete cascade,
object_granted integer not null default 0,
object_consumed integer not null default 0,
object_reserved integer not null default 0,
realise_granted integer not null default 0,
realise_consumed integer not null default 0,
realise_reserved integer not null default 0,
updated_at timestamptz not null
```

All counters are bounded from 0 to 100. For each stage:

```text
available = granted - consumed - reserved
```

**RPC operations:**

```ts
type ImageLabLedgerOperation =
  | "status"
  | "global_status"
  | "set_global"
  | "set"
  | "add"
  | "revoke"
  | "reserve"
  | "complete"
  | "refund"
  | "mark_uncertain"
  | "list";
```

- [ ] **Step 1: Write the failing artifact-contract tests**

The test must assert:

- every object name occurs exactly once;
- the three tables live in the private `advertising_game` schema;
- RLS is enabled as defence in depth;
- `PUBLIC`, `anon`, and `authenticated` have no schema, table, sequence or function access;
- the RPC is `SECURITY DEFINER`, has `SET search_path = ''`, is owned by the controlled migration owner, revokes default execute, and grants only `service_role`;
- account IDs are `auth.users(id)` foreign keys;
- grants, consumption and reservation constraints cannot go negative or exceed 100;
- advisory locks serialize one user and global-setting mutations;
- an operation journal has a unique operation ID and request hash;
- `reserve`, `complete`, `refund`, and `mark_uncertain` are idempotent;
- a replay with a changed user, stage, amount, job key or request hash is rejected;
- `complete` can move only `reserved -> consumed`;
- `refund` can move only `reserved -> refunded`;
- a terminal operation cannot be changed to another terminal state;
- `list` returns aliases only through the server broker, not direct SQL access.

- [ ] **Step 2: Run the artifact test and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 netlify/functions/lib/image-lab-operation-artifacts.test.ts
```

- [ ] **Step 3: Author the deterministic SQL source**

Use one transaction body without migration-ledger statements. Keep `image_lab_settings` as a singleton row with `enabled boolean` and default grant values. The RPC accepts an explicit `p_user_id`, stage, amount, operation ID, job key and request hash, validates an exact operation vocabulary, locks the required row, writes one operation record, and returns bounded JSON containing:

```json
{
  "status": "available|disabled|reserved|completed|refunded|uncertain",
  "enabled": true,
  "object": { "granted": 0, "consumed": 0, "reserved": 0, "remaining": 0 },
  "realise": { "granted": 0, "consumed": 0, "reserved": 0, "remaining": 0 }
}
```

Do not expose this RPC to browser roles.

- [ ] **Step 4: Document preflight, verification and rollback**

Add exact read-only catalogue checks, grants, constraints, function signature and neighbouring-object checks. Rollback notes must name only the four Advertising objects and must not use `CASCADE`.

- [ ] **Step 5: Run the artifact test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add docs/operations/advertising-game-image-lab-allowances.sql netlify/functions/lib/image-lab-operation-artifacts.test.ts docs/operations/image-lab.md
git commit -m "docs(image-lab): define atomic account allowances"
```

### Task 2: Extend the Supabase broker and Netlify ledger adapter

**Files:**
- Modify: `supabase/functions/advertising-game-backend/handler.ts`
- Modify: `netlify/functions/lib/advertising-game-edge-handler.test.ts`
- Modify: `netlify/functions/lib/account-backend.ts`
- Modify: `netlify/functions/lib/account-backend.test.ts`
- Create: `netlify/functions/lib/image-lab-allowance-store.ts`
- Create: `netlify/functions/lib/image-lab-allowance-store.test.ts`

**Server envelope:**

```ts
interface ImageLabLedgerEnvelope {
  readonly operation: "image_lab";
  readonly input: {
    readonly userId: string;
    readonly ledgerOperation: ImageLabLedgerOperation;
    readonly stage?: "object" | "realise";
    readonly amount?: number;
    readonly operationId: string;
    readonly jobKey?: string;
    readonly requestHash?: string;
  };
}
```

**Store interface:**

```ts
export interface ImageLabAllowanceStore {
  status(userId: string): Promise<ImageLabAllowanceSnapshot>;
  list(): Promise<readonly TeacherImageLabAccount[]>;
  setGlobal(input: SetImageLabGlobalInput): Promise<ImageLabAllowanceSnapshot>;
  set(input: SetImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot>;
  add(input: AddImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot>;
  revoke(input: RevokeImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot>;
  reserve(input: ReserveImageLabAllowanceInput): Promise<ImageLabReservation>;
  complete(input: TerminalImageLabReservationInput): Promise<ImageLabReservation>;
  refund(input: TerminalImageLabReservationInput): Promise<ImageLabReservation>;
  markUncertain(input: TerminalImageLabReservationInput): Promise<ImageLabReservation>;
}
```

- [ ] **Step 1: Write failing Edge-broker tests**

Assert exact field sets, UUID/job-key/hash validation, bounds, gateway authorization, service-only RPC URL and parameters, bounded response parsing, and failure sanitisation. A browser-supplied user ID must never be trusted by a public route; only a resolved server identity may populate the envelope.

- [ ] **Step 2: Write failing store tests**

Use an injected `SupabaseAccountClient` to prove all operations translate to exact broker envelopes, preserve operation IDs, reject mismatched stage data, parse exact response keys and never infer remaining counts locally.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 netlify/functions/lib/advertising-game-edge-handler.test.ts netlify/functions/lib/account-backend.test.ts netlify/functions/lib/image-lab-allowance-store.test.ts
```

- [ ] **Step 4: Implement the broker and store**

Add the `image_lab` branch beside `create_user` and `progress`. It calls only `/rest/v1/rpc/advertising_game_image_lab_rpc` with the service key already confined to the Edge Function. Do not import a second Supabase client library.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add supabase/functions/advertising-game-backend/handler.ts netlify/functions/lib/advertising-game-edge-handler.test.ts netlify/functions/lib/account-backend.ts netlify/functions/lib/account-backend.test.ts netlify/functions/lib/image-lab-allowance-store.ts netlify/functions/lib/image-lab-allowance-store.test.ts
git commit -m "feat(image-lab): add server allowance adapter"
```

### Task 3: Replace the unlock capability with account-bound Image Lab status

**Files:**
- Modify: `netlify/functions/image-lab-session.mts`
- Modify: `netlify/functions/image-lab-session.test.ts`
- Modify: `netlify/functions/lib/image-lab-auth.ts`
- Modify: `netlify/functions/lib/image-lab-auth.test.ts`
- Modify: `netlify/functions/lib/image-lab-state.ts`
- Modify: `netlify/functions/lib/image-lab-state.test.ts`
- Modify: `netlify/functions/lib/netlify-image-lab-state.ts`
- Modify: `netlify/functions/lib/netlify-image-lab-state.test.ts`

**New session contract:**

```text
GET /api/image-lab/session
```

Response when enabled:

```ts
interface StudentImageLabStatus {
  readonly enabled: true;
  readonly object: {
    readonly remaining: number;
    readonly reserved: number;
  };
  readonly realise: {
    readonly remaining: number;
    readonly reserved: number;
  };
}
```

Response when globally disabled:

```ts
{ readonly enabled: false; readonly reason: "disabled" }
```

- [ ] **Step 1: Write failing session tests**

Assert:

- pair account authentication is required;
- the authenticated user ID is resolved from the existing account cookie;
- student-supplied `sessionId`, `teamId`, code or user ID is rejected;
- `POST /unlock` and `POST /lock` are no longer configured routes;
- no Image Lab capability cookie is issued;
- status comes from `ImageLabAllowanceStore.status(userId)`;
- zero is a valid remaining count;
- disabled and unavailable states are distinct;
- account-session cookies may rotate without changing identity.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 netlify/functions/image-lab-session.test.ts netlify/functions/lib/image-lab-auth.test.ts netlify/functions/lib/image-lab-state.test.ts netlify/functions/lib/netlify-image-lab-state.test.ts
```

- [ ] **Step 3: Implement account-bound status**

Replace `ImageLabCapability` authority with:

```ts
interface ResolvedImageLabAccount {
  readonly userId: string;
  readonly username: string;
}
```

Keep capability-token parsing only if needed to finish already-created legacy jobs during a bounded transition; do not mint new capability cookies. If no compatibility route is required by a retained deployed job, remove the runtime dependency while preserving its unit tests as a retired-format rejection contract.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add netlify/functions/image-lab-session.mts netlify/functions/image-lab-session.test.ts netlify/functions/lib/image-lab-auth.ts netlify/functions/lib/image-lab-auth.test.ts netlify/functions/lib/image-lab-state.ts netlify/functions/lib/image-lab-state.test.ts netlify/functions/lib/netlify-image-lab-state.ts netlify/functions/lib/netlify-image-lab-state.test.ts
git commit -m "refactor(image-lab): bind status to pair accounts"
```

### Task 4: Integrate reservation, completion, refund and uncertainty with paid jobs

**Files:**
- Modify: `netlify/functions/image-lab-jobs.mts`
- Modify: `netlify/functions/image-lab-jobs.test.ts`
- Modify: `netlify/functions/lib/image-lab-state.ts`
- Modify: `netlify/functions/lib/image-lab-state.test.ts`
- Modify: `netlify/functions/lib/netlify-image-lab-state.ts`
- Modify: `netlify/functions/lib/netlify-image-lab-state.test.ts`

**Lifecycle:**

```text
validated request
  -> existing idempotent job reservation
  -> atomic allowance reservation
  -> provider submission once
  -> queued/working
  -> verified image returned -> complete/debit once
  -> confirmed failed/no deliverable -> refund once
  -> interrupted/unknown -> mark uncertain, keep reserved
```

- [ ] **Step 1: Write failing lifecycle tests**

Cover both stages and these cases:

1. available allowance creates one job and one ledger reservation;
2. zero allowance makes no provider request;
3. replay with identical idempotency key and hash returns the existing job and does not reserve again;
4. replay with changed input fails before provider access;
5. provider submission confirmed failed refunds once;
6. queue status confirmed failed refunds once;
7. valid signature/MIME/dimensions returned to the browser completes once;
8. malformed or empty completed result refunds once only when the provider outcome is conclusively unusable;
9. network timeout after submission marks uncertain and does not refund or resubmit;
10. reconciliation can move uncertain to completed or refunded once;
11. a terminal replay returns the same terminal ledger state;
12. the response remaining count is the ledger value, not cookie arithmetic.

- [ ] **Step 2: Run job tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 netlify/functions/image-lab-jobs.test.ts netlify/functions/lib/image-lab-state.test.ts netlify/functions/lib/netlify-image-lab-state.test.ts
```

- [ ] **Step 3: Implement the allowance port**

Inject `ImageLabAllowanceStore` into `createImageLabJobsHandler`. Derive the ledger operation ID deterministically from the authenticated user, stage and job token, without exposing it. Store the ledger reservation reference in the existing job record. Never call a paid provider before both existing job idempotency and ledger reservation succeed.

Add a `reconcile` status that polls the existing upstream request ID only. It must never call the provider submission endpoint.

- [ ] **Step 4: Preserve every provider guard**

Run and retain tests for:

- fixed model/profile selection;
- request-size and content policy;
- exact output dimensions;
- safe media host;
- signature and MIME checks;
- bounded media bytes;
- same-origin proxy;
- deadlines/cancellation;
- no automatic submission retry;
- server-only prompt wrappers and credentials.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS with injected fake provider responses and zero paid calls.

- [ ] **Step 6: Commit**

```powershell
git add netlify/functions/image-lab-jobs.mts netlify/functions/image-lab-jobs.test.ts netlify/functions/lib/image-lab-state.ts netlify/functions/lib/image-lab-state.test.ts netlify/functions/lib/netlify-image-lab-state.ts netlify/functions/lib/netlify-image-lab-state.test.ts
git commit -m "feat(image-lab): debit verified results exactly once"
```

### Task 5: Simplify the student Image Lab client and panel

**Files:**
- Modify: `web/src/ai-image/image-lab-client.ts`
- Modify: `web/src/ai-image/image-lab-client.test.ts`
- Modify: `web/src/ai-image/image-lab-panel.ts`
- Modify: `web/src/ai-image/image-lab-panel.test.ts`
- Modify: `web/src/ai-image/image-lab-runtime.ts`
- Modify: `web/src/ai-image/image-lab-runtime.test.ts`
- Modify: `web/src/game/student-copy.ts`
- Modify: `web/src/styles/editor.css`

**Client changes:**

Remove the `unlock` and `lock` client methods and the
`ImageLabUnlockRequest`, `ImageLabUnlockResult` and `ImageLabLockResult` types.

Add:

```ts
status(options?: ImageLabRequestOptions): Promise<StudentImageLabStatus>;
reconcile(jobToken: string, options?: ImageLabRequestOptions): Promise<ImageLabJobStatus>;
```

- [ ] **Step 1: Write failing student-panel tests**

Assert the panel never renders:

- `Teacher code`;
- `Wake Image Lab`;
- `Close Image Lab`; or
- an input that accepts a shared code.

When enabled, it renders:

```text
Object Forge: 2 uses available
Make It Real: 1 use available
```

Reserved counts use factual copy such as `1 request is being checked`. At zero, the corresponding action is disabled and the unmet condition is visible beside it. Unknown status offers `Check request` rather than `Try again`.

- [ ] **Step 2: Write failing client tests**

Assert account-bound GET status, job creation, polling, result and reconciliation contracts. Remove all capability-cookie/unlock response parsing. Preserve byte bounds, content types, deadlines and redirect rejection.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/ai-image/image-lab-client.test.ts web/src/ai-image/image-lab-panel.test.ts web/src/ai-image/image-lab-runtime.test.ts
```

- [ ] **Step 4: Implement the status-driven panel**

Initialise from authenticated status. Refresh after a terminal job state. Keep Object Forge and Make It Real forms available only when their own allowance is positive. Do not blur the distinction between draft and final uses.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/ai-image/image-lab-client.ts web/src/ai-image/image-lab-client.test.ts web/src/ai-image/image-lab-panel.ts web/src/ai-image/image-lab-panel.test.ts web/src/ai-image/image-lab-runtime.ts web/src/ai-image/image-lab-runtime.test.ts web/src/game/student-copy.ts web/src/styles/editor.css
git commit -m "fix(student): remove Image Lab teacher code"
```

### Task 6: Add teacher global, default, per-pair and batch allowance controls

**Files:**
- Modify: `netlify/functions/teacher-accounts.mts`
- Modify: `netlify/functions/teacher-accounts.test.ts`
- Modify: `netlify/functions/lib/teacher-account-service.ts`
- Modify: `netlify/functions/lib/teacher-account-service.test.ts`
- Modify: `web/src/teacher/teacher-client.ts`
- Modify: `web/src/teacher/teacher-client.test.ts`
- Modify: `web/src/teacher/teacher-dashboard.ts`
- Modify: `web/src/teacher/teacher-dashboard.test.ts`
- Modify: `web/src/teacher/teacher.css`

**Teacher HTTP routes:**

```text
GET   /api/teacher/image-lab
PUT   /api/teacher/image-lab/global
PUT   /api/teacher/image-lab/accounts/:username
POST  /api/teacher/image-lab/accounts/:username/add
POST  /api/teacher/image-lab/accounts/:username/revoke
POST  /api/teacher/image-lab/batch
```

- [ ] **Step 1: Write failing teacher API tests**

Every mutation requires teacher session, same-origin POST/PUT, exact schema/version, operation ID and bounded counts. Browser bodies name only aliases. The server resolves user IDs.

Test:

- global on/off;
- default draft/final allowances for future accounts;
- set exact counts;
- add counts;
- revoke only unconsumed/unreserved availability;
- batch grant to selected aliases;
- no negative or over-100 values;
- idempotent replay;
- mismatched replay rejection;
- unknown mutation returns reconcile/refresh rather than auto-repeat.

- [ ] **Step 2: Write failing dashboard tests**

Assert a clear table with:

- alias;
- Object Forge available/reserved;
- Make It Real available/reserved;
- selected-row controls;
- `Set`, `Add`, and `Revoke available uses`;
- batch selection;
- global status;
- default-for-new-accounts fields;
- a small audit result naming the operation, alias and resulting counts.

Do not show costs as if they are guaranteed current prices. Do not show provider keys, raw IDs or job tokens.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 netlify/functions/teacher-accounts.test.ts netlify/functions/lib/teacher-account-service.test.ts web/src/teacher/teacher-client.test.ts web/src/teacher/teacher-dashboard.test.ts
```

- [ ] **Step 4: Implement teacher controls**

Call `ImageLabAllowanceStore` only after teacher authorization and account resolution. Keep all mutation buttons disabled while one operation is pending. On uncertain response, retain entered values, show `Refresh allowances`, and do not repeat automatically.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add netlify/functions/teacher-accounts.mts netlify/functions/teacher-accounts.test.ts netlify/functions/lib/teacher-account-service.ts netlify/functions/lib/teacher-account-service.test.ts web/src/teacher/teacher-client.ts web/src/teacher/teacher-client.test.ts web/src/teacher/teacher-dashboard.ts web/src/teacher/teacher-dashboard.test.ts web/src/teacher/teacher.css
git commit -m "feat(teacher): control pair Image Lab allowances"
```

### Task 7: Prove the complete allowance contract without paid calls

**Files:**
- Modify: `netlify/functions/deploy-layout.test.ts`
- Modify: `scripts/build-netlify-functions.test.mjs`
- Modify: `scripts/student-copy-source-coverage.test.mjs`
- Modify: `docs/operations/image-lab.md`

- [ ] **Step 1: Run the focused server group**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 netlify/functions/image-lab-session.test.ts netlify/functions/image-lab-jobs.test.ts netlify/functions/lib/image-lab-auth.test.ts netlify/functions/lib/image-lab-state.test.ts netlify/functions/lib/netlify-image-lab-state.test.ts netlify/functions/lib/image-lab-allowance-store.test.ts netlify/functions/teacher-accounts.test.ts
```

Expected: PASS and all provider fetches are injected fakes.

- [ ] **Step 2: Run the focused browser group**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/ai-image/image-lab-client.test.ts web/src/ai-image/image-lab-panel.test.ts web/src/ai-image/image-lab-runtime.test.ts web/src/teacher/teacher-dashboard.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run function and copy contracts**

```powershell
node --test scripts/build-netlify-functions.test.mjs scripts/student-copy-source-coverage.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Update the operations guide**

Replace supervised code-entry instructions with:

- global/default/per-pair controls;
- zero default;
- draft versus final counts;
- reserved, consumed, refunded and uncertain states;
- exact activation preflight;
- hard external provider spending cap;
- reconciliation procedure;
- schema verification and named rollback boundary.

Do not claim that the ledger replaces the provider's own hard account cap.

- [ ] **Step 5: Commit**

```powershell
git add netlify/functions/deploy-layout.test.ts scripts/build-netlify-functions.test.mjs scripts/student-copy-source-coverage.test.mjs docs/operations/image-lab.md
git commit -m "test(image-lab): verify teacher allowance boundary"
```

## Plan Completion Gate

- [ ] Student devices contain no shared teacher code or unlock control.
- [ ] New accounts default to zero uses unless the teacher default changes.
- [ ] Draft and final allowances are separate and server-authoritative.
- [ ] Concurrent reserve, complete and refund operations are atomic and idempotent.
- [ ] A valid deliverable consumes once; a confirmed failure refunds once; uncertainty stays reserved.
- [ ] Teacher global, default, per-pair and batch controls pass.
- [ ] No paid inference occurred.
- [ ] No Supabase or Netlify external state changed during implementation.
