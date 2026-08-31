-- GymFlow V.1.03
-- Portal seguro del cliente: expone exclusivamente la ficha vinculada al email de la cuenta autenticada
-- y sus propios accesos. No expone caja, cierres, otros clientes ni configuración administrativa.

create or replace function public.gf_get_my_client_portal()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile public.gf_profiles;
  v_data jsonb;
  v_member jsonb;
  v_member_id text;
  v_accesses jsonb := '[]'::jsonb;
  v_branch_name text;
begin
  select * into v_profile
  from public.gf_profiles
  where user_id = auth.uid()
  limit 1;

  if v_profile.user_id is null then
    raise exception 'La cuenta no tiene un perfil GymFlow.';
  end if;

  if v_profile.role <> 'cliente' then
    raise exception 'Este portal está disponible exclusivamente para cuentas Cliente.';
  end if;

  select data into v_data
  from public.gf_gym_state
  where id = 'main';

  v_data := coalesce(v_data, '{}'::jsonb);

  select item into v_member
  from jsonb_array_elements(coalesce(v_data->'people', '[]'::jsonb)) item
  where coalesce(item->>'role', '') = 'Cliente'
    and lower(trim(coalesce(item->>'email', ''))) = lower(trim(v_profile.email))
  limit 1;

  if v_member is null then
    return jsonb_build_object(
      'linked', false,
      'account', jsonb_build_object(
        'email', v_profile.email,
        'displayName', v_profile.display_name,
        'role', v_profile.role
      ),
      'member', null,
      'branchName', null,
      'accesses', '[]'::jsonb
    );
  end if;

  v_member_id := v_member->>'id';

  select item->>'name' into v_branch_name
  from jsonb_array_elements(coalesce(v_data->'branches', '[]'::jsonb)) item
  where item->>'id' = v_member->>'branch'
  limit 1;

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
    'account', jsonb_build_object(
      'email', v_profile.email,
      'displayName', v_profile.display_name,
      'role', v_profile.role
    ),
    'member', jsonb_build_object(
      'id', v_member->>'id',
      'name', v_member->>'name',
      'dni', v_member->>'dni',
      'email', v_member->>'email',
      'phone', v_member->>'phone',
      'plan', v_member->>'plan',
      'start', v_member->>'start',
      'expiry', v_member->>'expiry',
      'branch', v_member->>'branch',
      'biometricMethod', v_member->>'biometricMethod',
      'biometricStatus', v_member->>'biometricStatus'
    ),
    'branchName', v_branch_name,
    'accesses', v_accesses
  );
end;
$$;

revoke all on function public.gf_get_my_client_portal() from public;
grant execute on function public.gf_get_my_client_portal() to authenticated;
