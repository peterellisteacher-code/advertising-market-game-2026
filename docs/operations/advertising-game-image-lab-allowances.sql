-- Advertising Market Game Image Lab allowance ledger.
-- Apply this transaction-body SQL exactly once after the account-progress
-- foundation. Supabase apply_migration supplies the outer transaction and
-- migration-ledger write. Do not add transaction-control statements here.

do $collision_preflight$
declare
  v_name text;
begin
  if (
    select pg_catalog.count(*)
      from pg_catalog.pg_namespace
      where nspname = 'advertising_game'
  ) = 0 then
    raise exception using
      errcode = '3F000',
      message = 'Advertising Game schema is missing';
  end if;

  foreach v_name in array array[
    'image_lab_settings',
    'image_lab_allowance',
    'image_lab_operation'
  ] loop
    if exists (
      select 1
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'advertising_game'
          and c.relname = v_name
    ) then
      raise exception using
        errcode = '42P07',
        message = 'Advertising Game Image Lab relation collision';
    end if;
  end loop;

  if exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'advertising_game_image_lab_rpc'
  ) then
    raise exception using
      errcode = '42723',
      message = 'Advertising Game Image Lab function collision';
  end if;
end;
$collision_preflight$;

revoke all on schema advertising_game from public, anon, authenticated, service_role;

create table advertising_game.image_lab_settings (
  singleton_id boolean primary key default true
    check (singleton_id),
  enabled boolean not null default false,
  object_default integer not null default 0
    check (object_default between 0 and 100),
  realise_default integer not null default 0
    check (realise_default between 0 and 100),
  updated_at timestamptz not null default statement_timestamp()
);

create table advertising_game.image_lab_allowance (
  user_id uuid primary key references auth.users (id) on delete cascade,
  object_granted integer not null default 0
    check (object_granted between 0 and 100),
  object_consumed integer not null default 0
    check (object_consumed between 0 and 100),
  object_reserved integer not null default 0
    check (object_reserved between 0 and 100),
  realise_granted integer not null default 0
    check (realise_granted between 0 and 100),
  realise_consumed integer not null default 0
    check (realise_consumed between 0 and 100),
  realise_reserved integer not null default 0
    check (realise_reserved between 0 and 100),
  updated_at timestamptz not null default statement_timestamp(),
  constraint advertising_game_image_lab_object_total_check
    check (object_consumed + object_reserved <= object_granted),
  constraint advertising_game_image_lab_realise_total_check
    check (realise_consumed + realise_reserved <= realise_granted)
);

