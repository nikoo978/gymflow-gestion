import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, CloudOff, PackageOpen, ReceiptText, RefreshCw, RotateCcw, UserPlus, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import MetricCard from "../components/ui/MetricCard";
import { useAuth } from "../context/AuthContext";
import { useGym } from "../context/GymContext";
import { getReportSnapshot } from "../services/reports";

const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
const iso = (date) => date.toISOString().slice(0, 10);
const periods = [{ id: "day", label: "Día" }, { id: "week", label: "Semana" }, { id: "month", label: "Mes" }, { id: "year", label: "Año" }];

function rangeFor(period, anchor, offset = 0) {
  const base = new Date(`${anchor}T12:00:00`); let start; let end;
  if (period === "day") { start = new Date(base); start.setDate(start.getDate() + offset); end = new Date(start); end.setDate(end.getDate() + 1); }
  if (period === "week") { start = new Date(base); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7); end = new Date(start); end.setDate(end.getDate() + 7); }
  if (period === "month") { start = new Date(base.getFullYear(), base.getMonth() + offset, 1, 12); end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 12); }
  if (period === "year") { start = new Date(base.getFullYear() + offset, 0, 1, 12); end = new Date(start.getFullYear() + 1, 0, 1, 12); }
  return { start, end };
}

const inRange = (date, range) => { if (!date) return false; const value = new Date(`${String(date).slice(0, 10)}T12:00:00`); return value >= range.start && value < range.end; };
const percent = (current, previous) => previous ? Math.round(((current - previous) / previous) * 100) : current ? 100 : 0;
const groupTotals = (items) => Object.entries(items.reduce((acc, item) => { acc[item.category || "Sin categoría"] = (acc[item.category || "Sin categoría"] || 0) + Number(item.amount || 0); return acc; }, {})).sort((a, b) => b[1] - a[1]);

function rangeLabel(period, range) {
  if (period === "day") return range.start.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (period === "week") { const last = new Date(range.end); last.setDate(last.getDate() - 1); return `${range.start.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} — ${last.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}`; }
  if (period === "month") return range.start.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return range.start.toLocaleDateString("es-AR", { year: "numeric" });
}

function shiftDate(anchor, period, direction) {
  const date = new Date(`${anchor}T12:00:00`);
  if (period === "day") date.setDate(date.getDate() + direction);
  if (period === "week") date.setDate(date.getDate() + direction * 7);
  if (period === "month") date.setMonth(date.getMonth() + direction);
  if (period === "year") date.setFullYear(date.getFullYear() + direction);
  return iso(date);
}

function pointFor(label, range, transactions, clients) {
  const rows = transactions.filter((item) => inRange(item.date, range));
  return {
    label,
    Membresías: rows.filter((item) => item.type === "income" && item.category === "Membresía").reduce((sum, item) => sum + Number(item.amount || 0), 0),
    Ventas: rows.filter((item) => item.type === "income" && item.category !== "Membresía").reduce((sum, item) => sum + Number(item.amount || 0), 0),
    Gastos: rows.filter((item) => item.type === "expense").reduce((sum, item) => sum + Number(item.amount || 0), 0),
    Clientes: clients.filter((person) => inRange(person.start, range)).length,
  };
}

function trendData(period, range, transactions, clients) {
  const points = [];
  if (period === "year") {
    for (let month = 0; month < 12; month += 1) {
      const start = new Date(range.start.getFullYear(), month, 1, 12); const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 12);
      points.push(pointFor(start.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""), { start, end }, transactions, clients));
    }
    return points;
  }
  const days = period === "day" ? 1 : Math.round((range.end - range.start) / 86400000);
  for (let index = 0; index < days; index += 1) {
    const start = new Date(range.start); start.setDate(start.getDate() + index); const end = new Date(start); end.setDate(end.getDate() + 1);
    const label = period === "week" ? start.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "") : start.getDate().toString();
    points.push(pointFor(label, { start, end }, transactions, clients));
  }
  return points;
}

