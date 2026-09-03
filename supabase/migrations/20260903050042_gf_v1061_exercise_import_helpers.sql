-- GymFlow V.1.061
-- Preparación del importador de la biblioteca masiva de ejercicios.

alter table public.gf_exercises
  add column if not exists library_codes integer[] not null default '{}'::integer[];

create index if not exists gf_exercises_library_codes_gin_idx
  on public.gf_exercises using gin (library_codes);
create index if not exists gf_exercises_group_name_idx
  on public.gf_exercises (muscle_group, name);

update public.gf_exercises
set muscle_group = case
  when lower(name) = 'peso muerto rumano' then 'Isquiotibiales'
  when lower(name) in ('sentadilla','prensa de piernas') then 'Cuádriceps'
  else muscle_group
end
where muscle_group = 'Piernas'
  and lower(name) in ('peso muerto rumano','sentadilla','prensa de piernas');

create or replace function private.gf_exercise_group(p_name text)
returns text language sql immutable set search_path = '' as $$
with n as (
  select translate(lower(coalesce(p_name,'')), 'áéíóúñü', 'aeiounu') q
)
select case
  when q ~ 'curl de muneca|wrist|forearm|hand squeeze|pinch|muneca roller|pronation|supination' then 'Antebrazos'
  when q ~ 'neck flexion|neck extension|neck estiramiento|scalene|head tilt' then 'Cuello'
  when q ~ 'gemelos|calf|soleus|achilles|toe elevacion|donkey elevacion' then 'Gemelos'
  when (q ~ 'triceps|rompecraneos|skull|jm press|press frances|bench dip|three bench dip|tate press' or q='dip') and q !~ 'pecho' then 'Tríceps'
  when ((q ~ 'curl' and q !~ '(femoral|pierna|triceps|muneca|wrist|ab curl)') or q ~ 'biceps|predicador|preacher|zottman') then 'Bíceps'
  when q ~ 'abduccion de cadera|aduccion de cadera|hip abduction|hip adduction|cadera rotacion|pelvic tilt|cadera flexor|hip flexor' then 'Cadera'
  when q ~ 'femoral|hamstring|peso muerto rumano|piernas rigidas|buenos dias|good morning' then 'Isquiotibiales'
  when q ~ 'gluteo|hip thrust|cadera thrust|bridge|puente|kickback|tiron through|pull through|cadera lift|hip lift' then 'Glúteos'
  when q ~ 'abdominal|ab rollout|plancha|plank|pike|jackknife|jacknife|v-up|v up|dead bug|bird dog|russian|giros rusos|wood chop|pallof|windshield|heel touch|toe touch|leg raise|elevacion de piernas|elevacion de rodillas|rodilla elevacion|cadera elevacion|lateral bend|trunk rotacion|roman twist|hundreds|scissor kick|flutter kick|pelvic|rotacion|twist|windmill|tuck|rodilla draw in|ab draw|ab roll|cadera flexion|leg slide|pierna slide|oblique|pendulum' then 'Core'
  when q ~ 'internal rotacion|external rotacion|cuban press|hombros|deltoid|vuelos laterales|vuelos posteriores|elevaciones frontales|elevacion frontal|press arnold|press militar|remo al menton|encogimiento de hombros|shrug|face tiron|shoulder|bradford|bent-over elevacion|frontal inclinado elevacion|see saw press|dublin press|around the world|iron cross|arm circles' then 'Hombros'
  when q ~ 'press banca|press de pecho|pecho|aperturas|cross-over|crossover|empuje-up|empuje up|push-up|push up|floor press|chest press|chest fly|press declinado|press inclinado|declinado press|inclinado press|hammer press' and q !~ '(press de hombros|press militar|empuje press|push press)' then 'Pecho'
  when q ~ 'remo|pulldown|jalon|dominadas|hyperextension|espalda extension|superman|lat estiramiento|rack tiron|tiron-in|hang' and q !~ 'remo al menton' then 'Espalda'
  when q ~ 'extension de cuadriceps|quadricep|sentadilla|squat|estocada|lunge|subida al banco|step-up|step up|prensa de piernas|leg press|sissy' and q ~ '(sumo|plie|wide stance)' then 'Glúteos'
  when q ~ 'extension de cuadriceps|quadricep|sentadilla|squat|estocada|lunge|subida al banco|step-up|step up|prensa de piernas|leg press|sissy' then 'Cuádriceps'
  when q ~ '(peso muerto|deadlift)' and q ~ 'sumo' then 'Glúteos'
  when q ~ '(peso muerto|deadlift)' then 'Cuerpo completo'
  when q ~ 'snatch|clean|jerk|thruster|turkish get-up|farmers carry|farmer|bear crawl|burpee|inchworm|swing|figure eight|pierna pass|rack delivery|judo flip|throw|slam' then 'Cuerpo completo'
  when q ~ 'aerobics|air bike|boxing|elliptical|rowing|running|stationary bike|step en maquina|treadmill|walking|saltar la soga' then 'Cardio'
  when q ~ 'estiramiento| pose|pose|mobility|yoga|pilates|rolling|roll down|downward facing|upward facing|sun salutation|scorpion|sphinx|forward fold|half moon|salutation|locust' then 'Movilidad'
  when q ~ 'press de hombros|empuje press|push press|sobre la cabeza press|overhead press|posterior press' then 'Hombros'
  when q ~ 'press' then 'Pecho'
  when q ~ 'salto al cajon|jump|salto|pierna swing|high rodilla|mountain climber|escaladores|butt kick|stride|hop-sprint' then 'Cuádriceps'
  when q ~ 'pullover' then 'Espalda'
  when q ~ '(cadera extension|hip extension)' then 'Glúteos'
  when q ~ '(cadera|hip)' then 'Cadera'
  when q ~ '(pierna|rodilla)' then 'Cuádriceps'
  else 'Cuerpo completo'
