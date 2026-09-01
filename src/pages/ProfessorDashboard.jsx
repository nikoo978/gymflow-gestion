import { CalendarClock, Fingerprint, Search, UserCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { statusOf, useGym } from "../context/GymContext";
import { useAuth } from "../context/AuthContext";

const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "—";

export default function ProfessorDashboard({ previewProfile = null }) {
  const { data } = useGym();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const shownProfile = previewProfile || profile;
  const branch = data.activeBranch;
  const people = useMemo(() => data.people.filter((person) => person.role === "Cliente" && person.branch === branch), [data.people, branch]);
  const active = people.filter((person) => statusOf(person) !== "Vencida");
  const expiring = people.filter((person) => statusOf(person) === "Por vencer").sort((a, b) => String(a.expiry).localeCompare(String(b.expiry)));
  const accessesToday = data.accesses.filter((item) => item.branch === branch && String(item.date || "").slice(0, 10) === today());
  const filtered = people.filter((person) => `${person.name} ${person.dni}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  const personName = (id) => data.people.find((person) => person.id === id)?.name || "Acceso manual";

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">Panel profesor</p><h1 className="page-title">Hola, {shownProfile?.display_name || "Profe"}</h1><p className="page-subtitle">Alumnos, vencimientos, ejercicios y accesos. Sin caja, reportes financieros ni administración global.</p></div></section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article className="panel"><UsersRound className="size-5 text-[#E30613]" /><p className="mt-3 text-3xl font-black">{people.length}</p><p className="text-xs font-bold text-slate-500">Alumnos registrados</p></article>
      <article className="panel"><UserCheck className="size-5 text-emerald-600" /><p className="mt-3 text-3xl font-black">{active.length}</p><p className="text-xs font-bold text-slate-500">Membresías habilitadas</p></article>
      <article className="panel"><Fingerprint className="size-5 text-sky-600" /><p className="mt-3 text-3xl font-black">{accessesToday.filter((item) => item.allowed).length}</p><p className="text-xs font-bold text-slate-500">Ingresos hoy</p></article>
      <article className="panel"><CalendarClock className="size-5 text-amber-600" /><p className="mt-3 text-3xl font-black">{expiring.length}</p><p className="text-xs font-bold text-slate-500">Cuotas por vencer</p></article>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.45fr_.85fr]">
      <div className="panel"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="section-title">Alumnos</h2><p className="mt-1 text-xs text-slate-500">Consulta operativa. Los datos financieros permanecen ocultos.</p></div><label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3"><Search className="size-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="bg-transparent text-sm outline-none" placeholder="Nombre o DNI" /></label></div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">{filtered.map((person) => { const status = statusOf(person); return <article key={person.id} className="rounded-2xl border border-black/7 bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-800">{person.name}</p><p className="mt-1 text-xs text-slate-400">DNI {person.dni} · {person.plan}</p></div><span className={`status ${status === "Vigente" ? "status-ok" : status === "Por vencer" ? "status-warn" : "status-bad"}`}>{status}</span></div><p className="mt-3 text-xs font-bold text-slate-500">Vence {dateLabel(person.expiry)}</p></article>; })}{!filtered.length && <p className="text-sm text-slate-400">No hay alumnos para mostrar.</p>}</div>
      </div>

      <div className="space-y-6"><section className="panel"><h2 className="section-title">Próximos vencimientos</h2><div className="mt-4 space-y-2">{expiring.slice(0, 6).map((person) => <div key={person.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-3"><div><p className="text-sm font-black text-slate-800">{person.name}</p><p className="text-xs text-slate-500">{person.plan}</p></div><span className="text-xs font-black text-amber-700">{dateLabel(person.expiry)}</span></div>)}{!expiring.length && <p className="py-5 text-center text-sm text-slate-400">Sin vencimientos cercanos.</p>}</div></section>
      <section className="panel"><h2 className="section-title">Actividad de hoy</h2><div className="mt-4 space-y-2">{accessesToday.slice(0, 7).map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border border-black/6 px-3 py-3"><div><p className="text-sm font-bold text-slate-800">{personName(item.personId)}</p><p className="text-xs text-slate-400">{new Date(item.date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p></div><span className={`status ${item.allowed ? "status-ok" : "status-bad"}`}>{item.allowed ? "Permitido" : "Rechazado"}</span></div>)}{!accessesToday.length && <p className="py-5 text-center text-sm text-slate-400">Todavía no hubo accesos hoy.</p>}</div></section></div>
    </section>
  </div>;
}
