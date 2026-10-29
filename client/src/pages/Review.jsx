import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardCheck, RotateCcw, Search } from 'lucide-react';
import { api } from '../api/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
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

  return (
    <div className="space-y-6">
      <div>
        <p className="section-kicker">{role} workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Review Queue</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Inspect submitted content, review its findings, and record an approval decision.</p>
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
            <div className="flex gap-1.5 overflow-x-auto" role="group" aria-label="Filter by review status">
              {filters.map(status => (
                <button key={status} onClick={() => setFilter(status)} aria-pressed={filter === status} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${filter === status ? 'bg-blue-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>{status}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-slate-50/80 text-[11px] uppercase tracking-[.08em] text-slate-500">
              <tr>{['Content', 'Author', 'Status', 'Updated', 'Actions'].map(heading => <th key={heading} className="px-5 py-3.5 font-semibold">{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(draft => (
                <tr key={draft.id} className="transition-colors hover:bg-blue-50/50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{draft.title}</p>
                    <p className="mt-1 text-xs text-slate-500">#{draft.id} <span className="px-1 text-slate-300">·</span> {draft.channel || 'Unspecified'}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{draft.author || '—'}</td>
                  <td className="px-5 py-4"><StatusBadge status={draft.status} /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                    <time dateTime={draft.submittedAt || draft.updated || undefined}>{formatDateTime(draft.submittedAt || draft.updated)}</time>
                  </td>
                  <td className="min-w-64 px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs" onClick={() => navigate(`/drafts/${draft.id}`)}>Open draft <ArrowRight size={14} /></button>
                      {String(actualRole || role || '').toLowerCase() === 'manager' &&getReviewQueueActions(actualRole || role, draft).map(({ action, label }) => (
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
                    {String(actualRole || role || '').toLowerCase() === 'manager' &&draft.status === 'Pending Approval' &&getReviewQueueActions(actualRole || role, draft).length > 0 && (
                      <label className="mt-2 block">
                        <span className="sr-only">Review comment for {draft.title}</span>
                        <textarea
                          className="field min-h-16 w-full !py-2 text-xs"
                          value={comments[draft.id] || ''}
                          onChange={event => setComments(previous => ({
                            ...previous,
                            [draft.id]: event.target.value
                          }))}
                          placeholder="Comment required to request changes"
                          aria-label={`Review comment for ${draft.title}`}
                          disabled={previewMode || reviewingId === draft.id}
                        />
                      </label>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="space-y-3 p-5"><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-full" /></div>}
          {!loading && !error && rows.length === 0 && (
            <div className="px-5 py-14 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-800"><ClipboardCheck size={21} /></span>
              <p className="mt-3 text-sm font-semibold text-slate-800">{previewMode ? 'Queue data unavailable in preview' : 'No items in this view'}</p>
              <p className="mt-1 text-sm text-slate-500">{previewMode ? 'No reviewer-scoped submissions are loaded in a development preview.' : 'Try another status or search term. New submissions will appear here.'}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
