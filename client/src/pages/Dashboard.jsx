import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, CheckCircle2, Clock3, FileText, Plus, Search, ShieldCheck } from 'lucide-react';
import { api } from '../api/api.js';
import StatCard from '../components/StatCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

export default function Dashboard({ role }) {
  const [drafts,setDrafts] = useState([]);
  const [filter,setFilter] = useState('All');
  const [search,setSearch] = useState('');
  const [error,setError] = useState('');
  const navigate = useNavigate();
  const load = () => api.getDrafts().then(setDrafts).catch(e=>setError(e.message));
  useEffect(()=>{load();},[]);
  const visible = useMemo(()=>drafts.filter(d => (filter==='All'||d.status===filter) && `${d.title} ${d.author} ${d.channel} ${d.id}`.toLowerCase().includes(search.toLowerCase())),[drafts,filter,search]);
  const pending = drafts.filter(d=>d.status==='Pending Approval').length;
  const reviewed = drafts.filter(d=>d.status==='Approved').length;
  const needs = drafts.filter(d=>d.status==='Needs Changes').length;
  const title = role==='Creator'?'My Content Workspace':role==='Reviewer'?'Review Queue':role==='Manager'?'Governed Content Pipeline':'Administration Overview';
  return <div className="space-y-7">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-emerald-700">{role} workspace</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{title}</h1><p className="mt-2 text-sm text-slate-500">Track content, policy findings and approval status in one place.</p></div>{role==='Creator'&&<button className="btn-success" onClick={()=>navigate('/drafts/new')}><Plus size={17}/> New Draft</button>}</div>
    {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label={role==='Creator'?'My drafts':'Total content'} value={drafts.length} note="Across current workspace" icon={FileText}/>
      <StatCard label="Approved" value={reviewed} note="Approved content items" accent="text-emerald-700" icon={CheckCircle2}/>
      <StatCard label={role==='Creator'?'Needs changes':'Pending approvals'} value={role==='Creator'?needs:pending} note="Items requiring attention" accent="text-amber-600" icon={Clock3}/>
      <StatCard label="Active policy rules" value="28" note="Demo display value" accent="text-emerald-700" icon={ShieldCheck}/>
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center"><div><h2 className="text-lg font-bold text-slate-950">{role==='Reviewer'?'Submitted items for review':'Governed Content Pipeline'}</h2><p className="mt-1 text-sm text-slate-500">Review status and open a content item to continue.</p></div><div className="flex flex-wrap items-center gap-2"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className="field !w-44 !py-2 !pl-9" placeholder="Search content…" value={search} onChange={e=>setSearch(e.target.value)}/></div>{['All','Needs Changes','Pending Approval','Approved','Draft'].map(s=><button key={s} onClick={()=>setFilter(s)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter===s?'bg-slate-900 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{s}</button>)}</div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr>{['Content item / channel','Author','Brand findings','Status','Last updated','Action'].map(h=><th key={h} className="px-5 py-3.5 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">
        {visible.map(d=><tr key={d.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-900">{d.title}</p><p className="mt-1 text-xs text-slate-500">Channel: <span className="text-emerald-700">{d.channel||'Unspecified'}</span> · ID: #{d.id}</p></td><td className="px-5 py-4 text-slate-600">{d.author||'You'}</td><td className="px-5 py-4"><span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${d.findingsCount?'border-rose-200 bg-rose-50 text-rose-700':'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{d.findingsCount||0} {d.findingsCount?'violations':'issues'}</span></td><td className="px-5 py-4"><StatusBadge status={d.status}/></td><td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">{d.updated||'—'}</td><td className="px-5 py-4"><button className="btn-secondary !px-3 !py-1.5" onClick={()=>navigate(`/drafts/${d.id}`)}>{role==='Creator'&&d.status==='Draft'?'Edit':'Review'}</button></td></tr>)}
        {!visible.length&&<tr><td colSpan="6" className="px-5 py-12 text-center"><Activity className="mx-auto mb-2 text-slate-300" size={28}/><p className="font-semibold text-slate-700">No content found</p><p className="mt-1 text-sm text-slate-500">Try another filter or create a new draft.</p></td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}