-- GymFlow: estado cloud por usuario con aislamiento obligatorio mediante RLS.
create table if not exists public.gf_user_state (
  user_id uuid primary key not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gf_user_state enable row level security;

revoke all on table public.gf_user_state from anon;
grant select, insert, update, delete on table public.gf_user_state to authenticated;

drop policy if exists "Usuarios leen su estado" on public.gf_user_state;
create policy "Usuarios leen su estado"
on public.gf_user_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Usuarios crean su estado" on public.gf_user_state;
create policy "Usuarios crean su estado"
on public.gf_user_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Usuarios modifican su estado" on public.gf_user_state;
create policy "Usuarios modifican su estado"
on public.gf_user_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Usuarios eliminan su estado" on public.gf_user_state;
create policy "Usuarios eliminan su estado"
on public.gf_user_state
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.set_gf_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gf_user_state_updated_at on public.gf_user_state;
create trigger gf_user_state_updated_at
before update on public.gf_user_state
for each row execute function public.set_gf_updated_at();
