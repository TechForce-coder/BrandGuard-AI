export default function StatCard({ label, value, note, accent = 'text-slate-950', icon: Icon }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {Icon && <Icon size={19} className="text-slate-400" />}
    </div>
    <p className={`mt-2 text-3xl font-bold tracking-tight ${accent}`}>{value}</p>
    <p className="mt-1 text-sm text-slate-500">{note}</p>
  </section>;
}