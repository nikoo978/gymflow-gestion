"use client";

import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { BarChart3, BellRing, Building2, CircleDollarSign, Dumbbell, Fingerprint, LayoutDashboard, UserCog, UsersRound } from "lucide-react";
import AppLayout from "./components/layout/AppLayout";
import Accesos from "./pages/Accesos";
import AccessDisplay from "./pages/AccessDisplay";
import Caja from "./pages/Caja";
import Clientes from "./pages/Clientes";
import Dashboard from "./pages/Dashboard";
import Notificaciones from "./pages/Notificaciones";
import Personal from "./pages/Personal";
import Reportes from "./pages/Reportes";

export const navigation = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Clientes", path: "/clientes", icon: UsersRound },
  { label: "Personal", path: "/personal", icon: UserCog },
  { label: "Caja", path: "/caja", icon: CircleDollarSign },
  { label: "Reportes", path: "/reportes", icon: BarChart3 },
  { label: "Accesos", path: "/accesos", icon: Fingerprint },
  { label: "Notificaciones", path: "/notificaciones", icon: BellRing },
];

export const productMeta = { name: "Infytter Fitness", icon: Dumbbell, branchIcon: Building2 };

export default function App() {
  const location = useLocation();

  if (location.pathname === "/pantalla-acceso") return <AccessDisplay />;

  return (
    <AppLayout currentPath={location.pathname}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/personal" element={<Personal />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/accesos" element={<Accesos />} />
        <Route path="/notificaciones" element={<Notificaciones />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