end
from n
$$;

create or replace function private.gf_exercise_category(p_name text)
returns text language sql immutable set search_path = '' as $$
with n as (
  select translate(lower(coalesce(p_name,'')), 'áéíóúñü', 'aeiounu') q
)
select case
  when q ~ 'estiramiento|mobility|yoga|pilates|rolling|roll down|circles|circle|pose|downward facing|upward facing|sun salutation|scorpion|sphinx|forward fold|half moon|salutation|locust' then 'Movilidad'
  when q ~ 'aerobics|air bike|boxing|elliptical|rowing|running|stationary bike|step en maquina|treadmill|walking|saltar la soga' then 'Cardio'
  when q ~ 'snatch|clean|jerk|thruster|turkish get-up|salto|jump|throw|slam|bound|skip|burpee|plyo|depth' then 'Técnica'
  when q ~ 'press banca|sentadilla|peso muerto|dominadas|rack tiron|press militar|pull-up' then 'Fuerza'
  else 'Hipertrofia'
end
from n
$$;

create or replace function private.gf_exercise_equipment(p_name text)
returns text language sql immutable set search_path = '' as $$
with n as (
  select translate(lower(coalesce(p_name,'')), 'áéíóúñü', 'aeiounu') q
)
select case
  when q ~ 'smith' then 'Máquina Smith'
  when q ~ 'trap bar' then 'Trap bar'
  when q ~ 'ez bar' then 'Barra EZ'
  when q ~ 'en polea' and q ~ 'fitball' then 'Polea + Fitball'
  when q ~ 'con mancuerna' and q ~ 'fitball' then 'Mancuernas + Fitball'
  when q ~ 'con barra' and q ~ 'bench' then 'Barra + banco'
  when q ~ '(en maquina|leverage)' then 'Máquina'
  when q ~ 'en polea' then 'Polea'
  when q ~ 'con barra' then 'Barra'
  when q ~ '(con mancuerna|mancuernas)' then 'Mancuernas'
  when q ~ 'kettlebell' then 'Kettlebell'
  when q ~ 'con banda' then 'Banda elástica'
  when q ~ 'fitball' then 'Fitball'
  when q ~ 'pelota medicinal' then 'Pelota medicinal'
  when q ~ '(weight con disco|con disco)' then 'Disco'
  when q ~ 'air bike' then 'Air bike'
  when q ~ 'elliptical' then 'Elíptico'
  when q ~ 'stationary bike' then 'Bicicleta fija'
  when q ~ 'treadmill' then 'Cinta'
  when q ~ 'rowing' then 'Remo ergómetro'
  when q ~ 'bench' then 'Banco'
  else 'Peso corporal'
end
from n
$$;

