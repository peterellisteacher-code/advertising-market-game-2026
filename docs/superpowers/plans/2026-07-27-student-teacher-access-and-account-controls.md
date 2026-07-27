# Student and Teacher Access and Account Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a public student entry path and a separately protected teacher dashboard where Peter can create pair credentials, replace passwords, reset a selected pair, and use an isolated resettable teacher playtest.

**Architecture:** One Vite/Godot application resolves `/student`, `/teacher`, and `/teacher/playtest` before starting either the pair game or the teacher shell. Pair authentication continues to use the existing Supabase Auth cookies and account-scoped local stores. Teacher authentication uses a separate server-verified, HMAC-signed, secure HttpOnly cookie and separate rate limits. Teacher account operations travel through new teacher-only Netlify functions and the existing gateway-authenticated Supabase Edge broker; raw Supabase identifiers never reach the browser. The teacher playtest uses a reserved server-side identity plus separate browser storage namespaces and never enters a student account.

**Tech Stack:** TypeScript 7, Vite 8, Vitest 4/JSDOM, Netlify Functions 5.3, Web Crypto/Node crypto, Supabase Auth Admin API through the existing Edge broker, Netlify Blobs, Godot 4 web export.

**Approved specification:** `docs/superpowers/specs/2026-07-27-student-teacher-editor-completion-design.md`

**Dependency:** This plan is first in the completion programme. The Image Lab allowance plan consumes the teacher session and account-alias contracts created here.

## Global Constraints

- `/student` must expose pair sign-in only. It must not render teacher setup, pair creation, reset, Image Lab allocation, or the teacher password.
- `/teacher` must require server verification of the configured teacher password. Do not embed `!Y10English!` in client JavaScript, HTML, a public snapshot, logs, or tests that ship as runtime data.
- Store the teacher password and teacher-session signing secret as Netlify runtime environment values, not in `netlify.toml`.
- Teacher cookies are independent of pair cookies and must be `HttpOnly`, `Secure`, `SameSite=Strict`, bounded, `Path=/api/teacher`.
- Keep the pair-session rate-limit floor at `300` requests per 60 seconds aggregated by `["ip", "domain"]`.
- A password remains 8–128 UTF-8 bytes. Supabase stores the hash; plaintext is copyable only from the teacher form before the success panel is dismissed.
- Updating a password through Supabase Auth Admin must revoke the account's sessions. Preserve a regression that proves the exact Admin password-update request is used.
- Do not display or return Supabase user IDs, synthetic email addresses, access tokens, refresh tokens, publishable keys, or service secrets.
- Pair reset confirmation is the exact username. Teacher playtest reset confirmation is the exact word `RESET`.
- Reuse the existing idempotent progress/asset reset sequence. Do not create a second deletion implementation.
- Do not apply Supabase, Netlify environment, visitor-access, or production changes while implementing local code.
- Do not launch a Windows Godot executable.
- Do not delete or move any file without Peter's explicit deletion approval and notification.

---

### Task 1: Resolve the three application routes before boot

**Files:**
- Create: `web/src/app/app-route.ts`
- Create: `web/src/app/app-route.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `scripts/build-web.mjs`
- Modify: `scripts/build-web.test.mjs`
- Modify: `scripts/verify-web-export.mjs`
- Modify: `scripts/public-release-contract.test.mjs`

**Interfaces:**

```ts
export type AdvertisingGameRoute =
  | { readonly kind: "redirect"; readonly location: "/student" }
  | { readonly kind: "student" }
  | { readonly kind: "teacher-dashboard" }
  | { readonly kind: "teacher-playtest" }
  | { readonly kind: "not-found" };

