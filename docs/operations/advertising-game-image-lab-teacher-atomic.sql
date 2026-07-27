-- Deterministic upgrade source for one approved apply_migration call.
-- The base Image Lab allowance migration must already be present.
-- This file intentionally contains no migration-ledger or transaction-control statements.

do $collision_preflight$
begin
  if pg_catalog.to_regclass('advertising_game.image_lab_settings') is null
    or pg_catalog.to_regclass('advertising_game.image_lab_allowance') is null
    or pg_catalog.to_regclass('advertising_game.image_lab_operation') is null
    or pg_catalog.to_regprocedure(
      'public.advertising_game_image_lab_rpc(uuid,text,text,integer,text,text,text)'
    ) is null then
    raise exception using
      errcode = '55000',
      message = 'base Image Lab allowance objects are missing';
  end if;

  if pg_catalog.to_regclass(
    'advertising_game.image_lab_teacher_operation'
  ) is not null
    or exists (
      select 1
        from pg_catalog.pg_proc as procedure
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'public'
          and procedure.proname = 'advertising_game_image_lab_teacher_rpc'
    ) then
    raise exception using
      errcode = '42710',
      message = 'atomic teacher Image Lab objects already exist';
  end if;
end
$collision_preflight$;

create table advertising_game.image_lab_teacher_operation (
  operation_id text primary key,
  ledger_operation text not null,
  user_ids uuid[] not null,
  enabled boolean,
  object_amount integer not null,
  realise_amount integer not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint advertising_game_image_lab_teacher_operation_id_check
    check (operation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint advertising_game_image_lab_teacher_operation_kind_check
    check (
      ledger_operation in (
        'initialize',
        'set_global',
        'set',
        'add',
        'revoke',
        'batch_add'
      )
    ),
  constraint advertising_game_image_lab_teacher_operation_users_check
    check (
      cardinality(user_ids) between 0 and 100
      and array_position(user_ids, null) is null
    ),
  constraint advertising_game_image_lab_teacher_operation_shape_check
    check (
      (
        ledger_operation = 'set_global'
        and cardinality(user_ids) = 0
        and enabled is not null
      )
      or (
        ledger_operation <> 'set_global'
        and cardinality(user_ids) between 1 and 100
        and enabled is null
      )
    ),
  constraint advertising_game_image_lab_teacher_operation_amount_check
    check (
      object_amount between 0 and 100
      and realise_amount between 0 and 100
    ),
  constraint advertising_game_image_lab_teacher_operation_hash_check
    check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint advertising_game_image_lab_teacher_operation_result_check
    check (pg_catalog.jsonb_typeof(result) = 'object')
);

alter table advertising_game.image_lab_teacher_operation enable row level security;

revoke all on table advertising_game.image_lab_teacher_operation
  from public, anon, authenticated, service_role;

create function public.advertising_game_image_lab_teacher_rpc(
  p_operation text,
  p_user_ids uuid[],
  p_enabled boolean,
  p_object_amount integer,
  p_realise_amount integer,
  p_operation_id text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing_operation advertising_game.image_lab_teacher_operation%rowtype;
  v_settings advertising_game.image_lab_settings%rowtype;
  v_accounts jsonb;
  v_result jsonb;
  v_user_id uuid;
begin
  if p_operation is null or p_operation not in (
    'initialize',
    'set_global',
    'set',
    'add',
    'revoke',
    'batch_add'
  ) then
    raise exception using errcode = '22023', message = 'invalid teacher operation';
  end if;
  if p_operation_id is null
    or p_operation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_request_hash is null
    or p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid operation identity';
  end if;
  if p_user_ids is null
    or cardinality(p_user_ids) > 100
    or array_position(p_user_ids, null) is not null
    or p_object_amount is null
    or p_object_amount < 0
    or p_object_amount > 100
    or p_realise_amount is null
    or p_realise_amount < 0
    or p_realise_amount > 100 then
    raise exception using errcode = '22023', message = 'invalid teacher allowance input';
  end if;
  if (
    select count(*) <> count(distinct requested_user_id)
      from pg_catalog.unnest(p_user_ids) as requested(requested_user_id)
  ) then
    raise exception using errcode = '22023', message = 'duplicate account';
  end if;
  if p_operation = 'set_global'
    and (cardinality(p_user_ids) <> 0 or p_enabled is null) then
    raise exception using errcode = '22023', message = 'invalid global mutation';
  end if;
  if p_operation <> 'set_global'
    and (
      p_enabled is not null
      or cardinality(p_user_ids) < 1
      or (
        p_operation <> 'batch_add'
        and cardinality(p_user_ids) <> 1
      )
    ) then
    raise exception using errcode = '22023', message = 'invalid account mutation';
  end if;
  if p_operation in ('add', 'revoke', 'batch_add')
    and p_object_amount = 0
    and p_realise_amount = 0 then
    raise exception using errcode = '22023', message = 'empty allowance mutation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('image-lab-global', 741927)
  );
  for v_user_id in
    select requested_user_id
      from pg_catalog.unnest(p_user_ids) as requested(requested_user_id)
      order by requested_user_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_user_id::text, 741927)
    );
  end loop;

  if exists (
    select 1
      from advertising_game.image_lab_teacher_operation
      where image_lab_teacher_operation.operation_id = p_operation_id
        and (
          image_lab_teacher_operation.ledger_operation is distinct from p_operation
          or image_lab_teacher_operation.user_ids is distinct from p_user_ids
          or image_lab_teacher_operation.enabled is distinct from p_enabled
          or image_lab_teacher_operation.object_amount is distinct from p_object_amount
          or image_lab_teacher_operation.realise_amount is distinct from p_realise_amount
          or image_lab_teacher_operation.request_hash is distinct from p_request_hash
        )
  ) then
    raise exception using errcode = '22023', message = 'operation replay mismatch';
  end if;

  select image_lab_teacher_operation.*
    into v_existing_operation
    from advertising_game.image_lab_teacher_operation
    where image_lab_teacher_operation.operation_id = p_operation_id;
  if found then
    return v_existing_operation.result;
  end if;

  if cardinality(p_user_ids) <> (
    select count(*)
      from auth.users
      where auth.users.id = any(p_user_ids)
  ) then
    raise exception using errcode = '22023', message = 'unknown account';
  end if;

  select *
    into v_settings
    from advertising_game.image_lab_settings
    where singleton_id = true;
  if not found then
    raise exception using errcode = '55000', message = 'Image Lab settings are missing';
  end if;

  if p_operation = 'set_global' then
    update advertising_game.image_lab_settings
      set enabled = p_enabled,
          object_default = p_object_amount,
          realise_default = p_realise_amount,
          updated_at = pg_catalog.clock_timestamp()
      where singleton_id = true
      returning * into v_settings;
  else
    insert into advertising_game.image_lab_allowance (
      user_id,
      object_granted,
      realise_granted
    )
    select requested_user_id, 0, 0
      from pg_catalog.unnest(p_user_ids) as requested(requested_user_id)
    on conflict (user_id) do nothing;

    if p_operation in ('initialize', 'set') then
      if exists (
        select 1
          from advertising_game.image_lab_allowance
          where user_id = any(p_user_ids)
            and (
              object_consumed + object_reserved + p_object_amount > 100
              or realise_consumed + realise_reserved + p_realise_amount > 100
            )
      ) then
        raise exception using errcode = '22023', message = 'allowance exceeds limit';
      end if;
      update advertising_game.image_lab_allowance
        set object_granted = object_consumed + object_reserved + p_object_amount,
            realise_granted = realise_consumed + realise_reserved + p_realise_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = any(p_user_ids);
    elsif p_operation in ('add', 'batch_add') then
      if exists (
        select 1
          from advertising_game.image_lab_allowance
          where user_id = any(p_user_ids)
            and (
              object_granted + p_object_amount > 100
              or realise_granted + p_realise_amount > 100
            )
      ) then
        raise exception using errcode = '22023', message = 'allowance exceeds limit';
      end if;
      update advertising_game.image_lab_allowance
        set object_granted = object_granted + p_object_amount,
            realise_granted = realise_granted + p_realise_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = any(p_user_ids);
    elsif p_operation = 'revoke' then
      if exists (
        select 1
          from advertising_game.image_lab_allowance
          where user_id = any(p_user_ids)
            and (
              object_granted - object_consumed - object_reserved < p_object_amount
              or realise_granted - realise_consumed - realise_reserved < p_realise_amount
            )
      ) then
        raise exception using errcode = '22023', message = 'available allowance is too low';
      end if;
      update advertising_game.image_lab_allowance
        set object_granted = object_granted - p_object_amount,
            realise_granted = realise_granted - p_realise_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = any(p_user_ids);
    end if;
  end if;

  select pg_catalog.coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'userId', allowance.user_id,
        'object', pg_catalog.jsonb_build_object(
          'granted', allowance.object_granted,
          'consumed', allowance.object_consumed,
          'reserved', allowance.object_reserved,
          'remaining', allowance.object_granted
            - allowance.object_consumed
            - allowance.object_reserved
        ),
        'realise', pg_catalog.jsonb_build_object(
          'granted', allowance.realise_granted,
          'consumed', allowance.realise_consumed,
          'reserved', allowance.realise_reserved,
          'remaining', allowance.realise_granted
            - allowance.realise_consumed
            - allowance.realise_reserved
        )
      )
      order by requested.ordinality
    ),
    '[]'::pg_catalog.jsonb
  )
    into v_accounts
    from (
      select requested.user_id, requested.ordinality
        from pg_catalog.unnest(p_user_ids) with ordinality
          as requested(user_id, ordinality)
        order by requested.ordinality
    ) as requested
    join advertising_game.image_lab_allowance as allowance
      on allowance.user_id = requested.user_id;

  v_result := pg_catalog.jsonb_build_object(
    'status', case when v_settings.enabled then 'available' else 'disabled' end,
    'enabled', v_settings.enabled,
    'object', pg_catalog.jsonb_build_object(
      'granted', v_settings.object_default,
      'consumed', 0,
      'reserved', 0,
      'remaining', v_settings.object_default
    ),
    'realise', pg_catalog.jsonb_build_object(
      'granted', v_settings.realise_default,
      'consumed', 0,
      'reserved', 0,
      'remaining', v_settings.realise_default
    ),
    'accounts', v_accounts
  );

  insert into advertising_game.image_lab_teacher_operation (
    operation_id,
    ledger_operation,
    user_ids,
    enabled,
    object_amount,
    realise_amount,
    request_hash,
    result
  ) values (
    p_operation_id,
    p_operation,
    p_user_ids,
    p_enabled,
    p_object_amount,
    p_realise_amount,
    p_request_hash,
    v_result
  );

  return v_result;
end
$function$;

alter function public.advertising_game_image_lab_teacher_rpc(
  text,
  uuid[],
  boolean,
  integer,
  integer,
  text,
  text
) owner to postgres;

revoke all on function public.advertising_game_image_lab_teacher_rpc(
  text,
  uuid[],
  boolean,
  integer,
  integer,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.advertising_game_image_lab_teacher_rpc(
  text,
  uuid[],
  boolean,
  integer,
  integer,
  text,
  text
) to service_role;
