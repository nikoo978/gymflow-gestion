"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Cloud, HardDrive, KeyRound, LogIn, Mail, UserPlus } from "lucide-react";
import { supabase, supabaseConfigured } from "../services/supabase";
import { clearCloudState } from "../services/storage";
import { unlinkPushSubscriptionBeforeLogout } from "../services/notifications";

const AuthContext = createContext(null);
const MODE_KEY = "gymflow-mode";

function authMessage(error, action = "login") {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (message.includes("email not confirmed")) return "Primero confirmá tu email desde el mensaje que te envió Supabase.";
  if (message.includes("user already registered")) return "Ese email ya tiene una cuenta. Usá Ingresar.";
  if (message.includes("password") && (message.includes("least") || message.includes("characters"))) return "La contraseña debe tener al menos 8 caracteres.";
  if (message.includes("invalid email")) return "El email no es válido.";
  if (message.includes("rate limit") || error?.status === 429) return "Demasiados intentos. Esperá unos minutos y volvé a probar.";
  if (message.includes("network") || message.includes("fetch")) return "No se pudo conectar con Supabase. Revisá la conexión.";
  if (!supabaseConfigured) return "Supabase todavía no está configurado para esta versión de GymFlow.";
  if (action === "register") return "No se pudo crear la cuenta. Revisá los datos e intentá nuevamente.";
  if (action === "reset") return "No se pudo enviar el correo de recuperación.";
  if (action === "password") return "No se pudo actualizar la contraseña.";
  return "No se pudo iniciar sesión.";
}

function AuthScreen({ onLogin, onRegister, onReset, onLocal, error, notice, busy }) {
  const [view, setView] = useState("login");

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    if (view === "reset") {
      await onReset(email);
      return;
    }
    const password = String(form.get("password") || "");
    if (view === "register") await onRegister(String(form.get("name") || "").trim(), email, password);
    else await onLogin(email, password);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#050505] p-4">
      <section className="w-full max-w-md rounded-[24px] border border-white/10 bg-white p-7 shadow-2xl">
        <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-16 w-full rounded-xl bg-[#050505] object-contain p-2" />
        <h1 className="mt-6 text-3xl font-black uppercase text-[#050505]">
          {view === "register" ? "Crear cuenta" : view === "reset" ? "Recuperar acceso" : "Ingresar"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {view === "register"
            ? "Creá tu cuenta con email y contraseña. Tus datos cloud quedarán separados por usuario."
            : view === "reset"
              ? "Te enviaremos un enlace para elegir una contraseña nueva."
              : "Acceso seguro con Supabase."}
        </p>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          {view === "register" && (
            <label className="text-sm font-bold text-slate-600">Nombre
              <input name="name" required autoComplete="name" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20" />
            </label>
          )}
          <label className="text-sm font-bold text-slate-600">Email
            <input name="email" type="email" required autoComplete="email" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20" />
          </label>
          {view !== "reset" && (
            <label className="text-sm font-bold text-slate-600">Contraseña
              <input name="password" type="password" minLength="8" required autoComplete={view === "register" ? "new-password" : "current-password"} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20" />
            </label>
          )}

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</p>}
          {notice && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{notice}</p>}

          <button disabled={busy} className="btn-primary w-full disabled:opacity-60">
            {busy ? "Procesando…" : view === "register" ? <><UserPlus className="size-4" /> Crear cuenta</> : view === "reset" ? <><Mail className="size-4" /> Enviar recuperación</> : <><LogIn className="size-4" /> Ingresar</>}
          </button>
        </form>

        <div className="mt-4 grid gap-2 text-sm font-bold">
          {view !== "login" && <button disabled={busy} onClick={() => setView("login")} className="rounded-xl px-3 py-2 text-[#9E0710] hover:bg-red-50 disabled:opacity-60">Volver a ingresar</button>}
          {view === "login" && <button disabled={busy} onClick={() => setView("register")} className="rounded-xl px-3 py-2 text-[#9E0710] hover:bg-red-50 disabled:opacity-60">Crear cuenta</button>}
          {view === "login" && <button disabled={busy} onClick={() => setView("reset")} className="rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-60">Olvidé mi contraseña</button>}
          <button disabled={busy} onClick={onLocal} className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-60"><HardDrive className="size-4" /> Continuar en modo local</button>
        </div>
      </section>
    </main>
  );
}

