const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false';
const STORAGE_KEY = 'brandguard-demo-drafts-v1';

const seedDrafts = [
  { id:'GS-109', title:'Summer Wellness Launch Campaign', channel:'Instagram', author:'Alex Rivera', status:'Needs Changes', findingsCount:6, updated:'10m ago', text:'GreenSip supports your healthy lifestyle. Our drink gives you guaranteed energy and detoxes your body in just one day.' },
  { id:'GS-108', title:'Citrus Glow SKU Launch Banner', channel:'Website', author:'Taylor Brooks', status:'Approved', findingsCount:0, updated:'2h ago', text:'Meet Citrus Glow, a refreshing citrus drink for your everyday routine.' },
  { id:'GS-107', title:'Annual Sustainability & Recyclable Cans Report', channel:'Press Release', author:'Morgan Vance', status:'Pending Approval', findingsCount:1, updated:'4h ago', text:'Our new packaging is designed with recyclability in mind.' },
  { id:'GS-106', title:'Holiday Member Newsletter', channel:'Email Newsletter', author:'Sam Chen', status:'Approved', findingsCount:0, updated:'1d ago', text:'Thank you for being part of the GreenSip community.' }
];

function readDrafts() {
  try { const stored = localStorage.getItem(STORAGE_KEY); return stored ? JSON.parse(stored) : seedDrafts; }
  catch { return seedDrafts; }
}
function writeDrafts(drafts) { localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts)); }
async function request(path, options = {}) {
  const token = localStorage.getItem('brandguard-token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}), ...options.headers }
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.error || `Request failed (${response.status})`);
  return body;
}

export const api = {
  isMock: MOCKS,
  async login(email, password, role) {
    if (!MOCKS) {
      const result = await request('/auth/login', { method:'POST', body:JSON.stringify({ email, password }) });
      if (result?.token) localStorage.setItem('brandguard-token', result.token);
      return result;
    }
    if (!email.trim() || !password.trim()) throw new Error('Enter an email and password.');
    const user = { id:'demo-user', name:email.split('@')[0] || 'Demo User', email, role:role || 'Creator', organisationId:'greensip-demo' };
    localStorage.setItem('brandguard-demo-user', JSON.stringify(user));
    return { user, token:'demo-token' };
  },
  async me() {
    if (!MOCKS) return request('/auth/me');
    try { return JSON.parse(localStorage.getItem('brandguard-demo-user')) || null; } catch { return null; }
  },
  logout() { localStorage.removeItem('brandguard-token'); localStorage.removeItem('brandguard-demo-user'); },
  async getDrafts() {
    if (!MOCKS) { const data = await request('/drafts'); return Array.isArray(data) ? data : data?.drafts || []; }
    return readDrafts();
  },
  async getDraft(id) {
    if (!MOCKS) return request(`/drafts/${id}`);
    return readDrafts().find(d => String(d.id) === String(id)) || null;
  },
  async saveDraft(draft) {
    if (!MOCKS) return draft.id ? request(`/drafts/${draft.id}`, { method:'PUT', body:JSON.stringify(draft) }) : request('/drafts', { method:'POST', body:JSON.stringify(draft) });
    const drafts = readDrafts();
    const id = draft.id || `GS-${Date.now().toString().slice(-5)}`;
    const saved = { ...draft, id, status:'Draft', findingsCount:0, author:draft.author || 'You', updated:'Just now' };
    const index = drafts.findIndex(d => String(d.id) === String(id));
    if (index >= 0) drafts[index] = saved; else drafts.unshift(saved);
    writeDrafts(drafts); return saved;
  },
  async scanDraft(id, text) {
    if (!MOCKS) return request(`/drafts/${id}/scan`, { method:'POST', body:JSON.stringify({ text }) });
    const rules = [
      { id:'F-001', type:'Unsupported health claim', quote:'detoxes your body', explanation:'This phrase makes a health-related claim that needs approved evidence.', suggestion:'Remove the detox claim or cite an approved, verifiable source.', status:'Open', confidence:0.96 },
      { id:'F-002', type:'Absolute guarantee', quote:'guaranteed energy', explanation:'Absolute guarantees can mislead customers unless substantiated and approved.', suggestion:'Use a qualified, supportable description instead.', status:'Open', confidence:0.91 },
      { id:'F-003', type:'Time-bound claim', quote:'in just one day', explanation:'A specific outcome timeline requires reliable supporting evidence.', suggestion:'Remove the timeline unless it is documented in the rulebook.', status:'Open', confidence:0.87 }
    ].filter(f => text.toLowerCase().includes(f.quote.toLowerCase()));
    return { findings:rules, summary:{ total:rules.length } };
  },
  async updateFinding(id, findingId, decision, reason = '') {
    if (!MOCKS) return request(`/findings/${findingId}`, { method:'PATCH', body:JSON.stringify({ status:decision, reason }) });
    return { id:findingId, status:decision, reason };
  },
  async submitDraft(id) {
    if (!MOCKS) return request(`/drafts/${id}/submit`, { method:'POST', body:'{}' });
    const drafts = readDrafts().map(d => String(d.id) === String(id) ? { ...d, status:'Pending Approval', updated:'Just now' } : d);
    writeDrafts(drafts); return { ok:true };
  },
  async reviewDraft(id, action, comment = '') {
    const path = action === 'approve' ? 'approve' : 'request-changes';
    if (!MOCKS) return request(`/drafts/${id}/${path}`, { method:'POST', body:JSON.stringify({ comment }) });
    const status = action === 'approve' ? 'Approved' : 'Needs Changes';
    writeDrafts(readDrafts().map(d => String(d.id) === String(id) ? { ...d, status, updated:'Just now' } : d));
    return { ok:true, status };
  },
  async getRulebook() { if (!MOCKS) return request('/rulebook'); return [{ id:'R-001', title:'Health claims', description:'Health and wellness claims require approved supporting evidence.' },{ id:'R-002', title:'Absolute language', description:'Avoid guaranteed, always, never and similar absolute claims.' },{ id:'R-003', title:'Sustainability claims', description:'Environmental statements must be specific and substantiated.' }]; },
  async getFacts() { if (!MOCKS) return request('/facts'); return [{ id:'FACT-001', title:'GreenSip product overview', owner:'Brand Team', validUntil:'2027-03-31', status:'Valid' },{ id:'FACT-002', title:'Packaging recyclability statement', owner:'Sustainability Team', validUntil:'2026-12-31', status:'Valid' }]; },
  async getAudit() { if (!MOCKS) return request('/audit'); return [{ id:1, action:'Draft scanned', item:'Summer Wellness Launch Campaign', actor:'Alex Rivera', when:'10m ago' },{ id:2, action:'Approval recorded', item:'Citrus Glow SKU Launch Banner', actor:'Taylor Brooks', when:'2h ago' }]; }
};