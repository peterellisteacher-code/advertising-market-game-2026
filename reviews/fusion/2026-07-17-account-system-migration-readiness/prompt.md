# Advertising Market Game account/cloud system — migration-readiness review

Act as an independent, adversarial coding and security architecture panel. Review the self-contained design and implementation excerpts below. Do not assume a preferred verdict. Try to construct concrete counterexamples that break identity isolation, fail-closed authentication, local-first durability, compare-and-swap correctness, private asset restoration, redirect safety, response bounds, or SQL least privilege.

Return a concise Opus synthesis containing:

1. findings by severity with the exact excerpt/component implicated;
2. invariants that withstand attack;
3. live-only checks that source cannot prove;
4. a terminal `READY FOR CONTROLLED MIGRATION` or `NOT READY` verdict.

## Acceptance constraints

- A classroom pair creates a username/password using a teacher-held classroom code.
- Godot and the creator remain hidden/inert until authentication and account-scoped local storage activation succeed.
- Saves commit locally first; transient cloud failure must not destroy or block local work.
- Progress and uploaded rasters are private per authenticated account.
- Supabase service credentials are server-only and must never follow redirects.
- Browser account/progress/asset responses reject redirects and are stream-bounded independently of `Content-Length`.
- Discovered 401 authentication expiry fails closed and isolates the activated store.
- Only canonical offline `CampaignDocumentV1` documents with no room binding or transient Fabric `blob:` URLs may enter private cloud progress.
- Every durable local raster reference has exactly one consistent cloud descriptor; recovery verifies downloads and imports document/blobs/checkpoint/operation/run atomically.
- CAS revision metadata is hashed and per account, survives logout and account switches, and must not require a cloud lookup when a valid local draft already exists.
- The proposed Supabase migration must not touch existing `signal_lost` objects. Direct table access remains revoked; only a service-role RPC may operate on the caller-derived Auth user ID.
- This is a pre-deployment review: live Supabase/Netlify behavior must be listed separately.

## Account namespace and CAS metadata

```ts
const VALIDATED_ACCOUNT_USERNAME = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
export async function accountStorageNamespace(username: string): Promise<string> {
  if (!VALIDATED_ACCOUNT_USERNAME.test(username)) throw new Error("validated username required");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(username));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

const STORAGE_PREFIX = "admarket-cloud-sync@2:";
const REVISION_PREFIX = `${STORAGE_PREFIX}revision:`;
const DOCUMENT_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/u;

class BrowserCloudSyncMetadataStore {
  #activationGeneration = 0;
  #namespace: string | null = null;
  constructor(private storage = localStorage) {}

  async activateAccount(username: string): Promise<void> {
    const generation = ++this.#activationGeneration;
    this.#namespace = null;
    const namespace = await accountStorageNamespace(username);
    if (generation !== this.#activationGeneration) throw new DOMException("superseded", "AbortError");
    this.#namespace = namespace;
  }
  deactivateAccount(): void { this.#activationGeneration += 1; this.#namespace = null; }
  getRevision(documentId: string): number {
    const key = this.#revisionKey(documentId);
    if (key === null) return 0;
    const raw = this.storage.getItem(key);
    if (raw === null || !/^\d+$/.test(raw)) return 0;
    const revision = Number(raw);
    return Number.isSafeInteger(revision) && revision > 0 ? revision : 0;
  }
  setRevision(documentId: string, revision: number): void {
    const key = this.#revisionKey(documentId);
    if (key === null || !Number.isSafeInteger(revision) || revision < 1) return;
    this.storage.setItem(key, String(revision));
  }
  #revisionKey(documentId: string): string | null {
    if (this.#namespace === null || !DOCUMENT_ID.test(documentId)) return null;
    return `${REVISION_PREFIX}${this.#namespace}:${documentId}`;
  }
}
```

The account-scoped IndexedDB store uses the same namespace digest in database name `advertising-market-campaign-drafts-account-${digest}`. Activation opens/resumes the candidate DB before installing it; deactivation increments a generation and nulls the active delegate. All public draft methods throw while inactive.

## Synchronisation lifecycle

```ts
class CloudProgressSync {
  #blockedDocuments = new Set<string>();
  #account: string | null = null;
  #accountEpoch = 0;
  #tail: Promise<void> = Promise.resolve();

