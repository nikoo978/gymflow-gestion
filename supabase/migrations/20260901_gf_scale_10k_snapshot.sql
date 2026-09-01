-- GymFlow V1.05 · 10k bounded operational snapshot
-- Apply only after the frontend understands _weekAccessDates/_lastPaymentDate and
-- historical reports use gf_get_report_snapshot().

create index if not exists gf_accesses_week_usage_idx
  on private.gf_accesses (event_date, person_id)
  where allowed = true and manual = false and person_id is not null;
create index if not exists gf_transactions_membership_person_date_idx
  on private.gf_transactions (person_id, event_date desc)
  where person_id is not null and type = 'income' and category = 'Membresía';

create or replace function private.gf_mirror_payload(p_collection text, p_record_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  if p_collection = 'people' then select payload into v_payload from private.gf_people where id=p_record_id;
  elsif p_collection = 'transactions' then select payload into v_payload from private.gf_transactions where id=p_record_id;
  elsif p_collection = 'accesses' then select payload into v_payload from private.gf_accesses where id=p_record_id;
  elsif p_collection = 'closures' then select payload into v_payload from private.gf_closures where id=p_record_id;
  elsif p_collection = 'notificationLog' then select payload into v_payload from private.gf_notification_log where id=p_record_id;
  end if;
  return v_payload;
end;
$$;
revoke all on function private.gf_mirror_payload(text,text) from public, anon, authenticated;

-- The legacy row becomes config-only. All growing collections are reconstructed from
-- normalized tables, so years of activity never inflate a single JSON document again.
create or replace function private.gf_bound_legacy_state(p_data jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(coalesce(p_data,'{}'::jsonb), '{people}', '[]'::jsonb, true),
          '{transactions}', '[]'::jsonb, true
        ),
        '{accesses}', '[]'::jsonb, true
      ),
      '{closures}', '[]'::jsonb, true
    ),
    '{notificationLog}', '[]'::jsonb, true
  );
$$;
revoke all on function private.gf_bound_legacy_state(jsonb) from public, anon, authenticated;

create or replace function public.gf_get_gym_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_config jsonb;
  v_people jsonb := '[]'::jsonb;
  v_transactions jsonb := '[]'::jsonb;
  v_accesses jsonb := '[]'::jsonb;
  v_closures jsonb := '[]'::jsonb;
  v_notifications jsonb := '[]'::jsonb;
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_week_start date := date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then
    raise exception 'Tu rol no tiene acceso al panel operativo.';
  end if;

  select private.gf_bound_legacy_state(data) into v_config
  from public.gf_gym_state where id='main';
  v_config := coalesce(v_config, '{}'::jsonb);

  with week_usage as (
    select a.person_id,
           jsonb_agg(distinct a.event_date order by a.event_date) as days
    from private.gf_accesses a
    where a.person_id is not null
      and a.allowed = true
      and a.manual = false
      and a.event_date >= v_week_start
      and a.event_date < v_week_start + 7
    group by a.person_id
  ), last_payment as (
    select distinct on (t.person_id) t.person_id, t.event_date
    from private.gf_transactions t
    where t.person_id is not null
      and t.type='income'
      and t.category='Membresía'
    order by t.person_id, t.event_date desc nulls last, t.id desc
  )
  select coalesce(jsonb_agg(
    (case when v_role='profe' then p.payload - 'price' else p.payload end)
      || jsonb_build_object(
        '_weekAccessDates', coalesce(w.days, '[]'::jsonb),
        '_lastPaymentDate', lp.event_date
      )
    order by p.name, p.id
  ), '[]'::jsonb)
  into v_people
  from private.gf_people p
  left join week_usage w on w.person_id=p.id
  left join last_payment lp on lp.person_id=p.id;

  if v_role <> 'profe' then
    select coalesce(jsonb_agg(t.payload order by t.updated_at desc, t.id desc), '[]'::jsonb)
    into v_transactions
    from private.gf_transactions t
    where t.event_date = v_today;

    select coalesce(jsonb_agg(payload order by occurred_at desc nulls last, id desc), '[]'::jsonb)
    into v_closures
    from (
      select c.payload, c.occurred_at, c.id,
             row_number() over(partition by c.branch order by c.occurred_at desc nulls last, c.id desc) rn
      from private.gf_closures c
    ) q
    where rn <= 14;
  end if;

  select coalesce(jsonb_agg(a.payload order by a.occurred_at desc nulls last, a.id desc), '[]'::jsonb)
  into v_accesses
  from private.gf_accesses a
  where a.event_date = v_today;

  select coalesce(jsonb_agg(n.payload order by n.occurred_at desc nulls last, n.id desc), '[]'::jsonb)
  into v_notifications
  from (
    select *
    from private.gf_notification_log n
    where v_role <> 'profe' or coalesce(n.type,'') not in ('income','expense','withdrawal')
    order by n.occurred_at desc nulls last, n.id desc
    limit 100
  ) n;

  v_config := jsonb_set(v_config, '{people}', v_people, true);
  v_config := jsonb_set(v_config, '{transactions}', v_transactions, true);
  v_config := jsonb_set(v_config, '{accesses}', v_accesses, true);
  v_config := jsonb_set(v_config, '{closures}', v_closures, true);
  v_config := jsonb_set(v_config, '{notificationLog}', v_notifications, true);
  if v_role='profe' then
    v_config := jsonb_set(v_config, '{notificationPreferences}', '{}'::jsonb, true);
  end if;
  return v_config;
