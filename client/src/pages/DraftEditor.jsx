import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  ScanSearch,
  Send,
} from 'lucide-react';

import { api } from '../api/api.js';
import Editor from '../components/Editor.jsx';
import FindingsPanel from '../components/FindingsPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function DraftEditor({ actualRole }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [draft, setDraft] = useState(null);
  const [draftId, setDraftId] = useState(id || '');
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('');
  const [text, setText] = useState('');
  const [findings, setFindings] = useState([]);
  const [status, setStatus] = useState('Draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const authenticatedRole = String(actualRole || '').toLowerCase();
  const canReview = ['reviewer', 'manager', 'admin'].includes(authenticatedRole);
  const readOnly = authenticatedRole !== 'creator' || (
    Boolean(draftId) && !['Draft', 'Needs Changes'].includes(status)
  );

  useEffect(() => {
    if (!id) {
      setDraftId('');
      setDraft(null);
      setLoading(false);
      return;
    }

    loadDraft();
  }, [id]);

  async function loadDraft() {
    try {
      setLoading(true);
      setError('');

      const response = await api.getDraft(id);
      const data = response?.draft ?? response?.data ?? response;

      setDraft(data);
      setDraftId(data._id || data.id || id);
      setTitle(data.title || '');
      setChannel(data.channel || '');
      setText(data.content || '');
      setFindings(data.findings || []);
      setStatus(data.status || 'Draft');
      setScanned(false);
    } catch (err) {
      setError(err.message || 'Failed to load draft.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!title.trim() || !text.trim()) {
      setError('Enter a title and draft content first.');
      return null;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const saved = await api.saveDraft({
        id: draftId || undefined,
        title,
        channel,
        content: text,
      });
      const savedId = saved?._id || saved?.id || draftId;
      if (!savedId) {
        throw new Error('Draft saved, but its ID was not returned.');
      }

      setDraftId(savedId);
      setDraft({
        ...saved,
        title,
        channel,
        content: text,
      });
      setStatus(saved.status || status || 'Draft');

      setMessage('Draft saved.');
      return { ...saved, id: savedId };
    } catch (err) {
      setError(err.message || 'Failed to save draft.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleScan() {
    try {
      setScanning(true);
      setError('');
      setMessage('');

      const saved = await handleSave();
      if (!saved) return;

      const response = await api.scanDraft(saved.id, text);
      const data = response?.draft ?? response?.data ?? response;

      if (data.findings) {
        setFindings(data.findings);
      }

      if (data.status) {
        setStatus(data.status);
      }

      setScanned(true);
      setMessage('Draft scan completed.');
    } catch (err) {
      setError(err.message || 'Failed to scan draft.');
    } finally {
      setScanning(false);
    }
  }

  async function handleDecision(finding, decision, reason = '') {
    try {
      if (decision === 'Disputed' && !reason.trim()) {
        setError('Please enter a reason to dispute this finding.');
        return;
      }

      setError('');
      setMessage('');

      const findingIndex = findings.findIndex(item => item === finding);
      if (findingIndex < 0) {
        throw new Error('Finding not found.');
      }

      await api.updateFinding(
        draftId,
        String(findingIndex),
        decision,
        reason
      );

      setFindings(previous => previous.map((item, index) =>
        index === findingIndex ? { ...item, status: decision, reason } : item
      ));
      setMessage(`Finding ${decision.toLowerCase()} successfully.`);
    } catch (err) {
      setError(err.message || 'Failed to update finding decision.');
    }
  }

  async function handleSubmit() {
    if (!scanned) {
      setError('Run a scan on the latest saved draft before submitting.');
      return;
    }

    if (findings.some(finding => !finding.status || finding.status === 'Open')) {
      setError('Resolve each finding before submitting for approval.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setMessage('');

      const response = await api.submitDraft(draftId);
      const data = response?.draft ?? response?.data ?? response;

      if (data.status) {
        setStatus(data.status);
      } else {
        setStatus('Pending Approval');
      }

      setMessage('Draft submitted for approval.');
    } catch (err) {
      setError(err.message || 'Failed to submit draft.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(decision, comments = '') {
    if (decision === 'Needs Changes' && !comments.trim()) {
      setError('Add a comment explaining the requested changes.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      await api.reviewDraft(
        draftId,
        decision === 'Approved' ? 'approve' : 'request-changes',
        comments
      );

      setStatus(decision);

      setMessage('Review submitted successfully.');
      if (id) await loadDraft();
    } catch (err) {
      setError(err.message || 'Failed to submit review.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10">
        <LoaderCircle className="animate-spin" size={20} />
        <span>Loading draft...</span>
      </div>
    );
  }

  if (error && id && !draft) {
    return (
      <section className="surface-card space-y-4 p-6">
        <p className="text-rose-600">{error}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn-secondary"
        >
          Go back
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <section className="surface-card space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {title || 'Untitled draft'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Edit your content and check it against your organisation's
              brand guidelines.
            </p>
          </div>

          <StatusBadge status={status} />
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        {message && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </p>
        )}

        <div className="space-y-2">
          <label
            htmlFor="draft-title"
            className="block text-sm font-medium text-slate-700"
          >
            Content title{' '}
            <span className="text-rose-600" aria-hidden="true">
              *
            </span>
          </label>

          <input
            id="draft-title"
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setScanned(false);
            }}
            disabled={readOnly}
            required={!readOnly}
            className="input w-full"
            placeholder="Enter a title"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="draft-channel"
            className="block text-sm font-medium text-slate-700"
          >
            Channel{' '}
            <span className="text-rose-600" aria-hidden="true">
              *
            </span>
          </label>

          <select
            id="draft-channel"
            value={channel}
            onChange={(event) => {
              setChannel(event.target.value);
              setScanned(false);
            }}
            disabled={readOnly}
            required={!readOnly}
            className="input w-full"
          >
            <option value="">Select a channel</option>
            <option value="Website">Website</option>
            <option value="Social Media">Social Media</option>
            <option value="Email">Email</option>
            <option value="Blog">Blog</option>
            <option value="Advertisement">Advertisement</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="draft-content"
            className="block text-sm font-medium text-slate-700"
          >
            Draft content{' '}
            <span className="text-rose-600" aria-hidden="true">
              *
            </span>
          </label>

          <Editor
            value={text}
            onChange={(value) => {
              setText(value);
              setScanned(false);
            }}
            readOnly={readOnly}
          />

          <div className="flex justify-end text-xs text-slate-500">
            {text.length.toLocaleString()} characters
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || scanning || submitting}
              className="btn-secondary inline-flex items-center gap-2"
            >
              {saving && <LoaderCircle className="animate-spin" size={16} />}
              Save draft
            </button>

            <button
              type="button"
              onClick={handleScan}
              disabled={saving || scanning || submitting}
              className="btn-primary inline-flex items-center gap-2"
            >
              {scanning ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <ScanSearch size={16} />
              )}
              Scan draft
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || scanning || submitting}
              className="btn-primary inline-flex items-center gap-2"
            >
              {submitting ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Send size={16} />
              )}
              Submit for approval
            </button>
          </div>
        )}

        {readOnly && (
          <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
            This draft is currently read-only.
          </div>
        )}
      </section>

      <section className="surface-card space-y-4 p-5 sm:p-7">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Scan findings
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Review the issues identified in your draft.
          </p>
        </div>

        {findings.length > 0 ? (
          <FindingsPanel
            findings={findings}
            onDecision={handleDecision}
            readOnly={readOnly}
          />
        ) : (
          <div className="rounded-xl bg-slate-50/80 p-6 text-center">
            <CheckCircle2
              className="mx-auto mb-2 text-slate-400"
              size={24}
            />
            <p className="text-sm text-slate-600">
              No scan findings available yet.
            </p>
          </div>
        )}
      </section>

      {canReview &&
        status === 'Pending Approval' && (
          <section className="surface-card space-y-4 p-5 sm:p-7">
            <h2 className="text-xl font-semibold text-slate-900">
              Review draft
            </h2>

            <ReviewActions
              onReview={handleReview}
              loading={saving}
            />
          </section>
        )}
    </div>
  );
}

function ReviewActions({ onReview, loading }) {
  const [comments, setComments] = useState('');

  return (
    <div className="space-y-4">
      <textarea
        value={comments}
        onChange={(event) => setComments(event.target.value)}
        className="input min-h-24 w-full"
        placeholder="Add review comments (optional)"
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onReview('Approved', comments)}
          disabled={loading}
          className="btn-primary"
        >
          Approve
        </button>

        <button
          type="button"
          onClick={() => onReview('Needs Changes', comments)}
          disabled={loading}
          className="btn-secondary"
        >
          Request changes
        </button>
      </div>
    </div>
  );
}