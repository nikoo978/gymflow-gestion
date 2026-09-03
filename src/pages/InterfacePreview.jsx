import { ChevronRight, Eye, Smartphone, UserCog, X } from "lucide-react";
import { useMemo, useState } from "react";
import ExerciseCatalog from "../components/exercises/ExerciseCatalog";
import ProfessorLayout from "../components/layout/ProfessorLayout";
import { statusOf, useGym } from "../context/GymContext";
import ClientHomeV106 from "./ClientHomeV106";
import ProfessorDashboard from "./ProfessorDashboard";
import ProfessorProgress from "./ProfessorProgress";
import Routines from "./Routines";

const professorPaths = new Set(["/", "/clientes", "/progreso", "/ejercicios", "/rutinas"]);

function ProfessorClientsPreview() {
  const { data } = useGym();
  const [query, setQuery] = useState("");
  const clients = useMemo(() => (data.people || [])
    .filter((person) => person.role === "Cliente" && person.branch === data.activeBranch)
    .filter((person) => `${person.name} ${person.dni}`.toLowerCase().includes(query.trim().toLowerCase())), [data.people, data.activeBranch, query]);

  return <div className="mx-auto max-w-[1480px] space-y-4 sm:space-y-6">
    <section className="page-head"><div><p className="eyebrow">Personas</p><h1 className="page-title">Alumnos</h1><p className="page-subtitle">Alumnos, planes y vencimientos de la sucursal activa.</p></div></section>
    <section className="panel p-3.5 sm:p-5">
      <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 focus-within:ring-2 focus-within:ring-[#E30613]/15"><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 w-full bg-transparent text-sm outline-none" placeholder="Buscar por nombre o DNI" /></label>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{clients.map((person) => { const status = statusOf(person); return <article key={person.id} className="rounded-2xl border border-black/7 bg-white p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-black text-slate-800">{person.name}</p><p className="mt-1 text-xs font-bold text-slate-400">DNI {person.dni || "—"} · {person.plan || "Sin plan"}</p></div><span className={`status shrink-0 ${status === "Vigente" ? "status-ok" : status === "Por vencer" ? "status-warn" : "status-bad"}`}>{status}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] font-black uppercase text-slate-400">Vencimiento</p><p className="mt-1 text-xs font-black text-slate-700">{person.expiry ? new Date(`${person.expiry}T12:00:00`).toLocaleDateString("es-AR") : "—"}</p></div><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] font-black uppercase text-slate-400">Biometría</p><p className="mt-1 break-words text-xs font-black text-slate-700">{person.biometricMethod || "Sin registrar"}</p></div></div><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Solo lectura</p></article>; })}{!clients.length && <p className="py-10 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">No hay alumnos para mostrar.</p>}</div>
    </section>
  </div>;
}

function PreviewClose({ onClose }) {
  return <button type="button" onClick={onClose} aria-label="Cerrar vista previa" title="Cerrar vista previa" className="fixed z-[130] grid size-12 place-items-center rounded-full border border-black/10 bg-white text-[#050505] shadow-2xl transition active:scale-95" style={{ top: "max(12px, env(safe-area-inset-top))", right: "max(12px, env(safe-area-inset-right))" }}><X className="size-6" /></button>;
}

export default function InterfacePreview() {
  const { data } = useGym();
  const [previewRole, setPreviewRole] = useState("");
  const [professorPath, setProfessorPath] = useState("/");
  const clients = useMemo(() => data.people.filter((person) => person.role === "Cliente"), [data.people]);
  const professors = useMemo(() => data.people.filter((person) => person.role === "Profesor"), [data.people]);
  const client = clients[0] || null;
  const professor = professors[0] || null;

  const portal = client ? {
    linked: true,
    member: client,
    branchName: data.branches.find((branch) => branch.id === client.branch)?.name || "—",
    accesses: data.accesses.filter((item) => item.personId === client.id).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10),
  } : { linked: false, member: null, branchName: "—", accesses: [] };

  const closePreview = () => { setPreviewRole(""); setProfessorPath("/"); };
  const navigateProfessor = (path) => { if (professorPaths.has(path)) setProfessorPath(path); };

  const professorContent = (() => {
    if (professorPath === "/clientes") return <ProfessorClientsPreview />;
    if (professorPath === "/progreso") return <div className="pointer-events-none select-none"><ProfessorProgress /></div>;
    if (professorPath === "/ejercicios") return <ExerciseCatalog />;
    if (professorPath === "/rutinas") return <div className="pointer-events-none select-none"><Routines /></div>;
    return <div onClickCapture={(event) => { const link = event.target.closest?.("a[href]"); if (!link) return; event.preventDefault(); navigateProfessor(link.getAttribute("href")); }}><ProfessorDashboard previewProfile={{ display_name: professor?.name || "Profesor" }} /></div>;
  })();

  if (previewRole === "cliente") return <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#F5F5F5]"><PreviewClose onClose={closePreview} /><ClientHomeV106 preview previewPortal={portal} previewIdentity={{ name: client?.name || "Cliente", email: "cliente@preview.local" }} /></div>;

  if (previewRole === "profe") return <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#F5F5F5]"><PreviewClose onClose={closePreview} /><ProfessorLayout preview previewProfile={{ display_name: professor?.name || "Profesor" }} currentPath={professorPath} onPreviewNavigate={navigateProfessor}>{professorContent}</ProfessorLayout></div>;

  return <div className="mx-auto max-w-[1100px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">Control de interfaces</p><h1 className="page-title">Vista previa</h1><p className="page-subtitle">Elegí un rol. La administración desaparece temporalmente y vas a ver el interfaz tal como lo ve ese usuario. La X superior devuelve al panel Admin.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"><Eye className="size-4" /> Solo lectura</span></section>

    <section className="grid gap-4 md:grid-cols-2">
      <button type="button" onClick={() => setPreviewRole("profe")} className="group rounded-[28px] border border-black/8 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[.99] sm:p-8"><div className="flex items-start justify-between gap-5"><span className="grid size-14 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><UserCog className="size-7" /></span><ChevronRight className="size-6 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#E30613]" /></div><p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-[#E30613]">Vista completa</p><h2 className="mt-2 text-2xl font-black text-[#050505]">Profesor</h2><p className="mt-2 text-sm leading-6 text-slate-500">Inicio, alumnos, progreso, ejercicios y rutinas con la misma navegación responsive del profesor.</p></button>
      <button type="button" onClick={() => setPreviewRole("cliente")} className="group rounded-[28px] border border-black/8 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[.99] sm:p-8"><div className="flex items-start justify-between gap-5"><span className="grid size-14 place-items-center rounded-2xl bg-slate-950 text-white"><Smartphone className="size-7" /></span><ChevronRight className="size-6 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#E30613]" /></div><p className="mt-6 text-xs font-black uppercase tracking-[.18em] text-[#E30613]">Vista completa</p><h2 className="mt-2 text-2xl font-black text-[#050505]">Cliente</h2><p className="mt-2 text-sm leading-6 text-slate-500">Inicio, progreso, ejercicios y rutinas dentro del mismo formato móvil que utiliza el cliente.</p></button>
    </section>
  </div>;
}
