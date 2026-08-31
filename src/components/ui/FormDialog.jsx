"use client";

export default function FormDialog({ trigger, title, description, open, onOpenChange, children }) {
  return <>
    {trigger && <span onClick={() => onOpenChange?.(true)}>{trigger}</span>}
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onOpenChange?.(false); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90svh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-black uppercase text-[#050505]">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>
          <button type="button" onClick={() => onOpenChange?.(false)} className="grid size-9 shrink-0 place-items-center rounded-xl border border-black/10 text-xl text-slate-500" aria-label="Cerrar">×</button>
        </div>
        {children}
      </section>
    </div>}
  </>;
}