function legacyReport(data, period, anchor) {
  const current = rangeFor(period, anchor); const previous = rangeFor(period, anchor, -1);
  const allTransactions = data.transactions.filter((item) => item.branch === data.activeBranch);
  const allClients = data.people.filter((person) => person.branch === data.activeBranch && person.role === "Cliente");
  const tx = allTransactions.filter((item) => inRange(item.date, current));
  const oldTx = allTransactions.filter((item) => inRange(item.date, previous));
  const clients = allClients.filter((person) => inRange(person.start, current));
  const oldClients = allClients.filter((person) => inRange(person.start, previous));
  const membership = tx.filter((item) => item.type === "income" && item.category === "Membresía");
  const sales = tx.filter((item) => item.type === "income" && item.category !== "Membresía");
  const expenses = tx.filter((item) => item.type === "expense");
  const income = membership.reduce((sum, item) => sum + Number(item.amount || 0), 0) + sales.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expense = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const oldIncome = oldTx.filter((item) => item.type === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    current,
    tx,
    transactionCount: tx.length,
    transactionLimit: tx.length,
    clientsCount: clients.length,
    oldClientsCount: oldClients.length,
    membershipAmount: membership.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    membershipCount: membership.length,
    salesAmount: sales.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    salesCount: sales.length,
    expense,
    expenseCount: expenses.length,
    income,
    oldIncome,
    chart: trendData(period, current, allTransactions, allClients),
    saleGroups: groupTotals(sales),
    expenseGroups: groupTotals(expenses),
  };
}

function cloudToReport(raw, period, current) {
  const metrics = raw?.metrics || {};
  const chart = (raw?.chart || []).map((row) => {
    const date = new Date(`${String(row.date).slice(0, 10)}T12:00:00`);
    const label = period === "year"
      ? date.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")
      : period === "week"
        ? date.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "")
        : date.getDate().toString();
    return { label, Membresías: Number(row.membership || 0), Ventas: Number(row.sales || 0), Gastos: Number(row.expenses || 0), Clientes: Number(row.clients || 0) };
  });
  return {
    current,
    tx: raw?.transactions || [],
    transactionCount: Number(raw?.transactionCount || 0),
    transactionLimit: Number(raw?.transactionLimit || 500),
    clientsCount: Number(metrics.newClients || 0),
    oldClientsCount: Number(metrics.previousNewClients || 0),
    membershipAmount: Number(metrics.membershipAmount || 0),
    membershipCount: Number(metrics.membershipCount || 0),
    salesAmount: Number(metrics.salesAmount || 0),
    salesCount: Number(metrics.salesCount || 0),
    expense: Number(metrics.expenseAmount || 0),
    expenseCount: Number(metrics.expenseCount || 0),
    income: Number(metrics.incomeAmount || 0),
    oldIncome: Number(metrics.previousIncomeAmount || 0),
    chart,
    saleGroups: (raw?.salesBreakdown || []).map((row) => [row.label, Number(row.value || 0)]),
    expenseGroups: (raw?.expenseBreakdown || []).map((row) => [row.label, Number(row.value || 0)]),
  };
}

