-- GymFlow V1.06
-- Permiso individual de acceso para Profesor + seguimiento corporal privado e indexado.

alter table public.gf_profiles
  add column if not exists can_grant_access boolean not null default false;

update public.gf_profiles
set can_grant_access = false
where role <> 'profe' and can_grant_access;

create or replace function public.gf_profile_access_permission_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role <> 'profe' then
    new.can_grant_access := false;
  end if;
  return new;
end;
$$;

drop trigger if exists gf_profiles_access_permission_guard on public.gf_profiles;
create trigger gf_profiles_access_permission_guard
before insert or update of role, can_grant_access on public.gf_profiles
for each row execute function public.gf_profile_access_permission_guard();

create table if not exists private.gf_body_metrics (
  id uuid primary key default gen_random_uuid(),
  person_id text not null,
  recorded_by uuid null references public.gf_profiles(user_id) on delete set null,
  measured_at timestamptz not null default now(),
  weight_kg numeric(6,2) not null,
  height_cm numeric(6,2) not null,
  waist_cm numeric(6,2),
  neck_cm numeric(6,2),
  hip_cm numeric(6,2),
  sex text check (sex is null or sex in ('male','female')),
  bmi numeric(6,2),
  body_fat_pct numeric(6,2),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists gf_body_metrics_person_date_idx
  on private.gf_body_metrics(person_id, measured_at desc);
create index if not exists gf_body_metrics_recorded_by_idx
  on private.gf_body_metrics(recorded_by, measured_at desc);

alter table private.gf_body_metrics enable row level security;
revoke all on table private.gf_body_metrics from public, anon, authenticated;

create or replace function private.gf_metric_person(p_person_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select item
  from public.gf_gym_state s,
       lateral jsonb_array_elements(coalesce(s.data->'people','[]'::jsonb)) item
  where s.id = 'main' and item->>'id' = p_person_id
  limit 1;
$$;

revoke all on function private.gf_metric_person(text) from public, anon, authenticated;

create or replace function private.gf_calculate_metric(
  p_weight_kg numeric,
  p_height_cm numeric,
  p_waist_cm numeric,
  p_neck_cm numeric,
  p_hip_cm numeric,
  p_sex text
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_bmi numeric;
  v_fat numeric;
  v_den numeric;
begin
  if p_weight_kg < 20 or p_weight_kg > 400 then raise exception 'Peso fuera de rango.'; end if;
  if p_height_cm < 100 or p_height_cm > 250 then raise exception 'Altura fuera de rango.'; end if;
  if p_waist_cm is not null and (p_waist_cm < 30 or p_waist_cm > 250) then raise exception 'Cintura fuera de rango.'; end if;
  if p_neck_cm is not null and (p_neck_cm < 20 or p_neck_cm > 100) then raise exception 'Cuello fuera de rango.'; end if;
  if p_hip_cm is not null and (p_hip_cm < 40 or p_hip_cm > 250) then raise exception 'Cadera fuera de rango.'; end if;
  if p_sex is not null and p_sex not in ('male','female') then raise exception 'Sexo inválido para el cálculo.'; end if;

  v_bmi := round((p_weight_kg / power(p_height_cm / 100.0, 2))::numeric, 2);

  if p_sex = 'male' and p_waist_cm is not null and p_neck_cm is not null and p_waist_cm > p_neck_cm then
    v_den := 1.0324 - 0.19077 * log(10, p_waist_cm - p_neck_cm) + 0.15456 * log(10, p_height_cm);
    if v_den > 0 then v_fat := round((495 / v_den - 450)::numeric, 2); end if;
  elsif p_sex = 'female' and p_waist_cm is not null and p_neck_cm is not null and p_hip_cm is not null and (p_waist_cm + p_hip_cm) > p_neck_cm then
    v_den := 1.29579 - 0.35004 * log(10, p_waist_cm + p_hip_cm - p_neck_cm) + 0.22100 * log(10, p_height_cm);
    if v_den > 0 then v_fat := round((495 / v_den - 450)::numeric, 2); end if;
  end if;

  if v_fat is not null and (v_fat < 1 or v_fat > 75) then v_fat := null; end if;
  return jsonb_build_object('bmi', v_bmi, 'bodyFatPct', v_fat);
end;
$$;

revoke all on function private.gf_calculate_metric(numeric,numeric,numeric,numeric,numeric,text) from public, anon, authenticated;

create or replace function private.gf_metrics_json(p_person_id text, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'personId', m.person_id,
    'recordedBy', m.recorded_by,
    'measuredAt', m.measured_at,
    'weightKg', m.weight_kg,
    'heightCm', m.height_cm,
    'waistCm', m.waist_cm,
    'neckCm', m.neck_cm,
    'hipCm', m.hip_cm,
    'sex', m.sex,
    'bmi', m.bmi,
    'bodyFatPct', m.body_fat_pct,
    'notes', m.notes
  ) order by m.measured_at desc), '[]'::jsonb)
  from (
    select * from private.gf_body_metrics
    where person_id = p_person_id
    order by measured_at desc
    limit greatest(1, least(coalesce(p_limit, 30), 100))
  ) m;
$$;

revoke all on function private.gf_metrics_json(text,integer) from public, anon, authenticated;

create or replace function private.gf_insert_metric(
  p_person_id text,
  p_weight_kg numeric,
  p_height_cm numeric,
  p_waist_cm numeric,
  p_neck_cm numeric,
  p_hip_cm numeric,
  p_sex text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calc jsonb;
  v_row private.gf_body_metrics;
begin
  v_calc := private.gf_calculate_metric(p_weight_kg, p_height_cm, p_waist_cm, p_neck_cm, p_hip_cm, p_sex);
  insert into private.gf_body_metrics(person_id, recorded_by, weight_kg, height_cm, waist_cm, neck_cm, hip_cm, sex, bmi, body_fat_pct, notes)
  values (p_person_id, auth.uid(), p_weight_kg, p_height_cm, p_waist_cm, p_neck_cm, p_hip_cm, p_sex,
          nullif(v_calc->>'bmi','')::numeric, nullif(v_calc->>'bodyFatPct','')::numeric, left(coalesce(trim(p_notes),''),500))
  returning * into v_row;
  return jsonb_build_object(
    'id', v_row.id, 'personId', v_row.person_id, 'recordedBy', v_row.recorded_by,
    'measuredAt', v_row.measured_at, 'weightKg', v_row.weight_kg, 'heightCm', v_row.height_cm,
    'waistCm', v_row.waist_cm, 'neckCm', v_row.neck_cm, 'hipCm', v_row.hip_cm,
    'sex', v_row.sex, 'bmi', v_row.bmi, 'bodyFatPct', v_row.body_fat_pct, 'notes', v_row.notes
  );
end;
$$;

revoke all on function private.gf_insert_metric(text,numeric,numeric,numeric,numeric,numeric,text,text) from public, anon, authenticated;

create or replace function public.gf_get_my_body_metrics(p_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_person_id text;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role not in ('cliente','profe') then raise exception 'Esta función es para cuentas Cliente o Profesor.'; end if;
  select person_id into v_person_id from public.gf_account_links where user_id = auth.uid() and link_kind = v_role limit 1;
  if v_person_id is null then raise exception 'Tu cuenta todavía no tiene una ficha vinculada.'; end if;
  return jsonb_build_object('personId', v_person_id, 'items', private.gf_metrics_json(v_person_id, p_limit));
end;
$$;

create or replace function public.gf_save_my_body_metric(
  p_weight_kg numeric,
  p_height_cm numeric,
  p_waist_cm numeric default null,
  p_neck_cm numeric default null,
  p_hip_cm numeric default null,
  p_sex text default null,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_person_id text;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role not in ('cliente','profe') then raise exception 'Esta función es para cuentas Cliente o Profesor.'; end if;
  select person_id into v_person_id from public.gf_account_links where user_id = auth.uid() and link_kind = v_role limit 1;
  if v_person_id is null then raise exception 'Tu cuenta todavía no tiene una ficha vinculada.'; end if;
  return private.gf_insert_metric(v_person_id, p_weight_kg, p_height_cm, p_waist_cm, p_neck_cm, p_hip_cm, p_sex, p_notes);
end;
$$;

create or replace function public.gf_get_person_body_metrics(p_person_id text, p_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_person jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar progreso.'; end if;
  v_person := private.gf_metric_person(p_person_id);
  if v_person is null then raise exception 'Ficha no encontrada.'; end if;
  if v_role = 'profe' and v_person->>'role' <> 'Cliente' then raise exception 'El Profesor sólo puede consultar alumnos.'; end if;
  return jsonb_build_object('personId', p_person_id, 'items', private.gf_metrics_json(p_person_id, p_limit));
end;
$$;

create or replace function public.gf_save_person_body_metric(
  p_person_id text,
  p_weight_kg numeric,
  p_height_cm numeric,
  p_waist_cm numeric default null,
  p_neck_cm numeric default null,
  p_hip_cm numeric default null,
  p_sex text default null,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_person jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para registrar progreso.'; end if;
  v_person := private.gf_metric_person(p_person_id);
  if v_person is null then raise exception 'Ficha no encontrada.'; end if;
  if v_role = 'profe' and v_person->>'role' <> 'Cliente' then raise exception 'El Profesor sólo puede registrar medidas de alumnos.'; end if;
  return private.gf_insert_metric(p_person_id, p_weight_kg, p_height_cm, p_waist_cm, p_neck_cm, p_hip_cm, p_sex, p_notes);
end;
$$;

revoke all on function public.gf_get_my_body_metrics(integer) from public, anon;
revoke all on function public.gf_save_my_body_metric(numeric,numeric,numeric,numeric,numeric,text,text) from public, anon;
revoke all on function public.gf_get_person_body_metrics(text,integer) from public, anon;
revoke all on function public.gf_save_person_body_metric(text,numeric,numeric,numeric,numeric,numeric,text,text) from public, anon;
grant execute on function public.gf_get_my_body_metrics(integer) to authenticated;
grant execute on function public.gf_save_my_body_metric(numeric,numeric,numeric,numeric,numeric,text,text) to authenticated;
grant execute on function public.gf_get_person_body_metrics(text,integer) to authenticated;
grant execute on function public.gf_save_person_body_metric(text,numeric,numeric,numeric,numeric,numeric,text,text) to authenticated;

create or replace function public.gf_list_professor_permissions()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.gf_profiles;
begin
  select * into v_actor from public.gf_profiles where user_id = auth.uid();
  if v_actor.user_id is null or v_actor.role <> 'admin' or not v_actor.is_master then
    raise exception 'Sólo el Admin master puede administrar este permiso.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', p.user_id,
      'name', p.display_name,
      'email', p.email,
      'canGrantAccess', p.can_grant_access,
      'linkedPersonId', l.person_id
    ) order by lower(p.display_name), lower(p.email))
    from public.gf_profiles p
    left join public.gf_account_links l on l.user_id = p.user_id and l.link_kind = 'profe'
    where p.role = 'profe'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.gf_set_professor_access_permission(p_user_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.gf_profiles;
  v_target public.gf_profiles;
begin
  select * into v_actor from public.gf_profiles where user_id = auth.uid();
  if v_actor.user_id is null or v_actor.role <> 'admin' or not v_actor.is_master then
    raise exception 'Sólo el Admin master puede administrar este permiso.';
  end if;
  select * into v_target from public.gf_profiles where user_id = p_user_id;
  if v_target.user_id is null or v_target.role <> 'profe' then raise exception 'La cuenta seleccionada no es Profesor.'; end if;
  update public.gf_profiles set can_grant_access = coalesce(p_enabled,false) where user_id = p_user_id;
  return jsonb_build_object('userId', p_user_id, 'canGrantAccess', coalesce(p_enabled,false));
end;
$$;

revoke all on function public.gf_list_professor_permissions() from public, anon;
revoke all on function public.gf_set_professor_access_permission(uuid,boolean) from public, anon;
grant execute on function public.gf_list_professor_permissions() to authenticated;
grant execute on function public.gf_set_professor_access_permission(uuid,boolean) to authenticated;

-- Conserva la implementación existente (normal o escalada) como núcleo y deja a Profesor
-- sólo la selección de sucursal por el canal genérico. El acceso manual usa un RPC dedicado.
do $$
begin
  if to_regprocedure('public.gf_apply_operations_core_v106(jsonb)') is null then
    execute 'alter function public.gf_apply_operations(jsonb) rename to gf_apply_operations_core_v106';
  end if;
end $$;

revoke all on function public.gf_apply_operations_core_v106(jsonb) from public, anon, authenticated;

create or replace function public.gf_apply_operations(p_operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_op jsonb;
begin
  select role into v_role from public.gf_profiles where user_id = auth.uid();
  if v_role = 'profe' then
    for v_op in select value from jsonb_array_elements(coalesce(p_operations,'[]'::jsonb)) loop
      if not (v_op->>'action' = 'set' and v_op->>'key' = 'activeBranch') then
        raise exception 'El Profesor no puede usar el canal operativo de accesos. Usá el permiso individual de acceso manual.';
      end if;
    end loop;
  end if;
  return public.gf_apply_operations_core_v106(p_operations);
end;
$$;

revoke all on function public.gf_apply_operations(jsonb) from public, anon;
grant execute on function public.gf_apply_operations(jsonb) to authenticated;

create or replace function public.gf_publish_access_display(p_event jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_can boolean;
  v_key text;
  v_event jsonb;
begin
  select role, can_grant_access into v_role, v_can from public.gf_profiles where user_id = auth.uid() limit 1;
  if v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para publicar accesos.'; end if;
  if v_role = 'profe' and not coalesce(v_can,false) then raise exception 'El Admin no habilitó acceso manual para este Profesor.'; end if;
  if jsonb_typeof(coalesce(p_event,'{}'::jsonb)) <> 'object' then raise exception 'Evento de acceso inválido.'; end if;
  v_event := coalesce(p_event,'{}'::jsonb);
  select display_key into v_key from private.gf_access_display_state where id='main' for update;
  if v_key is null then raise exception 'Segunda pantalla no configurada.'; end if;
  update private.gf_access_display_state set event=v_event, updated_at=now() where id='main';
  perform realtime.send(v_event, 'access-result', 'access-display:' || v_key, false);
  return true;
end;
$$;

revoke all on function public.gf_publish_access_display(jsonb) from public, anon;
grant execute on function public.gf_publish_access_display(jsonb) to authenticated;

create or replace function public.gf_professor_allow_manual_access()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.gf_profiles;
  v_state jsonb;
  v_branch text;
  v_branch_name text;
  v_now timestamptz := now();
  v_access_id text := gen_random_uuid()::text;
  v_notification_id text := gen_random_uuid()::text;
  v_event jsonb;
  v_ops jsonb;
begin
  select * into v_profile from public.gf_profiles where user_id = auth.uid();
  if v_profile.user_id is null or v_profile.role <> 'profe' or not coalesce(v_profile.can_grant_access,false) then
    raise exception 'El Admin no habilitó acceso manual para este Profesor.';
  end if;
  select data into v_state from public.gf_gym_state where id='main';
  v_branch := coalesce(v_state->>'activeBranch','centro');
  select item->>'name' into v_branch_name
  from jsonb_array_elements(coalesce(v_state->'branches','[]'::jsonb)) item
  where item->>'id'=v_branch limit 1;
  v_event := jsonb_build_object(
    'person', jsonb_build_object('id','manual','name','Acceso autorizado','dni','—','role','Invitado','plan','Permiso manual','expiry',''),
    'allowed', true,
    'manual', true,
    'membershipStatus', 'Autorizado por profesor',
    'lastPaymentDate', null,
    'daysToExpiry', null,
    'branchName', coalesce(v_branch_name,v_branch),
    'checkedAt', v_now
  );
  v_ops := jsonb_build_array(
    jsonb_build_object('id',gen_random_uuid(),'action','upsert','collection','accesses','recordId',v_access_id,'payload',jsonb_build_object('id',v_access_id,'personId',null,'branch',v_branch,'allowed',true,'manual',true,'date',v_now)),
    jsonb_build_object('id',gen_random_uuid(),'action','upsert','collection','notificationLog','recordId',v_notification_id,'payload',jsonb_build_object('id',v_notification_id,'type','manualAccess','title','Acceso manual autorizado','body',coalesce(v_profile.display_name,'Profesor') || ' permitió un ingreso manual.','branch',v_branch,'date',v_now))
  );
  perform public.gf_apply_operations_core_v106(v_ops);
  perform public.gf_publish_access_display(v_event);
  return v_event;
end;
$$;

revoke all on function public.gf_professor_allow_manual_access() from public, anon;
grant execute on function public.gf_professor_allow_manual_access() to authenticated;
