import { useEffect, useState } from 'react';
import { BookOpen, LockKeyhole, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { api } from '../api/api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Skeleton from '../components/Skeleton.jsx';
import { canMutateInWorkspace } from '../utils/workspacePreview.js';

const emptyForm = { title: '', description: '', status: 'Active' };

export default function Rulebook({ actualRole = '', previewMode = false }) {
  const [rules, setRules] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const canManage = canMutateInWorkspace(previewMode) &&
    ['manager', 'admin'].includes(String(actualRole).toLowerCase());

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

  const startCreate = () => {
    if (!canManage) return;
    setEditingId('');
    setForm(emptyForm);
    setFormOpen(true);
    setMessage('');
  };

  const startEdit = rule => {
    if (!canManage) return;
    setEditingId(String(rule._id || rule.id));
    setForm({
      title: rule.title || rule.name || '',
      description: rule.description || rule.text || '',
      status: rule.status || 'Active'
    });
    setFormOpen(true);
    setMessage('');
  };

  const save = async event => {
    event.preventDefault();
    if (!canManage) {
      setError('Guideline changes are disabled in development workspace preview.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (editingId) await api.updateRule(editingId, form);
      else await api.createRule(form);
      setFormOpen(false);
      setForm(emptyForm);
      setEditingId('');
      setMessage(editingId ? 'Guideline updated.' : 'Guideline created.');
      setRefreshKey(key => key + 1);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async rule => {
    if (!canManage) return;
    const id = String(rule._id || rule.id || '');
    if (!id) return;
    setError('');
    setMessage('');
    try {
      await api.deleteRule(id);
      setMessage('Guideline deleted.');
      setRefreshKey(key => key + 1);
    } catch (reason) {
      setError(reason.message);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="section-kicker">Governance</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Guideline Library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">The authoritative brand and policy guidance used to review submitted content.</p>
        </div>
        <button type="button" disabled={!canManage} className="btn-primary shrink-0" onClick={startCreate}>
          <Plus size={16} aria-hidden="true" /> Add guideline
        </button>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs" onClick={() => setRefreshKey(key => key + 1)}>Retry</button>
        </div>
      )}
      {message && <p role="status" className="rounded-lg border border-success-100 bg-success-50 px-4 py-3 text-sm text-success-800">{message}</p>}

      {formOpen && (
        <form onSubmit={save} className="surface-card space-y-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{editingId ? 'Edit guideline' : 'Add guideline'}</h2>
              <p className="mt-1 text-sm text-slate-500">Changes are saved to this organization’s workspace.</p>
            </div>
            <button type="button" className="icon-button" onClick={() => setFormOpen(false)} aria-label="Close guideline form"><X size={17} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Title
              <input className="field mt-1.5" required disabled={!canManage} maxLength={160} value={form.title} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Status
              <select className="field mt-1.5" disabled={!canManage} value={form.status} onChange={event => setForm(previous => ({ ...previous, status: event.target.value }))}>
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Guidance
            <textarea className="field mt-1.5 min-h-28 resize-y" required disabled={!canManage} maxLength={4000} value={form.description} onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!canManage || saving} className="btn-primary">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save guideline'}</button>
            <button type="button" disabled={saving} className="btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-label="Loading guidelines">{[1, 2, 3].map(item => <div key={item} className="surface-card p-6"><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-5 w-48" /><Skeleton className="mt-4 h-16 w-full" /></div>)}</div>
      ) : error && !rules.length ? (
        <div className="surface-card px-5 py-14 text-center">
          <BookOpen className="mx-auto text-slate-300" size={26} />
          <p className="mt-3 text-sm font-semibold text-slate-800">Guidelines unavailable</p>
          <p className="mt-1 text-sm text-slate-500">Guidelines could not be loaded.</p>
        </div>
      ) : rules.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rules.map((rule, index) => (
            <article key={rule._id || rule.id || index} className="surface-card flex flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-800"><BookOpen size={19} aria-hidden="true" /></span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${rule.status === 'Inactive' ? 'bg-slate-100 text-slate-600' : 'bg-success-50 text-success-800'}`}>{rule.status || 'Active'}</span>
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-950">{rule.title || rule.name || 'Brand guideline'}</h2>
              <p className="mt-1 break-all font-mono text-[11px] text-slate-400">ID: {rule._id || rule.id || '—'}</p>
              <p className="mt-2 flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{rule.description || rule.text || 'No description provided.'}</p>
              <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
                <button type="button" disabled={!canManage} className="btn-secondary !min-h-9 !px-3 !py-2 text-xs" onClick={() => startEdit(rule)}>Edit</button>
                <button type="button" disabled={!canManage} className="btn-secondary !min-h-9 !px-3 !py-2 text-xs text-rose-700 hover:text-rose-800" onClick={() => setDeleteTarget(rule)}><Trash2 size={14} /> Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="surface-card px-5 py-8">
          <EmptyState
            title="No guidelines configured"
            description="Add workspace guidance to make it available to authorized reviewers."
            actionLabel="Add guideline"
            onAction={startCreate}
            disabled={!canManage}
          />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete guideline?"
        description={`Delete "${deleteTarget?.title || deleteTarget?.name || 'this guideline'}"? This action cannot be undone.`}
        confirmLabel="Delete guideline"
        onConfirm={() => remove(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />

      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3.5">
        <LockKeyhole size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        <p className="text-xs leading-5 text-slate-500"><span className="font-semibold text-slate-700">Authoritative guidance.</span> Saved guidance is persisted in the organization workspace. Scan integration with this library is not yet implemented.</p>
        <ShieldCheck size={16} className="ml-auto mt-0.5 shrink-0 text-blue-700" aria-hidden="true" />
      </div>
    </div>
  );
}
