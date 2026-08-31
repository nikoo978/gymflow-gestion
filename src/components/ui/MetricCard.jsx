export default function MetricCard({ label, value, detail, icon: Icon, tone = "green" }) {
  const tones = {
    green: "bg-[#F5F5F5] text-[#282828]",
    red: "bg-red-50 text-[#E30613]",
    blue: "bg-[#DADADA] text-[#282828]",
    orange: "bg-[#DADADA] text-[#9E0710]",
  };

  return (
    <article className="rounded-[22px] border border-black/6 bg-white p-5 shadow-[0_8px_30px_rgba(24,52,38,0.055)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#050505]">{value}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{detail}</p>
        </div>
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tones[tone]}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}
