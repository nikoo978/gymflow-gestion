import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Fingerprint, LogOut, RefreshCw, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getMyClientPortal, ROLE_LABELS } from "../services/roles";

const dateLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "—";
const daysTo = (value) => value ? Math.ceil((new Date(`${value}T23:59:59`) - new Date()) / 86400000) : null;

function statusOfMember(member) {
  const days = daysTo(member?.expiry);
  if (days === null || days < 0) return "Vencida";
  return days <= 7 ? "Por vencer" : "Vigente";
}

export default function ClientHome() {
  const { user, profile, role, logout } = useAuth();
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const name = profile?.display_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuario";

  const load = async () => {
    setLoading(true); setError("");
    const result = await getMyClientPortal();
    if (result.error) setError(result.error.message || "No se pudo cargar tu ficha.");
    else setPortal(result.portal);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user?.id]);

  const member = portal?.member;
  const accesses = portal?.accesses || [];
  const status = statusOfMember(member);
  const thisWeekDays = useMemo(() => {
    if (!member || member.plan !== "3 días") return null;
    const now = new Date();
    const start = new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return new Set(accesses.filter((item) => item.allowed && new Date(item.date) >= start).map((item) => String(item.date).slice(0,10))).size;
  }, [member, accesses]);

  return <main className="min-h-svh bg-[#F5F5F5] p-4 sm:p-6">
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center justify-between gap-4 rounded-2xl bg-[#050505] p-4 text-white shadow-lg"><img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-10 w-36 object-contain object-left" /><div className="text-right"><p className="text-xs font-black text-[#E30613]">V.1.03.1</p><p className="text-[11px] text-white/50">Portal cliente</p></div></header>

      <section className="rounded-[28px] border border-black/8 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="eyebrow">Mi cuenta</p><h1 className="mt-1 text-3xl font-black uppercase text-[#050505]">Hola, {name}</h1><p className="mt-2 text-sm text-slate-500">{user?.email}</p></div><span className="inline-flex self-start items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-xs font-black text-[#E30613]"><ShieldCheck className="size-4" /> {ROLE_LABELS[role] || role}</span></div>

        {loading && <div className="mt-8 flex items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500"><RefreshCw className="size-4 animate-spin" /> Cargando tu ficha…</div>}
        {error && <div className="mt-8 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        {!loading && !error && !portal?.linked && <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><UserRound className="mt-0.5 size-5 text-amber-700" /><div><p className="font-black text-amber-900">Cuenta creada, falta vincular la ficha</p><p className="mt-1 text-sm leading-6 text-amber-800">Pedile al administrador que abra Usuarios, busque <strong>{user?.email}</strong> y vincule esta cuenta con tu ficha de Cliente. No hace falta crear otra cuenta.</p></div></div></div>}

        {!loading && member && <div className="mt-8 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Estado</p><p className={`mt-2 text-lg font-black ${status === "Vigente" ? "text-emerald-700" : status === "Por vencer" ? "text-amber-700" : "text-red-700"}`}>{status}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Plan</p><p className="mt-2 text-lg font-black text-slate-800">{member.plan || "—"}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Vencimiento</p><p className="mt-2 text-lg font-black text-slate-800">{dateLabel(member.expiry)}</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-black/7 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase text-slate-400"><Fingerprint className="size-4" /> Acceso</p><p className="mt-2 font-black text-slate-800">{member.biometricMethod || "Sin registrar"}</p><p className="mt-1 text-xs text-slate-500">Sede: {portal.branchName || "—"}</p></div><div className="rounded-2xl border border-black/7 p-4"><p className="flex items-center gap-2 text-xs font-black uppercase text-slate-400"><CalendarDays className="size-4" /> Uso semanal</p><p className="mt-2 font-black text-slate-800">{thisWeekDays === null ? "Sin límite semanal" : `${thisWeekDays} de 3 días usados`}</p><p className="mt-1 text-xs text-slate-500">Alta: {dateLabel(member.start)}</p></div></div>
        </div>}
      </section>

      {member && <section className="rounded-[24px] border border-black/8 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="eyebrow">Actividad</p><h2 className="section-title">Mis últimos accesos</h2></div><button onClick={load} className="grid size-9 place-items-center rounded-xl border border-black/8 text-slate-500"><RefreshCw className="size-4" /></button></div><div className="mt-4 divide-y divide-slate-100">{accesses.slice(0, 10).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-xl ${item.allowed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{item.allowed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}</span><div><p className="text-sm font-black text-slate-800">{item.allowed ? "Ingreso autorizado" : "Ingreso rechazado"}</p><p className="text-xs text-slate-400">{new Date(item.date).toLocaleString("es-AR")}</p></div></div><span className="text-xs font-bold text-slate-400"><Clock3 className="mr-1 inline size-3.5" />{new Date(item.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span></div>)}{!accesses.length && <p className="py-8 text-center text-sm text-slate-400">Todavía no tenés accesos registrados.</p>}</div></section>}

      <button onClick={logout} className="btn-secondary w-full"><LogOut className="size-4" /> Cerrar sesión</button>
    </div>
  </main>;
}
