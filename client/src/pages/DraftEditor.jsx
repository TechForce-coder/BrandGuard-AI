import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  GitCompare,
  LoaderCircle,
  ImagePlus,
  ScanLine,
  ScanSearch,
  Send,
  Trash2,
  X,
} from 'lucide-react';

import { api } from '../api/api.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Editor from '../components/Editor.jsx';
import DiffViewer from '../components/DiffViewer.jsx';
import FindingsPanel from '../components/FindingsPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { getDraftEditorState, submitReviewComment } from '../utils/draftEditorWorkflow.js';
import { canMutateInWorkspace } from '../utils/workspacePreview.js';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif)$/i;

function getImageUrlError(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
      return 'Enter a valid HTTPS image URL.';
    }
    return '';
  } catch {
    return 'Enter a valid HTTPS image URL.';
  }
}

export default function DraftEditor({ actualRole, workspaceRole = actualRole, previewMode = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [draft, setDraft] = useState(null);
  const [draftId, setDraftId] = useState(id || '');
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('');
  const [text, setText] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [altText, setAltText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFilePreview, setImageFilePreview] = useState('');
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [imageInputError, setImageInputError] = useState('');
  const [imageScanning, setImageScanning] = useState(false);
  const [findings, setFindings] = useState([]);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [status, setStatus] = useState('Draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanStatus, setScanStatus] = useState('not-scanned');
  const [scanWarning, setScanWarning] = useState('');
  const [suggestedContent, setSuggestedContent] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const trimmedImageUrl = imageUrl.trim();
  const imageUrlError = trimmedImageUrl ? getImageUrlError(trimmedImageUrl) : '';
  const hasValidImage = Boolean(imageFile || (trimmedImageUrl && !imageUrlError));

  const authenticatedRole = String(actualRole || '').toLowerCase();
  const canReview = String(actualRole || '').trim().toLowerCase() === 'manager';

  const readOnly = previewMode || authenticatedRole !== 'creator' || (
    Boolean(draftId) && !['Draft', 'Needs Changes'].includes(status)
  );
  const canDeleteDraft = Boolean(draftId) && !previewMode &&
    authenticatedRole === 'creator' && ['Draft', 'Needs Changes'].includes(status);

  useEffect(() => {
    if (previewMode) {
      toast.info('Development preview is read-only. Protected content actions are disabled.');
    }
  }, [previewMode, toast]);

  useEffect(() => {
    if (readOnly) toast.info('This draft is currently read-only.');
  }, [readOnly, toast]);

  useEffect(() => {
    if (scanStatus === 'partial') {
      toast.warning(scanWarning || 'Only supported deterministic checks ran. A complete AI scan is required before submission.');
    }
  }, [scanStatus, scanWarning, toast]);

  useEffect(() => {
    if (!id) {
      setDraftId('');
      setDraft(null);
      setLoading(false);
      return;
    }

    loadDraft();
  }, [id]);

  useEffect(() => {
    if (!imageFile) {
      setImageFilePreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(imageFile);
    setImageFilePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [imageFile]);

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
      setOriginalContent(data?.originalContent || editorState.content || '');
      setHasImage(editorState.hasImage);
      setAltText(editorState.altText);
      setImageUrl(data?.imageUrl || editorState?.imageUrl || '');
      setFindings(editorState.findings);
      setReviewHistory(editorState.reviewHistory);
      setStatus(editorState.status);
      setScanned(editorState.scanned);
      setScanStatus(editorState.scanStatus);
      setScanWarning(editorState.scanWarning);
      setSuggestedContent('');
    } catch (err) {
      const message = err.message || 'Failed to load draft.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function clearImageSelection() {
    setImageFile(null);
    setImageUrl('');
    setImageFilePreview('');
    setImagePreviewError(false);
    setImageInputError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleImageFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(null);
    setImageUrl('');
    setImagePreviewError(false);

    if (file.size > MAX_IMAGE_SIZE) {
      setImageInputError('Choose an image no larger than 10 MB.');
      event.target.value = '';
      return;
    }

    if (!IMAGE_TYPES.has(file.type) && !(file.type === '' && IMAGE_EXTENSIONS.test(file.name))) {
      setImageInputError('Choose a JPEG, PNG, WebP or AVIF image.');
      event.target.value = '';
      return;
    }

    setImageInputError('');
    setImageFile(file);

    // Upload to Google Drive and auto-populate the URL input
    try {
      setImageScanning(true);
      toast.info('Uploading image to Drive…');

      const response = await api.uploadAndScanFile(file);
      if (response?.success === true && Array.isArray(response.scans)) {
        const uploadedUrl =
          response?.url ||
          response?.driveUrl ||
          response?.scans?.[0]?.driveUrl ||
          response?.scans?.[0]?.webViewLink ||
          '';

        if (uploadedUrl) {
          setImageUrl(uploadedUrl);
          toast.success('Image uploaded to Drive. URL has been auto-populated.');
        }

        const analysis = response.scans
          .map(scan => scan?.geminiAnalysis)
          .filter(value => typeof value === 'string' && value.trim())
          .join('\n\n');

        if (analysis) {
          toast.info(`Image scan result:\n${analysis}`);
        }
      }
    } catch (uploadErr) {
      console.warn('Initial upload warning:', uploadErr);
      toast.warning('Image loaded locally. Click "Scan Image" to re-attempt Drive upload.');
    } finally {
      setImageScanning(false);
    }
  }

  async function handleScanImage() {
    if (!imageFile && trimmedImageUrl) {
      toast.warning('The connected image scanning service currently accepts uploaded files only. Upload this image to scan it.');
      return;
    }

    if (!imageFile) return;

    try {
      setImageScanning(true);
      toast.info('Uploading and scanning image…');

      const response = await api.uploadAndScanFile(imageFile);
      if (response?.success !== true || !Array.isArray(response.scans)) {
        throw new Error(response?.error || 'The image scan did not return a valid result.');
      }

      const uploadedUrl =
        response?.url ||
        response?.driveUrl ||
        response?.scans?.[0]?.driveUrl ||
        response?.scans?.[0]?.webViewLink ||
        '';

      if (uploadedUrl) {
        setImageUrl(uploadedUrl);
      }

      const analysis = response.scans
        .map(scan => scan?.geminiAnalysis)
        .filter(value => typeof value === 'string' && value.trim())
        .join('\n\n');

      if (!analysis) {
        throw new Error('The image scan completed without returning an analysis.');
      }

      toast.info(`Image scan result:\n${analysis}`);
    } catch (err) {
      toast.error(err.message || 'Failed to scan image.');
    } finally {
      setImageScanning(false);
    }
  }

  async function handleSave(options = {}) {
    if (!canMutateInWorkspace(previewMode)) {
      toast.warning('Saving is disabled in development workspace preview.');
      return null;
    }

    async function handleDeleteDraft() {
      if (!canDeleteDraft || deleting) return;

      setDeleting(true);
      try {
        await api.deleteDraft(draftId);
        toast.success('Draft deleted');
        navigate('/drafts');
      } catch (reason) {
        toast.error(reason.message || 'Unable to delete draft.');
      } finally {
        setDeleting(false);
      }
    }

    const { navigateAfter = true, content: contentOverride } = options;
    const contentToSave = contentOverride ?? text;

    if (!title.trim() || !contentToSave.trim()) {
      toast.warning('Enter a title and draft content first.');
      return null;
    }

    try {
      setSaving(true);
      setError('');

      const saved = await api.saveDraft({
        id: draftId || undefined,
        title,
        channel,
        content: contentToSave,
        hasImage,
        altText,
        imageUrl: trimmedImageUrl,
      });

      const editorState = getDraftEditorState(saved, {
        id: draftId,
        title,
        channel,
        content: contentToSave,
        hasImage,
        altText,
        imageUrl: trimmedImageUrl,
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
        imageUrl: trimmedImageUrl,
      });

      setTitle(editorState.title);
      setChannel(editorState.channel);
      setText(editorState.content);
      setOriginalContent(saved.originalContent || originalContent || editorState.content);
      setHasImage(editorState.hasImage);
      setAltText(editorState.altText);
      setStatus(editorState.status);
      setFindings(editorState.findings);
      setReviewHistory(editorState.reviewHistory);
      setScanned(editorState.scanned);
      setScanStatus(editorState.scanStatus);
      setScanWarning(editorState.scanWarning);

      toast.success('Draft saved.');

      if (navigateAfter && !id) {
        navigate(`/drafts/${savedId}`, { replace: true });
      }

      return { ...saved, id: savedId, ...editorState };
    } catch (err) {
      const message = err.message || 'Failed to save draft.';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleApplySuggestion(finding) {
    if (!canMutateInWorkspace(previewMode)) {
      toast.warning('Applying suggestions is disabled in development workspace preview.');
      return;
    }

    const quote = finding.quote;

    if (typeof quote !== 'string' || !quote || typeof finding.suggestion !== 'string') {
      toast.warning('This finding does not have an applicable text suggestion.');
      return;
    }

    const firstIndex = text.indexOf(quote);

    if (firstIndex < 0 || text.indexOf(quote, firstIndex + quote.length) >= 0) {
      toast.warning('The quoted text is missing or appears more than once. Edit it manually to avoid changing the wrong passage.');
      return;
    }

    const updatedText = `${text.slice(0, firstIndex)}${finding.suggestion}${text.slice(firstIndex + quote.length)}`;

    const saved = await handleSave({ content: updatedText });

    if (saved) {
      setScanned(false);
      setScanStatus('not-scanned');
      setScanWarning('');
      setSuggestedContent('');
      toast.success('Suggested change saved. Run a fresh scan before submitting.');
    }
  }

  async function handleApplyFullSuggestion() {
    if (!canMutateInWorkspace(previewMode)) {
      toast.warning('Applying suggestions is disabled in development workspace preview.');
      return;
    }

    if (
      typeof suggestedContent !== 'string' ||
      !suggestedContent.trim()
    ) {
      toast.warning('No complete suggested content is available.');
      return;
    }

    try {
      setError('');

      const saved = await handleSave({
        content: suggestedContent,
        navigateAfter: false,
      });

      if (!saved) return;

      setScanned(false);
      setScanStatus('not-scanned');
      setScanWarning('');
      setSuggestedContent('');

      toast.success('Suggested content saved. Run a fresh scan when ready.');
    } catch (err) {
      const message = err.message || 'Failed to apply suggested content.';
      setError(message);
      toast.error(message);
    }
  }

  async function handleScan() {
    if (!canMutateInWorkspace(previewMode)) {
      toast.warning('Scanning is disabled in development workspace preview.');
      return;
    }

    try {
      setScanning(true);
      setError('');
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

      if (nextScanStatus === 'partial') {
        toast.warning('Scan incomplete. Resolve the provider issue and run a complete scan before submitting.');
      } else {
        toast.success('Draft scan completed.');
      }

      if (!id) {
        navigate(`/drafts/${saved.id}`, { replace: true });
      }
    } catch (err) {
      const message = err.message || 'Failed to scan draft.';
      setError(message);
      toast.error(message);
    } finally {
      setScanning(false);
    }
  }

  async function handleDecision(finding, decision, reason = '') {
    if (!canMutateInWorkspace(previewMode)) {
      toast.warning('Finding decisions are disabled in development workspace preview.');
      return;
    }

    try {
      if (decision === 'Disputed' && !reason.trim()) {
        toast.warning('Please enter a reason to dispute this finding.');
        return;
      }

      setError('');

      const findingIndex = findings.findIndex(item => item === finding);

      if (findingIndex < 0) {
        throw new Error('Finding not found.');
      }

      await api.updateFinding(draftId, String(findingIndex), decision, reason);

      setFindings(previous => previous.map((item, index) =>
        index === findingIndex ? { ...item, status: decision, reason } : item
      ));

      toast.success(`Finding ${decision.toLowerCase()} successfully.`);
    } catch (err) {
      const message = err.message || 'Failed to update finding decision.';
      setError(message);
      toast.error(message);
    }
  }

  async function handleSubmit() {
    if (!canMutateInWorkspace(previewMode)) {
      toast.warning('Submission is disabled in development workspace preview.');
      return;
    }

    if (!scanned) {
      toast.warning('Run a scan on the latest saved draft before submitting.');
      return;
    }

    if (findings.some(finding => !finding.status || finding.status === 'Open')) {
      toast.warning('Resolve each finding before submitting for approval.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await api.submitDraft(draftId);
      const data = response?.draft ?? response?.data ?? response;

      if (data.status) {
        setStatus(data.status);
      } else {
        setStatus('Pending Approval');
      }

      toast.success('Draft submitted for approval.');
    } catch (err) {
      const message = err.message || 'Failed to submit draft.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComment(comment = '') {
    if (!canMutateInWorkspace(previewMode)) {
      toast.warning('Comments are disabled in development workspace preview.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      await submitReviewComment(api, draftId, comment);
      await loadDraft();

      toast.success('Review comment recorded.');
    } catch (err) {
      const message = err.message || 'Failed to record review comment.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(decision, comments = '') {
    if (!canMutateInWorkspace(previewMode)) {
      toast.warning('Review decisions are disabled in development workspace preview.');
      return;
    }

    if (decision === 'Needs Changes' && !comments.trim()) {
      toast.warning('Add a comment explaining the requested changes.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      await api.reviewDraft(
        draftId,
        decision === 'Approved' ? 'approve' : 'request-changes',
        comments
      );

      setStatus(decision);

      toast.success(
        decision === 'Approved'
          ? 'Draft approved successfully.'
          : 'Changes requested successfully.'
      );

      if (id) await loadDraft();
    } catch (err) {
      const message = err.message || 'Failed to submit review.';
      setError(message);
      toast.error(message);
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

  const hasRevisions = Boolean(originalContent && originalContent.trim() !== text.trim());

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
          <div className="flex items-center justify-between">
            <label htmlFor="draft-content" className="block text-sm font-medium text-slate-700">
              Draft content{' '}
              <span className="text-rose-600" aria-hidden="true">*</span>
            </label>

            {hasRevisions && (
              <button
                type="button"
                onClick={() => setShowDiff(prev => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition"
              >
                <GitCompare size={14} />
                {showDiff ? 'Hide baseline diff' : 'Compare with original baseline'}
              </button>
            )}
          </div>

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

          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>
              {hasRevisions ? (
                <span className="text-emerald-700 font-medium">Revisions active from baseline</span>
              ) : (
                'Initial working baseline'
              )}
            </span>
            <span>{text.length.toLocaleString()} characters</span>
          </div>
        </div>

        {/* Side-by-Side Diff Comparison Panel */}
        {showDiff && hasRevisions && (
          <div className="mt-4">
            <DiffViewer
              originalContent={originalContent}
              currentContent={text}
            />
          </div>
        )}

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Image Scanning (Optional)</h2>
            </div>
            <label className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
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
                className="accent-blue-700"
              />
              This content includes an image
            </label>
          </div>

          {hasImage && (
            <div className="space-y-4">
              <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5 md:grid-cols-[12rem_minmax(0,1fr)]">
                <div
                  className="flex min-h-44 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-center"
                  aria-label="Image preview"
                >
                  {imageFilePreview || (trimmedImageUrl && !imageUrlError) ? (
                    imagePreviewError ? (
                      null
                    ) : (
                      <img
                        src={imageFilePreview || trimmedImageUrl}
                        alt="Selected image preview"
                        onError={() => {
                          setImagePreviewError(true);
                          toast.error('Image preview could not be loaded.');
                        }}
                        onLoad={() => setImagePreviewError(false)}
                        className="max-h-52 w-full rounded-md object-contain"
                      />
                    )
                  ) : (
                    <div className="text-slate-700">
                      <ImagePlus className="mx-auto mb-2 text-blue-700" size={28} aria-hidden="true" />
                      <p className="text-sm font-medium">Image preview</p>
                      <p className="mt-1 text-xs text-slate-500">Choose an image or add a URL</p>
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="draft-image-url" className="block text-sm font-medium text-slate-700">
                      Image URL
                    </label>
                    <input
                      id="draft-image-url"
                      type="url"
                      value={imageUrl}
                      onChange={event => {
                        setImageFile(null);
                        setImageUrl(event.target.value);
                        setImagePreviewError(false);
                        setImageInputError('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      disabled={readOnly || imageScanning}
                      aria-invalid={Boolean(imageUrlError)}
                      aria-describedby={`draft-image-help${imageUrlError ? ' draft-image-url-error' : ''}${imageInputError ? ' draft-image-input-error' : ''}`}
                      className="input w-full"
                      placeholder="https://example.com/image.jpg"
                    />
                    {imageUrlError && (
                      <p id="draft-image-url-error" role="alert" className="field-error">
                        <AlertCircle className="field-validation-icon" aria-hidden="true" />
                        {imageUrlError}
                      </p>
                    )}
                    {imageInputError && (
                      <p id="draft-image-input-error" role="alert" className="field-error">
                        <AlertCircle className="field-validation-icon" aria-hidden="true" />
                        {imageInputError}
                      </p>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif"
                    onChange={handleImageFileChange}
                    disabled={readOnly || imageScanning}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={readOnly || imageScanning}
                      className="btn-secondary inline-flex items-center gap-2"
                    >
                      <ImagePlus className="text-blue-700" size={16} aria-hidden="true" />
                      {imageFile || trimmedImageUrl ? 'Replace image' : 'Upload image'}
                    </button>
                    {(imageFile || trimmedImageUrl) && (
                      <button
                        type="button"
                        onClick={clearImageSelection}
                        disabled={readOnly || imageScanning}
                        className="btn-secondary inline-flex items-center gap-2"
                      >
                        <X size={16} aria-hidden="true" />
                        Remove image
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleScanImage}
                      disabled={readOnly || !hasValidImage || imageScanning}
                      className="btn-primary inline-flex items-center gap-2 disabled:!cursor-not-allowed disabled:!bg-slate-100 disabled:!text-slate-400 disabled:!opacity-100"
                    >
                      {imageScanning ? (
                        <LoaderCircle className="animate-spin" size={16} aria-hidden="true" />
                      ) : (
                        <ScanLine size={16} aria-hidden="true" />
                      )}
                      {imageScanning ? 'Scanning image…' : 'Scan Image'}
                    </button>
                  </div>
                  <p id="draft-image-help" className="text-xs leading-5 text-slate-500">
                    Upload JPEG, PNG, WebP or AVIF images up to 10 MB, or paste an HTTPS image URL.
                  </p>
                </div>
              </div>

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
            </div>
          )}
        </section>

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
            {canDeleteDraft && (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={saving || scanning || submitting || deleting}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete draft
              </button>
            )}
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
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete this draft?"
        description={(
          <>
            <span className="block font-medium text-slate-800">{draft?.title || title || 'Untitled draft'}</span>
            <span className="mt-1 block">This cannot be undone.</span>
          </>
        )}
        confirmLabel="Delete draft"
        onConfirm={handleDeleteDraft}
        onClose={() => {
          if (!deleting) setDeleteConfirmOpen(false);
        }}
      />
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