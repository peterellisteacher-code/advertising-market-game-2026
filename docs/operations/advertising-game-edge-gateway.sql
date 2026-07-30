-- Exact transaction body for the advertising_game Edge broker gateway.
-- Apply once through Supabase migration tooling; do not wrap this body in a
-- second transaction and do not replace an existing object.

do $preflight$
begin
  if pg_catalog.to_regclass('advertising_game.backend_gateway') is not null then
    raise exception 'collision: advertising_game.backend_gateway already exists';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'advertising_game_backend_authorized'
  ) then
    raise exception 'collision: public.advertising_game_backend_authorized already exists';
  end if;

  if pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'required function extensions.digest(bytea,text) is unavailable';
  end if;
end
$preflight$;

create table advertising_game.backend_gateway (
  singleton boolean primary key default true,
  secret_digest bytea not null,
  updated_at timestamp with time zone not null default pg_catalog.now(),
  constraint advertising_game_backend_gateway_singleton check (singleton),
  constraint advertising_game_backend_gateway_digest_length
    check (pg_catalog.octet_length(secret_digest) = 32)
);

alter table advertising_game.backend_gateway enable row level security;
revoke all on table advertising_game.backend_gateway
  from public, anon, authenticated, service_role;

insert into advertising_game.backend_gateway (singleton, secret_digest)
values (
  true,
  pg_catalog.decode('52b22b8c807475e14b3ef0d0bd952f320ddcd835da09802edaf8f302609cce6e', 'hex')
);

create function public.advertising_game_backend_authorized(p_candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when p_candidate is null
      or pg_catalog.octet_length(pg_catalog.convert_to(p_candidate, 'UTF8')) < 32
      or pg_catalog.octet_length(pg_catalog.convert_to(p_candidate, 'UTF8')) > 256
    then false
    else coalesce(
      (
        select gateway.secret_digest = extensions.digest(
          pg_catalog.convert_to(p_candidate, 'UTF8'),
          'sha256'
        )
        from advertising_game.backend_gateway gateway
        where gateway.singleton = true
      ),
      false
    )
  end
$function$;

revoke all on function public.advertising_game_backend_authorized(text)
  from public, anon, authenticated, service_role;
grant execute on function public.advertising_game_backend_authorized(text)
  to service_role;
