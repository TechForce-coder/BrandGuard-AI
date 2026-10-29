export function getDraftEditorState(draft, fallback = {}) {
  const record = draft && typeof draft === 'object' ? draft : {};
  const hasScannedAt = Object.prototype.hasOwnProperty.call(record, 'scannedAt');
  const scanStatus = record.scanStatus
    ?? (hasScannedAt
      ? record.scannedAt ? 'complete' : 'not-scanned'
      : fallback.scanStatus || (fallback.scanned ? 'complete' : 'not-scanned'));

  return {
    id: record._id || record.id || fallback.id || '',
    title: record.title ?? fallback.title ?? '',
    channel: record.channel ?? fallback.channel ?? '',
    content: record.content ?? fallback.content ?? '',
    hasImage: record.hasImage ?? fallback.hasImage ?? false,
    imageUrl: record.imageUrl ?? fallback.imageUrl ?? '',
    imageScanStatus: record.imageScanStatus ?? fallback.imageScanStatus ?? 'not-scanned',
    imageScanResult: record.imageScanResult ?? fallback.imageScanResult ?? '',
    imageScanDriveUrl: record.imageScanDriveUrl ?? fallback.imageScanDriveUrl ?? '',
    altText: record.altText ?? fallback.altText ?? '',
    findings: Array.isArray(record.findings)
      ? record.findings
      : fallback.findings || [],
    status: record.status ?? fallback.status ?? 'Draft',
    scannedAt: hasScannedAt ? record.scannedAt : fallback.scannedAt || null,
    scanStatus,
    scanWarning: record.scanWarning ?? fallback.scanWarning ?? '',
    reviewHistory: Array.isArray(record.reviewHistory)
      ? record.reviewHistory
      : fallback.reviewHistory || [],
    scanned: scanStatus === 'complete'
      && (hasScannedAt ? Boolean(record.scannedAt) : Boolean(fallback.scanned))
  };
}

export async function submitReviewComment(api, draftId, comment) {
  if (typeof comment !== 'string' || !comment.trim()) {
    throw new Error('Enter a comment before recording it.');
  }

  return api.addDraftComment(draftId, comment);
}
