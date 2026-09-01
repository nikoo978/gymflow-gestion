import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Link2, RefreshCw, Search, ShieldCheck, Trash2, Unlink, UserCheck, UserCog, UsersRound } from "lucide-react";
import FormDialog from "../components/ui/FormDialog";
import { useAuth } from "../context/AuthContext";
import { useGym } from "../context/GymContext";
import { deleteRegisteredAccount, listProfilesPage, ROLE_LABELS, setAccountLink, setUserRoleByEmail, unlinkAccount } from "../services/roles";

const PAGE_SIZE = 50;
const roleTone = (role) => role === "admin" ? "status-bad" : role === "coadmin" ? "status-warn" : role === "profe" ? "status-ok" : "bg-slate-100 text-slate-600";

export default function Usuarios() {
  const { user, permissions, refreshProfile } = useAuth();
  const { data } = useGym();
  const [profiles, setProfiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ total: 0, unlinked: 0, profe: 0, cliente: 0 });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [linking, setLinking] = useState(null);
  const [linkQuery, setLinkQuery] = useState("");

  const load = async ({ nextPage = page, quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    const result = await listProfilesPage({ query, role: filter, limit: PAGE_SIZE, offset: nextPage * PAGE_SIZE });
    if (result.error) setError(result.error.message || "No se pudieron cargar las cuentas.");
    else {
      setProfiles(result.profiles);
      setTotal(result.total);
      if (result.counts) setCounts(result.counts);
    }
    if (!quiet) setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); load({ nextPage: 0 }); }, 250);
    return () => clearTimeout(timer);
  }, [query, filter]);

  useEffect(() => {
    const timer = setInterval(() => { load({ quiet: true }); }, 60000);
    return () => clearInterval(timer);
  }, [page, query, filter]);

  const peopleById = useMemo(() => new Map((data.people || []).map((person) => [String(person.id), person])), [data.people]);
  const branchById = useMemo(() => new Map((data.branches || []).map((branch) => [String(branch.id), branch.name])), [data.branches]);
  const linkCandidates = useMemo(() => {
    if (!linking || !["cliente", "profe"].includes(linking.role)) return [];
    const wantedRole = linking.role === "profe" ? "Profesor" : "Cliente";
    const needle = linkQuery.trim().toLowerCase();
    return (data.people || [])
      .filter((person) => person.role === wantedRole)
      .filter((person) => !needle || `${person.name || ""} ${person.dni || ""} ${person.email || ""}`.toLowerCase().includes(needle))
      .slice(0, 100);
  }, [data.people, linking, linkQuery]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goPage = (next) => {
    const bounded = Math.max(0, Math.min(next, pageCount - 1));
    setPage(bounded);
    load({ nextPage: bounded });
  };

  const changeRole = async (profile, nextRole) => {
    if (profile.is_master || profile.role === nextRole) return;
    setSaving(profile.user_id); setError(""); setMessage("");
    const result = await setUserRoleByEmail(profile.email, nextRole);
    if (!result.ok) setError(result.error?.message || "No se pudo cambiar el rol.");
    else {
      setMessage(`${profile.email} ahora es ${ROLE_LABELS[nextRole]}.`);
      await load();
      if (profile.user_id === user?.id) await refreshProfile(user.id);
    }
    setSaving("");
  };

  const changeLink = async (profile, personId) => {
    setSaving(profile.user_id); setError(""); setMessage("");
    if (!personId) {
      const result = await unlinkAccount(profile.user_id);
      if (!result.ok) setError(result.error?.message || "No se pudo desvincular la cuenta.");
      else setMessage(`${profile.email} quedó sin ficha vinculada.`);
    } else {
      const result = await setAccountLink(profile.user_id, personId, profile.role);
      if (!result.ok) setError(result.error?.message || "No se pudo vincular la cuenta. Es posible que esa ficha ya pertenezca a otra cuenta.");
      else setMessage(`${profile.email} quedó vinculado a ${result.result?.personName || "la ficha seleccionada"}.`);
    }
    await load();
    setSaving("");
    setLinking(null);
    setLinkQuery("");
  };

  const removeAccount = async (profile) => {
    if (!permissions?.isMaster || profile.is_master) return;
    const linked = profile.linked_person_id ? peopleById.get(String(profile.linked_person_id)) : null;
    const detail = linked ? `\n\nLa ficha de ${linked.name} NO se eliminará; sólo se borra la cuenta/mail PWA.` : "";
    if (!window.confirm(`¿Eliminar definitivamente la cuenta ${profile.email}?${detail}`)) return;
    setSaving(profile.user_id); setError(""); setMessage("");
    const result = await deleteRegisteredAccount(profile.user_id);
    if (!result.ok) setError(result.error?.message || "No se pudo eliminar la cuenta registrada.");
    else { setMessage(`${profile.email} fue eliminado de las cuentas registradas. La ficha del gimnasio se conservó.`); await load(); }
    setSaving("");
  };

  if (!permissions?.canManageRoles) return null;

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">Seguridad</p><h1 className="page-title">Usuarios y roles</h1><p className="page-subtitle">Directorio paginado y buscado en servidor, preparado para miles de cuentas sin renderizarlas todas a la vez.</p></div><button onClick={() => load()} disabled={loading} className="btn-secondary"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button></section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="panel"><UsersRound className="size-5 text-[#E30613]" /><p className="mt-3 text-3xl font-black">{counts.total}</p><p className="text-xs font-bold text-slate-500">Emails registrados</p></div>
      <div className="panel"><Link2 className="size-5 text-amber-600" /><p className="mt-3 text-3xl font-black">{counts.unlinked}</p><p className="text-xs font-bold text-slate-500">Pendientes de vincular</p></div>
      <div className="panel"><UserCog className="size-5 text-emerald-600" /><p className="mt-3 text-3xl font-black">{counts.profe}</p><p className="text-xs font-bold text-slate-500">Profes</p></div>
      <div className="panel"><UserCheck className="size-5 text-slate-500" /><p className="mt-3 text-3xl font-black">{counts.cliente}</p><p className="text-xs font-bold text-slate-500">Clientes</p></div>
    </section>

    <section className="panel">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-[#E30613]/15"><Search className="size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Buscar email, nombre, DNI o ficha vinculada" /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black outline-none"><option value="todos">Todos los roles</option><option value="admin">Admin master</option><option value="coadmin">Coadmin</option><option value="profe">Profe</option><option value="cliente">Cliente</option></select>
      </div>
      {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}

      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[1080px] text-left"><thead><tr className="table-head"><th>Cuenta PWA</th><th>Rol</th><th>Ficha</th><th>Registro</th><th className="text-right">Estado</th><th className="text-right">Cuenta</th></tr></thead><tbody className="divide-y divide-slate-100">
        {profiles.map((profile) => {
          const linked = profile.linked_person_id ? peopleById.get(String(profile.linked_person_id)) : null;
          return <tr key={profile.user_id}>
            <td className="py-4"><p className="font-bold text-slate-800">{profile.display_name || profile.email.split("@")[0]} {profile.is_master && <span className="ml-2 rounded-full bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-[#E30613]">Master</span>}</p><p className="text-xs font-bold text-slate-500">{profile.email}</p><p className="mt-1 text-[11px] font-bold text-slate-400">DNI {profile.dni || "Sin registrar"}</p></td>
            <td><select value={profile.role} onChange={(event) => changeRole(profile, event.target.value)} disabled={profile.is_master || saving === profile.user_id} className={`h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black outline-none disabled:opacity-60 ${profile.is_master ? "pointer-events-none" : ""}`}><option value="admin" disabled>Admin master</option><option value="cliente">Cliente</option><option value="profe">Profe</option><option value="coadmin">Coadmin</option></select></td>
            <td className="py-3">{profile.is_master ? <span className="text-xs font-bold text-slate-400">No requiere vínculo</span> : profile.role === "coadmin" ? <span className="text-xs font-bold text-slate-400">Coadmin · sin ficha personal</span> : <div><p className="text-xs font-black text-slate-700">{linked?.name || profile.linked_person_name || "Sin vincular"}</p>{linked && <p className="mt-1 text-[11px] text-slate-400">DNI {linked.dni || "—"} · {branchById.get(String(linked.branch)) || "Sin sede"}</p>}<button onClick={() => { setLinking(profile); setLinkQuery(""); }} className="mt-2 text-xs font-black text-[#E30613]">{linked ? "Cambiar vínculo" : "Vincular ficha"}</button></div>}</td>
            <td className="text-sm text-slate-500">{new Date(profile.created_at).toLocaleDateString("es-AR")}</td>
            <td className="text-right">{profile.is_master ? <span className="status status-bad">Protegido</span> : linked ? <span className="status status-ok"><Link2 className="mr-1 inline size-3" /> Vinculado</span> : profile.role === "coadmin" ? <span className={`status ${roleTone(profile.role)}`}>{ROLE_LABELS[profile.role]}</span> : <span className="status status-warn"><Unlink className="mr-1 inline size-3" /> Pendiente</span>}</td>
            <td className="text-right">{permissions?.isMaster && !profile.is_master ? <button onClick={() => removeAccount(profile)} disabled={saving === profile.user_id} className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-[#9E0710] disabled:opacity-50"><Trash2 className="size-3.5" /> Eliminar mail</button> : <span className="text-xs font-bold text-slate-300">—</span>}</td>
          </tr>;
        })}
      </tbody></table>{!profiles.length && !loading && <p className="py-10 text-center text-sm text-slate-400">No hay cuentas que coincidan con el filtro.</p>}</div>

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-slate-400">{total ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} de ${total}` : "0 resultados"}</p><div className="flex gap-2"><button onClick={() => goPage(page - 1)} disabled={page === 0 || loading} className="btn-secondary px-3 disabled:opacity-40"><ChevronLeft className="size-4" /> Anterior</button><span className="grid min-w-16 place-items-center text-xs font-black text-slate-500">{page + 1} / {pageCount}</span><button onClick={() => goPage(page + 1)} disabled={page >= pageCount - 1 || loading} className="btn-secondary px-3 disabled:opacity-40">Siguiente <ChevronRight className="size-4" /></button></div></div>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500"><ShieldCheck className="mr-1 inline size-4 text-[#E30613]" /> Eliminar mail borra la cuenta de acceso PWA y sus vínculos. La ficha de Cliente/Profesor se conserva.</div>
    </section>

    <FormDialog open={!!linking} onOpenChange={(value) => { if (!value) setLinking(null); }} title={`Vincular ${linking?.email || "cuenta"}`} description="Buscá la ficha por nombre, DNI o email. Se muestran hasta 100 coincidencias.">
      <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search className="size-4 text-slate-400" /><input autoFocus value={linkQuery} onChange={(event) => setLinkQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Nombre o DNI" /></label>
      {linking?.linked_person_id && <button onClick={() => changeLink(linking, "")} disabled={saving === linking.user_id} className="btn-secondary mt-3 w-full text-[#9E0710]"><Unlink className="size-4" /> Desvincular cuenta</button>}
      <div className="mt-3 max-h-[52dvh] space-y-2 overflow-y-auto">{linkCandidates.map((person) => <button key={person.id} onClick={() => changeLink(linking, person.id)} disabled={saving === linking?.user_id} className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/7 p-3 text-left hover:bg-slate-50 disabled:opacity-50"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{person.name}</p><p className="mt-1 text-xs text-slate-400">DNI {person.dni || "—"} · {branchById.get(String(person.branch)) || "Sin sede"}</p></div><Link2 className="size-4 shrink-0 text-[#E30613]" /></button>)}{!linkCandidates.length && <p className="py-8 text-center text-sm text-slate-400">No hay fichas que coincidan.</p>}</div>
    </FormDialog>
  </div>;
}
