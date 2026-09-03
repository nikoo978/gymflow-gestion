-- GymFlow V.1.061 - elimina funciones temporales del importador.
drop function if exists private.gf_seed_exercise_library(text);
drop function if exists private.gf_exercise_notes(text,text);
drop function if exists private.gf_exercise_equipment(text);
drop function if exists private.gf_exercise_category(text);
drop function if exists private.gf_exercise_group(text);
