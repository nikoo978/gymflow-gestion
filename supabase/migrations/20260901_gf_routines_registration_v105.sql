-- GymFlow V.1.05
-- Registro con nombre+DNI, borrado real de cuentas por Admin master y sistema de rutinas.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Perfil de cuenta: DNI requerido para nuevas altas y visible al administrar cuentas.
alter table public.gf_profiles add column if not exists dni text;

update public.gf_profiles p
set dni = nullif(regexp_replace(coalesce(person.item->>'dni',''), '[^0-9]', '', 'g'), '')
from public.gf_account_links l
join lateral (
  select item
  from public.gf_gym_state s,
       jsonb_array_elements(coalesce(s.data->'people', '[]'::jsonb)) item
  where s.id = 'main' and item->>'id' = l.person_id
  limit 1
) person on true
where p.user_id = l.user_id
  and coalesce(trim(p.dni), '') = ''
  and coalesce(trim(person.item->>'dni'), '') <> '';

create unique index if not exists gf_profiles_dni_unique_idx
  on public.gf_profiles (dni)
  where dni is not null and trim(dni) <> '';

alter table public.gf_profiles drop constraint if exists gf_profiles_dni_format_chk;
alter table public.gf_profiles add constraint gf_profiles_dni_format_chk
  check (dni is null or dni ~ '^[0-9]{6,10}$');

create or replace function public.gf_create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  make_master boolean;
  v_name text;
  v_dni text;
