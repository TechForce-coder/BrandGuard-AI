const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
const API_URL = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)
  ? '/api'
  : 'https://brandguard-ai-3br0.onrender.com/api';

function clearSession() {
  localStorage.removeItem('brandguard-token');
}

async function request(path, options = {}) {
  const token = localStorage.getItem('brandguard-token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const body = response.status === 204
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      body?.message || body?.error || `Request failed (${response.status})`
    );
    error.status = response.status;
    if (response.status === 401 && token && path !== '/auth/login') {
      clearSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('brandguard:session-expired'));
      }
    }
    throw error;
  }

  return body;
}

function normalizeDraft(draft) {
  if (!draft || typeof draft !== 'object') return draft;

  const content = draft.content ?? draft.text ?? '';

  return {
    ...draft,
    id: String(draft.id || draft._id || ''),
    content,
    // Baseline snapshot frozen from initial save
    originalContent: draft.originalContent || content,
    // Revision history list
    revisions: Array.isArray(draft.revisions) ? draft.revisions : [],
    author: typeof draft.author === 'object' && draft.author !== null
      ? draft.author.name || draft.author.email || 'Unknown'
      : draft.author || 'You',
    updated: draft.updated || draft.updatedAt || ''
  };
}

export const api = {
  async register({ name, email, password, confirmPassword, organisationId }) {
    if (typeof organisationId !== 'string' || !organisationId.trim()) {
      throw new Error('Organisation ID is required.');
    }
    clearSession();
    const result = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, confirmPassword, organisationId: organisationId.trim() })
    });
    if (typeof result?.token !== 'string' || !result.token) {
      throw new Error('The server did not create an authenticated session.');
    }
    localStorage.setItem('brandguard-token', result.token);
    try {
      const user = await api.me();
      if (!user || String(user.role || '').toLowerCase() !== 'creator') {
        throw new Error('The server returned an invalid registration profile.');
      }
      return { user };
    } catch (error) {
      clearSession();
      throw error;
    }
  },

  async login(email, password) {
    clearSession();
    const result = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (typeof result?.token !== 'string' || !result.token) {
      throw new Error('The server did not create an authenticated session.');
    }
    localStorage.setItem('brandguard-token', result.token);
    try {
      const user = await api.me();
      if (!user || !['creator', 'reviewer', 'manager', 'admin'].includes(String(user.role || '').toLowerCase())) {
        throw new Error('The server returned an invalid user profile.');
      }
      return { user };
    } catch (error) {
      clearSession();
      throw error;
    }
  },

  async me() {
    const result = await request('/auth/me');
    return result?.user || null;
  },
  
  async getUsers() {
    const result = await request('/auth/users');

    if (!Array.isArray(result?.users)) {
      throw new Error('Users response was not in the expected format');
    }

    return result.users;
  },

  async createOrganisation(name) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Organisation name is required.');
    }

    return request('/organisations', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() })
    });
  },

  async updateUserRole(userId, role) {
    const allowedRoles = ['creator', 'reviewer', 'manager', 'admin'];

    if (!allowedRoles.includes(String(role).toLowerCase())) {
      throw new Error('Invalid role');
    }

    return request(`/auth/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role: String(role).toLowerCase() })
    });
  },

  hasSession() {
    return Boolean(localStorage.getItem('brandguard-token'));
  },

  clearSession,

  async logout() {
    try {
      if (api.hasSession()) {
        await request('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
      }
    } finally {
      clearSession();
    }
  },

  async getDrafts() {
    const result = await request('/drafts');
    const drafts = Array.isArray(result) ? result : result?.drafts;
    if (!Array.isArray(drafts)) {
      throw new Error('Drafts response was not in the expected format');
    }
    return drafts.map(normalizeDraft);
  },

  async getDashboardStats() {
    const result = await request('/drafts/dashboard');
    if (!result?.stats || typeof result.stats !== 'object') {
      throw new Error('Dashboard stats response was not in the expected format');
    }
    return result.stats;
  },

  async getDraftActivity() {
    const result = await request('/drafts/activity');
    return Array.isArray(result?.activity) ? result.activity : [];
  },

  async getDraft(id) {
    const result = await request(`/drafts/${encodeURIComponent(id)}`);
    return normalizeDraft(result?.draft || result);
  },

  async deleteDraft(id) {
    return request(`/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async saveDraft(draft) {
    const payload = {
      title: draft.title,
      content: draft.content ?? draft.text ?? '',
      channel: draft.channel || 'Website',
      hasImage: draft.hasImage === true,
      altText: draft.altText || ''
    };
    const result = draft.id
      ? await request(`/drafts/${encodeURIComponent(draft.id)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      : await request('/drafts', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

    return normalizeDraft(result?.draft || result);
  },

  async scanDraft(id, text) {
    return request(`/drafts/${encodeURIComponent(id)}/scan`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
  },

  async updateFinding(draftId, findingId, status, reason = '') {
    return request(`/findings/${encodeURIComponent(findingId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ draftId, status, reason })
    });
  },

  async submitDraft(id) {
    return request(`/drafts/${encodeURIComponent(id)}/submit`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  async reviewDraft(id, action, comment = '') {
    const reviewActions = {
      approve: { endpoint: 'approve', status: 'Approved' },
      'request-changes': { endpoint: 'request-changes', status: 'Needs Changes' }
    };
    const review = reviewActions[action];
    if (!review) {
      throw new Error('Invalid review action');
    }

    const result = await request(`/drafts/${encodeURIComponent(id)}/${review.endpoint}`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
    if (result?.success !== true || result?.draft?.status !== review.status) {
      throw new Error(result?.message || 'The review response did not confirm the requested status.');
    }
    return result;
  },

  async addDraftComment(id, comment) {
    return request(`/drafts/${encodeURIComponent(id)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
  },

  async getRulebook() {
    return request('/rulebook');
  },

  async createRule(data) {
    return request('/rulebook', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateRule(id, data) {
    return request(`/rulebook/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteRule(id) {
    return request(`/rulebook/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getFacts() {
    return request('/facts');
  },

  async createFact(data) {
    return request('/facts', { method: 'POST', body: JSON.stringify(data) });
  },

  async updateFact(id, data) {
    return request(`/facts/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  async deleteFact(id) {
    return request(`/facts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async getAudit() {
    return request('/audit');
  },

  // Media Drive upload & scan
  async uploadAndScanFile(file) {
    const token = localStorage.getItem('brandguard-token');
    const formData = new FormData();
    formData.append('media', file);

    const response = await fetch(`${API_URL}/upload-and-scan`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => null);
      throw new Error(errBody?.error || `Upload failed (${response.status})`);
    }

    return response.json();
  }
};