export default function Reportes() {
  const { data } = useGym();
  const { isCloud } = useAuth();
  const [period, setPeriod] = useState("month");
  const [anchor, setAnchor] = useState(() => iso(new Date()));
  const [remote, setRemote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const current = useMemo(() => rangeFor(period, anchor), [period, anchor]);
  const previous = useMemo(() => rangeFor(period, anchor, -1), [period, anchor]);
  const fallback = useMemo(() => legacyReport(data, period, anchor), [data, period, anchor]);
  const branchName = data.branches.find((branch) => branch.id === data.activeBranch)?.name;

  useEffect(() => {
    let active = true;
    if (!isCloud || !data.activeBranch) { setRemote(null); setLoading(false); return undefined; }
    setLoading(true); setRemoteError("");
    getReportSnapshot({
      branch: data.activeBranch,
      start: iso(current.start),
      end: iso(current.end),
      previousStart: iso(previous.start),
      previousEnd: iso(previous.end),
      granularity: period === "year" ? "month" : "day",
      limit: 500,
    }).then(({ report, error }) => {
      if (!active) return;
      if (error) { setRemote(null); setRemoteError(error.message || "No se pudo consultar el histórico indexado."); }
      else { setRemote(report); setRemoteError(""); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isCloud, data.activeBranch, period, anchor]);

  const report = remote ? cloudToReport(remote, period, current) : fallback;
  const maxBreakdown = Math.max(1, ...report.saleGroups.map(([, value]) => value), ...report.expenseGroups.map(([, value]) => value));
  const limitedRows = report.transactionCount > report.tx.length;

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <section className="page-head"><div><p className="eyebrow">Análisis financiero</p><h1 className="page-title">Reportes y rendimiento</h1><p className="page-subtitle">{branchName} · consultas históricas indexadas para crecer sin descargar toda la base.</p></div>{loading && <span className="inline-flex items-center gap-2 text-xs font-black text-slate-400"><RefreshCw className="size-4 animate-spin" /> Consultando</span>}</section>

    {!isCloud && <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><CloudOff className="mt-0.5 size-5 shrink-0" /><div><p className="font-black">Modo local</p><p className="mt-1">La operación de emergencia sigue disponible. Los históricos completos se consultan en Cloud; aquí se muestra sólo la información guardada localmente.</p></div></div>}
    {remoteError && isCloud && <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Histórico indexado temporalmente no disponible. Se usa la copia operativa: {remoteError}</div>}

    <section className="panel space-y-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="flex flex-wrap items-center gap-2"><button onClick={() => setAnchor(shiftDate(anchor, period, -1))} className="btn-secondary size-11 px-0" aria-label="Período anterior"><ArrowLeft className="size-4" /></button><div className="min-w-[230px] text-center"><p className="text-xs font-black uppercase tracking-[.16em] text-[#E30613]">Período seleccionado</p><p className="mt-1 text-lg font-black capitalize text-[#050505]">{rangeLabel(period, report.current)}</p></div><button onClick={() => setAnchor(shiftDate(anchor, period, 1))} className="btn-secondary size-11 px-0" aria-label="Período siguiente"><ArrowRight className="size-4" /></button></div><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><label className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#F5F5F5] px-3 py-2"><CalendarDays className="size-4 text-[#E30613]" /><span className="sr-only">Elegir fecha</span><input type="date" value={anchor} onChange={(event) => setAnchor(event.target.value)} className="bg-transparent text-sm font-black text-[#050505] outline-none" /></label><button onClick={() => setAnchor(iso(new Date()))} className="btn-secondary"><RotateCcw className="size-4" /> Hoy</button></div></div><div className="grid grid-cols-4 rounded-xl border border-black/10 bg-[#F5F5F5] p-1" role="group" aria-label="Período del reporte">{periods.map((item) => <button key={item.id} onClick={() => setPeriod(item.id)} className={`rounded-lg px-2 py-2.5 text-xs font-black transition sm:px-4 ${period === item.id ? "bg-[#E30613] text-white shadow-sm" : "text-slate-500 hover:bg-white"}`}>{item.label}</button>)}</div></section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Nuevos clientes" value={report.clientsCount} detail={`${percent(report.clientsCount, report.oldClientsCount)}% vs. período anterior`} icon={UserPlus} /><MetricCard label="Membresías" value={money(report.membershipAmount)} detail={`${report.membershipCount} cobros`} icon={WalletCards} tone="red" /><MetricCard label="Ventas de productos" value={money(report.salesAmount)} detail={`${report.salesCount} ventas`} icon={PackageOpen} tone="blue" /><MetricCard label="Gastos" value={money(report.expense)} detail={`${report.expenseCount} movimientos`} icon={ReceiptText} tone="orange" /><MetricCard label="Resultado neto" value={money(report.income - report.expense)} detail={`${percent(report.income, report.oldIncome)}% ingresos`} icon={report.income >= report.expense ? ArrowUpRight : ArrowDownRight} tone={report.income >= report.expense ? "red" : "orange"} /></section>

    <section className="panel"><div className="mb-6"><h2 className="section-title">Evolución del período</h2><p className="mt-1 text-xs text-slate-500">Agregación realizada en PostgreSQL cuando hay conexión Cloud.</p></div><div className="h-[320px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#DADADA" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: "#737373" }} interval={period === "month" ? 2 : 0} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `$${Math.round(value / 1000)}k`} tick={{ fontSize: 11, fill: "#737373" }} axisLine={false} tickLine={false} width={48} /><Tooltip content={<ChartTooltip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 14 }} /><Bar dataKey="Membresías" stackId="income" fill="#E30613" radius={[4, 4, 0, 0]} /><Bar dataKey="Ventas" stackId="income" fill="#9E0710" radius={[4, 4, 0, 0]} /><Bar dataKey="Gastos" fill="#282828" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section>

    <section className="grid gap-5 lg:grid-cols-2"><Breakdown title="Ventas por producto" empty="No se registraron ventas de productos." rows={report.saleGroups} max={maxBreakdown} color="bg-[#E30613]" /><Breakdown title="Gastos por categoría" empty="No se registraron gastos." rows={report.expenseGroups} max={maxBreakdown} color="bg-[#282828]" /></section>

    <section className="panel"><div className="flex items-center justify-between gap-3"><div><h2 className="section-title">Movimientos del período</h2><p className="mt-1 text-xs text-slate-500">{limitedRows ? `Mostrando los ${report.tx.length} más recientes de ${report.transactionCount}. Los totales incluyen todos.` : "Ingresos, ventas y egresos registrados."}</p></div><span className="status status-ok"><CalendarDays className="mr-1 size-3" /> {report.transactionCount} operaciones</span></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="table-head"><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Medio</th><th className="text-right">Importe</th></tr></thead><tbody className="divide-y divide-slate-100">{report.tx.map((item) => <tr key={item.id}><td className="py-4 text-sm text-slate-500">{item.date ? new Date(`${String(item.date).slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "—"}</td><td className="font-bold text-slate-800">{item.detail}</td><td><span className="status status-ok">{item.category}</span></td><td className="text-sm text-slate-500">{item.method}</td><td className={`text-right font-black ${item.type === "income" ? "text-[#E30613]" : "text-[#282828]"}`}>{item.type === "income" ? "+" : "−"} {money(item.amount)}</td></tr>)}</tbody></table>{!report.tx.length && <p className="py-12 text-center text-sm text-slate-400">No hay movimientos en este período.</p>}</div></section>
  </div>;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-black/10 bg-white p-3 shadow-xl"><p className="mb-2 text-xs font-black uppercase text-slate-500">{label}</p>{payload.map((item) => <p key={item.dataKey} className="text-sm font-bold" style={{ color: item.color }}>{item.dataKey}: {money(item.value)}</p>)}</div>;
}

function Breakdown({ title, empty, rows, max, color }) {
  return <article className="panel"><h2 className="section-title">{title}</h2><div className="mt-6 space-y-5">{rows.map(([label, value]) => <div key={label}><div className="mb-2 flex items-center justify-between gap-3 text-sm"><span className="font-bold text-slate-700">{label}</span><strong>{money(value)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#DADADA]"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(5, value / max * 100)}%` }} /></div></div>)}{!rows.length && <p className="py-8 text-center text-sm text-slate-400">{empty}</p>}</div></article>;
}
