import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow
} from 'lucide-react';

import { api } from '../api/api.js';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { formatDateTime } from '../utils/formatDateTime.js';
import { WORKSPACE_CONFIG } from '../utils/workspacePreview.js';

const roleActions = {
  Creator: { label: 'Create content', to: '/drafts/new', icon: Plus },
  Reviewer: { label: 'Open review queue', to: '/review', icon: ClipboardCheck },
  Manager: { label: 'Open approval workflow', to: '/review', icon: ArrowRight },
  Admin: { label: 'Administration', to: '/settings', icon: Settings }
};

function formatContentUpdated(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function ApprovalGauge({ label, count, total, startColor, endColor, textColor, index, unavailable }) {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  const [progress, setProgress] = useState(0);
  const [animatedCount, setAnimatedCount] = useState(count);
  const gradientId = `approval-gauge-${useId().replace(/:/g, '')}`;
  const ratio = total > 0 ? Math.min(count / total, 1) : 0;
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  const circumference = 2 * Math.PI * 42;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateReducedMotion = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', updateReducedMotion);
    return () => mediaQuery.removeEventListener('change', updateReducedMotion);
  }, []);

  useEffect(() => {
    if (unavailable) {
      setProgress(0);
      setAnimatedCount(count);
      return undefined;
    }

    if (reducedMotion) {
      setProgress(ratio);
      setAnimatedCount(count);
      return undefined;
    }

    setProgress(0);
    setAnimatedCount(0);
    const progressFrame = window.requestAnimationFrame(() => setProgress(ratio));
    let animationFrame;
    let startTime;
    const delay = window.setTimeout(() => {
      const animateCount = timestamp => {
        if (startTime === undefined) startTime = timestamp;
        const elapsed = Math.min((timestamp - startTime) / 900, 1);
        const eased = 1 - ((1 - elapsed) ** 3);
        setAnimatedCount(Math.round(count * eased));
        if (elapsed < 1) {
          animationFrame = window.requestAnimationFrame(animateCount);
        }
      };
      animationFrame = window.requestAnimationFrame(animateCount);
    }, index * 120);

    return () => {
      window.cancelAnimationFrame(progressFrame);
      window.clearTimeout(delay);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [count, index, ratio, reducedMotion, unavailable]);

  return (
    <div
      className="approval-gauge"
      role="img"
      aria-label={unavailable
        ? `${label}: data unavailable`
        : `${label}: ${count} of ${total} items, ${percent} percent`}
      tabIndex={0}
      style={{ '--gauge-delay': `${index * 120}ms` }}
    >
      <span className="approval-gauge__tooltip" role="tooltip" aria-hidden="true">
        {count} of {total} items ({percent}%)
      </span>
      <div className="approval-gauge__visual">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={startColor} />
              <stop offset="100%" stopColor={endColor} />
            </linearGradient>
          </defs>
          <circle className="approval-gauge__track" cx="50" cy="50" r="42" />
          {count > 0 && total > 0 && (
            <>
              <circle
                className="approval-gauge__arc"
                cx="50"
                cy="50"
                r="42"
                transform="rotate(-90 50 50)"
                stroke={`url(#${gradientId})`}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
              />
              <g
                className="approval-gauge__knob"
                style={{ transform: `rotate(${progress * 360}deg)` }}
              >
                <circle
                  cx="50"
                  cy="8"
                  r="4.5"
                  fill={endColor}
                  stroke="white"
                  strokeWidth="2.5"
                />
              </g>
            </>
          )}
        </svg>
        <div className="approval-gauge__center">
          <span className="approval-gauge__count" style={{ color: textColor }}>
            {unavailable ? '—' : animatedCount.toLocaleString()}
          </span>
          <span className="approval-gauge__percentage">
            {unavailable ? '—' : percent}% of total
          </span>
        </div>
      </div>
      <span className="approval-gauge__label">{label}</span>
    </div>
  );
}

export default function Dashboard({ role, actualRole = role, previewMode = false, showDrafts = false }) {
  const [drafts, setDrafts] = useState([]);
  const [filter, setFilter] = useState(['Manager', 'Reviewer'].includes(role) ? 'Pending Approval' : 'All');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState([]);
  const [activityError, setActivityError] = useState('');
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityRefresh, setActivityRefresh] = useState(0);
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState('');
  const [statsRefresh, setStatsRefresh] = useState(0);

  const navigate = useNavigate();
  const { toast } = useToast();

  const load = async () => {
    if (previewMode) {
      setDrafts([]);
      setLoading(false);
      setError('');
      return;
    }
    try {
      setLoading(true);
      setError('');

      const data = await api.getDrafts();

      // Support both array and { drafts: [...] } responses
      const items = Array.isArray(data)
        ? data
        : data?.drafts || [];

      // Normalize MongoDB documents for the dashboard
      
    setDrafts(
      items.map((draft) => {
        const findings = Array.isArray(draft.findings)
          ? draft.findings
          : [];

        const openFindingsCount = findings.filter((finding) => {
            const status = String(finding.status || "Open").toLowerCase();

            return status === "open";
        }).length;

        return {
          ...draft,
          id: String(draft.id || draft._id || ''),
          author:
            typeof draft.author === 'object' && draft.author !== null
              ? draft.author.name || 'Unknown'
              : draft.author || 'You',
          findings,
          findingsCount: openFindingsCount,
          updated: draft.updated || draft.updatedAt || ''
        };
      })
    );

    } catch (e) {
      const message = e.message || 'Unable to load drafts';
      setError(message);
      toast.error(message, { action: { label: 'Retry', onClick: load } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [role, previewMode]);

  useEffect(() => {
    if (previewMode) {
      setStats(null);
      setStatsError('');
      return undefined;
    }

    let active = true;
    setStats(null);
    setStatsError('');
    api.getDashboardStats()
      .then(result => { if (active) setStats(result); })
      .catch(reason => {
        if (!active) return;
        const message = reason.message || 'Unable to load dashboard statistics.';
        setStatsError(message);
        toast.error(message, {
          action: { label: 'Retry statistics', onClick: () => setStatsRefresh(value => value + 1) }
        });
      });
    return () => { active = false; };
  }, [role, previewMode, statsRefresh, toast]);

  useEffect(() => {
    setFilter(['Manager', 'Reviewer'].includes(role) ? 'Pending Approval' : 'All');
  }, [role]);

  useEffect(() => {
    if (previewMode) {
      setActivity([]);
      setActivityError('');
      setActivityLoading(false);
      return undefined;
    }
    if (!['Creator', 'Reviewer', 'Manager', 'Admin'].includes(role)) {
      setActivity([]);
      setActivityError('');
      setActivityLoading(false);
      return undefined;
    }

    let active = true;
    setActivityLoading(true);
    setActivityError('');

    (role === 'Creator' ? api.getDraftActivity() : api.getAudit())
      .then(result => {
        if (!active) return;
        const items = Array.isArray(result) ? result : result?.logs || [];
        setActivity(items.slice(0, 4));
      })
      .catch(reason => {
        if (!active) return;
        const message = reason.message || 'Unable to load audit activity.';
        setActivityError(message);
        toast.error(message, {
          action: { label: 'Retry', onClick: () => setActivityRefresh(value => value + 1) }
        });
      })
      .finally(() => {
        if (active) setActivityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [role, activityRefresh, previewMode, toast]);

  useEffect(() => {
    if (previewMode) {
      toast.info(`Dashboard data is unavailable in this ${role} preview. The signed-in ${actualRole} account cannot access ${role}-scoped data.`);
    }
  }, [actualRole, previewMode, role, toast]);

const visible = useMemo(() => {
  return drafts.filter((draft) => {
    // Reviewers should see only submitted content.
    const isReviewer = role === 'Reviewer';

    const isSubmitted =
      draft.status === 'Pending Approval' ||
      draft.status === 'Needs Changes' ||
      draft.status === 'Approved';

    const matchesRole =
      !isReviewer || isSubmitted;

    const matchesFilter =
      filter === 'All' || draft.status === filter;

    const searchableText = [
      draft.title,
      draft.author,
      draft.channel,
      draft.id
    ]
      .join(' ')
      .toLowerCase();

    return (
      matchesRole &&
      matchesFilter &&
      searchableText.includes(search.toLowerCase())
    );
  });
}, [drafts, filter, search, role]);


  const pending = stats?.pendingReviews ?? 0;
  const reviewed = stats?.approvedContent ?? 0;
  const needs = stats?.needsChanges ?? 0;
  const totalContent = stats?.totalContent ?? 0;
  const flagged = stats?.flaggedContent ?? 0;
  const presentation = WORKSPACE_CONFIG[role] || WORKSPACE_CONFIG.Creator;
  const action = roleActions[role] || roleActions.Creator;
  const ActionIcon = action.icon;
  const dataUnavailable = previewMode || loading || Boolean(error);
  const statsUnavailable = previewMode || !stats || Boolean(statsError);

  return (
    <div className="space-y-6">
      {showDrafts ? (
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="section-kicker">{presentation.dashboardLabel}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {role === 'Creator' ? 'My Drafts' : presentation.contentTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {presentation.contentDescription}
            </p>
          </div>
          {role === 'Creator' && (
            <button type="button" className="btn-primary shrink-0" onClick={() => navigate('/drafts/new')}>
              <Plus size={17} aria-hidden="true" />
              Create content
            </button>
          )}
        </section>
      ) : (
      <section className="surface-card overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold tracking-[.1em] text-blue-800">
              <Sparkles size={13} aria-hidden="true" />
              {presentation.dashboardLabel}
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {presentation.dashboardTitle}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              {presentation.dashboardDescription}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:min-w-[340px] lg:justify-end">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4 sm:min-w-[150px]">
              <p className="section-kicker">Pipeline health</p>
              <p className="mt-2 text-sm text-slate-500">Approved</p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-950">{dataUnavailable ? '—' : reviewed}</p>
            </div>
            <button
              className="btn-primary sm:min-h-[48px]"
              onClick={() => navigate(action.to)}
            >
              <ActionIcon size={17} aria-hidden="true" />
              {action.label}
            </button>
          </div>
        </div>
      </section>
      )}

      {!showDrafts && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total content"
          value={statsUnavailable ? '—' : stats.totalContent}
          note={role === 'Creator' ? 'Your content items' : 'Workspace content items'}
          icon={FileText}
        />

        <StatCard
          label="Pending reviews"
          value={statsUnavailable ? '—' : pending}
          note="Awaiting a review decision"
          accent="text-amber-600"
          icon={Clock3}
        />

        <StatCard
          label="Approved"
          value={statsUnavailable ? '—' : reviewed}
          note="Cleared through the workflow"
          accent="text-emerald-700"
          icon={CheckCircle2}
        />

        <StatCard
          label="Flagged content"
          value={statsUnavailable ? '—' : flagged}
          note="Items with reported findings"
          accent="text-rose-600"
          icon={ShieldCheck}
        />
      </div>}

      <div className={`grid min-w-0 gap-6 ${showDrafts ? '' : 'xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]'}`}>
        <section className="surface-card min-w-0">
          <div className="space-y-4 border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">{presentation.contentTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {presentation.contentDescription}
                </p>
              </div>
              {!showDrafts && <button
                type="button"
                onClick={() => navigate('/drafts')}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-blue-800 hover:text-blue-950"
              >
                View all <ArrowRight size={15} aria-hidden="true" />
              </button>}
            </div>

            <div className="relative max-w-sm">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="field !py-2 !pl-9"
                aria-label="Search content"
                placeholder="Search content"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                'All',
                'Needs Changes',
                'Pending Approval',
                'Approved',
                'Draft'
              ].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  aria-pressed={filter === status}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    filter === status
                      ? 'bg-blue-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <table className="dashboard-content-table w-full text-left text-sm" aria-label="Content items">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {['Content item', 'Author', 'Findings', 'Status', 'Updated', ''].map((heading, index) => (
                    <th key={`${heading}-${index}`} scope="col" className="px-3 py-3.5 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((draft) => (
                  <tr key={draft.id} className="transition-colors hover:bg-slate-50/70">
                    <td data-label="Content item" aria-label={`Content item: ${draft.title || 'Untitled'}`} className="dashboard-content-table__item px-3 py-3">
                      <p className="dashboard-content-table__title font-semibold text-slate-900" title={draft.title || 'Untitled'}>
                        {draft.title || 'Untitled'}
                      </p>
                      <p className="dashboard-content-table__meta mt-1 text-xs text-slate-500">
                        <span title={`Channel: ${draft.channel || 'Unspecified'}`}>
                          Channel: <span className="text-blue-700">{draft.channel || 'Unspecified'}</span>
                        </span>
                        <span title={`ID: ${draft.id || '—'}`}>
                          <span className="sr-only">ID: {draft.id || '—'}</span>
                          #{draft.id ? String(draft.id).slice(-6) : '—'}
                        </span>
                      </p>
                    </td>
                    <td data-label="Author" aria-label={`Author: ${draft.author || '—'}`} className="dashboard-content-table__author px-3 py-3 text-slate-600">
                      <span title={draft.author || '—'}>{draft.author || '—'}</span>
                    </td>
                    <td data-label="Findings" aria-label={`Findings: ${draft.findingsCount} ${draft.findingsCount === 1 ? 'issue' : 'issues'}`} className="dashboard-content-table__findings px-3 py-3">
                      <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        draft.findingsCount >= 3
                          ? 'bg-rose-100 text-rose-800'
                          : draft.findingsCount > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden="true" />
                        {draft.findingsCount} {draft.findingsCount === 1 ? 'issue' : 'issues'}
                      </span>
                    </td>
                    <td data-label="Status" aria-label={`Status: ${draft.status}`} className="dashboard-content-table__status px-3 py-3">
                      <StatusBadge status={draft.status} />
                    </td>
                    <td data-label="Updated" aria-label={`Updated: ${formatDateTime(draft.updated)}`} className="dashboard-content-table__updated whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                      <time dateTime={draft.updated || undefined} title={formatDateTime(draft.updated)}>
                        {formatContentUpdated(draft.updated)}
                      </time>
                    </td>
                    <td data-label="Actions" className="dashboard-content-table__action px-1.5 py-3">
                      <button
                        type="button"
                        className="btn-secondary dashboard-content-table__button"
                        onClick={() => navigate(`/drafts/${draft.id}`)}
                      >
                        {role === 'Creator' && ['Draft', 'Needs Changes'].includes(draft.status) ? 'Edit' : 'Review'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr className="dashboard-content-table__empty">
                    <td colSpan="6" className="px-5 py-14 text-center">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <FileText size={21} aria-hidden="true" />
                      </span>
                      <p className="mt-3 font-semibold text-slate-800">
                        {previewMode ? 'Workspace data unavailable in preview' : error ? 'Content unavailable' : loading ? 'Loading content…' : 'No content found'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {previewMode
                          ? 'Role-scoped content is not loaded in development preview.'
                          : error
                          ? 'Workspace content could not be loaded.'
                          : loading
                            ? 'Content will appear here when available.'
                            : 'Try another filter or create a new draft.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {!showDrafts && <aside className="space-y-6">
          <section className="surface-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Approval progress</h2>
                <p className="mt-1 text-sm text-slate-500">Current content status at a glance.</p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-800">
                <Workflow size={17} aria-hidden="true" />
              </span>
            </div>
            <div className="approval-gauges mt-5">
              {[
                {
                  label: 'Approved',
                  count: reviewed,
                  startColor: '#34d399',
                  endColor: '#0f766e',
                  textColor: '#047857'
                },
                {
                  label: 'Pending approval',
                  count: pending,
                  startColor: '#fbbf24',
                  endColor: '#ea580c',
                  textColor: '#b45309'
                },
                {
                  label: 'Needs changes',
                  count: needs,
                  startColor: '#f472b6',
                  endColor: '#e11d48',
                  textColor: '#be123c'
                }
              ].map((gauge, index) => (
                <ApprovalGauge
                  key={gauge.label}
                  {...gauge}
                  total={totalContent}
                  index={index}
                  unavailable={statsUnavailable}
                />
              ))}
            </div>
            <p className="approval-gauge__total">
              {statsUnavailable
                ? 'Total content: —'
                : totalContent === 0
                  ? 'No content yet'
                  : `Total content: ${totalContent.toLocaleString()}`}
            </p>
          </section>

          <section className="surface-card p-5 sm:p-6">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Recent activity</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {role === 'Creator'
                      ? 'Recent decisions on your submitted content.'
                      : 'Latest recorded workspace events.'}
                  </p>
                </div>
                {['Reviewer', 'Manager', 'Admin'].includes(role) && (
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-blue-800 transition hover:text-blue-950"
                    onClick={() => navigate('/audit')}
                  >
                    View log
                  </button>
                )}
              </div>
            </div>
            {activityLoading ? (
              <div className="mt-5 space-y-4" aria-label="Loading recent activity">
                {[1, 2, 3].map(item => (
                  <div key={item} className="flex gap-3">
                    <div className="skeleton h-8 w-8 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="skeleton h-3.5 w-3/4" />
                      <div className="skeleton mt-2 h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityError ? null : activity.length ? (
              <ol className="mt-4 divide-y divide-slate-100">
                {activity.map((item, index) => (
                  <li key={item.id || index} className="flex items-start gap-3 py-3 first:pt-1 last:pb-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
                      <Activity size={15} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.action || item.event || 'Workflow event'}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {item.item || item.draft?.title || item.resource || 'Workspace'} <span className="text-slate-300">·</span> {item.actor || item.user?.name || item.user?.email || item.user || 'System'}
                      </p>
                    </div>
                    <time
                      className="shrink-0 pt-0.5 text-[11px] text-slate-400"
                      dateTime={item.when || item.createdAt || undefined}
                    >
                      {formatDateTime(item.when || item.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center">
                <Activity className="mx-auto text-slate-400" size={20} aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No activity recorded yet</p>
                <p className="mt-1 text-xs text-slate-500">Recorded workflow events will appear here.</p>
              </div>
            )}
          </section>
        </aside>}
      </div>
    </div>
  );
}