export function resolveAdvertisingGameRoute(pathname: string): AdvertisingGameRoute;
```

- [ ] **Step 1: Write the failing route tests**

Assert exact path handling:

```ts
expect(resolveAdvertisingGameRoute("/")).toEqual({
  kind: "redirect",
  location: "/student"
});
expect(resolveAdvertisingGameRoute("/student")).toEqual({ kind: "student" });
expect(resolveAdvertisingGameRoute("/student/")).toEqual({ kind: "student" });
expect(resolveAdvertisingGameRoute("/teacher")).toEqual({ kind: "teacher-dashboard" });
expect(resolveAdvertisingGameRoute("/teacher/playtest")).toEqual({
  kind: "teacher-playtest"
});
expect(resolveAdvertisingGameRoute("/teacherish")).toEqual({ kind: "not-found" });
```

In `web/src/main.test.ts`, assert that teacher routes do not construct `AccountAccessController`, pair routes do not construct the teacher dashboard, and `/` uses `location.replace("/student")` before any network request or Godot start.

- [ ] **Step 2: Run the route tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/app/app-route.test.ts web/src/main.test.ts
```

Expected: FAIL because the route resolver and route-aware bootstrap do not exist.

- [ ] **Step 3: Implement the pure resolver and one route-aware bootstrap**

Normalise only a trailing slash. Do not decode arbitrary paths or accept prefix matches. Move the current pair-game boot into `bootStudentApplication()`. Add fail-closed `bootTeacherDashboard()` and `bootTeacherPlaytest()` entry points that render the teacher sign-in boundary until the teacher-session controller admits the requested surface.

- [ ] **Step 4: Add static navigation rewrites without duplicating the application**

Have `scripts/build-web.mjs` emit:

```text
/                 /student             302
/student          /index.html          200
/student/*        /index.html          200
/teacher          /index.html          200
/teacher/*        /index.html          200
```

Specific route rules must precede any general fallback. Change the web manifest `start_url` from `/` to `/student`. The service worker may cache the shared static shell, but it must not cache teacher or account API responses and must not convert an unauthenticated teacher API response into success.

- [ ] **Step 5: Extend the artifact verifier**

Assert that `_redirects`, `manifest.webmanifest`, and `service-worker.js` contain the exact route and cache contracts. Assert there is no redirect or rewrite that maps `/api/teacher/*` to `index.html`.

- [ ] **Step 6: Run focused route/build contracts and verify GREEN**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/app/app-route.test.ts web/src/main.test.ts
node --test scripts/build-web.test.mjs scripts/public-release-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/app/app-route.ts web/src/app/app-route.test.ts web/src/main.ts web/src/main.test.ts scripts/build-web.mjs scripts/build-web.test.mjs scripts/verify-web-export.mjs scripts/public-release-contract.test.mjs
git commit -m "feat(access): separate student and teacher routes"
```

### Task 2: Add the independent teacher-session boundary

**Files:**
- Create: `netlify/functions/lib/teacher-auth.ts`
- Create: `netlify/functions/lib/teacher-auth.test.ts`
- Create: `netlify/functions/teacher-session.mts`
- Create: `netlify/functions/teacher-session.test.ts`
- Create: `netlify/deploy-functions/teacher-session.mts`
- Modify: `scripts/build-netlify-functions.mjs`
- Modify: `scripts/build-netlify-functions.test.mjs`
- Modify: `netlify/functions/deploy-layout.test.ts`

**Environment contract:**

```text
ADVERTISING_GAME_TEACHER_PASSWORD=<server-only teacher password>
ADVERTISING_GAME_TEACHER_SESSION_SECRET=<32–256 byte random secret>
ADVERTISING_GAME_TEACHER_SESSION_HOURS=8
```

**Interfaces:**

```ts
export interface TeacherSessionClaims {
  readonly schema: "ad-market-teacher-session";
  readonly version: 1;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
}

export function createTeacherSessionToken(
  claims: TeacherSessionClaims,
  secret: string
): string;

export function verifyTeacherSessionToken(
  token: unknown,
  secret: string,
  nowSeconds: number
): TeacherSessionClaims | null;

