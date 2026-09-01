"use client";

export default function FormDialog({ trigger, title, description, open, onOpenChange, children }) {
  return <>
    {trigger && <span onClick={() => onOpenChange?.(true)}>{trigger}</span>}
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:grid sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onOpenChange?.(false); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-h-[90svh] sm:max-w-xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-black/6 bg-white px-4 pb-4 pt-3 sm:border-0 sm:px-6 sm:pb-0 sm:pt-6">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0"><h2 className="text-lg font-black uppercase leading-tight text-[#050505] sm:text-xl">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{description}</p>}</div>
            <button type="button" onClick={() => onOpenChange?.(false)} className="grid size-9 shrink-0 place-items-center rounded-xl border border-black/10 text-xl text-slate-500" aria-label="Cerrar">×</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6 sm:pt-5">{children}</div>
      </section>
    </div>}
  </>;
}
