import "./polyfills/randomUUID";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import SiteApp from "./SiteApp";
import "../app/globals.css";

// Registro temprano y no bloqueante. La pantalla de Notificaciones realiza su
// propia verificación con timeout, por lo que un fallo aquí nunca congela la UI.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.warn("No se pudo registrar el Service Worker:", error);
    });
  }, { once: true });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SiteApp />
  </StrictMode>,
);
