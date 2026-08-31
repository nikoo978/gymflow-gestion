-- GymFlow V.1.02
-- Roles globales + estado compartido del gimnasio + sincronización atómica por operaciones.
-- El usuario más antiguo existente en auth.users queda como único Admin master.

create table if not exists public.gf_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default '',
  role text not null default 'cliente' check (role in ('admin','coadmin','profe','cliente')),
  is_master boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists gf_profiles_email_lower_idx on public.gf_profiles (lower(email));
create unique index if not exists gf_profiles_single_master_idx on public.gf_profiles ((is_master)) where is_master;

-- Importa cuentas ya existentes. Sólo la más antigua se convierte en master.
with ranked as (
  select
    id,
    lower(coalesce(email, id::text || '@local.invalid')) as email,
    coalesce(nullif(raw_user_meta_data->>'name',''), split_part(coalesce(email, 'Usuario'), '@', 1)) as display_name,
    row_number() over (order by created_at asc, id asc) as rn,
    created_at
  from auth.users
)
insert into public.gf_profiles (user_id, email, display_name, role, is_master, created_at)
select id, email, display_name,
       case when rn = 1 then 'admin' else 'cliente' end,
       rn = 1,
       created_at
from ranked
on conflict (user_id) do update
set email = excluded.email,
    display_name = case when public.gf_profiles.display_name = '' then excluded.display_name else public.gf_profiles.display_name end;

-- Si el perfil master ya existía, conserva su rol admin.
update public.gf_profiles set role = 'admin' where is_master = true;
update public.gf_profiles set role = 'cliente' where role = 'admin' and is_master = false;

create or replace function public.gf_create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  make_master boolean;
begin
  -- Serializa el bootstrap para garantizar un único master incluso con registros simultáneos.
  perform pg_advisory_xact_lock(hashtext('gymflow-master-bootstrap'));
  select not exists(select 1 from public.gf_profiles where is_master = true) into make_master;

  insert into public.gf_profiles (user_id, email, display_name, role, is_master, created_at)
  values (
    new.id,
    lower(coalesce(new.email, new.id::text || '@local.invalid')),
    coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(coalesce(new.email, 'Usuario'), '@', 1)),
    case when make_master then 'admin' else 'cliente' end,
    make_master,
    coalesce(new.created_at, now())
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists gf_auth_user_profile on auth.users;
create trigger gf_auth_user_profile
after insert on auth.users
for each row execute function public.gf_create_profile_for_new_user();

create or replace function public.gf_touch_profile_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gf_profiles_updated_at on public.gf_profiles;
create trigger gf_profiles_updated_at
before update on public.gf_profiles
for each row execute function public.gf_touch_profile_updated_at();

create or replace function public.gf_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.gf_profiles where user_id = auth.uid() limit 1;
$$;

alter table public.gf_profiles enable row level security;
revoke all on table public.gf_profiles from anon;
revoke insert, update, delete on table public.gf_profiles from authenticated;
grant select on table public.gf_profiles to authenticated;
revoke all on function public.gf_current_role() from public;
grant execute on function public.gf_current_role() to authenticated;

drop policy if exists "Perfil propio o gestión de usuarios" on public.gf_profiles;
create policy "Perfil propio o gestión de usuarios"
on public.gf_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.gf_current_role() in ('admin','coadmin')
);

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

  select * into target
  from public.gf_profiles
  where lower(email) = lower(trim(target_email));

  if target.user_id is null then
    raise exception 'No existe una cuenta registrada con ese email.';
  end if;

  if target.is_master then
    raise exception 'El Admin master no puede ser eliminado, degradado ni modificado por roles.';
  end if;

  if actor.role = 'coadmin' and target.role = 'admin' then
    raise exception 'Un coadmin no puede modificar al Admin master.';
  end if;

  update public.gf_profiles
  set role = new_role
  where user_id = target.user_id
  returning * into updated;

  return updated;
end;
$$;

revoke all on function public.gf_set_user_role(text, text) from public;
grant execute on function public.gf_set_user_role(text, text) to authenticated;

