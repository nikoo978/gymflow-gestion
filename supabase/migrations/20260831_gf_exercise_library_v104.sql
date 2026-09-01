-- GymFlow V.1.04
-- Biblioteca compartida de ejercicios con RLS por rol.
-- Requiere las migraciones de roles V.1.02/V.1.03 ya aplicadas.

create extension if not exists pgcrypto;

create table if not exists public.gf_exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  muscle_group text not null default 'Otro',
  category text not null default 'Hipertrofia',
  equipment text not null default '',
  image_url text,
  video_url text,
  default_sets integer not null default 3 check (default_sets between 1 and 20),
  default_reps text not null default '8-12',
  rest_seconds integer not null default 60 check (rest_seconds between 0 and 1800),
  notes text not null default '',
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists gf_exercises_name_group_idx
on public.gf_exercises (lower(name), lower(muscle_group));

create or replace function public.gf_touch_exercise_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists gf_exercises_updated_at on public.gf_exercises;
create trigger gf_exercises_updated_at
before update on public.gf_exercises
for each row execute function public.gf_touch_exercise_updated_at();

alter table public.gf_exercises enable row level security;
revoke all on table public.gf_exercises from anon;
grant select, insert, update, delete on table public.gf_exercises to authenticated;

drop policy if exists "Staff lee ejercicios" on public.gf_exercises;
create policy "Staff lee ejercicios"
on public.gf_exercises
for select
to authenticated
using (public.gf_current_role() in ('admin','coadmin','profe'));

drop policy if exists "Staff crea ejercicios personalizados" on public.gf_exercises;
create policy "Staff crea ejercicios personalizados"
on public.gf_exercises
for insert
to authenticated
with check (
  public.gf_current_role() in ('admin','coadmin','profe')
  and created_by = auth.uid()
  and is_system = false
);

drop policy if exists "Gestión segura de ejercicios" on public.gf_exercises;
create policy "Gestión segura de ejercicios"
on public.gf_exercises
for update
to authenticated
using (
  public.gf_current_role() in ('admin','coadmin')
  or (public.gf_current_role() = 'profe' and is_system = false and created_by = auth.uid())
)
with check (
  public.gf_current_role() in ('admin','coadmin')
  or (public.gf_current_role() = 'profe' and is_system = false and created_by = auth.uid())
);

drop policy if exists "Borrado seguro de ejercicios" on public.gf_exercises;
create policy "Borrado seguro de ejercicios"
on public.gf_exercises
for delete
to authenticated
using (
  (public.gf_current_role() in ('admin','coadmin') and is_system = false)
  or (public.gf_current_role() = 'profe' and is_system = false and created_by = auth.uid())
);

insert into public.gf_exercises (name, muscle_group, category, equipment, default_sets, default_reps, rest_seconds, notes, is_system)
values
  ('Press banca', 'Pecho', 'Fuerza', 'Barra y banco', 4, '6-10', 120, 'Controlar la retracción escapular y el recorrido.', true),
  ('Press inclinado con mancuernas', 'Pecho', 'Hipertrofia', 'Mancuernas y banco inclinado', 3, '8-12', 90, 'Mantener tensión continua y rango cómodo.', true),
  ('Dominadas', 'Espalda', 'Fuerza', 'Barra de dominadas', 4, '6-10', 120, 'Evitar balanceo y completar el rango.', true),
  ('Remo con barra', 'Espalda', 'Hipertrofia', 'Barra', 4, '8-12', 90, 'Columna neutra y tracción hacia el abdomen.', true),
  ('Sentadilla', 'Piernas', 'Fuerza', 'Barra y rack', 4, '6-10', 150, 'Priorizar técnica, estabilidad y profundidad segura.', true),
  ('Prensa de piernas', 'Piernas', 'Hipertrofia', 'Prensa', 4, '10-15', 90, 'No bloquear las rodillas al extender.', true),
  ('Peso muerto rumano', 'Glúteos', 'Hipertrofia', 'Barra o mancuernas', 3, '8-12', 120, 'Bisagra de cadera con espalda neutra.', true),
  ('Hip thrust', 'Glúteos', 'Hipertrofia', 'Barra y banco', 4, '8-12', 90, 'Pausa breve en extensión completa.', true),
  ('Press militar', 'Hombros', 'Fuerza', 'Barra o mancuernas', 4, '6-10', 120, 'Evitar hiperextensión lumbar.', true),
  ('Curl de bíceps', 'Bíceps', 'Hipertrofia', 'Mancuernas', 3, '10-15', 60, 'Mantener codos estables y controlar la bajada.', true),
  ('Extensión de tríceps en polea', 'Tríceps', 'Hipertrofia', 'Polea', 3, '10-15', 60, 'Fijar codos junto al torso.', true),
  ('Plancha frontal', 'Core', 'Técnica', 'Peso corporal', 3, '30-60 s', 45, 'Mantener pelvis y caja torácica alineadas.', true)
on conflict do nothing;
