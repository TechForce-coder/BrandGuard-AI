import { useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { api } from '../api/api.js';
export default function Login({ onLogin }) {
  const [email,setEmail] = useState('creator@greensip.demo');
  const [password,setPassword] = useState('demo123');
  const [role,setRole] = useState('Creator');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const submit = async e => { e.preventDefault(); setError(''); setBusy(true); try { const result = await api.login(email,password,role); onLogin(result.user || { name:email.split('@')[0], email, role }); } catch(err) { setError(err.message); } finally { setBusy(false); } };
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
    <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-emerald-900 p-10 text-white md:flex"><div className="flex items-center gap-3"><ShieldCheck size={32}/><span className="text-2xl font-bold">BrandGuard</span></div><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-emerald-300">Brand governance platform</p><h1 className="mt-4 text-4xl font-bold leading-tight">Confident content.<br/>Consistent brand.</h1><p className="mt-4 leading-7 text-emerald-100">Review, improve and approve content before it reaches your audience.</p></div><p className="text-xs text-emerald-300">Human decisions stay in control.</p></div>
      <form onSubmit={submit} className="p-7 sm:p-10"><div className="mb-8 flex items-center gap-3 md:hidden"><ShieldCheck className="text-emerald-700" size={30}/><b className="text-xl">BrandGuard</b></div><h2 className="text-2xl font-bold text-slate-950">Welcome back</h2><p className="mt-2 text-sm text-slate-500">Sign in to your governance workspace.</p>
        <label className="mt-6 block text-sm font-semibold">Email<input className="field mt-2" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label className="mt-4 block text-sm font-semibold">Password<input className="field mt-2" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
        {api.isMock && <label className="mt-4 block text-sm font-semibold">Demo role<select className="field mt-2" value={role} onChange={e=>setRole(e.target.value)}>{['Creator','Reviewer','Manager','Admin'].map(r=><option key={r}>{r}</option>)}</select></label>}
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
        <button disabled={busy} className="btn-success mt-6 w-full justify-center py-3">{busy?'Signing in…':'Sign in'}<ArrowRight size={16}/></button>
        <p className="mt-4 text-xs leading-5 text-slate-400">{api.isMock?'Demo mode: any non-empty email and password work.':'Use your organization credentials.'}</p>
      </form>
    </div>
  </div>;
}