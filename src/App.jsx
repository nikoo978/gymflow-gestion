"use client";

import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { BarChart3, BellRing, Building2, CircleDollarSign, Dumbbell, Fingerprint, LayoutDashboard, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import AppLayout from "./components/layout/AppLayout";
import Accesos from "./pages/Accesos";
import AccessDisplay from "./pages/AccessDisplay";
import Caja from "./pages/Caja";
import ClientHome from "./pages/ClientHome";
import Clientes from "./pages/Clientes";
import Dashboard from "./pages/Dashboard";
import Notificaciones from "./pages/Notificaciones";
import Personal from "./pages/Personal";
import ProfessorDashboard from "./pages/ProfessorDashboard";
import Reportes from "./pages/Reportes";
import Usuarios from "./pages/Usuarios";
import { useAuth } from "./context/AuthContext";

export const APP_VERSION = "V.1.03.1";
export const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["admin", "coadmin", "profe"] },
  { label: "Clientes", path: "/clientes", icon: UsersRound, roles: ["admin", "coadmin", "profe"] },
  { label: "Personal", path: "/personal", icon: UserCog, roles: ["admin", "coadmin"] },
  { label: "Usuarios", path: "/usuarios", icon: ShieldCheck, roles: ["admin", "coadmin"] },
  { label: "Caja", path: "/caja", icon: CircleDollarSign, roles: ["admin", "coadmin"] },
  { label: "Reportes", path: "/reportes", icon: BarChart3, roles: ["admin", "coadmin"] },
  { label: "Accesos", path: "/accesos", icon: Fingerprint, roles: ["admin", "coadmin", "profe"] },
  { label: "Notificaciones", path: "/notificaciones", icon: BellRing, roles: ["admin", "coadmin"] },
];

export const productMeta = { name: "Infytter Fitness", icon: Dumbbell, branchIcon: Building2 };

export default function App() {
  const location = useLocation();
  const { role } = useAuth();
  if (location.pathname === "/pantalla-acceso") return <AccessDisplay />;
  if (role === "cliente") return <ClientHome />;
  const allowed = (path) => navigation.find((item) => item.path === path)?.roles.includes(role);
  const fallback = "/";
  return (
    <AppLayout currentPath={location.pathname}>
      <Routes>
        <Route path="/" element={role === "profe" ? <ProfessorDashboard /> : <Dashboard />} />
        <Route path="/clientes" element={allowed("/clientes") ? <Clientes /> : <Navigate to={fallback} replace />} />
        <Route path="/personal" element={allowed("/personal") ? <Personal /> : <Navigate to={fallback} replace />} />
        <Route path="/usuarios" element={allowed("/usuarios") ? <Usuarios /> : <Navigate to={fallback} replace />} />
        <Route path="/caja" element={allowed("/caja") ? <Caja /> : <Navigate to={fallback} replace />} />
        <Route path="/reportes" element={allowed("/reportes") ? <Reportes /> : <Navigate to={fallback} replace />} />
        <Route path="/accesos" element={allowed("/accesos") ? <Accesos /> : <Navigate to={fallback} replace />} />
        <Route path="/notificaciones" element={allowed("/notificaciones") ? <Notificaciones /> : <Navigate to={fallback} replace />} />
        <Route path="*" element={<Navigate to={fallback} replace />} />
      </Routes>
    </AppLayout>
  );
}
