import { useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../api/api.js';

export default function Login({ onLogin, sessionError = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [previewRole, setPreviewRole] = useState('Creator');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api.login(email, password);
      onLogin(result.user, previewRole);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-[960px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 md:min-h-[560px] md:grid-cols-[1.05fr_.95fr]">
        <aside className="hidden flex-col justify-between border-r border-slate-200 bg-slate-50 p-10 text-slate-900 md:flex lg:p-12">
          <div className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-900 text-blue-100">
              <ShieldCheck size={25} strokeWidth={1.8} />
            </span>
            <span className="text-xl font-semibold tracking-tight text-slate-950">BrandGuard</span>
          </div>
          <div className="relative max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-blue-800">
              <Sparkles size={13} /> Brand governance platform
            </span>
            <h1 className="mt-6 text-[40px] font-semibold leading-[1.12] tracking-tight lg:text-5xl">Confident content.<br />Consistent brand.</h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-slate-600">One thoughtful workflow to review, improve, and approve content before it reaches your audience.</p>
          </div>
          <div className="relative flex items-center gap-2 text-xs text-slate-500">
            <LockKeyhole size={14} /> Human decisions stay in control.
          </div>
        </aside>

        <form onSubmit={submit} className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-900 text-white"><ShieldCheck size={22} /></span>
            <span className="text-xl font-semibold tracking-tight text-slate-950">BrandGuard</span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-blue-800">Secure workspace access</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to continue to your brand governance workspace.</p>
          <label className="mt-7 block text-sm font-semibold text-slate-800">
            Work email
            <input className="field mt-2" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} />
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-800">
            Password
            <div className="relative mt-2">
              <input
                className="field pr-11"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-600"
                onClick={() => setShowPassword(value => !value)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          <label className="mt-4 block text-sm font-semibold text-slate-800">
            Workspace preview after sign in
            <select
              className="field mt-2"
              value={previewRole}
              onChange={event => setPreviewRole(event.target.value)}
              aria-label="Preview workspace role after sign in"
            >
              {['Creator', 'Reviewer', 'Manager', 'Admin'].map(item => <option key={item}>{item}</option>)}
            </select>
            <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
              Preview only. Your account role and permissions are set by your organization.
            </span>
          </label>
          {(error || sessionError) && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">{error || sessionError}</p>}
          <button disabled={busy} className="btn-primary mt-6 w-full justify-center py-3">
            {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} />
          </button>
          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5 text-xs leading-5 text-slate-500">
            <Check size={15} className="mt-0.5 shrink-0 text-blue-700" />
            <span>Use your organization credentials. Your account is managed by your organization.</span>
          </div>
        </form>
      </div>
    </div>
  );
}