-- Estado único y compartido del gimnasio.
create table if not exists public.gf_gym_state (
  id text primary key default 'main' check (id = 'main'),
  data jsonb not null default '{}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Conserva los datos V10 del master cuando existen.
do $$
declare
  master_id uuid;
  previous_data jsonb;
begin
  select user_id into master_id from public.gf_profiles where is_master = true limit 1;
  if to_regclass('public.gf_user_state') is not null and master_id is not null then
    execute 'select data from public.gf_user_state where user_id = $1' into previous_data using master_id;
  end if;

  insert into public.gf_gym_state (id, data)
  values ('main', coalesce(previous_data, '{}'::jsonb))
  on conflict (id) do nothing;
end;
$$;

alter table public.gf_gym_state enable row level security;
revoke all on table public.gf_gym_state from anon;
revoke all on table public.gf_gym_state from authenticated;

-- Lectura filtrada por rol. Profe nunca recibe caja ni cierres financieros.
create or replace function public.gf_get_gym_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_data jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then
    raise exception 'Tu rol no tiene acceso al panel operativo.';
  end if;

  select data into v_data from public.gf_gym_state where id = 'main';
  v_data := coalesce(v_data, '{}'::jsonb);

  if v_role = 'profe' then
    v_data := jsonb_set(v_data, '{transactions}', '[]'::jsonb, true);
    v_data := jsonb_set(v_data, '{closures}', '[]'::jsonb, true);
    v_data := jsonb_set(v_data, '{notificationPreferences}', '{}'::jsonb, true);
    v_data := jsonb_set(
      v_data,
      '{people}',
      coalesce((select jsonb_agg(item - 'price') from jsonb_array_elements(coalesce(v_data->'people','[]'::jsonb)) item), '[]'::jsonb),
      true
    );
    v_data := jsonb_set(
      v_data,
      '{notificationLog}',
      coalesce((
        select jsonb_agg(item)
        from jsonb_array_elements(coalesce(v_data->'notificationLog','[]'::jsonb)) item
        where coalesce(item->>'type','') not in ('income','expense','withdrawal')
      ), '[]'::jsonb),
      true
    );
  end if;

  return v_data;
end;
$$;

revoke all on function public.gf_get_gym_state() from public;
grant execute on function public.gf_get_gym_state() to authenticated;

-- Aplica operaciones en forma serializada. Evita reemplazar el estado cloud con una copia vieja.
-- Además implementa las restricciones de rol en el servidor.
create or replace function public.gf_apply_operations(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_data jsonb;
  v_op jsonb;
  v_action text;
  v_collection text;
  v_record_id text;
  v_items jsonb;
  v_filtered jsonb;
  v_value jsonb;
  v_key text;
  v_unset text;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then
    raise exception 'Tu rol no puede modificar la operación del gimnasio.';
  end if;

  if jsonb_typeof(coalesce(p_operations, '[]'::jsonb)) <> 'array' then
    raise exception 'Formato de operaciones inválido.';
  end if;

  select data into v_data from public.gf_gym_state where id = 'main' for update;
  if v_data is null then v_data := '{}'::jsonb; end if;

  for v_op in select value from jsonb_array_elements(coalesce(p_operations, '[]'::jsonb)) loop
    v_action := v_op->>'action';
    v_collection := v_op->>'collection';

    -- Coadmin: mismas operaciones normales que admin, pero sin borrados destructivos.
    if v_role = 'coadmin' and v_action = 'delete' then
      raise exception 'El coadmin no puede eliminar registros.';
    end if;

    -- Profe: lectura general + control de accesos. No puede tocar caja, clientes ni configuración.
    if v_role = 'profe' then
      if v_action = 'set' and v_op->>'key' = 'activeBranch' then
        null;
      elsif v_action in ('upsert','patch') and v_collection in ('accesses','notificationLog') then
        null;
      else
        raise exception 'El rol profe no tiene permiso para esta operación.';
      end if;
    end if;

    if v_action in ('upsert','patch','delete') then
      if v_collection not in ('people','transactions','accesses','closures','notificationLog') then
        raise exception 'Colección no autorizada.';
      end if;
      v_record_id := v_op->>'recordId';
      if coalesce(v_record_id, '') = '' then raise exception 'recordId requerido.'; end if;
      v_items := coalesce(v_data->v_collection, '[]'::jsonb);

      select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
      into v_filtered
      from jsonb_array_elements(v_items) with ordinality as e(item, ord)
      where item->>'id' is distinct from v_record_id;

      if v_action = 'delete' then
        v_items := v_filtered;
      elsif v_action = 'upsert' then
        v_value := coalesce(v_op->'payload', '{}'::jsonb);
        v_items := jsonb_build_array(v_value) || v_filtered;
      else
        select item into v_value
        from jsonb_array_elements(v_items) item
        where item->>'id' = v_record_id
        limit 1;
        v_value := coalesce(v_value, v_op->'fallback', '{}'::jsonb) || coalesce(v_op->'payload', '{}'::jsonb);
        for v_unset in select value from jsonb_array_elements_text(coalesce(v_op->'unset', '[]'::jsonb)) loop
          v_value := v_value - v_unset;
        end loop;
        if not (v_value ? 'id') then v_value := v_value || jsonb_build_object('id', v_record_id); end if;
        v_items := jsonb_build_array(v_value) || v_filtered;
      end if;

      v_data := jsonb_set(v_data, array[v_collection], v_items, true);

    elsif v_action = 'set' then
      v_key := v_op->>'key';
      if v_key <> 'activeBranch' then raise exception 'Clave no autorizada.'; end if;
      v_data := jsonb_set(v_data, array[v_key], coalesce(v_op->'value', 'null'::jsonb), true);

    elsif v_action = 'merge' then
      v_key := v_op->>'key';
      if v_key <> 'notificationPreferences' then raise exception 'Clave no autorizada.'; end if;
      if v_role = 'profe' then raise exception 'El rol profe no puede modificar notificaciones.'; end if;
      v_value := coalesce(v_data->v_key, '{}'::jsonb) || coalesce(v_op->'payload', '{}'::jsonb);
      for v_unset in select value from jsonb_array_elements_text(coalesce(v_op->'unset', '[]'::jsonb)) loop
        v_value := v_value - v_unset;
      end loop;
      v_data := jsonb_set(v_data, array[v_key], v_value, true);
    else
      raise exception 'Operación no autorizada.';
    end if;
  end loop;

  update public.gf_gym_state
  set data = v_data,
      revision = revision + 1,
      updated_at = now()
  where id = 'main';

  return v_data;
end;
$$;

revoke all on function public.gf_apply_operations(jsonb) from public;
grant execute on function public.gf_apply_operations(jsonb) to authenticated;

-- La tabla V10 se conserva como respaldo; ya no se usa para la operación diaria.
