"use client";

import { Bell, ChevronDown, Cloud, CloudOff, HardDrive, LogOut, Menu, RefreshCw, ShieldCheck, WifiOff, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { navigation } from "../../App";
import { useGym } from "../../context/GymContext";
import { useAuth } from "../../context/AuthContext";

function Nav({ currentPath, onNavigate, onSync }) {
  const { user, isCloud, isLocal, logout } = useAuth();
  const displayName = isLocal ? "Modo local" : (user?.user_metadata?.name || user?.email?.split("@")[0] || "Administrador");
  const subtitle = isCloud ? user?.email : "Emergencia · administrador";
  const initials = String(displayName || "GF").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return <>
    <Link to="/" onClick={onNavigate} className="block px-5 pb-5 pt-6"><img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-12 w-full object-contain object-left" /></Link>
    <p className="px-6 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#AFAFAF]">Operación</p>
    <nav className="grid gap-1.5 px-3">
      {navigation.map(({ label, path, icon: Icon }) => <Link key={path} to={path} onClick={onNavigate} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm ${currentPath === path ? "bg-[#E30613] font-black text-white" : "text-[#DADADA] hover:bg-[#282828] hover:text-white"}`}><Icon className="size-[18px]" />{label}</Link>)}
    </nav>
    <div className="m-3 mt-auto rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#E30613] text-sm font-black text-white">{initials}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{displayName}</p><p className="truncate text-xs text-[#AFAFAF]">{subtitle}</p></div>
      </div>
      <button onClick={isLocal ? onSync : logout} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/10">
        {isLocal ? <><RefreshCw className="size-3.5" /> Sincronizar ahora</> : <><LogOut className="size-3.5" /> Cerrar sesión</>}
      </button>
    </div>
  </>;
}

export default function AppLayout({ currentPath, children }) {
  const { data, setBranch, sync, pendingCount, syncPendingNow } = useGym();
  const { isCloud, isLocal, isOnline, canUseLocalMode, requestLocalMode } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const now = new Date();
  const syncIcon = isCloud && sync === "Sincronizado" ? <Cloud className="size-3.5 text-[#E30613]" /> : isLocal ? <HardDrive className="size-3.5 text-[#E30613]" /> : <CloudOff className="size-3.5 text-[#9E0710]" />;

  return <div className="min-h-svh bg-[#F5F5F5] md:flex">
    <aside className="hidden w-64 shrink-0 flex-col bg-[#050505] md:fixed md:inset-y-0 md:flex"><Nav currentPath={currentPath} onSync={syncPendingNow} /></aside>
    {mobileOpen && <div className="fixed inset-0 z-40 bg-black/55 md:hidden" onClick={() => setMobileOpen(false)}><aside className="flex h-full w-[82%] max-w-72 flex-col bg-[#050505]" onClick={(e) => e.stopPropagation()}><div className="absolute left-[calc(min(82%,18rem)-3rem)] top-4"><button onClick={() => setMobileOpen(false)} className="grid size-9 place-items-center rounded-xl bg-white text-black"><X className="size-5" /></button></div><Nav currentPath={currentPath} onNavigate={() => setMobileOpen(false)} onSync={syncPendingNow} /></aside></div>}
    <div className="min-w-0 flex-1 md:ml-64">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/8 bg-[#F5F5F5]/95 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="grid size-9 place-items-center rounded-xl border border-black/8 bg-white md:hidden"><Menu className="size-5" /></button><div className="relative"><select value={data.activeBranch} onChange={(e) => setBranch(e.target.value)} disabled={isCloud && !isOnline} className="h-10 appearance-none rounded-xl border border-black/10 bg-white pl-3 pr-9 text-sm font-black text-[#050505] disabled:opacity-50"><option value="centro">Junín</option><option value="norte">Chacabuco</option></select><ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-slate-400" /></div></div>
        <div className="flex items-center gap-2 sm:gap-3">
          {isCloud && canUseLocalMode && <button onClick={requestLocalMode} className="hidden items-center gap-1.5 rounded-full border border-black/8 bg-white px-3 py-1.5 text-[11px] font-black text-slate-600 shadow-sm md:inline-flex"><ShieldCheck className="size-3.5 text-[#E30613]" /> Modo local</button>}
          {isLocal && <button onClick={syncPendingNow} className="hidden items-center gap-1.5 rounded-full bg-[#050505] px-3 py-1.5 text-[11px] font-black text-white shadow-sm md:inline-flex"><RefreshCw className="size-3.5 text-[#E30613]" /> Sincronizar{pendingCount ? ` (${pendingCount})` : ""}</button>}
          <span className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500 shadow-sm sm:flex">{syncIcon}{sync}</span>
          <Link to="/notificaciones" className="relative grid size-10 place-items-center rounded-xl border border-black/8 bg-white text-slate-600"><Bell className="size-[18px]" /><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-[#E30613]" /></Link>
          <div className="hidden text-right sm:block"><p className="text-sm font-bold capitalize text-[#050505]">{now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })}</p><p className="text-xs text-slate-500">{isCloud ? "Cuenta cloud" : "Modo local protegido"}</p></div>
        </div>
      </header>

      {isLocal && <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-xs font-black text-[#9E0710] sm:px-6 lg:px-8">MODO LOCAL DE EMERGENCIA · {pendingCount ? `${pendingCount} movimiento${pendingCount === 1 ? "" : "s"} pendiente${pendingCount === 1 ? "" : "s"} de sincronizar.` : "Sin movimientos pendientes."}</div>}

      <main className="min-h-[calc(100svh-4rem)] p-4 sm:p-6 lg:p-8">{children}</main>

      {isCloud && !isOnline && <div className="fixed inset-x-0 bottom-0 top-16 z-30 grid place-items-center bg-[#F5F5F5]/95 p-5 backdrop-blur-md md:left-64">
        <section className="w-full max-w-md rounded-[28px] border border-black/10 bg-white p-7 text-center shadow-2xl">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><WifiOff className="size-7" /></span>
          <h2 className="mt-5 text-2xl font-black uppercase text-[#050505]">Sin Internet</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">La cuenta cloud queda en modo lectura para evitar cambios sin protección.</p>
          {canUseLocalMode ? <>
            <p className="mt-3 text-sm font-bold text-slate-700">En esta PC administrativa podés continuar con el modo local de emergencia.</p>
            <button onClick={requestLocalMode} className="btn-primary mt-5 w-full"><ShieldCheck className="size-4" /> Activar modo local</button>
          </> : <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-[#9E0710]">El modo local sólo está habilitado en PC. Esperá a que vuelva la conexión.</p>}
        </section>
      </div>}
    </div>
  </div>;
}
