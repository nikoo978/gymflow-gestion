import { RefreshCw, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { listProfessorAccessPermissions, setProfessorAccessPermission } from "../services/professorAccess";

export default function ProfessorPermissions() {
  const { permissions } = useAuth();
  const [professors, setProfessors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    const result = await listProfessorAccessPermissions();
    if (result.error) setError(result.error.message || "No se pudieron cargar los permisos.");
    else setProfessors(result.professors || []);
    setLoading(false);
  };

  useEffect(() => { if (permissions?.isMaster) load(); }, [permissions?.isMaster]);

  const toggle = async (professor) => {
    const next = !professor.canGrantAccess;
    setSaving(professor.userId); setError(""); setMessage("");
    const result = await setProfessorAccessPermission(professor.userId, next);
    if (result.error) setError(result.error.message || "No se pudo actualizar el permiso.");
    else {
      setProfessors((current) => current.map((item) => item.userId === professor.userId ? { ...item, canGrantAccess: next } : item));
      setMessage(`${professor.name || professor.email}: “Permitir acceso” ${next ? "habilitado" : "deshabilitado"}.`);
    }
    setSaving("");
  };

  if (!permissions?.isMaster) return null;

  return <div className="mx-auto max-w-[1000px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">Seguridad</p><h1 className="page-title">Permisos de profesores</h1><p className="page-subtitle">El Admin Master decide qué profesores pueden ver y usar el botón “Permitir acceso”.</p></div><button onClick={load} disabled={loading} className="btn-secondary"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button></section>

    {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

    <section className="panel p-3.5 sm:p-5"><div className="space-y-3">{professors.map((professor) => <article key={professor.userId} className="flex flex-col gap-3 rounded-2xl border border-black/7 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${professor.canGrantAccess ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}><UserCog className="size-5" /></span><div className="min-w-0"><p className="truncate font-black text-slate-900">{professor.name || professor.email}</p><p className="truncate text-xs font-bold text-slate-400">{professor.email}</p><p className="mt-1 text-[11px] text-slate-400">{professor.linkedPersonId ? "Ficha vinculada" : "Sin ficha vinculada"}</p></div></div><button onClick={() => toggle(professor)} disabled={saving === professor.userId} className={`min-h-11 rounded-xl px-4 text-sm font-black transition disabled:opacity-50 ${professor.canGrantAccess ? "bg-red-50 text-[#9E0710]" : "bg-[#050505] text-white"}`}>{professor.canGrantAccess ? <><ShieldOff className="mr-1.5 inline size-4" /> Quitar permiso</> : <><ShieldCheck className="mr-1.5 inline size-4" /> Habilitar acceso</>}</button></article>)}{!loading && !professors.length && <p className="py-10 text-center text-sm text-slate-400">No hay cuentas Profesor registradas.</p>}</div></section>
  </div>;
}
