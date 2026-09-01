-- GymFlow V1.05 · Paginated/searchable directories for 10k accounts.

create or replace function public.gf_list_accounts_page(
  p_query text default '',
  p_role text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_query text := lower(trim(coalesce(p_query,'')));
  v_limit integer := greatest(1, least(coalesce(p_limit,50),100));
  v_offset integer := greatest(0, coalesce(p_offset,0));
  v_result jsonb;
begin
  select role into v_role from public.gf_profiles where user_id=auth.uid();
  if v_role not in ('admin','coadmin') then raise exception 'No tenés permisos para ver las cuentas registradas.'; end if;

  with filtered as materialized (
    select p.user_id,p.email,p.display_name,p.dni,p.role,p.is_master,p.created_at,p.updated_at,
           l.person_id as linked_person_id,l.link_kind as linked_kind,l.linked_at,
           gp.name as linked_person_name
    from public.gf_profiles p
    left join public.gf_account_links l on l.user_id=p.user_id
    left join private.gf_people gp on gp.id=l.person_id
    where (p_role is null or p_role='' or p_role='todos' or p.role=p_role)
      and (
        v_query=''
        or lower(coalesce(p.display_name,'')) like '%'||v_query||'%'
        or lower(coalesce(p.email,'')) like '%'||v_query||'%'
        or lower(coalesce(p.dni,'')) like '%'||v_query||'%'
        or lower(coalesce(gp.name,'')) like '%'||v_query||'%'
      )
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(x) order by x.is_master desc,x.created_at,x.user_id) from (
      select * from filtered order by is_master desc,created_at,user_id limit v_limit offset v_offset
    ) x),'[]'::jsonb),
    'totalFiltered',(select count(*) from filtered),
    'limit',v_limit,
    'offset',v_offset,
    'counts',(
      select jsonb_build_object(
        'total',count(*),
        'unlinked',count(*) filter(where not p.is_master and p.role<>'coadmin' and l.user_id is null),
        'profe',count(*) filter(where p.role='profe'),
        'cliente',count(*) filter(where p.role='cliente')
      )
      from public.gf_profiles p left join public.gf_account_links l on l.user_id=p.user_id
    )
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.gf_list_accounts_page(text,text,integer,integer) from public,anon;
grant execute on function public.gf_list_accounts_page(text,text,integer,integer) to authenticated;

create or replace function public.gf_list_routine_clients_page(
  p_query text default '',
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_query text := lower(trim(coalesce(p_query,'')));
  v_limit integer := greatest(1,least(coalesce(p_limit,50),100));
  v_offset integer := greatest(0,coalesce(p_offset,0));
  v_result jsonb;
begin
  select role into v_role from public.gf_profiles where user_id=auth.uid();
  if v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar alumnos.'; end if;

  with filtered as materialized (
    select p.user_id,p.email,
           coalesce(nullif(p.display_name,''),gp.name,p.email) as display_name,
           coalesce(nullif(p.dni,''),gp.dni) as dni,
           l.person_id
    from public.gf_profiles p
    join public.gf_account_links l on l.user_id=p.user_id and l.link_kind='cliente'
    left join private.gf_people gp on gp.id=l.person_id
    where p.role='cliente'
      and (v_query='' or lower(coalesce(p.display_name,gp.name,'')) like '%'||v_query||'%'
        or lower(coalesce(p.email,'')) like '%'||v_query||'%'
        or lower(coalesce(p.dni,gp.dni,'')) like '%'||v_query||'%')
  )
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.display_name,x.email) from (
      select * from filtered order by display_name,email limit v_limit offset v_offset
    ) x),'[]'::jsonb),
    'totalFiltered',(select count(*) from filtered),
    'limit',v_limit,
    'offset',v_offset
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.gf_list_routine_clients_page(text,integer,integer) from public,anon;
grant execute on function public.gf_list_routine_clients_page(text,integer,integer) to authenticated;

create or replace function public.gf_list_routine_clients_by_ids(p_user_ids uuid[])
returns table(user_id uuid,email text,display_name text,dni text,person_id text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_role text;
begin
  select role into v_role from public.gf_profiles where public.gf_profiles.user_id=auth.uid();
  if v_role not in ('admin','coadmin','profe') then raise exception 'Sin permisos para consultar alumnos.'; end if;
  return query
  select p.user_id,p.email,coalesce(nullif(p.display_name,''),gp.name,p.email),coalesce(nullif(p.dni,''),gp.dni),l.person_id
  from public.gf_profiles p
  join public.gf_account_links l on l.user_id=p.user_id and l.link_kind='cliente'
  left join private.gf_people gp on gp.id=l.person_id
  where p.role='cliente' and p.user_id=any(coalesce(p_user_ids,array[]::uuid[]));
end;
$$;
revoke all on function public.gf_list_routine_clients_by_ids(uuid[]) from public,anon;
grant execute on function public.gf_list_routine_clients_by_ids(uuid[]) to authenticated;
