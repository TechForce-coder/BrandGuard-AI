import { useEffect, useState } from 'react';
import { Activity, ClipboardList, ShieldCheck } from 'lucide-react';
import { api } from '../api/api.js';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getAudit()
      .then(result => { if (active) setLogs(Array.isArray(result) ? result : result?.logs || []); })
      .catch(reason => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-emerald-800">Governance & privacy</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Privacy &amp; Audit Log</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">A transparent timeline of recorded actions across the content approval workflow.</p>
      </header>
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs" onClick={() => setRefreshKey(key => key + 1)}>Retry</button>
        </div>
      )}
      <section className="surface-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><ShieldCheck size={18} /></span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Workspace activity</h2>
            <p className="mt-0.5 text-xs text-slate-500">{loading ? 'Loading audit events…' : `${logs.length} recorded ${logs.length === 1 ? 'event' : 'events'}`}</p>
          </div>
        </div>
        {loading ? (
          <div className="space-y-4 p-5 sm:p-6">{[1, 2, 3].map(item => <div key={item} className="flex gap-3"><div className="skeleton h-9 w-9 shrink-0 rounded-xl" /><div className="flex-1"><div className="skeleton h-4 w-40" /><div className="skeleton mt-2 h-3 w-64" /></div></div>)}</div>
        ) : logs.length ? (
          <ol className="divide-y divide-slate-100">
            {logs.map((log, index) => (
              <li key={log.id || index} className="flex items-start gap-3 px-5 py-5 transition-colors hover:bg-slate-50/70 sm:gap-4 sm:px-6">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500"><Activity size={17} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{log.action || log.event || 'Workflow event'}</p>
                  <p className="mt-1 text-sm text-slate-600">{log.item || log.resource || 'Workflow event'} <span className="text-slate-300">·</span> {log.actor || log.user || 'System'}</p>
                </div>
                <time className="shrink-0 pt-0.5 text-xs text-slate-400">{log.when || log.createdAt || '—'}</time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="px-5 py-14 text-center">
            <ClipboardList className="mx-auto text-slate-300" size={26} />
            <p className="mt-3 text-sm font-semibold text-slate-800">No activity recorded yet</p>
            <p className="mt-1 text-sm text-slate-500">Workflow events will appear here as they are recorded.</p>
          </div>
        )}
      </section>
    </div>
  );
}