  async setAccount(username: string): Promise<void> {
    const accountEpoch = ++this.#accountEpoch;
    this.#account = null;
    this.#blockedDocuments.clear();
    await this.#metadata.activateAccount(username);
    if (accountEpoch !== this.#accountEpoch) return;
    this.#account = username;
    this.#emit({ phase: "idle" });
  }
  signOut(): void {
    this.#accountEpoch += 1;
    this.#account = null;
    this.#blockedDocuments.clear();
    this.#metadata.deactivateAccount();
    this.#emit({ phase: "signed-out" });
  }
  enqueue(document: CampaignDocumentV1): void {
    if (this.#account === null || document.mode !== "offline" ||
        this.#blockedDocuments.has(document.documentId)) return;
    const snapshot = structuredClone(document);
    const accountEpoch = this.#accountEpoch;
    this.#tail = this.#tail.catch(() => undefined).then(() => this.#sync(snapshot, accountEpoch));
  }
  async #sync(document: CampaignDocumentV1, accountEpoch: number): Promise<void> {
    if (!this.#isCurrentAccount(accountEpoch) || this.#blockedDocuments.has(document.documentId)) return;
    try {
      const prepared = await this.#assetAdapter.prepare(document);
      if (!this.#isCurrentAccount(accountEpoch)) return;
      if (prepared.mode !== "offline" || prepared.documentId !== document.documentId ||
          prepared.revision !== document.revision) throw new Error("identity mismatch");
      const expectedRevision = this.#metadata.getRevision(prepared.documentId);
      const result = await this.#client.save(prepared, expectedRevision);
      if (!this.#isCurrentAccount(accountEpoch)) return;
      if (result.status === "saved") {
        this.#metadata.setRevision(document.documentId, result.revision);
        this.#emit({ phase: "synced", documentId: document.documentId, revision: result.revision });
        return;
      }
      this.#blockedDocuments.add(document.documentId);
      const remote = await this.#client.load(document.documentId);
      if (!this.#isCurrentAccount(accountEpoch)) return;
      this.#emit({ phase: "conflict", documentId: document.documentId,
                   currentRevision: result.currentRevision,
                   ...(remote.status === "found" ? { remote } : {}) });
    } catch (error) {
      if (!this.#isCurrentAccount(accountEpoch)) return;
      if ((error instanceof AccountClientError || error instanceof AccountAssetClientError) &&
          error.code === "AUTHENTICATION_REQUIRED") {
        this.#accountEpoch += 1; this.#account = null; this.#blockedDocuments.clear();
        this.#metadata.deactivateAccount(); this.#emit({ phase: "signed-out" });
        try { this.#onAuthenticationRequired?.(); } catch {}
        return;
      }
      this.#emit({ phase: "offline", documentId: document.documentId });
    }
  }
}
```

Account admission activates the IndexedDB store, then awaits `cloudSync.setAccount`, then performs recovery. Any recovery/authentication error calls `cloudSync.signOut()`, deactivates IndexedDB, and rethrows an authentication-required error to the locked account gate. Normal signout locks the UI immediately, calls `cloudSync.signOut()`, disposes account work, deactivates IndexedDB, then reloads.

Recovery first asks the active account-scoped IndexedDB store for a local practice. If present, it returns immediately without a cloud call. Otherwise it lists newest cloud metadata, loads one document, restores every asset, independently SHA-256 verifies each blob, atomically imports document/revision blobs/checkpoint/operation/run in one five-store IndexedDB transaction, then seeds the server CAS revision. Authentication errors are rethrown; other cloud errors return an unavailable status without unlocking a different account.

## Browser transport rules

All account/progress/asset fetches pass `credentials: "same-origin"` and `redirect: "error"`, then also reject `response.redirected`. JSON is consumed via `ReadableStream.getReader()` with limits: account/error 8 KiB, list 16 KiB, loaded progress 272 KiB, asset JSON 16 KiB. Binary asset GET reads at most 4 MiB + 1 even if `Content-Length` lies, then requires declared length, MIME signature, byte length, and SHA-256 to match. Progress `#fetch` throws `AUTHENTICATION_REQUIRED` on status 401 before parsing any body. Asset errors do the same.

## Server authentication and Supabase transport

The server validates the Supabase URL as exact `https://<20 lowercase chars>.supabase.co`, accepts bounded modern publishable/secret keys or legacy JWT roles, and keeps all secret keys in Netlify-only variables. Every Supabase request is centralized as:

```ts
private async request(path: string, init: RequestInit): Promise<Response> {
  try {
    const response = await this.fetcher(`${this.environment.supabaseUrl}${path}`, {
      ...init,
      redirect: "error"
    });
    if (response.redirected) throw new SupabaseAccountError("upstream");
    return response;
  } catch { throw new SupabaseAccountError("upstream"); }
}
```

Upstream response bodies are streamed with explicit bounds. Auth identity comes from `/auth/v1/user`; the UUID and admin-controlled `app_metadata.advertising_game_username` are validated. Expired access tokens may rotate via an HttpOnly, Secure, SameSite=Strict refresh cookie. Mutating browser requests require exact `Origin === new URL(request.url).origin`. Account cookies are scoped to `/api/account`.

Signup validates exact JSON keys, username format, 8–128 UTF-8-byte password, and a constant-time classroom-code comparison. It derives an HMAC synthetic email and uses the secret Admin API only server-side, then signs in with the publishable key.

## Canonical progress validation

The Netlify progress PUT parses the exact envelope and `CampaignDocumentSchema`, then requires offline mode, absent `roomId`, matching envelope/document ID, and validates all semantic Fabric objects. Any Fabric `src` whose trimmed lowercase form starts `blob:` is rejected. Every exact `local-blob` reference must have one exact `cloud-blob` descriptor with the same object ID/blob key/MIME; descriptors require 1–4 MiB integer length and lowercase SHA-256. The referenced Fabric source must be `local-blob:${blobKey}`. Duplicate or inconsistent blob-key/hash aliases are rejected. The same validator is applied again to documents returned by the progress RPC before the server sends them to the browser.

Private account assets are PNG/JPEG/WebP only, signature checked, max 4 MiB each, max 32 objects and 32 MiB total per account. Netlify Blobs keys use an HMAC(user UUID) namespace and SHA-256 object key. The store uses strong consistency and compare-and-swap indexes. GET requires the caller's validated Auth user ID and returns `private, no-store`, `nosniff`, same-origin resource policy.

## Proposed SQL core

```sql
create schema if not exists advertising_game;
revoke all on schema advertising_game from public, anon, authenticated, service_role;
create table advertising_game.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id text not null check (document_id ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  document_schema text not null check (document_schema = 'advertising-game-progress'),
  schema_version integer not null check (schema_version = 1),
  revision bigint not null default 1 check (revision >= 1),
  document jsonb not null check (jsonb_typeof(document) = 'object')
    check (octet_length(document::text) <= 262144),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (user_id, document_id)
);
alter table advertising_game.progress enable row level security;
revoke all on table advertising_game.progress from public, anon, authenticated, service_role;

create function public.advertising_game_progress_rpc(
  p_user_id uuid, p_operation text, p_document_id text,
  p_document_schema text, p_schema_version integer,
  p_expected_revision bigint default null, p_document jsonb default null
) returns jsonb language plpgsql security definer set search_path = '' ...;
```

The function begins by rejecting null user IDs; null/unknown operations; wrong schema/version. `list` requires all document inputs null and returns at most 16 metadata rows filtered by `user_id`, ordered `updated_at desc, document_id collate "C" asc`. `load` filters by both user and document. `save` verifies expected revision, top-level document schemaVersion/documentId/offline mode/no roomId/integer safe revision/size, takes a per-user advisory transaction lock, enforces a 16-document cap, and performs CAS insert/update. Function owner is `postgres`; all execute grants are revoked from public/anon/authenticated/service_role, then execute is granted only to service_role. No SQL references `signal_lost`.

## Verification evidence

- Strict TypeScript: pass.
- Full Vitest: 115 files / 1,767 tests pass.
- Production build contracts: 60 / 60 pass.
- Focused regressions include redirect secret leakage, hostile/missing 401 bodies, lying asset lengths, auth propagation, canonical cloud load/save, orphan transient Fabric URLs, atomic five-store import, hashed per-account CAS persistence across logout/account switches, stale queue epochs, and SQL null-operation rejection.
- No migration or deployment has yet occurred.
