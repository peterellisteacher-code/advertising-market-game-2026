# Advertising Market Game account, progress, and assets activation

Status: the SQL in `docs/operations/advertising-game-account-progress.sql` was
applied exactly once to Supabase project `jftpeajvpqmxabuscoml` as migration
`20260719071834` (`advertising_game_account_progress_foundation`). A
password-protected Netlify preview is deployed with the account routes failing
closed. The scoped Edge broker migration and function remain pending, so hosted
pair-account provisioning and cloud progress are not yet enabled.

The SQL file is the exact transaction body for Supabase `apply_migration`, not
a standalone SQL-editor script. It deliberately contains no `BEGIN`, `COMMIT`,
`ROLLBACK`, or `START TRANSACTION`: `apply_migration` supplies one outer
transaction around both this body and its migration-ledger write. A local test
harness must supply its own transaction around the unchanged body.

The local harness uses single-connection PGlite. It proves the transaction,
validation, cap, CAS, and compiled advisory-lock ordering branches, but it does
not simulate two PostgreSQL sessions racing one another. A staged same-account
two-request race at the 16-document boundary is therefore a mandatory
pre-student-access deployment hold, specified below. Do not describe the local
sequential cap test as a concurrency test.

Use only the existing paid Supabase project `jftpeajvpqmxabuscoml`. Do not
create or branch another project. The applied migration created only the
private `advertising_game` schema, `progress` table and index, plus the one
public RPC. Ownership remains with the Supabase-managed `postgres` role; the
migration did not create a dedicated role or alter unrelated application
objects or public tables.

Progress saves accept only a canonical CampaignDocumentV1 offline snapshot
whose document ID matches the request envelope, which has a nonempty team ID,
and which has no room binding. Document, session, and team identities must be
pairwise distinct, must use the local-practice safe-ID alphabet and 128-character
limit, and must not reuse the reserved `classroom-campaign` identity. Cloud
document keys have the deliberately narrower lowercase/no-colon 64-character
contract repeated by SQL. One shared cloud predicate protects browser save/load,
server save/load, recovery, and the atomic cloud importer; broader local-only
practice identifiers are not represented as cloud-addressable. Recovery selects
a fresh run identity from four bounded candidates, so even a collision with the
first random candidate remains recoverable.
Every durable `local-blob` reference must have one exact `cloud-blob`
descriptor for the same object, blob key, and MIME type, with a 1-byte to
4-MiB length and lowercase SHA-256. The Netlify function performs the full
document and asset-reference validation before authentication or RPC access;
the SQL save branch repeats the top-level schemaVersion, documentId, offline
mode, nonempty teamId, revision, and no-roomId checks as defense in depth.
The shared browser/server campaign-JSON guard additionally rejects a complete
document above 128 object/array levels or 120,000 object/array nodes, plus
cycles, aliases, accessors, sparse arrays, non-plain objects, and non-JSON
primitive values. It runs before and after schema parsing and before canonical
hashing, so every server-admitted document remains safe for local recovery.

The browser keeps compare-and-swap revisions in a SHA-256-derived, per-account
local-storage namespace. Signing out deactivates that namespace but does not
erase it, just as signing out does not erase the account's IndexedDB draft.
Returning to the same account therefore resumes its last acknowledged cloud
revision without a network lookup; switching accounts selects a different
opaque namespace and cannot reuse another account's revision.
If a save succeeds after its account has been locked or switched, its captured
scope records the acknowledgement only in the original account's namespace and
does not emit UI state into the next account.

Every authenticated progress request, asset transfer, and logout also sends
the tab's canonical username in `x-admarket-account`. After resolving the
HttpOnly cookie session, the server requires an exact match before any RPC,
blob, or logout mutation; a stale tab receives
`409 {"error":"ACCOUNT_IDENTITY_CHANGED"}` and must reauthenticate. The header
is an identity-binding assertion, not a credential. Login, signup, and session
bootstrap remain header-free.