export function requireTeacherSession(
  request: Request,
  environment: TeacherEnvironment
): TeacherSessionClaims;
```

- [ ] **Step 1: Write failing primitive tests**

Cover exact-key payload validation, malformed base64url, signature changes, expiry, future issuance, lifetime ceiling, newline/control characters, constant-time password comparison, secure cookie attributes, and clearing the cookie.

```ts
expect(serialiseTeacherCookie("token", 3600)).toContain("HttpOnly");
expect(serialiseTeacherCookie("token", 3600)).toContain("Secure");
expect(serialiseTeacherCookie("token", 3600)).toContain("SameSite=Strict");
expect(serialiseTeacherCookie("token", 3600)).toContain("Path=/api/teacher");
```

- [ ] **Step 2: Write failing endpoint tests**

Test:

- `POST /api/teacher/login` with the configured password returns `{ authenticated: true }` and one teacher cookie;
- a wrong password returns `INVALID_CREDENTIALS` without reflecting the submitted value;
- `GET /api/teacher/session` returns only `{ authenticated: boolean }`;
- `POST /api/teacher/logout` clears only the teacher cookie;
- extra fields, query strings, wrong methods, cross-origin mutations, oversized JSON and unconfigured environments fail closed;
- no response contains the teacher password or signing secret.

- [ ] **Step 3: Run the tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 netlify/functions/lib/teacher-auth.test.ts netlify/functions/teacher-session.test.ts
```

- [ ] **Step 4: Implement the HMAC token and modern Netlify function**

Use the existing modern `default export` plus `Config` pattern. Read runtime values with `Netlify.env.get`. Generate a 128-bit random nonce. Sign canonical UTF-8 JSON with HMAC-SHA-256. Compare submitted password bytes with a length-hiding HMAC comparison so the configured value is never returned or logged.

Configure:

```ts
export const config: Config = {
  path: [
    "/api/teacher/login",
    "/api/teacher/session",
    "/api/teacher/logout"
  ],
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
```

This limit is independent of the existing pair-session limit.

- [ ] **Step 5: Bind the new function into the manifest**

Add `teacher-session` to `NETLIFY_FUNCTION_NAMES`, wrapper exact-file assertions, deployment layout, and release-manifest tests.

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 netlify/functions/lib/teacher-auth.test.ts netlify/functions/teacher-session.test.ts netlify/functions/deploy-layout.test.ts
node --test scripts/build-netlify-functions.test.mjs
```

- [ ] **Step 7: Commit**

```powershell
git add netlify/functions/lib/teacher-auth.ts netlify/functions/lib/teacher-auth.test.ts netlify/functions/teacher-session.mts netlify/functions/teacher-session.test.ts netlify/deploy-functions/teacher-session.mts scripts/build-netlify-functions.mjs scripts/build-netlify-functions.test.mjs netlify/functions/deploy-layout.test.ts
git commit -m "feat(teacher): add secure teacher session"
```

### Task 3: Extend the server-only Supabase broker for account administration

**Files:**
- Modify: `supabase/functions/advertising-game-backend/handler.ts`
- Modify: `netlify/functions/lib/advertising-game-edge-handler.test.ts`
- Modify: `netlify/functions/lib/account-backend.ts`
- Modify: `netlify/functions/lib/account-backend.test.ts`
- Modify: `netlify/functions/lib/account-operation-artifacts.test.ts`
- Modify: `netlify/functions/account-session.test.ts`

**Server-to-server operations:**

```ts
type AccountAdminEnvelope =
  | { readonly operation: "list_users" }
  | {
      readonly operation: "find_user";
      readonly email: string;
      readonly username: string;
    }
  | {
      readonly operation: "replace_password";
      readonly email: string;
      readonly username: string;
      readonly password: string;
    }
  | {
      readonly operation: "ensure_user";
      readonly email: string;
      readonly username: string;
      readonly password: string;
    };
```

The Edge broker may return user IDs to the calling Netlify function, but the teacher HTTP API added in Task 4 must strip them before responding to the browser.

- [ ] **Step 1: Write failing broker tests**

Use injected fetch responses to prove:

- listing accepts only bounded pagination and keeps only users whose `app_metadata.advertising_game_username` matches the pair-username contract;
- pair creation/listing rejects the reserved username `teacher-playtest`, while the internal playtest operation can resolve only that exact identity;
- matching requires both the HMAC-derived synthetic email and app metadata username;
- password replacement sends `PUT /auth/v1/admin/users/{user_id}` with the new password and a new opaque `app_metadata.advertising_game_session_epoch`, while preserving the verified advertising username metadata;
- the Supabase Admin password update revokes refresh sessions, and the changed epoch immediately rejects an otherwise unexpired old access token on the next game request;
- a fresh password login receives an access token whose epoch matches the current verified user record;
- an account with no legacy epoch remains usable until its first teacher password replacement;
- `ensure_user` returns an existing exact match or creates one confirmed user;
- duplicate or conflicting identities fail closed;
- returned account records are bounded and sorted by username;
- upstream bodies, email addresses, keys and IDs are not reflected in public errors.

- [ ] **Step 2: Run the broker tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 netlify/functions/lib/advertising-game-edge-handler.test.ts netlify/functions/lib/account-backend.test.ts netlify/functions/account-session.test.ts
```

