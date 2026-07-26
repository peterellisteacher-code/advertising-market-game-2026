-- Advertising Market Game account progress foundation.
-- Apply this migration exactly once to the operator's chosen Supabase project.
-- This is transaction-body SQL for Supabase apply_migration. That workflow
-- supplies the outer transaction and migration-ledger write. Do not add
-- BEGIN, COMMIT, ROLLBACK, or START TRANSACTION statements to this file.

do $collision_preflight$
begin
  if exists (
    select 1
    from pg_catalog.pg_namespace
    where nspname = 'advertising_game'
  ) then
    raise exception using
      errcode = '42P06',
      message = 'Advertising Game schema collision';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'advertising_game'
      and c.relname = 'progress'
  ) then
    raise exception using
      errcode = '42P07',
      message = 'Advertising Game progress relation collision';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'advertising_game_progress_rpc'
  ) then
    raise exception using
      errcode = '42723',
      message = 'Advertising Game progress function collision';
  end if;
end;
$collision_preflight$;

create schema advertising_game;

revoke all on schema advertising_game from public, anon, authenticated, service_role;

create table advertising_game.progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id text not null,
  document_schema text not null,
  schema_version integer not null,
  revision bigint not null default 1,
  document jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  primary key (user_id, document_id),
  constraint advertising_game_progress_document_id_check
    check (document_id ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint advertising_game_progress_schema_check
    check (document_schema = 'advertising-game-progress'),
  constraint advertising_game_progress_schema_version_check
    check (schema_version = 1),
  constraint advertising_game_progress_revision_check
    check (revision >= 1),
  constraint advertising_game_progress_document_object_check
    check (jsonb_typeof(document) = 'object'),
  constraint advertising_game_progress_document_size_check
    check (octet_length(document::text) <= 262144),
  constraint advertising_game_progress_timestamps_check
    check (updated_at >= created_at)
);

alter table advertising_game.progress enable row level security;

revoke all on table advertising_game.progress
  from public, anon, authenticated, service_role;

create index advertising_game_progress_updated_at_idx
  on advertising_game.progress (user_id, updated_at desc);

