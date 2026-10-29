import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  ImagePlus,
  Send,
  X,
} from 'lucide-react';

import { api } from '../api/api.js';
import Editor from '../components/Editor.jsx';
import FindingsPanel from '../components/FindingsPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
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

  const [draft, setDraft] = useState(null);
  const [draftId, setDraftId] = useState(id || '');
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('');
  const [text, setText] = useState('');
  const [hasImage, setHasImage] = useState(false);
  const [altText, setAltText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFilePreview, setImageFilePreview] = useState('');
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [imageInputError, setImageInputError] = useState('');
  const [imageScanning, setImageScanning] = useState(false);
  const [imageScanStatus, setImageScanStatus] = useState('not-scanned');
  const [imageScanResult, setImageScanResult] = useState('');
  const [imageScanDriveUrl, setImageScanDriveUrl] = useState('');
  const [imageScanError, setImageScanError] = useState('');
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
  const fileInputRef = useRef(null);
  const submissionInProgress = useRef(false);
  const trimmedImageUrl = imageUrl.trim();
  const imageUrlError = trimmedImageUrl ? getImageUrlError(trimmedImageUrl) : '';

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
      setHasImage(editorState.hasImage);
      setImageUrl(editorState.imageUrl);
      setAltText(editorState.altText);
      setImageScanStatus(editorState.imageScanStatus);
      setImageScanResult(editorState.imageScanResult);
      setImageScanDriveUrl(editorState.imageScanDriveUrl);
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

  function clearImageSelection() {
    setImageFile(null);
    setImageUrl('');
    setImagePreviewError(false);
    setImageInputError('');
    setImageScanResult('');
    setImageScanDriveUrl('');
    setImageScanError('');
    setImageScanStatus('not-scanned');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleImageFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(null);
    setImageUrl('');
    setImagePreviewError(false);
    setImageScanResult('');
    setImageScanDriveUrl('');
    setImageScanError('');
    setImageScanStatus('not-scanned');

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
        imageUrl,
        altText,
      });

      const editorState = getDraftEditorState(saved, {
        id: draftId,
        title,
        channel,
        content: contentToSave,
        hasImage,
        imageUrl,
        altText,
        imageScanStatus,
        imageScanResult,
        imageScanDriveUrl,
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
      setImageUrl(editorState.imageUrl);
      setAltText(editorState.altText);
      setImageScanStatus(editorState.imageScanStatus);
      setImageScanResult(editorState.imageScanResult);
      setImageScanDriveUrl(editorState.imageScanDriveUrl);
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

    if (submissionInProgress.current) return;
    if (hasImage && imageUrlError) {
      setError(imageUrlError);
      return;
    }

    submissionInProgress.current = true;
    let imageScanAttempted = false;
    let imageScanCompleted = false;
    try {
      setSubmitting(true);
      setError('');
      setMessage('');
      setImageScanError('');
      setSuggestedContent('');

      const saved = await handleSave({ navigateAfter: false });
      if (!saved) return;

      let nextFindings = findings;
      let contentScanError = '';
      if (!scanned) {
        setScanning(true);
        try {
          const scanResponse = await api.scanDraft(saved.id, text);
          const scanData = scanResponse?.draft ?? scanResponse?.data ?? scanResponse;
          const scanStatus = scanData.scanStatus || 'complete';
          nextFindings = Array.isArray(scanData.findings) ? scanData.findings : [];
          setFindings(nextFindings);
          setScanStatus(scanStatus);
          setScanWarning(scanData.warning || scanData.scanWarning || '');
          setScanned(scanStatus === 'complete');
          setSuggestedContent(
            scanStatus === 'complete' &&
            typeof scanData.suggestedContent === 'string' &&
            scanData.suggestedContent.trim()
              ? scanData.suggestedContent
              : ''
          );
          if (scanStatus !== 'complete') {
            contentScanError = scanData.warning || 'The content scan was incomplete. Resolve the scan issue and submit again.';
          }
        } catch (scanError) {
          contentScanError = scanError.message || 'Failed to scan draft content.';
        } finally {
          setScanning(false);
        }
      }

      if (hasImage) {
        if (
          (imageFile || trimmedImageUrl) &&
          (imageScanStatus !== 'complete' || saved.imageScanStatus !== 'complete')
        ) {
          imageScanAttempted = true;
          setImageScanning(true);
          setImageScanResult('');
          setImageScanStatus('processing');
          const imageResponse = await api.uploadAndScanFile(
            imageFile,
            saved.id,
            imageFile ? '' : trimmedImageUrl
          );
          const imageData = imageResponse?.draft ?? imageResponse?.data ?? imageResponse;
          const analysis = typeof imageData.imageScanResult === 'string'
            ? imageData.imageScanResult
            : imageResponse.scans
              .map(scan => scan?.geminiAnalysis)
              .filter(value => typeof value === 'string' && value.trim())
              .join('\n\n');

          if (imageData.imageScanStatus !== 'complete' || !analysis.trim()) {
            throw new Error('The image scan did not return a complete result. Retry submission to scan the image again.');
          }

          imageScanCompleted = true;
          setImageScanStatus('complete');
          setImageScanResult(analysis);
          setImageScanDriveUrl(imageData.imageScanDriveUrl || imageResponse.scans[0]?.driveUrl || '');
          setDraft(previous => ({ ...previous, ...imageData }));
        } else if (
          saved.imageScanStatus !== 'complete' ||
          typeof saved.imageScanResult !== 'string' ||
          !saved.imageScanResult.trim()
        ) {
          throw new Error('Upload an image or enter its HTTPS URL before submitting this image draft.');
        } else {
          setImageScanStatus(saved.imageScanStatus);
          setImageScanResult(saved.imageScanResult);
        }
      }

      if (contentScanError) {
        throw new Error(contentScanError);
      }

      if (nextFindings.some(finding => !finding.status || finding.status === 'Open')) {
        throw new Error('Resolve each finding before submitting for approval. Your completed scans have been saved.');
      }

      const response = await api.submitDraft(saved.id);
      const data = response?.draft ?? response?.data ?? response;

      if (data.status) {
        setStatus(data.status);
      } else {
        setStatus('Pending Approval');
      }

      setMessage('Draft submitted for approval.');
      if (!id) {
        navigate(`/drafts/${saved.id}`, { replace: true });
      }
    } catch (err) {
      setMessage('');
      if (imageScanAttempted && !imageScanCompleted) {
        setImageScanStatus('failed');
        setImageScanError(err.message || 'Failed to scan image.');
      }
      setError(err.message || 'Failed to submit draft.');
    } finally {
      setScanning(false);
      setImageScanning(false);
      setSubmitting(false);
      submissionInProgress.current = false;
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

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Image Scanning (Optional)</h2>
              <p className="mt-1 text-sm text-slate-500">
                Add an image to preview it and scan it automatically when you submit.
              </p>
            </div>
            <label className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={hasImage}
                onChange={event => {
                  setHasImage(event.target.checked);
                  setImageScanStatus('not-scanned');
                  setImageScanResult('');
                  setImageScanDriveUrl('');
                  setImageScanError('');
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
                      <p className="text-sm text-slate-600">Image preview could not be loaded.</p>
                    ) : (
                      <img
                        src={imageFilePreview || trimmedImageUrl}
                        alt="Selected image preview"
                        onError={() => setImagePreviewError(true)}
                        onLoad={() => setImagePreviewError(false)}
                        className="max-h-52 w-full rounded-md object-contain"
                      />
                    )
                  ) : (
                    imageScanDriveUrl ? (
                      <div className="text-slate-700">
                        <ImagePlus className="mx-auto mb-2 text-blue-700" size={28} aria-hidden="true" />
                        <p className="text-sm font-medium">Image saved</p>
                        <a
                          href={imageScanDriveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block text-xs text-blue-700 underline"
                        >
                          View uploaded image
                        </a>
                      </div>
                    ) : (
                      <div className="text-slate-700">
                        <ImagePlus className="mx-auto mb-2 text-blue-700" size={28} aria-hidden="true" />
                        <p className="text-sm font-medium">Image preview</p>
                        <p className="mt-1 text-xs text-slate-500">Choose an image or add a URL</p>
                      </div>
                    )
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
                        setImageScanResult('');
                        setImageScanDriveUrl('');
                        setImageScanError('');
                        setImageScanStatus('not-scanned');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      disabled={readOnly || imageScanning}
                      aria-invalid={Boolean(imageUrlError)}
                      aria-describedby="draft-image-help"
                      className="input w-full"
                      placeholder="https://example.com/image.jpg"
                    />
                    {imageUrlError && (
                      <p role="alert" className="text-sm text-rose-700">{imageUrlError}</p>
                    )}
                    {imageInputError && (
                      <p role="alert" className="text-sm text-rose-700">{imageInputError}</p>
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
                  </div>
                  <p id="draft-image-help" className="text-xs leading-5 text-slate-500">
                    Upload JPEG, PNG, WebP or AVIF images up to 10 MB, or paste an HTTPS image URL.
                  </p>
                </div>
              </div>

              {imageScanError && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {imageScanError}
                </p>
              )}
              {imageScanning && (
                <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                  Uploading and scanning image…
                </p>
              )}
              {imageScanResult && (
                <div role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Image scan result</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {imageScanResult}
                  </p>
                </div>
              )}

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
              onClick={handleSubmit}
              disabled={saving || scanning || submitting}
              className="btn-primary inline-flex items-center gap-2"
            >
              {submitting ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Send size={16} />
              )}
              {submitting ? 'Saving and scanning…' : 'Submit for approval'}
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