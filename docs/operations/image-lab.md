# Image Lab: teacher-controlled account allowances

Image Lab is built into the creator, but it is disabled by default. The normal product maker, Logo Lab, drawing tools and asset catalogue remain available while it is off.

Access has two independent server-side gates. `IMAGE_LAB_ENABLED` is the deployment kill switch. The teacher dashboard controls the global allowance-ledger setting and the separate Object Forge and Make It Real allowances for each pair account. A paid request requires an authenticated pair account, the global ledger setting to be on, and at least one available use for that request's stage.

Student devices do not receive a teacher code, an unlock control, a raw account ID, a provider key or an unlimited session capability. The teacher makes every availability change from `/teacher`. New accounts receive zero uses unless the teacher changes the defaults for future accounts. Changing those defaults does not alter existing accounts.

The password-protected game, physical teacher supervision, account-bound access and server-authoritative allowance ledger form part of the classroom access and age-assurance layer. They do not override a provider's eligibility or minor-use terms.

## Teacher-controlled allowance gate

Image Lab may operate only while the teacher is physically present. The retired `IMAGE_LAB_FAL_MINOR_USE_APPROVED` and classroom-code gates are not read by the student routes. Activation requires `IMAGE_LAB_SCHOOL_APPROVED=true`, the deployment kill switch, a valid account session and the teacher-controlled ledger setting.

The current fal.ai Acceptable Use Policy says people under 18 may not use the service and makes account holders responsible for their users. Removing the technical letter gate records a supervised operating decision; it is not a claim that fal.ai has changed or waived its policy.

A direct OpenAI API route has a different published framework: OpenAI's Under 18 API Guidance does not require an approval letter. It requires additional safeguards for minor-facing products, including age-appropriate disclosure, content filtering, reasonable monitoring and reporting/escalation, and age assurance where appropriate. Personal data of children under 13 or the applicable age of digital consent must not be processed without Zero Data Retention. The account allowance gate satisfies only part of that framework; the remaining controls must be implemented before enabling a direct OpenAI route.

References:

