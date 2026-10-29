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
import { getDraftEditorState, submitReviewComment } from '../utils/draftEditorWorkflow.js';
import { canMutateInWorkspace } from '../utils/workspacePreview.js';

export default function DraftEditor({ actualRole, workspaceRole = actualRole, previewMode = false }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [draft, setDraft] = useState(null);
  const [draftId, setDraftId] = useState(id || '');
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('');
  const [text, setText] = useState('');
  const [hasImage, setHasImage] = useState(false);
  const [altText, setAltText] = useState('');
  const [findings, setFindings] = useState([]);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [status, setStatus] = useState('Draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanStatus, setScanStatus] = useState('not-scanned');
  const [scanWarning, setScanWarning] = useState('');
  const [suggestedContent, setSuggestedContent] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const authenticatedRole = String(actualRole || '').toLowerCase();
  const canReview = String(actualRole || '').trim().toLowerCase() === 'manager';

  const readOnly = previewMode || authenticatedRole !== 'creator' || (
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
      const editorState = getDraftEditorState(data, { id });

      setDraft(data);
      setDraftId(editorState.id);
      setTitle(editorState.title);
      setChannel(editorState.channel);
      setText(editorState.content);
      setHasImage(editorState.hasImage);
      setAltText(editorState.altText);
      setFindings(editorState.findings);
      setReviewHistory(editorState.reviewHistory);
      setStatus(editorState.status);
      setScanned(editorState.scanned);
      setScanStatus(editorState.scanStatus);
      setScanWarning(editorState.scanWarning);
      setSuggestedContent('');
    } catch (err) {
      setError(err.message || 'Failed to load draft.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(options = {}) {
    if (!canMutateInWorkspace(previewMode)) {
      setError('Saving is disabled in development workspace preview.');
      return null;
    }

    const { navigateAfter = true, content: contentOverride } = options;
    const contentToSave = contentOverride ?? text;

    if (!title.trim() || !contentToSave.trim()) {
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
        content: contentToSave,
        hasImage,
        altText,
      });

      const editorState = getDraftEditorState(saved, {
        id: draftId,
        title,
        channel,
        content: contentToSave,
        hasImage,
        altText,
        findings,
        status,
        scanned,
        scanStatus,
        scanWarning,
        reviewHistory,
      });

      const savedId = editorState.id;

      if (!savedId) {
        throw new Error('Draft saved, but its ID was not returned.');
      }

      setDraftId(savedId);
      setDraft({
        ...saved,
        title: editorState.title,
        channel: editorState.channel,
        content: editorState.content,
      });

      setTitle(editorState.title);
      setChannel(editorState.channel);
      setText(editorState.content);
      setHasImage(editorState.hasImage);
      setAltText(editorState.altText);
      setStatus(editorState.status);
      setFindings(editorState.findings);
      setReviewHistory(editorState.reviewHistory);
      setScanned(editorState.scanned);
      setScanStatus(editorState.scanStatus);
      setScanWarning(editorState.scanWarning);

      setMessage('Draft saved.');

      if (navigateAfter && !id) {
        navigate(`/drafts/${savedId}`, { replace: true });
      }

      return { ...saved, id: savedId, ...editorState };
    } catch (err) {
      setError(err.message || 'Failed to save draft.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleApplySuggestion(finding) {
    if (!canMutateInWorkspace(previewMode)) {
      setError('Applying suggestions is disabled in development workspace preview.');
      return;
    }

    const quote = finding.quote;

    if (typeof quote !== 'string' || !quote || typeof finding.suggestion !== 'string') {
      setError('This finding does not have an applicable text suggestion.');
      return;
    }

    const firstIndex = text.indexOf(quote);

    if (firstIndex < 0 || text.indexOf(quote, firstIndex + quote.length) >= 0) {
      setError('The quoted text is missing or appears more than once. Edit it manually to avoid changing the wrong passage.');
      return;
    }

    const updatedText = `${text.slice(0, firstIndex)}${finding.suggestion}${text.slice(firstIndex + quote.length)}`;

    const saved = await handleSave({ content: updatedText });

    if (saved) {
      setScanned(false);
      setScanStatus('not-scanned');
      setScanWarning('');
      setSuggestedContent('');
      setMessage('Suggested change saved. Run a fresh scan before submitting.');
    }
  }


async function handleApplyFullSuggestion() {
  if (!canMutateInWorkspace(previewMode)) {
    setError(
      'Applying suggestions is disabled in development workspace preview.'
    );
    return;
  }

  if (
    typeof suggestedContent !== 'string' ||
    !suggestedContent.trim()
  ) {
    setError('No complete suggested content is available.');
    return;
  }

  try {
    setError('');
    setMessage('');

    const saved = await handleSave({
      content: suggestedContent,
      navigateAfter: false,
    });

    if (!saved) return;

    setScanned(false);
    setScanStatus('not-scanned');
    setScanWarning('');
    setSuggestedContent('');

    setMessage(
      'Suggested content saved. Run a fresh scan when ready.'
    );
  } catch (err) {
    setError(err.message || 'Failed to apply suggested content.');
  }
}

  async function handleScan() {
    if (!canMutateInWorkspace(previewMode)) {
      setError('Scanning is disabled in development workspace preview.');
      return;
    }

    try {
      setScanning(true);
      setError('');
      setMessage('');
      setSuggestedContent('');

      const saved = await handleSave({ navigateAfter: false });

      if (!saved) return;

      const response = await api.scanDraft(saved.id, text);
      const data = response?.draft ?? response?.data ?? response;
      const nextFindings = Array.isArray(data.findings) ? data.findings : [];
      const nextScanStatus = data.scanStatus || 'complete';

      if (Array.isArray(data.findings)) {
        setFindings(nextFindings);
      }

      if (data.status) {
        setStatus(data.status);
      }

      setSuggestedContent(
        nextScanStatus === 'complete' &&
        typeof data.suggestedContent === 'string' &&
        data.suggestedContent.trim()
          ? data.suggestedContent
          : ''
      );

      setScanStatus(nextScanStatus);
      setScanWarning(data.warning || data.scanWarning || '');
      setScanned(nextScanStatus === 'complete');

      setMessage(
        nextScanStatus === 'partial'
          ? 'Scan incomplete. Resolve the provider issue and run a complete scan before submitting.'
          : 'Draft scan completed.'
      );

      if (!id) {
        navigate(`/drafts/${saved.id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Failed to scan draft.');
    } finally {
      setScanning(false);
    }
  }

  async function handleDecision(finding, decision, reason = '') {
    if (!canMutateInWorkspace(previewMode)) {
      setError('Finding decisions are disabled in development workspace preview.');
      return;
    }

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

      await api.updateFinding(draftId, String(findingIndex), decision, reason);

      setFindings(previous => previous.map((item, index) =>
        index === findingIndex ? { ...item, status: decision, reason } : item
      ));

      setMessage(`Finding ${decision.toLowerCase()} successfully.`);
    } catch (err) {
      setError(err.message || 'Failed to update finding decision.');
    }
  }

  async function handleSubmit() {
    if (!canMutateInWorkspace(previewMode)) {
      setError('Submission is disabled in development workspace preview.');
      return;
    }

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

  async function handleComment(comment = '') {
    if (!canMutateInWorkspace(previewMode)) {
      setError('Comments are disabled in development workspace preview.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      await submitReviewComment(api, draftId, comment);
      await loadDraft();

      setMessage('Review comment recorded.');
    } catch (err) {
      setError(err.message || 'Failed to record review comment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(decision, comments = '') {
    if (!canMutateInWorkspace(previewMode)) {
      setError('Review decisions are disabled in development workspace preview.');
      return;
    }

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

      setMessage(
        decision === 'Approved'
          ? 'Draft approved successfully.'
          : 'Changes requested successfully.'
      );

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
            {previewMode && (
              <p className="mt-2 text-sm font-medium text-amber-800">
                Development preview is read-only. Protected content actions are disabled.
              </p>
            )}
          </div>

          {scanStatus === 'partial' && (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Scan incomplete</p>
              <p className="mt-1">
                {scanWarning || 'Only supported deterministic checks ran. A complete AI scan is required before submission.'}
              </p>
            </div>
          )}

          <StatusBadge status={status} />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </p>
        )}

        <div className="space-y-2">
          <label htmlFor="draft-title" className="block text-sm font-medium text-slate-700">
            Content title{' '}
            <span className="text-rose-600" aria-hidden="true">*</span>
          </label>

          <input
            id="draft-title"
            type="text"
            value={title}
            onChange={event => {
              setTitle(event.target.value);
              setScanned(false);
              setScanStatus('not-scanned');
              setScanWarning('');
              setSuggestedContent('');
            }}
            disabled={readOnly}
            required={!readOnly}
            className="input w-full"
            placeholder="Enter a title"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="draft-channel" className="block text-sm font-medium text-slate-700">
            Channel{' '}
            <span className="text-rose-600" aria-hidden="true">*</span>
          </label>

          <select
            id="draft-channel"
            value={channel}
            onChange={event => {
              setChannel(event.target.value);
              setScanned(false);
              setScanStatus('not-scanned');
              setScanWarning('');
              setSuggestedContent('');
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
          <label htmlFor="draft-content" className="block text-sm font-medium text-slate-700">
            Draft content{' '}
            <span className="text-rose-600" aria-hidden="true">*</span>
          </label>

          <Editor
            value={text}
            onChange={value => {
              setText(value);
              setScanned(false);
              setScanStatus('not-scanned');
              setScanWarning('');
              setSuggestedContent('');
            }}
            readOnly={readOnly}
          />

          <div className="flex justify-end text-xs text-slate-500">
            {text.length.toLocaleString()} characters
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={hasImage}
              onChange={event => {
                setHasImage(event.target.checked);
                setScanned(false);
                setScanStatus('not-scanned');
                setScanWarning('');
                setSuggestedContent('');
              }}
              disabled={readOnly}
            />
            This content includes an image
          </label>

          {hasImage && (
            <label htmlFor="draft-alt-text" className="block text-sm font-medium text-slate-700">
              Image alt-text
              <input
                id="draft-alt-text"
                type="text"
                maxLength={300}
                value={altText}
                onChange={event => {
                  setAltText(event.target.value);
                  setScanned(false);
                  setScanStatus('not-scanned');
                  setScanWarning('');
                  setSuggestedContent('');
                }}
                disabled={readOnly}
                className="input mt-1.5 w-full"
                placeholder="Describe the meaningful visual content"
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                The scan checks that alt-text is descriptive and 5–125 characters long.
              </span>
            </label>
          )}
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

      {reviewHistory.length > 0 && (
        <section className="surface-card space-y-4 p-5 sm:p-7">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Review history</h2>
            <p className="mt-1 text-sm text-slate-500">
              Persisted workflow decisions and comments.
            </p>
          </div>

          <ol className="space-y-3">
            {reviewHistory.map((item, index) => (
              <li
                key={item._id || item.id || `${item.action}-${item.createdAt}-${index}`}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">{item.action}</p>
                  <time className="text-xs text-slate-500" dateTime={item.createdAt || undefined}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                  </time>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {item.user?.name || item.user?.email || 'Workspace reviewer'}
                </p>

                {item.comment && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {item.comment}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="surface-card space-y-4 p-5 sm:p-7">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Scan findings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review the issues identified in your draft.
          </p>
        </div>

        {suggestedContent && !readOnly && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
            <div>
              <h3 className="font-semibold text-indigo-950">
                Gemini improved content is ready
              </h3>
              <p className="mt-1 text-sm text-indigo-800">
                Apply the complete suggestion to update only the draft content. Your title will remain unchanged.
              </p>
            </div>

            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              disabled={saving || scanning || submitting}
              onClick={handleApplyFullSuggestion}
            >
              {saving && <LoaderCircle className="animate-spin" size={16} />}
              Apply Full Suggestion
            </button>
          </div>
        )}

        {findings.length > 0 ? (
          <FindingsPanel
            findings={findings}
            onDecision={handleDecision}
            onApplySuggestion={handleApplySuggestion}
            readOnly={readOnly}
          />
        ) : (
          <div className="rounded-xl bg-slate-50/80 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 text-slate-400" size={24} />
            <p className="text-sm text-slate-600">
              {scanned
                ? 'No issues were identified in the latest scan. Review the content before publishing.'
                : 'Run a scan to review the issues identified in your draft.'}
            </p>
          </div>
        )}
      </section>

      {canReview && status === 'Pending Approval' && (
        <section className="surface-card space-y-4 p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-slate-900">Review draft</h2>

          <ReviewActions
            onReview={handleReview}
            onComment={handleComment}
            loading={saving}
            previewMode={previewMode}
          />
        </section>
      )}
    </div>
  );
}

function ReviewActions({ onReview, onComment, loading, previewMode = false }) {
  const [comments, setComments] = useState('');

  return (
    <div className="space-y-4">
      <textarea
        value={comments}
        onChange={event => setComments(event.target.value)}
        disabled={previewMode}
        className="input min-h-24 w-full"
        placeholder="Add review comments (optional)"
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onComment(comments)}
          disabled={previewMode || loading || !comments.trim()}
          className="btn-secondary"
        >
          Add comment
        </button>

        <button
          type="button"
          onClick={() => onReview('Approved', comments)}
          disabled={previewMode || loading}
          className="btn-primary"
        >
          Approve
        </button>

        <button
          type="button"
          onClick={() => onReview('Needs Changes', comments)}
          disabled={previewMode || loading}
          className="btn-secondary"
        >
          Request changes
        </button>
      </div>
    </div>
  );
}