- [ ] **Step 3: Implement bounded Admin requests**

Keep the service key inside the Supabase Edge Function. Use `response.ok` rather than one hard-coded success status. Parse at most 1,000 users and reject a second page instead of silently omitting accounts. Do not use `user_metadata` for authority; accept only `app_metadata.advertising_game_username`.

Add server methods:

```ts
interface AccountAdminRecord {
  readonly userId: string;
  readonly username: string;
  readonly createdAt: string;
  readonly lastSignInAt: string | null;
}

class SupabaseAccountClient {
  listAdvertisingGameUsers(): Promise<readonly AccountAdminRecord[]>;
  findAdvertisingGameUser(username: string): Promise<AccountAdminRecord | null>;
  replaceAdvertisingGamePassword(username: string, password: string): Promise<void>;
  ensureAdvertisingGameUser(username: string, password: string): Promise<AccountAdminRecord>;
}
```

The Netlify client derives the synthetic email with the existing username HMAC secret before making a gateway-authenticated request.

After Supabase validates an access token through `/auth/v1/user`, compare the bounded
`advertising_game_session_epoch` claim from that access JWT with the current user
record returned by Supabase. A mismatch clears both account cookies and resolves as
signed out. The JWT claim is never trusted without successful upstream validation.
This closes the interval in which Supabase has revoked refresh sessions but an
already-issued access JWT has not yet expired.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add supabase/functions/advertising-game-backend/handler.ts netlify/functions/lib/advertising-game-edge-handler.test.ts netlify/functions/lib/account-backend.ts netlify/functions/lib/account-backend.test.ts netlify/functions/lib/account-operation-artifacts.test.ts netlify/functions/account-session.test.ts
git commit -m "feat(accounts): add server-only teacher administration"
```

### Task 4: Add teacher-only account and reset endpoints

**Files:**
- Create: `netlify/functions/lib/teacher-account-service.ts`
- Create: `netlify/functions/lib/teacher-account-service.test.ts`
- Create: `netlify/functions/teacher-accounts.mts`
- Create: `netlify/functions/teacher-accounts.test.ts`
- Create: `netlify/deploy-functions/teacher-accounts.mts`
- Modify: `scripts/build-netlify-functions.mjs`
- Modify: `scripts/build-netlify-functions.test.mjs`
- Modify: `netlify/functions/deploy-layout.test.ts`

**HTTP contracts:**

```text
GET  /api/teacher/accounts
POST /api/teacher/accounts
PUT  /api/teacher/accounts/:username/password
POST /api/teacher/accounts/:username/reset
```

Creation body:

```ts
{
  schema: "ad-market-teacher-account-create";
  version: 1;
  operationId: string;
  username: string;
  password: string;
}
```

Password body:

```ts
{
  schema: "ad-market-teacher-password-replace";
  version: 1;
  operationId: string;
  password: string;
}
```

Reset body:

```ts
{
  schema: "ad-market-teacher-account-reset";
  version: 1;
  operationId: string;
  confirmation: string;
}
```

- [ ] **Step 1: Write failing authorization and response tests**

Assert every route requires `requireTeacherSession`. The browser-visible account shape is:

```ts
interface TeacherPairSummary {
  readonly username: string;
  readonly createdAt: string;
  readonly lastSignInAt: string | null;
}
```

No user ID or synthetic email may appear. Test stable student-language errors, same-origin mutation checks, bounded bodies, exact keys, duplicate operation IDs, and `Retry-After` propagation.

- [ ] **Step 2: Write failing reset-isolation tests**

Inject `SupabaseAccountClient` and `AccountResetAssetService`. Assert that reset:

1. resolves the selected username to one exact user;
2. calls `planReset(userId)`;
3. calls the existing progress RPC with `operation: "reset"`;
4. calls `executeReset(plan)`;
5. leaves the Auth user and password unchanged;
6. returns the same completed result on an idempotent retry;
7. returns `RESET_INCOMPLETE` after progress succeeds but asset deletion is uncertain.

The confirmation must equal the URL username exactly after username normalisation.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 netlify/functions/lib/teacher-account-service.test.ts netlify/functions/teacher-accounts.test.ts
```

