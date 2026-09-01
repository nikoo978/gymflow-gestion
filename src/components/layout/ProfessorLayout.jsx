"use client";

import { ClipboardList, Dumbbell, Fingerprint, LayoutDashboard, LogOut, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { APP_VERSION } from "../../App";
import { useAuth } from "../../context/AuthContext";
import { useGym } from "../../context/GymContext";

const professorNavigation = [
  { label: "Inicio", path: "/", icon: LayoutDashboard },
  { label: "Alumnos", path: "/clientes", icon: UsersRound },
  { label: "Ejercicios", path: "/ejercicios", icon: Dumbbell },
  { label: "Rutinas", path: "/rutinas", icon: ClipboardList },
  { label: "Accesos", path: "/accesos", icon: Fingerprint },
];

export default function ProfessorLayout({ currentPath = "/", children, preview = false, previewProfile = null }) {
  const { profile, logout } = useAuth();
  const { data, setBranch, sync } = useGym();
  const shownProfile = previewProfile || profile;
  const displayName = shownProfile?.display_name || "Profesor";

  const NavItem = ({ item, compact = false }) => {
    const Icon = item.icon;
    const active = currentPath === item.path;
    const classes = compact
      ? `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1.5 py-2 text-[9px] font-black ${active ? "bg-[#E30613] text-white" : "text-slate-500"}`
      : `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${active ? "bg-[#E30613] text-white" : "text-slate-600 hover:bg-slate-100"}`;
    if (preview) return <span className={classes}><Icon className="size-4" />{item.label}</span>;
    return <Link to={item.path} className={classes}><Icon className="size-4" />{item.label}</Link>;
  };

  return <div className={`${preview ? "min-h-[760px]" : "min-h-svh"} bg-[#F5F5F5]`}>
    <header className="sticky top-0 z-30 border-b border-black/8 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-9 w-28 rounded-lg bg-[#050505] object-contain px-2" />
          <div className="hidden min-w-0 sm:block"><p className="truncate text-sm font-black text-[#050505]">Panel Profesor</p><p className="text-[10px] font-bold text-slate-400">{APP_VERSION}</p></div>
        </div>
        <nav className="hidden items-center gap-1 md:flex">{professorNavigation.map((item) => <NavItem key={item.path} item={item} />)}</nav>
        <div className="flex items-center gap-2">
          <select value={data.activeBranch} onChange={(event) => !preview && setBranch(event.target.value)} disabled={preview} className="h-9 rounded-xl border border-black/10 bg-white px-2 text-xs font-black text-slate-700 disabled:opacity-70">
            {(data.branches || []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          {!preview && <button onClick={logout} className="grid size-9 place-items-center rounded-xl border border-black/10 text-slate-500" aria-label="Cerrar sesión"><LogOut className="size-4" /></button>}
        </div>
      </div>
      <div className="mx-auto hidden max-w-[1480px] items-center justify-between border-t border-black/5 px-4 py-2 text-[11px] text-slate-400 sm:flex md:hidden"><span>{displayName}</span><span>{sync}</span></div>
    </header>

    <main className="p-4 pb-24 sm:p-6 md:pb-8 lg:p-8">{children}</main>

    <nav className="fixed inset-x-3 bottom-3 z-40 flex rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl md:hidden">
      {professorNavigation.map((item) => <NavItem key={item.path} item={item} compact />)}
    </nav>
  </div>;
}
