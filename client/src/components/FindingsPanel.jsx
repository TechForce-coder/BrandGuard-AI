import { useState } from 'react';
import { Check, X, MessageSquareWarning, ShieldAlert } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';

export default function FindingsPanel({ findings = [], onDecision, readOnly = false }) {
  const [reasons, setReasons] = useState({});

  if (!findings.length) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        No findings were returned by this scan. Always review content before publishing.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {findings.map((f, index) => (
        <article key={f.id || index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                <ShieldAlert size={16} aria-hidden="true" />
              </span>
              {f.type || f.title || 'Policy finding'}
            </div>
            <StatusBadge status={f.status || 'Open'} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[.08em] text-slate-500">
            <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">Review item</span>
            {typeof f.confidence === 'number' && (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">Confidence {Math.round(f.confidence * 100)}%</span>
            )}
          </div>

          <blockquote className="my-3 border-l-2 border-rose-400 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            “{f.quote || f.excerpt || 'Review this statement'}”
          </blockquote>
          <p className="text-sm leading-6 text-slate-600">{f.explanation || f.description}</p>
          {f.suggestion && (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              <span className="font-semibold text-emerald-700">Suggested change:</span> {f.suggestion}
            </p>
          )}
          {f.citation && <p className="mt-2 text-xs text-slate-500">Citation: {f.citation}</p>}

          {!readOnly && (
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-600">
                Decision note
                <span className="font-normal text-slate-400"> (required to dispute)</span>
                <input
                  aria-label="Decision reason"
                  className="field mt-1.5"
                  placeholder="Add context for your decision"
                  value={reasons[f.id] || ''}
                  onChange={e => setReasons({ ...reasons, [f.id]: e.target.value })}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="btn-success" onClick={() => onDecision?.(f, 'Accepted', reasons[f.id] || '')}>
                  <Check size={15} /> Accept
                </button>
                <button className="btn-secondary" onClick={() => onDecision?.(f, 'Rejected', reasons[f.id] || '')}>
                  <X size={15} /> Reject
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    if (!reasons[f.id]?.trim()) return alert('Please enter a reason to dispute.');
                    onDecision?.(f, 'Disputed', reasons[f.id]);
                  }}
                >
                  <MessageSquareWarning size={15} /> Dispute
                </button>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}