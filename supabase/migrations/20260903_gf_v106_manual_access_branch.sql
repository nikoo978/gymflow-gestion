-- GymFlow V1.06
-- El acceso manual del Profesor se registra en la sucursal elegida en su dispositivo.

drop function if exists public.gf_professor_allow_manual_access();

create or replace function public.gf_professor_allow_manual_access(p_branch text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.gf_profiles;
  v_state jsonb;
  v_branch text := nullif(trim(coalesce(p_branch, '')), '');
  v_branch_name text;
  v_now timestamptz := now();
  v_access_id text := gen_random_uuid()::text;
  v_notification_id text := gen_random_uuid()::text;
  v_event jsonb;
  v_ops jsonb;
begin
  select * into v_profile
  from public.gf_profiles
  where user_id = auth.uid();

  if v_profile.user_id is null
     or v_profile.role <> 'profe'
     or not coalesce(v_profile.can_grant_access, false) then
    raise exception 'El Admin no habilitó acceso manual para este Profesor.';
  end if;

  select data into v_state
  from public.gf_gym_state
  where id = 'main';

  if v_branch is null then
    raise exception 'Seleccioná una sucursal antes de permitir el acceso.';
  end if;

  select item->>'name' into v_branch_name
  from jsonb_array_elements(coalesce(v_state->'branches', '[]'::jsonb)) item
  where item->>'id' = v_branch
  limit 1;

  if v_branch_name is null then
    raise exception 'La sucursal seleccionada no existe.';
  end if;

  v_event := jsonb_build_object(
    'person', jsonb_build_object(
      'id', 'manual',
      'name', 'Acceso autorizado',
      'dni', '—',
      'role', 'Invitado',
      'plan', 'Permiso manual',
      'expiry', ''
    ),
    'allowed', true,
    'manual', true,
    'membershipStatus', 'Autorizado por profesor',
    'lastPaymentDate', null,
    'daysToExpiry', null,
    'branchName', v_branch_name,
    'checkedAt', v_now
  );

  v_ops := jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'action', 'upsert',
      'collection', 'accesses',
      'recordId', v_access_id,
      'payload', jsonb_build_object(
        'id', v_access_id,
        'personId', null,
        'branch', v_branch,
        'allowed', true,
        'manual', true,
        'date', v_now
      )
    ),
    jsonb_build_object(
      'id', gen_random_uuid(),
      'action', 'upsert',
      'collection', 'notificationLog',
      'recordId', v_notification_id,
      'payload', jsonb_build_object(
        'id', v_notification_id,
        'type', 'manualAccess',
        'title', 'Acceso manual autorizado',
        'body', coalesce(v_profile.display_name, 'Profesor') || ' permitió un ingreso manual.',
        'branch', v_branch,
        'date', v_now
      )
    )
  );

  perform public.gf_apply_operations_core_v106(v_ops);
  perform public.gf_publish_access_display(v_event);
  return v_event;
end;
$$;

revoke all on function public.gf_professor_allow_manual_access(text) from public, anon;
grant execute on function public.gf_professor_allow_manual_access(text) to authenticated;
