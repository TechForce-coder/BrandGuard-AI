import { FileText } from 'lucide-react';

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  disabled = false,
  compact = false,
  className = ''
}) {
  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''} ${className}`}>
      <svg className="empty-state__illustration" viewBox="0 0 96 72" fill="none" aria-hidden="true">
        <path d="M24 7.5h31l17 17v38A4.5 4.5 0 0 1 67.5 67h-43a4.5 4.5 0 0 1-4.5-4.5V12a4.5 4.5 0 0 1 4.5-4.5Z" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="2" />
        <path d="M55 8v17h17" stroke="#93C5FD" strokeWidth="2" />
        <path d="M32 38h24M32 47h18" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
        <circle cx="69" cy="53" r="13" fill="#fff" stroke="#93C5FD" strokeWidth="2" />
        <path d="m64 53 3.5 3.5L74 49" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm leading-5 text-slate-500">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="btn-secondary mt-4" onClick={onAction} disabled={disabled}>
          <FileText size={15} aria-hidden="true" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
