import { useState } from "react";
import { Pencil, Plus, Trash2, UserCog, UsersRound } from "lucide-react";
import FormDialog from "../components/ui/FormDialog";
import { useGym } from "../context/GymContext";
import { useAuth } from "../context/AuthContext";

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
    <section className="page-head"><div><p className="eyebrow">Equipo</p><h1 className="page-title">Profesores</h1><p className="page-subtitle">Personal operativo. Las cuentas y roles PWA se administran desde Usuarios.</p></div>{permissions?.canOperate && <button onClick={() => { setError(""); setOpen(true); }} className="btn-primary"><Plus className="size-4" /> Nuevo profesor</button>}</section>
    <section><div className="mb-4 flex items-center gap-2"><UsersRound className="size-5 text-[#E30613]" /><h2 className="section-title">Profesores registrados en la sede</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {staff.map((person) => <article key={person.id} className="panel"><div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><UserCog className="size-6" /></span><div className="flex gap-2">{permissions?.canOperate && <button onClick={() => { setError(""); setEditing(person); }} aria-label={`Editar a ${person.name}`} className="text-slate-500"><Pencil className="size-4" /></button>}{permissions?.canDelete && <button onClick={() => remove(person)} aria-label={`Eliminar a ${person.name}`} className="text-[#9E0710]"><Trash2 className="size-4" /></button>}</div></div><h2 className="mt-5 text-lg font-black text-[#050505]">{person.name}</h2><p className="mt-1 text-sm text-slate-500">DNI {person.dni}</p><p className="mt-1 text-xs font-bold text-slate-400">Cuenta PWA: vincular desde Usuarios</p><p className="mt-2 text-xs font-bold text-slate-400">{person.biometricMethod || "Sin dato biométrico"}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="status status-ok">Acceso libre</span><span className="text-xs text-slate-400">{person.phone}</span></div></article>)}
      {!staff.length && <p className="panel text-sm text-slate-400">No hay personal en esta sede.</p>}
    </div></section>
    <FormDialog open={open} onOpenChange={(value) => { setOpen(value); setError(""); }} title="Nuevo profesor" description="Quedará habilitado sin vencimiento."><StaffForm onSubmit={submit} error={error} /></FormDialog>
    <FormDialog open={!!editing} onOpenChange={(value) => { if (!value) setEditing(null); setError(""); }} title={`Editar a ${editing?.name || ""}`} description="Actualizá sus datos y biometría."><StaffForm person={editing} onSubmit={submitEdit} error={error} /></FormDialog>
  </div>;
}
