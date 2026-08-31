"use client";

import { useSyncExternalStore } from "react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { GymProvider } from "./context/GymContext";

export default function SiteApp() {
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);


  if (!mounted) {
    return <div className="min-h-screen bg-[#050505]" aria-label="Cargando aplicación" />;
  }

  return (
    <BrowserRouter>
      <AuthProvider><GymProvider><App /></GymProvider></AuthProvider>
    </BrowserRouter>
  );
}
