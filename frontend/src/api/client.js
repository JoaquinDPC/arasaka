const BASE = '/api'

async function get(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json()
}

async function put(path, body) {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`)
  return res.json()
}

async function del(path) {
  const res = await fetch(BASE + path, { method: 'DELETE' })
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
  // Reports
  monthly:        (month, year) => get(`/reports/monthly?month=${month}&year=${year}`),
  kpis:           (year)        => get(`/reports/kpis?year=${year}`),
  trend:          (year)        => get(`/reports/trend?year=${year}`),
  annual:         (year)        => get(`/reports/annual?year=${year}`),
  budgetVsActual: (month, year) => get(`/reports/budget-vs-actual?month=${month}&year=${year}`),
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

  // Budgets
  budgets:           (year) => get(`/budgets?year=${year}`),
  upsertBudget:      (body) => put('/budgets', body),
  upsertBudgetsBase: (body) => put('/budgets/base', body),

  // Sync
  sync: () => post('/sync', {}),

  // Credit card
  ccStatements:   ()         => get('/credit-card/statements'),
  ccStatement:    (id)       => get(`/credit-card/statements/${id}`),
  ccImportPDF:    (formData) => fetch('/api/credit-card/import-pdf', { method: 'POST', body: formData }).then(r => { if (!r.ok) return r.json().then(e => { throw new Error(e.error || r.status) }); return r.json() }),
  ccLinkPayments: ()         => post('/credit-card/link-payments', {}),
}
