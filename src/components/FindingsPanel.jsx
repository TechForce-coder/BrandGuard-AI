import { useState } from 'react';
import { Check, X, MessageSquareWarning, ShieldAlert } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';

export default function FindingsPanel({ findings = [], onDecision, readOnly = false }) {
  const [reasons, setReasons] = useState({});
  if (!findings.length) return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">No findings detected in this demo scan. Always review content before publishing.</div>;
  return <div className="space-y-3">
    {findings.map((f, index) => <article key={f.id || index} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-slate-900"><ShieldAlert size={17} className="text-rose-600" />{f.type || f.title || 'Policy finding'}</div>
        <StatusBadge status={f.status || 'Open'} />
      </div>
      <blockquote className="my-3 border-l-2 border-rose-400 bg-rose-50 px-3 py-2 text-sm text-rose-800">“{f.quote || f.excerpt || 'Review this statement'}”</blockquote>
      <p className="text-sm text-slate-600">{f.explanation || f.description}</p>
      {f.suggestion && <p className="mt-2 text-sm"><span className="font-semibold text-emerald-700">Suggested change: </span>{f.suggestion}</p>}
      {f.citation && <p className="mt-2 text-xs text-slate-500">Citation: {f.citation}</p>}
      {!readOnly && <div className="mt-3 space-y-2">
        <input aria-label="Decision reason" className="field" placeholder="Reason (required for dispute)" value={reasons[f.id] || ''} onChange={e => setReasons({ ...reasons, [f.id]:e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-success" onClick={() => onDecision?.(f, 'Accepted', reasons[f.id] || '')}><Check size={15}/> Accept</button>
          <button className="btn-secondary" onClick={() => onDecision?.(f, 'Rejected', reasons[f.id] || '')}><X size={15}/> Reject</button>
          <button className="btn-secondary" onClick={() => { if (!reasons[f.id]?.trim()) return alert('Please enter a reason to dispute.'); onDecision?.(f, 'Disputed', reasons[f.id]); }}><MessageSquareWarning size={15}/> Dispute</button>
        </div>
      </div>}
    </article>)}
  </div>;
}