const styles = {
  'Approved': 'bg-status-approved-bg text-status-approved-text',
  'Pending Approval': 'bg-status-pending-bg text-status-pending-text status-badge--pending',
  'Pending': 'bg-status-pending-bg text-status-pending-text',
  'Needs Changes': 'bg-status-needs-changes-bg text-status-needs-changes-text',
  'Draft': 'bg-status-draft-bg text-status-draft-text',
  'Open': 'bg-danger-100 text-danger-800',
  'Accepted': 'bg-success-100 text-success-800',
  'Rejected': 'bg-status-draft-bg text-status-draft-text',
  'Disputed': 'bg-info-50 text-info-800',
  'Valid': 'bg-success-50 text-success-800',
  'Expired': 'bg-danger-50 text-danger-800',
  'Inactive': 'bg-status-draft-bg text-status-draft-text',
  'Review mode': 'bg-info-50 text-info-800',
  'Active': 'bg-success-50 text-success-800',
  'Reviewing': 'bg-warning-50 text-warning-800'
};

export default function StatusBadge({ status }) {
  const normalized = status || 'Unknown';
  const style = styles[normalized] || 'bg-status-draft-bg text-status-draft-text';

  return (
    <span className={`status-badge inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${style}`}>
      <span className="status-badge__dot h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden="true" />
      {normalized}
    </span>
  );
}