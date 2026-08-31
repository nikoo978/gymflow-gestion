import { LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABELS } from "../services/roles";

export default function ClientHome() {
  const { user, profile, role, logout } = useAuth();
  const name = profile?.display_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Usuario";
  return <main className="grid min-h-svh place-items-center bg-[#F5F5F5] p-4">
    <section className="w-full max-w-lg rounded-[28px] border border-black/8 bg-white p-7 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-14 w-40 rounded-xl bg-[#050505] object-contain p-2" />
        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-[#E30613]">V.1.02</span>
      </div>
      <span className="mt-8 grid size-12 place-items-center rounded-2xl bg-[#F5F5F5] text-[#282828]"><Smartphone className="size-6" /></span>
      <h1 className="mt-5 text-3xl font-black uppercase text-[#050505]">Hola, {name}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Tu cuenta está registrada correctamente. La interfaz específica para clientes se habilitará en una próxima versión.</p>
      <div className="mt-6 rounded-2xl border border-black/8 bg-[#F5F5F5] p-4">
        <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Rol actual</p>
        <p className="mt-1 flex items-center gap-2 text-lg font-black text-[#050505]"><ShieldCheck className="size-5 text-[#E30613]" /> {ROLE_LABELS[role] || role}</p>
        <p className="mt-1 truncate text-sm text-slate-500">{user?.email}</p>
      </div>
      <button onClick={logout} className="btn-secondary mt-6 w-full"><LogOut className="size-4" /> Cerrar sesión</button>
    </section>
  </main>;
}
