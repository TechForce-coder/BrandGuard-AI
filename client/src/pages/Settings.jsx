import { LockKeyhole, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';

function SettingRow({ icon: Icon, title, children, status }) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 py-5 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600"><Icon size={18} /></span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">{children}</p>
        </div>
      </div>
      {status && <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{status}</span>}
    </div>
  );
}

export default function Settings() {
  return (
    <div className="max-w-4xl space-y-7">
      <header>
        <p className="section-kicker">Administration</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Workspace Administration</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Review environment status and the boundaries of this frontend configuration.</p>
      </header>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-800"><SettingsIcon size={19} /></span>
          <div><h2 className="text-base font-semibold text-slate-950">Workspace configuration</h2><p className="mt-1 text-xs text-slate-500">Current application integration details</p></div>
        </div>
        <SettingRow icon={ShieldCheck} title="Authentication and authorization">
          Client-side route access is based on the authenticated role. Secure access requires server-side authorization for every protected operation.
        </SettingRow>
        <SettingRow icon={LockKeyhole} title="Environment configuration">
          API endpoint configuration is managed by deployment. Never put secrets or API keys in frontend environment variables.
        </SettingRow>
      </section>

      <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3.5 text-xs leading-5 text-amber-900">
        Configuration controls are intentionally not editable here. Application settings and access policies must be managed through authorized deployment and backend processes.
      </div>
    </div>
  );
}
