import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Fingerprint, LogOut, RefreshCw, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { APP_VERSION } from "../App";
import { useAuth } from "../context/AuthContext";
import { getMyClientPortal } from "../services/roles";

const dateLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "—";
const daysTo = (value) => value ? Math.ceil((new Date(`${value}T23:59:59`) - new Date()) / 86400000) : null;

function statusOfMember(member) {
  const days = daysTo(member?.expiry);
  if (days === null || days < 0) return "Vencida";
  return days <= 7 ? "Por vencer" : "Vigente";
}

export default function ClientHome({ previewPortal = null, previewIdentity = null, preview = false }) {
  const { user, profile, logout } = useAuth();
  const [portal, setPortal] = useState(previewPortal);
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState("");
  const shownEmail = previewIdentity?.email || user?.email || "cliente@ejemplo.com";
  const name = previewIdentity?.name || profile?.display_name || user?.user_metadata?.name || shownEmail.split("@")[0] || "Usuario";

  const load = async () => {
    if (preview) return;
    setLoading(true); setError("");
    const result = await getMyClientPortal();
    if (result.error) setError(result.error.message || "No se pudo cargar tu ficha.");
    else setPortal(result.portal);
    setLoading(false);
  };

  useEffect(() => {
    if (preview) { setPortal(previewPortal); setLoading(false); setError(""); return; }
    load();
  }, [user?.id, preview, previewPortal]);

  const member = portal?.member;
  const accesses = portal?.accesses || [];
  const status = statusOfMember(member);
  const thisWeekDays = useMemo(() => {
    if (!member || member.plan !== "3 días") return null;
    const now = new Date();
    const start = new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    return new Set(accesses.filter((item) => item.allowed && new Date(item.date) >= start).map((item) => String(item.date).slice(0,10))).size;
  }, [member, accesses]);

  const statusTone = status === "Vigente" ? "bg-emerald-50 text-emerald-700" : status === "Por vencer" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";

  return <main className={`${preview ? "min-h-[760px]" : "min-h-svh"} bg-[#F5F5F5]`}>
    <div className="mx-auto w-full max-w-md pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-[#050505] px-4 text-white shadow-lg">
        <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-9 w-32 object-contain object-left" />
        <div className="text-right"><p className="text-[11px] font-black text-[#E30613]">{APP_VERSION}</p><p className="text-[10px] text-white/50">Mi Infytter</p></div>
      </header>

      <div className="space-y-4 p-4">
        <section className="overflow-hidden rounded-[28px] bg-[#050505] p-5 text-white shadow-xl">
          <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-[.18em] text-white/45">Mi cuenta</p><h1 className="mt-2 truncate text-2xl font-black">Hola, {name}</h1><p className="mt-1 truncate text-xs text-white/50">{shownEmail}</p></div><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#E30613]"><ShieldCheck className="size-5" /></span></div>
          {member && <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-white/40">Estado de membresía</p><p className="mt-1 text-lg font-black">{status}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-black ${statusTone}`}>{dateLabel(member.expiry)}</span></div>}
        </section>

        {loading && <div className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-bold text-slate-500 shadow-sm"><RefreshCw className="size-4 animate-spin" /> Cargando tu información…</div>}
        {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div>}

        {!loading && !error && !portal?.linked && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><UserRound className="mt-0.5 size-5 shrink-0 text-amber-700" /><div><p className="font-black text-amber-900">Falta vincular tu ficha</p><p className="mt-1 text-sm leading-6 text-amber-800">El administrador debe buscar <strong>{shownEmail}</strong> en Usuarios y vincularlo con tu ficha de Cliente.</p></div></div></div>}

        {!loading && member && <>
          <section className="grid grid-cols-2 gap-3">
            <article className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Plan</p><p className="mt-2 text-lg font-black text-slate-800">{member.plan || "—"}</p></article>
            <article className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vence</p><p className="mt-2 text-lg font-black text-slate-800">{dateLabel(member.expiry)}</p></article>
            <article className="rounded-2xl bg-white p-4 shadow-sm"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><Fingerprint className="size-3.5" /> Acceso</p><p className="mt-2 text-sm font-black text-slate-800">{member.biometricMethod || "Sin registrar"}</p><p className="mt-1 text-[11px] text-slate-400">{portal.branchName || "—"}</p></article>
            <article className="rounded-2xl bg-white p-4 shadow-sm"><p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400"><CalendarDays className="size-3.5" /> Semana</p><p className="mt-2 text-sm font-black text-slate-800">{thisWeekDays === null ? "Sin límite" : `${thisWeekDays} / 3 días`}</p><p className="mt-1 text-[11px] text-slate-400">Alta {dateLabel(member.start)}</p></article>
          </section>

          <section className="rounded-[24px] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]">Actividad</p><h2 className="mt-1 text-lg font-black text-[#050505]">Últimos accesos</h2></div>{!preview && <button onClick={load} className="grid size-9 place-items-center rounded-xl border border-black/8 text-slate-500"><RefreshCw className="size-4" /></button>}</div>
            <div className="mt-3 divide-y divide-slate-100">{accesses.slice(0, 8).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.allowed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{item.allowed ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}</span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-800">{item.allowed ? "Ingreso autorizado" : "Ingreso rechazado"}</p><p className="text-[11px] text-slate-400">{new Date(item.date).toLocaleDateString("es-AR")}</p></div></div><span className="shrink-0 text-xs font-bold text-slate-400"><Clock3 className="mr-1 inline size-3.5" />{new Date(item.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span></div>)}{!accesses.length && <p className="py-8 text-center text-sm text-slate-400">Todavía no tenés accesos registrados.</p>}</div>
          </section>
        </>}

        {!preview && <button onClick={logout} className="btn-secondary w-full"><LogOut className="size-4" /> Cerrar sesión</button>}
      </div>
    </div>
  </main>;
}