create function public.advertising_game_progress_rpc(
  p_user_id uuid,
  p_operation text,
  p_document_id text,
  p_document_schema text,
  p_schema_version integer,
  p_expected_revision bigint default null,
  p_document jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_revision bigint;
  v_document jsonb;
  v_updated_at timestamptz;
  v_now timestamptz;
  v_document_count integer;
  v_documents jsonb;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'invalid user';
  end if;
  if p_operation is null or p_operation not in ('list', 'load', 'save', 'reset') then
    raise exception using errcode = '22023', message = 'invalid operation';
  end if;
  if p_document_schema is distinct from 'advertising-game-progress'
    or p_schema_version is distinct from 1 then
    raise exception using errcode = '22023', message = 'invalid schema';
  end if;

  if p_operation = 'list' then
    if p_document_id is not null
      or p_expected_revision is not null
      or p_document is not null then
      raise exception using errcode = '22023', message = 'invalid list request';
    end if;

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'documentId', listed.document_id,
          'revision', listed.revision,
          'updatedAt', listed.updated_at
        ) order by listed.updated_at desc, listed.document_id collate "C" asc
      ),
      '[]'::pg_catalog.jsonb
    )
      into v_documents
      from (
        select progress.document_id, progress.revision, progress.updated_at
          from advertising_game.progress
          where progress.user_id = p_user_id
          order by progress.updated_at desc, progress.document_id collate "C" asc
          limit 16
      ) as listed;

    return pg_catalog.jsonb_build_object(
      'status', 'listed',
      'documents', v_documents
    );
  end if;

  if p_operation = 'reset' then
    if p_document_id is not null
      or p_expected_revision is not null
      or p_document is not null then
      raise exception using errcode = '22023', message = 'invalid reset request';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_user_id::text, 684135)
    );

    delete from advertising_game.progress
      where progress.user_id = p_user_id;

    return pg_catalog.jsonb_build_object('status', 'reset');
  end if;

  if p_document_id is null
    or p_document_id !~ '^[a-z0-9][a-z0-9._-]{0,63}$' then
    raise exception using errcode = '22023', message = 'invalid document id';
  end if;

  if p_operation = 'load' then
    select progress.revision, progress.document, progress.updated_at
      into v_revision, v_document, v_updated_at
      from advertising_game.progress
      where progress.user_id = p_user_id
        and progress.document_id = p_document_id;

    if not found then
      return pg_catalog.jsonb_build_object('status', 'not_found');
    end if;

    return pg_catalog.jsonb_build_object(
      'status', 'found',
      'revision', v_revision,
      'document', v_document,
      'updatedAt', v_updated_at
    );
  end if;

  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'invalid expected revision';
  end if;
  if p_document is null or pg_catalog.jsonb_typeof(p_document) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid document';
  end if;
  if (p_document -> 'schemaVersion') is distinct from '1'::pg_catalog.jsonb
    or pg_catalog.jsonb_typeof(p_document -> 'documentId') is distinct from 'string'
    or p_document ->> 'documentId' is distinct from p_document_id
    or pg_catalog.jsonb_typeof(p_document -> 'mode') is distinct from 'string'
    or p_document ->> 'mode' is distinct from 'offline'
    or pg_catalog.jsonb_typeof(p_document -> 'teamId') is distinct from 'string'
    or p_document ->> 'teamId' = ''
    or p_document ? 'roomId' then
    raise exception using errcode = '22023', message = 'invalid document identity';
  end if;
  if pg_catalog.jsonb_typeof(p_document -> 'revision') is distinct from 'number' then
    raise exception using errcode = '22023', message = 'invalid document revision';
  end if;
  if (p_document ->> 'revision')::pg_catalog.numeric < 0
    or (p_document ->> 'revision')::pg_catalog.numeric
      <> pg_catalog.trunc((p_document ->> 'revision')::pg_catalog.numeric)
    or (p_document ->> 'revision')::pg_catalog.numeric > 9007199254740991 then
    raise exception using errcode = '22023', message = 'invalid document revision';
  end if;
  if pg_catalog.octet_length(p_document::text) > 262144 then
    raise exception using errcode = '22023', message = 'document too large';
  end if;

  -- Serialise all writes for one account so the 16-document cap and CAS are atomic.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 684135)
  );

  select progress.revision
    into v_revision
    from advertising_game.progress
    where progress.user_id = p_user_id
      and progress.document_id = p_document_id;

  if not found then
    if p_expected_revision <> 0 then
      return pg_catalog.jsonb_build_object(
        'status', 'conflict',
        'currentRevision', 0
      );
    end if;

    select pg_catalog.count(*)::integer
      into v_document_count
      from advertising_game.progress
      where progress.user_id = p_user_id;

    if v_document_count >= 16 then
      return pg_catalog.jsonb_build_object('status', 'document_limit');
    end if;

    v_now := pg_catalog.clock_timestamp();
    insert into advertising_game.progress (
      user_id,
      document_id,
      document_schema,
      schema_version,
      revision,
      document,
      created_at,
      updated_at
    ) values (
      p_user_id,
      p_document_id,
      p_document_schema,
      p_schema_version,
      1,
      p_document,
      v_now,
      v_now
    )
    returning progress.revision, progress.updated_at
      into v_revision, v_updated_at;

    return pg_catalog.jsonb_build_object(
      'status', 'saved',
      'revision', v_revision,
      'updatedAt', v_updated_at
    );
  end if;

  if v_revision <> p_expected_revision then
    return pg_catalog.jsonb_build_object(
      'status', 'conflict',
      'currentRevision', v_revision
    );
  end if;

  v_now := pg_catalog.clock_timestamp();
  update advertising_game.progress
    set document_schema = p_document_schema,
        schema_version = p_schema_version,
        document = p_document,
        revision = revision + 1,
        updated_at = v_now
    where progress.user_id = p_user_id
      and progress.document_id = p_document_id
      and progress.revision = p_expected_revision
    returning progress.revision, progress.updated_at
      into v_revision, v_updated_at;

  if not found then
    select progress.revision
      into v_revision
      from advertising_game.progress
      where progress.user_id = p_user_id
        and progress.document_id = p_document_id;
    return pg_catalog.jsonb_build_object(
      'status', 'conflict',
      'currentRevision', coalesce(v_revision, 0)
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'status', 'saved',
    'revision', v_revision,
    'updatedAt', v_updated_at
  );
end;
$function$;

revoke all
  on function public.advertising_game_progress_rpc(
    uuid, text, text, text, integer, bigint, jsonb
  )
  from public, anon, authenticated, service_role;

grant execute
  on function public.advertising_game_progress_rpc(
    uuid, text, text, text, integer, bigint, jsonb
  )
  to service_role;

-- Rollback notes (not executable): first disable the Netlify account routes and
-- confirm no dependent records are required. Then an authorised operator may
-- revoke the RPC grant, remove only public.advertising_game_progress_rpc,
-- archive or remove only advertising_game.progress, and remove the
-- advertising_game schema only if it is empty. Do not alter unrelated objects.
