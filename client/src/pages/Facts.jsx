import { useEffect, useState } from 'react';
import { CalendarClock, FileCheck2, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api/api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDateTime } from '../utils/formatDateTime.js';

const emptyForm = { title: '', owner: '', validUntil: '', status: 'Active' };

export default function Facts() {
  const [facts, setFacts] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getFacts()
      .then(result => { if (active) setFacts(Array.isArray(result) ? result : result?.facts || []); })
      .catch(reason => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const startCreate = () => {
    setEditingId('');
    setForm(emptyForm);
    setFormOpen(true);
    setMessage('');
  };

  const startEdit = fact => {
    setEditingId(String(fact._id || fact.id));
    setForm({
      title: fact.title || fact.name || '',
      owner: fact.owner || '',
      validUntil: fact.validUntil ? new Date(fact.validUntil).toISOString().slice(0, 10) : '',
      status: fact.status || 'Active'
    });
    setFormOpen(true);
    setMessage('');
  };

  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = { ...form, validUntil: form.validUntil || null };
      if (editingId) await api.updateFact(editingId, payload);
      else await api.createFact(payload);
      setFormOpen(false);
      setForm(emptyForm);
      setEditingId('');
      setMessage(editingId ? 'Fact updated.' : 'Fact added.');
      setRefreshKey(key => key + 1);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async fact => {
    const id = String(fact._id || fact.id || '');
    if (!id || !window.confirm(`Delete "${fact.title || fact.name || 'this fact'}"?`)) return;
    setError('');
    setMessage('');
    try {
      await api.deleteFact(id);
      setMessage('Fact deleted.');
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
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Approved Facts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Manage approved claims and supporting references for use in brand content.</p>
        </div>
        <button type="button" className="btn-primary shrink-0" onClick={startCreate}>
          <Plus size={16} aria-hidden="true" /> Add fact
        </button>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs" onClick={() => setRefreshKey(key => key + 1)}>Retry</button>
        </div>
      )}
      {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}

      {formOpen && (
        <form onSubmit={save} className="surface-card space-y-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{editingId ? 'Edit approved fact' : 'Add approved fact'}</h2>
              <p className="mt-1 text-sm text-slate-500">Changes are saved to this organization’s workspace.</p>
            </div>
            <button type="button" className="icon-button" onClick={() => setFormOpen(false)} aria-label="Close fact form"><X size={17} /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Fact or reference
              <input className="field mt-1.5" required maxLength={200} value={form.title} onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Owner
              <input className="field mt-1.5" maxLength={160} value={form.owner} onChange={event => setForm(previous => ({ ...previous, owner: event.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Valid until
              <input className="field mt-1.5" type="date" value={form.validUntil} onChange={event => setForm(previous => ({ ...previous, validUntil: event.target.value }))} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Status
              <select className="field mt-1.5" value={form.status} onChange={event => setForm(previous => ({ ...previous, status: event.target.value }))}>
                {['Active', 'Valid', 'Expired', 'Inactive'].map(status => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save fact'}</button>
            <button type="button" disabled={saving} className="btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
        </form>
      )}

      <section className="surface-card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2 className="text-sm font-semibold text-slate-900">Fact register</h2>
          <p className="mt-1 text-xs text-slate-500">
            {loading ? 'Loading approved facts…' : error ? 'Approved facts unavailable' : `${facts.length} ${facts.length === 1 ? 'reference' : 'references'}`}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>{['Fact / reference', 'Owner', 'Valid until', 'Status', 'Actions'].map(heading => <th className="px-5 py-3 font-semibold" key={heading}>{heading}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facts.map((fact, index) => (
                <tr key={fact._id || fact.id || index} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-2.5 font-semibold text-slate-800"><FileCheck2 size={17} className="shrink-0 text-blue-700" />{fact.title || fact.name || 'Approved fact'}</span>
                    <p className="ml-[27px] mt-1 text-xs text-slate-400">{fact._id || fact.id || '—'}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{fact.owner || '—'}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    <span className="flex items-center gap-2"><CalendarClock size={15} className="text-slate-400" />{fact.validUntil || fact.valid_until ? formatDateTime(fact.validUntil || fact.valid_until) : '—'}</span>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={fact.status || 'Active'} /></td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs" onClick={() => startEdit(fact)}>Edit</button>
                      <button type="button" className="btn-secondary !min-h-8 !px-3 !py-1.5 !text-xs text-rose-700 hover:text-rose-800" onClick={() => remove(fact)} aria-label={`Delete ${fact.title || 'fact'}`}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="space-y-3 p-5"><div className="skeleton h-10 w-full" /><div className="skeleton h-10 w-full" /></div>}
          {!loading && error && !facts.length && <div className="px-5 py-12 text-center text-sm text-slate-500">Facts could not be loaded. Retry to check the connection.</div>}
          {!loading && !error && facts.length === 0 && (
            <div className="px-5 py-14 text-center">
              <FileCheck2 className="mx-auto text-slate-300" size={26} />
              <p className="mt-3 text-sm font-semibold text-slate-800">No approved facts yet</p>
              <p className="mt-1 text-sm text-slate-500">Add verified references to the organization’s fact register.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
