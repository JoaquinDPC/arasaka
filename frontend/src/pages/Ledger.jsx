import { useState, useEffect, useMemo, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { formatCLP, formatDate } from '../lib/formatters'
import { CATEGORIES, FLOW_TYPES, CATEGORY_COLORS } from '../lib/constants'
import Spinner from '../components/Spinner'

const FLOW_STYLES = {
  INCOME:  { badge: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20', label: 'Ingreso'   },
  EXPENSE: { badge: 'bg-rose-500/15 text-rose-300 border border-rose-500/20',          label: 'Egreso'    },
  INVEST:  { badge: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20',          label: 'Inversión' },
  OPENING: { badge: 'bg-slate-500/15 text-slate-300 border border-slate-500/20',       label: 'Apertura'  },
}

function FlowBadge({ flow }) {
  const s = FLOW_STYLES[flow] ?? { badge: 'bg-white/10 text-white/50', label: flow }
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${s.badge}`}>{s.label}</span>
}

function CatBadge({ category }) {
  const colors = CATEGORY_COLORS[category]
  if (!colors) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-300 uppercase">{category}</span>
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${colors.bg} ${colors.text}`}>{category}</span>
}

const inputCls  = 'glass-input rounded-xl px-3 py-2 text-sm'
const selectCls = 'glass-input rounded-xl px-3 py-2 text-sm'

function AddModal({ onClose, onSaved }) {
  const now = new Date()
  const [form, setForm] = useState({
    date:        now.toISOString().slice(0, 10),
    description: '',
    category:    CATEGORIES[0],
    flow:        'EXPENSE',
    amount:      '',
    notes:       '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.description || !form.amount) return
    setSaving(true)
    setError(null)
    try {
      await api.createTransaction({
        date:        form.date,
        description: form.description,
        category:    form.category,
        flow:        form.flow,
        amount:      Math.round(Math.abs(Number(form.amount))),
        notes:       form.notes || undefined,
        source:      'manual',
        currency:    'CLP',
      })
      onSaved()
    } catch (err) {
      setError('No se pudo guardar la transacción')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="glass-strong rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-white">Nuevo movimiento</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl leading-none transition-colors">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-white/35 mb-1">Fecha</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls + ' w-full'} required />
            </div>
            <div>
              <label className="block text-[11px] text-white/35 mb-1">Tipo</label>
              <select value={form.flow} onChange={e => set('flow', e.target.value)} className={selectCls + ' w-full'}>
                {FLOW_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-white/35 mb-1">Descripción</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)} className={inputCls + ' w-full'} required placeholder="Descripción…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-white/35 mb-1">Categoría</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className={selectCls + ' w-full'}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-white/35 mb-1">Monto ($)</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} className={inputCls + ' w-full'} required min="1" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-white/35 mb-1">Notas (opcional)</label>
            <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls + ' w-full'} placeholder="Notas…" />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer">
              {saving ? 'Guardando…' : 'Agregar'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl glass text-white/50 hover:text-white text-sm transition-colors cursor-pointer">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Ledger() {
  const now = new Date()
  const [searchParams] = useSearchParams()

  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState(searchParams.get('category') ?? '')
  const [flow, setFlow]         = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [year, setYear]         = useState(now.getFullYear())

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const [editing, setEditing]   = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving]     = useState(false)

  function load() {
    setLoading(true)
    const params = { year }
    if (category) params.category = category
    if (flow)     params.flow     = flow
    api.transactions(params)
      .then(data => setTransactions(Array.isArray(data) ? data : (data?.transactions ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [year, category, flow])

  const filtered = useMemo(() => {
    let list = transactions
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(tx =>
        tx.description?.toLowerCase().includes(q) ||
        tx.category?.toLowerCase().includes(q) ||
        tx.asset?.toLowerCase().includes(q)
      )
    }
    if (dateFrom) list = list.filter(tx => tx.date?.slice(0, 10) >= dateFrom)
    if (dateTo)   list = list.filter(tx => tx.date?.slice(0, 10) <= dateTo)
    return list
  }, [transactions, search, dateFrom, dateTo])

  const totalBalance = filtered.length > 0 ? (filtered[filtered.length - 1].running_balance ?? null) : null

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
      const parsedTags = editForm.tags.split(/\s+/).map(t => t.trim()).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`)
      const payload = { ...editForm, tags: parsedTags }
      await api.updateTransaction(editing.id, payload)
      setTransactions(prev => prev.map(t => t.id === editing.id ? { ...t, ...payload } : t))
      setEditing(null)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  function handleCancel(e) { e.stopPropagation(); setEditing(null) }

  return (
    <div className="p-6">
      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Movimientos</h1>
          <p className="text-white/35 text-sm mt-0.5">
            {filtered.length} registros
            {totalBalance !== null && (
              <> · Saldo: <span className="text-violet-300 font-semibold tabular">{formatCLP(totalBalance)}</span></>
            )}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <input
          type="text"
          placeholder="Buscar desc, key, tag…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={inputCls + ' flex-1 min-w-[160px]'}
        />
        <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
          <option value="">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={flow} onChange={e => setFlow(e.target.value)} className={selectCls}>
          <option value="">Ingresos y Egresos</option>
          {FLOW_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} placeholder="dd/mm/aaaa" />
        <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className={inputCls} placeholder="dd/mm/aaaa" />
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          + Agregar
        </button>
      </div>

      {loading ? <Spinner /> : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">Key</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">Descripción</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">Categoría</th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold text-white/30 uppercase tracking-wider">Monto</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold text-white/30 uppercase tracking-wider">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-white/25 text-sm">Sin transacciones</td></tr>
                )}
                {filtered.map(tx => (
                  <Fragment key={tx.id}>
                    <tr
                      onClick={() => handleEdit(tx)}
                      className={`border-t border-white/5 cursor-pointer transition-colors ${editing?.id === tx.id ? 'bg-white/8' : 'hover:bg-white/4'}`}
                    >
                      <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">{tx.date?.slice(0, 10)}</td>
                      <td className="px-4 py-3 text-xs text-white/30 max-w-[80px]">
                        <span className="truncate block">{tx.asset ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/75 max-w-xs">
                        <div className="truncate">{tx.description}</div>
                        {tx.notes && <div className="text-xs text-white/25 truncate mt-0.5">{tx.notes}</div>}
                      </td>
                      <td className="px-4 py-3"><CatBadge category={tx.category} /></td>
                      <td className="px-4 py-3"><FlowBadge flow={tx.flow} /></td>
                      <td className="px-4 py-3 text-sm font-semibold text-right whitespace-nowrap tabular">
                        <span className={tx.flow === 'INCOME' ? 'text-emerald-400' : tx.flow === 'INVEST' ? 'text-cyan-400' : 'text-rose-400'}>
                          {tx.flow === 'INCOME' ? '+' : '-'}{formatCLP(tx.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right whitespace-nowrap tabular">
                        {tx.running_balance != null ? (
                          <span className={tx.running_balance >= 0 ? 'text-white/45' : 'text-rose-400'}>
                            {formatCLP(tx.running_balance)}
                          </span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                    </tr>

                    {editing?.id === tx.id && (
                      <tr className="border-t border-white/5 bg-white/6">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="flex flex-wrap gap-3 items-end">
                            <div>
                              <label className="block text-[11px] text-white/35 mb-1">Categoría</label>
                              <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className={selectCls}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] text-white/35 mb-1">Subtipo</label>
                              <select value={editForm.subtype} onChange={e => setEditForm(f => ({ ...f, subtype: e.target.value }))} className={selectCls}>
                                <option value="">—</option>
                                <option value="FIJO">FIJO</option>
                                <option value="VARIABLE">VARIABLE</option>
                                <option value="DISCRECIONAL">DISCRECIONAL</option>
                              </select>
                            </div>
                            <div className="flex-1 min-w-[140px]">
                              <label className="block text-[11px] text-white/35 mb-1">Notas</label>
                              <input type="text" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className={inputCls + ' w-full'} />
                            </div>
                            <div className="flex-1 min-w-[140px]">
                              <label className="block text-[11px] text-white/35 mb-1">Hashtags</label>
                              <input type="text" placeholder="#tag1 #tag2" value={editForm.tags} onChange={e => setEditForm(f => ({ ...f, tags: e.target.value }))} className={inputCls + ' w-full'} />
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={handleSave} disabled={saving}
                                className="px-4 py-2 text-sm font-medium bg-violet-600/80 hover:bg-violet-600 text-white rounded-xl disabled:opacity-50 transition-colors cursor-pointer">
                                {saving ? 'Guardando…' : 'Guardar'}
                              </button>
                              <button type="button" onClick={handleCancel}
                                className="px-4 py-2 text-sm font-medium glass text-white/50 hover:text-white rounded-xl transition-colors cursor-pointer">
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
        </div>
      )}
    </div>
  )
}
