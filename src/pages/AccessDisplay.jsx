import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Fingerprint, ShieldX } from "lucide-react";
import { displayKeyFromHash, getAccessDisplayKey, getAccessDisplayState, subscribeAccessDisplay } from "../services/accessDisplay";

const DISPLAY_KEY = "gymflow-access-display";
const INPUT_KEY = "gymflow-keypad-input";
const readInput = () => { try { return localStorage.getItem(INPUT_KEY) || ""; } catch { return ""; } };

const readLastEvent = () => {
  try {
    const event = JSON.parse(localStorage.getItem(DISPLAY_KEY));
    if (!event?.checkedAt || Date.now() - new Date(event.checkedAt).getTime() >= 30000) {
      localStorage.removeItem(DISPLAY_KEY);
      return null;
    }
    return event;
  }
  catch { return null; }
};

const formatDate = (value) => value
  ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
  : "No corresponde";

export default function AccessDisplay() {
  const [access, setAccess] = useState(readLastEvent);
  const [typedDni, setTypedDni] = useState(readInput);
  const [now, setNow] = useState(() => new Date());
  const [connection, setConnection] = useState("connecting");

  useEffect(() => {
    let active = true;
    let unsubscribeRealtime = () => undefined;

    const applyAccess = (next) => {
      if (!active || !next) return;
      setTypedDni("");
      setAccess(next);
      try { localStorage.setItem(DISPLAY_KEY, JSON.stringify(next)); } catch { /* no-op */ }
    };

    const connectRealtime = async () => {
      let displayKey = displayKeyFromHash();
      if (!displayKey) {
        const result = await getAccessDisplayKey();
        if (result.displayKey) {
          displayKey = result.displayKey;
          window.history.replaceState(null, "", `${window.location.pathname}#display=${encodeURIComponent(displayKey)}`);
        }
      }

      if (!displayKey) {
        if (active) setConnection("local");
        return;
      }

      const current = await getAccessDisplayState(displayKey);
      if (current.access) applyAccess(current.access);

      unsubscribeRealtime = subscribeAccessDisplay(
        displayKey,
        applyAccess,
        (status) => {
          if (!active) return;
          if (status === "SUBSCRIBED") setConnection("online");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setConnection("reconnecting");
        },
      );
    };

    connectRealtime().catch(() => { if (active) setConnection("local"); });

    const receive = (event) => {
      if (event.data?.type === "keypad-input") {
        setTypedDni(event.data.value || "");
        if (event.data.value) setAccess(null);
        return;
      }
      applyAccess(event.data?.type === "access-result" ? event.data.payload : event.data);
    };
    const receiveStorage = (event) => {
      if (event.key === DISPLAY_KEY && event.newValue) { try { applyAccess(JSON.parse(event.newValue)); } catch { /* no-op */ } }
      if (event.key === INPUT_KEY) {
        const value = event.newValue || "";
        setTypedDni(value);
        if (value) setAccess(null);
      }
    };
    let channel;
    try {
      channel = new BroadcastChannel("gymflow-access");
      channel.addEventListener("message", receive);
    } catch { /* storage event mantiene la compatibilidad local */ }
    window.addEventListener("storage", receiveStorage);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      active = false;
      unsubscribeRealtime();
      channel?.removeEventListener("message", receive);
      channel?.close();
      window.removeEventListener("storage", receiveStorage);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!access?.checkedAt) return undefined;
    const remaining = 30000 - (Date.now() - new Date(access.checkedAt).getTime());
    const timeout = window.setTimeout(() => {
      setAccess(null);
      try { localStorage.removeItem(DISPLAY_KEY); } catch { /* no-op */ }
    }, Math.max(0, remaining));
    return () => window.clearTimeout(timeout);
  }, [access?.checkedAt]);

  const status = !access?.person ? "unknown" : access.allowed ? (access.membershipStatus === "Por vencer" ? "warning" : "allowed") : "denied";
  const theme = {
    allowed: { bg: "bg-[#050505]", accent: "text-[#F5F5F5]", panel: "bg-white/10", icon: CheckCircle2, title: "INGRESO PERMITIDO", message: "Bienvenido/a. Podés ingresar." },
    warning: { bg: "bg-[#282828]", accent: "text-[#DADADA]", panel: "bg-[#E30613]/20", icon: AlertTriangle, title: "INGRESO PERMITIDO", message: "Tu membresía está próxima a vencer." },
    denied: { bg: "bg-[#9E0710]", accent: "text-white", panel: "bg-black/15", icon: ShieldX, title: "INGRESO DENEGADO", message: "La membresía está vencida. Acercate a recepción." },
    unknown: { bg: "bg-[#050505]", accent: "text-[#AFAFAF]", panel: "bg-white/5", icon: Fingerprint, title: access ? "PERSONA NO ENCONTRADA" : "VALIDAR INGRESO", message: access ? "Verificá el DNI o consultá en recepción." : "Ingresá el DNI y presioná Enter." },
  }[status];
  const StatusIcon = theme.icon;
  const statusMessage = access?.denialReason || theme.message;
  const secondsRemaining = access?.checkedAt ? Math.max(0, 30 - Math.floor((now - new Date(access.checkedAt)) / 1000)) : null;
  const greeting = now.getHours() < 12 ? "Buen día" : now.getHours() < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <main className={`min-h-screen overflow-hidden text-white transition-colors duration-500 ${theme.bg}`} aria-live="assertive">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8 sm:py-5 lg:px-12">
        <div className="flex min-w-0 items-center gap-5">
          <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-10 w-40 object-contain object-left sm:h-12 sm:w-64" />
          <div className="hidden border-l border-white/15 pl-5 sm:block"><p className="text-xs font-bold uppercase tracking-[.22em] text-white/55">{access?.branchName || "Control de acceso"}</p></div>
        </div>
        <div className="shrink-0 text-right"><p className="text-2xl font-black tabular-nums sm:text-3xl">{now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p><p className="hidden text-sm capitalize text-white/50 sm:block">{now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p></div>
      </header>

      <section className="grid min-h-[calc(100vh-81px)] place-items-center p-5 sm:p-8 lg:min-h-[calc(100vh-97px)] lg:p-12">
        <div className="w-full max-w-6xl">
          {!access ? <div className="flex flex-col items-center text-center"><span className="grid size-24 place-items-center rounded-full bg-white/5 text-[#AFAFAF] sm:size-28"><Fingerprint className="size-14 sm:size-16" strokeWidth={2.2} /></span><p className="mt-7 text-sm font-black tracking-[.24em] text-[#E30613] sm:text-lg">VALIDAR INGRESO</p><h1 className="mt-3 text-4xl font-black uppercase italic tracking-[-.04em] sm:text-5xl lg:text-7xl">{greeting}</h1><p className="mt-4 text-lg font-bold text-white/60 sm:text-2xl">Identificate para ingresar</p>{typedDni && <div className="mt-8 min-w-[260px] rounded-2xl border-2 border-[#E30613] bg-white/8 px-6 py-4 text-center shadow-[0_0_40px_rgba(227,6,19,.14)] sm:mt-10 sm:min-w-[320px] sm:px-8 sm:py-5"><p className="text-xs font-black uppercase tracking-[.22em] text-white/35">DNI</p><p className="mt-2 font-mono text-3xl font-black tracking-[.18em] text-white sm:text-4xl">{typedDni}</p></div>}</div> : <div className="flex flex-col items-center text-center"><span className={`grid size-24 place-items-center rounded-full sm:size-28 ${theme.panel} ${theme.accent}`}><StatusIcon className="size-14 sm:size-16" strokeWidth={2.4} /></span><p className={`mt-7 text-sm font-black tracking-[.24em] sm:text-lg ${theme.accent}`}>{theme.title}</p><h1 className="mt-3 text-4xl font-black uppercase italic tracking-[-.04em] sm:text-5xl lg:text-7xl">{access?.person?.name || theme.message}</h1>{access?.person && <><p className="mt-4 text-base text-white/60 sm:text-xl">{statusMessage}</p><p className="mt-2 text-xs font-bold uppercase tracking-[.15em] text-white/35 sm:text-sm">{access.person.role} · DNI {access.person.dni}</p></>}</div>}

          {access?.person && (
            <div className="mt-8 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              <Info label="Estado de membresía" value={access.person.role === "Profesor" ? "Acceso de staff" : access.membershipStatus} emphasis={status} />
              <Info label="Plan" value={access.person.plan === "3 días" ? `3 días · ${access.planUsage?.usedDays || 0}/3 esta semana` : access.person.plan} />
              <Info label="Vencimiento" value={access.person.role === "Profesor" ? "Sin vencimiento" : formatDate(access.person.expiry)} />
              <Info label="Último pago" value={access.person.role === "Profesor" ? "Acceso gratuito" : formatDate(access.lastPaymentDate)} />
            </div>
          )}

          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-white/35 sm:mt-8 sm:text-sm">
            <span className="inline-flex items-center gap-2"><Clock3 className="size-4" />{access ? `Validación realizada a las ${new Date(access.checkedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · la pantalla se limpia en ${secondsRemaining}s` : "Esperando identificación"}</span>
            <span className="text-white/20">·</span><span>{connection === "online" ? "Sincronización global activa" : connection === "reconnecting" ? "Reconectando segunda pantalla…" : "Sincronización local"}</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value, emphasis }) {
  const valueTone = emphasis === "denied" ? "text-white" : emphasis === "warning" ? "text-[#F5F5F5]" : emphasis === "allowed" ? "text-[#DADADA]" : "text-white";
  return <article className="rounded-2xl border border-white/10 bg-white/6 p-4 sm:rounded-3xl sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/40 sm:text-xs">{label}</p><p className={`mt-2 text-base font-black sm:mt-3 sm:text-xl ${valueTone}`}>{value}</p></article>;
}
