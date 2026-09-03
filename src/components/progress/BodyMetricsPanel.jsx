import { Activity, Gauge, Plus, RefreshCw, Ruler, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FormDialog from "../ui/FormDialog";
import { getMyBodyMetrics, getPersonBodyMetrics, saveMyBodyMetric, savePersonBodyMetric } from "../../services/bodyMetrics";

const input = "mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20";
const n = (value, digits = 1) => value == null || value === "" ? "—" : Number(value).toLocaleString("es-AR", { maximumFractionDigits: digits });
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function BodyMetricsPanel({ personId = null, self = false, title = "Progreso corporal", subtitle = "Registrá medidas y seguí la evolución.", preview = false }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(!preview);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (preview || (!self && !personId)) { setLoading(false); setItems([]); return; }
    setLoading(true); setError("");
    const result = self ? await getMyBodyMetrics(40) : await getPersonBodyMetrics(personId, 40);
    if (result.error) setError(result.error.message || "No se pudo cargar el progreso.");
    else setItems(result.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [personId, self, preview]);

  const latest = items[0] || null;
  const previous = items[1] || null;
  const weightDelta = useMemo(() => latest && previous ? Number(latest.weightKg) - Number(previous.weightKg) : null, [latest, previous]);

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      weightKg: form.get("weightKg"), heightCm: form.get("heightCm"), waistCm: form.get("waistCm"),
      neckCm: form.get("neckCm"), hipCm: form.get("hipCm"), sex: form.get("sex"), notes: form.get("notes"),
    };
    setSaving(true); setError(""); setMessage("");
    const result = self ? await saveMyBodyMetric(values) : await savePersonBodyMetric(personId, values);
    if (result.error) setError(result.error.message || "No se pudo guardar la medición.");
    else { setMessage("Medición registrada."); setOpen(false); await load(); }
    setSaving(false);
  };

  return <section className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#E30613]">Seguimiento</p><h2 className="mt-1 text-xl font-black text-[#050505]">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p></div>
      {!preview && (self || personId) && <button onClick={() => setOpen(true)} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#E30613] text-white shadow-sm" aria-label="Registrar medición"><Plus className="size-5" /></button>}
    </div>

    {message && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}
    {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    {loading && <p className="flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-bold text-slate-500"><RefreshCw className="size-4 animate-spin" /> Cargando progreso…</p>}

    {!loading && latest && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={Scale} label="Peso" value={`${n(latest.weightKg)} kg`} detail={weightDelta == null ? "Primera referencia" : `${weightDelta > 0 ? "+" : ""}${n(weightDelta)} kg vs. anterior`} delta={weightDelta} />
        <MetricCard icon={Gauge} label="IMC" value={n(latest.bmi, 2)} detail="Referencia antropométrica" />
        <MetricCard icon={Activity} label="Grasa estimada" value={latest.bodyFatPct == null ? "Sin cálculo" : `${n(latest.bodyFatPct)} %`} detail="Método Navy · estimación" />
        <MetricCard icon={Ruler} label="Cintura" value={latest.waistCm == null ? "—" : `${n(latest.waistCm)} cm`} detail={dateLabel(latest.measuredAt)} />
      </div>

      <div className="rounded-[22px] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between"><div><p className="text-sm font-black text-slate-900">Historial</p><p className="text-[11px] text-slate-400">Últimas mediciones registradas</p></div>{!preview && <button onClick={load} className="grid size-9 place-items-center rounded-xl border border-black/8 text-slate-500"><RefreshCw className="size-4" /></button>}</div>
        <div className="mt-3 divide-y divide-slate-100">{items.slice(0, 10).map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-3"><div><p className="text-sm font-black text-slate-800">{n(item.weightKg)} kg <span className="font-bold text-slate-400">· IMC {n(item.bmi, 2)}</span></p><p className="mt-1 text-[11px] text-slate-400">{dateLabel(item.measuredAt)}{item.bodyFatPct != null ? ` · Grasa ${n(item.bodyFatPct)}%` : ""}</p>{item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}</div><span className="self-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500">{item.waistCm ? `${n(item.waistCm)} cm cintura` : "Medición"}</span></div>)}</div>
      </div>
    </>}

    {!loading && !latest && <div className="rounded-[22px] border border-dashed border-slate-200 bg-white p-7 text-center"><Scale className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-500">Todavía no hay mediciones</p><p className="mt-1 text-xs leading-5 text-slate-400">Registrá peso y altura para obtener IMC. Con cintura, cuello, sexo y cadera cuando corresponda también se estima el porcentaje de grasa.</p></div>}

    <FormDialog open={open} onOpenChange={setOpen} title="Nueva medición" description="Los cálculos son orientativos y no reemplazan una evaluación médica.">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-600">Peso (kg)<input name="weightKg" type="number" step="0.1" min="20" max="400" required defaultValue={latest?.weightKg || ""} inputMode="decimal" className={input} /></label>
        <label className="text-sm font-bold text-slate-600">Altura (cm)<input name="heightCm" type="number" step="0.1" min="100" max="250" required defaultValue={latest?.heightCm || ""} inputMode="decimal" className={input} /></label>
        <label className="text-sm font-bold text-slate-600">Cintura (cm)<input name="waistCm" type="number" step="0.1" min="30" max="250" defaultValue={latest?.waistCm || ""} inputMode="decimal" className={input} /></label>
        <label className="text-sm font-bold text-slate-600">Cuello (cm)<input name="neckCm" type="number" step="0.1" min="20" max="100" defaultValue={latest?.neckCm || ""} inputMode="decimal" className={input} /></label>
        <label className="text-sm font-bold text-slate-600">Sexo para estimación<select name="sex" defaultValue={latest?.sex || ""} className={input}><option value="">No calcular grasa</option><option value="male">Masculino</option><option value="female">Femenino</option></select></label>
        <label className="text-sm font-bold text-slate-600">Cadera (cm)<input name="hipCm" type="number" step="0.1" min="40" max="250" defaultValue={latest?.hipCm || ""} inputMode="decimal" className={input} /><span className="mt-1 block text-[10px] font-medium text-slate-400">Se usa en la fórmula femenina.</span></label>
        <label className="sm:col-span-2 text-sm font-bold text-slate-600">Notas<textarea name="notes" rows="3" maxLength="500" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#E30613]/20" placeholder="Objetivo, contexto de la medición, observaciones…" /></label>
        <button disabled={saving} className="btn-primary min-h-11 sm:col-span-2 disabled:opacity-60">{saving ? "Guardando…" : "Guardar medición"}</button>
      </form>
    </FormDialog>
  </section>;
}

function MetricCard({ icon: Icon, label, value, detail, delta = null }) {
  const DeltaIcon = delta == null || delta === 0 ? null : delta > 0 ? TrendingUp : TrendingDown;
  return <article className="rounded-[20px] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-red-50 text-[#E30613]"><Icon className="size-4" /></span>{DeltaIcon && <DeltaIcon className="size-4 text-slate-400" />}</div><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p><p className="mt-1 text-[10px] font-bold text-slate-400">{detail}</p></article>;
}
