-- GymFlow V1.05 · Segunda pantalla global sincronizada
-- Mantiene el último evento de acceso durante 30 segundos y lo distribuye por Supabase Realtime.

create schema if not exists private;

create table if not exists private.gf_access_display_state (
  id text primary key,
  display_key text not null unique,
  event jsonb,
  updated_at timestamptz not null default now()
);

alter table private.gf_access_display_state enable row level security;
revoke all on private.gf_access_display_state from public, anon, authenticated;

insert into private.gf_access_display_state (id, display_key, event)
values ('main', encode(gen_random_bytes(24), 'hex'), null)
on conflict (id) do nothing;

create or replace function public.gf_get_access_display_key()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_key text;
begin
  select role into v_role
  from public.gf_profiles
  where user_id = auth.uid()
  limit 1;

  if v_role not in ('admin','coadmin','profe') then
    raise exception 'Sin permisos para abrir la segunda pantalla.';
  end if;

  select display_key into v_key
  from private.gf_access_display_state
  where id = 'main';

  return v_key;
end;
$$;

create or replace function public.gf_get_access_display_state(p_display_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_event jsonb;
  v_updated_at timestamptz;
begin
  select event, updated_at
  into v_event, v_updated_at
  from private.gf_access_display_state
  where id = 'main'
    and display_key = p_display_key;

  if v_updated_at is null then
    return null;
  end if;

  if v_updated_at < now() - interval '30 seconds' then
    return null;
  end if;

  return v_event;
end;
$$;

create or replace function public.gf_publish_access_display(p_event jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_key text;
  v_event jsonb;
begin
  select role into v_role
  from public.gf_profiles
  where user_id = auth.uid()
  limit 1;

  if v_role not in ('admin','coadmin','profe') then
    raise exception 'Sin permisos para publicar accesos.';
  end if;

  if jsonb_typeof(coalesce(p_event, '{}'::jsonb)) <> 'object' then
    raise exception 'Evento de acceso inválido.';
  end if;

  v_event := coalesce(p_event, '{}'::jsonb);

  select display_key into v_key
  from private.gf_access_display_state
  where id = 'main'
  for update;

  if v_key is null then
    raise exception 'Segunda pantalla no configurada.';
  end if;

  update private.gf_access_display_state
  set event = v_event,
      updated_at = now()
  where id = 'main';

  perform realtime.send(
    v_event,
    'access-result',
    'access-display:' || v_key,
    false
  );

  return true;
end;
$$;

revoke all on function public.gf_get_access_display_key() from public, anon;
grant execute on function public.gf_get_access_display_key() to authenticated;

revoke all on function public.gf_get_access_display_state(text) from public;
grant execute on function public.gf_get_access_display_state(text) to anon, authenticated;

revoke all on function public.gf_publish_access_display(jsonb) from public, anon;
grant execute on function public.gf_publish_access_display(jsonb) to authenticated;
