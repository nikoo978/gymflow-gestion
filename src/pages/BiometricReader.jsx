import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Fingerprint, Radio, ShieldX, Smartphone, WifiOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useGym } from "../context/GymContext";
import { createReaderChannel, enrollReaderBiometrics, hasReaderCredential, platformBiometricsAvailable, verifyReaderBiometrics } from "../services/accessReader";

export default function BiometricReader() {
  const { data } = useGym();
  const { user, isOnline } = useAuth();
  const channelRef = useRef(null);
  const [personId, setPersonId] = useState("");
  const [available, setAvailable] = useState(null);
  const [enrolled, setEnrolled] = useState(hasReaderCredential);
  const [status, setStatus] = useState({ type: "idle", message: "Esperando una lectura" });
  const people = useMemo(() => data.people.filter((person) => person.branch === data.activeBranch), [data.people, data.activeBranch]);
  const person = people.find((item) => item.id === personId);

  useEffect(() => { platformBiometricsAvailable().then(setAvailable).catch(() => setAvailable(false)); }, []);
  useEffect(() => {
    const channel = createReaderChannel(user?.id);
    if (!channel) return undefined;
    channel.on("broadcast", { event: "access_result" }, ({ payload }) => {
      if (payload?.requestId !== sessionStorage.getItem("gymflow-last-scan")) return;
      setStatus({ type: payload.allowed ? "allowed" : "denied", message: payload.allowed ? `Ingreso permitido · ${payload.personName}` : payload.denialReason || "Ingreso denegado" });
    }).subscribe();
    channelRef.current = channel;
    return () => { channel.unsubscribe(); channelRef.current = null; };
  }, [user?.id]);

  const enroll = async () => {
    setStatus({ type: "working", message: "Configurando autenticación…" });
    try { await enrollReaderBiometrics(user); setEnrolled(true); setStatus({ type: "idle", message: "Huella configurada. Elegí un socio." }); }
    catch (error) { setStatus({ type: "denied", message: error.name === "NotAllowedError" ? "Configuración cancelada." : error.message }); }
  };

  const sendScan = async ({ demo = false } = {}) => {
    if (!person || !channelRef.current) return;
    setStatus({ type: "working", message: demo ? "Enviando simulación…" : "Apoyá el dedo en el lector" });
    try {
      if (!demo) await verifyReaderBiometrics();
      const requestId = crypto.randomUUID();
      sessionStorage.setItem("gymflow-last-scan", requestId);
      setStatus({ type: "working", message: "Huella aceptada · consultando a recepción…" });
      await channelRef.current.send({ type: "broadcast", event: "biometric_scan", payload: { requestId, personId: person.id, personName: person.name, readerId: "xiaomi-dev-01", simulated: demo, sentAt: new Date().toISOString() } });
    } catch (error) { setStatus({ type: "denied", message: error.name === "NotAllowedError" ? "Lectura cancelada o huella rechazada." : error.message }); }
  };

  const tone = status.type === "allowed" ? "bg-emerald-500" : status.type === "denied" ? "bg-[#E30613]" : "bg-[#171717]";
  return <main className="min-h-screen bg-[#050505] p-4 text-white">
    <section className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-lg flex-col rounded-[28px] border border-white/10 bg-[#101010] p-6 shadow-2xl">
      <header className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#E30613]">GymFlow</p><h1 className="mt-1 text-2xl font-black">Lector Xiaomi</h1></div><span className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${isOnline ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{isOnline ? <Radio className="size-4" /> : <WifiOff className="size-4" />}{isOnline ? "En línea" : "Sin conexión"}</span></header>

      <div className="mt-8 grid place-items-center"><span className={`grid size-28 place-items-center rounded-full ${tone} transition-colors`}><Fingerprint className="size-16" /></span><p className="mt-5 min-h-12 text-center text-lg font-black">{status.message}</p></div>

      <label className="mt-8 text-sm font-bold text-white/65">Socio simulado<select value={personId} onChange={(event) => { setPersonId(event.target.value); setStatus({ type: "idle", message: "Esperando una lectura" }); }} className="mt-2 h-14 w-full rounded-2xl border border-white/15 bg-white/8 px-4 text-base font-bold text-white outline-none"><option value="" className="text-black">Seleccionar socio</option>{people.map((item) => <option key={item.id} value={item.id} className="text-black">{item.name} · DNI {item.dni}</option>)}</select></label>

      <div className="mt-5 grid gap-3">
        {available === true && !enrolled && <button onClick={enroll} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-white font-black text-black"><Smartphone className="size-5" /> Configurar huella del teléfono</button>}
        <button disabled={!person || !isOnline || !enrolled || status.type === "working"} onClick={() => sendScan()} className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-[#E30613] text-lg font-black disabled:cursor-not-allowed disabled:opacity-35"><Fingerprint className="size-6" /> Leer huella y enviar</button>
        <button disabled={!person || !isOnline || status.type === "working"} onClick={() => sendScan({ demo: true })} className="h-12 rounded-2xl border border-white/15 font-bold text-white/65 disabled:opacity-35">Probar sin biometría</button>
      </div>

      <div className="mt-auto pt-8 text-center text-xs leading-5 text-white/35">La selección del socio simula la identificación que hará el lector real. La huella sólo confirma la lectura en este Xiaomi.</div>
      {status.type === "allowed" && <CheckCircle2 className="mx-auto mt-4 size-6 text-emerald-400" />}{status.type === "denied" && <ShieldX className="mx-auto mt-4 size-6 text-red-400" />}
    </section>
  </main>;
}

