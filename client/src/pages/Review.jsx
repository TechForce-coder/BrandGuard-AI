import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  CheckCircle2, 
  ClipboardCheck, 
  RotateCcw, 
  Search, 
  GitCompare, 
  ChevronUp, 
  ChevronDown 
} from 'lucide-react';
import { api } from '../api/api.js';
import EmptyState from '../components/EmptyState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import DiffViewer from '../components/DiffViewer.jsx';
import { useToast } from '../components/Toast.jsx';
import { formatDateTime } from '../utils/formatDateTime.js';
import { getReviewQueueActions, submitReviewQueueAction } from '../utils/reviewQueueWorkflow.js';
import { canMutateInWorkspace } from '../utils/workspacePreview.js';

const filters = ['Pending Approval', 'Needs Changes', 'Approved', 'All'];

export default function Review({ role, actualRole = role, previewMode = false }) {
  const [drafts, setDrafts] = useState([]);
  const [filter, setFilter] = useState('Pending Approval');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewingId, setReviewingId] = useState('');
  const [comments, setComments] = useState({});
  const [expandedDiffId, setExpandedDiffId] = useState(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    if (previewMode) {
      setDrafts([]);
      setLoading(false);
      setError('');
      toast.info(`Review queue data is unavailable in this preview. The signed-in ${actualRole} account cannot access reviewer-scoped submissions.`);
      return () => { active = false; };
    }
    setLoading(true);
    setError('');
    api.getDrafts()
      .then(data => { if (active) setDrafts(data); })
      .catch(reason => {
        if (!active) return;
        const message = reason.message || 'Unable to load submissions.';
        setError(message);
        toast.error(message, {
          action: { label: 'Retry', onClick: () => setRefreshKey(key => key + 1) }
        });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [actualRole, previewMode, refreshKey, toast]);

  const rows = useMemo(() => drafts.filter(draft =>
    (filter === 'All' || draft.status === filter) &&
    `${draft.title || ''} ${draft.author || ''} ${draft.id || ''}`.toLowerCase().includes(search.toLowerCase())
  ), [drafts, filter, search]);
  const dataUnavailable = previewMode || loading || Boolean(error);

  async function handleReview(draft, action) {
    if (!canMutateInWorkspace(previewMode)) {
      toast.warning(`Review decisions are disabled in development preview. The authenticated account role is ${actualRole}.`);
      return;
    }
    try {
      setReviewingId(draft.id);
      setError('');
      await submitReviewQueueAction(
        api,
        role,
        draft,
        action,
        comments[draft.id] || ''
      );
      setComments(previous => ({ ...previous, [draft.id]: '' }));
      toast.success(action === 'approve'
        ? `"${draft.title}" approved successfully.`
        : `Changes requested for "${draft.title}".`);
      setRefreshKey(key => key + 1);
    } catch (reason) {
      const message = reason.message || 'Unable to submit the review decision.';
      setError(message);
      toast.error(message);
    } finally {
      setReviewingId('');
    }
  }

  const toggleDiff = (id) => {
    setExpandedDiffId(current => current === id ? null : id);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="section-kicker">{role} workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Review Queue</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Inspect submitted content, compare changes with original baseline, and record an approval decision.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="surface-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-slate-500">In queue</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{dataUnavailable ? '—' : drafts.filter(item => item.status === 'Pending Approval').length}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-slate-500">Needs changes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{dataUnavailable ? '—' : drafts.filter(item => item.status === 'Needs Changes').length}</p>
        </div>
        <div className="surface-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-slate-500">Approved</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{dataUnavailable ? '—' : drafts.filter(item => item.status === 'Approved').length}</p>
        </div>
      </div>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Submitted content</h2>
            <p className="mt-1 text-sm text-slate-500">
              {previewMode
                ? 'Review data unavailable in preview'
                : loading
                ? 'Loading submissions…'
                : error
                  ? ''
                  : `${rows.length} ${rows.length === 1 ? 'item' : 'items'} matching your filters`}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
              <input className="field !py-2 !pl-9" aria-label="Search reviews" placeholder="Search content" value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            <div className="horizontal-scroll-fade flex gap-1.5" role="group" aria-label="Filter by review status" tabIndex={0}>
              {filters.map(status => (
                <button key={status} onClick={() => setFilter(status)} aria-pressed={filter === status} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${filter === status ? 'bg-blue-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>{status}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="horizontal-scroll-fade" role="region" aria-label="Submitted content table; scroll horizontally on small screens" tabIndex={0}>
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[.08em] text-slate-500">
              <tr>{['Content', 'Author', 'Status', 'Updated', 'Actions'].map(heading => <th key={heading} className="px-5 py-3.5 font-semibold">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(draft => (
                <tr key={draft.id} className="transition-colors hover:bg-blue-50/30">
                  <td colSpan={5} className="p-0">
                    <div className="flex flex-col">
                      <div className="grid grid-cols-12 items-center px-5 py-4">
                        <div className="col-span-4 pr-4">
                          <p className="font-semibold text-slate-900">{draft.title}</p>
                          <p className="mt-1 text-xs text-slate-500">#{draft.id} <span className="px-1 text-slate-300">·</span> {draft.channel || 'Unspecified'}</p>
                        </div>
                        <div className="col-span-2 text-slate-600 text-sm">{draft.author || '—'}</div>
                        <div className="col-span-2"><StatusBadge status={draft.status} /></div>
                        <div className="col-span-2 whitespace-nowrap text-xs text-slate-500">
                          <time dateTime={draft.submittedAt || draft.updated || undefined}>{formatDateTime(draft.submittedAt || draft.updated)}</time>
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="btn-secondary !min-h-8 !px-2.5 !py-1.5 !text-xs"
                            onClick={() => toggleDiff(draft.id)}
                            title="Toggle Revision Comparison"
                          >
                            <GitCompare size={14} />
                            {expandedDiffId === draft.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button type="button" className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs" onClick={() => navigate(`/drafts/${draft.id}`)}>
                            Open <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Side-by-Side Diff Expansion Panel */}
                      {expandedDiffId === draft.id && (
                        <div className="border-t border-slate-100 bg-slate-50/70 p-5">
                          <DiffViewer
                            originalContent={draft.originalContent || draft.content}
                            currentContent={draft.content}
                          />
                        </div>
                      )}

                      {/* Manager Action & Comments Footer Row */}
                      {String(actualRole || role || '').toLowerCase() === 'manager' && (
                        <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/40 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            {getReviewQueueActions(actualRole || role, draft).map(({ action, label }) => (
                              <button
                                key={action}
                                type="button"
                                className={action === 'approve'
                                  ? 'btn-primary !min-h-8 !px-3 !py-1.5 !text-xs'
                                  : 'btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs'}
                                disabled={previewMode || reviewingId === draft.id}
                                onClick={() => handleReview(draft, action)}
                              >
                                {action === 'approve' ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}
                                {reviewingId === draft.id ? 'Saving…' : label}
                              </button>
                            ))}
                          </div>
                          {draft.status === 'Pending Approval' && getReviewQueueActions(actualRole || role, draft).length > 0 && (
                            <div className="w-full sm:max-w-md">
                              <textarea
                                className="field min-h-12 w-full !py-1.5 text-xs"
                                value={comments[draft.id] || ''}
                                onChange={event => setComments(previous => ({
                                  ...previous,
                                  [draft.id]: event.target.value
                                }))}
                                placeholder="Comment required to request changes"
                                aria-label={`Review comment for ${draft.title}`}
                                disabled={previewMode || reviewingId === draft.id}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="space-y-3 p-5" aria-label="Loading submissions"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
          {!loading && !error && rows.length === 0 && (
            <div className="px-5 py-8">
              <EmptyState
                title={previewMode ? 'Queue data unavailable in preview' : 'No items in this view'}
                description={previewMode ? 'No reviewer-scoped submissions are loaded in a development preview.' : 'Try another status or search term. New submissions will appear here.'}
                actionLabel={!previewMode ? 'Show all submissions' : undefined}
                onAction={!previewMode ? () => { setFilter('All'); setSearch(''); } : undefined}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}