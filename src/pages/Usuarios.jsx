import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ShieldCheck, UserCheck, UserCog, UsersRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useGym } from "../context/GymContext";
import { listProfiles, ROLE_LABELS, setUserRoleByEmail } from "../services/roles";

const roleTone = (role) => role === "admin" ? "status-bad" : role === "coadmin" ? "status-warn" : role === "profe" ? "status-ok" : "bg-slate-100 text-slate-600";

export default function Usuarios() {
  const { user, permissions, refreshProfile } = useAuth();
  const { data } = useGym();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("todos");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    const result = await listProfiles();
    if (result.error) setError(result.error.message || "No se pudieron cargar las cuentas.");
    else setProfiles(result.profiles);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const linkedByEmail = useMemo(() => {
    const map = new Map();
    (data.people || []).forEach((person) => {
      const email = String(person.email || "").trim().toLowerCase();
      if (email) map.set(email, person);
    });
    return map;
  }, [data.people]);

  const visible = useMemo(() => profiles.filter((profile) => {
    if (filter !== "todos" && profile.role !== filter) return false;
    const text = `${profile.display_name || ""} ${profile.email || ""} ${ROLE_LABELS[profile.role] || profile.role}`.toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [profiles, query, filter]);

  const counts = useMemo(() => ({
    total: profiles.length,
    coadmin: profiles.filter((item) => item.role === "coadmin").length,
    profe: profiles.filter((item) => item.role === "profe").length,
    cliente: profiles.filter((item) => item.role === "cliente").length,
  }), [profiles]);

  const changeRole = async (profile, nextRole) => {
    if (profile.is_master || profile.role === nextRole) return;
    setSaving(profile.user_id); setError(""); setMessage("");
    const result = await setUserRoleByEmail(profile.email, nextRole);
    if (!result.ok) setError(result.error?.message || "No se pudo cambiar el rol.");
    else {
      setMessage(`${profile.email} ahora es ${ROLE_LABELS[nextRole]}. El cambio se aplica en su próximo refresco/inicio de sesión.`);
      await load();
      if (profile.user_id === user?.id) await refreshProfile(user.id);
    }
    setSaving("");
  };

  if (!permissions?.canManageRoles) return null;

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">Seguridad</p><h1 className="page-title">Usuarios y roles</h1><p className="page-subtitle">Todas las cuentas creadas en la PWA y sus permisos. Sólo existe un Admin master.</p></div><button onClick={load} disabled={loading} className="btn-secondary"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button></section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="panel"><UsersRound className="size-5 text-[#E30613]" /><p className="mt-3 text-3xl font-black">{counts.total}</p><p className="text-xs font-bold text-slate-500">Cuentas registradas</p></div>
      <div className="panel"><ShieldCheck className="size-5 text-amber-600" /><p className="mt-3 text-3xl font-black">{counts.coadmin}</p><p className="text-xs font-bold text-slate-500">Coadmins</p></div>
      <div className="panel"><UserCog className="size-5 text-emerald-600" /><p className="mt-3 text-3xl font-black">{counts.profe}</p><p className="text-xs font-bold text-slate-500">Profes</p></div>
      <div className="panel"><UserCheck className="size-5 text-slate-500" /><p className="mt-3 text-3xl font-black">{counts.cliente}</p><p className="text-xs font-bold text-slate-500">Clientes</p></div>
    </section>

    <section className="panel">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-[#E30613]/15"><Search className="size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Buscar por nombre, email o rol" /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black outline-none"><option value="todos">Todos los roles</option><option value="admin">Admin master</option><option value="coadmin">Coadmin</option><option value="profe">Profe</option><option value="cliente">Cliente</option></select>
      </div>
      {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}

      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[940px] text-left"><thead><tr className="table-head"><th>Cuenta</th><th>Rol</th><th>Vínculo gimnasio</th><th>Registro</th><th className="text-right">Permisos</th></tr></thead><tbody className="divide-y divide-slate-100">
        {visible.map((profile) => {
          const linked = linkedByEmail.get(String(profile.email || "").toLowerCase());
          return <tr key={profile.user_id}>
            <td className="py-4"><p className="font-bold text-slate-800">{profile.display_name || profile.email.split("@")[0]} {profile.is_master && <span className="ml-2 rounded-full bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-[#E30613]">Master</span>}</p><p className="text-xs text-slate-400">{profile.email}</p></td>
            <td><span className={`status ${roleTone(profile.role)}`}>{ROLE_LABELS[profile.role] || profile.role}</span></td>
            <td>{linked ? <div><p className="text-sm font-bold text-slate-700">{linked.name}</p><p className="text-xs text-emerald-600">Vinculado como {linked.role}</p></div> : <span className="text-xs font-bold text-slate-400">Sin ficha vinculada</span>}</td>
            <td className="text-sm text-slate-500">{new Date(profile.created_at).toLocaleDateString("es-AR")}</td>
            <td className="text-right">{profile.is_master ? <span className="text-xs font-bold text-slate-400">Protegido</span> : <select value={profile.role} onChange={(event) => changeRole(profile, event.target.value)} disabled={saving === profile.user_id} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black outline-none disabled:opacity-50"><option value="cliente">Cliente</option><option value="profe">Profe</option><option value="coadmin">Coadmin</option></select>}</td>
          </tr>;
        })}
      </tbody></table>{!visible.length && !loading && <p className="py-10 text-center text-sm text-slate-400">No hay cuentas que coincidan con el filtro.</p>}</div>
      <p className="mt-4 text-xs leading-5 text-slate-400">Para que un Cliente o Profe vea su ficha personal, cargá el mismo email de su cuenta PWA en Clientes o Personal.</p>
    </section>
  </div>;
}