end;
$$;
revoke all on function public.gf_get_gym_state() from public, anon;
grant execute on function public.gf_get_gym_state() to authenticated;

-- Operations now write directly to normalized tables. gf_gym_state is only locked/updated
-- for small configuration keys and revision metadata; record mutations no longer scan a
-- 10,000-person JSON array.
create or replace function public.gf_apply_operations(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_config jsonb;
  v_op jsonb;
  v_action text;
  v_collection text;
  v_record_id text;
  v_value jsonb;
  v_key text;
  v_unset text;
  v_branch text;
begin
  select role into v_role from public.gf_profiles where user_id=auth.uid();
  if v_role is null or v_role not in ('admin','coadmin','profe') then
    raise exception 'Tu rol no puede modificar la operación del gimnasio.';
  end if;
  if jsonb_typeof(coalesce(p_operations,'[]'::jsonb)) <> 'array' then
    raise exception 'Formato de operaciones inválido.';
  end if;

  select private.gf_bound_legacy_state(data) into v_config
  from public.gf_gym_state where id='main' for update;
  v_config := coalesce(v_config,'{}'::jsonb);

  for v_op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
    v_action := v_op->>'action';
    v_collection := v_op->>'collection';

    if v_role='coadmin' and v_action in ('delete','clear') then
      raise exception 'El coadmin no puede eliminar registros.';
    end if;
    if v_role='profe' then
      if v_action='set' and v_op->>'key'='activeBranch' then null;
      elsif v_action in ('upsert','patch') and v_collection in ('accesses','notificationLog') then null;
      else raise exception 'El rol profe no tiene permiso para esta operación.';
      end if;
    end if;

    if v_action in ('upsert','patch','delete') then
      if v_collection not in ('people','transactions','accesses','closures','notificationLog') then raise exception 'Colección no autorizada.'; end if;
      v_record_id := v_op->>'recordId';
      if coalesce(v_record_id,'')='' then raise exception 'recordId requerido.'; end if;
      if v_action='delete' then
        perform private.gf_mirror_delete(v_collection,v_record_id);
      elsif v_action='upsert' then
        v_value := coalesce(v_op->'payload','{}'::jsonb);
        if not(v_value?'id') then v_value:=v_value||jsonb_build_object('id',v_record_id); end if;
        perform private.gf_mirror_upsert(v_collection,v_value);
      else
        v_value := coalesce(private.gf_mirror_payload(v_collection,v_record_id), v_op->'fallback', '{}'::jsonb)
          || coalesce(v_op->'payload','{}'::jsonb);
        for v_unset in select value from jsonb_array_elements_text(coalesce(v_op->'unset','[]'::jsonb)) loop
          v_value := v_value - v_unset;
        end loop;
        if not(v_value?'id') then v_value:=v_value||jsonb_build_object('id',v_record_id); end if;
        perform private.gf_mirror_upsert(v_collection,v_value);
      end if;
    elsif v_action='clear' then
      if v_role<>'admin' then raise exception 'Sólo el Admin master puede limpiar historiales.'; end if;
      if v_collection not in ('accesses','notificationLog') then raise exception 'Colección no autorizada para limpieza.'; end if;
      v_branch := nullif(v_op->>'branch','');
      perform private.gf_mirror_clear(v_collection,v_branch);
    elsif v_action='set' then
      v_key:=v_op->>'key';
      if v_key<>'activeBranch' then raise exception 'Clave no autorizada.'; end if;
      v_config:=jsonb_set(v_config,array[v_key],coalesce(v_op->'value','null'::jsonb),true);
    elsif v_action='merge' then
      v_key:=v_op->>'key';
      if v_key<>'notificationPreferences' then raise exception 'Clave no autorizada.'; end if;
      if v_role='profe' then raise exception 'El rol profe no puede modificar notificaciones.'; end if;
      v_value:=coalesce(v_config->v_key,'{}'::jsonb)||coalesce(v_op->'payload','{}'::jsonb);
      for v_unset in select value from jsonb_array_elements_text(coalesce(v_op->'unset','[]'::jsonb)) loop v_value:=v_value-v_unset; end loop;
      v_config:=jsonb_set(v_config,array[v_key],v_value,true);
    else
      raise exception 'Operación no autorizada.';
    end if;
  end loop;

  update public.gf_gym_state set data=private.gf_bound_legacy_state(v_config), revision=revision+1, updated_at=now() where id='main';
  return public.gf_get_gym_state();
end;
$$;
revoke all on function public.gf_apply_operations(jsonb) from public, anon;
grant execute on function public.gf_apply_operations(jsonb) to authenticated;

create or replace function public.gf_scaling_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_role text; v_legacy jsonb;
begin
  select role into v_role from public.gf_profiles where user_id=auth.uid();
  if v_role not in ('admin','coadmin') then raise exception 'Sin permisos para consultar capacidad.'; end if;
  select data into v_legacy from public.gf_gym_state where id='main';
  return jsonb_build_object(
    'targetUsers',10000,
    'architecture','relational-bounded-snapshot-v2',
    'databaseBytes',pg_database_size(current_database()),
    'legacyStateBytes',pg_column_size(coalesce(v_legacy,'{}'::jsonb)),
    'registeredAccounts',(select count(*) from public.gf_profiles),
    'people',(select count(*) from private.gf_people),
    'transactions',(select count(*) from private.gf_transactions),
    'accesses',(select count(*) from private.gf_accesses),
    'closures',(select count(*) from private.gf_closures),
    'notifications',(select count(*) from private.gf_notification_log),
    'routines',(select count(*) from private.gf_routines),
    'exercises',(select count(*) from public.gf_exercises),
    'snapshotPeople',(select count(*) from private.gf_people),
    'snapshotTransactions',(select count(*) from private.gf_transactions where event_date=(now() at time zone 'America/Argentina/Buenos_Aires')::date),
    'snapshotAccesses',(select count(*) from private.gf_accesses where event_date=(now() at time zone 'America/Argentina/Buenos_Aires')::date)
  );
end;
$$;
revoke all on function public.gf_scaling_status() from public, anon;
grant execute on function public.gf_scaling_status() to authenticated;

-- Drop the redundant growing arrays immediately; normalized tables are now authoritative.
update public.gf_gym_state
set data=private.gf_bound_legacy_state(data), revision=revision+1, updated_at=now()
where id='main';

analyze private.gf_people;
analyze private.gf_transactions;
analyze private.gf_accesses;
analyze private.gf_closures;
analyze private.gf_notification_log;