create or replace function private.gf_exercise_notes(p_group text, p_category text)
returns text language sql immutable set search_path = '' as $$
select case
  when p_category='Movilidad' then 'Movilidad enfocada en '||lower(p_group)||'. Realizá el recorrido de forma suave, sin rebotes y sin dolor.'
  when p_category='Cardio' then 'Trabajo cardiovascular. Ajustá la intensidad y la duración manteniendo una técnica estable y respiración controlada.'
  when p_group='Pecho' then 'Trabajo de pecho con apoyo de tríceps y hombros. Controlá el descenso y mantené las escápulas estables.'
  when p_group='Espalda' then 'Trabajo de espalda. Iniciá el tirón con las escápulas, evitá el impulso y controlá el regreso.'
  when p_group='Hombros' then 'Trabajo de hombros. Mantené el core firme, el cuello relajado y un recorrido controlado.'
  when p_group='Bíceps' then 'Trabajo de bíceps. Mantené los codos estables y controlá especialmente la fase de bajada.'
  when p_group='Tríceps' then 'Trabajo de tríceps. Fijá hombros y codos y completá la extensión sin perder el control.'
  when p_group='Antebrazos' then 'Trabajo de antebrazo y agarre. Usá un recorrido cómodo y mantené la muñeca controlada.'
  when p_group='Cuello' then 'Trabajo específico de cuello. Usá poca carga, recorrido corto y movimientos lentos y controlados.'
  when p_group='Core' then 'Trabajo de core. Mantené abdomen activo, pelvis controlada y evitá compensar con la zona lumbar.'
  when p_group='Cuádriceps' then 'Trabajo principal de piernas. Mantené pies firmes, rodillas alineadas y tronco estable durante el recorrido.'
  when p_group='Isquiotibiales' then 'Trabajo de cadena posterior e isquiotibiales. Controlá la cadera y mantené la columna en posición neutra.'
  when p_group='Glúteos' then 'Trabajo de glúteos y extensión de cadera. Buscá una contracción fuerte sin hiperextender la zona lumbar.'
  when p_group='Gemelos' then 'Trabajo de gemelos. Completá el recorrido desde el estiramiento hasta la contracción sin rebotes.'
  when p_group='Cadera' then 'Trabajo de estabilizadores de cadera. Mové la pierna con control y mantené pelvis y tronco estables.'
  when p_group='Cardio' then 'Trabajo cardiovascular de cuerpo completo. Regulá el ritmo para sostener una técnica eficiente.'
  when p_group='Movilidad' then 'Ejercicio de movilidad general. Realizá el movimiento de forma suave y dentro de un rango cómodo.'
  else 'Ejercicio global que coordina varias cadenas musculares. Priorizá técnica, postura y control antes de aumentar la carga.'
end
$$;

create or replace function private.gf_seed_exercise_library(p_lines text)
returns integer language plpgsql set search_path = '' as $$
declare v_rows integer := 0;
begin
  with raw_lines as (
    select line from regexp_split_to_table(p_lines, E'\n') line
  ),
  parsed as (
    select (m)[1]::integer library_code, btrim((m)[2]) name
    from raw_lines
    cross join lateral (select regexp_match(line, '^\s*([0-9]+)\s+-\s+(.+?)\s*$') m) rx
    where m is not null
  ),
  classified as (
    select library_code, name,
      private.gf_exercise_group(name) muscle_group,
      private.gf_exercise_category(name) category,
      private.gf_exercise_equipment(name) equipment
    from parsed
  ),
  enriched as (
    select *,
      private.gf_exercise_notes(muscle_group,category) notes,
      case category when 'Cardio' then 1 when 'Movilidad' then 2 when 'Técnica' then 3 when 'Fuerza' then 4 else 3 end default_sets,
      case when category='Cardio' then '10-30 min' when category='Movilidad' then '20-40 s' when category='Técnica' then '3-6' when muscle_group='Core' then '10-20' when category='Fuerza' then '6-10' else '8-15' end default_reps,
      case when category='Cardio' then 0 when category='Movilidad' then 30 when category in ('Técnica','Fuerza') then 120 else 60 end rest_seconds
    from classified
  ),
  deduped as (
    select min(name) name, muscle_group, min(category) category, min(equipment) equipment,
      min(notes) notes, min(default_sets) default_sets, min(default_reps) default_reps,
      min(rest_seconds) rest_seconds, array_agg(distinct library_code order by library_code) library_codes
    from enriched
    group by lower(name), muscle_group
  )
  insert into public.gf_exercises(name,muscle_group,category,equipment,default_sets,default_reps,rest_seconds,notes,is_system,created_by,library_codes)
  select name,muscle_group,category,equipment,default_sets,default_reps,rest_seconds,notes,true,null,library_codes
  from deduped
  on conflict ((lower(name)),(lower(muscle_group))) do update set
    library_codes=(select array_agg(distinct code order by code) from unnest(public.gf_exercises.library_codes||excluded.library_codes) code),
    notes=case when btrim(public.gf_exercises.notes)='' then excluded.notes else public.gf_exercises.notes end,
    equipment=case when btrim(public.gf_exercises.equipment)='' then excluded.equipment else public.gf_exercises.equipment end;
  get diagnostics v_rows = row_count;
  return v_rows;
end
$$;

revoke all on function private.gf_exercise_group(text) from public, anon, authenticated;
revoke all on function private.gf_exercise_category(text) from public, anon, authenticated;
revoke all on function private.gf_exercise_equipment(text) from public, anon, authenticated;
revoke all on function private.gf_exercise_notes(text,text) from public, anon, authenticated;
revoke all on function private.gf_seed_exercise_library(text) from public, anon, authenticated;

comment on column public.gf_exercises.library_codes is
  'Identificadores de la biblioteca original; permite asociar GIFs o medios posteriormente.';