begin
  perform pg_advisory_xact_lock(hashtext('gymflow-master-bootstrap'));
  select not exists(select 1 from public.gf_profiles where is_master = true) into make_master;

  v_name := trim(coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(coalesce(new.email, 'Usuario'), '@', 1)));
  v_dni := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'dni',''), '[^0-9]', '', 'g'), '');

  if not make_master then
    if char_length(v_name) < 3 then raise exception 'Nombre completo requerido.'; end if;
    if v_dni is null or v_dni !~ '^[0-9]{6,10}$' then raise exception 'DNI requerido.'; end if;
    if exists(select 1 from public.gf_profiles where dni = v_dni) then raise exception 'Ese DNI ya tiene una cuenta registrada.'; end if;
  end if;

  insert into public.gf_profiles (user_id, email, display_name, dni, role, is_master, created_at)
  values (
    new.id,
    lower(coalesce(new.email, new.id::text || '@local.invalid')),
    v_name,
    v_dni,
    case when make_master then 'admin' else 'cliente' end,
    make_master,
    coalesce(new.created_at, now())
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Amplía el listado administrativo con DNI.
drop function if exists public.gf_list_accounts();
create function public.gf_list_accounts()
returns table (
  user_id uuid,
  email text,
  display_name text,
  dni text,
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
  select p.user_id, p.email, p.display_name, p.dni, p.role, p.is_master, p.created_at, p.updated_at,
         l.person_id, l.link_kind, l.linked_at
  from public.gf_profiles p
  left join public.gf_account_links l on l.user_id = p.user_id
  order by p.is_master desc, p.created_at asc;
end;
$$;
revoke all on function public.gf_list_accounts() from public, anon;
grant execute on function public.gf_list_accounts() to authenticated;

-- El Admin master puede eliminar la cuenta Auth (mail registrado) sin borrar la ficha del gimnasio.
create or replace function public.gf_delete_registered_account(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor public.gf_profiles;
  target public.gf_profiles;
  v_person_id text;
begin
  select * into actor from public.gf_profiles where user_id = auth.uid();
  if actor.user_id is null or actor.role <> 'admin' or actor.is_master is not true then
    raise exception 'Sólo el Admin master puede eliminar cuentas registradas.';
  end if;

  if target_user_id = auth.uid() then raise exception 'El Admin master no puede eliminar su propia cuenta.'; end if;
  select * into target from public.gf_profiles where user_id = target_user_id;
  if target.user_id is null then raise exception 'La cuenta indicada no existe.'; end if;
  if target.is_master then raise exception 'El Admin master está protegido.'; end if;

  select person_id into v_person_id from public.gf_account_links where user_id = target_user_id;
  delete from auth.users where id = target_user_id;
  if not found then raise exception 'No se pudo eliminar la cuenta de Auth.'; end if;

  return jsonb_build_object('ok', true, 'email', target.email, 'personId', v_person_id);
end;
$$;
revoke all on function public.gf_delete_registered_account(uuid) from public, anon;
grant execute on function public.gf_delete_registered_account(uuid) to authenticated;

-- El glosario puede ser consultado por cualquier cuenta autenticada; sólo staff lo administra.
drop policy if exists "Staff lee ejercicios" on public.gf_exercises;
drop policy if exists "Usuarios autenticados leen ejercicios" on public.gf_exercises;
create policy "Usuarios autenticados leen ejercicios"
on public.gf_exercises
for select
to authenticated
using (public.gf_current_role() in ('admin','coadmin','profe','cliente'));

-- Rutinas internas: no se exponen como tablas del Data API.
create table if not exists private.gf_routines (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 100),
  description text not null default '',
  source_type text not null check (source_type in ('professor','client')),
  owner_user_id uuid references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (source_type = 'client' and owner_user_id is not null)
    or (source_type = 'professor' and owner_user_id is null)
  )
);

create table if not exists private.gf_routine_items (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references private.gf_routines(id) on delete cascade,
  exercise_id uuid references public.gf_exercises(id) on delete set null,
  exercise_name text not null,
  position integer not null default 0,
  sets integer not null default 3 check (sets between 1 and 20),
  reps text not null default '8-12',
  rest_seconds integer not null default 60 check (rest_seconds between 0 and 1800),
  notes text not null default ''
);

create table if not exists private.gf_routine_assignments (
  routine_id uuid not null references private.gf_routines(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (routine_id, client_user_id)
);

create index if not exists gf_routines_owner_idx on private.gf_routines(owner_user_id, updated_at desc);
create index if not exists gf_routines_creator_idx on private.gf_routines(created_by, updated_at desc);
create index if not exists gf_routine_items_routine_idx on private.gf_routine_items(routine_id, position);
create index if not exists gf_routine_assignments_client_idx on private.gf_routine_assignments(client_user_id, created_at desc);

alter table private.gf_routines enable row level security;
alter table private.gf_routine_items enable row level security;
alter table private.gf_routine_assignments enable row level security;
revoke all on all tables in schema private from public, anon, authenticated;

create or replace function private.gf_replace_routine_items(p_routine_id uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = private, public
as $$
declare
  item jsonb;
  v_position integer := 0;
  v_exercise_id uuid;
  v_name text;
begin
  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then raise exception 'Formato de ejercicios inválido.'; end if;
  delete from private.gf_routine_items where routine_id = p_routine_id;

  for item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_position := v_position + 1;
    v_exercise_id := nullif(item->>'exercise_id','')::uuid;
    select name into v_name from public.gf_exercises where id = v_exercise_id;
    v_name := coalesce(v_name, nullif(trim(item->>'exercise_name'), ''), 'Ejercicio');

    insert into private.gf_routine_items(routine_id, exercise_id, exercise_name, position, sets, reps, rest_seconds, notes)
    values (
      p_routine_id,
      v_exercise_id,
      v_name,
      v_position,
      greatest(1, least(coalesce((item->>'sets')::integer, 3), 20)),
      coalesce(nullif(trim(item->>'reps'), ''), '8-12'),
      greatest(0, least(coalesce((item->>'rest_seconds')::integer, 60), 1800)),
      coalesce(item->>'notes', '')
    );
  end loop;
end;
$$;
revoke all on function private.gf_replace_routine_items(uuid, jsonb) from public, anon, authenticated;

create or replace function private.gf_routine_json(p_routine_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = private, public
as $$
  select jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'description', r.description,
    'sourceType', r.source_type,
    'ownerUserId', r.owner_user_id,
    'createdBy', r.created_by,
    'createdAt', r.created_at,
    'updatedAt', r.updated_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'exercise_id', i.exercise_id,
        'exercise_name', i.exercise_name,
        'position', i.position,
        'sets', i.sets,
        'reps', i.reps,
        'rest_seconds', i.rest_seconds,
        'notes', i.notes
      ) order by i.position)
      from private.gf_routine_items i where i.routine_id = r.id
    ), '[]'::jsonb)
  )
  from private.gf_routines r where r.id = p_routine_id;
$$;
revoke all on function private.gf_routine_json(uuid) from public, anon, authenticated;

