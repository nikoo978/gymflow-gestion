import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { MUSCLE_GROUPS } from "../../services/exercises";

const input = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20";

export default function RoutineEditor({ routine = null, exercises = [], onSave, busy = false, compact = false }) {
  const [title, setTitle] = useState(routine?.title || "");
  const [description, setDescription] = useState(routine?.description || "");
  const [items, setItems] = useState((routine?.items || []).map((item) => ({ ...item })));
  const [group, setGroup] = useState("Todos");
  const [exerciseId, setExerciseId] = useState("");

  const options = useMemo(() => exercises.filter((exercise) => group === "Todos" || exercise.muscle_group === group), [exercises, group]);

  const addExercise = () => {
    const exercise = exercises.find((item) => item.id === exerciseId);
    if (!exercise) return;
    setItems((current) => [...current, {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      sets: exercise.default_sets || 3,
      reps: exercise.default_reps || "8-12",
      rest_seconds: exercise.rest_seconds ?? 60,
      notes: "",
    }]);
    setExerciseId("");
  };

  const patchItem = (index, patch) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const removeItem = (index) => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const submit = (event) => {
    event.preventDefault();
    onSave?.({ id: routine?.id || null, title: title.trim(), description: description.trim(), items });
  };

  return <form onSubmit={submit} className="space-y-4">
    <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
      <label className="text-sm font-bold text-slate-600">Nombre de la rutina<input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} maxLength={100} className={`mt-1 ${input}`} placeholder="Ej. Torso A" /></label>
      <label className="text-sm font-bold text-slate-600">Descripción<input value={description} onChange={(event) => setDescription(event.target.value)} className={`mt-1 ${input}`} placeholder="Objetivo o indicaciones" /></label>
    </div>

    <section className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500">Agregar ejercicio</p>
      <div className={`mt-2 grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-[180px_1fr_auto]"}`}>
        <select value={group} onChange={(event) => { setGroup(event.target.value); setExerciseId(""); }} className={input}><option>Todos</option>{MUSCLE_GROUPS.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={exerciseId} onChange={(event) => setExerciseId(event.target.value)} className={input}><option value="">Elegir ejercicio</option>{options.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name} · {exercise.muscle_group}</option>)}</select>
        <button type="button" onClick={addExercise} disabled={!exerciseId} className="btn-secondary disabled:opacity-40"><Plus className="size-4" /> Agregar</button>
      </div>
    </section>

    <div className="space-y-2">{items.map((item, index) => <article key={`${item.exercise_id || item.exercise_name}-${index}`} className="rounded-2xl border border-black/7 bg-white p-3">
      <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-800">{index + 1}. {item.exercise_name}</p><p className="text-[11px] text-slate-400">Ajustes de esta rutina</p></div><button type="button" onClick={() => removeItem(index)} className="grid size-8 place-items-center rounded-lg bg-red-50 text-[#9E0710]"><Trash2 className="size-3.5" /></button></div>
      <div className="mt-3 grid grid-cols-3 gap-2"><label className="text-[10px] font-black uppercase text-slate-400">Series<input type="number" min="1" max="20" value={item.sets} onChange={(event) => patchItem(index, { sets: Number(event.target.value || 1) })} className={`mt-1 ${input}`} /></label><label className="text-[10px] font-black uppercase text-slate-400">Reps<input value={item.reps} onChange={(event) => patchItem(index, { reps: event.target.value })} className={`mt-1 ${input}`} /></label><label className="text-[10px] font-black uppercase text-slate-400">Descanso<input type="number" min="0" max="1800" step="5" value={item.rest_seconds} onChange={(event) => patchItem(index, { rest_seconds: Number(event.target.value || 0) })} className={`mt-1 ${input}`} /></label></div>
      <input value={item.notes || ""} onChange={(event) => patchItem(index, { notes: event.target.value })} className={`mt-2 ${input}`} placeholder="Nota opcional" />
    </article>)}{!items.length && <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Todavía no agregaste ejercicios.</p>}</div>

    <button disabled={busy || !title.trim()} className="btn-primary w-full disabled:opacity-50"><Save className="size-4" /> {busy ? "Guardando…" : "Guardar rutina"}</button>
  </form>;
}