create table advertising_game.image_lab_operation (
  operation_id text primary key,
  ledger_operation text not null,
  user_id uuid references auth.users (id) on delete cascade,
  stage text,
  amount integer,
  job_key text,
  request_hash text not null,
  operation_status text not null,
  outcome_uncertain boolean not null default false,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint advertising_game_image_lab_operation_id_check
    check (operation_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint advertising_game_image_lab_operation_kind_check
    check (ledger_operation in ('set_global', 'set', 'add', 'revoke', 'reserve')),
  constraint advertising_game_image_lab_operation_stage_check
    check (stage is null or stage in ('object', 'realise')),
  constraint advertising_game_image_lab_operation_amount_check
    check (amount is null or amount between 0 and 100),
  constraint advertising_game_image_lab_operation_job_key_check
    check (job_key is null or job_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  constraint advertising_game_image_lab_operation_request_hash_check
    check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint advertising_game_image_lab_operation_status_check
    check (operation_status in ('reserved', 'completed', 'refunded')),
  constraint advertising_game_image_lab_operation_result_check
    check (pg_catalog.jsonb_typeof(result) = 'object'),
  constraint advertising_game_image_lab_operation_timestamps_check
    check (updated_at >= created_at)
);

alter table advertising_game.image_lab_settings enable row level security;
alter table advertising_game.image_lab_allowance enable row level security;
alter table advertising_game.image_lab_operation enable row level security;

revoke all on table advertising_game.image_lab_settings
  from public, anon, authenticated, service_role;
revoke all on table advertising_game.image_lab_allowance
  from public, anon, authenticated, service_role;
revoke all on table advertising_game.image_lab_operation
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema advertising_game
  from public, anon, authenticated, service_role;

create index advertising_game_image_lab_operation_user_idx
  on advertising_game.image_lab_operation (user_id, created_at desc);
create unique index advertising_game_image_lab_operation_job_idx
  on advertising_game.image_lab_operation (user_id, job_key)
  where job_key is not null and ledger_operation = 'reserve';

insert into advertising_game.image_lab_settings (
  singleton_id,
  enabled,
  object_default,
  realise_default
) values (true, false, 0, 0);

create function public.advertising_game_image_lab_rpc(
  p_user_id uuid,
  p_operation text,
  p_stage text,
  p_amount integer,
  p_operation_id text,
  p_job_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_settings advertising_game.image_lab_settings%rowtype;
  v_allowance advertising_game.image_lab_allowance%rowtype;
  v_existing_operation advertising_game.image_lab_operation%rowtype;
  v_status text;
  v_result jsonb;
  v_accounts jsonb;
begin
  if p_operation is null or p_operation not in (
    'status',
    'global_status',
    'set_global',
    'set',
    'add',
    'revoke',
    'reserve',
    'complete',
    'refund',
    'mark_uncertain',
    'list'
  ) then
    raise exception using errcode = '22023', message = 'invalid operation';
  end if;
  if p_operation_id is null
    or p_operation_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
    or p_request_hash is null
    or p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid operation identity';
  end if;
  if p_stage is not null and p_stage not in ('object', 'realise') then
    raise exception using errcode = '22023', message = 'invalid stage';
  end if;
  if p_amount is not null
    and (p_amount < 0 or p_amount > 100) then
    raise exception using errcode = '22023', message = 'invalid amount';
  end if;
  if p_job_key is not null
    and p_job_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception using errcode = '22023', message = 'invalid job key';
  end if;

  if p_operation in ('status', 'set', 'add', 'revoke')
    and (
      p_user_id is null
      or p_job_key is not null
      or (
        p_operation = 'status'
        and (p_stage is not null or p_amount is not null)
      )
      or (
        p_operation <> 'status'
        and (
          p_stage is null
          or p_amount is null
          or (p_operation in ('add', 'revoke') and p_amount < 1)
        )
      )
    ) then
    raise exception using errcode = '22023', message = 'invalid account operation';
  end if;

  if p_operation in ('reserve', 'complete', 'refund', 'mark_uncertain')
    and (
      p_user_id is null
      or p_stage is null
      or p_amount is distinct from 1
      or p_job_key is null
    ) then
    raise exception using errcode = '22023', message = 'invalid reservation operation';
  end if;

  if p_operation in ('global_status', 'list')
    and (
      p_user_id is not null
      or p_stage is not null
      or p_amount is not null
      or p_job_key is not null
    ) then
    raise exception using errcode = '22023', message = 'invalid global read';
  end if;

  if p_operation = 'set_global'
    and (
      p_user_id is not null
      or p_job_key is not null
      or p_amount is null
      or (p_stage is null and p_amount not in (0, 1))
    ) then
    raise exception using errcode = '22023', message = 'invalid global mutation';
  end if;

  if p_operation in (
    'set_global',
    'set',
    'add',
    'revoke',
    'reserve',
    'complete',
    'refund',
    'mark_uncertain'
  ) then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('image-lab-global', 741927)
    );
    if p_user_id is not null then
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_user_id::text, 741927)
      );
    end if;

    if exists (
      select 1
        from advertising_game.image_lab_operation
        where image_lab_operation.operation_id = p_operation_id
          and (
            image_lab_operation.user_id is distinct from p_user_id
            or image_lab_operation.stage is distinct from p_stage
            or image_lab_operation.amount is distinct from p_amount
            or image_lab_operation.job_key is distinct from p_job_key
            or image_lab_operation.request_hash is distinct from p_request_hash
            or (
              p_operation in ('set_global', 'set', 'add', 'revoke', 'reserve')
              and image_lab_operation.ledger_operation is distinct from p_operation
            )
            or (
              p_operation in ('complete', 'refund', 'mark_uncertain')
              and image_lab_operation.ledger_operation is distinct from 'reserve'
            )
          )
    ) then
      raise exception using errcode = '22023', message = 'operation replay mismatch';
    end if;

    select image_lab_operation.*
      into v_existing_operation
      from advertising_game.image_lab_operation
      where image_lab_operation.operation_id = p_operation_id;

    if found then
      if p_operation in ('set_global', 'set', 'add', 'revoke', 'reserve') then
        return v_existing_operation.result;
      end if;

      if v_existing_operation.operation_status in ('completed', 'refunded') then
        if (
          p_operation = 'complete'
          and v_existing_operation.operation_status = 'completed'
        ) or (
          p_operation = 'refund'
          and v_existing_operation.operation_status = 'refunded'
        ) then
          return v_existing_operation.result;
        end if;
        raise exception using errcode = '22023', message = 'terminal operation conflict';
      end if;

      if p_operation = 'mark_uncertain' then
        if v_existing_operation.operation_status is distinct from 'reserved' then
          raise exception using errcode = '22023', message = 'reservation is not open';
        end if;
        if v_existing_operation.outcome_uncertain then
          return v_existing_operation.result;
        end if;

        select *
          into v_settings
          from advertising_game.image_lab_settings
          where singleton_id = true;
        select *
          into v_allowance
          from advertising_game.image_lab_allowance
          where user_id = p_user_id;
        if not found then
          raise exception using errcode = 'P0002', message = 'allowance row missing';
        end if;

        v_result := pg_catalog.jsonb_build_object(
          'status', 'uncertain',
          'enabled', v_settings.enabled,
          'object', pg_catalog.jsonb_build_object(
            'granted', v_allowance.object_granted,
            'consumed', v_allowance.object_consumed,
            'reserved', v_allowance.object_reserved,
            'remaining', v_allowance.object_granted
              - v_allowance.object_consumed
              - v_allowance.object_reserved
          ),
          'realise', pg_catalog.jsonb_build_object(
            'granted', v_allowance.realise_granted,
            'consumed', v_allowance.realise_consumed,
            'reserved', v_allowance.realise_reserved,
            'remaining', v_allowance.realise_granted
              - v_allowance.realise_consumed
              - v_allowance.realise_reserved
          )
        );
        update advertising_game.image_lab_operation
          set outcome_uncertain = true,
              result = v_result,
              updated_at = pg_catalog.clock_timestamp()
          where image_lab_operation.operation_id = p_operation_id;
        return v_result;
      end if;

      if v_existing_operation.operation_status is distinct from 'reserved' then
        raise exception using errcode = '22023', message = 'reservation is not open';
      end if;

      if p_operation = 'complete' then
        if p_stage = 'object' then
          update advertising_game.image_lab_allowance
            set object_reserved = object_reserved - 1,
                object_consumed = object_consumed + 1,
                updated_at = pg_catalog.clock_timestamp()
            where user_id = p_user_id
              and object_reserved >= 1
            returning * into v_allowance;
        else
          update advertising_game.image_lab_allowance
            set realise_reserved = realise_reserved - 1,
                realise_consumed = realise_consumed + 1,
                updated_at = pg_catalog.clock_timestamp()
            where user_id = p_user_id
              and realise_reserved >= 1
            returning * into v_allowance;
        end if;
        v_status := 'completed';
      elsif p_operation = 'refund' then
        if p_stage = 'object' then
          update advertising_game.image_lab_allowance
            set object_reserved = object_reserved - 1,
                updated_at = pg_catalog.clock_timestamp()
            where user_id = p_user_id
              and object_reserved >= 1
            returning * into v_allowance;
        else
          update advertising_game.image_lab_allowance
            set realise_reserved = realise_reserved - 1,
                updated_at = pg_catalog.clock_timestamp()
            where user_id = p_user_id
              and realise_reserved >= 1
            returning * into v_allowance;
        end if;
        v_status := 'refunded';
      end if;
      if not found then
        raise exception using errcode = '23514', message = 'reserved counter mismatch';
      end if;

      select *
        into v_settings
        from advertising_game.image_lab_settings
        where singleton_id = true;
      v_result := pg_catalog.jsonb_build_object(
        'status', v_status,
        'enabled', v_settings.enabled,
        'object', pg_catalog.jsonb_build_object(
          'granted', v_allowance.object_granted,
          'consumed', v_allowance.object_consumed,
          'reserved', v_allowance.object_reserved,
          'remaining', v_allowance.object_granted
            - v_allowance.object_consumed
            - v_allowance.object_reserved
        ),
        'realise', pg_catalog.jsonb_build_object(
          'granted', v_allowance.realise_granted,
          'consumed', v_allowance.realise_consumed,
          'reserved', v_allowance.realise_reserved,
          'remaining', v_allowance.realise_granted
            - v_allowance.realise_consumed
            - v_allowance.realise_reserved
        )
      );
      update advertising_game.image_lab_operation
        set operation_status = v_status,
            result = v_result,
            updated_at = pg_catalog.clock_timestamp()
        where image_lab_operation.operation_id = p_operation_id;
      return v_result;
    elsif p_operation in ('complete', 'refund', 'mark_uncertain') then
      raise exception using errcode = 'P0002', message = 'reservation operation missing';
    end if;
  end if;

  select *
    into v_settings
    from advertising_game.image_lab_settings
    where singleton_id = true;
  if not found then
    raise exception using errcode = 'P0002', message = 'Image Lab settings missing';
  end if;

  if p_operation = 'global_status' then
    return pg_catalog.jsonb_build_object(
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
      )
    );
  end if;

  if p_operation = 'list' then
    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'userId', listed.user_id,
          'object', pg_catalog.jsonb_build_object(
            'granted', listed.object_granted,
            'consumed', listed.object_consumed,
            'reserved', listed.object_reserved,
            'remaining', listed.object_granted
              - listed.object_consumed
              - listed.object_reserved
          ),
          'realise', pg_catalog.jsonb_build_object(
            'granted', listed.realise_granted,
            'consumed', listed.realise_consumed,
            'reserved', listed.realise_reserved,
            'remaining', listed.realise_granted
              - listed.realise_consumed
              - listed.realise_reserved
          )
        )
        order by listed.user_id
      ),
      '[]'::pg_catalog.jsonb
    )
      into v_accounts
      from advertising_game.image_lab_allowance as listed;
    return pg_catalog.jsonb_build_object(
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
  end if;

  if p_operation = 'set_global' then
    if p_stage is null then
      update advertising_game.image_lab_settings
        set enabled = (p_amount = 1),
            updated_at = pg_catalog.clock_timestamp()
        where singleton_id = true
        returning * into v_settings;
    elsif p_stage = 'object' then
      update advertising_game.image_lab_settings
        set object_default = p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where singleton_id = true
        returning * into v_settings;
    else
      update advertising_game.image_lab_settings
        set realise_default = p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where singleton_id = true
        returning * into v_settings;
    end if;
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
      )
    );
    insert into advertising_game.image_lab_operation (
      operation_id,
      ledger_operation,
      user_id,
      stage,
      amount,
      job_key,
      request_hash,
      operation_status,
      result
    ) values (
      p_operation_id,
      p_operation,
      p_user_id,
      p_stage,
      p_amount,
      p_job_key,
      p_request_hash,
      'completed',
      v_result
    );
    return v_result;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('image-lab-global', 741927)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 741927)
  );
  insert into advertising_game.image_lab_allowance (
    user_id,
    object_granted,
    realise_granted
  ) values (
    p_user_id,
    0,
    0
  ) on conflict (user_id) do nothing;
  select *
    into v_allowance
    from advertising_game.image_lab_allowance
    where user_id = p_user_id;

  if p_operation = 'status' then
    return pg_catalog.jsonb_build_object(
      'status', case when v_settings.enabled then 'available' else 'disabled' end,
      'enabled', v_settings.enabled,
      'object', pg_catalog.jsonb_build_object(
        'granted', v_allowance.object_granted,
        'consumed', v_allowance.object_consumed,
        'reserved', v_allowance.object_reserved,
        'remaining', v_allowance.object_granted
          - v_allowance.object_consumed
          - v_allowance.object_reserved
      ),
      'realise', pg_catalog.jsonb_build_object(
        'granted', v_allowance.realise_granted,
        'consumed', v_allowance.realise_consumed,
        'reserved', v_allowance.realise_reserved,
        'remaining', v_allowance.realise_granted
          - v_allowance.realise_consumed
          - v_allowance.realise_reserved
      )
    );
  end if;

  if p_operation = 'set' then
    if p_stage = 'object' then
      if v_allowance.object_consumed + v_allowance.object_reserved + p_amount > 100 then
        raise exception using errcode = '22023', message = 'object allowance exceeds limit';
      end if;
      update advertising_game.image_lab_allowance
        set object_granted = object_consumed + object_reserved + p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    else
      if v_allowance.realise_consumed + v_allowance.realise_reserved + p_amount > 100 then
        raise exception using errcode = '22023', message = 'realise allowance exceeds limit';
      end if;
      update advertising_game.image_lab_allowance
        set realise_granted = realise_consumed + realise_reserved + p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    end if;
    v_status := 'available';
  elsif p_operation = 'add' then
    if p_stage = 'object' then
      if v_allowance.object_granted + p_amount > 100 then
        raise exception using errcode = '22023', message = 'object allowance exceeds limit';
      end if;
      update advertising_game.image_lab_allowance
        set object_granted = object_granted + p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    else
      if v_allowance.realise_granted + p_amount > 100 then
        raise exception using errcode = '22023', message = 'realise allowance exceeds limit';
      end if;
      update advertising_game.image_lab_allowance
        set realise_granted = realise_granted + p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    end if;
    v_status := 'available';
  elsif p_operation = 'revoke' then
    if p_stage = 'object' then
      if v_allowance.object_granted
        - v_allowance.object_consumed
        - v_allowance.object_reserved < p_amount then
        raise exception using errcode = '22023', message = 'object availability too low';
      end if;
      update advertising_game.image_lab_allowance
        set object_granted = object_granted - p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    else
      if v_allowance.realise_granted
        - v_allowance.realise_consumed
        - v_allowance.realise_reserved < p_amount then
        raise exception using errcode = '22023', message = 'realise availability too low';
      end if;
      update advertising_game.image_lab_allowance
        set realise_granted = realise_granted - p_amount,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
        returning * into v_allowance;
    end if;
    v_status := 'available';
  elsif p_operation = 'reserve' then
    if not v_settings.enabled then
      return pg_catalog.jsonb_build_object(
        'status', 'disabled',
        'enabled', false,
        'object', pg_catalog.jsonb_build_object(
          'granted', v_allowance.object_granted,
          'consumed', v_allowance.object_consumed,
          'reserved', v_allowance.object_reserved,
          'remaining', v_allowance.object_granted
            - v_allowance.object_consumed
            - v_allowance.object_reserved
        ),
        'realise', pg_catalog.jsonb_build_object(
          'granted', v_allowance.realise_granted,
          'consumed', v_allowance.realise_consumed,
          'reserved', v_allowance.realise_reserved,
          'remaining', v_allowance.realise_granted
            - v_allowance.realise_consumed
            - v_allowance.realise_reserved
        )
      );
    end if;
    if p_stage = 'object' then
      update advertising_game.image_lab_allowance
        set object_reserved = object_reserved + 1,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
          and object_granted - object_consumed - object_reserved >= 1
        returning * into v_allowance;
    else
      update advertising_game.image_lab_allowance
        set realise_reserved = realise_reserved + 1,
            updated_at = pg_catalog.clock_timestamp()
        where user_id = p_user_id
          and realise_granted - realise_consumed - realise_reserved >= 1
        returning * into v_allowance;
    end if;
    if not found then
      select *
        into v_allowance
        from advertising_game.image_lab_allowance
        where user_id = p_user_id;
      return pg_catalog.jsonb_build_object(
        'status', 'available',
        'enabled', v_settings.enabled,
        'object', pg_catalog.jsonb_build_object(
          'granted', v_allowance.object_granted,
          'consumed', v_allowance.object_consumed,
          'reserved', v_allowance.object_reserved,
          'remaining', v_allowance.object_granted
            - v_allowance.object_consumed
            - v_allowance.object_reserved
        ),
        'realise', pg_catalog.jsonb_build_object(
          'granted', v_allowance.realise_granted,
          'consumed', v_allowance.realise_consumed,
          'reserved', v_allowance.realise_reserved,
          'remaining', v_allowance.realise_granted
            - v_allowance.realise_consumed
            - v_allowance.realise_reserved
        )
      );
    end if;
    v_status := 'reserved';
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'status', v_status,
    'enabled', v_settings.enabled,
    'object', pg_catalog.jsonb_build_object(
      'granted', v_allowance.object_granted,
      'consumed', v_allowance.object_consumed,
      'reserved', v_allowance.object_reserved,
      'remaining', v_allowance.object_granted
        - v_allowance.object_consumed
        - v_allowance.object_reserved
    ),
    'realise', pg_catalog.jsonb_build_object(
      'granted', v_allowance.realise_granted,
      'consumed', v_allowance.realise_consumed,
      'reserved', v_allowance.realise_reserved,
      'remaining', v_allowance.realise_granted
        - v_allowance.realise_consumed
        - v_allowance.realise_reserved
    )
  );
  insert into advertising_game.image_lab_operation (
    operation_id,
    ledger_operation,
    user_id,
    stage,
    amount,
    job_key,
    request_hash,
    operation_status,
    result
  ) values (
    p_operation_id,
    p_operation,
    p_user_id,
    p_stage,
    p_amount,
    p_job_key,
    p_request_hash,
    case when p_operation = 'reserve' then 'reserved' else 'completed' end,
    v_result
  );
  return v_result;
end;
$function$;

alter function public.advertising_game_image_lab_rpc(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text
) owner to postgres;

revoke all on function public.advertising_game_image_lab_rpc(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text
) from public, anon, authenticated, service_role;

grant execute on function public.advertising_game_image_lab_rpc(
  uuid,
  text,
  text,
  integer,
  text,
  text,
  text
) to service_role;
