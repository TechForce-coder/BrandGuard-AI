import { useEffect, useState } from 'react';
import { Activity, ClipboardList, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../api/api.js';
import EmptyState from '../components/EmptyState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { formatDateTime } from '../utils/formatDateTime.js';

const actionPresentation = {
  Deleted: {
    Icon: Trash2,
    className: 'bg-rose-50 text-rose-700'
  }
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');

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

  const actions = [...new Set(logs.map(log => log.action).filter(Boolean))].sort();
  const visibleLogs = logs.filter(log => {
    const matchesAction = actionFilter === 'All' || log.action === actionFilter;
    const searchable = [
      log.action,
      log.item,
      log.resourceType,
      log.resourceId,
      log.actor,
      log.comment,
      log.previousStatus,
      log.newStatus
    ].join(' ').toLowerCase();
    return matchesAction && searchable.includes(search.toLowerCase());
  });

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header>
        <p className="section-kicker">Governance &amp; privacy</p>
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
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-800"><ShieldCheck size={18} /></span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Workspace activity</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {loading
                ? 'Loading audit events…'
                : error
                  ? 'Audit events unavailable'
                  : `${visibleLogs.length} of ${logs.length} recorded events`}
            </p>
          </div>
          <div className="ml-auto flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label>
              <span className="sr-only">Filter audit events by action</span>
              <select
                className="field !py-2"
                value={actionFilter}
                onChange={event => setActionFilter(event.target.value)}
                aria-label="Filter audit events by action"
              >
                <option>All</option>
                {actions.map(action => <option key={action}>{action}</option>)}
              </select>
            </label>
            <label className="relative block sm:w-56">
              <span className="sr-only">Search audit events</span>
              <input
                className="field !py-2"
                type="search"
                placeholder="Search events"
                value={search}
                onChange={event => setSearch(event.target.value)}
                aria-label="Search audit events"
              />
            </label>
          </div>
        </div>
        {loading ? (
          <div className="space-y-4 p-5 sm:p-6" aria-label="Loading activity">{[1, 2, 3].map(item => <div key={item} className="flex gap-3"><Skeleton className="h-9 w-9 shrink-0 rounded-xl" /><div className="flex-1"><Skeleton className="h-4 w-40" /><Skeleton className="mt-2 h-3 w-64" /></div></div>)}</div>
        ) : visibleLogs.length ? (
          <ol className="divide-y divide-slate-100">
            {visibleLogs.map((log, index) => {
              const presentation = actionPresentation[log.action] || {};
              const ActionIcon = presentation.Icon || Activity;
              return (
                <li key={log.id || index} className="flex items-start gap-3 px-5 py-5 transition-colors hover:bg-slate-50/70 sm:gap-4 sm:px-6">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${presentation.className || 'bg-slate-50 text-slate-500'}`}>
                    <ActionIcon size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{log.action || log.event || 'Workflow event'}</p>
                    <p className="mt-1 text-sm text-slate-600">{log.item || log.resource || 'Workflow event'} <span className="text-slate-300">·</span> {log.actor || log.user || 'System'}</p>
                    {log.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{log.comment}</p>}
                    {(log.previousStatus || log.newStatus || log.resourceId) && (
                      <p className="mt-2 text-xs text-slate-500">
                        {log.previousStatus && <>From {log.previousStatus}</>}
                        {log.previousStatus && log.newStatus && ' · '}
                        {log.newStatus && <>To {log.newStatus}</>}
                        {log.resourceId && <> · {log.resourceType || 'Entity'} ID: {log.resourceId}</>}
                      </p>
                    )}
                  </div>
                  <time
                    className="shrink-0 pt-0.5 text-xs text-slate-400"
                    dateTime={log.when || log.createdAt || undefined}
                  >
                    {formatDateTime(log.when || log.createdAt)}
                  </time>
                </li>
              );
            })}
          </ol>
        ) : error ? (
          <div className="px-5 py-14 text-center">
            <ClipboardList className="mx-auto text-slate-300" size={26} />
            <p className="mt-3 text-sm font-semibold text-slate-800">Activity unavailable</p>
            <p className="mt-1 text-sm text-slate-500">Audit events could not be loaded.</p>
          </div>
        ) : (
          <div className="px-5 py-8">
            <EmptyState
              title={logs.length ? 'No matching activity' : 'No activity recorded yet'}
              description={logs.length ? 'Adjust the search or action filter.' : 'Workflow events will appear here as they are recorded.'}
              actionLabel={logs.length ? 'Clear search' : undefined}
              onAction={logs.length ? () => setSearch('') : undefined}
            />
          </div>
        )}
      </section>
    </div>
  );
}
