import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow
} from 'lucide-react';

import { api } from '../api/api.js';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const rolePresentation = {
  Creator: {
    label: 'CREATOR WORKSPACE',
    title: 'My Content Workspace',
    description: 'Keep brand standards in view from first draft through final approval.',
    contentTitle: 'Your content',
    contentDescription: 'Open an item to see its status and continue the workflow.'
  },
  Reviewer: {
    label: 'REVIEWER WORKSPACE',
    title: 'Review Workspace',
    description: 'Review submitted content and record decisions using the existing workflow.',
    contentTitle: 'Submitted content',
    contentDescription: 'Open a submission to review its findings and record a decision.'
  },
  Manager: {
    label: 'MANAGER WORKSPACE',
    title: 'Governance Overview',
    description: 'Monitor workflow progress and content status across the workspace.',
    contentTitle: 'Governed content',
    contentDescription: 'Review content status and open an item to continue the workflow.'
  },
  Admin: {
    label: 'ADMIN WORKSPACE',
    title: 'Administration Overview',
    description: 'Monitor content governance, policy findings, and workflow status.',
    contentTitle: 'Content overview',
    contentDescription: 'Review content status and open an item to continue the workflow.'
  }
};

export default function Dashboard({ role }) {
  const [drafts, setDrafts] = useState([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  const load = async () => {
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
      setError(e.message || 'Unable to load drafts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  
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


  const pending = drafts.filter(
    (draft) => draft.status === 'Pending Approval'
  ).length;

  const reviewed = drafts.filter(
    (draft) => draft.status === 'Approved'
  ).length;

  const needs = drafts.filter(
    (draft) => draft.status === 'Needs Changes'
  ).length;
  const flagged = drafts.filter((draft) => draft.findingsCount > 0).length;
  const presentation = rolePresentation[role] || rolePresentation.Creator;
  const dataUnavailable = loading || Boolean(error);

  return (
    <div className="space-y-6">
      <section className="surface-card overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-bold tracking-[.1em] text-emerald-800">
              <Sparkles size={13} aria-hidden="true" />
              {presentation.label}
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {presentation.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
              {presentation.description}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:min-w-[340px] lg:justify-end">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-5 py-4 sm:min-w-[150px]">
              <p className="section-kicker">Pipeline health</p>
              <p className="mt-2 text-sm text-slate-500">Approved</p>
              <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-950">{dataUnavailable ? '—' : reviewed}</p>
            </div>
            {role === 'Creator' && (
              <button
                className="btn-success sm:min-h-[48px]"
                onClick={() => navigate('/drafts/new')}
              >
                <Plus size={17} aria-hidden="true" />
                Create content
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <span>{error}</span>
          <button
            type="button"
            className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs"
            onClick={load}
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total content"
          value={dataUnavailable ? '—' : drafts.length}
          note="Items in this workspace"
          icon={FileText}
        />

        <StatCard
          label="Pending reviews"
          value={dataUnavailable ? '—' : pending}
          note="Awaiting a review decision"
          accent="text-amber-600"
          icon={Clock3}
        />

        <StatCard
          label="Approved"
          value={dataUnavailable ? '—' : reviewed}
          note="Cleared through the workflow"
          accent="text-emerald-700"
          icon={CheckCircle2}
        />

        <StatCard
          label="Flagged content"
          value={dataUnavailable ? '—' : flagged}
          note="Items with reported findings"
          accent="text-rose-600"
          icon={ShieldCheck}
        />
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <section className="surface-card min-w-0 overflow-hidden">
          <div className="space-y-4 border-b border-slate-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">{presentation.contentTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {presentation.contentDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/drafts')}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-emerald-800 hover:text-emerald-950"
              >
                View all <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="relative max-w-sm">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="field !py-2 !pl-9"
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
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    filter === status
                      ? 'bg-emerald-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {['Content item', 'Author', 'Findings', 'Status', 'Updated', ''].map((heading, index) => (
                    <th key={`${heading}-${index}`} className="px-4 py-3.5 font-semibold sm:px-5">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((draft) => (
                  <tr key={draft.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4 sm:px-5">
                      <p className="font-semibold text-slate-900">{draft.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Channel: <span className="text-emerald-700">{draft.channel || 'Unspecified'}</span>
                        {' · '}ID: #{draft.id || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-600 sm:px-5">{draft.author}</td>
                    <td className="px-4 py-4 sm:px-5">
                      <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                        draft.findingsCount
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}>
                        {draft.findingsCount} {draft.findingsCount ? 'violations' : 'issues'}
                      </span>
                    </td>
                    <td className="px-4 py-4 sm:px-5"><StatusBadge status={draft.status} /></td>
                    <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500 sm:px-5">
                      {draft.updated ? new Date(draft.updated).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-4 sm:px-5">
                      <button
                        className="btn-secondary !px-3 !py-1.5"
                        onClick={() => navigate(`/drafts/${draft.id}`)}
                      >
                        {role === 'Creator' && draft.status === 'Draft' ? 'Edit' : 'Review'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan="6" className="px-5 py-14 text-center">
                      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <FileText size={21} aria-hidden="true" />
                      </span>
                      <p className="mt-3 font-semibold text-slate-800">
                        {error ? 'Content unavailable' : loading ? 'Loading content…' : 'No content found'}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {error
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

        <aside className="space-y-6">
          <section className="surface-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Approval progress</h2>
                <p className="mt-1 text-sm text-slate-500">Current content status at a glance.</p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800">
                <Workflow size={17} aria-hidden="true" />
              </span>
            </div>
            <div className="mt-5 space-y-4">
              {[
                { label: 'Approved', value: reviewed, color: 'bg-emerald-500', text: 'text-emerald-700' },
                { label: 'Pending approval', value: pending, color: 'bg-amber-400', text: 'text-amber-700' },
                { label: 'Needs changes', value: needs, color: 'bg-rose-400', text: 'text-rose-700' }
              ].map(({ label, value, color, text }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5 text-sm text-slate-600">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                    {label}
                  </span>
                  <span className={`text-sm font-semibold ${text}`}>{dataUnavailable ? '—' : value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-card p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Recent activity</h2>
              <p className="mt-1 text-sm text-slate-500">Activity data is unavailable in the current backend.</p>
            </div>
            <div className="py-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Activity size={21} aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-700">Activity feed unavailable</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}