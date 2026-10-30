import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff, FilePlus2, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../api/api.js';
import { demoAccounts } from '../config/demoAccounts.js';
import { isWorkspacePreviewSelectorDisabled } from '../utils/workspacePreview.js';

const DEMO_ORGANISATION_ID = '6ae2104b069e81d97d1f36e2';

function DemoAccountCard({ account, onUseCredentials }) {
  const RoleIcon = account.role === 'Manager' ? ShieldCheck : FilePlus2;

  return (
    <article className="demo-account-card min-w-0 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-800">
          <RoleIcon size={13} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="inline-flex shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-900">
            {account.role}
          </span>
          <p className="truncate whitespace-nowrap text-[9px] leading-4 text-slate-600" title={account.description}>
            {account.description}
          </p>
        </div>
      </div>

      <div className="mt-1.5 space-y-1">
        {[
          ['Email', account.email],
          ['Password', account.password]
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <p className="text-[9px] font-medium leading-3 text-slate-500">{label}</p>
            <span className="mt-0.5 block min-w-0 select-text break-all text-left text-[10px] font-medium leading-4 text-slate-800">
              {value}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn-secondary mt-1.5 min-h-8 w-full px-2 py-1.5 text-[10px]"
        onClick={() => onUseCredentials(account.email, account.password)}
      >
        Use these credentials
      </button>
    </article>
  );
}

function DemoAccessPanel({ onUseCredentials, headingId, className = '' }) {
  return (
    <section
      className={`demo-access-panel w-full max-w-md rounded-xl border border-blue-100 bg-white/90 p-2.5 shadow-sm sm:p-3 ${className}`}
      aria-labelledby={headingId}
    >
      <div className="flex items-baseline gap-2">
        <p className="shrink-0 text-[9px] font-bold uppercase tracking-[.14em] text-blue-800">For judges</p>
        <h3 id={headingId} className="truncate text-xs font-semibold text-slate-900">
          Hackathon demo access
        </h3>
      </div>
      <div className="mt-2 grid min-w-0 grid-cols-1 gap-2 min-[900px]:grid-cols-2">
        {demoAccounts.map(account => (
          <DemoAccountCard key={account.role} account={account} onUseCredentials={onUseCredentials} />
        ))}
      </div>
      <p className="mt-1.5 whitespace-nowrap text-center text-[9px] leading-4 text-slate-600">
        These are demo accounts for judges. No real data.
      </p>
    </section>
  );
}

function DemoOrganisationPanel({ onUseOrganisationId, headingId, className = '' }) {
  return (
    <section
      className={`demo-access-panel w-full max-w-md rounded-xl border border-blue-100 bg-white/90 p-2.5 shadow-sm sm:p-3 ${className}`}
      aria-labelledby={headingId}
    >
      <div className="flex items-baseline gap-2">
        <p className="shrink-0 text-[9px] font-bold uppercase tracking-[.14em] text-blue-800">For judges</p>
        <h3 id={headingId} className="truncate text-xs font-semibold text-slate-900">
          Hackathon demo access
        </h3>
      </div>
      <div className="mt-2 min-w-0">
        <p className="text-[9px] font-medium leading-3 text-slate-500">Organisation ID</p>
        <span className="mt-0.5 block min-w-0 select-text break-all text-left font-mono text-[10px] font-medium leading-4 text-slate-800">
          {DEMO_ORGANISATION_ID}
        </span>
      </div>
      <button
        type="button"
        className="btn-secondary mt-1.5 min-h-8 w-full px-2 py-1.5 text-[10px]"
        onClick={onUseOrganisationId}
      >
        Use this Organisation ID
      </button>
      <p className="mt-1.5 text-center text-[9px] leading-4 text-slate-600">
        Demo organisation for judges. No real data.
      </p>
    </section>
  );
}

export default function Login({
  onLogin,
  sessionError = '',
  developmentPreviewEnabled = false,
  initialMode = 'login',
  className = ''
}) {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [organisationId, setOrganisationId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [previewRole, setPreviewRole] = useState('Creator');
  const [mode, setMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [credentialsHighlighted, setCredentialsHighlighted] = useState(false);
  const credentialsTimeoutRef = useRef(null);

  // Synchronize internal state when the URL changes directly
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => () => clearTimeout(credentialsTimeoutRef.current), []);

  const useDemoCredentials = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
    setCredentialsHighlighted(true);
    clearTimeout(credentialsTimeoutRef.current);
    credentialsTimeoutRef.current = setTimeout(() => setCredentialsHighlighted(false), 1200);
  };

  const useDemoOrganisationId = () => setOrganisationId(DEMO_ORGANISATION_ID);

  const toggleMode = () => {
    setError('');
    if (mode === 'login') {
      setMode('register');
      navigate('/registration');
    } else {
      setMode('login');
      navigate('/login');
    }
  };

  const submit = async event => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') {
        if (!organisationId.trim()) {
          setError('Organisation ID is required.');
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          return;
        }
        const result = await api.register({ name, email, password, confirmPassword, organisationId });
        console.log('Registered user:', result.user);
        console.log('Registered role:', result.user?.role);
        onLogin(result.user, result.user.role, true);
        return;
      }
      const result = await api.login(email, password);
      console.log('Logged-in user:', result.user);
      console.log('Logged-in role:', result.user?.role);
      onLogin(result.user, result.user.role, false);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`login-page flex min-h-screen items-center justify-center bg-slate-50 px-4 py-6 sm:px-6 sm:py-10 ${className}`}>
      <div className={`login-card grid w-full max-w-[960px] rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 md:min-h-[560px] md:grid-cols-[1.05fr_.95fr] ${error || sessionError ? 'login-card--error' : ''}`}>
        <aside className="login-brand-panel relative hidden flex-col justify-between overflow-hidden border-r border-blue-100 p-8 text-slate-900 md:flex lg:p-9">
          <span className="login-orb login-orb--one" aria-hidden="true" />
          <span className="login-orb login-orb--two" aria-hidden="true" />
          <div className="login-brand-logo relative flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-900 text-blue-100">
              <ShieldCheck size={25} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="text-xl font-semibold tracking-tight text-slate-950">BrandGuard</span>
          </div>
          {mode === 'register' && (
            <DemoOrganisationPanel
              headingId="desktop-registration-demo-access-heading"
              onUseOrganisationId={useDemoOrganisationId}
              className="relative mt-6 hidden lg:block"
            />
          )}
          <div className="relative flex w-full flex-col gap-4">
            {mode === 'login' && import.meta.env.VITE_SHOW_DEMO_ACCESS !== 'false' && (
              <DemoAccessPanel
                headingId="desktop-demo-access-heading"
                onUseCredentials={useDemoCredentials}
                className="mt-6"
              />
            )}
            <div className="max-w-md">
              <span className="login-brand-badge inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-blue-800">
                <Sparkles size={13} aria-hidden="true" /> Brand governance platform
              </span>
              <h1 className="login-brand-headline mt-5 text-[34px] font-semibold leading-[1.12] tracking-tight lg:text-[42px]">
                <span className="login-headline-line">Confident content.</span><br />
                <span className="login-headline-line login-headline-gradient">Consistent brand.</span>
              </h1>
              <p className="login-brand-copy mt-3 max-w-sm text-sm leading-6 text-slate-600">
                One thoughtful workflow to review, improve, and approve content before it reaches your audience.
              </p>
            </div>
          </div>
          <div className="login-trust-line relative flex items-center gap-2 text-xs text-slate-600">
            <LockKeyhole size={14} className="text-blue-800" aria-hidden="true" /> Human decisions stay in control.
          </div>
        </aside>

        <form onSubmit={submit} className={`login-form flex flex-col justify-center p-7 sm:p-10 lg:p-11 ${credentialsHighlighted ? 'login-form--credentials' : ''}`}>
          <div className="login-mobile-logo mb-6 flex items-center gap-3 md:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-900 text-white">
              <ShieldCheck size={22} />
            </span>
            <span className="text-xl font-semibold tracking-tight text-slate-950">BrandGuard</span>
          </div>
          {mode === 'register' && (
            <DemoOrganisationPanel
              headingId="mobile-registration-demo-access-heading"
              onUseOrganisationId={useDemoOrganisationId}
              className="mb-5 lg:hidden"
            />
          )}
          <p className="login-form-kicker text-xs font-semibold uppercase tracking-[.12em] text-blue-800">Secure workspace access</p>
          <h2 className="login-form-heading mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="login-form-description mt-2 text-sm leading-6 text-slate-500">
            {mode === 'login'
              ? 'Sign in to continue to your brand governance workspace.'
              : 'Join your organisation and start with the Creator role.'}
          </p>

          {mode === 'register' && (
            <>
              <label className="login-form-field mt-5 block text-sm font-semibold text-slate-800">
                Full name
                <input
                  className="field mt-2"
                  type="text"
                  autoComplete="name"
                  minLength={2}
                  maxLength={120}
                  required
                  disabled={busy}
                  value={name}
                  onChange={event => setName(event.target.value)}
                />
              </label>
              <label className="login-form-field mt-4 block text-sm font-semibold text-slate-800">
                Organisation ID
                <input
                  className="field mt-2"
                  type="text"
                  name="organisationId"
                  autoComplete="off"
                  required
                  disabled={busy}
                  value={organisationId}
                  onChange={event => setOrganisationId(event.target.value)}
                />
              </label>
            </>
          )}

          <label className={`login-form-field ${mode === 'register' ? 'mt-4' : 'mt-6'} block text-sm font-semibold text-slate-800`}>
            Work email
            <input
              className="field mt-2"
              type="email"
              autoComplete="username"
              maxLength={254}
              required
              disabled={busy}
              value={email}
              onChange={event => setEmail(event.target.value)}
            />
          </label>

          <label className="login-form-field mt-4 block text-sm font-semibold text-slate-800">
            Password
            <div className="relative mt-2">
              <input
                className="field pr-11"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'register' ? 8 : undefined}
                maxLength={mode === 'register' ? 72 : undefined}
                required
                disabled={busy}
                value={password}
                onChange={event => setPassword(event.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-600"
                onClick={() => setShowPassword(value => !value)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          {mode === 'register' && (
            <label className="login-form-field mt-4 block text-sm font-semibold text-slate-800">
              Confirm password
              <input
                className="field mt-2"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
                disabled={busy}
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
              />
            </label>
          )}

          {mode === 'register' && (
            <label className="login-form-field mt-4 block text-sm font-semibold text-slate-800">
              Select Account Role
              <select
                className="field mt-2"
                value="creator"
                disabled={busy}
                aria-label="Account role"
                readOnly
              >
                <option value="creator">Creator</option>
              </select>
              <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                New accounts start as Creator. An authorized administrator can assign other roles.
              </span>
            </label>
          )}

          {(error || sessionError) && (
            <p key={error || sessionError} role="alert" className="login-error mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
              {error || sessionError}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className={`login-submit btn-primary mt-5 w-full justify-center py-3 ${busy ? 'btn-loading' : ''}`}
          >
            {busy ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : (mode === 'login' ? 'Sign in' : 'Create account')}{' '}
            <ArrowRight size={16} />
          </button>

          <p className="login-form-switch mt-4 text-center text-sm text-slate-600">
            {mode === 'login' ? 'New to BrandGuard?' : 'Already have an account?'}{' '}
            <button
              type="button"
              disabled={busy}
              className="login-switch-link font-semibold text-blue-800 hover:text-blue-950 disabled:opacity-50"
              onClick={toggleMode}
            >
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </p>

          <div className="login-trust-note mt-5 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5 text-xs leading-5 text-slate-500">
            <Check size={15} className="mt-0.5 shrink-0 text-blue-700" />
            <span>Use your organization credentials. Your account is managed by your organization.</span>
          </div>
        </form>
        {mode === 'login' && import.meta.env.VITE_SHOW_DEMO_ACCESS !== 'false' && (
          <div className="px-4 pb-5 sm:px-7 md:hidden">
            <DemoAccessPanel
              headingId="mobile-demo-access-heading"
              onUseCredentials={useDemoCredentials}
            />
          </div>
        )}
      </div>
    </div>
  );
}