import { CheckCircle2, RotateCcw } from 'lucide-react';
export default function ApprovalPanel({ onApprove, onRequestChanges, busy = false }) {
  return <div className="flex flex-wrap gap-2">
    <button disabled={busy} className="btn-success" onClick={onApprove}><CheckCircle2 size={16}/> Approve</button>
    <button disabled={busy} className="btn-secondary" onClick={onRequestChanges}><RotateCcw size={16}/> Request changes</button>
  </div>;
}