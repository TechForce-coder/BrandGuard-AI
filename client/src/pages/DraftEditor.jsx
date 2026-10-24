import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  ScanSearch,
  Send
} from 'lucide-react';

import { api } from '../api/api.js';
import Editor from '../components/Editor.jsx';
import FindingsPanel from '../components/FindingsPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function DraftEditor({ role }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [draftId, setDraftId] = useState(id || '');
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('Website');
  const [text, setText] = useState('');
  const [findings, setFindings] = useState([]);
  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const readOnly = ['Reviewer', 'Manager', 'Admin'].includes(role);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const loadDraft = async () => {
      try {
        setError('');

        const d = await api.getDraft(id);

        if (cancelled) return;

        if (!d) {
          setError('Draft not found.');
          return;
        }

        setDraftId(d._id || d.id || id);
        setTitle(d.title || '');
        setChannel(d.channel || 'Website');
        setText(d.content || d.text || '');
        setFindings([]);
        setScanned(false);
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
        }
      }
    };

    loadDraft();

    return () => {
      cancelled = true;
    };
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
      const saved = await api.saveDraft({
        id: draftId || undefined,
        title,
        channel,
        content: text
      });

      const actualId = saved?._id || saved?.id || draftId;

      if (!actualId) {
        throw new Error(
          'Draft saved, but its ID was not returned.'
        );
      }

      setDraftId(actualId);
      setMessage('Draft saved.');

      return { ...saved, id: actualId };
    } catch (e) {
      setError(e.message);
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
    setMessage('');

    try {
      const result = await api.scanDraft(saved.id);
      const data = result?.data || result;

      const items = Array.isArray(data?.findings)
        ? data.findings
        : [];

      setFindings(
        items.map((f) => ({
          ...f,
          id: f.id || f._id,
          status: f.status || 'Open'
        }))
      );

      setScanned(true);
      setMessage(
        'Scan complete. Review every finding before submitting.'
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const decision = async (finding, status, reason) => {
    try {
      if (status === 'Disputed' && !reason?.trim()) {
        setError('Please enter a proper reason for dispute.');
        return;
      }

      const findingIndex = findings.findIndex(
        (f) => f === finding
      );

      if (findingIndex === -1) {
        throw new Error('Finding not found.');
      }

      const result = await api.updateFinding(
        draftId,
        String(findingIndex),
        status,
        reason
      );

      if (result?.success === false) {
        throw new Error(
          result.message || 'Unable to update finding.'
        );
      }

      setFindings((prev) =>
        prev.map((f, index) =>
          index === findingIndex
            ? { ...f, status, reason: reason || '' }
            : f
        )
      );

      setError('');
      setMessage(
        status === 'Disputed'
          ? 'Finding disputed successfully.'
          : `Finding ${status.toLowerCase()} successfully.`
      );
    } catch (e) {
      setError(e.message);
    }
  };

  const submit = async () => {
    if (!scanned) {
      setError(
        'Run a scan on the latest saved draft before submitting.'
      );
      return;
    }

    if (findings.some((f) => f.status === 'Open')) {
      setError(
        'Resolve each finding with Accept, Reject or Dispute before submitting.'
      );
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await api.submitDraft(draftId);

      setMessage('Draft submitted for review.');
      setTimeout(() => navigate('/'), 500);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const review = async (action) => {
    let comment = '';

    if (action === 'changes') {
      comment =
        window.prompt('Explain the changes required:') || '';

      if (!comment.trim()) {
        setError(
          'A comment is required when requesting changes.'
        );
        return;
      }
    }

    if (
      action === 'approve' &&
      !window.confirm('Approve this draft?')
    ) {
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await api.reviewDraft(
        draftId,
        action === 'approve' ? 'approve' : 'changes',
        comment
      );

      setMessage(
        action === 'approve'
          ? 'Draft approved.'
          : 'Changes requested.'
      );

      setTimeout(() => navigate('/review'), 500);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <button
        className="btn-secondary !border-0 !bg-transparent !px-0"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            {id ? 'Content review' : 'New content'}
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {id ? title || 'Draft details' : 'Create a draft'}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Write clearly, scan against policy, then review findings.
          </p>
        </div>

        {id && (
          <StatusBadge
            status={readOnly ? 'Review mode' : 'Draft'}
          />
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {message}
        </div>
      )}

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Content title

            <input
              className="field mt-2"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setScanned(false);
              }}
              placeholder="e.g. Summer wellness campaign"
              readOnly={readOnly}
            />
          </label>

          <label className="block text-sm font-semibold">
            Channel

            <select
              className="field mt-2"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              disabled={readOnly}
            >
              {[
                'Instagram',
                'Website',
                'Press Release',
                'Email Newsletter',
                'Paid Advertisement',
                'Other'
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm font-semibold">
          Draft content

          <Editor
            value={text}
            onChange={(v) => {
              setText(v);
              setScanned(false);
            }}
            readOnly={readOnly}
          />
        </label>

        <p className="text-xs text-slate-400">
          If you edit after scanning, scan again before submitting.
        </p>

        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              className="btn-secondary"
              onClick={save}
            >
              {busy && (
                <LoaderCircle
                  size={16}
                  className="animate-spin"
                />
              )}
              Save draft
            </button>

            <button
              disabled={busy}
              className="btn-success"
              onClick={scan}
            >
              <ScanSearch size={16} />
              Run Check
            </button>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-7">
        <div>
          <h2 className="text-xl font-bold">
            Review Findings
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Review concerns and suggested changes.
          </p>
        </div>

        {!scanned && findings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Run Check to see findings for this draft.
          </p>
        ) : (
          <FindingsPanel
            findings={findings}
            onDecision={decision}
            readOnly={readOnly}
          />
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        {!readOnly && (
          <button
            disabled={busy || !draftId}
            className="btn-success"
            onClick={submit}
          >
            <Send size={16} />
            Submit for Review
          </button>
        )}

        {(role === 'Reviewer' || role === 'Manager') && id && (
          <>
            <button
              disabled={busy}
              className="btn-success"
              onClick={() => review('approve')}
            >
              <CheckCircle2 size={16} />
              Approve
            </button>

            <button
              disabled={busy}
              className="btn-secondary"
              onClick={() => review('changes')}
            >
              Request Changes
            </button>
          </>
        )}
      </div>
    </div>
  );
}