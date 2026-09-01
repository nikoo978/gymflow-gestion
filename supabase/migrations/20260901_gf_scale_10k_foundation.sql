-- GymFlow V1.05 · Foundation for 10,000 registered users
-- Additive/backward-compatible phase: normalized mirrors + indexed client/report RPCs.
-- The legacy gf_gym_state snapshot remains authoritative for the current UI/offline flow
-- until the bounded-snapshot migration is deployed after the frontend is ready.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Safe parsers for legacy JSON fields. Invalid historical values become NULL instead of
-- aborting the backfill/mirror write.
create or replace function private.gf_safe_date(p_value text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if nullif(trim(coalesce(p_value, '')), '') is null then return null; end if;
  return p_value::date;
exception when others then
  return null;
end;
$$;

create or replace function private.gf_safe_timestamptz(p_value text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  if nullif(trim(coalesce(p_value, '')), '') is null then return null; end if;
  return p_value::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function private.gf_safe_numeric(p_value text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if nullif(trim(coalesce(p_value, '')), '') is null then return null; end if;
  return p_value::numeric;
exception when others then
  return null;
end;
$$;

create or replace function private.gf_safe_boolean(p_value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if nullif(trim(coalesce(p_value, '')), '') is null then return null; end if;
  return p_value::boolean;
exception when others then
  return null;
end;
$$;

revoke all on function private.gf_safe_date(text) from public, anon, authenticated;
revoke all on function private.gf_safe_timestamptz(text) from public, anon, authenticated;
revoke all on function private.gf_safe_numeric(text) from public, anon, authenticated;
revoke all on function private.gf_safe_boolean(text) from public, anon, authenticated;

-- Structured operational mirrors. payload keeps the full legacy object losslessly while
-- typed columns make the hot queries indexable.
create table if not exists private.gf_people (
  id text primary key,
  branch text,
  role text,
  name text not null default '',
  dni text,
  email text,
  phone text,
  plan text,
  start_date date,
  expiry_date date,
  price numeric,
  biometric_method text,
  biometric_status text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists private.gf_transactions (
  id text primary key,
  person_id text,
  branch text,
  type text,
  category text,
  detail text,
  amount numeric not null default 0,
  method text,
  event_date date,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists private.gf_accesses (
  id text primary key,
  person_id text,
  branch text,
  allowed boolean not null default false,
  manual boolean not null default false,
  occurred_at timestamptz,
  event_date date,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists private.gf_closures (
  id text primary key,
  branch text,
  occurred_at timestamptz,
  event_date date,
  expected numeric not null default 0,
  actual numeric not null default 0,
  difference numeric not null default 0,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists private.gf_notification_log (
  id text primary key,
  branch text,
  type text,
  title text,
  body text,
  occurred_at timestamptz,
  event_date date,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table private.gf_people enable row level security;
alter table private.gf_transactions enable row level security;
alter table private.gf_accesses enable row level security;
alter table private.gf_closures enable row level security;
alter table private.gf_notification_log enable row level security;

revoke all on all tables in schema private from public, anon, authenticated;

-- 10k-oriented indexes. No partitioning yet: Supabase recommends adding that complexity
-- only after real degradation appears on large tables.
create unique index if not exists gf_people_dni_unique_idx
  on private.gf_people (dni)
  where dni is not null and trim(dni) <> '';
create unique index if not exists gf_people_email_unique_idx
  on private.gf_people (lower(email))
  where email is not null and trim(email) <> '';
create index if not exists gf_people_branch_role_idx
  on private.gf_people (branch, role, name);
create index if not exists gf_people_branch_expiry_idx
  on private.gf_people (branch, role, expiry_date)
  where role = 'Cliente';
create index if not exists gf_people_branch_start_idx
  on private.gf_people (branch, start_date)
  where role = 'Cliente';
create index if not exists gf_people_name_lower_idx
  on private.gf_people (lower(name));

create index if not exists gf_transactions_branch_date_idx
  on private.gf_transactions (branch, event_date desc, id);
create index if not exists gf_transactions_person_date_idx
  on private.gf_transactions (person_id, event_date desc)
  where person_id is not null;
create index if not exists gf_transactions_branch_type_date_idx
  on private.gf_transactions (branch, type, event_date desc);
create index if not exists gf_transactions_event_date_brin_idx
  on private.gf_transactions using brin (event_date);

create index if not exists gf_accesses_branch_time_idx
  on private.gf_accesses (branch, occurred_at desc, id);
create index if not exists gf_accesses_person_time_idx
  on private.gf_accesses (person_id, occurred_at desc)
  where person_id is not null;
create index if not exists gf_accesses_person_day_allowed_idx
  on private.gf_accesses (person_id, event_date, allowed)
  where person_id is not null;
create index if not exists gf_accesses_event_date_brin_idx
  on private.gf_accesses using brin (event_date);

create index if not exists gf_closures_branch_time_idx
  on private.gf_closures (branch, occurred_at desc, id);
create index if not exists gf_notification_branch_time_idx
  on private.gf_notification_log (branch, occurred_at desc, id);
create index if not exists gf_notification_type_time_idx
  on private.gf_notification_log (type, occurred_at desc);

-- Existing public tables: indexes useful at 10k accounts.
create index if not exists gf_profiles_role_created_idx
  on public.gf_profiles (role, created_at desc);
create index if not exists gf_account_events_user_idx
  on public.gf_account_events (user_id);
create index if not exists gf_account_links_linked_by_idx
  on public.gf_account_links (linked_by)
  where linked_by is not null;
create index if not exists gf_exercises_created_by_idx
  on public.gf_exercises (created_by)
  where created_by is not null;

-- Keep a single mapping point between the legacy operation format and normalized tables.
create or replace function private.gf_mirror_upsert(p_collection text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := nullif(p_value->>'id', '');
  v_ts timestamptz;
  v_date date;
begin
  if v_id is null then return; end if;

  if p_collection = 'people' then
    insert into private.gf_people (
      id, branch, role, name, dni, email, phone, plan, start_date, expiry_date,
      price, biometric_method, biometric_status, payload, updated_at
    ) values (
      v_id,
      nullif(p_value->>'branch', ''),
      nullif(p_value->>'role', ''),
      coalesce(p_value->>'name', ''),
      nullif(trim(coalesce(p_value->>'dni', '')), ''),
      nullif(lower(trim(coalesce(p_value->>'email', ''))), ''),
      nullif(p_value->>'phone', ''),
      nullif(p_value->>'plan', ''),
      private.gf_safe_date(p_value->>'start'),
      private.gf_safe_date(p_value->>'expiry'),
      private.gf_safe_numeric(p_value->>'price'),
      nullif(p_value->>'biometricMethod', ''),
      nullif(p_value->>'biometricStatus', ''),
      p_value,
      now()
    )
    on conflict (id) do update set
      branch = excluded.branch,
      role = excluded.role,
      name = excluded.name,
      dni = excluded.dni,
      email = excluded.email,
      phone = excluded.phone,
      plan = excluded.plan,
      start_date = excluded.start_date,
      expiry_date = excluded.expiry_date,
      price = excluded.price,
      biometric_method = excluded.biometric_method,
      biometric_status = excluded.biometric_status,
      payload = excluded.payload,
      updated_at = now();
    return;
  end if;

  if p_collection = 'transactions' then
    v_date := private.gf_safe_date(p_value->>'date');
    insert into private.gf_transactions (
      id, person_id, branch, type, category, detail, amount, method, event_date, payload, updated_at
    ) values (
      v_id,
      nullif(p_value->>'personId', ''),
      nullif(p_value->>'branch', ''),
      nullif(p_value->>'type', ''),
      nullif(p_value->>'category', ''),
      nullif(p_value->>'detail', ''),
      coalesce(private.gf_safe_numeric(p_value->>'amount'), 0),
      nullif(p_value->>'method', ''),
      v_date,
      p_value,
      now()
    )
    on conflict (id) do update set
      person_id = excluded.person_id,
      branch = excluded.branch,
      type = excluded.type,
      category = excluded.category,
      detail = excluded.detail,
      amount = excluded.amount,
      method = excluded.method,
      event_date = excluded.event_date,
      payload = excluded.payload,
      updated_at = now();
    return;
  end if;

  if p_collection = 'accesses' then
    v_ts := private.gf_safe_timestamptz(p_value->>'date');
    v_date := coalesce(v_ts::date, private.gf_safe_date(p_value->>'date'));
    insert into private.gf_accesses (
      id, person_id, branch, allowed, manual, occurred_at, event_date, payload, updated_at
    ) values (
      v_id,
      nullif(p_value->>'personId', ''),
      nullif(p_value->>'branch', ''),
      coalesce(private.gf_safe_boolean(p_value->>'allowed'), false),
      coalesce(private.gf_safe_boolean(p_value->>'manual'), false),
      v_ts,
      v_date,
      p_value,
      now()
    )
    on conflict (id) do update set
      person_id = excluded.person_id,
      branch = excluded.branch,
      allowed = excluded.allowed,
      manual = excluded.manual,
      occurred_at = excluded.occurred_at,
      event_date = excluded.event_date,
      payload = excluded.payload,
      updated_at = now();
    return;
  end if;

  if p_collection = 'closures' then
    v_ts := private.gf_safe_timestamptz(p_value->>'date');
    v_date := coalesce(v_ts::date, private.gf_safe_date(p_value->>'date'));
    insert into private.gf_closures (
      id, branch, occurred_at, event_date, expected, actual, difference, payload, updated_at
    ) values (
      v_id,
      nullif(p_value->>'branch', ''),
      v_ts,
      v_date,
      coalesce(private.gf_safe_numeric(p_value->>'expected'), 0),
      coalesce(private.gf_safe_numeric(p_value->>'actual'), 0),
      coalesce(private.gf_safe_numeric(p_value->>'difference'), 0),
      p_value,
      now()
    )
    on conflict (id) do update set
      branch = excluded.branch,
      occurred_at = excluded.occurred_at,
      event_date = excluded.event_date,
      expected = excluded.expected,
      actual = excluded.actual,
      difference = excluded.difference,
      payload = excluded.payload,
      updated_at = now();
    return;
  end if;

  if p_collection = 'notificationLog' then
    v_ts := private.gf_safe_timestamptz(p_value->>'date');
    v_date := coalesce(v_ts::date, private.gf_safe_date(p_value->>'date'));
    insert into private.gf_notification_log (
      id, branch, type, title, body, occurred_at, event_date, payload, updated_at
    ) values (
      v_id,
      nullif(p_value->>'branch', ''),
      nullif(p_value->>'type', ''),
      nullif(p_value->>'title', ''),
      nullif(p_value->>'body', ''),
      v_ts,
      v_date,
      p_value,
      now()
    )
    on conflict (id) do update set
      branch = excluded.branch,
      type = excluded.type,
      title = excluded.title,
      body = excluded.body,
      occurred_at = excluded.occurred_at,
      event_date = excluded.event_date,
      payload = excluded.payload,
      updated_at = now();
  end if;
end;
$$;

create or replace function private.gf_mirror_delete(p_collection text, p_record_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_collection = 'people' then delete from private.gf_people where id = p_record_id;
  elsif p_collection = 'transactions' then delete from private.gf_transactions where id = p_record_id;
  elsif p_collection = 'accesses' then delete from private.gf_accesses where id = p_record_id;
  elsif p_collection = 'closures' then delete from private.gf_closures where id = p_record_id;
  elsif p_collection = 'notificationLog' then delete from private.gf_notification_log where id = p_record_id;
  end if;
end;
$$;

create or replace function private.gf_mirror_clear(p_collection text, p_branch text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_collection = 'accesses' then
    if p_branch is null then delete from private.gf_accesses;
    else delete from private.gf_accesses where branch = p_branch;
    end if;
  elsif p_collection = 'notificationLog' then
    if p_branch is null then delete from private.gf_notification_log;
    else delete from private.gf_notification_log where branch = p_branch;
    end if;
  else
    raise exception 'Colección no autorizada para limpieza masiva.';
  end if;
end;
$$;

-- Phase-B hook. It is intentionally identity in this foundation migration.
create or replace function private.gf_bound_legacy_state(p_data jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$ select coalesce(p_data, '{}'::jsonb); $$;

revoke all on function private.gf_mirror_upsert(text, jsonb) from public, anon, authenticated;
revoke all on function private.gf_mirror_delete(text, text) from public, anon, authenticated;
revoke all on function private.gf_mirror_clear(text, text) from public, anon, authenticated;
revoke all on function private.gf_bound_legacy_state(jsonb) from public, anon, authenticated;

-- Backfill from the current legacy state. Idempotent because mirror writes are UPSERTs.
do $$
declare
  v_data jsonb;
  v_item jsonb;
  v_collection text;
begin
  select data into v_data from public.gf_gym_state where id = 'main';
  v_data := coalesce(v_data, '{}'::jsonb);
  foreach v_collection in array array['people','transactions','accesses','closures','notificationLog'] loop
    for v_item in select value from jsonb_array_elements(coalesce(v_data->v_collection, '[]'::jsonb)) loop
      perform private.gf_mirror_upsert(v_collection, v_item);
    end loop;
  end loop;
end;
$$;

-- Existing offline operation RPC now dual-writes the normalized mirror in the SAME
-- transaction as the legacy state. Existing role restrictions are preserved.
create or replace function public.gf_apply_operations(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
  v_branch text;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then
    raise exception 'Tu rol no puede modificar la operación del gimnasio.';
  end if;

  if jsonb_typeof(coalesce(p_operations, '[]'::jsonb)) <> 'array' then
    raise exception 'Formato de operaciones inválido.';
  end if;

  select data into v_data from public.gf_gym_state where id = 'main' for update;
  v_data := coalesce(v_data, '{}'::jsonb);

  for v_op in select value from jsonb_array_elements(coalesce(p_operations, '[]'::jsonb)) loop
    v_action := v_op->>'action';
    v_collection := v_op->>'collection';

    if v_role = 'coadmin' and v_action in ('delete','clear') then
      raise exception 'El coadmin no puede eliminar registros.';
    end if;

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
        perform private.gf_mirror_delete(v_collection, v_record_id);
      elsif v_action = 'upsert' then
        v_value := coalesce(v_op->'payload', '{}'::jsonb);
        if not (v_value ? 'id') then v_value := v_value || jsonb_build_object('id', v_record_id); end if;
        v_items := jsonb_build_array(v_value) || v_filtered;
        perform private.gf_mirror_upsert(v_collection, v_value);
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
        perform private.gf_mirror_upsert(v_collection, v_value);
      end if;

      v_data := jsonb_set(v_data, array[v_collection], v_items, true);

    elsif v_action = 'clear' then
      if v_role <> 'admin' then raise exception 'Sólo el Admin master puede limpiar historiales.'; end if;
      if v_collection not in ('accesses','notificationLog') then raise exception 'Colección no autorizada para limpieza.'; end if;
      v_branch := nullif(v_op->>'branch', '');
      v_items := coalesce(v_data->v_collection, '[]'::jsonb);
      if v_branch is null then
        v_items := '[]'::jsonb;
      else
        select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
        into v_items
        from jsonb_array_elements(v_items) with ordinality as e(item, ord)
        where item->>'branch' is distinct from v_branch;
      end if;
      v_data := jsonb_set(v_data, array[v_collection], v_items, true);
      perform private.gf_mirror_clear(v_collection, v_branch);

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

  v_data := private.gf_bound_legacy_state(v_data);
  update public.gf_gym_state
  set data = v_data,
      revision = revision + 1,
      updated_at = now()
  where id = 'main';

  return public.gf_get_gym_state();
end;
$$;
revoke all on function public.gf_apply_operations(jsonb) from public, anon;
grant execute on function public.gf_apply_operations(jsonb) to authenticated;

-- Client portal: direct indexed lookup instead of scanning the whole global JSON.
create or replace function public.gf_get_my_client_portal()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.gf_profiles;
  v_link public.gf_account_links;
  v_member private.gf_people;
  v_accesses jsonb := '[]'::jsonb;
  v_branch_name text;
  v_config jsonb;
begin
  select * into v_profile from public.gf_profiles where user_id = auth.uid() limit 1;
  if v_profile.user_id is null then raise exception 'La cuenta no tiene un perfil GymFlow.'; end if;
  if v_profile.role <> 'cliente' then raise exception 'Este portal está disponible exclusivamente para cuentas Cliente.'; end if;

  select * into v_link
  from public.gf_account_links
  where user_id = auth.uid() and link_kind = 'cliente'
  limit 1;

  if v_link.user_id is null then
    return jsonb_build_object(
      'linked', false,
      'account', jsonb_build_object('email', v_profile.email, 'displayName', v_profile.display_name, 'role', v_profile.role),
      'member', null,
      'branchName', null,
      'accesses', '[]'::jsonb
    );
  end if;

  select * into v_member
  from private.gf_people
  where id = v_link.person_id and role = 'Cliente'
  limit 1;

  if v_member.id is null then
    return jsonb_build_object(
      'linked', false,
      'account', jsonb_build_object('email', v_profile.email, 'displayName', v_profile.display_name, 'role', v_profile.role),
      'member', null,
      'branchName', null,
      'accesses', '[]'::jsonb
    );
  end if;

  select data into v_config from public.gf_gym_state where id = 'main';
  select item->>'name' into v_branch_name
  from jsonb_array_elements(coalesce(v_config->'branches', '[]'::jsonb)) item
  where item->>'id' = v_member.branch
  limit 1;

  select coalesce(jsonb_agg(row_data order by occurred_at desc nulls last), '[]'::jsonb)
  into v_accesses
  from (
    select
      jsonb_build_object(
        'id', a.id,
        'allowed', a.allowed,
        'manual', a.manual,
        'date', coalesce(a.occurred_at::text, a.payload->>'date'),
        'branch', a.branch
      ) as row_data,
      a.occurred_at
    from private.gf_accesses a
    where a.person_id = v_member.id
    order by a.occurred_at desc nulls last
    limit 30
  ) q;

  return jsonb_build_object(
    'linked', true,
    'account', jsonb_build_object('email', v_profile.email, 'displayName', v_profile.display_name, 'role', v_profile.role),
    'member', jsonb_build_object(
      'id', v_member.id,
      'name', v_member.name,
      'dni', v_member.dni,
      'phone', v_member.phone,
      'plan', v_member.plan,
      'start', v_member.start_date,
      'expiry', v_member.expiry_date,
      'branch', v_member.branch,
      'biometricMethod', v_member.biometric_method,
      'biometricStatus', v_member.biometric_status
    ),
    'branchName', v_branch_name,
    'accesses', v_accesses
  );
end;
$$;
revoke all on function public.gf_get_my_client_portal() from public, anon;
grant execute on function public.gf_get_my_client_portal() to authenticated;

-- Indexed report snapshot. Historical analytics no longer need the browser to download
-- every transaction/client record. Dates are [start, end) and limited to 370 days.
create or replace function public.gf_get_report_snapshot(
  p_branch text,
  p_start date,
  p_end date,
  p_previous_start date,
  p_previous_end date,
  p_granularity text default 'day',
  p_limit integer default 500
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 1000));
  v_metrics jsonb;
  v_chart jsonb;
  v_sales jsonb;
  v_expenses jsonb;
  v_rows jsonb;
  v_count bigint;
  v_step interval;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role not in ('admin','coadmin') then raise exception 'Sin permisos para consultar reportes.'; end if;
  if p_branch is null or p_start is null or p_end is null or p_end <= p_start then raise exception 'Rango inválido.'; end if;
  if p_end - p_start > 370 then raise exception 'El rango máximo es de 370 días.'; end if;
  if p_granularity not in ('day','month') then raise exception 'Granularidad inválida.'; end if;

  select jsonb_build_object(
    'newClients', (select count(*) from private.gf_people p where p.role='Cliente' and p.branch=p_branch and p.start_date>=p_start and p.start_date<p_end),
    'previousNewClients', (select count(*) from private.gf_people p where p.role='Cliente' and p.branch=p_branch and p.start_date>=p_previous_start and p.start_date<p_previous_end),
    'membershipAmount', coalesce((select sum(t.amount) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='income' and t.category='Membresía'),0),
    'membershipCount', (select count(*) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='income' and t.category='Membresía'),
    'salesAmount', coalesce((select sum(t.amount) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='income' and coalesce(t.category,'')<>'Membresía'),0),
    'salesCount', (select count(*) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='income' and coalesce(t.category,'')<>'Membresía'),
    'expenseAmount', coalesce((select sum(t.amount) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='expense'),0),
    'expenseCount', (select count(*) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='expense'),
    'incomeAmount', coalesce((select sum(t.amount) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end and t.type='income'),0),
    'previousIncomeAmount', coalesce((select sum(t.amount) from private.gf_transactions t where t.branch=p_branch and t.event_date>=p_previous_start and t.event_date<p_previous_end and t.type='income'),0)
  ) into v_metrics;

  v_step := case when p_granularity='month' then interval '1 month' else interval '1 day' end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date', g.bucket::date,
    'membership', coalesce(x.membership,0),
    'sales', coalesce(x.sales,0),
    'expenses', coalesce(x.expenses,0),
    'clients', coalesce(c.clients,0)
  ) order by g.bucket), '[]'::jsonb)
  into v_chart
  from generate_series(
    case when p_granularity='month' then date_trunc('month', p_start::timestamp) else p_start::timestamp end,
    (p_end::timestamp - interval '1 day'),
    v_step
  ) as g(bucket)
  left join lateral (
    select
      sum(t.amount) filter (where t.type='income' and t.category='Membresía') as membership,
      sum(t.amount) filter (where t.type='income' and coalesce(t.category,'')<>'Membresía') as sales,
      sum(t.amount) filter (where t.type='expense') as expenses
    from private.gf_transactions t
    where t.branch=p_branch
      and t.event_date>=g.bucket::date
      and t.event_date<(g.bucket+v_step)::date
      and t.event_date>=p_start
      and t.event_date<p_end
  ) x on true
  left join lateral (
    select count(*) as clients
    from private.gf_people p
    where p.role='Cliente' and p.branch=p_branch
      and p.start_date>=g.bucket::date
      and p.start_date<(g.bucket+v_step)::date
      and p.start_date>=p_start and p.start_date<p_end
  ) c on true;

  select coalesce(jsonb_agg(jsonb_build_object('label', category, 'value', total) order by total desc), '[]'::jsonb)
  into v_sales
  from (
    select coalesce(category,'Sin categoría') category, sum(amount) total
    from private.gf_transactions
    where branch=p_branch and event_date>=p_start and event_date<p_end and type='income' and coalesce(category,'')<>'Membresía'
    group by coalesce(category,'Sin categoría')
  ) q;

  select coalesce(jsonb_agg(jsonb_build_object('label', category, 'value', total) order by total desc), '[]'::jsonb)
  into v_expenses
  from (
    select coalesce(category,'Sin categoría') category, sum(amount) total
    from private.gf_transactions
    where branch=p_branch and event_date>=p_start and event_date<p_end and type='expense'
    group by coalesce(category,'Sin categoría')
  ) q;

  select count(*) into v_count
  from private.gf_transactions
  where branch=p_branch and event_date>=p_start and event_date<p_end;

  select coalesce(jsonb_agg(payload order by event_date desc, id desc), '[]'::jsonb)
  into v_rows
  from (
    select t.payload, t.event_date, t.id
    from private.gf_transactions t
    where t.branch=p_branch and t.event_date>=p_start and t.event_date<p_end
    order by t.event_date desc, t.id desc
    limit v_limit
  ) q;

  return jsonb_build_object(
    'metrics', v_metrics,
    'chart', v_chart,
    'salesBreakdown', v_sales,
    'expenseBreakdown', v_expenses,
    'transactions', v_rows,
    'transactionCount', v_count,
    'transactionLimit', v_limit
  );
end;
$$;
revoke all on function public.gf_get_report_snapshot(text,date,date,date,date,text,integer) from public, anon;
grant execute on function public.gf_get_report_snapshot(text,date,date,date,date,text,integer) to authenticated;

-- Operational capacity/status endpoint for Admin/Coadmin.
create or replace function public.gf_scaling_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_legacy jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role not in ('admin','coadmin') then raise exception 'Sin permisos para consultar capacidad.'; end if;
  select data into v_legacy from public.gf_gym_state where id='main';
  return jsonb_build_object(
    'targetUsers', 10000,
    'architecture', 'relational-mirror-v1',
    'databaseBytes', pg_database_size(current_database()),
    'legacyStateBytes', pg_column_size(coalesce(v_legacy,'{}'::jsonb)),
    'registeredAccounts', (select count(*) from public.gf_profiles),
    'people', (select count(*) from private.gf_people),
    'transactions', (select count(*) from private.gf_transactions),
    'accesses', (select count(*) from private.gf_accesses),
    'closures', (select count(*) from private.gf_closures),
    'notifications', (select count(*) from private.gf_notification_log),
    'routines', (select count(*) from private.gf_routines),
    'exercises', (select count(*) from public.gf_exercises),
    'legacyPeople', jsonb_array_length(coalesce(v_legacy->'people','[]'::jsonb)),
    'legacyTransactions', jsonb_array_length(coalesce(v_legacy->'transactions','[]'::jsonb)),
    'legacyAccesses', jsonb_array_length(coalesce(v_legacy->'accesses','[]'::jsonb))
  );
end;
$$;
revoke all on function public.gf_scaling_status() from public, anon;
grant execute on function public.gf_scaling_status() to authenticated;

-- Current role is only meaningful with an authenticated session.
revoke execute on function public.gf_current_role() from public, anon;
grant execute on function public.gf_current_role() to authenticated;

analyze private.gf_people;
analyze private.gf_transactions;
analyze private.gf_accesses;
analyze private.gf_closures;
analyze private.gf_notification_log;
