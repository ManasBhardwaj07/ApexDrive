import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || ''

let cachedToken = null;
let tokenExpiry = null;
let sessionPromise = null; // SINGLETON LOCK

supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    cachedToken = session.access_token;
    tokenExpiry = session.expires_at ? session.expires_at * 1000 : null;
  } else {
    cachedToken = null;
    tokenExpiry = null;
  }
});

const getValidToken = async () => {
  if (cachedToken && tokenExpiry && Date.now() < (tokenExpiry - 60000)) {
    return cachedToken;
  }
  
  // SINGLETON PROMISE FIX: Prevents multiple components from crashing the SDK on boot
  if (!sessionPromise) {
    sessionPromise = Promise.race([
      supabase.auth.getSession(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000))
    ]).finally(() => { sessionPromise = null });
  }

  try {
    const { data: { session } } = await sessionPromise;
    if (session) {
      cachedToken = session.access_token;
      tokenExpiry = session.expires_at ? session.expires_at * 1000 : null;
      return cachedToken;
    }
  } catch (e) {
    console.warn('[API] Token retrieval timed out.');
  }
  return null;
}

export async function apiFetch(path, options = {}) {
  const token = await getValidToken();

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })

    clearTimeout(timeoutId)
    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      const err = new Error(json.error || `HTTP ${res.status}`)
      err.code  = json.code
      err.status = res.status
      throw err
    }

    return json
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      console.error(`[API] ❌ TIMEOUT on ${path}`)
      throw new Error(`The server is not responding to ${path}. Please try again.`)
    }
    throw error
  }
}

export const api = {
  scores: {
    list:   ()      => apiFetch('/api/scores'),
    create: (b)     => apiFetch('/api/scores', { method: 'POST', body: JSON.stringify(b) }),
    update: (id, b) => apiFetch(`/api/scores/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
    remove: (id)    => apiFetch(`/api/scores/${id}`, { method: 'DELETE' }),
  },
  draws: {
    public:         ()  => apiFetch('/api/draws/public'),
    myEntries:      ()  => apiFetch('/api/draws/my-entries'),
    list:           ()  => apiFetch('/api/draws'),
    create:         (b) => apiFetch('/api/draws/create', { method: 'POST', body: JSON.stringify(b) }),
    simulate:       (id)=> apiFetch(`/api/draws/${id}/simulate`, { method: 'POST' }),
    publish:        (id)=> apiFetch(`/api/draws/${id}/publish`, { method: 'POST' }),
    results:        (id)=> apiFetch(`/api/draws/${id}/results`),
  },
  payments: {
    createCheckout: (b) => apiFetch('/api/payments/create-checkout', { method: 'POST', body: JSON.stringify(b) }),
    cancel:         ()  => apiFetch('/api/payments/cancel-subscription', { method: 'POST' }),
    portal:         ()  => apiFetch('/api/payments/portal', { method: 'POST' }),
    donate:         (b) => apiFetch('/api/payments/create-donation', { method: 'POST', body: JSON.stringify(b) }),
  },
  charities: {
    list:   ()      => apiFetch('/api/charities'),
    get:    (slug)  => apiFetch(`/api/charities/${slug}`),
    create: (b)     => apiFetch('/api/admin/charities', { method: 'POST', body: JSON.stringify(b) }),
    update: (id, b) => apiFetch(`/api/admin/charities/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
    remove: (id)    => apiFetch(`/api/admin/charities/${id}`, { method: 'DELETE' }),
  },
  profiles: {
    me:          ()  => apiFetch('/api/profiles/me'),
    update:      (b) => apiFetch('/api/profiles/me', { method: 'PATCH', body: JSON.stringify(b) }),
    uploadProof: (payoutId, body) => apiFetch(`/api/profiles/upload-proof/${payoutId}`, { method: 'POST', body: JSON.stringify(body) }),
  },
  admin: {
    users:       (params = '') => apiFetch(`/api/admin/users${params}`),
    user:        (id)    => apiFetch(`/api/admin/users/${id}`),
    updateUser:  (id, b) => apiFetch(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(b) }),
    payouts:     (status) => apiFetch(status ? `/api/admin/payouts?status=${status}` : '/api/admin/payouts'),
    reviewPayout:(id, b) => apiFetch(`/api/admin/payouts/${id}/review`, { method: 'PATCH', body: JSON.stringify(b) }),
    markPaid:    (id, b) => apiFetch(`/api/admin/payouts/${id}/mark-paid`, { method: 'PATCH', body: JSON.stringify(b) }),
    analytics:   ()      => apiFetch('/api/admin/analytics'),
  }
}