# Account and Cloud Progress Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a same-origin username/password account API and private, revisioned Supabase progress persistence without exposing credentials, tokens, synthetic email addresses, or user IDs.

**Architecture:** Netlify Request/Response functions own every Supabase interaction. A direct-fetch Auth/RPC adapter receives injected `fetch` for tests; account handlers retain access and refresh tokens only in secure HttpOnly cookies and derive the database user ID from `/auth/v1/user`. A local idempotent SQL draft creates only `advertising_game.progress` and `public.advertising_game_progress_rpc`, with the table private and the SECURITY DEFINER RPC executable only by `service_role`.

**Tech Stack:** TypeScript 7, Vitest 4, Netlify Functions v2, standards-based Fetch, Supabase Auth REST and PostgREST RPC, PostgreSQL/PLpgSQL.

## Global Constraints

- Reuse Supabase project `jftpeajvpqmxabuscoml`; do not create or branch a project.
- Do not change or collide with `signal_lost.progress`, `signal_lost.settings`, `public.signal_lost_progress_rpc`, or `signal-lost-progress`.
- Do not change unrelated public quiz/game tables.
- Do not apply a migration or deploy a function; write local artifacts only.
- Keep browser contracts username/password-only and never expose secret/service-role keys, tokens, synthetic email addresses, or Supabase user IDs.
- Use `advertising_game` for private tables and the `advertising_game_` prefix for public RPC names.
- Keep progress request bodies at or below 256 KiB, cap an account at 16 documents, and use compare-and-swap revisions.
- Preserve the existing `netlify/functions/lib/account-primitives.ts` behavior except for compatible extensions.

---

### Task 1: Account security and Supabase transport primitives

**Files:**
- Create: `netlify/functions/lib/account-backend.test.ts`
- Create: `netlify/functions/lib/account-backend.ts`
- Modify: `netlify/functions/lib/account-primitives.test.ts`
- Modify: `netlify/functions/lib/account-primitives.ts`

**Interfaces:**
- Produces: `parseAccountEnvironment`, `secureAccountCodeMatches`, bounded JSON/response helpers, cookie parsing/clearing, `SupabaseAccountClient`, and `resolveAccountSession`.
- Consumes: `normaliseAccountUsername`, `deriveSyntheticAccountEmail`, and existing cookie serializers.

- [ ] **Step 1: Write failing primitive tests** for strict Supabase URL/key/secret parsing, legacy-role validation, constant-time classroom-code comparison, origin enforcement, body limits, safe headers, cookie clearing, Auth requests, refresh rotation, derived user identity, RPC service headers, and upstream error classification.
- [ ] **Step 2: Run `pnpm exec vitest run --no-cache --configLoader runner netlify/functions/lib/account-primitives.test.ts netlify/functions/lib/account-backend.test.ts`** and confirm failures are missing exports/modules.
- [ ] **Step 3: Implement the minimal primitives** using `node:crypto`, Web Fetch APIs, bounded validators, and injected fetch. Do not log or interpolate secrets into errors.
- [ ] **Step 4: Re-run the focused tests** and require zero failures.

### Task 2: Same-origin account API

**Files:**
- Create: `netlify/functions/account-session.test.ts`
- Create: `netlify/functions/account-session.mts`

**Interfaces:**
- Consumes: account backend primitives and `SupabaseAccountClient`.
- Produces: `createAccountSessionHandler` for `POST /api/account/signup`, `POST /api/account/login`, `GET /api/account/session`, and `POST /api/account/logout`.

- [ ] **Step 1: Write failing route tests** covering signup access-code enforcement, duplicate signup, generic login failure, secret redaction, cookies, same-origin POSTs, refresh rotation, expired sessions, logout clearing, configuration failure, and upstream failure mapping.
- [ ] **Step 2: Run `pnpm exec vitest run --no-cache --configLoader runner netlify/functions/account-session.test.ts`** and confirm the missing handler causes failure.
- [ ] **Step 3: Implement the minimal handler** with server-only synthetic email derivation, admin confirmed-user creation followed by password sign-in, safe session refresh, no-store/security headers, and native Netlify rate limits.
- [ ] **Step 4: Re-run the route tests** and require zero failures.

### Task 3: Revisioned cloud progress API

**Files:**
- Create: `netlify/functions/account-progress.test.ts`
- Create: `netlify/functions/account-progress.mts`

**Interfaces:**
- Consumes: authenticated `SupabaseAccountClient` identity derived from `/auth/v1/user`.
- Produces: `createAccountProgressHandler` for `GET/PUT /api/account/progress` with `{schema, version, documentId, revision, document}` responses and compare-and-swap writes.

- [ ] **Step 1: Write failing route tests** covering 256 KiB enforcement, schema/version/document ID validation, first insert, exact load, revision conflicts without document leakage, cross-user isolation through derived IDs, refresh, unauthorized/expired sessions, RPC service-role headers, and upstream failures.
- [ ] **Step 2: Run `pnpm exec vitest run --no-cache --configLoader runner netlify/functions/account-progress.test.ts`** and confirm the missing handler causes failure.
- [ ] **Step 3: Implement the minimal handler**; never accept a user ID from body/query and map RPC statuses to bounded public responses.
- [ ] **Step 4: Re-run the progress tests** and require zero failures.

### Task 4: Deploy wrappers, SQL draft, and operations handoff

**Files:**
- Create: `netlify/deploy-functions/account-session.mts`
- Create: `netlify/deploy-functions/account-progress.mts`
- Modify: `netlify/deploy-layout.test.ts`
- Create: `docs/operations/advertising-game-account-progress.sql`
- Create: `docs/operations/advertising-game-account-progress.md`

**Interfaces:**
- Produces: Netlify-static-discoverable wrappers, an unapplied SQL migration draft, and operator instructions containing environment variable names/placeholders only.

- [ ] **Step 1: Extend the layout test first** to require both wrapper files, route arrays, and rate-limit metadata; run it and confirm failure because wrappers are absent.
- [ ] **Step 2: Add thin wrappers** that re-export tested source handlers and repeat literal route/rate-limit config; re-run the layout test.
- [ ] **Step 3: Add the SQL draft** with private table, `auth.users` cascade FK, checks/index/RLS, document limit and CAS in `public.advertising_game_progress_rpc`, empty search path, explicit revokes, and service-role-only execute. Include non-executable rollback notes only.
- [ ] **Step 4: Add the operations note** with required Netlify variable names, pending SQL application, and post-application privilege/isolation/CAS verification queries; include no values.

### Task 5: Final verification

**Files:** All files above.

- [ ] **Step 1: Run all owned tests** with `pnpm exec vitest run --no-cache --configLoader runner` and report the exact pass/fail counts.
- [ ] **Step 2: Run strict TypeScript** with `pnpm exec tsc --noEmit --pretty false` and report the exit status, separating any unrelated concurrent failures from owned-file failures.
- [ ] **Step 3: Inspect `git diff --` for owned paths** and verify no UI, package, external schema, signal-lost, or secret-bearing file changed.
- [ ] **Step 4: Reconcile every assignment requirement** against tests/artifacts before handing the paths and pending external settings to the parent.

