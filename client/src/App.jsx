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

function Protected({ user, children }) { return user ? children : <Navigate to="/login" replace/>; }
export default function App() {
  const [user,setUser] = useState(null);
  const [role,setRole] = useState('Creator');
  const [loading,setLoading] = useState(true);
  const location = useLocation();
  useEffect(()=>{api.me().then(u=>{if(u){setUser(u);setRole(u.role||'Creator');}}).catch(()=>{}).finally(()=>setLoading(false));},[]);
  useEffect(()=>{if(user && api.isMock){const updated={...user,role};localStorage.setItem('brandguard-demo-user',JSON.stringify(updated));}},[role,user]);
  if(loading) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading BrandGuard…</div>;
  if(location.pathname==='/login') return user ? <Navigate to="/" replace/> : <Login onLogin={u=>{setUser(u);setRole(u.role||'Creator');}}/>;
  return <Protected user={user}><Layout role={role} setRole={setRole} user={user}><Routes>
    <Route path="/" element={<Dashboard role={role}/>}/>
    <Route path="/drafts" element={<Dashboard role={role}/>}/>
    <Route path="/drafts/new" element={role==='Creator'?<DraftEditor role={role}/>:<Navigate to="/" replace/>}/>
    <Route path="/drafts/:id" element={<DraftEditor role={role}/>}/>
    <Route path="/review" element={['Reviewer','Manager','Admin'].includes(role)?<Review role={role}/>:<Navigate to="/" replace/>}/>
    <Route path="/rulebook" element={['Manager','Admin'].includes(role)?<Rulebook/>:<Navigate to="/" replace/>}/>
    <Route path="/facts" element={['Manager','Admin'].includes(role)?<Facts/>:<Navigate to="/" replace/>}/>
    <Route path="/audit" element={['Manager','Admin'].includes(role)?<AuditLog/>:<Navigate to="/" replace/>}/>
    <Route path="/settings" element={role==='Admin'?<Settings/>:<Navigate to="/" replace/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Layout></Protected>;
}