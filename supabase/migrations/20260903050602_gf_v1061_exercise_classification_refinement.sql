-- GymFlow V.1.061 - refinamientos sobre nombres ambiguos de la biblioteca.
with fixes(pattern, muscle_group, category, equipment) as (
  values
    ('dragon flag', 'Core', 'Técnica', null),
    ('%ab curl%', 'Core', null, null),
    ('%ab reach%', 'Core', null, null),
    ('%fitball balance%', 'Core', 'Técnica', null),
    ('%stork stance%', 'Core', 'Técnica', null),
    ('%opposition reach%', 'Core', 'Técnica', null),
    ('%cobra%', 'Espalda', null, null),
    ('%invertido hyper%', 'Glúteos', null, null),
    ('%assisted dip%', 'Tríceps', null, null),
    ('en máquina dip', 'Tríceps', null, null),
    ('%fitball dip%', 'Tríceps', null, null),
    ('%barra boca arriba invertido extensión%', 'Tríceps', null, null),
    ('%bent-over lateral pulley%', 'Hombros', null, null),
    ('%sobre la cabeza elevación - boca arriba%', 'Hombros', null, null),
    ('%diagonal con disco elevación%', 'Hombros', null, null),
    ('%upward chop%', 'Core', null, null),
    ('%thoracic%mobility%', 'Movilidad', 'Movilidad', null),
    ('%thoracic spine extensión - foam roller%', 'Movilidad', 'Movilidad', 'Foam roller'),
    ('ankle circles', 'Movilidad', 'Movilidad', null),
    ('muñeca circles', 'Movilidad', 'Movilidad', null),
    ('%lateral muñeca tirón%', 'Antebrazos', null, null),
    ('%pierna swing%', 'Movilidad', 'Movilidad', null),
    ('%pierna swings%', 'Movilidad', 'Movilidad', null),
    ('%carioca%', 'Cardio', 'Cardio', null),
    ('%lateral to lateral shuffle%', 'Cardio', 'Cardio', null),
    ('%wall sit%', 'Cuádriceps', null, null),
    ('pendlay remo', 'Espalda', 'Fuerza', 'Barra')
), matches as (
  select e.id, f.muscle_group, coalesce(f.category,e.category) category,
         coalesce(f.equipment,e.equipment) equipment
  from public.gf_exercises e
  join fixes f on lower(e.name) like f.pattern
  where cardinality(e.library_codes)>0
)
update public.gf_exercises e
set muscle_group=m.muscle_group,
    category=m.category,
    equipment=m.equipment,
    notes=private.gf_exercise_notes(m.muscle_group,m.category)
from matches m
where e.id=m.id;
