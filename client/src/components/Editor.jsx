export default function Editor({ value, onChange, readOnly = false }) {
  return <textarea className="field min-h-64 resize-y leading-7" aria-label="Draft content" value={value} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} placeholder="Write your marketing content here…" />;
}