function PasswordRecovery({ onUpdatePassword, error, notice, busy }) {
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onUpdatePassword(String(form.get("password") || ""));
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#050505] p-4">
      <section className="w-full max-w-md rounded-[24px] bg-white p-7 shadow-2xl">
        <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-[#E30613]"><KeyRound className="size-6" /></span>
        <h1 className="mt-5 text-3xl font-black uppercase">Nueva contraseña</h1>
        <p className="mt-2 text-sm text-slate-500">Elegí una contraseña nueva de al menos 8 caracteres.</p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          <input name="password" type="password" minLength="8" required autoComplete="new-password" className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20" />
          {error && <p className="text-sm font-bold text-red-600">{error}</p>}
          {notice && <p className="text-sm font-bold text-emerald-700">{notice}</p>}
          <button disabled={busy} className="btn-primary w-full">{busy ? "Guardando…" : "Guardar contraseña"}</button>
        </form>
      </section>
    </main>
  );
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [mode, setMode] = useState("loading");
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const previousUserId = useRef(null);

  useEffect(() => {
    let active = true;
    if (!supabaseConfigured || !supabase) {
      const rememberedLocal = typeof localStorage !== "undefined" && localStorage.getItem(MODE_KEY) === "local";
      setSession(null);
      setMode(rememberedLocal ? "local" : "auth");
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const current = data.session || null;
      setSession(current);
      setMode(current ? "cloud" : (localStorage.getItem(MODE_KEY) === "local" ? "local" : "auth"));
      previousUserId.current = current?.user?.id || null;
    }).catch(() => {
      if (!active) return;
      setSession(null);
      setMode(localStorage.getItem(MODE_KEY) === "local" ? "local" : "auth");
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!active) return;
      const previous = previousUserId.current;
      const next = nextSession?.user?.id || null;
      if (previous && previous !== next) await clearCloudState(previous).catch(() => undefined);
      previousUserId.current = next;
      setSession(nextSession || null);
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setMode("cloud");
        return;
      }
      if (nextSession) {
        localStorage.removeItem(MODE_KEY);
        setMode("cloud");
      } else {
        setMode(localStorage.getItem(MODE_KEY) === "local" ? "local" : "auth");
      }
    });

    return () => {
      active = false;
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  const login = async (email, password) => {
    setError(""); setNotice(""); setBusy(true);
    try {
      if (!supabase) throw new Error("Supabase no configurado");
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (err) {
      setError(authMessage(err, "login"));
    } finally { setBusy(false); }
  };

  const register = async (name, email, password) => {
    setError(""); setNotice("");
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    setBusy(true);
    try {
      if (!supabase) throw new Error("Supabase no configurado");
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${location.origin}/`,
          data: { name: name || "Administrador" },
        },
      });
      if (signUpError) throw signUpError;
      if (!data.session) {
        setNotice("Cuenta creada. Revisá tu correo para confirmar el email y después ingresá.");
      } else {
        setNotice("Cuenta creada correctamente.");
      }
    } catch (err) {
      setError(authMessage(err, "register"));
    } finally { setBusy(false); }
  };

  const resetPassword = async (email) => {
    setError(""); setNotice(""); setBusy(true);
    try {
      if (!supabase) throw new Error("Supabase no configurado");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/` });
      if (resetError) throw resetError;
      setNotice("Te enviamos un correo de recuperación. Revisá también Spam/Correo no deseado.");
    } catch (err) {
      setError(authMessage(err, "reset"));
    } finally { setBusy(false); }
  };

  const updatePassword = async (password) => {
    setError(""); setNotice("");
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setNotice("Contraseña actualizada correctamente.");
      setRecovery(false);
    } catch (err) {
      setError(authMessage(err, "password"));
    } finally { setBusy(false); }
  };

  const enterLocalMode = () => {
    setError(""); setNotice("");
    try { localStorage.setItem(MODE_KEY, "local"); } catch { /* no-op */ }
    setSession(null);
    setMode("local");
  };

  const openCloudLogin = () => {
    try { localStorage.removeItem(MODE_KEY); } catch { /* no-op */ }
    setMode("auth");
  };

  const logout = async () => {
    const uid = session?.user?.id;
    if (uid) {
      await unlinkPushSubscriptionBeforeLogout().catch(() => undefined);
      await clearCloudState(uid).catch(() => undefined);
      try {
        localStorage.removeItem("gymflow-access-display");
        localStorage.removeItem("gymflow-access-input");
      } catch { /* no-op */ }
    }
    await supabase?.auth.signOut({ scope: "local" }).catch(() => undefined);
    try { localStorage.removeItem(MODE_KEY); } catch { /* no-op */ }
    setSession(null);
    setMode("auth");
  };

  if (mode === "loading" || session === undefined) return <div className="min-h-screen bg-[#050505]" />;
  if (recovery) return <PasswordRecovery onUpdatePassword={updatePassword} error={error} notice={notice} busy={busy} />;
  if (mode === "auth") return <AuthScreen onLogin={login} onRegister={register} onReset={resetPassword} onLocal={enterLocalMode} error={error} notice={notice} busy={busy} />;

  const user = session?.user || null;
  const value = {
    mode,
    session,
    user,
    isCloud: mode === "cloud" && Boolean(user),
    isLocal: mode === "local",
    logout,
    openCloudLogin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
