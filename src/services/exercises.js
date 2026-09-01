import { supabase } from "./supabase";

export const MUSCLE_GROUPS = ["Pecho", "Espalda", "Piernas", "Glúteos", "Hombros", "Bíceps", "Tríceps", "Core", "Cardio", "Movilidad", "Otro"];
export const EXERCISE_CATEGORIES = ["Fuerza", "Hipertrofia", "Técnica", "Cardio", "Movilidad"];

export async function listExercises() {
  if (!supabase) return { exercises: [], error: new Error("Supabase no configurado") };
  const { data, error } = await supabase
    .from("gf_exercises")
    .select("id,name,muscle_group,category,equipment,image_url,video_url,default_sets,default_reps,rest_seconds,notes,is_system,created_by,created_at,updated_at")
    .order("muscle_group", { ascending: true })
    .order("name", { ascending: true });
  return { exercises: data || [], error };
}

export async function createExercise(payload) {
  if (!supabase) return { exercise: null, error: new Error("Supabase no configurado") };
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user?.id) return { exercise: null, error: authError || new Error("Sin sesión") };
  const { data, error } = await supabase
    .from("gf_exercises")
    .insert({ ...payload, created_by: authData.user.id, is_system: false })
    .select()
    .single();
  return { exercise: data || null, error };
}

export async function updateExercise(id, payload) {
  if (!supabase) return { exercise: null, error: new Error("Supabase no configurado") };
  const { data, error } = await supabase
    .from("gf_exercises")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  return { exercise: data || null, error };
}

export async function deleteExercise(id) {
  if (!supabase) return { ok: false, error: new Error("Supabase no configurado") };
  const { error } = await supabase.from("gf_exercises").delete().eq("id", id);
  return { ok: !error, error };
}
