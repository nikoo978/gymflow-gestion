-- GymFlow V.1.03.1
-- Cuentas PWA -> vínculos administrados desde Usuarios + eventos de registro.
-- Ejecutar una sola vez después de las migraciones V.1.02 y V.1.03.

create extension if not exists pgcrypto;

create table if not exists public.gf_account_links (
  user_id uuid primary key references public.gf_profiles(user_id) on delete cascade,
  person_id text not null,
  link_kind text not null check (link_kind in ('cliente','profe')),
  linked_by uuid references public.gf_profiles(user_id) on delete set null,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists gf_account_links_person_unique_idx
  on public.gf_account_links(person_id);

create table if not exists public.gf_account_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('account_registered')),
  user_id uuid not null references public.gf_profiles(user_id) on delete cascade,
  email text not null,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  unique(event_type, user_id)
);

alter table public.gf_account_links enable row level security;
alter table public.gf_account_events enable row level security;
revoke all on table public.gf_account_links from anon;
revoke all on table public.gf_account_events from anon;
revoke insert, update, delete on table public.gf_account_links from authenticated;
revoke insert, update, delete on table public.gf_account_events from authenticated;
grant select on table public.gf_account_links to authenticated;
grant select on table public.gf_account_events to authenticated;

drop policy if exists "Vinculos propios o administracion" on public.gf_account_links;
create policy "Vinculos propios o administracion"
on public.gf_account_links for select to authenticated
using (
  user_id = auth.uid()
  or public.gf_current_role() in ('admin','coadmin')
);

drop policy if exists "Eventos de cuentas para administracion" on public.gf_account_events;
create policy "Eventos de cuentas para administracion"
on public.gf_account_events for select to authenticated
using (public.gf_current_role() in ('admin','coadmin'));

create or replace function public.gf_touch_account_link_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gf_account_links_updated_at on public.gf_account_links;
create trigger gf_account_links_updated_at
before update on public.gf_account_links
for each row execute function public.gf_touch_account_link_updated_at();

