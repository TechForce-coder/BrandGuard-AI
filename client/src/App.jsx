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

function normalizeRole(role) {
  const roles = {
    creator: 'Creator',
    reviewer: 'Reviewer',
    manager: 'Manager',
    admin: 'Admin'
  };

  return roles[String(role || '').toLowerCase()] || 'Creator';
}

function Protected({ user, children }) {
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const [user,setUser] = useState(null);
  const [role,setRole] = useState('Creator');
  const [loading,setLoading] = useState(true);
  const [sessionError,setSessionError] = useState('');
  const location = useLocation();
  useEffect(()=>{
    api.me()
      .then(u=>{if(u){setUser(u);setRole(normalizeRole(u.role));}})
      .catch(error=>{
        if(error.status !== 401) setSessionError('We could not verify your session. Sign in again to continue.');
      })
      .finally(()=>setLoading(false));
  },[]);
  if(loading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading BrandGuard…</div>;
  if(location.pathname==='/login') {
    if (user) return <Navigate to="/" replace />;
    return <Login sessionError={sessionError} onLogin={(u, previewRole)=>{setUser(u);setRole(previewRole || normalizeRole(u.role));}} />;
  }
  return <Protected user={user}><Layout role={role} actualRole={normalizeRole(user?.role)} user={user} setUser={setUser} setRole={setRole}><Routes>
    <Route path="/" element={<Dashboard role={role}/>}/>
    <Route path="/drafts" element={<Dashboard role={role}/>}/>
    <Route path="/drafts/new" element={role==='Creator'?<DraftEditor actualRole={normalizeRole(user?.role)}/>:<Navigate to="/" replace/>}/>
    <Route path="/drafts/:id" element={<DraftEditor actualRole={normalizeRole(user?.role)}/>}/>
    <Route path="/review" element={['Reviewer','Manager','Admin'].includes(role)?<Review role={role}/>:<Navigate to="/" replace/>}/>
    <Route path="/rulebook" element={['Manager','Admin'].includes(role)?<Rulebook/>:<Navigate to="/" replace/>}/>
    <Route path="/facts" element={['Manager','Admin'].includes(role)?<Facts/>:<Navigate to="/" replace/>}/>
    <Route path="/audit" element={['Manager','Admin'].includes(role)?<AuditLog/>:<Navigate to="/" replace/>}/>
    <Route path="/settings" element={role==='Admin'?<Settings/>:<Navigate to="/" replace/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Layout></Protected>;
}