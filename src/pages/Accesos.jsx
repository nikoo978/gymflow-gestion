import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, Delete, DoorOpen, Fingerprint, MonitorUp, Search, Trash2, XCircle } from "lucide-react";
import { statusOf, useGym } from "../context/GymContext";
import { useAuth } from "../context/AuthContext";
import { buildAccessDisplayUrl, getAccessDisplayKey, publishGlobalAccessDisplay } from "../services/accessDisplay";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
const INPUT_KEY = "gymflow-keypad-input";

export default function Accesos() {
  const { data, checkAccess, clearAccesses, allowGuest } = useGym();
  const { permissions } = useAuth();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [displayMessage, setDisplayMessage] = useState("");
  const inputRef = useRef(null);
  const recent = data.accesses.filter((access) => access.branch === data.activeBranch).slice(0, 12);

  const publishResult = (accessResult) => {
    if (!accessResult || accessResult.ok === false) return;
    publishGlobalAccessDisplay(accessResult).catch(() => undefined);
  };

  const validate = () => {
    if (!query.trim()) return;
    const accessResult = checkAccess(query.trim());
    setResult(accessResult);
    publishResult(accessResult);
    setQuery("");
    inputRef.current?.focus();
  };

  const submit = (event) => {
    event.preventDefault();
    validate();
  };

  const pressKey = (key) => {
    if (key === "C") setQuery("");
    else if (key === "⌫") setQuery((value) => value.slice(0, -1));
    else setQuery((value) => (value + key).slice(0, 10));
    inputRef.current?.focus();
  };

  const getDisplayUrl = async () => {
    const { displayKey, error } = await getAccessDisplayKey();
    if (error || !displayKey) throw error || new Error("No se pudo obtener el enlace de segunda pantalla.");
    return buildAccessDisplayUrl(displayKey);
  };

  const openDisplay = async () => {
    setDisplayMessage("");
    const popup = window.open("about:blank", "gymflow-access-display", "popup,width=1280,height=720");
    try {
      const url = await getDisplayUrl();
      if (popup) popup.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      popup?.close();
      setDisplayMessage(error?.message || "No se pudo abrir la segunda pantalla.");
    }
  };

  const copyDisplayLink = async () => {
    setDisplayMessage("");
    try {
      const url = await getDisplayUrl();
      await navigator.clipboard.writeText(url);
      setDisplayMessage("Enlace copiado. Abrilo en el celular, tablet o TV que quieras usar como segunda pantalla.");
    } catch (error) {
      setDisplayMessage(error?.message || "No se pudo copiar el enlace.");
    }
  };

  const clearRecent = () => {
    if (window.confirm("¿Borrar todos los intentos de acceso de esta sucursal?")) clearAccesses();
  };

  const allowManualAccess = () => {
    const accessResult = allowGuest();
    setResult(accessResult);
    publishResult(accessResult);
  };

  useEffect(() => {
    const handleUsbKeypad = (event) => {
      if (document.activeElement === inputRef.current) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        setQuery((value) => (value + event.key).slice(0, 10));
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setQuery((value) => value.slice(0, -1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        inputRef.current?.form?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handleUsbKeypad);
    return () => window.removeEventListener("keydown", handleUsbKeypad);
  }, []);

  useEffect(() => {
    localStorage.setItem(INPUT_KEY, query);
    try {
      const channel = new BroadcastChannel("gymflow-access");
      channel.postMessage({ type: "keypad-input", value: query });
      channel.close();
    } catch { /* localStorage mantiene la compatibilidad */ }
  }, [query]);

  return (
    <div className="mx-auto max-w-[1480px] space-y-6">
      <section className="page-head">
        <div>
          <p className="eyebrow">Recepción</p>
          <h1 className="page-title">Control de acceso</h1>
          <p className="page-subtitle">Validación por DNI o futura lectura biométrica.</p>
        </div>
        <div className="flex flex-wrap gap-2"><button onClick={allowManualAccess} className="btn-primary"><DoorOpen className="size-4" /> Permitir acceso</button><button onClick={openDisplay} className="btn-secondary"><MonitorUp className="size-4" /> Abrir pantalla secundaria</button><button onClick={copyDisplayLink} className="btn-secondary"><Copy className="size-4" /> Copiar enlace</button></div>
      </section>

      {displayMessage && <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600">{displayMessage}</p>}

      <section className="grid gap-5 xl:grid-cols-[.8fr_.7fr_1.2fr]">
        <article className="rounded-[20px] bg-[#050505] p-6 text-white shadow-xl shadow-black/10">
          <Fingerprint className="size-10 text-[#E30613]" />
          <h2 className="mt-6 text-2xl font-black">Validar ingreso</h2>
          <p className="mt-2 text-sm text-[#AFAFAF]">Ingresá el DNI y presioná Enter.</p>
          <form onSubmit={submit} className="mt-6 flex gap-2">
            <label className="flex h-12 flex-1 items-center gap-2 rounded-xl bg-white/10 px-3">
              <Search className="size-4" />
              <input
                ref={inputRef}
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                value={query}
                onChange={(event) => setQuery(event.target.value.replace(/\D/g, ""))}
                className="w-full bg-transparent text-lg font-bold tracking-wider text-white outline-none placeholder:text-white/35"
                placeholder="DNI"
                aria-label="DNI"
              />
            </label>
            <button className="rounded-xl bg-[#E30613] px-5 font-black text-white hover:bg-[#9E0710]">Validar</button>
          </form>
          {result && (
            <div className={`mt-6 rounded-2xl p-5 ${result.allowed ? "bg-white/10" : "bg-[#E30613]/25"}`}>
              {result.allowed ? <CheckCircle2 className="size-7 text-[#F5F5F5]" /> : <XCircle className="size-7 text-red-300" />}
              <p className="mt-3 text-xl font-black">{result.person?.name || "Persona no encontrada"}</p>
              <p className="mt-1 text-sm text-white/60">
                {result.manual ? "Autorizado por recepción" : result.denialReason || (result.person ? `${result.person.plan} · ${statusOf(result.person)}` : "Ingreso rechazado")}
              </p>
            </div>
          )}
        </article>

        <article className="panel">
          <h2 className="section-title">Teclado numérico</h2>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => pressKey(key)}
                className={`grid h-16 place-items-center rounded-2xl text-xl font-black transition active:scale-95 ${key === "C" || key === "⌫" ? "bg-[#DADADA] text-[#282828]" : "bg-[#F5F5F5] text-[#050505] ring-1 ring-[#DADADA]"}`}
                aria-label={key === "⌫" ? "Borrar último dígito" : key === "C" ? "Limpiar" : `Número ${key}`}
              >
                {key === "⌫" ? <Delete className="size-5" /> : key}
              </button>
            ))}
          </div>
          <button onClick={validate} disabled={!query} className="btn-primary mt-4 w-full">Confirmar DNI</button>
        </article>

        <article className="panel">
          <div className="flex items-center justify-between gap-3"><h2 className="section-title">Últimos intentos</h2>{permissions?.canDelete && <button onClick={clearRecent} disabled={!recent.length} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-black text-[#9E0710] transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="size-3.5" /> Borrar</button>}</div>
          <div className="mt-4 divide-y divide-slate-100">
            {recent.map((access) => {
              const person = data.people.find((item) => item.id === access.personId);
              return (
                <div key={access.id} className="flex items-center gap-3 py-3">
                  <span className={`grid size-9 place-items-center rounded-full ${access.allowed ? "bg-[#F5F5F5] text-[#282828] ring-1 ring-[#DADADA]" : "bg-red-50 text-red-600"}`}>
                    {access.allowed ? <CheckCircle2 className="size-5" /> : <XCircle className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{person?.name || (access.manual ? "Acceso manual" : "No identificado")}</p>
                    <p className="text-xs text-slate-400">{new Date(access.date).toLocaleString("es-AR")}</p>
                  </div>
                  <span className={`status ${access.allowed ? "status-ok" : "status-bad"}`}>{access.allowed ? "Permitido" : "Rechazado"}</span>
                </div>
              );
            })}
          </div>
        </article>
      </section>
    </div>
  );
}
