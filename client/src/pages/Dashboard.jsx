import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, CheckCircle2, Clock3, FileText, Plus, Search, ShieldAlert,
  ShieldCheck, Sparkles, Workflow
} from 'lucide-react';
import { api } from '../api/api.js';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const filters = ['All', 'Needs Changes', 'Pending Approval', 'Approved', 'Draft'];

function EmptyState({ title, message }) {
  return (
    <div className="px-5 py-12 text-center">
      <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <FileText size={20} />
      </span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{message}</p>
    </div>
  );
}

export default function Dashboard({ role }) {
  const [drafts, setDrafts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [auditError, setAuditError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setAuditError('');
    Promise.all([
      api.getDrafts().then(data => {
        if (active) setDrafts(data);
      }).catch(reason => {
        if (active) setError(reason.message);
      }),
      api.getAudit().then(data => {
        if (active) setLogs(Array.isArray(data) ? data : data?.logs || []);
      }).catch(reason => {
        if (active) setAuditError(reason.message);
      })
    ]).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [refreshKey]);

  const visible = useMemo(() => drafts.filter(draft =>
    (filter === 'All' || draft.status === filter) &&
    `${draft.title || ''} ${draft.author || ''} ${draft.channel || ''} ${draft.id || ''}`.toLowerCase().includes(search.toLowerCase())
  ), [drafts, filter, search]);

  const pending = drafts.filter(draft => draft.status === 'Pending Approval').length;
  const approved = drafts.filter(draft => draft.status === 'Approved').length;
  const flagged = drafts.filter(draft => Number(draft.findingsCount) > 0).length;
  const needsChanges = drafts.filter(draft => draft.status === 'Needs Changes').length;
  const title = role === 'Creator'
    ? 'My Content Workspace'
    : role === 'Reviewer'
      ? 'Review Workspace'
      : role === 'Manager'
        ? 'Governance Overview'
        : 'Administration Overview';
  const progress = drafts.length ? Math.round((approved / drafts.length) * 100) : 0;

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[24px] border border-emerald-900/10 bg-white p-6 shadow-[0_4px_20px_rgba(18,43,29,0.04)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-50" />
        <div className="pointer-events-none absolute right-20 top-20 h-28 w-28 rounded-full border border-emerald-100/80" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-200 to-transparent" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[.13em] text-emerald-800">
              <Sparkles size={12} aria-hidden="true" /> {role} workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[34px]">{title}</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Keep brand standards in view from first draft through final approval.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-left shadow-[0_6px_18px_rgba(15,23,42,0.02)]">
              <p className="text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">Pipeline health</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xl font-semibold text-slate-900">{progress}%</span>
                <span className="text-xs text-slate-500">approved</span>
              </div>
            </div>
            <div className="relative flex flex-wrap gap-2">
              {role === 'Creator' && (
                <button className="btn-success" onClick={() => navigate('/drafts/new')}>
                  <Plus size={17} aria-hidden="true" /> Create content
                </button>
              )}
              {(role === 'Reviewer' || role === 'Manager') && (
                <button className="btn-success" onClick={() => navigate('/review')}>
                  <ClipboardActionIcon /> Open review queue
                </button>
              )}
              {role === 'Admin' && (
                <button className="btn-secondary" onClick={() => navigate('/settings')}>
                  <ShieldCheck size={16} aria-hidden="true" /> Administration
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs" onClick={() => setRefreshKey(key => key + 1)}>Retry</button>
        </div>
      )}

      <section aria-label="Content overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="surface-card p-5">
              <div className="skeleton h-3 w-28" />
              <div className="skeleton mt-4 h-8 w-16" />
              <div className="skeleton mt-3 h-3 w-36" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Total content" value={drafts.length} note="Items in this workspace" icon={FileText} />
            <StatCard label="Pending reviews" value={pending} note="Awaiting a review decision" accent="text-amber-700" icon={Clock3} />
            <StatCard label="Approved" value={approved} note="Cleared through the workflow" accent="text-emerald-800" icon={CheckCircle2} />
            <StatCard label="Flagged content" value={flagged} note="Items with reported findings" accent="text-rose-700" icon={ShieldAlert} />
          </>
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,.8fr)]">
        <section className="surface-card min-w-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  {role === 'Reviewer' ? 'Recent submissions' : role === 'Creator' ? 'Your content' : 'Content pipeline'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">Open an item to see its status and continue the workflow.</p>
              </div>
              <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 transition hover:text-emerald-950" onClick={() => navigate(role === 'Reviewer' || role === 'Manager' ? '/review' : '/drafts')}>
                View all <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block w-full lg:max-w-[260px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input className="field !py-2 !pl-9" aria-label="Search content" placeholder="Search content" value={search} onChange={event => setSearch(event.target.value)} />
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]" role="group" aria-label="Filter content by status">
                {filters.map(status => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    aria-pressed={filter === status}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      filter === status ? 'bg-emerald-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[.08em] text-slate-500">
                <tr>{['Content item', 'Author', 'Findings', 'Status', 'Updated', ''].map((heading, index) => <th key={`${heading}-${index}`} className="px-5 py-3.5 font-semibold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map(draft => (
                  <tr key={draft.id} className="transition-colors hover:bg-emerald-50/30">
                    <td className="px-5 py-4">
                      <p className="max-w-[290px] truncate font-semibold text-slate-900">{draft.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{draft.channel || 'Unspecified'} <span className="px-1 text-slate-300">·</span> #{draft.id}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{draft.author || 'You'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex min-w-8 justify-center rounded-lg px-2 py-1 text-xs font-semibold ${
                        Number(draft.findingsCount) ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
                      }`}>{Number(draft.findingsCount) || 0}</span>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={draft.status} /></td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{draft.updated || '—'}</td>
                    <td className="px-5 py-4">
                      <button className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs" onClick={() => navigate(`/drafts/${draft.id}`)}>
                        {role === 'Creator' && draft.status === 'Draft' ? 'Edit' : 'Open'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !error && visible.length === 0 && (
              <EmptyState title={search || filter !== 'All' ? 'No matching content' : 'No content yet'} message={search || filter !== 'All' ? 'Try changing the search or status filter.' : 'Content items will appear here when they are available.'} />
            )}
            {loading && <div className="space-y-3 p-5"><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-full" /></div>}
          </div>
        </section>

        <div className="space-y-5">
          <section className="surface-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Approval progress</h2>
                <p className="mt-1 text-sm text-slate-500">Current content status at a glance.</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><Workflow size={19} aria-hidden="true" /></span>
            </div>
            {loading ? <div className="skeleton mt-5 h-3 w-full" /> : (
              <>
                <div className="mt-6 flex items-end justify-between">
                  <span className="text-sm text-slate-600">Approved</span>
                  <span className="text-sm font-semibold text-slate-900">{approved} <span className="font-normal text-slate-500">of {drafts.length}</span></span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Approved content" aria-valuemin="0" aria-valuemax={drafts.length} aria-valuenow={approved}>
                  <div className="h-full rounded-full bg-emerald-700 transition-[width] duration-700 ease-out" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    ['Pending approval', pending, 'bg-amber-500'],
                    ['Needs changes', needsChanges, 'bg-rose-500'],
                    ['Approved', approved, 'bg-emerald-600']
                  ].map(([label, count, color]) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-600"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>
                      <span className="font-semibold text-slate-800">{count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="surface-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Recent activity</h2>
                <p className="mt-1 text-xs text-slate-500">Latest recorded audit events</p>
              </div>
              <button className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-emerald-800" aria-label="View audit log" onClick={() => navigate('/audit')}>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
            {auditError && (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-rose-700">
                <span>{auditError}</span>
                <button type="button" className="text-xs font-semibold text-emerald-800 hover:text-emerald-950" onClick={() => setRefreshKey(key => key + 1)}>Retry</button>
              </div>
            )}
            {logs.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {logs.slice(0, 4).map((log, index) => (
                  <li key={log.id || index} className="flex gap-3 px-5 py-4">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500"><Activity size={15} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{log.action || log.event || 'Workflow activity'}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{log.item || log.resource || 'Workflow event'} · {log.actor || log.user || 'System'}</p>
                    </div>
                    <time className="shrink-0 pt-0.5 text-[11px] text-slate-400">{log.when || log.createdAt || '—'}</time>
                  </li>
                ))}
              </ul>
            ) : !auditError && !loading ? (
              <EmptyState title="No recent activity" message="Recorded workflow events will appear here." />
            ) : loading ? (
              <div className="space-y-3 p-5"><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-full" /></div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

function ClipboardActionIcon() {
  return <CheckCircle2 size={16} aria-hidden="true" />;
}
