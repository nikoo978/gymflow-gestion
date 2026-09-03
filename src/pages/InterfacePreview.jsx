import { Eye, Smartphone, UserCog } from "lucide-react";
import { useMemo, useState } from "react";
import ProfessorLayout from "../components/layout/ProfessorLayout";
import { useGym } from "../context/GymContext";
import ClientHomeV106 from "./ClientHomeV106";
import ProfessorDashboard from "./ProfessorDashboard";

export default function InterfacePreview() {
  const { data } = useGym();
  const [view, setView] = useState("cliente");
  const clients = useMemo(() => data.people.filter((person) => person.role === "Cliente"), [data.people]);
  const professors = useMemo(() => data.people.filter((person) => person.role === "Profesor"), [data.people]);
  const [clientId, setClientId] = useState("");
  const [professorId, setProfessorId] = useState("");
  const client = clients.find((item) => item.id === clientId) || clients[0] || null;
  const professor = professors.find((item) => item.id === professorId) || professors[0] || null;

  const portal = client ? {
    linked: true,
    member: client,
    branchName: data.branches.find((branch) => branch.id === client.branch)?.name || "—",
    accesses: data.accesses.filter((item) => item.personId === client.id).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10),
  } : { linked: false, member: null, branchName: "—", accesses: [] };

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">Control de interfaces</p><h1 className="page-title">Vista previa por rol</h1><p className="page-subtitle">Admin/Coadmin pueden revisar cómo se ven las interfaces de Profesor y Cliente sin cambiar de rol ni permisos.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"><Eye className="size-4" /> Solo lectura</span></section>

    <section className="panel"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="inline-flex rounded-xl bg-slate-100 p-1"><button onClick={() => setView("cliente")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-black ${view === "cliente" ? "bg-white text-[#E30613] shadow-sm" : "text-slate-500"}`}><Smartphone className="size-4" /> Cliente</button><button onClick={() => setView("profe")} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-black ${view === "profe" ? "bg-white text-[#E30613] shadow-sm" : "text-slate-500"}`}><UserCog className="size-4" /> Profesor</button></div>
      {view === "cliente" ? <select value={client?.id || ""} onChange={(event) => setClientId(event.target.value)} className="h-11 min-w-64 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black"><option value="">{clients.length ? "Seleccionar cliente" : "Sin clientes registrados"}</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.dni}</option>)}</select> : <select value={professor?.id || ""} onChange={(event) => setProfessorId(event.target.value)} className="h-11 min-w-64 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black"><option value="">{professors.length ? "Seleccionar profesor" : "Sin profesores registrados"}</option>{professors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
    </div></section>

    {view === "cliente" ? <div className="mx-auto max-w-[470px] overflow-hidden rounded-[34px] border-[8px] border-[#161616] bg-[#161616] shadow-2xl"><ClientHomeV106 preview previewPortal={portal} previewIdentity={{ name: client?.name || "Cliente", email: "cliente@preview.local" }} /></div> : <div className="overflow-hidden rounded-[28px] border border-black/10 bg-[#F5F5F5] shadow-xl"><ProfessorLayout preview previewProfile={{ display_name: professor?.name || "Profesor" }} currentPath="/"><ProfessorDashboard previewProfile={{ display_name: professor?.name || "Profesor" }} /></ProfessorLayout></div>}
  </div>;
}
