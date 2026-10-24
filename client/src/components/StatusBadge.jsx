const styles = {
  'Approved': 'bg-emerald-100 text-emerald-800',
  'Pending Approval': 'bg-amber-100 text-amber-800',
  'Pending': 'bg-amber-100 text-amber-800',
  'Needs Changes': 'bg-rose-100 text-rose-700',
  'Draft': 'bg-slate-100 text-slate-700',
  'Open': 'bg-rose-100 text-rose-700',
  'Accepted': 'bg-emerald-100 text-emerald-800',
  'Rejected': 'bg-slate-100 text-slate-700',
  'Disputed': 'bg-blue-50 text-blue-800',
  'Valid': 'bg-emerald-50 text-emerald-800',
  'Expired': 'bg-rose-50 text-rose-700',
  'Inactive': 'bg-slate-100 text-slate-700',
  'Review mode': 'bg-violet-50 text-violet-700',
  'Active': 'bg-emerald-50 text-emerald-800',
  'Reviewing': 'bg-amber-50 text-amber-700'
};

export default function StatusBadge({ status }) {
  const normalized = status || 'Unknown';
  const style = styles[normalized] || 'bg-slate-100 text-slate-700';

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {normalized}
    </span>
  );
}