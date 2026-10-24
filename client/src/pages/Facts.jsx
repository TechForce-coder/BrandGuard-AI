import { useEffect, useState } from 'react';
import { CalendarClock, FileCheck2 } from 'lucide-react';
import { api } from '../api/api.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Facts() {
  const [facts, setFacts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getFacts()
      .then(result => { if (active) setFacts(Array.isArray(result) ? result : result?.facts || []); })
      .catch(reason => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-emerald-800">Governance</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Approved Facts</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Verify approved claims and supporting references before they are used in brand content.</p>
      </header>
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs" onClick={() => setRefreshKey(key => key + 1)}>Retry</button>
        </div>
      )}
      <section className="surface-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-slate-900">Fact register</h2>
          <p className="mt-1 text-xs text-slate-500">
            {loading
              ? 'Loading approved facts…'
              : error
                ? 'Approved facts unavailable'
                : `${facts.length} ${facts.length === 1 ? 'reference' : 'references'}`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[.08em] text-slate-500">
              <tr>{['Fact / reference', 'Owner', 'Valid until', 'Status'].map(heading => <th className="px-5 py-3.5 font-semibold" key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facts.map((fact, index) => (
                <tr key={fact.id || index} className="transition-colors hover:bg-emerald-50/30">
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-2.5 font-semibold text-slate-800"><FileCheck2 size={17} className="shrink-0 text-emerald-700" />{fact.title || fact.name || 'Approved fact'}</span>
                    <p className="ml-[27px] mt-1 text-xs text-slate-400">{fact.id || '—'}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{fact.owner || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600"><span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />{fact.validUntil || fact.valid_until || '—'}</span></td>
                  <td className="px-5 py-4"><StatusBadge status={fact.status || 'Active'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="space-y-3 p-5"><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-full" /></div>}
          {!loading && !error && facts.length === 0 && (
            <div className="px-5 py-14 text-center">
              <FileCheck2 className="mx-auto text-slate-300" size={26} />
              <p className="mt-3 text-sm font-semibold text-slate-800">No approved facts yet</p>
              <p className="mt-1 text-sm text-slate-500">Verified references will appear here when added to the workspace.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
