import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  Trash2,
  Workflow
} from 'lucide-react';

import { api } from '../api/api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import StatCard from '../components/StatCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { formatDateTime } from '../utils/formatDateTime.js';
import { WORKSPACE_CONFIG } from '../utils/workspacePreview.js';

const roleActions = {
  Creator: { label: 'New draft', to: '/drafts/new', icon: Plus },
  Reviewer: { label: 'Review queue', to: '/review', icon: ClipboardCheck },
  Manager: { label: 'Review queue', to: '/review', icon: ArrowRight },
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

function ApprovalGauge({ label, count, total, startColor, endColor, textColor, index, unavailable, loading }) {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  const [progress, setProgress] = useState(() => (
    reducedMotion && total > 0 ? Math.min(count / total, 1) : 0
  ));
  const [animatedCount, setAnimatedCount] = useState(() => (
    reducedMotion || unavailable ? count : 0
  ));
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
      aria-label={loading
        ? `${label}: loading`
        : unavailable
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
          {loading ? (
            <div className="flex flex-col items-center gap-1">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-2 w-12" />
            </div>
          ) : (
            <>
              <span className="approval-gauge__count" style={{ color: textColor }}>
                {unavailable ? '—' : animatedCount.toLocaleString()}
              </span>
              <span className="approval-gauge__percentage">
                {unavailable ? '—' : percent}% of total
              </span>
            </>
          )}
        </div>
      </div>
      <span className="approval-gauge__label">{label}</span>
    </div>
  );
}

export default function Dashboard({ role, actualRole = role, previewMode = false, showDrafts = false, user }) {
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
  const statsRequestRef = useRef(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingId, setDeletingId] = useState('');
  const [removingDraftIds, setRemovingDraftIds] = useState(() => new Set());

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
      statsRequestRef.current += 1;
      setStats(null);
      setStatsError('');
      return undefined;
    }

    const requestId = ++statsRequestRef.current;
    let active = true;
    setStatsError('');
    api.getDashboardStats()
      .then(result => {
        if (active && requestId === statsRequestRef.current) setStats(result);
      })
      .catch(reason => {
        if (!active || requestId !== statsRequestRef.current) return;
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
  const draft = Math.max(0, totalContent - pending - reviewed - flagged);
  const approvedPercent = totalContent > 0 ? Math.round((reviewed / totalContent) * 100) : 0;
  const pipelineSegments = [
    { label: 'Approved', count: reviewed, color: 'bg-[#047857]' },
    { label: 'Pending', count: pending, color: 'bg-[#d97706]' },
    { label: 'Flagged', count: flagged, color: 'bg-[#e11d48]' },
    { label: 'Draft', count: draft, color: 'bg-[#cbd5e1]' }
  ];
  const presentation = WORKSPACE_CONFIG[role] || WORKSPACE_CONFIG.Creator;
  const action = roleActions[role] || roleActions.Creator;
  const ActionIcon = action.icon;
  const dataUnavailable = previewMode || loading || Boolean(error);
  const statsUnavailable = previewMode || !stats || Boolean(statsError);
  const statsLoading = !stats && !previewMode && !statsError;
  const canDeleteDrafts = !previewMode && role === 'Creator' && actualRole === 'Creator';
  const firstName = String(user?.name || user?.email?.split('@')[0] || '').trim().split(/\s+/)[0] || 'there';
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';

  const confirmDeleteDraft = async () => {
    if (!deleteTarget || deletingId) return;

    const target = deleteTarget;
    setDeletingId(target.id);
    try {
      await api.deleteDraft(target.id);
      setRemovingDraftIds(current => new Set(current).add(target.id));
      setStats(current => current ? {
        ...current,
        totalContent: Math.max(0, current.totalContent - 1),
        needsChanges: Math.max(0, current.needsChanges - (target.status === 'Needs Changes' ? 1 : 0)),
        flaggedContent: Math.max(0, current.flaggedContent - (target.findingsCount > 0 ? 1 : 0))
      } : current);
      statsRequestRef.current += 1;
      setStatsRefresh(value => value + 1);

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.setTimeout(() => {
        setDrafts(current => current.filter(draft => draft.id !== target.id));
        setRemovingDraftIds(current => {
          const next = new Set(current);
          next.delete(target.id);
          return next;
        });
      }, prefersReducedMotion ? 0 : 240);
      toast.success('Draft deleted');
    } catch (reason) {
      toast.error(reason.message || 'Unable to delete draft.');
    } finally {
      setDeletingId('');
    }
  };

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
              {greeting}, {firstName}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              {presentation.dashboardDescription}
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center lg:min-w-[340px] lg:justify-end">
            <div className="w-full rounded-[20px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm md:w-[320px] md:shrink-0">
              <p className="section-kicker">Pipeline health</p>
              <div className="mt-3 flex items-center gap-4">
                <svg
                  className="h-16 w-16 shrink-0"
                  viewBox="0 0 64 64"
                  role="img"
                  aria-label={`${reviewed} of ${totalContent} items approved (${approvedPercent}%)`}
                >
                  <circle cx="32" cy="32" r="27" fill="none" stroke="#e2e8f0" strokeWidth="5" />
                  <circle
                    cx="32"
                    cy="32"
                    r="27"
                    fill="none"
                    stroke="#047857"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 27}
                    strokeDashoffset={2 * Math.PI * 27 * (1 - approvedPercent / 100)}
                    transform="rotate(-90 32 32)"
                    style={{ transition: 'stroke-dashoffset 600ms ease' }}
                  />
                  <text
                    x="32"
                    y="36"
                    textAnchor="middle"
                    className="fill-slate-900 text-[13px] font-bold"
                    aria-hidden="true"
                  >
                    {approvedPercent}%
                  </text>
                </svg>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Approved</p>
                  <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
                    {reviewed} <span className="text-lg font-medium text-slate-500">of {totalContent}</span>
                  </p>
                </div>
              </div>
              <div
                className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-200"
                role="img"
                aria-label={`${reviewed} of ${totalContent} items approved (${approvedPercent}%)`}
              >
                {totalContent > 0 ? pipelineSegments.filter(segment => segment.count > 0).map(segment => (
                  <span
                    key={segment.label}
                    className={segment.color}
                    style={{ width: `${(segment.count / totalContent) * 100}%` }}
                    title={`${segment.label}: ${segment.count}`}
                  />
                )) : <span className="h-full w-full bg-slate-200" title="No content yet" />}
              </div>
              {totalContent > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pipelineSegments.filter(segment => segment.label !== 'Draft' || segment.count > 0).map(segment => (
                    <span
                      key={segment.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-2 py-1 text-[11px] text-slate-600"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${segment.color}`} aria-hidden="true" />
                      {segment.label} {segment.count}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500">Submit a draft to get started</p>
              )}
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
          index={0}
          loading={statsLoading}
        />

        <StatCard
          label="Pending reviews"
          value={statsUnavailable ? '—' : pending}
          note="Awaiting a review decision"
          accent="text-warning-700"
          icon={Clock3}
          index={1}
          loading={statsLoading}
        />

        <StatCard
          label="Approved"
          value={statsUnavailable ? '—' : reviewed}
          note="Cleared through the workflow"
          accent="text-success-700"
          icon={CheckCircle2}
          index={2}
          loading={statsLoading}
        />

        <StatCard
          label="Flagged content"
          value={statsUnavailable ? '—' : flagged}
          note="Items with reported findings"
          accent="text-danger-600"
          icon={ShieldCheck}
          index={3}
          loading={statsLoading}
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
                  <tr
                    key={draft.id}
                    className={`dashboard-content-table__row transition-colors hover:bg-slate-50/70 ${
                      removingDraftIds.has(draft.id) ? 'dashboard-content-table__row--removing' : ''
                    }`}
                  >
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
                          ? 'bg-danger-100 text-danger-800'
                          : draft.findingsCount > 0
                            ? 'bg-warning-100 text-warning-800'
                            : 'bg-success-100 text-success-800'
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
                      <div className="dashboard-content-table__actions">
                        <button
                          type="button"
                          className="btn-secondary dashboard-content-table__button"
                          onClick={() => navigate(`/drafts/${draft.id}`)}
                        >
                          {role === 'Creator' && ['Draft', 'Needs Changes'].includes(draft.status) ? 'Edit' : 'Review'}
                        </button>
                        {canDeleteDrafts && ['Draft', 'Needs Changes'].includes(draft.status) && (
                          <button
                            type="button"
                            className="dashboard-content-table__delete"
                            aria-label={`Delete draft: ${draft.title || 'Untitled'}`}
                            title="Delete draft"
                            disabled={deletingId === draft.id}
                            onClick={() => setDeleteTarget(draft)}
                          >
                            {deletingId === draft.id
                              ? <span className="dashboard-content-table__delete-loading" aria-hidden="true" />
                              : <Trash2 size={14} aria-hidden="true" />}
                            <span>{deletingId === draft.id ? 'Deleting' : 'Delete'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr className="dashboard-content-table__empty">
                    <td colSpan="6" className="px-5 py-14 text-center">
                      {loading ? (
                        <div className="space-y-3" aria-label="Loading content">
                          <Skeleton className="mx-auto h-5 w-48" />
                          <Skeleton className="mx-auto h-4 w-64 max-w-full" />
                          <Skeleton className="mx-auto h-4 w-40" />
                        </div>
                      ) : (
                        <EmptyState
                          title={previewMode ? 'Workspace data unavailable in preview' : error ? 'Content unavailable' : 'No content found'}
                          description={previewMode
                            ? 'Role-scoped content is not loaded in development preview.'
                            : error
                              ? 'Workspace content could not be loaded.'
                              : 'Try another filter or create a new draft.'}
                          actionLabel={!previewMode && !error && role === 'Creator' ? 'Create content' : undefined}
                          onAction={() => navigate('/drafts/new')}
                        />
                      )}
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
                  startColor: 'var(--success-500)',
                  endColor: 'var(--success-700)',
                  textColor: 'var(--success-700)'
                },
                {
                  label: 'Pending approval',
                  count: pending,
                  startColor: 'var(--warning-500)',
                  endColor: 'var(--warning-700)',
                  textColor: 'var(--warning-700)'
                },
                {
                  label: 'Needs changes',
                  count: needs,
                  startColor: 'var(--danger-500)',
                  endColor: 'var(--danger-600)',
                  textColor: 'var(--danger-700)'
                }
              ].map((gauge, index) => (
                <ApprovalGauge
                  key={gauge.label}
                  {...gauge}
                  total={totalContent}
                  index={index}
                  unavailable={statsUnavailable}
                  loading={statsLoading}
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
                    <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="mt-2 h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityError ? (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-2">
                <EmptyState
                  compact
                  title="Activity unavailable"
                  description="Recent activity could not be loaded."
                  actionLabel="Try again"
                  onAction={() => setActivityRefresh(value => value + 1)}
                />
              </div>
            ) : activity.length ? (
              <ol className="mt-4 divide-y divide-slate-100">
                {activity.map((item, index) => (
                  <li key={item.id || index} className="recent-activity-item flex items-start gap-3 rounded-lg px-2 py-3 first:pt-1 last:pb-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
                      <Activity size={15} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.action || item.event || 'Workflow event'}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {item.item || item.draft?.title || item.resource || 'Workspace'} <span className="text-slate-300">·</span> {item.actor || item.user?.name || item.user?.email || item.user || 'System'}
                      </p>
                      {(item.resourceId || item.draft?.id || item.itemId) && (
                        <p className="mt-1 truncate font-mono text-[10px] text-slate-400" title={`ID: ${item.resourceId || item.draft?.id || item.itemId}`}>
                          #{String(item.resourceId || item.draft?.id || item.itemId).slice(-6)}
                        </p>
                      )}
                    </div>
                    {item.newStatus && <StatusBadge status={item.newStatus} />}
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
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-2">
                <EmptyState
                  compact
                  title="No activity recorded yet"
                  description="Recorded workflow events will appear here."
                />
              </div>
            )}
          </section>
        </aside>}
      </div>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this draft?"
        description={deleteTarget && (
          <>
            <span className="block font-medium text-slate-800">{deleteTarget.title || 'Untitled draft'}</span>
            <span className="mt-1 block">This cannot be undone.</span>
          </>
        )}
        confirmLabel="Delete draft"
        onConfirm={confirmDeleteDraft}
        onClose={() => {
          if (!deletingId) setDeleteTarget(null);
        }}
      />
    </div>
  );
}