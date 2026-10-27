const API_URL = '/api';

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

  return {
    ...draft,
    id: String(draft.id || draft._id || ''),
    author: typeof draft.author === 'object' && draft.author !== null
      ? draft.author.name || draft.author.email || 'Unknown'
      : draft.author || 'You',
    updated: draft.updated || draft.updatedAt || ''
  };
}

export const api = {
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

  async getDraftActivity() {
    const result = await request('/drafts/activity');
    return Array.isArray(result?.activity) ? result.activity : [];
  },

  async getDraft(id) {
    const result = await request(`/drafts/${encodeURIComponent(id)}`);
    return normalizeDraft(result?.draft || result);
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

    return result?.draft || result;
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
  }
};
