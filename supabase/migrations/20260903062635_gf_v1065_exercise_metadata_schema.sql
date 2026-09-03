-- GymFlow V.1.065
-- Soporte relacional para alias y nombre original de ejercicios.

alter table public.gf_exercises
  add column if not exists aliases text[] not null default '{}'::text[],
  add column if not exists original_name text not null default '';

create index if not exists gf_exercises_aliases_gin_idx
  on public.gf_exercises using gin (aliases);

create index if not exists gf_exercises_original_name_lower_idx
  on public.gf_exercises ((lower(original_name)))
  where original_name <> '';
