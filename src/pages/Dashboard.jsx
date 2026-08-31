import { ArrowUpRight, CalendarCheck2, CircleDollarSign, Clock3, UserCheck, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import MetricCard from "../components/ui/MetricCard";
import { statusOf, useGym } from "../context/GymContext";

const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
const today = () => new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const { data } = useGym();
  const people = data.people.filter((p) => p.branch === data.activeBranch);
  const tx = data.transactions.filter((t) => t.branch === data.activeBranch && t.date === today());
  const accesses = data.accesses.filter((a) => a.branch === data.activeBranch && a.date.slice(0, 10) === today());
  const revenue = tx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expiring = people.filter((p) => statusOf(p) === "Por vencer").length;
  const branchName = data.branches.find((b) => b.id === data.activeBranch)?.name;

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="eyebrow">Resumen de hoy</p><h1 className="page-title">Operación en tiempo real</h1><p className="page-subtitle">Todo bajo control en {branchName}.</p></div><Link to="/caja" className="btn-primary self-start sm:self-auto">Abrir caja <ArrowUpRight className="size-4" /></Link></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Personas activas" value={people.filter((p) => statusOf(p) !== "Vencida").length} detail={`${people.length} registradas`} icon={UsersRound} />
      <MetricCard label="Ingresos del día" value={money(revenue)} detail={`${tx.filter((t) => t.type === "income").length} pagos`} icon={CircleDollarSign} tone="red" />
      <MetricCard label="Accesos hoy" value={accesses.filter((a) => a.allowed).length} detail={`${accesses.filter((a) => !a.allowed).length} rechazados`} icon={UserCheck} tone="blue" />
      <MetricCard label="Cuotas por vencer" value={expiring} detail="Próximos 7 días" icon={CalendarCheck2} tone="orange" />
    </section>
    <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <article className="panel"><div className="flex items-center justify-between"><div><h2 className="section-title">Estado de membresías</h2><p className="text-xs text-slate-500">Distribución actual de la sede</p></div><span className="status status-ok">En vivo</span></div><div className="mt-8 grid gap-5 sm:grid-cols-3">{["Vigente", "Por vencer", "Vencida"].map((s) => { const count = people.filter((p) => statusOf(p) === s).length; return <div key={s} className="rounded-2xl bg-slate-50 p-5"><p className="text-sm font-bold text-slate-500">{s}</p><p className="mt-2 text-4xl font-black text-[#050505]">{count}</p><div className="mt-4 h-2 rounded-full bg-white"><div className={`h-full rounded-full ${s === "Vigente" ? "bg-[#282828]" : s === "Por vencer" ? "bg-[#9E0710]" : "bg-red-500"}`} style={{ width: `${people.length ? Math.max(8, count / people.length * 100) : 0}%` }} /></div></div>; })}</div></article>
      <article className="rounded-[24px] bg-[#050505] p-6 text-white"><Clock3 className="size-7 text-[#E30613]" /><p className="mt-8 text-xs font-bold uppercase tracking-[.16em] text-[#AFAFAF]">Último acceso</p>{accesses[0] ? <><p className="mt-2 text-2xl font-black">{data.people.find((p) => p.id === accesses[0].personId)?.name || "No identificado"}</p><p className="mt-2 text-sm text-[#AFAFAF]">{new Date(accesses[0].date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {accesses[0].allowed ? "Autorizado" : "Rechazado"}</p></> : <p className="mt-2 text-lg font-bold">Sin ingresos hoy</p>}<Link to="/accesos" className="mt-8 inline-flex text-sm font-black text-[#E30613]">Abrir control de acceso →</Link></article>
    </section>
  </div>;
}
