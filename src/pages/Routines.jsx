import { ClipboardList, Edit3, Plus, RefreshCw, Send, UserRoundSearch, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import RoutineEditor from "../components/routines/RoutineEditor";
import FormDialog from "../components/ui/FormDialog";
import { listExercises } from "../services/exercises";
import { assignProfessorRoutine, getClientRoutinesForProfessor, listProfessorRoutines, listRoutineClients, saveProfessorRoutine } from "../services/routines";

export default function Routines() {
  const [routines, setRoutines] = useState([]);
  const [clients, setClients] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientRoutines, setClientRoutines] = useState([]);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [assignSelection, setAssignSelection] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    const [routineResult, clientResult, exerciseResult] = await Promise.all([listProfessorRoutines(), listRoutineClients(), listExercises()]);
    if (routineResult.error) setError(routineResult.error.message || "No se pudieron cargar las rutinas.");
    else setRoutines(routineResult.routines);
    if (clientResult.error) setError((current) => current || clientResult.error.message || "No se pudieron cargar los clientes.");
    else setClients(clientResult.clients);
    if (!exerciseResult.error) setExercises(exerciseResult.exercises);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectedClient = clients.find((client) => client.user_id === selectedClientId) || null;
  const clientName = selectedClient?.display_name || selectedClient?.email || "Cliente";
  const clientById = useMemo(() => new Map(clients.map((client) => [client.user_id, client])), [clients]);

  const loadClient = async (userId) => {
    setSelectedClientId(userId); setClientRoutines([]); setError("");
    if (!userId) return;
    const result = await getClientRoutinesForProfessor(userId);
    if (result.error) setError(result.error.message || "No se pudieron cargar las rutinas del cliente.");
    else setClientRoutines(result.routines);
  };

  const save = async (routine) => {
    setBusy(true); setError(""); setMessage("");
    const result = await saveProfessorRoutine(routine);
    if (result.error) setError(result.error.message || "No se pudo guardar la rutina.");
    else {
      setCreating(false); setEditing(null); setMessage("Rutina guardada."); await load();
      if (selectedClientId) await loadClient(selectedClientId);
    }
    setBusy(false);
  };

  const openAssign = (routine) => {
    setAssigning(routine);
    setAssignSelection((routine.assignedUserIds || []).map(String));
  };

  const assign = async () => {
    if (!assigning) return;
    const existing = new Set((assigning.assignedUserIds || []).map(String));
    const additions = assignSelection.filter((id) => !existing.has(String(id)));
    if (!additions.length) { setAssigning(null); return; }
    setBusy(true); setError(""); setMessage("");
    const result = await assignProfessorRoutine(assigning.id, additions);
    if (result.error) setError(result.error.message || "No se pudo asignar la rutina.");
    else { setMessage(`Rutina enviada a ${result.added} cliente${result.added === 1 ? "" : "s"}.`); setAssigning(null); await load(); if (selectedClientId) await loadClient(selectedClientId); }
    setBusy(false);
  };

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">V.1.05</p><h1 className="page-title">Rutinas</h1><p className="page-subtitle">Armá rutinas y envialas a uno o varios clientes. Una vez enviadas, permanecen en su cuenta hasta que el propio cliente las elimine.</p></div><div className="flex gap-2"><button onClick={load} disabled={loading} className="btn-secondary"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button><button onClick={() => setCreating(true)} className="btn-primary"><Plus className="size-4" /> Nueva rutina</button></div></section>

    {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

    <section className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <div className="panel"><div className="flex items-center justify-between gap-3"><div><h2 className="section-title">Mis rutinas</h2><p className="mt-1 text-xs text-slate-500">Editar una rutina actualiza la versión que ven todos los clientes que ya la recibieron.</p></div><ClipboardList className="size-5 text-[#E30613]" /></div>
        <div className="mt-4 space-y-3">{routines.map((routine) => <article key={routine.id} className="rounded-2xl border border-black/7 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-800">{routine.title}</p><p className="mt-1 text-xs text-slate-400">{routine.items?.length || 0} ejercicios · {(routine.assignedUserIds || []).length} clientes</p></div><div className="flex gap-2"><button onClick={() => setEditing(routine)} className="btn-secondary px-3"><Edit3 className="size-4" /> Editar</button><button onClick={() => openAssign(routine)} className="btn-primary px-3"><Send className="size-4" /> Enviar</button></div></div>{routine.description && <p className="mt-3 text-sm text-slate-500">{routine.description}</p>}<div className="mt-3 flex flex-wrap gap-2">{(routine.assignedUserIds || []).slice(0, 6).map((id) => <span key={id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{clientById.get(String(id))?.display_name || clientById.get(String(id))?.email || "Cliente"}</span>)}</div></article>)}{!loading && !routines.length && <p className="py-8 text-center text-sm text-slate-400">Todavía no creaste rutinas.</p>}</div>
      </div>

      <div className="panel"><div className="flex items-center gap-2"><UserRoundSearch className="size-5 text-[#E30613]" /><div><h2 className="section-title">Ver por cliente</h2><p className="text-xs text-slate-500">Elegí un cliente para revisar las rutinas de profesor que tiene activas.</p></div></div>
        <select value={selectedClientId} onChange={(event) => loadClient(event.target.value)} className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-black"><option value="">Seleccionar cliente</option>{clients.map((client) => <option key={client.user_id} value={client.user_id}>{client.display_name || client.email} · DNI {client.dni || "—"}</option>)}</select>
        {selectedClient && <div className="mt-4 space-y-3"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Rutinas de {clientName}</p>{clientRoutines.map((routine) => <article key={routine.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-800">{routine.title}</p><p className="text-xs text-slate-400">{routine.items?.length || 0} ejercicios</p></div>{routine.canEdit && <button onClick={() => setEditing(routine)} className="grid size-9 place-items-center rounded-xl bg-white text-slate-600 shadow-sm"><Edit3 className="size-4" /></button>}</div></article>)}{!clientRoutines.length && <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">Este cliente todavía no recibió rutinas.</p>}</div>}
      </div>
    </section>

    <FormDialog open={creating} onOpenChange={setCreating} title="Nueva rutina" description="Elegí ejercicios del glosario y configurá series, repeticiones y descanso."><RoutineEditor exercises={exercises} onSave={save} busy={busy} /></FormDialog>
    <FormDialog open={!!editing} onOpenChange={(value) => { if (!value) setEditing(null); }} title={`Editar ${editing?.title || "rutina"}`} description="Los cambios se reflejan para todos los clientes que ya recibieron esta rutina.">{editing && <RoutineEditor routine={editing} exercises={exercises} onSave={save} busy={busy} />}</FormDialog>
    <FormDialog open={!!assigning} onOpenChange={(value) => { if (!value) setAssigning(null); }} title={`Enviar ${assigning?.title || "rutina"}`} description="Podés agregar uno o varios clientes. Los vínculos existentes no se quitan desde Profesor."><div className="max-h-[420px] space-y-2 overflow-y-auto">{clients.map((client) => { const checked = assignSelection.includes(String(client.user_id)); const locked = (assigning?.assignedUserIds || []).map(String).includes(String(client.user_id)); return <label key={client.user_id} className="flex items-center gap-3 rounded-xl border border-black/7 p-3"><input type="checkbox" checked={checked} disabled={locked} onChange={(event) => setAssignSelection((current) => event.target.checked ? [...new Set([...current, String(client.user_id)])] : current.filter((id) => id !== String(client.user_id)))} className="size-4 accent-[#E30613]" /><div><p className="text-sm font-black text-slate-800">{client.display_name || client.email}</p><p className="text-xs text-slate-400">DNI {client.dni || "—"}{locked ? " · Ya enviada" : ""}</p></div></label>; })}{!clients.length && <p className="py-6 text-center text-sm text-slate-400">No hay clientes con cuenta PWA vinculada.</p>}</div><button onClick={assign} disabled={busy || !clients.length} className="btn-primary mt-4 w-full"><UsersRound className="size-4" /> {busy ? "Enviando…" : "Enviar a seleccionados"}</button></FormDialog>
  </div>;
}