Every browser request that can refresh, rotate, or clear the shared HttpOnly
cookies—including account bootstrap/login/signup/logout, progress list/load/save,
and asset GET/PUT—holds the same origin-wide exclusive Web Lock from before
fetch starts until the response headers have landed and every body the client
uses has been parsed. The Fetch Standard processes `Set-Cookie` response headers
before exposing the response to the caller, so cookie ordering is protected even
when a 401 body is deliberately ignored rather than downloaded or parsed. Every
body the application does consume is strictly byte-bounded. This prevents an
older response in one tab from erasing or replacing cookies set by a newer login
in another tab. Production fails closed with the route-family unavailable error
when Web Locks are unavailable; it never sends an unlocked request. See the
[Fetch Standard cookie processing](https://fetch.spec.whatwg.org/#cookie-infrastructure).
Successful login, signup, and logout also publish an account-free random nonce
through a same-origin storage event so other tabs lock and isolate their local
work promptly. The header check and response-order lock are complementary hard
boundaries if storage events are unavailable or delayed.

## Required Netlify environment

Set these server-only variables in the Netlify site environment. Never use the
gateway secret or any Supabase secret key in Vite variables, browser code,
HTML, logs, or a repository. Netlify receives no general Supabase secret key:
its two privileged operations pass through the purpose-built
`advertising-game-backend` Edge Function.

```text
SUPABASE_URL=<existing project HTTPS API URL>
SUPABASE_PUBLISHABLE_KEY=<existing project publishable key>
ADVERTISING_GAME_EDGE_GATEWAY_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_USERNAME_HMAC_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_CLASSROOM_CODE=<8 to 128 character classroom access code>
ADVERTISING_GAME_ASSET_NAMESPACE_SECRET=<32 to 256 byte random server secret>
```

The Edge Function receives Supabase's built-in `SUPABASE_SECRET_KEYS` dictionary
or legacy `SUPABASE_SERVICE_ROLE_KEY`; neither value leaves Supabase. It accepts
only the two broker envelopes used for confirmed synthetic-account creation and
the existing progress RPC. Netlify authenticates with
`ADVERTISING_GAME_EDGE_GATEWAY_SECRET`. The database stores only that secret's
SHA-256 digest in `advertising_game.backend_gateway`, and the sole authorization
RPC is executable only by `service_role`. `verify_jwt=false` is intentional:
the handler performs this separate gateway authentication before parsing an
operation.

Supabase Auth must have email/password sign-in enabled. Account creation is a
teacher-only provisioning action: the teacher chooses a pair username, the
game generates a unique 20-character password using Web Crypto, and the teacher
privately gives those two credentials to that pair. The generator guarantees
upper-case, lower-case, and digit characters and omits ambiguous characters.
The classroom setup code authorises provisioning only; it is not a student
login or a shared master password.

The server maps the username to an opaque HMAC-derived synthetic email and
creates the confirmed Supabase Auth account, so neither students nor the
browser UI need an email address and SMTP is not required. Confirm the project
password policy accepts the application's bounded 8–128 byte passwords before
enabling provisioning. The hosted project's acceptance of the synthetic
`accounts.admarket.invalid` domain is not yet verified: before activation, use
the intended server credentials to create one preflight account through the
same Admin API path, sign in through the same password path, and stop if either
operation fails. Do not enable pair provisioning on an assumption about email
validation.

Netlify Blobs needs no additional credential variable when the function runs in
the deployed site context. Assets use the strongly consistent site store
`advertising-game-account-assets-v1`. Each authenticated account is isolated by
a private HMAC namespace, and the namespace secret must be different from the
username HMAC secret. The API accepts only signature-verified PNG, JPEG, or
WebP bytes; the immutable SHA-256 URL is idempotent; SVG is rejected. Limits are
4 MiB per asset, 32 assets per account, and 32 MiB total per account. There is
no delete endpoint.

## Activation status and remaining holds

Completed on 2026-07-19:

1. The shared-project collision preflight returned zero rows.
2. The SQL received one fresh independent security review.
3. The exact transaction body was applied once through Supabase migration
   `20260719071834`; the migration ledger and catalogue were checked before any
   retry after ambiguous earlier transport failures.
4. The post-application catalogue, ACL, RLS, function, index, and read-only RPC
   checks below passed. `signal_lost` objects remained present and untouched.
5. `advertising_game` remains private and is not exposed through Data API
   settings. It has RLS enabled with no direct policies, direct privileges are
   revoked even from `service_role`, and the public RPC is the only data path.

Remaining deployment holds:

1. Run a shared-project collision preflight for
   `advertising_game.backend_gateway` and
   `public.advertising_game_backend_authorized`, then apply the exact broker
   migration once.
2. Deploy `advertising-game-backend`, set
   `ADVERTISING_GAME_EDGE_GATEWAY_SECRET` in Netlify, and confirm unauthenticated
   broker requests fail closed.
3. Complete the hosted synthetic-email provisioning/sign-in preflight above.
4. Deploy a fresh preview and complete the staged same-origin verification
   below before publishing student access.

### Shared-project collision preflight (completed)

This was the read-only query run before applying the migration:

```sql
select 'schema' as object_type,
       n.oid::pg_catalog.regnamespace::text as object_name,
       pg_catalog.pg_get_userbyid(n.nspowner) as owner
from pg_catalog.pg_namespace n
where n.nspname = 'advertising_game'
union all
select 'relation',
       c.oid::pg_catalog.regclass::text,
       pg_catalog.pg_get_userbyid(c.relowner)
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'advertising_game'
  and c.relname = 'progress'
union all
select 'function',
       p.oid::pg_catalog.regprocedure::text,
       pg_catalog.pg_get_userbyid(p.proowner)
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'advertising_game_progress_rpc';
```

Recorded result before application: zero rows. Any schema, relation, or
function row would have been a collision hold.

## Post-application verification

Run these read-only checks in the Supabase SQL editor:

```sql
select version, name
from supabase_migrations.schema_migrations
where version = '20260719071834';

select 'schema' as object_type,
       n.nspname as object_name,
       pg_catalog.pg_get_userbyid(n.nspowner) as owner
from pg_catalog.pg_namespace n
where n.nspname = 'advertising_game'
union all
select 'relation',
       c.oid::pg_catalog.regclass::text,
       pg_catalog.pg_get_userbyid(c.relowner)
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'advertising_game'
  and c.relname = 'progress'
union all
select 'function',
       p.oid::pg_catalog.regprocedure::text,
       pg_catalog.pg_get_userbyid(p.proowner)
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'advertising_game_progress_rpc';

select pg_catalog.count(*) as dedicated_role_count
from pg_catalog.pg_roles
where rolname = 'advertising_game_progress_owner_20260718';

select pg_catalog.count(*) as named_rpc_count,
       pg_catalog.count(*) filter (
         where p.oid = pg_catalog.to_regprocedure(
           'public.advertising_game_progress_rpc(uuid,text,text,text,integer,bigint,jsonb)'
         )
       ) as exact_signature_count
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'advertising_game_progress_rpc';

select i.oid::pg_catalog.regclass as index_name,
       pg_catalog.pg_get_indexdef(i.oid) as index_definition
from pg_catalog.pg_class i
join pg_catalog.pg_namespace n on n.oid = i.relnamespace
where n.nspname = 'advertising_game'
  and i.relname = 'advertising_game_progress_updated_at_idx'
  and i.relkind = 'i';

select n.nspname as schema_name,
       pg_catalog.pg_get_userbyid(n.nspowner) as schema_owner,
       n.nspacl as schema_acl,
       pg_catalog.has_schema_privilege('anon', n.oid, 'USAGE') as anon_schema_usage,
       pg_catalog.has_schema_privilege('authenticated', n.oid, 'USAGE') as authenticated_schema_usage,
       pg_catalog.has_schema_privilege('service_role', n.oid, 'USAGE') as service_schema_usage,
       c.relname as table_name,
       pg_catalog.pg_get_userbyid(c.relowner) as table_owner,
       c.relacl as table_acl,
       c.relrowsecurity as rls_enabled,
       pg_catalog.has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as anon_table_dml,
       pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as authenticated_table_dml,
       pg_catalog.has_table_privilege('service_role', c.oid, 'SELECT, INSERT, UPDATE, DELETE') as service_table_dml
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'advertising_game'
  and c.relname = 'progress';

select pg_catalog.count(*) as direct_policy_count
from pg_catalog.pg_policies
where schemaname = 'advertising_game'
  and tablename = 'progress';

select p.oid::pg_catalog.regprocedure as function_signature,
       pg_catalog.pg_get_userbyid(p.proowner) as function_owner,
       p.proacl as function_acl,
       p.prosecdef as security_definer,
       p.proconfig as function_settings,
       p.proconfig = array['search_path=""']::pg_catalog.text[]
         as exact_empty_search_path,
       pg_catalog.has_function_privilege(
         'anon',
         p.oid,
         'EXECUTE'
       ) as anon_can_execute,
       pg_catalog.has_function_privilege(
         'authenticated',
         p.oid,
         'EXECUTE'
       ) as authenticated_can_execute,
       pg_catalog.has_function_privilege(
         'service_role',
         p.oid,
         'EXECUTE'
       ) as service_role_can_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'advertising_game_progress_rpc';
```

Recorded result: migration `20260719071834` has one ledger row; the schema,
table, and function owners are the Supabase-managed `postgres` role;
`dedicated_role_count=0`; RLS is enabled; all three schema-usage and table-DML
checks are false; there are zero direct policies; `named_rpc_count=1`;
`exact_signature_count=1`; and there is exactly one index row whose definition is
`CREATE INDEX advertising_game_progress_updated_at_idx ON advertising_game.progress USING btree (user_id, updated_at DESC)`;
`security_definer=true`; `exact_empty_search_path=true` and the function
settings contain no other entry;
`anon_can_execute=false`; `authenticated_can_execute=false`; and
`service_role_can_execute=true`. Treat an unexpected owner, ACL, dedicated
role, signature, overload, or row count as a deployment hold.

### Rollback boundary

Disable the Netlify account routes first and confirm whether progress records
must be retained. An authorised operator may then revoke the RPC execution
grant, remove only the exact seven-argument RPC, archive or remove only
`advertising_game.progress`, and remove `advertising_game` only after it is
empty. Do not alter the Supabase-managed `postgres` owner role. A rollback must
stop rather than use `CASCADE` or modify unrelated objects.

Then exercise the deployed same-origin API with two temporary classroom
accounts:

1. Save revision 1 for the same `documentId` under both accounts and verify
   each account loads only its own document.
2. Call authenticated `GET /api/account/progress` with no query string for
   each account. Verify the exact `{schema: "advertising-game-progress",
   version: 1, documents: [...]}` response, at most 16 metadata records, newest
   `updatedAt` first with ascending ASCII-ordinal `documentId` ties, and no document bodies,
   user IDs, emails, or tokens. Verify each account sees only its own records.
3. Save again with the exact current revision and verify it increments by one.
4. Repeat with a stale revision and verify HTTP 409 returns only
   `REVISION_CONFLICT` and `currentRevision`, not document data.
5. Verify the 17th distinct document returns `DOCUMENT_LIMIT_REACHED`, while
   discovery remains capped at 16 records.
6. For one disposable account, preload exactly 15 distinct documents, then
   issue two genuinely concurrent, independent save requests for different
   16th and 17th document IDs. Verify exactly one save succeeds, exactly one
   returns `DOCUMENT_LIMIT_REACHED`, and a fresh discovery call returns exactly
   16 distinct documents. Treat any other outcome as a deployment hold.
7. Verify queryless discovery accepts no query parameters, exact-document load
   accepts only one valid `documentId`, and all duplicate or unexpected query
   keys fail closed.
8. Open two tabs. Admit account A in the first, then replace the shared cookie
   session with account B in the second. Verify every stale A progress request,
   asset GET/PUT, and logout sends `x-admarket-account: A`, receives only
   `ACCOUNT_IDENTITY_CHANGED`, performs no RPC/blob/logout mutation, preserves
   B's rotated cookies, and locks the first tab. Confirm a same-account request
   remains successful and neither responses nor storage-event values expose a
   user ID, token, or username.
9. Repeat with an intentionally delayed A logout response, progress response,
   and asset response. Start B login while each A response is pending. Verify B
   login does not begin until the pending response has completely landed, then
   verify B remains authenticated after it completes. Disable `navigator.locks`
   and verify account, progress, and asset clients fail closed without sending.
10. Expire an access token and verify a valid refresh rotates both HttpOnly,
   Secure, SameSite=Strict cookies; expire both and verify HTTP 401 plus cookie
   clearing.
11. Confirm responses and Netlify logs contain no synthetic email, Supabase user
    ID, access token, refresh token, URL, publishable key, gateway secret, or
    Supabase secret key.
12. PUT one valid PNG, JPEG, and WebP at each byte-derived SHA-256 URL; GET each
   byte-for-byte; verify a repeated PUT is idempotent and SVG, MIME/signature
   mismatch, wrong digest, and a body above 4 MiB are rejected.
13. With two accounts, verify the same digest is independently authorised; the
   33rd distinct asset and total bytes above 32 MiB are rejected; and no API
   method can delete an asset.

Rotate the classroom code between cohorts. Rotate the HMAC secret only with an
explicit account migration plan: changing it changes every synthetic login
email and otherwise makes existing usernames unable to sign in. Rotating
`ADVERTISING_GAME_ASSET_NAMESPACE_SECRET` makes existing asset namespaces
unreachable unless a namespace migration is completed first.

The provisioning response deliberately retains `USERNAME_UNAVAILABLE` for an
exact duplicate. This is an accepted username-enumeration trade-off for
teacher-only classroom setup: the caller must possess the setup code,
provisioning is rate-limited to 30 requests per minute per IP/domain, each pair
receives unique generated credentials, and no synthetic email, user ID, or
token is returned. Revisit this decision if the account surface becomes
public.
