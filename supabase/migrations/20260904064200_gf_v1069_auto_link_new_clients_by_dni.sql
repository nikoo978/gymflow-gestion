-- GymFlow V.1.069
-- Nuevas cuentas: Cliente por defecto + vínculo automático por DNI cuando la ficha es única y está libre.

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
  v_person_id text;
  v_person_matches integer := 0;
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

  if not make_master and v_dni is not null then
    select count(*), min(person->>'id')
      into v_person_matches, v_person_id
    from public.gf_gym_state s
    cross join lateral jsonb_array_elements(coalesce(s.data->'people', '[]'::jsonb)) person
    where s.id = 'main'
      and person->>'role' = 'Cliente'
      and regexp_replace(coalesce(person->>'dni',''), '[^0-9]', '', 'g') = v_dni;

    if v_person_matches = 1
       and coalesce(v_person_id, '') <> ''
       and not exists (
         select 1 from public.gf_account_links where person_id = v_person_id
       ) then
      insert into public.gf_account_links(user_id, person_id, link_kind, linked_by, linked_at, updated_at)
      values (new.id, v_person_id, 'cliente', null, now(), now())
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.gf_create_profile_for_new_user() from public, anon, authenticated;

comment on function public.gf_create_profile_for_new_user() is
  'Crea perfiles con rol cliente por defecto y vincula automáticamente una ficha Cliente cuando el DNI coincide de forma única y la ficha no está vinculada.';
