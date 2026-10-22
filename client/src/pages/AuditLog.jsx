import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { api } from '../api/api.js';
export default function AuditLog() {
 const [logs,setLogs]=useState([]);const [error,setError]=useState('');
 useEffect(()=>{api.getAudit().then(l=>setLogs(Array.isArray(l)?l:l?.logs||[])).catch(e=>setError(e.message));},[]);
 return <div className="space-y-6"><div><p className="text-sm font-semibold text-emerald-700">Governance</p><h1 className="mt-1 text-3xl font-bold">Privacy & Audit Log</h1><p className="mt-2 text-sm text-slate-500">A chronological view of workflow events.</p></div>{error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">{logs.map((l,i)=><div key={l.id||i} className="flex items-start gap-4 border-b border-slate-100 p-5 last:border-0"><span className="rounded-xl bg-slate-100 p-3 text-slate-600"><ClipboardList size={18}/></span><div className="flex-1"><p className="font-semibold">{l.action||l.event}</p><p className="mt-1 text-sm text-slate-500">{l.item||l.resource||'Workflow event'} · {l.actor||l.user||'System'}</p></div><time className="whitespace-nowrap text-xs text-slate-400">{l.when||l.createdAt||'—'}</time></div>)}{!logs.length&&!error&&<p className="p-6 text-sm text-slate-500">Loading audit events…</p>}</div></div>;
}