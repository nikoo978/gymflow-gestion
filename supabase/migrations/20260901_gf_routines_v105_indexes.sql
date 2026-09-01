-- GymFlow V.1.05
-- Índices de soporte para claves foráneas de rutinas detectadas por el Performance Advisor.

create index if not exists gf_routine_items_exercise_idx
  on private.gf_routine_items(exercise_id);

create index if not exists gf_routine_assignments_assigned_by_idx
  on private.gf_routine_assignments(assigned_by);
