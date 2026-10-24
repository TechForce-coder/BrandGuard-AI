import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BookOpen, ClipboardCheck, ClipboardList, FileText, LayoutDashboard,
  LogOut, Menu, Plus, Settings, ShieldCheck, Users, X
} from 'lucide-react';
import { api } from '../api/api.js';

const roleLinks = {
  Creator: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/drafts', label: 'My Drafts', icon: FileText },
    { to: '/drafts/new', label: 'Submit Content', icon: Plus }
  ],
  Reviewer: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/review', label: 'Review Queue', icon: ClipboardCheck },
    { to: '/drafts', label: 'Submitted Content', icon: FileText }
  ],
  Manager: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/review', label: 'Approval Workflow', icon: ClipboardCheck },
    { to: '/rulebook', label: 'Guideline Library', icon: BookOpen },
    { to: '/facts', label: 'Facts', icon: FileText },
    { to: '/audit', label: 'Privacy & Audit Log', icon: ClipboardList }
  ],
  Admin: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/drafts', label: 'Content', icon: FileText },
    { to: '/rulebook', label: 'Guideline Library', icon: BookOpen },
    { to: '/facts', label: 'Facts', icon: FileText },
    { to: '/audit', label: 'Audit Log', icon: ClipboardList },
    { to: '/settings', label: 'Administration', icon: Settings }
  ]
};

const roleDescriptions = {
  Creator: 'Create and prepare content for review.',
  Reviewer: 'Review submissions and record decisions.',
  Manager: 'Oversee approvals and brand governance.',
  Admin: 'Manage administration and workspace activity.'
};

export default function Layout({ role, actualRole, user, setUser, setRole, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const links = roleLinks[role] || roleLinks.Creator;
  const changeRole = nextRole => {
    setRole(nextRole);
    setMobileOpen(false);
    navigate('/');
  };
  const logout = () => {
    if (!user) return;
    api.logout();
    setUser(null);
    navigate('/login');
  };

  const renderNav = mobile => (
    <nav aria-label="Main navigation" className={mobile ? 'grid gap-1' : 'flex min-w-max items-center gap-1.5'}>
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/' || to === '/drafts/new' || (to === '/drafts' && location.pathname === '/drafts/new')}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) => `nav-pill ${mobile ? 'w-full justify-start' : ''} ${isActive ? 'nav-pill--active' : ''}`}
        >
          <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f6f8f6]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-[0_10px_30px_rgba(15,23,42,0.02)]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <NavLink to="/" aria-label="BrandGuard home" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-900 text-white shadow-[0_10px_20px_rgba(16,73,46,0.25)]">
              <ShieldCheck size={22} strokeWidth={1.8} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="block text-[17px] font-bold tracking-tight text-slate-950">
                  Brand<span className="text-emerald-800">Guard</span>
                </span>
                <span className="hidden rounded-md border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-slate-500 sm:inline-flex">AI</span>
              </span>
              <span className="hidden max-w-44 truncate text-[11px] font-medium text-slate-500 sm:block">
                {user?.organisation?.name || user?.organisationName || 'Brand governance workspace'}
              </span>
            </span>
          </NavLink>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 xl:inline-flex">
              <Activity size={13} aria-hidden="true" /> Workspace
            </span>
            <label className="hidden items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-2 py-1.5 text-xs text-emerald-950 sm:flex sm:px-3 sm:py-2">
              <Users size={15} className="shrink-0 text-emerald-700" aria-hidden="true" />
              <span className="font-medium">Preview</span>
              <select
                className="max-w-[92px] bg-transparent font-semibold outline-none sm:max-w-[112px]"
                value={role}
                onChange={event => changeRole(event.target.value)}
                aria-label="Preview workspace role"
                title={`Preview workspace UI. Your account role is ${actualRole}; server permissions do not change.`}
              >
                {['Creator', 'Reviewer', 'Manager', 'Admin'].map(item => <option key={item}>{item}</option>)}
              </select>
            </label>
            {user && <div className="hidden min-w-0 items-center gap-2.5 border-l border-slate-200 pl-3 sm:flex">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold uppercase text-emerald-900">
                {(user?.name || user?.email || 'U').slice(0, 1)}
              </span>
              <span className="hidden min-w-0 lg:block">
                <span className="block max-w-36 truncate text-xs font-semibold text-slate-800">{user?.name || 'Workspace user'}</span>
                <span className="block text-[11px] text-slate-500">Account: {actualRole}</span>
              </span>
            </div>}
            {user && <button onClick={logout} className="btn-secondary !min-h-9 !px-2.5 sm:!px-3" aria-label="Log out">
              <LogOut size={15} aria-hidden="true" /><span className="hidden sm:inline">Log out</span>
            </button>}
            <button
              type="button"
              onClick={() => setMobileOpen(open => !open)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 lg:hidden"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
            >
              {mobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        <div className="mx-auto hidden max-w-[1500px] px-4 pb-2.5 sm:px-6 lg:block lg:px-8">
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{renderNav(false)}</div>
        </div>
      </header>

      {mobileOpen && (
        <div id="mobile-navigation" className="mobile-menu-enter border-b border-slate-200 bg-white px-4 py-4 shadow-lg shadow-slate-900/5 lg:hidden">
          <label className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm font-medium text-emerald-950 sm:hidden">
            <span className="inline-flex items-center gap-2"><Users size={16} className="text-emerald-700" /> Preview workspace role</span>
            <select className="field !w-auto !py-1.5" value={role} onChange={event => changeRole(event.target.value)} aria-label="Preview workspace role">
              {['Creator', 'Reviewer', 'Manager', 'Admin'].map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          {renderNav(true)}
          <p className="mt-4 text-xs leading-5 text-slate-500">
            Preview only. Your account role is {actualRole}; server permissions are unchanged.
          </p>
        </div>
      )}

      <div className={`border-b ${role !== actualRole ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-900/10 bg-emerald-950 text-emerald-50'}`}>
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-xs font-medium">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${role !== actualRole ? 'bg-amber-500' : 'bg-emerald-300'}`} />
            {role !== actualRole ? (
              <span className="font-semibold">Previewing {role} workspace · Account role: {actualRole}. Server permissions are unchanged.</span>
            ) : (
              <>
                <span className="font-semibold">{role} workspace</span>
                <span className="hidden text-emerald-100/75 sm:inline">{roleDescriptions[role] || roleDescriptions.Creator}</span>
              </>
            )}
          </p>
          {role === actualRole && <span className="hidden text-[11px] text-emerald-200/75 md:inline">Workspace access</span>}
        </div>
      </div>

      <main className="page-enter page-shell min-h-[calc(100vh-190px)]">
        {children || <Outlet />}
      </main>
      <footer className="mx-auto flex max-w-[1500px] flex-col gap-1 px-4 pb-6 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>BrandGuard AI · Explainable, human-controlled brand governance</span>
        <span>Brand governance workspace</span>
      </footer>
    </div>
  );
}
