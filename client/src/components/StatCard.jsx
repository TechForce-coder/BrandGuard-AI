export default function StatCard({ label, value, note, accent = 'text-slate-950', icon: Icon }) {
  return (
    <section className="surface-card-hover p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-slate-500">{label}</p>
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100">
            <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className={`mt-4 text-[30px] font-semibold leading-none tracking-tight ${accent}`}>{value}</p>
      <p className="mt-2.5 text-xs leading-5 text-slate-500">{note}</p>
    </section>
  );
}