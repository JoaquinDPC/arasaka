const BASE = '/api'

function getToken() {
  return localStorage.getItem('arasaka_token')
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handleUnauthorized() {
  window.dispatchEvent(new Event('arasaka:unauthorized'))
}

async function get(path) {
  const res = await fetch(BASE + path, { headers: authHeaders() })
  if (res.status === 401) { handleUnauthorized(); throw new Error('unauthorized') }
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (res.status === 401) { handleUnauthorized(); throw new Error('unauthorized') }
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json()
}

async function put(path, body) {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })
  if (res.status === 401) { handleUnauthorized(); throw new Error('unauthorized') }
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`)
  return res.json()
}

async function del(path) {
  const res = await fetch(BASE + path, { method: 'DELETE', headers: authHeaders() })
  if (res.status === 401) { handleUnauthorized(); throw new Error('unauthorized') }
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status}`)
}

function qs(params) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, v)
  }
  const s = q.toString()
  return s ? '?' + s : ''
}

export const api = {
  // Auth
  login: (email, password) => fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(async r => {
    if (!r.ok) throw new Error('invalid credentials')
    return r.json() // { token, user }
  }),

  // Reports (all accept optional accountID to scope to a single account)
  monthly:        (month, year, accountID) => get(`/reports/monthly?month=${month}&year=${year}${accountID ? `&account_id=${accountID}` : ''}`),
  kpis:           (year, accountID)        => get(`/reports/kpis?year=${year}${accountID ? `&account_id=${accountID}` : ''}`),
  trend:          (year, accountID)        => get(`/reports/trend?year=${year}${accountID ? `&account_id=${accountID}` : ''}`),
  annual:         (year, accountID)        => get(`/reports/annual?year=${year}${accountID ? `&account_id=${accountID}` : ''}`),
  budgetVsActual: (month, year, accountID) => get(`/reports/budget-vs-actual?month=${month}&year=${year}${accountID ? `&account_id=${accountID}` : ''}`),
  categorySummary:(params = {}) => get(`/categories/summary${qs(params)}`),

  // Insights
  insights: (month, year) => get(`/insights?month=${month}&year=${year}`),

  // Transactions
  transactions:      (params = {}) => get(`/transactions${qs(params)}`),
  createTransaction: (body)        => post('/transactions', body),
  updateTransaction: (id, body)    => put(`/transactions/${id}`, body),
  deleteTransaction: (id)          => del(`/transactions/${id}`),

  // Accounts
  accounts:      ()          => get('/accounts'),
  createAccount: (body)      => post('/accounts', body),
  updateAccount: (id, body)  => put(`/accounts/${id}`, body),
  deleteAccount: (id)        => del(`/accounts/${id}`),

  // Tags (recognized categories sourced from the budgets table)
  tags:              ()            => get('/tags'),
  usedTags:          (limit = 20) => get(`/tags/used?limit=${limit}`),
  personalTags:      ()            => get('/tags/personal'),
  savePersonalTag:   (tag)         => post('/tags/personal', { tag }),
  tagSpending:       (params = {}) => get(`/tags/spending${qs(params)}`),
  setTagIcon:        (tag, icon)   => put(`/tags/personal/${encodeURIComponent(tag)}/icon`, { icon }),

  // Tag budgets
  tagBudgets:      (year)  => get(`/tag-budgets?year=${year}`),
  upsertTagBudget: (body)  => put('/tag-budgets', body),

  // Budgets
  budgets:           (year) => get(`/budgets?year=${year}`),
  upsertBudget:      (body) => put('/budgets', body),
  upsertBudgetsBase: (body) => put('/budgets/base', body),

  // Sync — bankId is optional; omit to sync all configured banks
  sync:            (bankId) => post('/sync', bankId ? { bank_id: bankId } : {}),

  // PDF import — files is an array or FileList; all files are sent in one multipart request
  importAccountPDF: (accountId, files) => {
    const fd = new FormData()
    fd.append('account_id', String(accountId))
    for (const f of files) fd.append('files', f, f.name)
    return fetch('/api/import/pdf', { method: 'POST', body: fd, headers: authHeaders() })
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || String(r.status)); return r.json() })
  },

  // Credit card
  ccStatements:   ()         => get('/credit-card/statements'),
  ccStatement:    (id)       => get(`/credit-card/statements/${id}`),
  ccImportPDF:    (formData) => fetch('/api/credit-card/import-pdf', { method: 'POST', body: formData, headers: authHeaders() }).then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error || r.status) }); return r.json() }),
  ccLinkPayments: ()         => post('/credit-card/link-payments', {}),
}
