import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DraftEditor from './pages/DraftEditor.jsx';
import Review from './pages/Review.jsx';
import Rulebook from './pages/Rulebook.jsx';
import Facts from './pages/Facts.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Settings from './pages/Settings.jsx';
import { api } from './api/api.js';
import {
  canMutateInWorkspace,
  isWorkspacePreviewEnabled,
  PREVIEW_ROLE_STORAGE_KEY,
  resolveWorkspaceSelection
} from './utils/workspacePreview.js';

function Protected({ user, children }) {
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [user,setUser] = useState(null);
  const [loading,setLoading] = useState(true);
  const [sessionError,setSessionError] = useState('');
  const [workspaceNotice,setWorkspaceNotice] = useState('');
  const [selectedWorkspace,setSelectedWorkspace] = useState(null);
  const previewEnabled = isWorkspacePreviewEnabled(
    import.meta.env.DEV,
    import.meta.env.PROD,
    import.meta.env.VITE_ENABLE_WORKSPACE_PREVIEW,
    window.location.hostname
  );
  const location = useLocation();
  useEffect(()=>{
    let active = true;
    const restoreSession = async () => {
      if (!api.hasSession()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const profile = await api.me();
        if (!profile || !resolveWorkspaceSelection(profile.role, profile.role, previewEnabled).actualRole) {
          api.clearSession();
          if (active) setSessionError('Your account profile could not be verified. Sign in again to continue.');
          return;
        }
        if (active) {
          setUser(profile);
          if (previewEnabled) {
            const storedPreview = sessionStorage.getItem(PREVIEW_ROLE_STORAGE_KEY);
            setSelectedWorkspace(resolveWorkspaceSelection(profile.role, storedPreview, true).workspaceRole);
          } else {
            sessionStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY);
          }
        }
      } catch (error) {
        if (active) {
          setSessionError(error.status === 401
            ? 'Your session has expired. Sign in again to continue.'
            : 'We could not verify your session. Sign in again to continue.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    restoreSession();
    const handleExpiredSession = () => {
      setUser(null);
      setSessionError('Your session has expired. Sign in again to continue.');
    };
    window.addEventListener('brandguard:session-expired', handleExpiredSession);
    return () => {
      active = false;
      window.removeEventListener('brandguard:session-expired', handleExpiredSession);
    };
  },[previewEnabled]);
  if(loading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading BrandGuard…</div>;
  if(location.pathname==='/login') {
    if (user) return <Navigate to="/" replace />;
    return <Login developmentPreviewEnabled={previewEnabled} sessionError={sessionError} onLogin={(profile, previewRole, accountCreated = false) => {
      setSessionError('');
      const selection = resolveWorkspaceSelection(profile?.role, previewRole, previewEnabled);
      setSelectedWorkspace(selection.workspaceRole);
      if (previewEnabled) {
        sessionStorage.setItem(PREVIEW_ROLE_STORAGE_KEY, selection.workspaceRole);
      } else {
        sessionStorage.removeItem(PREVIEW_ROLE_STORAGE_KEY);
      }
      setWorkspaceNotice(accountCreated
        ? 'Your Creator account and private workspace were created successfully.'
        : selection.actualRole && previewRole && selection.actualRole !== previewRole && !selection.previewMode
          ? `You selected the ${previewRole} workspace, but your account is ${selection.actualRole}. Opening your authorized ${selection.actualRole} workspace.`
          : '');
      setUser(profile);
    }} />;
  }
  const selection = resolveWorkspaceSelection(
    user?.role,
    selectedWorkspace || user?.role,
    previewEnabled
  );
  const { actualRole, workspaceRole, previewMode } = selection;
  if (!actualRole) return <Navigate to="/login" replace />;
  const allowMutations = canMutateInWorkspace(previewMode);
  return <Protected user={user}><Layout role={workspaceRole} actualRole={actualRole} previewMode={previewMode} user={user} setUser={setUser} onLogoutError={setSessionError} workspaceNotice={workspaceNotice}><Routes>
    <Route path="/" element={<Dashboard role={workspaceRole} actualRole={actualRole} previewMode={previewMode}/>}/>
    <Route path="/drafts" element={<Dashboard role={workspaceRole} actualRole={actualRole} previewMode={previewMode} showDrafts/>}/>
    <Route path="/drafts/new" element={workspaceRole==='Creator' && allowMutations?<DraftEditor actualRole={actualRole}/>:<Navigate to="/" replace/>}/>
    <Route path="/drafts/:id" element={<DraftEditor actualRole={actualRole} workspaceRole={workspaceRole} previewMode={previewMode}/>}/>
    <Route path="/review" element={['Reviewer','Manager','Admin'].includes(workspaceRole)?<Review role={workspaceRole} actualRole={actualRole} previewMode={previewMode}/>:<Navigate to="/" replace/>}/>
    <Route path="/rulebook" element={['Manager','Admin'].includes(workspaceRole)?<Rulebook actualRole={actualRole} previewMode={previewMode}/>:<Navigate to="/" replace/>}/>
    <Route path="/facts" element={['Manager','Admin'].includes(workspaceRole)?<Facts actualRole={actualRole} previewMode={previewMode}/>:<Navigate to="/" replace/>}/>
    <Route path="/audit" element={['Reviewer','Manager','Admin'].includes(workspaceRole)?<AuditLog actualRole={actualRole} previewMode={previewMode}/>:<Navigate to="/" replace/>}/>
    <Route path="/settings" element={workspaceRole==='Admin'?<Settings actualRole={actualRole} previewMode={previewMode}/>:<Navigate to="/" replace/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Layout></Protected>;
}