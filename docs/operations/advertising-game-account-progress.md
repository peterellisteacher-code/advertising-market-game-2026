# Account, progress and asset activation

The optional account service adds pair credentials, cloud progress and owned
image storage. Each installation must use its own Supabase project, Netlify
site, secrets and disposable validation accounts.

## Routes and sessions

Pairs sign in only at `/student`. Teachers sign in only at `/teacher`.
Teacher authentication uses a separate secure, HttpOnly session and never
reuses a pair cookie or classroom provisioning code.

Configure these additional teacher-only server values:

```text
ADVERTISING_GAME_TEACHER_PASSWORD=<8 to 128 byte teacher password>
ADVERTISING_GAME_TEACHER_SESSION_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_TEACHER_SESSION_HOURS=<whole number from 1 to 24>
```

The teacher password and session secret must remain server-only. Do not put
either value in Vite variables, browser code, HTML, logs or source control.

`/teacher/playtest` is protected by the same teacher session but stores the
game under the reserved server identity `teacher-playtest`. That username
cannot be created, replaced or reset through ordinary pair administration.
The server resolves its password and Supabase user ID; neither is returned to
the browser. Its cloud progress, owned assets and browser storage namespace
are separate from every pair account.

## Pair credentials and resets

The teacher dashboard creates a pair with a teacher-entered password or an
optional generated password. Plaintext is shown only in the immediate
credential panel so the teacher can copy it; later account listings do not
return it.

Replacing a pair password immediately invalidates the old password and the
existing pair session. The pair must sign in again with the replacement
password.

Resetting a selected pair requires the teacher to type that pair's exact
username. It removes that account's progress, drafts, advertisement designs,
uploaded images and cloud saves while retaining its username and password.
This operation is separate from a pair's own exact-`RESET` account reset.

The teacher playtest factory reset also requires exact `RESET`. It resets the
reserved account's server progress and assets first, then clears only the
isolated teacher-playtest browser state and opens the first game screen.
Cancellation changes no remote or local state.

## Database foundation

Choose the target explicitly:

```text
SUPABASE_PROJECT_REF=<project-ref>
```

Run a read-only shared-project collision preflight before applying anything.
Stop if the `advertising_game` schema, `advertising_game.progress`,
`advertising_game.backend_gateway`,
`public.advertising_game_progress_rpc` or
`public.advertising_game_backend_authorized` already exists unexpectedly.
Never modify unrelated schemas or application objects.

Migration `20260719071834` uses the exact transaction body in
`docs/operations/advertising-game-account-progress.sql`; apply exactly once
through the chosen migration system. The file deliberately omits `BEGIN`,
`COMMIT` and migration-ledger statements because the migration runner supplies
the outer transaction. Apply the Edge gateway migration exactly once as a
separate, reviewed step.

After application, use read-only catalogue checks to confirm:

- the migration ledger contains one `20260719071834` row;
- the schema, table, index and exact RPC signatures exist once;
- row-level security is enabled and there are no direct table policies;
- `has_schema_privilege` is false for browser-facing roles;
- `has_table_privilege` is false for browser-facing roles and `service_role`;
- only `service_role` can execute the narrowly scoped RPCs;
- each security-definer Function has an empty `search_path`; and
- no unexpected owner, overload, role, grant or neighbouring object changed.

The progress RPC enforces per-user ownership, a 16-document cap, bounded JSON,
compare-and-swap revisions and advisory-lock ordering. The reset operation
deletes only the authenticated user's progress while holding the same lock.

## Server-only environment

Configure these values in the server runtime:

```text
SUPABASE_URL=<project HTTPS API URL>
SUPABASE_PUBLISHABLE_KEY=<project publishable key>
ADVERTISING_GAME_EDGE_GATEWAY_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_USERNAME_HMAC_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_CLASSROOM_CODE=<8 to 128 character classroom access code>
ADVERTISING_GAME_ASSET_NAMESPACE_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_TEACHER_PASSWORD=<8 to 128 byte teacher password>
ADVERTISING_GAME_TEACHER_SESSION_SECRET=<32 to 256 byte random server secret>
ADVERTISING_GAME_TEACHER_SESSION_HOURS=<whole number from 1 to 24>
```

Never place a Supabase secret key, gateway secret, classroom code or HMAC
secret in Vite variables, browser code, HTML, logs or source control. The
Supabase Edge broker keeps its secret key inside Supabase and accepts only the
account-creation and progress envelopes used by this application.

Account provisioning is teacher-only. The server maps a pair username to an
HMAC-derived synthetic address under `accounts.admarket.invalid`, then creates
a confirmed password account. Before activation, verify that the chosen
Supabase Auth configuration accepts this domain and the generated password
format through the exact server and sign-in paths.

The response deliberately distinguishes an unavailable username. This is an
accepted username-enumeration trade-off only while provisioning requires the
teacher setup code, is rate-limited and returns no synthetic email, user ID or
token. Reassess that trade-off before exposing provisioning more broadly.

## Progress and assets

Cloud saves accept only bounded offline `CampaignDocumentV1` snapshots. The
document identity in the request must match the document, and cloud identifiers
use the narrower safe-ID contract enforced by both browser and server.
Compare-and-swap revisions remain isolated per account.

Owned images use the strongly consistent Netlify Blobs store
`advertising-game-account-assets-v1`. The namespace secret must differ from
the username HMAC secret. The API accepts signature-verified PNG, JPEG or WebP
data at immutable SHA-256 URLs. Limits are 4 MiB per asset, 32 assets per
account and 32 MiB total per account. SVG is rejected, repeated identical PUTs
are idempotent, and there is no delete endpoint.

## Hosted validation gate

Before student access, use disposable accounts on a fresh hosted preview:

1. Save and load one document under two accounts; confirm strict isolation.
2. Verify discovery returns at most 16 metadata records and never returns
   document bodies, user IDs, email addresses or tokens.
3. Verify current revisions advance, stale writes return only
   `REVISION_CONFLICT` plus the current revision, and the 17th document fails.
4. Race two independent saves at the 16-document boundary. Exactly one must
   succeed and the final list must contain exactly 16 documents.
5. Switch accounts in a second tab while progress, asset and logout requests
   are delayed. Stale requests must fail with `ACCOUNT_IDENTITY_CHANGED`
   without mutating the new session.
6. Verify refresh rotates the secure HttpOnly cookies and terminal expiry
   clears them.
7. Upload valid PNG, JPEG and WebP data; verify byte-exact reads, idempotent
   duplicate PUTs, signature/MIME/digest rejection and all byte/count limits.
8. Inspect responses and logs. Confirm they expose no synthetic address,
   Supabase user ID, token, URL, publishable key or secret.

Rotate classroom codes between cohorts. Rotate either HMAC secret only with an
explicit migration plan because doing so changes login identities or asset
namespaces.

Password replacement and reset requests carry idempotent operation IDs. If an
operator receives an uncertain response, inspect the account and operation
state before issuing a new mutation. Do not assume a browser timeout means the
server did nothing.

## Rollback boundary

Disable the account routes first and decide whether progress must be retained.
An authorised operator may then revoke only the exact RPC grants and remove
only the named Advertising Market objects. Stop rather than use `CASCADE` or
alter unrelated data.