-- Cliente: hasta tres rutinas propias + rutinas enviadas por profesor.
create or replace function public.gf_get_my_routines()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_role text;
  v_personal jsonb;
  v_assigned jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role <> 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;

  select coalesce(jsonb_agg(private.gf_routine_json(r.id) order by r.updated_at desc), '[]'::jsonb)
  into v_personal
  from private.gf_routines r
  where r.source_type = 'client' and r.owner_user_id = auth.uid();

  select coalesce(jsonb_agg(
    private.gf_routine_json(r.id) || jsonb_build_object('assignedAt', a.created_at)
    order by a.created_at desc
  ), '[]'::jsonb)
  into v_assigned
  from private.gf_routine_assignments a
  join private.gf_routines r on r.id = a.routine_id and r.source_type = 'professor'
  where a.client_user_id = auth.uid();

  return jsonb_build_object('personal', v_personal, 'assigned', v_assigned);
end;
$$;
revoke all on function public.gf_get_my_routines() from public, anon;
grant execute on function public.gf_get_my_routines() to authenticated;

create or replace function public.gf_save_my_routine(
  p_routine_id uuid,
  p_title text,
  p_description text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_role text;
  v_id uuid;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role <> 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;
  if char_length(trim(coalesce(p_title,''))) < 2 then raise exception 'Ingresá un nombre para la rutina.'; end if;

  if p_routine_id is null then
    if (select count(*) from private.gf_routines where source_type = 'client' and owner_user_id = auth.uid()) >= 3 then
      raise exception 'Podés crear hasta 3 rutinas personales.';
    end if;
    insert into private.gf_routines(title, description, source_type, owner_user_id, created_by)
    values (trim(p_title), coalesce(p_description,''), 'client', auth.uid(), auth.uid())
    returning id into v_id;
  else
    select id into v_id from private.gf_routines
    where id = p_routine_id and source_type = 'client' and owner_user_id = auth.uid();
    if v_id is null then raise exception 'La rutina personal no existe.'; end if;
    update private.gf_routines
    set title = trim(p_title), description = coalesce(p_description,''), updated_at = now()
    where id = v_id;
  end if;

  perform private.gf_replace_routine_items(v_id, p_items);
  update private.gf_routines set updated_at = now() where id = v_id;
  return private.gf_routine_json(v_id);
end;
$$;
revoke all on function public.gf_save_my_routine(uuid, text, text, jsonb) from public, anon;
grant execute on function public.gf_save_my_routine(uuid, text, text, jsonb) to authenticated;

create or replace function public.gf_delete_my_routine(p_routine_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if public.gf_current_role() <> 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;
  delete from private.gf_routines
  where id = p_routine_id and source_type = 'client' and owner_user_id = auth.uid();
  return found;
end;
$$;
revoke all on function public.gf_delete_my_routine(uuid) from public, anon;
grant execute on function public.gf_delete_my_routine(uuid) to authenticated;

create or replace function public.gf_remove_assigned_routine(p_routine_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if public.gf_current_role() <> 'cliente' then raise exception 'Disponible exclusivamente para cuentas Cliente.'; end if;
  delete from private.gf_routine_assignments where routine_id = p_routine_id and client_user_id = auth.uid();
  return found;
end;
$$;
revoke all on function public.gf_remove_assigned_routine(uuid) from public, anon;
grant execute on function public.gf_remove_assigned_routine(uuid) to authenticated;

-- Profesor: crea rutinas compartidas, las asigna a uno o varios clientes y puede editarlas luego.
create or replace function public.gf_list_routine_clients()
returns table (
  user_id uuid,
  email text,
  display_name text,
  dni text,
  person_id text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.gf_current_role() not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar alumnos.'; end if;
  return query
  select p.user_id, p.email, p.display_name, p.dni, l.person_id
  from public.gf_profiles p
  join public.gf_account_links l on l.user_id = p.user_id and l.link_kind = 'cliente'
  where p.role = 'cliente'
  order by p.display_name, p.email;
end;
$$;
revoke all on function public.gf_list_routine_clients() from public, anon;
grant execute on function public.gf_list_routine_clients() to authenticated;

create or replace function public.gf_list_professor_routines()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_role text;
  v_result jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para administrar rutinas.'; end if;

  select coalesce(jsonb_agg(
    private.gf_routine_json(r.id) || jsonb_build_object(
      'assignedUserIds', coalesce((select jsonb_agg(a.client_user_id) from private.gf_routine_assignments a where a.routine_id = r.id), '[]'::jsonb)
    ) order by r.updated_at desc
  ), '[]'::jsonb)
  into v_result
  from private.gf_routines r
  where r.source_type = 'professor'
    and (v_role in ('admin','coadmin') or r.created_by = auth.uid());

  return v_result;
end;
$$;
revoke all on function public.gf_list_professor_routines() from public, anon;
grant execute on function public.gf_list_professor_routines() to authenticated;

create or replace function public.gf_save_professor_routine(
  p_routine_id uuid,
  p_title text,
  p_description text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_role text;
  v_id uuid;
  v_creator uuid;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para administrar rutinas.'; end if;
  if char_length(trim(coalesce(p_title,''))) < 2 then raise exception 'Ingresá un nombre para la rutina.'; end if;

  if p_routine_id is null then
    insert into private.gf_routines(title, description, source_type, owner_user_id, created_by)
    values (trim(p_title), coalesce(p_description,''), 'professor', null, auth.uid())
    returning id into v_id;
  else
    select id, created_by into v_id, v_creator from private.gf_routines
    where id = p_routine_id and source_type = 'professor';
    if v_id is null then raise exception 'La rutina indicada no existe.'; end if;
    if v_role = 'profe' and v_creator is distinct from auth.uid() then raise exception 'Sólo podés editar rutinas creadas por vos.'; end if;
    update private.gf_routines
    set title = trim(p_title), description = coalesce(p_description,''), updated_at = now()
    where id = v_id;
  end if;

  perform private.gf_replace_routine_items(v_id, p_items);
  update private.gf_routines set updated_at = now() where id = v_id;
  return private.gf_routine_json(v_id);
end;
$$;
revoke all on function public.gf_save_professor_routine(uuid, text, text, jsonb) from public, anon;
grant execute on function public.gf_save_professor_routine(uuid, text, text, jsonb) to authenticated;

create or replace function public.gf_assign_professor_routine(p_routine_id uuid, p_client_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_role text;
  v_creator uuid;
  v_client uuid;
  v_added integer := 0;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para asignar rutinas.'; end if;
  select created_by into v_creator from private.gf_routines where id = p_routine_id and source_type = 'professor';
  if not found then raise exception 'La rutina indicada no existe.'; end if;
  if v_role = 'profe' and v_creator is distinct from auth.uid() then raise exception 'Sólo podés asignar rutinas creadas por vos.'; end if;

  foreach v_client in array coalesce(p_client_user_ids, array[]::uuid[]) loop
    if not exists (
      select 1 from public.gf_profiles p
      join public.gf_account_links l on l.user_id = p.user_id and l.link_kind = 'cliente'
      where p.user_id = v_client and p.role = 'cliente'
    ) then
      raise exception 'Uno de los clientes seleccionados no tiene cuenta vinculada válida.';
    end if;

    insert into private.gf_routine_assignments(routine_id, client_user_id, assigned_by)
    values (p_routine_id, v_client, auth.uid())
    on conflict (routine_id, client_user_id) do nothing;
    if found then v_added := v_added + 1; end if;
  end loop;

  return v_added;
end;
$$;
revoke all on function public.gf_assign_professor_routine(uuid, uuid[]) from public, anon;
grant execute on function public.gf_assign_professor_routine(uuid, uuid[]) to authenticated;

create or replace function public.gf_get_client_routines_for_professor(p_client_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  v_role text;
  v_result jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar rutinas de alumnos.'; end if;
  if not exists(select 1 from public.gf_profiles where user_id = p_client_user_id and role = 'cliente') then raise exception 'Cliente inválido.'; end if;

  select coalesce(jsonb_agg(
    private.gf_routine_json(r.id) || jsonb_build_object(
      'assignedAt', a.created_at,
      'canEdit', (v_role in ('admin','coadmin') or r.created_by = auth.uid())
    ) order by a.created_at desc
  ), '[]'::jsonb)
  into v_result
  from private.gf_routine_assignments a
  join private.gf_routines r on r.id = a.routine_id and r.source_type = 'professor'
  where a.client_user_id = p_client_user_id;

  return v_result;
end;
$$;
revoke all on function public.gf_get_client_routines_for_professor(uuid) from public, anon;
grant execute on function public.gf_get_client_routines_for_professor(uuid) to authenticated;
