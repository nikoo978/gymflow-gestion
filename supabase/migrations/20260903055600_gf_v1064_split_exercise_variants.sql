-- GymFlow V.1.064
-- Cada ID de la biblioteca representa una variante independiente.

-- La unicidad por nombre + músculo impedía conservar variantes con el mismo nombre.
drop index if exists public.gf_exercises_name_group_idx;

-- Primero clonamos cada código adicional de las filas que V1.061 había consolidado.
insert into public.gf_exercises (
  name,
  muscle_group,
  category,
  equipment,
  image_url,
  video_url,
  default_sets,
  default_reps,
  rest_seconds,
  notes,
  is_system,
  created_by,
  created_at,
  updated_at,
  library_codes
)
select
  e.name,
  e.muscle_group,
  e.category,
  e.equipment,
  'https://res.cloudinary.com/po0pnxfc/image/upload/' || code::text || '.gif',
  e.video_url,
  e.default_sets,
  e.default_reps,
  e.rest_seconds,
  e.notes,
  true,
  null,
  e.created_at,
  now(),
  array[code]::integer[]
from public.gf_exercises e
cross join lateral unnest(e.library_codes) with ordinality as u(code, position)
where e.is_system = true
  and cardinality(e.library_codes) > 1
  and position > 1;

-- La fila original conserva el primer código y su GIF correspondiente.
update public.gf_exercises
set
  image_url = 'https://res.cloudinary.com/po0pnxfc/image/upload/' || library_codes[1]::text || '.gif',
  library_codes = array[library_codes[1]]::integer[],
  updated_at = now()
where is_system = true
  and cardinality(library_codes) > 0;

-- Los 11 ejercicios de ejemplo de V1.04 no pertenecen a la biblioteca de 1.336 IDs
-- y no están usados por ninguna rutina. La biblioteca oficial pasa a ser exactamente la importada.
delete from public.gf_exercises e
where e.is_system = true
  and cardinality(e.library_codes) = 0
  and e.created_by is null
  and not exists (
    select 1
    from private.gf_routine_items ri
    where ri.exercise_id = e.id
  );

-- Garantiza que un ID de biblioteca no vuelva a consolidarse accidentalmente.
create unique index if not exists gf_exercises_library_code_unique_idx
  on public.gf_exercises ((library_codes[1]))
  where is_system = true and cardinality(library_codes) = 1;

-- Índice normal para ordenar/buscar nombres repetidos sin imponer unicidad.
create index if not exists gf_exercises_name_group_lookup_idx
  on public.gf_exercises (lower(name), lower(muscle_group));
