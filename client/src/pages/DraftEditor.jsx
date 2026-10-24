import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileText, LoaderCircle, ScanSearch, Send, ShieldCheck } from 'lucide-react';
import { api } from '../api/api.js';
import Editor from '../components/Editor.jsx';
import FindingsPanel from '../components/FindingsPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function DraftEditor({ role }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draftId, setDraftId] = useState(id || '');
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('Instagram');
  const [text, setText] = useState('');
  const [findings, setFindings] = useState([]);
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const readOnly = role === 'Reviewer' || role === 'Manager' || role === 'Admin';

  useEffect(() => {
    if (id) api.getDraft(id).then(draft => {
      if (draft) {
        setDraftId(draft.id);
        setTitle(draft.title || '');
        setChannel(draft.channel || 'Instagram');
        setText(draft.text || '');
      }
    }).catch(reason => setError(reason.message));
  }, [id]);

  const save = async () => {
    if (!title.trim() || !text.trim()) {
      setError('Enter a title and draft content first.');
      return null;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const saved = await api.saveDraft({ id: draftId || undefined, title, channel, text });
      setDraftId(saved.id);
      setMessage('Draft saved.');
      return saved;
    } catch (reason) {
      setError(reason.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    const saved = await save();
    if (!saved) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.scanDraft(saved.id, text);
      setFindings((result?.findings || result?.data?.findings || []).map(finding => ({ ...finding, status: finding.status || 'Open' })));
      setScanned(true);
      setMessage('Scan complete. Review every finding before submitting.');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  const decision = async (finding, status, reason) => {
    try {
      await api.updateFinding(draftId, finding.id, status, reason);
      setFindings(previous => previous.map(item => item.id === finding.id ? { ...item, status, reason } : item));
    } catch (reasonError) {
      setError(reasonError.message);
    }
  };

  const submit = async () => {
    if (!scanned) {
      setError('Run a scan on the latest saved draft before submitting.');
      return;
    }
    if (findings.some(finding => finding.status === 'Open')) {
      setError('Resolve each finding with Accept, Reject or Dispute before submitting.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.submitDraft(draftId);
      setMessage('Draft submitted for review.');
      setTimeout(() => navigate('/'), 500);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  const review = async action => {
    let comment = '';
    if (action === 'changes') {
      comment = window.prompt('Explain the changes required:') || '';
      if (!comment.trim()) {
        setError('A comment is required when requesting changes.');
        return;
      }
    }
    if (action === 'approve' && !window.confirm('Approve this draft?')) return;
    setBusy(true);
    setError('');
    try {
      await api.reviewDraft(draftId, action === 'approve' ? 'approve' : 'changes', comment);
      setMessage(action === 'approve' ? 'Draft approved.' : 'Changes requested.');
      setTimeout(() => navigate('/review'), 500);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <button className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-emerald-800" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back
      </button>

      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-emerald-800">
            <FileText size={14} /> {id ? 'Content review' : 'New content'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{id ? (title || 'Draft details') : 'Create a draft'}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Prepare content, check it against brand policy, and keep a human in control of every decision.</p>
        </div>
        {id && <StatusBadge status={readOnly ? 'Review mode' : 'Draft'} />}
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div>}

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-900">
        <span className="font-semibold">Workflow note:</span> Save early, scan before submission, and keep a human decision trail for every approval.
      </div>

      <section className="surface-card p-5 sm:p-7">
        <div className="mb-6 flex items-start gap-3 border-b border-slate-100 pb-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800"><FileText size={19} /></span>
          <div><h2 className="text-base font-semibold text-slate-950">Content details</h2><p className="mt-1 text-sm text-slate-500">Add the content and channel information for this submission.</p></div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-800">
            Content title
            <input className="field mt-2" value={title} onChange={event => { setTitle(event.target.value); setScanned(false); }} placeholder="e.g. Summer wellness campaign" readOnly={readOnly} />
            <span className="mt-1.5 block text-xs font-normal text-slate-500">A concise title helps reviewers identify your submission.</span>
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Publishing channel
            <select className="field mt-2" value={channel} onChange={event => setChannel(event.target.value)} disabled={readOnly}>
              {['Instagram', 'Website', 'Press Release', 'Email Newsletter', 'Paid Advertisement', 'Other'].map(item => <option key={item}>{item}</option>)}
            </select>
            <span className="mt-1.5 block text-xs font-normal text-slate-500">Select where this content is planned to appear.</span>
          </label>
        </div>
        <label className="mt-5 block text-sm font-semibold text-slate-800">
          Draft content
          <Editor value={text} onChange={value => { setText(value); setScanned(false); }} readOnly={readOnly} />
        </label>
        <div className="mt-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <p className="text-xs leading-5 text-slate-500">If you edit the content after scanning, run a new check before submitting.</p>
          {!readOnly && <div className="flex flex-wrap gap-2">
            <button disabled={busy} className="btn-secondary" onClick={save}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : null}Save draft</button>
            <button disabled={busy} className="btn-success" onClick={scan}><ScanSearch size={16} /> Run brand check</button>
          </div>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:p-7">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-800 shadow-sm"><ShieldCheck size={19} /></span>
          <div><h2 className="text-base font-semibold text-slate-950">Review findings</h2><p className="mt-1 text-sm leading-6 text-slate-500">Policy concerns and suggested changes from the content check. Human review is required.</p></div>
        </div>
        {!scanned && findings.length === 0
          ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm leading-6 text-slate-500">{readOnly ? 'No findings are available for this item.' : 'Run a brand check to see findings for this draft.'}</p>
          : <FindingsPanel findings={findings} onDecision={decision} readOnly={readOnly} />}
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        {!readOnly && <button disabled={busy || !draftId} className="btn-success" onClick={submit}><Send size={16} /> Submit for review</button>}
        {(role === 'Reviewer' || role === 'Manager') && id && <>
          <button disabled={busy} className="btn-success" onClick={() => review('approve')}><CheckCircle2 size={16} /> Approve</button>
          <button disabled={busy} className="btn-secondary" onClick={() => review('changes')}>Request changes</button>
        </>}
      </div>
    </div>
  );
}
