import { aliasesForLibraryCodes } from "../data/exerciseAliases";
import { supabase } from "./supabase";

export const MUSCLE_GROUPS = ["Pecho", "Espalda", "Hombros", "Bíceps", "Tríceps", "Antebrazos", "Core", "Glúteos", "Cuádriceps", "Isquiotibiales", "Gemelos", "Cadera", "Cuello", "Cuerpo completo", "Cardio", "Movilidad"];
export const EXERCISE_CATEGORIES = ["Fuerza", "Hipertrofia", "Técnica", "Cardio", "Movilidad"];

const EXERCISE_PAGE_SIZE = 500;
const EXERCISE_SELECT = "id,name,muscle_group,category,equipment,image_url,video_url,default_sets,default_reps,rest_seconds,notes,is_system,created_by,created_at,updated_at,library_codes";

export function normalizeExerciseSearch(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function buildExerciseSearchIndex(exercise) {
  return normalizeExerciseSearch([
    exercise?.name,
    exercise?.muscle_group,
    exercise?.category,
    exercise?.equipment,
    exercise?.notes,
    ...(exercise?.aliases || []),
    ...(exercise?.library_codes || []),
  ].filter(Boolean).join(" "));
}

export function matchesExerciseSearch(exercise, query = "") {
  const normalizedQuery = normalizeExerciseSearch(query);
  if (!normalizedQuery) return true;
  const haystack = exercise?.search_index || buildExerciseSearchIndex(exercise);
  return normalizedQuery.split(" ").every((token) => haystack.includes(token));
}

function withAliases(exercise) {
  const enriched = {
    ...exercise,
    aliases: aliasesForLibraryCodes(exercise?.library_codes || []),
  };
  return { ...enriched, search_index: buildExerciseSearchIndex(enriched) };
}

export async function listExercises() {
  if (!supabase) return { exercises: [], error: new Error("Supabase no configurado") };

  const exercises = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("gf_exercises")
      .select(EXERCISE_SELECT)
      .order("muscle_group", { ascending: true })
      .order("name", { ascending: true })
      .range(from, from + EXERCISE_PAGE_SIZE - 1);

    if (error) return { exercises: [], error };

    const batch = (data || []).map(withAliases);
    exercises.push(...batch);
    if (batch.length < EXERCISE_PAGE_SIZE) break;
    from += EXERCISE_PAGE_SIZE;
  }

  return { exercises, error: null };
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
  return { exercise: data ? withAliases(data) : null, error };
}

export async function updateExercise(id, payload) {
  if (!supabase) return { exercise: null, error: new Error("Supabase no configurado") };
  const { data, error } = await supabase
    .from("gf_exercises")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  return { exercise: data ? withAliases(data) : null, error };
}

export async function deleteExercise(id) {
  if (!supabase) return { ok: false, error: new Error("Supabase no configurado") };
  const { error } = await supabase.from("gf_exercises").delete().eq("id", id);
  return { ok: !error, error };
}
