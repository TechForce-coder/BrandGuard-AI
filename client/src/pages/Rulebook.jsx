import { useEffect, useState } from 'react';
import { BookOpen, LockKeyhole, ShieldCheck } from 'lucide-react';
import { api } from '../api/api.js';

export default function Rulebook() {
  const [rules, setRules] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getRulebook()
      .then(result => { if (active) setRules(Array.isArray(result) ? result : result?.rules || []); })
      .catch(reason => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-emerald-800">Governance</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Guideline Library</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">The authoritative brand and policy guidance used to review submitted content.</p>
      </header>
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs" onClick={() => setRefreshKey(key => key + 1)}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3].map(item => <div key={item} className="surface-card p-6"><div className="skeleton h-4 w-24" /><div className="skeleton mt-4 h-5 w-48" /><div className="skeleton mt-4 h-16 w-full" /></div>)}</div>
      ) : rules.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rules.map((rule, index) => (
            <article key={rule.id || index} className="surface-card p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(18,43,29,0.07)] sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><BookOpen size={19} aria-hidden="true" /></span>
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">{rule.id || `RULE-${index + 1}`}</span>
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-950">{rule.title || rule.name || 'Brand guideline'}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{rule.description || rule.text || 'No description provided.'}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="surface-card px-5 py-14 text-center">
          <BookOpen className="mx-auto text-slate-300" size={26} />
          <p className="mt-3 text-sm font-semibold text-slate-800">No guidelines available</p>
          <p className="mt-1 text-sm text-slate-500">Guidelines will appear here when configured for this workspace.</p>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
        <LockKeyhole size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        <p className="text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700">Authoritative guidance.</span> Changes to these rules should be managed through an authorized backend workflow.</p>
        <ShieldCheck size={16} className="ml-auto mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
      </div>
    </div>
  );
}
