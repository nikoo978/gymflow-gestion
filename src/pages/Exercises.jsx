import { Dumbbell, ExternalLink, Image as ImageIcon, Pencil, Plus, RefreshCw, Search, Trash2, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FormDialog from "../components/ui/FormDialog";
import { useAuth } from "../context/AuthContext";
import { createExercise, deleteExercise, EXERCISE_CATEGORIES, listExercises, MUSCLE_GROUPS, updateExercise } from "../services/exercises";

const input = "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20";
const migrationName = "supabase/migrations/20260831_gf_exercise_library_v104.sql";

function normalizePayload(form) {
  return {
    name: String(form.get("name") || "").trim(),
    muscle_group: String(form.get("muscle_group") || "Otro"),
    category: String(form.get("category") || "Hipertrofia"),
    equipment: String(form.get("equipment") || "").trim(),
    image_url: String(form.get("image_url") || "").trim() || null,
    video_url: String(form.get("video_url") || "").trim() || null,
    default_sets: Math.max(1, Number(form.get("default_sets") || 3)),
    default_reps: String(form.get("default_reps") || "8-12").trim(),
    rest_seconds: Math.max(0, Number(form.get("rest_seconds") || 60)),
    notes: String(form.get("notes") || "").trim(),
  };
}

function ExerciseForm({ exercise, onSubmit, busy }) {
  return <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
    <label className="sm:col-span-2 text-sm font-bold text-slate-600">Nombre<input name="name" required defaultValue={exercise?.name || ""} className={input} /></label>
    <label className="text-sm font-bold text-slate-600">Grupo muscular<select name="muscle_group" defaultValue={exercise?.muscle_group || "Pecho"} className={input}>{MUSCLE_GROUPS.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label className="text-sm font-bold text-slate-600">Categoría<select name="category" defaultValue={exercise?.category || "Hipertrofia"} className={input}>{EXERCISE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label className="sm:col-span-2 text-sm font-bold text-slate-600">Equipamiento<input name="equipment" defaultValue={exercise?.equipment || ""} placeholder="Mancuernas, barra, máquina…" className={input} /></label>
    <label className="sm:col-span-2 text-sm font-bold text-slate-600">URL imagen<input name="image_url" type="url" defaultValue={exercise?.image_url || ""} placeholder="https://…" className={input} /></label>
    <label className="sm:col-span-2 text-sm font-bold text-slate-600">URL video<input name="video_url" type="url" defaultValue={exercise?.video_url || ""} placeholder="YouTube, Vimeo o video directo" className={input} /></label>
    <label className="text-sm font-bold text-slate-600">Series<input name="default_sets" type="number" min="1" max="20" defaultValue={exercise?.default_sets || 3} className={input} /></label>
    <label className="text-sm font-bold text-slate-600">Repeticiones<input name="default_reps" defaultValue={exercise?.default_reps || "8-12"} className={input} /></label>
    <label className="sm:col-span-2 text-sm font-bold text-slate-600">Descanso (segundos)<input name="rest_seconds" type="number" min="0" max="1800" step="5" defaultValue={exercise?.rest_seconds ?? 60} className={input} /></label>
    <label className="sm:col-span-2 text-sm font-bold text-slate-600">Notas<textarea name="notes" rows="3" defaultValue={exercise?.notes || ""} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20" /></label>
    <button disabled={busy} className="btn-primary sm:col-span-2 disabled:opacity-60">{busy ? "Guardando…" : exercise ? "Guardar cambios" : "Crear ejercicio"}</button>
  </form>;
}

export default function Exercises() {
  const { user, role } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const isManager = ["admin", "coadmin"].includes(role);

  const load = async () => {
    setLoading(true); setError("");
    const result = await listExercises();
    if (result.error) setError(result.error.message || `No se pudo cargar la biblioteca. Verificá ${migrationName}.`);
    else setExercises(result.exercises);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => exercises.filter((exercise) => {
    if (group !== "Todos" && exercise.muscle_group !== group) return false;
    const text = `${exercise.name} ${exercise.muscle_group} ${exercise.category} ${exercise.equipment || ""}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [exercises, group, query]);

  const submitCreate = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const result = await createExercise(normalizePayload(new FormData(event.currentTarget)));
    if (result.error) setError(result.error.message || "No se pudo crear el ejercicio.");
    else { setCreating(false); setMessage("Ejercicio personalizado creado."); await load(); }
    setBusy(false);
  };

  const submitEdit = async (event) => {
    event.preventDefault(); if (!editing) return;
    setBusy(true); setError(""); setMessage("");
    const result = await updateExercise(editing.id, normalizePayload(new FormData(event.currentTarget)));
    if (result.error) setError(result.error.message || "No se pudo actualizar el ejercicio.");
    else { setEditing(null); setMessage("Ejercicio actualizado."); await load(); }
    setBusy(false);
  };

  const remove = async (exercise) => {
    if (!window.confirm(`¿Eliminar ${exercise.name}?`)) return;
    setBusy(true); setError(""); setMessage("");
    const result = await deleteExercise(exercise.id);
    if (!result.ok) setError(result.error?.message || "No se pudo eliminar el ejercicio.");
    else { setMessage("Ejercicio eliminado."); await load(); }
    setBusy(false);
  };

  const canEdit = (exercise) => isManager || (!exercise.is_system && exercise.created_by === user?.id);

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">V.1.04</p><h1 className="page-title">Biblioteca de ejercicios</h1><p className="page-subtitle">Ejercicios base y personalizados con grupos musculares, multimedia, series, repeticiones y descanso.</p></div><div className="flex gap-2"><button onClick={load} disabled={loading} className="btn-secondary"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button><button onClick={() => setCreating(true)} className="btn-primary"><Plus className="size-4" /> Nuevo ejercicio</button></div></section>

    {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><p className="font-black">Biblioteca no disponible</p><p className="mt-1 leading-6">{error}</p><code className="mt-2 block text-xs font-bold">{migrationName}</code></div>}

    <section className="panel">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]"><label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-[#E30613]/15"><Search className="size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Buscar ejercicio, categoría o equipamiento" /></label><select value={group} onChange={(event) => setGroup(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black"><option>Todos</option>{MUSCLE_GROUPS.map((item) => <option key={item}>{item}</option>)}</select></div>
    </section>

    {!error && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((exercise) => <article key={exercise.id} className="overflow-hidden rounded-[24px] border border-black/8 bg-white shadow-sm">
      <div className="relative aspect-[16/8] bg-slate-100">{exercise.image_url ? <img src={exercise.image_url} alt={exercise.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center text-slate-300"><ImageIcon className="size-10" /></div>}<span className="absolute left-3 top-3 rounded-full bg-black/80 px-2.5 py-1 text-[10px] font-black uppercase text-white">{exercise.is_system ? "Base" : "Personalizado"}</span></div>
      <div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-[#E30613]">{exercise.muscle_group} · {exercise.category}</p><h2 className="mt-1 text-xl font-black text-[#050505]">{exercise.name}</h2><p className="mt-1 text-xs text-slate-400">{exercise.equipment || "Sin equipamiento específico"}</p></div><Dumbbell className="size-5 shrink-0 text-slate-300" /></div>
        <div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-50 p-2.5 text-center"><p className="text-[10px] font-black uppercase text-slate-400">Series</p><p className="mt-1 font-black">{exercise.default_sets}</p></div><div className="rounded-xl bg-slate-50 p-2.5 text-center"><p className="text-[10px] font-black uppercase text-slate-400">Reps</p><p className="mt-1 font-black">{exercise.default_reps}</p></div><div className="rounded-xl bg-slate-50 p-2.5 text-center"><p className="text-[10px] font-black uppercase text-slate-400">Descanso</p><p className="mt-1 font-black">{exercise.rest_seconds}s</p></div></div>
        {exercise.notes && <p className="mt-4 line-clamp-2 text-xs leading-5 text-slate-500">{exercise.notes}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">{exercise.video_url && <a href={exercise.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"><Video className="size-3.5" /> Video <ExternalLink className="size-3" /></a>}{canEdit(exercise) && <button onClick={() => setEditing(exercise)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"><Pencil className="size-3.5" /> Editar</button>}{canEdit(exercise) && !exercise.is_system && <button onClick={() => remove(exercise)} disabled={busy} className="ml-auto grid size-9 place-items-center rounded-xl bg-red-50 text-[#9E0710] disabled:opacity-50"><Trash2 className="size-4" /></button>}</div>
      </div>
    </article>)}{!loading && !visible.length && <div className="panel md:col-span-2 xl:col-span-3"><p className="py-8 text-center text-sm text-slate-400">No hay ejercicios que coincidan con los filtros.</p></div>}</section>}

    <FormDialog open={creating} onOpenChange={(value) => setCreating(value)} title="Nuevo ejercicio" description="Se guardará como ejercicio personalizado compartido con el equipo."><ExerciseForm onSubmit={submitCreate} busy={busy} /></FormDialog>
    <FormDialog open={!!editing} onOpenChange={(value) => { if (!value) setEditing(null); }} title={`Editar ${editing?.name || "ejercicio"}`} description={editing?.is_system ? "Ejercicio base del gimnasio." : "Ejercicio personalizado."}><ExerciseForm exercise={editing} onSubmit={submitEdit} busy={busy} /></FormDialog>
  </div>;
}
