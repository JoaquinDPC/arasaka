import { useState, useEffect, useMemo, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { formatCLP, formatDate } from '../lib/formatters'
import { CATEGORIES, FLOW_TYPES } from '../lib/constants'
import Spinner from '../components/Spinner'

const NATIONAL_ID = 'credit_card_nacional_facturados'

function CCBadge({ statementId, ccMap }) {
  const info = ccMap[statementId]
  if (!info) return null
  const isIntl = info.accountId !== NATIONAL_ID
  return (
    <Link
      to={`/credit-card?period=${info.period}`}
      onClick={e => e.stopPropagation()}
      className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
        isIntl
          ? 'bg-purple-500/15 text-purple-300 hover:bg-purple-500/25'
          : 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25'
      }`}
    >
      {isIntl ? 'TC Intl' : 'TC Nac'}
    </Link>
  )
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2026, i, 1).toLocaleDateString('es-CL', { month: 'long' }),
}))

const YEARS = [2024, 2025, 2026]

const FLOW_STYLES = {
  INCOME:  { badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25', label: 'Ingreso'   },
  EXPENSE: { badge: 'bg-rose-500/15    text-rose-300    border border-rose-500/25',    label: 'Gasto'     },
  INVEST:  { badge: 'bg-cyan-500/15    text-cyan-300    border border-cyan-500/25',    label: 'Inversión' },
  OPENING: { badge: 'bg-slate-500/15   text-slate-300   border border-slate-500/25',   label: 'Apertura'  },
}

function FlowBadge({ flow }) {
  const s = FLOW_STYLES[flow] ?? { badge: 'bg-white/10 text-white/60', label: flow }
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
      {s.label}
    </span>
  )
}

function amountColor(flow) {
  if (flow === 'INCOME')  return 'text-emerald-400'
  if (flow === 'EXPENSE') return 'text-rose-400'
  if (flow === 'INVEST')  return 'text-cyan-400'
  return 'text-white/50'
}

function amountPrefix(flow) {
  if (flow === 'INCOME')  return '+'
  if (flow === 'EXPENSE') return '-'
  return ''
}

const selectClass = 'glass-input rounded-xl px-3 py-2 text-sm'
const inputClass  = 'glass-input rounded-xl px-3 py-2 text-sm w-full'

export default function Ledger() {
  const now = new Date()
  const [month, setMonth]     = useState('')
  const [year, setYear]       = useState(now.getFullYear())
  const [category, setCategory] = useState('')
  const [flow, setFlow]       = useState('')
  const [search, setSearch]   = useState('')

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const [editing, setEditing]   = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving]     = useState(false)

  // Map of cc_statement_id → { period: "YYYY-MM", accountId } for badge links
  const [ccMap, setCcMap] = useState({})
  useEffect(() => {
    api.ccStatements()
      .then(stmts => {
        const m = {}
        for (const s of (stmts ?? [])) {
          m[s.id] = { period: s.period_to.slice(0, 7), accountId: s.account_id }
        }
        setCcMap(m)
      })
      .catch(() => {/* non-critical */})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)
    const params = { year }
    if (month)    params.month    = month
    if (category) params.category = category
    if (flow)     params.flow     = flow
    api.transactions(params)
      .then(data => setTransactions(Array.isArray(data) ? data : (data?.transactions ?? [])))
      .catch(() => setError('No se pudo conectar al servidor'))
      .finally(() => setLoading(false))
  }, [month, year, category, flow])

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions
    const q = search.toLowerCase()
    return transactions.filter(tx =>
      tx.description?.toLowerCase().includes(q) ||
      tx.category?.toLowerCase().includes(q) ||
      tx.asset?.toLowerCase().includes(q)
    )
  }, [transactions, search])

  const totalIncome     = filtered.filter(t => t.flow === 'INCOME').reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalExpense    = filtered.filter(t => t.flow === 'EXPENSE').reduce((s, t) => s + (t.amount ?? 0), 0)
  const totalInvestment = filtered.filter(t => t.flow === 'INVEST').reduce((s, t) => s + (t.amount ?? 0), 0)

  function handleEdit(tx) {
    if (editing?.id === tx.id) { setEditing(null); return }
    setEditing(tx)
    setEditForm({
      category: tx.category,
      subtype:  tx.subtype ?? '',
      notes:    tx.notes ?? '',
      tags:     (tx.tags ?? []).join(' '),
    })
  }

  async function handleSave(e) {
    e.stopPropagation()
    setSaving(true)
    try {
      const parsedTags = editForm.tags
        .split(/\s+/)
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => t.startsWith('#') ? t : `#${t}`)
      const payload = { ...editForm, tags: parsedTags }
      await api.updateTransaction(editing.id, payload)
      setTransactions(prev => prev.map(t => t.id === editing.id ? { ...t, ...payload } : t))
      setEditing(null)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  function handleCancel(e) {
    e.stopPropagation()
    setEditing(null)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <h2 className="text-xl font-bold text-white mb-6">Movimientos</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
        <select value={month} onChange={e => setMonth(e.target.value)} className={selectClass}>
          <option value="">Todos los meses</option>
          {MONTHS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectClass}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select value={category} onChange={e => setCategory(e.target.value)} className={selectClass}>
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={flow} onChange={e => setFlow(e.target.value)} className={selectClass}>
          <option value="">Todos los tipos</option>
          {FLOW_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        <input
          type="text"
          placeholder="Buscar…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`${inputClass} flex-1 min-w-[140px]`}
        />
      </div>

      {loading && <Spinner />}
      {error && <div className="text-center py-16 text-white/50">{error}</div>}

      {!loading && !error && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide">Descripción</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide hidden sm:table-cell">Categoría</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wide hidden sm:table-cell">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase tracking-wide">Monto</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase tracking-wide hidden md:table-cell">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-white/30 text-sm">
                      No hay transacciones
                    </td>
                  </tr>
                )}

                {filtered.map(tx => (
                  <Fragment key={tx.id}>
                    <tr
                      onClick={() => handleEdit(tx)}
                      className={`border-t border-white/5 cursor-pointer transition-colors ${
                        editing?.id === tx.id ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-white/45 whitespace-nowrap">
                        {formatDate(tx.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/80 max-w-xs">
                        <div className="truncate">{tx.description}</div>
                        {tx.asset && (
                          <div className="text-xs text-cyan-400/70 font-medium mt-0.5">
                            {tx.asset}{tx.quantity != null ? ` · ${tx.quantity}` : ''}
                          </div>
                        )}
                        {tx.notes && (
                          <div className="text-xs text-white/30 truncate mt-0.5">{tx.notes}</div>
                        )}
                        {(tx.tags?.length > 0 || tx.cc_statement_id) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tx.tags?.map(tag => (
                              <span key={tag} className="text-xs text-violet-300/70 bg-violet-500/10 px-1.5 py-0.5 rounded-md font-medium">
                                {tag}
                              </span>
                            ))}
                            {tx.cc_statement_id && (
                              <CCBadge statementId={tx.cc_statement_id} ccMap={ccMap} />
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-white/55 hidden sm:table-cell">{tx.category}</td>
                      <td className="px-4 py-3 hidden sm:table-cell"><FlowBadge flow={tx.flow} /></td>
                      <td className="px-4 py-3 text-sm font-semibold text-right whitespace-nowrap">
                        <span className={amountColor(tx.flow)}>
                          {amountPrefix(tx.flow)}{formatCLP(tx.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right whitespace-nowrap hidden md:table-cell">
                        {tx.running_balance != null ? (
                          <span className={tx.running_balance >= 0 ? 'text-white/50' : 'text-rose-400'}>
                            {formatCLP(tx.running_balance)}
                          </span>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                    </tr>

                    {editing?.id === tx.id && (
                      <tr className="border-t border-white/5 bg-white/8">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="flex flex-wrap gap-3 items-end">
                            <div>
                              <label className="block text-xs text-white/40 mb-1">Categoría</label>
                              <select
                                value={editForm.category}
                                onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                                className={selectClass}
                              >
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-white/40 mb-1">Subtipo</label>
                              <select
                                value={editForm.subtype}
                                onChange={e => setEditForm(f => ({ ...f, subtype: e.target.value }))}
                                className={selectClass}
                              >
                                <option value="">—</option>
                                <option value="FIJO">FIJO</option>
                                <option value="VARIABLE">VARIABLE</option>
                                <option value="DISCRECIONAL">DISCRECIONAL</option>
                              </select>
                            </div>
                            <div className="flex-1 min-w-[160px]">
                              <label className="block text-xs text-white/40 mb-1">Notas</label>
                              <input
                                type="text"
                                value={editForm.notes}
                                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                className={inputClass}
                              />
                            </div>
                            <div className="flex-1 min-w-[160px]">
                              <label className="block text-xs text-white/40 mb-1">Hashtags</label>
                              <input
                                type="text"
                                placeholder="#tag1 #tag2"
                                value={editForm.tags}
                                onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))}
                                className={inputClass}
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 text-sm font-medium bg-violet-600/70 hover:bg-violet-600 text-white rounded-xl disabled:opacity-50 transition-colors border border-violet-500/30 cursor-pointer"
                              >
                                {saving ? 'Guardando…' : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                onClick={handleCancel}
                                className="px-4 py-2 text-sm font-medium glass text-white/60 hover:text-white rounded-xl transition-colors cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-white/5 border-t border-white/10 flex flex-wrap gap-4 sm:gap-6 text-sm">
            <span className="text-white/40">
              Ingresos: <span className="font-semibold text-emerald-400">{formatCLP(totalIncome)}</span>
            </span>
            <span className="text-white/40">
              Gastos: <span className="font-semibold text-rose-400">{formatCLP(totalExpense)}</span>
            </span>
            {totalInvestment > 0 && (
              <span className="text-white/40">
                Inversiones: <span className="font-semibold text-cyan-400">{formatCLP(totalInvestment)}</span>
              </span>
            )}
            <span className="text-white/25 ml-auto">{filtered.length} transacciones</span>
          </div>
        </div>
      )}
    </div>
  )
}
