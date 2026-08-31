import { useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UserCog, UsersRound } from "lucide-react";
import FormDialog from "../components/ui/FormDialog";
import { useGym } from "../context/GymContext";
import { useAuth } from "../context/AuthContext";
import { listProfiles, ROLE_LABELS, ROLE_OPTIONS, setUserRoleByEmail } from "../services/roles";

const field = "h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20";

function StaffForm({ person, onSubmit, error }) {
  return <form onSubmit={onSubmit} className="grid gap-4">
    <label>Nombre completo<input name="name" required defaultValue={person?.name} className={field} /></label>
    <label>DNI<input name="dni" required inputMode="numeric" pattern="[0-9]+" defaultValue={person?.dni} className={field} /></label>
    <label>Teléfono<input name="phone" defaultValue={person?.phone} className={field} /></label>
    <label>Dato biométrico<select name="biometricMethod" defaultValue={person?.biometricMethod || "Sin registrar"} className={field}><option>Sin registrar</option><option>Huella</option><option>Reconocimiento facial</option></select></label>
    {error && <p className="text-sm font-bold text-red-600">{error}</p>}
    <button className="btn-primary">Guardar profesor</button>
  </form>;
}

function AccountsAndRoles() {
  const { user, permissions, refreshProfile } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
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

  const changeRole = async (profile, role) => {
    if (profile.is_master || profile.role === role) return;
    setSaving(profile.user_id); setError(""); setMessage("");
    const result = await setUserRoleByEmail(profile.email, role);
    if (!result.ok) setError(result.error?.message || "No se pudo cambiar el rol.");
    else {
      setMessage(`${profile.email} ahora es ${ROLE_LABELS[role]}.`);
      await load();
      if (profile.user_id === user?.id) await refreshProfile(user.id);
    }
    setSaving("");
  };

  if (!permissions?.canManageRoles) return null;

  return <section className="panel">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><ShieldCheck className="size-5 text-[#E30613]" /><h2 className="section-title">Cuentas PWA y roles</h2></div><p className="mt-1 text-xs leading-5 text-slate-500">Cualquiera puede registrarse; toda cuenta nueva entra como Cliente. Sólo existe un Admin master. Admin y coadmin pueden promover cuentas a Coadmin o Profe.</p></div><button onClick={load} disabled={loading} className="btn-secondary self-start"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Actualizar</button></div>
    {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}
    <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="table-head"><th>Cuenta</th><th>Rol actual</th><th>Registro</th><th className="text-right">Cambiar rol</th></tr></thead><tbody className="divide-y divide-slate-100">{profiles.map((profile) => <tr key={profile.user_id}><td className="py-4"><p className="font-bold text-slate-800">{profile.display_name || profile.email.split("@")[0]} {profile.is_master && <span className="ml-2 rounded-full bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-[#E30613]">Master</span>}</p><p className="text-xs text-slate-400">{profile.email}</p></td><td><span className={`status ${profile.role === "admin" ? "status-bad" : profile.role === "coadmin" ? "status-warn" : "status-ok"}`}>{ROLE_LABELS[profile.role] || profile.role}</span></td><td className="text-sm text-slate-500">{new Date(profile.created_at).toLocaleDateString("es-AR")}</td><td className="text-right">{profile.is_master ? <span className="text-xs font-bold text-slate-400">Protegido</span> : <select value={profile.role} onChange={(event) => changeRole(profile, event.target.value)} disabled={saving === profile.user_id} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black outline-none disabled:opacity-50"><option value="cliente">Cliente</option>{ROLE_OPTIONS.filter((role) => role !== "cliente").map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select>}</td></tr>)}</tbody></table>{!profiles.length && !loading && <p className="py-10 text-center text-sm text-slate-400">No hay cuentas registradas.</p>}</div>
  </section>;
}

export default function Personal() {
  const { data, addPerson, editPerson, deletePerson } = useGym();
  const { permissions } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const staff = data.people.filter((person) => person.role === "Profesor" && person.branch === data.activeBranch);

  const valuesFrom = (form) => ({
    name: form.get("name").trim(),
    dni: form.get("dni").trim(),
    phone: form.get("phone").trim(),
    biometricMethod: form.get("biometricMethod"),
    biometricStatus: form.get("biometricMethod") === "Sin registrar" ? "Pendiente" : "Listo para vincular",
  });
  const submit = (event) => {
    event.preventDefault();
    const result = addPerson({ ...valuesFrom(new FormData(event.currentTarget)), role: "Profesor", plan: "Staff", price: 0 });
    if (!result.ok) { setError(result.error); return; }
    setError(""); setOpen(false);
  };
  const submitEdit = (event) => {
    event.preventDefault();
    const result = editPerson(editing.id, valuesFrom(new FormData(event.currentTarget)));
    if (!result.ok) { setError(result.error); return; }
    setError(""); setEditing(null);
  };
  const remove = (person) => { if (window.confirm(`¿Eliminar a ${person.name}?`)) deletePerson(person.id); };

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">Equipo</p><h1 className="page-title">Profesores y cuentas</h1><p className="page-subtitle">Personal operativo y permisos de acceso a la PWA.</p></div>{permissions?.canOperate && <button onClick={() => { setError(""); setOpen(true); }} className="btn-primary"><Plus className="size-4" /> Nuevo profesor</button>}</section>
    <AccountsAndRoles />
    <section><div className="mb-4 flex items-center gap-2"><UsersRound className="size-5 text-[#E30613]" /><h2 className="section-title">Profesores registrados en la sede</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {staff.map((person) => <article key={person.id} className="panel"><div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><UserCog className="size-6" /></span><div className="flex gap-2">{permissions?.canOperate && <button onClick={() => { setError(""); setEditing(person); }} aria-label={`Editar a ${person.name}`} className="text-slate-500"><Pencil className="size-4" /></button>}{permissions?.canDelete && <button onClick={() => remove(person)} aria-label={`Eliminar a ${person.name}`} className="text-[#9E0710]"><Trash2 className="size-4" /></button>}</div></div><h2 className="mt-5 text-lg font-black text-[#050505]">{person.name}</h2><p className="mt-1 text-sm text-slate-500">DNI {person.dni}</p><p className="mt-2 text-xs font-bold text-slate-400">{person.biometricMethod || "Sin dato biométrico"}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="status status-ok">Acceso libre</span><span className="text-xs text-slate-400">{person.phone}</span></div></article>)}
      {!staff.length && <p className="panel text-sm text-slate-400">No hay personal en esta sede.</p>}
    </div></section>
    <FormDialog open={open} onOpenChange={(value) => { setOpen(value); setError(""); }} title="Nuevo profesor" description="Quedará habilitado sin vencimiento."><StaffForm onSubmit={submit} error={error} /></FormDialog>
    <FormDialog open={!!editing} onOpenChange={(value) => { if (!value) setEditing(null); setError(""); }} title={`Editar a ${editing?.name || ""}`} description="Actualizá sus datos y biometría."><StaffForm person={editing} onSubmit={submitEdit} error={error} /></FormDialog>
  </div>;
}
