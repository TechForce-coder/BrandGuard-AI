const styles = {
  'Approved':'bg-emerald-100 text-emerald-800',
  'Pending Approval':'bg-amber-100 text-amber-800',
  'Pending':'bg-amber-100 text-amber-800',
  'Needs Changes':'bg-rose-100 text-rose-700',
  'Draft':'bg-slate-100 text-slate-700',
  'Open':'bg-rose-100 text-rose-700',
  'Accepted':'bg-emerald-100 text-emerald-800',
  'Rejected':'bg-slate-100 text-slate-700',
  'Disputed':'bg-violet-100 text-violet-800'
};
export default function StatusBadge({ status }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'}`}>{status || 'Unknown'}</span>;
}