const REVIEW_ROLES = new Set(['manager', 'admin']);

export function getReviewQueueActions(role, draft) {
  if (
    !REVIEW_ROLES.has(String(role || '').toLowerCase()) ||
    draft?.status !== 'Pending Approval' ||
    !draft?.id
  ) {
    return [];
  }

  return [
    { action: 'approve', label: 'Approve' },
    { action: 'request-changes', label: 'Request Changes' }
  ];
}

export async function submitReviewQueueAction(api, role, draft, action, comment = '') {
  if (!REVIEW_ROLES.has(String(role || '').toLowerCase())) {
    throw new Error('You do not have permission to review this draft.');
  }

  const draftId = draft?.id || draft?._id;
  if (!draftId || draft?.status !== 'Pending Approval') {
    throw new Error('This draft is no longer pending review. Refresh the queue.');
  }

  if (!['approve', 'request-changes'].includes(action)) {
    throw new Error('Invalid review action.');
  }

  if (action === 'request-changes' && !comment.trim()) {
    throw new Error('Add a comment explaining the requested changes.');
  }

  return api.reviewDraft(draftId, action, comment.trim());
}