import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ShieldCheck, LayoutDashboard, FileText, PlusCircle, ClipboardCheck, BookOpen, ScrollText, LogOut, Menu, X, Users, Settings, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/api.js';

const roleLinks = {
  Creator: [{to:'/',label:'Dashboard',icon:LayoutDashboard},{to:'/drafts',label:'My Drafts',icon:FileText},{to:'/drafts/new',label:'Submit Content',icon:PlusCircle}],
  Reviewer: [{to:'/',label:'Dashboard',icon:LayoutDashboard},{to:'/review',label:'Review Queue',icon:ClipboardCheck},{to:'/drafts',label:'Submitted Content',icon:FileText}],
  Manager: [{to:'/',label:'Dashboard',icon:LayoutDashboard},{to:'/review',label:'Approval Workflow',icon:ClipboardCheck},{to:'/rulebook',label:'Guideline Library',icon:BookOpen},{to:'/facts',label:'Facts',icon:ScrollText},{to:'/audit',label:'Privacy & Audit Log',icon:ClipboardList}],
  Admin: [{to:'/',label:'Dashboard',icon:LayoutDashboard},{to:'/drafts',label:'Content',icon:FileText},{to:'/audit',label:'Audit Log',icon:ClipboardList},{to:'/settings',label:'Administration',icon:Settings}]
};
export default function Layout({ role, setRole, user, setUser, children }) {
  const [mobileOpen,setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const links = roleLinks[role] || roleLinks.Creator;
  const logout = () => { api.logout(); setUser(null); navigate('/login'); };
  const nav = <nav className="flex flex-col gap-1">{links.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} end={to==='/'} onClick={() => setMobileOpen(false)} className={({isActive}) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={17}/>{label}</NavLink>)}</nav>;
  return <div className="min-h-screen bg-slate-50">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <NavLink to="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm"><ShieldCheck size={25}/></span>
          <span><span className="block text-lg font-extrabold tracking-tight text-slate-950">Brand<span className="text-emerald-700">Guard</span></span><span className="hidden text-xs text-slate-500 sm:block">V2.4 Enterprise · GreenSip Healthy Drinks Co.</span></span>
        </NavLink>
        <div className="flex items-center gap-2">
          <label className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 md:flex">Role
            <select className="bg-transparent font-semibold text-emerald-800 outline-none" value={role} onChange={e => setRole(e.target.value)} aria-label="Preview role">
              {['Creator','Manager','Reviewer','Admin'].map(r => <option key={r}>{r}</option>)}
            </select>
          </label>
          <span className="hidden text-sm text-slate-600 lg:block">{user?.name || 'Demo User'}</span>
          <button onClick={logout} className="btn-secondary !px-3" aria-label="Log out"><LogOut size={16}/><span className="hidden sm:inline">Logout</span></button>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg border p-2 md:hidden" aria-label="Toggle navigation">{mobileOpen?<X size={19}/>:<Menu size={19}/>}</button>
        </div>
      </div>
      <div className="mx-auto hidden max-w-[1500px] px-4 pb-3 sm:px-6 md:block lg:px-8">{nav}</div>
      <div className="bg-emerald-900 px-4 py-2 text-xs font-medium text-emerald-50 sm:px-6 lg:px-8"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-300"/>Viewing as {role}. {role==='Creator'?'Authoring and remediation mode.':role==='Reviewer'?'Review and decision mode.':role==='Manager'?'Governance and approval mode.':'Administration preview mode.'}<span className="float-right hidden text-emerald-300 sm:inline">Pre-Publication Workflow</span></div>
    </header>
    {mobileOpen && <div className="border-b bg-white p-4 md:hidden"><label className="mb-3 flex items-center gap-2 text-sm">Role <select className="field !w-auto" value={role} onChange={e => setRole(e.target.value)}>{['Creator','Manager','Reviewer','Admin'].map(r=><option key={r}>{r}</option>)}</select></label>{nav}</div>}
    <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">{children || <Outlet/>}</main>
    <footer className="mx-auto max-w-[1500px] px-4 pb-6 text-xs text-slate-400 sm:px-6 lg:px-8">BrandGuard AI · Explainable, human-controlled brand governance · {api.isMock?'Demo mode':'Connected API mode'}</footer>
  </div>;
}