create or replace function public.gf_log_profile_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_master is not true then
    insert into public.gf_account_events(event_type, user_id, email, display_name, created_at)
    values ('account_registered', new.user_id, new.email, new.display_name, coalesce(new.created_at, now()))
    on conflict (event_type, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists gf_profile_registration_event on public.gf_profiles;
create trigger gf_profile_registration_event
after insert on public.gf_profiles
for each row execute function public.gf_log_profile_registration();

insert into public.gf_account_events(event_type, user_id, email, display_name, created_at)
select 'account_registered', p.user_id, p.email, p.display_name, p.created_at
from public.gf_profiles p
where p.is_master is not true
on conflict (event_type, user_id) do nothing;

insert into public.gf_account_links(user_id, person_id, link_kind, linked_by, linked_at)
select p.user_id,
       person->>'id',
       case when person->>'role' = 'Profesor' then 'profe' else 'cliente' end,
       (select user_id from public.gf_profiles where is_master = true limit 1),
       now()
from public.gf_profiles p
cross join lateral jsonb_array_elements(
  coalesce((select data->'people' from public.gf_gym_state where id = 'main'), '[]'::jsonb)
) person
where p.is_master is not true
  and lower(trim(coalesce(person->>'email',''))) = lower(trim(p.email))
  and (
    (p.role = 'cliente' and person->>'role' = 'Cliente')
    or (p.role = 'profe' and person->>'role' = 'Profesor')
  )
on conflict do nothing;

create or replace function public.gf_list_accounts()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  is_master boolean,
  created_at timestamptz,
  updated_at timestamptz,
  linked_person_id text,
  linked_kind text,
  linked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.gf_current_role() not in ('admin','coadmin') then
    raise exception 'No tenés permisos para ver las cuentas registradas.';
  end if;

  return query
  select p.user_id, p.email, p.display_name, p.role, p.is_master, p.created_at, p.updated_at,
         l.person_id, l.link_kind, l.linked_at
  from public.gf_profiles p
  left join public.gf_account_links l on l.user_id = p.user_id
  order by p.is_master desc, p.created_at asc;
end;
$$;

revoke all on function public.gf_list_accounts() from public;
grant execute on function public.gf_list_accounts() to authenticated;

create or replace function public.gf_set_account_link(
  target_user_id uuid,
  target_person_id text,
  target_kind text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.gf_profiles;
  target public.gf_profiles;
  v_person jsonb;
  expected_person_role text;
begin
  select * into actor from public.gf_profiles where user_id = auth.uid();
  if actor.user_id is null or actor.role not in ('admin','coadmin') then
    raise exception 'No tenés permisos para vincular cuentas.';
  end if;

  select * into target from public.gf_profiles where user_id = target_user_id;
  if target.user_id is null then raise exception 'La cuenta indicada no existe.'; end if;
  if target.is_master then raise exception 'El Admin master no utiliza vínculo de ficha.'; end if;
  if target_kind not in ('cliente','profe') then raise exception 'Tipo de vínculo inválido.'; end if;
  if coalesce(trim(target_person_id),'') = '' then raise exception 'Seleccioná una ficha del gimnasio.'; end if;

  expected_person_role := case when target_kind = 'profe' then 'Profesor' else 'Cliente' end;

  select item into v_person
  from public.gf_gym_state s,
       jsonb_array_elements(coalesce(s.data->'people','[]'::jsonb)) item
  where s.id = 'main'
    and item->>'id' = target_person_id
    and item->>'role' = expected_person_role
  limit 1;

  if v_person is null then
    raise exception 'La ficha elegida no existe o no coincide con el tipo de cuenta.';
  end if;

  if exists (
    select 1 from public.gf_account_links
    where person_id = target_person_id and user_id <> target_user_id
  ) then
    raise exception 'Esa ficha ya está vinculada a otra cuenta PWA.';
  end if;

  update public.gf_profiles
  set role = target_kind
  where user_id = target_user_id;

  insert into public.gf_account_links(user_id, person_id, link_kind, linked_by, linked_at, updated_at)
  values (target_user_id, target_person_id, target_kind, auth.uid(), now(), now())
  on conflict (user_id) do update
  set person_id = excluded.person_id,
      link_kind = excluded.link_kind,
      linked_by = excluded.linked_by,
      linked_at = excluded.linked_at,
      updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'userId', target_user_id,
    'personId', target_person_id,
    'kind', target_kind,
    'personName', v_person->>'name'
  );
end;
$$;

revoke all on function public.gf_set_account_link(uuid, text, text) from public;
grant execute on function public.gf_set_account_link(uuid, text, text) to authenticated;

create or replace function public.gf_unlink_account(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.gf_profiles;
  target public.gf_profiles;
begin
  select * into actor from public.gf_profiles where user_id = auth.uid();
  if actor.user_id is null or actor.role not in ('admin','coadmin') then
    raise exception 'No tenés permisos para desvincular cuentas.';
  end if;
  select * into target from public.gf_profiles where user_id = target_user_id;
  if target.is_master then raise exception 'El Admin master no utiliza vínculo de ficha.'; end if;
  delete from public.gf_account_links where user_id = target_user_id;
  return true;
end;
$$;

revoke all on function public.gf_unlink_account(uuid) from public;
grant execute on function public.gf_unlink_account(uuid) to authenticated;

create or replace function public.gf_set_user_role(target_email text, new_role text)
returns public.gf_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  actor public.gf_profiles;
  target public.gf_profiles;
  updated public.gf_profiles;
begin
  select * into actor from public.gf_profiles where user_id = auth.uid();
  if actor.user_id is null or actor.role not in ('admin','coadmin') then
    raise exception 'No tenés permisos para administrar roles.';
  end if;
  if new_role not in ('coadmin','profe','cliente') then
    raise exception 'El rol admin está reservado exclusivamente para el master.';
  end if;

  select * into target from public.gf_profiles where lower(email) = lower(trim(target_email));
  if target.user_id is null then raise exception 'No existe una cuenta registrada con ese email.'; end if;
  if target.is_master then raise exception 'El Admin master no puede ser eliminado, degradado ni modificado por roles.'; end if;

  update public.gf_profiles set role = new_role where user_id = target.user_id returning * into updated;

  if new_role = 'coadmin' then
    delete from public.gf_account_links where user_id = target.user_id;
  else
    delete from public.gf_account_links
    where user_id = target.user_id and link_kind <> new_role;
  end if;

  return updated;
end;
$$;

revoke all on function public.gf_set_user_role(text, text) from public;
grant execute on function public.gf_set_user_role(text, text) to authenticated;

create or replace function public.gf_list_account_events(p_limit integer default 10)
returns table (
  id uuid,
  event_type text,
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.gf_current_role() not in ('admin','coadmin') then
    raise exception 'No tenés permisos para ver eventos de cuentas.';
  end if;

  return query
  select e.id, e.event_type, e.user_id, e.email, e.display_name, e.created_at
  from public.gf_account_events e
  order by e.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 50));
end;
$$;

revoke all on function public.gf_list_account_events(integer) from public;
grant execute on function public.gf_list_account_events(integer) to authenticated;

create or replace function public.gf_registration_push_target(p_user_id uuid, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  source_profile public.gf_profiles;
  master_id uuid;
begin
  select * into source_profile
  from public.gf_profiles
  where user_id = p_user_id
    and lower(email) = lower(trim(p_email))
  limit 1;

  if source_profile.user_id is null or source_profile.is_master
     or source_profile.created_at < now() - interval '2 hours' then
    return jsonb_build_object('verified', false);
  end if;

  select user_id into master_id from public.gf_profiles where is_master = true limit 1;
  if master_id is null then return jsonb_build_object('verified', false); end if;

  return jsonb_build_object(
    'verified', true,
    'masterUserId', master_id,
    'userId', source_profile.user_id,
    'email', source_profile.email,
    'displayName', source_profile.display_name,
    'createdAt', source_profile.created_at
  );
end;
$$;

revoke all on function public.gf_registration_push_target(uuid, text) from public;
grant execute on function public.gf_registration_push_target(uuid, text) to anon, authenticated;

create or replace function public.gf_get_my_client_portal()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.gf_profiles;
  v_link public.gf_account_links;
  v_data jsonb;
  v_member jsonb;
  v_member_id text;
  v_accesses jsonb := '[]'::jsonb;
  v_branch_name text;
begin
  select * into v_profile from public.gf_profiles where user_id = auth.uid() limit 1;
  if v_profile.user_id is null then raise exception 'La cuenta no tiene un perfil GymFlow.'; end if;
  if v_profile.role <> 'cliente' then raise exception 'Este portal está disponible exclusivamente para cuentas Cliente.'; end if;

  select * into v_link from public.gf_account_links where user_id = auth.uid() and link_kind = 'cliente' limit 1;
  if v_link.user_id is null then
    return jsonb_build_object(
      'linked', false,
      'account', jsonb_build_object('email', v_profile.email, 'displayName', v_profile.display_name, 'role', v_profile.role),
      'member', null,
      'branchName', null,
      'accesses', '[]'::jsonb
    );
  end if;

  select data into v_data from public.gf_gym_state where id = 'main';
  v_data := coalesce(v_data, '{}'::jsonb);
  v_member_id := v_link.person_id;

  select item into v_member
  from jsonb_array_elements(coalesce(v_data->'people', '[]'::jsonb)) item
  where item->>'id' = v_member_id and item->>'role' = 'Cliente'
  limit 1;

  if v_member is null then
    return jsonb_build_object(
      'linked', false,
      'account', jsonb_build_object('email', v_profile.email, 'displayName', v_profile.display_name, 'role', v_profile.role),
      'member', null,
      'branchName', null,
      'accesses', '[]'::jsonb
    );
  end if;

  select item->>'name' into v_branch_name
  from jsonb_array_elements(coalesce(v_data->'branches', '[]'::jsonb)) item
  where item->>'id' = v_member->>'branch' limit 1;

  select coalesce(jsonb_agg(row_data order by row_data->>'date' desc), '[]'::jsonb)
  into v_accesses
  from (
    select jsonb_build_object(
      'id', item->>'id',
      'allowed', coalesce((item->>'allowed')::boolean, false),
      'manual', coalesce((item->>'manual')::boolean, false),
      'date', item->>'date',
      'branch', item->>'branch'
    ) as row_data
    from jsonb_array_elements(coalesce(v_data->'accesses', '[]'::jsonb)) item
    where item->>'personId' = v_member_id
    order by item->>'date' desc
    limit 30
  ) rows_for_member;

  return jsonb_build_object(
    'linked', true,
    'account', jsonb_build_object('email', v_profile.email, 'displayName', v_profile.display_name, 'role', v_profile.role),
    'member', jsonb_build_object(
      'id', v_member->>'id', 'name', v_member->>'name', 'dni', v_member->>'dni',
      'phone', v_member->>'phone', 'plan', v_member->>'plan', 'start', v_member->>'start',
      'expiry', v_member->>'expiry', 'branch', v_member->>'branch',
      'biometricMethod', v_member->>'biometricMethod', 'biometricStatus', v_member->>'biometricStatus'
    ),
    'branchName', v_branch_name,
    'accesses', v_accesses
  );
end;
$$;

revoke all on function public.gf_get_my_client_portal() from public;
grant execute on function public.gf_get_my_client_portal() to authenticated;