- [fal.ai Acceptable Use Policy](https://fal.ai/legal/acceptable-use-policy)
- [fal.ai server-side integration guidance](https://fal.ai/docs/documentation/model-apis/inference/server-side)
- [fal.ai queue API](https://fal.ai/docs/documentation/model-apis/inference/queue)
- [fal.ai GPT Image 2](https://fal.ai/models/openai/gpt-image-2)
- [fal.ai GPT Image 2 Edit](https://fal.ai/models/openai/gpt-image-2/edit)
- [OpenAI Under 18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)

## Server-owned profiles

Students cannot choose a model, slug, dimensions, step count, guidance, quality tier, output count or safety setting.

| Game power | Stable profile ID | fal model | Fixed request | Verified return |
| --- | --- | --- | --- | --- |
| Object Forge | `object-forge-gpt-image-2-low-v1` | `openai/gpt-image-2` | exact 1024×1024, low quality, one PNG | 1024×1024 PNG |
| Make It Real | `make-it-real-gpt-image-2-high-v2` | `openai/gpt-image-2/edit` | one 1024×576 canvas reference, exact `{ width: 1280, height: 720 }`, high quality, one PNG | exact 1280×720 PNG |

The two endpoints do not share one generic payload. Object Forge sends `prompt`, `image_size`, `quality`, `num_images` and `output_format`. Make It Real sends those fields plus `image_urls`. The production adapter uses an explicit `{ width, height }` object, not a named aspect-ratio preset.

GPT Image 2 concrete output sizes must use multiples of 16, keep each edge at or below 3840 pixels, keep the aspect ratio at or below 3:1, and contain 655,360–8,294,400 pixels. The server checks all four rules before reserving an allowance or dispatching to fal. A 1024×576 output request is below the pixel floor; the earlier 1088×608 return was fal's deterministic rescale of that invalid request, not a canonical 16:9 output. The smallest exact 16:9 size above the floor is 1280×720. A supervised validation request returned an exact 1280×720 PNG, measured from the saved PNG header.

The browser's 512×512 Object Forge processing canvas is a local post-generation asset size, not a GPT Image 2 request. The 1024×576 Make It Real canvas is the reference image sent to the edit endpoint. Neither value is used as the GPT Image 2 output `image_size`.

The fixed profiles are defined in source and must change only after a new supervised evaluation of output quality, silhouette fidelity, safety and cost.

Two server-only experimental profiles are available for an adult-operated blind A/B test. They are not browser choices and do not replace the defaults merely because they cost less.

| A/B profile ID | fal model | Fixed output | Fixed limits |
| --- | --- | --- | --- |
| `z-image-lora-v1` | `fal-ai/z-image/turbo/lora` | 512×512 PNG | 8 steps, one image, safety on, regular acceleration, prompt expansion off, exactly one server-owned LoRA at scale 1 |
| `flux2-turbo-edit-v1` | `fal-ai/flux-2/turbo/edit` | 1024×576 PNG | guidance 2.5, one image, safety on, prompt expansion off, exactly one canvas reference |

Leave the selectors absent to retain the current profiles. For a controlled adult A/B run only, set one or both of:

```text
IMAGE_LAB_OBJECT_PROFILE_ID=z-image-lora-v1
IMAGE_LAB_Z_LORA_URL=<trimmed public HTTPS URL for the approved shared adapter>
IMAGE_LAB_REALISE_PROFILE_ID=flux2-turbo-edit-v1
```

Only those profile IDs are accepted. An unknown selector, or a missing or unsafe LoRA URL while `z-image-lora-v1` is selected, fails closed before allowance is reserved or a fal request is submitted. The adapter URL is server-only and is never returned to the browser. Existing job tokens retain their original stable profile ID, so status and result requests continue using the submitted model after selectors change.

The browser sends constrained creative choices under its same-origin account session. Make It Real also sends a locally prepared 1024×576 reference image of the current canvas. It does not send a pair alias, account ID, teacher credential or allowance count. The fal key, model identity, prompt wrapper, paid media URL and upstream request ID remain server-side.

## Required Netlify environment

```text
IMAGE_LAB_ENABLED=true
IMAGE_LAB_SCHOOL_APPROVED=true
IMAGE_LAB_ACCOUNT_CAP_USD=5
IMAGE_LAB_SIGNING_SECRET=<at least 32 random characters>
FAL_KEY=<server-only fal key>
```

The account-service variables documented in `advertising-game-account-progress.md` are also required because every status, submission, poll, result and reconciliation request resolves the signed-in pair from the account cookies.

`IMAGE_LAB_ACCOUNT_CAP_USD` is an activation acknowledgement, not a billing control. Configure a real hard spending limit on the fal account or dedicated key before enabling the feature. The allowance ledger does not replace that provider-side cap. Never put `FAL_KEY` in Vite variables, HTML, client code or a public repository.

## Allowance lifecycle

Object Forge and Make It Real have independent counters for every pair:

- `granted` is the total authorised use count;
- `available` is `granted - consumed - reserved`;
- `reserved` is held while a paid job may be in progress;
- `consumed` records a confirmed completed deliverable;
- `refunded` is a terminal operation that releases a reservation after a confirmed failure;
- `uncertain` keeps the reservation in place until the existing job is checked.

The teacher dashboard can set the exact available count, add uses or revoke only unconsumed and unreserved uses. It can also add uses to selected pairs, switch Image Lab on or off globally, and set separate defaults for accounts created later. All counts are whole numbers from 0 to 100. Every mutation has an idempotent operation identity; a replay with different data is rejected.

Defaults apply only when a new account is created through the teacher dashboard. An existing account that first reaches Image Lab later starts at zero, even if the future-account default has changed.

## Reconciliation

Submission is never repeated automatically. If the browser cannot determine whether a paid request started, it retains the original job token and shows **Check request**. That action sends the existing token once to `POST /api/image-lab/jobs/reconcile` under the same pair account.

- A confirmed completed job is consumed once.
- A confirmed failed job is refunded once.
- A queued or running job remains reserved.
- An unknown provider outcome remains uncertain and reserved.

Do not create a replacement request while the original reservation is uncertain. First use **Check request** from the same account and device. If the teacher dashboard reports an uncertain allowance mutation, retain the entered values and use **Refresh allowances**; do not repeat the mutation with a new operation ID.

## Expected classroom cost

At the live prices checked on 20 July 2026, a 1024×1024 Object Forge image at low quality is US$0.006. Budget US$0.211 for each 1280×720 high-quality edit unless the fal dashboard shows a newer lower price.

For 15 pairs, six Object Forge images each cost about US$0.54 in total. One final Make It Real image each adds up to about US$3.17, giving a conservative session ceiling of about **US$3.71** before price changes. Raising the final allowance to two would raise that ceiling to about **US$6.87**. Confirm current pricing before every activation.

The cheaper FLUX and Z-Image candidates remain available only as adult-operated A/B profiles. The live benchmark found that their lower price did not compensate for weaker silhouette reliability and poorer catalogue-style fit. The shared Z-Image LoRA remains a possible future consistency experiment, not a current cost-saving or production recommendation.

Alternative-profile trials remain teacher-operated and must never create an ungated student-access path.

## Security properties and limits

- Image jobs use authenticated encrypted browser tokens; the upstream fal request ID is not readable in the token.
- Every public image-generation request resolves the signed-in account from `HttpOnly`, `SameSite=Strict` account cookies. The status and job routes reject browser-supplied aliases, user IDs, session IDs and team IDs.
- The private allowance tables and RPCs are reachable only through the service-role broker. Browser roles have no schema, table or function access.
- Generated media is fetched by the server from an allowlisted `fal.media` HTTPS host, checked for type, signature, byte limit and the exact dimensions pinned to the submitted profile, then proxied same-origin with `no-store`.
- Accepted images become owned local blobs in the campaign draft. Saved campaigns do not depend on expiring fal URLs.
- Submission is not retried automatically.
- Reservation, completion and refund use advisory locks and an operation journal, so concurrent replay is atomic and idempotent. The external fal account cap remains mandatory.
- All automated verification uses injected fake responses. It performs no paid fal inference.

## Activation check

1. Confirm school approval and the teacher's physical supervision for the complete session.
2. Reserve all six named database objects, apply the base allowance migration and then the atomic teacher upgrade as separate approved calls, run both sets of schema and grant checks below, and release the shared-project reservation.
3. Create a dedicated server-side fal key and apply a hard account or key spending cap at the provider.
4. Configure the account-service variables, `IMAGE_LAB_ENABLED=true`, `IMAGE_LAB_SCHOOL_APPROVED=true`, the activation acknowledgement, a new signing secret and the server-only fal key.
5. Verify that the deployed function manifest exposes `/api/image-lab/session`, `/api/image-lab/jobs`, `/api/image-lab/jobs/reconcile` and `/api/image-lab/assets`, with no unlock or lock route.
6. Sign in at `/teacher`. Keep the global ledger setting off and both future-account defaults at zero while preparing the class.
7. Use a designated demonstration pair account to test one Object Forge use, one Make It Real use and **Check request** before students arrive. Confirm the resulting available and reserved counts in the teacher dashboard.
8. Keep the default profiles unless sealed teacher-operated blind A/B evidence supports a change.
9. Allocate only the required uses to the named pair aliases, then switch the global ledger setting on immediately before the supervised activity.
10. After the activity, switch the global ledger setting off. Reconcile every reserved or uncertain job before revoking unused availability. Disable the deployment kill switch when Image Lab is no longer required.

## Atomic allowance ledger migration

The deterministic source is
`docs/operations/advertising-game-image-lab-allowances.sql`. It contains only
the transaction body for one `apply_migration` call. Do not add migration-ledger
statements or transaction-control statements to that file.

The migration is limited to these Advertising objects:

```text
advertising_game.image_lab_settings
advertising_game.image_lab_allowance
advertising_game.image_lab_operation
public.advertising_game_image_lab_rpc
```

Before applying it, reserve those four names for the Advertising lane in the
shared-project coordination channel. Do not proceed while another lane holds a
database-mutation reservation.

Run this read-only shared-project collision preflight:

```sql
select n.nspname as schema_name, c.relname, c.relkind
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where (n.nspname = 'advertising_game'
  and c.relname in (
    'image_lab_settings',
    'image_lab_allowance',
    'image_lab_operation'
  ))
or (n.nspname <> 'advertising_game'
  and c.relname in (
    'image_lab_settings',
    'image_lab_allowance',
    'image_lab_operation'
  ))
order by n.nspname, c.relname;

select n.nspname as schema_name,
       p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where p.proname = 'advertising_game_image_lab_rpc';
```

The expected result is no matching relation and no matching function. Also
confirm that `advertising_game.progress` and
`public.advertising_game_progress_rpc` still exist; they are neighbouring
Advertising objects and are not part of this migration.

After one approved application, verify the object boundary and grants:

```sql
select n.nspname as schema_name,
       c.relname,
       c.relrowsecurity
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'advertising_game'
  and c.relname in (
    'image_lab_settings',
    'image_lab_allowance',
    'image_lab_operation'
  )
order by c.relname;

select conrelid::pg_catalog.regclass::text as relation_name,
       conname,
       pg_catalog.pg_get_constraintdef(oid) as definition
from pg_catalog.pg_constraint
where conrelid in (
  'advertising_game.image_lab_settings'::pg_catalog.regclass,
  'advertising_game.image_lab_allowance'::pg_catalog.regclass,
  'advertising_game.image_lab_operation'::pg_catalog.regclass
)
order by relation_name, conname;

select p.oid::pg_catalog.regprocedure::text as signature,
       p.prosecdef as security_definer,
       p.proowner::pg_catalog.regrole::text as owner,
       p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'advertising_game_image_lab_rpc';

select
  pg_catalog.has_schema_privilege('anon', 'advertising_game', 'USAGE')
    as anon_schema_usage,
  pg_catalog.has_schema_privilege('authenticated', 'advertising_game', 'USAGE')
    as authenticated_schema_usage,
  pg_catalog.has_table_privilege(
    'anon',
    'advertising_game.image_lab_allowance',
    'SELECT,INSERT,UPDATE,DELETE'
  ) as anon_table_access,
  pg_catalog.has_table_privilege(
    'authenticated',
    'advertising_game.image_lab_allowance',
    'SELECT,INSERT,UPDATE,DELETE'
  ) as authenticated_table_access,
  pg_catalog.has_function_privilege(
    'anon',
    'public.advertising_game_image_lab_rpc(uuid,text,text,integer,text,text,text)',
    'EXECUTE'
  ) as anon_rpc_execute,
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.advertising_game_image_lab_rpc(uuid,text,text,integer,text,text,text)',
    'EXECUTE'
  ) as authenticated_rpc_execute,
  pg_catalog.has_function_privilege(
    'service_role',
    'public.advertising_game_image_lab_rpc(uuid,text,text,integer,text,text,text)',
    'EXECUTE'
  ) as service_rpc_execute;
```

All three `relrowsecurity` values must be true. Every browser-role result in
the last query must be false, and `service_rpc_execute` must be true. The
function must be owned by `postgres`, be security-definer, and include
`search_path=""` in `proconfig`.

If verification fails before the application is released, rollback is limited
to the same four names and must not use `CASCADE`:

```sql
drop function public.advertising_game_image_lab_rpc(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text
);
drop table advertising_game.image_lab_operation;
drop table advertising_game.image_lab_allowance;
drop table advertising_game.image_lab_settings;
```

Before rollback, confirm that no paid job remains reserved or uncertain.
After verification or rollback, release the shared-project reservation
immediately. Never include any neighbouring schema, table, function, account,
asset bucket, or migration-ledger row in this rollback.

## Atomic teacher allowance upgrade

The teacher dashboard changes the global switch and both defaults together,
changes both allowance stages for one pair together, and can add both stages to
several selected pairs together. Those actions use one PostgreSQL transaction
each. This prevents a request from succeeding for one stage or pair while
silently failing for another.

The deterministic upgrade source is
`docs/operations/advertising-game-image-lab-teacher-atomic.sql`. It is a
separate, apply-once migration body and requires the four base allowance
objects above. It creates only these two additional objects:

```text
advertising_game.image_lab_teacher_operation
public.advertising_game_image_lab_teacher_rpc
```

This upgrade was authored and tested locally. It was deliberately **not**
applied to the shared Supabase project during local implementation or QA.
Before any future application, reserve both additional names and the four base
objects in the shared-project coordination channel.

Run this read-only preflight. The first four values must be non-null, and the
two collision queries must return no rows:

```sql
select
  pg_catalog.to_regclass('advertising_game.image_lab_settings')
    as settings_table,
  pg_catalog.to_regclass('advertising_game.image_lab_allowance')
    as allowance_table,
  pg_catalog.to_regclass('advertising_game.image_lab_operation')
    as operation_table,
  pg_catalog.to_regprocedure(
    'public.advertising_game_image_lab_rpc(uuid,text,text,integer,text,text,text)'
  ) as allowance_rpc;

select n.nspname as schema_name, c.relname, c.relkind
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'advertising_game'
  and c.relname = 'image_lab_teacher_operation';

select n.nspname as schema_name,
       p.proname,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'advertising_game_image_lab_teacher_rpc';
```

After one approved application, verify the private boundary:

```sql
select c.relname, c.relrowsecurity
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'advertising_game'
  and c.relname = 'image_lab_teacher_operation';

select p.oid::pg_catalog.regprocedure::text as signature,
       p.prosecdef as security_definer,
       p.proowner::pg_catalog.regrole::text as owner,
       p.proconfig
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'advertising_game_image_lab_teacher_rpc';

select
  pg_catalog.has_table_privilege(
    'anon',
    'advertising_game.image_lab_teacher_operation',
    'SELECT,INSERT,UPDATE,DELETE'
  ) as anon_table_access,
  pg_catalog.has_table_privilege(
    'authenticated',
    'advertising_game.image_lab_teacher_operation',
    'SELECT,INSERT,UPDATE,DELETE'
  ) as authenticated_table_access,
  pg_catalog.has_function_privilege(
    'anon',
    'public.advertising_game_image_lab_teacher_rpc(text,uuid[],boolean,integer,integer,text,text)',
    'EXECUTE'
  ) as anon_rpc_execute,
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.advertising_game_image_lab_teacher_rpc(text,uuid[],boolean,integer,integer,text,text)',
    'EXECUTE'
  ) as authenticated_rpc_execute,
  pg_catalog.has_function_privilege(
    'service_role',
    'public.advertising_game_image_lab_teacher_rpc(text,uuid[],boolean,integer,integer,text,text)',
    'EXECUTE'
  ) as service_rpc_execute;
```

`relrowsecurity` must be true. Every browser-role privilege must be false,
`service_rpc_execute` must be true, and the function must be owned by
`postgres`, be security-definer, and use a closed search path. In a disposable
test database, also prove that a deliberately invalid member of a multi-pair
batch leaves every allowance unchanged, and that replaying an operation ID
with different inputs fails.

If verification fails before release, rollback is limited to these two new
objects, requires the same shared-project reservation, and must not use
`CASCADE`:

```sql
drop function public.advertising_game_image_lab_teacher_rpc(
  text,
  uuid[],
  boolean,
  integer,
  integer,
  text,
  text
);
drop table advertising_game.image_lab_teacher_operation;
```
