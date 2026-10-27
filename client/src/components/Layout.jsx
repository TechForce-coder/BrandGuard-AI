import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BookOpen, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList,
  FileText, LayoutDashboard, LogOut, Menu, Plus, Settings, ShieldCheck, X
} from 'lucide-react';
import { api } from '../api/api.js';
import { PREVIEW_ROLE_STORAGE_KEY, WORKSPACE_CONFIG } from '../utils/workspacePreview.js';

const navigationIcons = {
  '/': LayoutDashboard,
  '/drafts': FileText,
  '/drafts/new': Plus,
  '/review': ClipboardCheck,
  '/rulebook': BookOpen,
  '/facts': FileText,
  '/audit': ClipboardList,
  '/settings': Settings
};

const roleDescriptions = {
  Creator: 'Create and prepare content for review.',
  Reviewer: 'Review submissions and record decisions.',
  Manager: 'Oversee approvals and brand governance.',
  Admin: 'Manage administration and workspace activity.'
};

export default function Layout({ role, actualRole, previewMode = false, user, setUser, onLogoutError, workspaceNotice = '', children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const links = (WORKSPACE_CONFIG[role] || WORKSPACE_CONFIG.Creator).navigation.map(item => ({
    ...item,
    icon: navigationIcons[item.to]
  }));
  const logout = async () => {
    if (!user) return;
    try {
      await api.logout();
    } catch (error) {
      if (error.status !== 401) {
        onLogoutError?.('You were signed out on this device, but the server could not invalidate your session. Try signing in again after service connectivity is restored.');
      }
    }
    sessionStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY);
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
                {previewMode ? `Development preview · Actual account role: ${actualRole}` : roleDescriptions[role] || roleDescriptions.Creator}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 md:inline-flex">
              <Activity size={13} aria-hidden="true" /> Workspace
            </span>

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
          {previewMode && (
            <div role="status" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <strong>DEVELOPMENT PREVIEW — {role} workspace UI</strong>
              <span className="ml-1">Signed in as {actualRole}. This preview does not grant {role} permissions; protected actions are disabled and backend access remains limited to your actual role.</span>
            </div>
          )}
          {workspaceNotice && (
            <p role="status" className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {workspaceNotice}
            </p>
          )}
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
