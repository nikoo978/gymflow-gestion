import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Fingerprint, ShieldX } from "lucide-react";

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
  ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
  : "No corresponde";

export default function AccessDisplay() {
  const [access, setAccess] = useState(readLastEvent);
  const [typedDni, setTypedDni] = useState(readInput);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const receive = (event) => {
      if (event.data?.type === "keypad-input") {
        setTypedDni(event.data.value || "");
        if (event.data.value) setAccess(null);
        return;
      }
      setTypedDni("");
      setAccess(event.data?.type === "access-result" ? event.data.payload : event.data);
    };
    const receiveStorage = (event) => {
      if (event.key === DISPLAY_KEY && event.newValue) { setTypedDni(""); setAccess(JSON.parse(event.newValue)); }
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
    } catch { /* storage event mantiene la compatibilidad */ }
    window.addEventListener("storage", receiveStorage);
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
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
      localStorage.removeItem(DISPLAY_KEY);
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
      <header className="flex items-center justify-between border-b border-white/10 px-8 py-5 lg:px-12">
        <div className="flex items-center gap-5">
          <img src="/infytter-logo.svg" alt="Infytter Fitness" className="h-12 w-48 object-contain object-left sm:w-64" />
          <div className="hidden border-l border-white/15 pl-5 sm:block"><p className="text-xs font-bold uppercase tracking-[.22em] text-white/55">{access?.branchName || "Control de acceso"}</p></div>
        </div>
        <div className="text-right"><p className="text-3xl font-black tabular-nums">{now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p><p className="text-sm capitalize text-white/50">{now.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p></div>
      </header>

      <section className="grid min-h-[calc(100vh-97px)] place-items-center p-8 lg:p-12">
        <div className="w-full max-w-6xl">
          {!access ? <div className="flex flex-col items-center text-center"><span className="grid size-28 place-items-center rounded-full bg-white/5 text-[#AFAFAF]"><Fingerprint className="size-16" strokeWidth={2.2} /></span><p className="mt-7 text-lg font-black tracking-[.24em] text-[#E30613]">VALIDAR INGRESO</p><h1 className="mt-3 text-5xl font-black uppercase italic tracking-[-.04em] lg:text-7xl">{greeting}</h1><p className="mt-4 text-2xl font-bold text-white/60">Identificate para ingresar</p>{typedDni && <div className="mt-10 min-w-[320px] rounded-2xl border-2 border-[#E30613] bg-white/8 px-8 py-5 text-center shadow-[0_0_40px_rgba(227,6,19,.14)]"><p className="text-xs font-black uppercase tracking-[.22em] text-white/35">DNI</p><p className="mt-2 font-mono text-4xl font-black tracking-[.18em] text-white">{typedDni}</p></div>}</div> : <div className="flex flex-col items-center text-center"><span className={`grid size-28 place-items-center rounded-full ${theme.panel} ${theme.accent}`}><StatusIcon className="size-16" strokeWidth={2.4} /></span><p className={`mt-7 text-lg font-black tracking-[.24em] ${theme.accent}`}>{theme.title}</p><h1 className="mt-3 text-5xl font-black uppercase italic tracking-[-.04em] lg:text-7xl">{access?.person?.name || theme.message}</h1>{access?.person && <><p className="mt-4 text-xl text-white/60">{statusMessage}</p><p className="mt-2 text-sm font-bold uppercase tracking-[.15em] text-white/35">{access.person.role} · DNI {access.person.dni}</p></>}</div>}

          {access?.person && (
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Estado de membresía" value={access.person.role === "Profesor" ? "Acceso de staff" : access.membershipStatus} emphasis={status} />
              <Info label="Plan" value={access.person.plan === "3 días" ? `3 días · ${access.planUsage?.usedDays || 0}/3 esta semana` : access.person.plan} />
              <Info label="Vencimiento" value={access.person.role === "Profesor" ? "Sin vencimiento" : formatDate(access.person.expiry)} />
              <Info label="Último pago" value={access.person.role === "Profesor" ? "Acceso gratuito" : formatDate(access.lastPaymentDate)} />
            </div>
          )}

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-white/35">
            <Clock3 className="size-4" />
            {access ? `Validación realizada a las ${new Date(access.checkedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · la pantalla se limpia en ${secondsRemaining}s` : "Esperando identificación"}
          </div>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value, emphasis }) {
  const valueTone = emphasis === "denied" ? "text-white" : emphasis === "warning" ? "text-[#F5F5F5]" : emphasis === "allowed" ? "text-[#DADADA]" : "text-white";
  return <article className="rounded-3xl border border-white/10 bg-white/6 p-6"><p className="text-xs font-bold uppercase tracking-[.16em] text-white/40">{label}</p><p className={`mt-3 text-xl font-black ${valueTone}`}>{value}</p></article>;
}