- [ ] **Step 4: Implement the service and function**

Reuse `SupabaseAccountClient`, `defaultAccountAssetService`, `deriveSyntheticAccountEmail`, password parsing, and the reset operation order. Keep a small idempotency record in a teacher-only Netlify Blob store keyed by HMAC of operation ID and username; never put the username in a public blob key. An uncertain mutation returns a refresh/reconcile response and must not automatically repeat.

Configure all four custom paths in one modern Netlify function and keep its rate limit separate from student login.

- [ ] **Step 5: Bind and verify the function manifest**

Add `teacher-accounts` to the exact function lists and deployment-layout checks.

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 netlify/functions/lib/teacher-account-service.test.ts netlify/functions/teacher-accounts.test.ts netlify/functions/deploy-layout.test.ts
node --test scripts/build-netlify-functions.test.mjs
```

- [ ] **Step 7: Commit**

```powershell
git add netlify/functions/lib/teacher-account-service.ts netlify/functions/lib/teacher-account-service.test.ts netlify/functions/teacher-accounts.mts netlify/functions/teacher-accounts.test.ts netlify/deploy-functions/teacher-accounts.mts scripts/build-netlify-functions.mjs scripts/build-netlify-functions.test.mjs netlify/functions/deploy-layout.test.ts
git commit -m "feat(teacher): manage pair accounts and resets"
```

### Task 5: Build the teacher dashboard and editable credential workflow

**Files:**
- Create: `web/src/teacher/teacher-client.ts`
- Create: `web/src/teacher/teacher-client.test.ts`
- Create: `web/src/teacher/teacher-dashboard.ts`
- Create: `web/src/teacher/teacher-dashboard.test.ts`
- Create: `web/src/teacher/teacher.css`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `scripts/student-copy-corpus.mjs`

**Interfaces:**

```ts
export interface TeacherClient {
  session(): Promise<{ authenticated: boolean }>;
  login(password: string): Promise<void>;
  logout(): Promise<void>;
  listAccounts(): Promise<readonly TeacherPairSummary[]>;
  createAccount(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<TeacherPairSummary>;
  replacePassword(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<void>;
  resetAccount(input: {
    operationId: string;
    username: string;
    confirmation: string;
  }): Promise<void>;
}
```

- [ ] **Step 1: Write failing client contract tests**

Assert exact routes, methods, JSON schemas, `credentials: "same-origin"`, `redirect: "error"`, bounded timeouts, one bounded 429 retry only for safe GET, content-type checks, byte limits, and no automatic retry for account mutations.

- [ ] **Step 2: Write failing dashboard interaction tests**

Cover:

- teacher password gate;
- account list with aliases only;
- create form with editable password and confirmation;
- optional `Generate password`, `Show password`, and `Copy username and password`;
- 8–128 UTF-8-byte validation beside the password;
- mismatched confirmation beside confirmation;
- success panel that retains copyable username/password until dismissed;
- password replacement warning that old credentials stop working;
- reset dialog listing affected progress/assets, preserved credentials, and exact-username confirmation;
- live-region errors beside the affected control;
- Escape close and focus restoration for every dialog.

Use a manually typed password in the successful creation fixture:

```ts
await user.type(getByLabelText(root, "Password"), "class-pair-12");
await user.type(getByLabelText(root, "Confirm password"), "class-pair-12");
expect(client.createAccount).toHaveBeenCalledWith(expect.objectContaining({
  password: "class-pair-12"
}));
```

- [ ] **Step 3: Run client/dashboard tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/teacher/teacher-client.test.ts web/src/teacher/teacher-dashboard.test.ts web/src/main.test.ts
```

- [ ] **Step 4: Implement the client and accessible dashboard**

Use ordinary `<form>`, `<button>`, `<dialog>`-equivalent DOM and labelled inputs. Do not render a readonly generated password. Do not persist plaintext credentials in localStorage, IndexedDB, query strings, history state, analytics, or logs. The copy action must call `navigator.clipboard.writeText` only after a direct teacher action and must clear its visible success message when the panel closes.

- [ ] **Step 5: Add dashboard copy to the corpus source list**

Teacher copy is operational rather than student teaching copy, but the shared route shell and any text a student could encounter must remain in the coverage scan. Add the new emitter file to the source-coverage allow-list and classify teacher-only entries separately in the corpus metadata rather than silently omitting the file.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/teacher/teacher-client.ts web/src/teacher/teacher-client.test.ts web/src/teacher/teacher-dashboard.ts web/src/teacher/teacher-dashboard.test.ts web/src/teacher/teacher.css web/src/main.ts web/src/main.test.ts scripts/student-copy-corpus.mjs
git commit -m "feat(teacher): add editable classroom credentials"
```

### Task 6: Add the isolated teacher playtest and factory reset

**Files:**
- Create: `web/src/teacher/teacher-playtest-client.ts`
- Create: `web/src/teacher/teacher-playtest-client.test.ts`
- Create: `web/src/teacher/teacher-playtest-controller.ts`
- Create: `web/src/teacher/teacher-playtest-controller.test.ts`
- Create: `netlify/functions/teacher-playtest.mts`
- Create: `netlify/functions/teacher-playtest.test.ts`
- Create: `netlify/deploy-functions/teacher-playtest.mts`
- Modify: `supabase/functions/advertising-game-backend/handler.ts`
- Modify: `netlify/functions/lib/advertising-game-edge-handler.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `scripts/build-netlify-functions.mjs`
- Modify: `scripts/build-netlify-functions.test.mjs`

**Reserved identity:**

```ts
const TEACHER_PLAYTEST_USERNAME = "teacher-playtest";
```

The browser never receives this account's password or Supabase user ID. The Netlify
function derives a high-entropy creation-only password from the server-side teacher
session secret and the fixed reserved username using HMAC-SHA-256. It is sent only
through the gateway-authenticated server call, is never logged, and is not needed for
later playtest access because every operation resolves the reserved user ID server-side.

- [ ] **Step 1: Write failing server tests**

Add a gateway-authenticated `ensure_user` call for the reserved identity. Test teacher-session authorization for:

```text
GET  /api/teacher/playtest/progress
PUT  /api/teacher/playtest/progress
GET  /api/teacher/playtest/assets/:digest
PUT  /api/teacher/playtest/assets/:digest
POST /api/teacher/playtest/reset
```

Reuse the existing campaign size, document, signature, MIME, digest, count and byte ceilings. Reset accepts only:

```json
{
  "schema": "ad-market-teacher-playtest-reset",
  "version": 1,
  "operationId": "<uuid>",
  "confirmation": "RESET"
}
```

Assert the operation never resolves or changes a student user.
Assert the reserved identity is absent from teacher pair lists and cannot be created,
renamed to or authenticated through the ordinary pair-account surface.

- [ ] **Step 2: Write failing browser-controller tests**

Assert:

- `Open teacher playtest` navigates to `/teacher/playtest`;
- the teacher session is checked before game boot;
- the pair login gate is absent;
- a persistent strip reads `Teacher playtest` and offers `Return to teacher dashboard`;
- local drafts use a namespace distinct from every pair username;
- `Factory reset playtest` lists the affected data, requires `RESET`, resets server and local state, and reopens the first screen;
- a cancelled reset changes nothing.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/teacher/teacher-playtest-client.test.ts web/src/teacher/teacher-playtest-controller.test.ts netlify/functions/teacher-playtest.test.ts web/src/main.test.ts
```

- [ ] **Step 4: Implement the server adapter**

Use the existing progress RPC and account asset service with the reserved user ID resolved server-side. Do not issue pair access/refresh cookies. Keep teacher authentication on the teacher cookie. Use the same reset ordering and incomplete-reset response as student-account reset.

- [ ] **Step 5: Implement the browser adapter**

Implement `CloudProgressClient`, asset-client and account-scoped-store adapters against `/api/teacher/playtest/*`. Pass the reserved browser namespace into the existing creator/game bootstrap. The teacher strip is outside the game canvas and remains keyboard accessible.

- [ ] **Step 6: Bind the function and run focused tests**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/teacher/teacher-playtest-client.test.ts web/src/teacher/teacher-playtest-controller.test.ts netlify/functions/teacher-playtest.test.ts netlify/functions/lib/advertising-game-edge-handler.test.ts web/src/main.test.ts
node --test scripts/build-netlify-functions.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/teacher/teacher-playtest-client.ts web/src/teacher/teacher-playtest-client.test.ts web/src/teacher/teacher-playtest-controller.ts web/src/teacher/teacher-playtest-controller.test.ts netlify/functions/teacher-playtest.mts netlify/functions/teacher-playtest.test.ts netlify/deploy-functions/teacher-playtest.mts supabase/functions/advertising-game-backend/handler.ts netlify/functions/lib/advertising-game-edge-handler.test.ts web/src/main.ts web/src/main.test.ts scripts/build-netlify-functions.mjs scripts/build-netlify-functions.test.mjs
git commit -m "feat(teacher): add isolated resettable playtest"
```

### Task 7: Remove teacher controls from the student route and prove device handover

**Files:**
- Modify: `web/src/account/account-gate.ts`
- Modify: `web/src/account/account-gate.test.ts`
- Modify: `web/src/account/account-client.ts`
- Modify: `web/src/account/account-client.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `web/src/account/account.css`

- [ ] **Step 1: Write the failing student-surface tests**

On `/student`, assert:

```ts
expect(queryByRole(root, "button", { name: /teacher setup/i })).toBeNull();
expect(queryByRole(root, "button", { name: /reset progress/i })).toBeNull();
expect(queryByText(root, /teacher setup code/i)).toBeNull();
expect(getByRole(root, "button", { name: "Sign out" })).toBeVisible();
expect(getByText(root, "Sign out before another pair uses this device.")).toBeVisible();
```

Also test a complete device-handover sequence:

1. session reports pair A;
2. pair A signs out;
3. server logout clears cookies;
4. account-scoped local surfaces lock and clear active identity;
5. reload reports unauthenticated;
6. pair B can submit different credentials;
7. no pair A draft, cloud status or asset is opened under pair B.

- [ ] **Step 2: Run the focused account tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/account/account-gate.test.ts web/src/account/account-client.test.ts web/src/main.test.ts
```

- [ ] **Step 3: Simplify the student account gate**

Remove signup switching and self-reset controls from `AccountAccessController`. Rename visible `Log out` to `Sign out` consistently. Keep the existing cookie-order serialiser, identity headers, bounded network policy, cross-tab mutation handling and explicit logout wait.

Do not remove the existing server signup/reset implementations yet; the teacher functions reuse their primitives. Only the student UI and client surface lose those controls.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Run the account regression group**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/account netlify/functions/account-session.test.ts netlify/functions/account-reset.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/account/account-gate.ts web/src/account/account-gate.test.ts web/src/account/account-client.ts web/src/account/account-client.test.ts web/src/main.ts web/src/main.test.ts web/src/account/account.css
git commit -m "fix(student): keep teacher controls off pair devices"
```

## Plan Completion Gate

- [ ] `/`, `/student`, `/teacher`, and `/teacher/playtest` route contracts pass.
- [ ] Teacher authentication is independent, server-verified, secure-cookie based and rate-limited.
- [ ] The teacher can type, confirm, generate, reveal and copy a new pair password.
- [ ] Password replacement uses the Supabase Admin password-update route and invalidates sessions.
- [ ] Teacher account responses contain aliases and operational timestamps only.
- [ ] Pair reset preserves username/password and is idempotent.
- [ ] Teacher playtest state is isolated from every pair and resets only after `RESET`.
- [ ] The student route has no teacher setup, creation, reset or teacher-password surface.
- [ ] Signed-out reload remains signed out and a second pair can use the same device.
- [ ] Focused tests pass and no external service state has changed.
