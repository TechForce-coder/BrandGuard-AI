import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BookOpen, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList,
  FileText, LayoutDashboard, LogOut, Menu, Plus, Settings, ShieldCheck, Users, X
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
    { to: '/drafts', label: 'Submitted Content', icon: FileText },
    { to: '/audit', label: 'Audit Log', icon: ClipboardList }
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
  const [collapsed, setCollapsed] = useState(false);
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

  const renderNav = (mobile = false) => (
    <nav aria-label="Main navigation" className="grid gap-1.5">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/' || to === '/drafts/new' || (to === '/drafts' && location.pathname === '/drafts/new')}
          onClick={() => setMobileOpen(false)}
          title={collapsed && !mobile ? label : undefined}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'sidebar-link--active' : ''} ${collapsed && !mobile ? 'sidebar-link--collapsed' : ''}`
          }
        >
          <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
          <span className={collapsed && !mobile ? 'lg:hidden' : ''}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );

  const previewSelector = (mobile = false) => (
    <label className={`role-preview ${mobile ? 'role-preview--mobile' : ''}`}>
      <Users size={15} className="shrink-0 text-blue-700" aria-hidden="true" />
      <span className="font-medium">Preview only</span>
      <select
        className="min-w-0 flex-1 bg-transparent font-semibold text-slate-800 outline-none"
        value={role}
        onChange={event => changeRole(event.target.value)}
        aria-label="Preview workspace role"
        title={`Preview workspace UI. Your account role is ${actualRole}; server permissions do not change.`}
      >
        {['Creator', 'Reviewer', 'Manager', 'Admin'].map(item => <option key={item}>{item}</option>)}
      </select>
    </label>
  );

  return (
    <div className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''}`}>
      <aside id="workspace-sidebar" className={`app-sidebar ${mobileOpen ? 'app-sidebar--open' : ''}`} aria-label="Workspace sidebar">
        <div className="sidebar-brand">
          <NavLink to="/" aria-label="BrandGuard home" className="flex min-w-0 items-center gap-3">
            <span className="brand-mark"><ShieldCheck size={21} strokeWidth={1.9} aria-hidden="true" /></span>
            <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
              <span className="block text-[16px] font-bold tracking-tight text-slate-950">
                Brand<span className="text-blue-700">Guard</span>
                <span className="ml-1 text-[10px] font-semibold text-slate-500">AI</span>
              </span>
              <span className="block max-w-44 truncate text-[11px] text-slate-500">
                {user?.organisation?.name || user?.organisationName || 'Brand governance'}
              </span>
            </span>
          </NavLink>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="icon-button ml-auto lg:hidden"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`sidebar-section-label ${collapsed ? 'lg:hidden' : ''}`}>Workspace</div>
        <div className="sidebar-navigation">{renderNav()}</div>

        <div className="sidebar-bottom">
          {!collapsed && (
            <>
            {mobileOpen && previewSelector(true)}
              <div className="sidebar-account">
                <span className="avatar-mark">{(user?.name || user?.email || 'U').slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{user?.name || 'Workspace user'}</span>
                  <span className="block truncate text-xs text-slate-500">Account role: {actualRole}</span>
                </span>
              </div>
              <button type="button" onClick={logout} className="sidebar-logout">
                <LogOut size={16} aria-hidden="true" /> Sign out
              </button>
            </>
          )}
          {collapsed && (
            <button type="button" onClick={logout} className="sidebar-link sidebar-link--collapsed" title="Sign out" aria-label="Sign out">
              <LogOut size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>

      {mobileOpen && <button type="button" className="sidebar-backdrop lg:hidden" aria-label="Close navigation menu" onClick={() => setMobileOpen(false)} />}

      <div className="app-main">
        <header className="app-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="icon-button lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="workspace-sidebar"
            >
              <Menu size={19} />
            </button>
            <button
              type="button"
              className="icon-button hidden lg:inline-flex"
              onClick={() => setCollapsed(value => !value)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
            >
              {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{role} workspace</p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">
                {role !== actualRole ? `Preview only · Account role: ${actualRole}` : roleDescriptions[role] || roleDescriptions.Creator}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 md:inline-flex">
              <Activity size={13} aria-hidden="true" /> Workspace
            </span>
            <div className="hidden max-w-48 sm:block">{previewSelector()}</div>
            <div className="hidden min-w-0 items-center gap-2 border-l border-slate-200 pl-3 md:flex">
              <span className="avatar-mark">{(user?.name || user?.email || 'U').slice(0, 1)}</span>
              <span className="min-w-0">
                <span className="block max-w-32 truncate text-xs font-semibold text-slate-800">{user?.name || 'Workspace user'}</span>
                <span className="block text-[11px] text-slate-500">Account: {actualRole}</span>
              </span>
            </div>
            <button type="button" onClick={logout} className="icon-button sm:hidden" aria-label="Sign out" title="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <main className="page-enter page-shell">
          {children || <Outlet />}
        </main>
        <footer className="app-footer">
          <span>BrandGuard AI · Human-controlled brand governance</span>
          <span>Secure workspace</span>
        </footer>
      </div>
    </div>
  );
}
