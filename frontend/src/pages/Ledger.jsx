import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { formatCLP, formatDate } from '../lib/formatters'
import { CATEGORIES, FLOW_TYPES, CAT_COLORS } from '../lib/constants'
import Spinner from '../components/Spinner'
import CustomSelect from '../components/CustomSelect'
import DatePicker from '../components/DatePicker'

function TagPicker({ selected, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {CATEGORIES.map(cat => {
        const on = selected.includes(cat)
        const color = CAT_COLORS[cat] || '#888'
        return (
          <div key={cat} onClick={() => onChange(on ? selected.filter(c => c !== cat) : [...selected, cat])}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontWeight: 700, letterSpacing: '0.04em',
              background: on ? color + '28' : 'var(--surface2)', color: on ? color : 'var(--text-muted)',
              border: `1px solid ${on ? color + '66' : 'var(--border)'}`, transition: 'all var(--t)' }}>
            {cat}
          </div>
        )
      })}
    </div>
  )
}

function AddModal({ onClose, onSaved, currentSaldo }) {
  const now = new Date()
  const [f, setF] = useState({
    date: now.toISOString().slice(0, 10),
    keyUser: '',
    description: '',
    tags: [],
    flow: 'EXPENSE',
    amount: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const m = parseFloat(f.amount) || 0
  const proj = f.flow === 'INCOME' ? currentSaldo + m : currentSaldo - m

  async function submit() {
    if (!f.description.trim() || !f.amount) return
    setSaving(true)
    setError(null)
    try {
      await api.createTransaction({
        date:        f.date,
        description: f.description.trim(),
        category:    f.tags[0] ?? 'Otros',
        tags:        f.tags.length ? f.tags : ['Otros'],
        flow:        f.flow,
        amount:      Math.round(Math.abs(parseFloat(f.amount))),
        notes:       f.notes || undefined,
        key_user:    f.keyUser || undefined,
        source:      'manual',
        currency:    'CLP',
      })
      onSaved()
    } catch {
      setError('No se pudo guardar la transacción')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-ttl">Nuevo Movimiento</div>
        <div className="fgrid">
          <div className="ff">
            <div className="flbl">Fecha</div>
            <input type="date" className="finput" value={f.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="ff">
            <div className="flbl">Tipo</div>
            <div className="toggle">
              <button className={`tbtn${f.flow === 'INCOME' ? ' ti' : ''}`} onClick={() => set('flow', 'INCOME')}>Ingreso</button>
              <button className={`tbtn${f.flow === 'EXPENSE' ? ' te' : ''}`} onClick={() => set('flow', 'EXPENSE')}>Egreso</button>
            </div>
          </div>
          <div className="ff full">
            <div className="flbl">Key (descripción banco)</div>
            <input className="finput" placeholder="Ej: Supermercado, Sueldo…" value={f.description}
              onChange={e => set('description', e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div className="ff full">
            <div className="flbl">Subkey <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: 9 }}>tu alias</span></div>
            <input className="finput" placeholder="Tu código / alias" value={f.keyUser}
              onChange={e => set('keyUser', e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
          </div>
          <div className="ff">
            <div className="flbl">Monto CLP</div>
            <input type="number" className="finput" placeholder="0" value={f.amount}
              onChange={e => set('amount', e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          </div>
          <div className="saldo-preview">
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4, fontWeight: 600 }}>Saldo resultante</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 500, color: proj >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCLP(proj)}</div>
          </div>
          <div className="ff full">
            <div className="flbl">Tags / Categorías</div>
            <TagPicker selected={f.tags} onChange={v => set('tags', v)} />
          </div>
          <div className="ff full">
            <div className="flbl">Descripción (opcional)</div>
            <textarea className="finput" rows={2} placeholder="Observaciones…" value={f.notes}
              onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', fontFamily: 'var(--font)' }} />
          </div>
        </div>
        {error && <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 12 }}>{error}</p>}
        <div className="mfooter">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-gold" onClick={submit} disabled={saving}>{saving ? 'Guardando…' : 'Agregar'}</button>
        </div>
      </div>
    </div>
  )
}

function EditModal({ tx, onClose, onUpdate }) {
  const [f, setF] = useState({
    keyUser:  tx.key_user ?? '',
    tags:     (tx.tags?.length ? tx.tags : (tx.category ? [tx.category] : [])).filter(t => CATEGORIES.includes(t)),
    notes:    tx.notes ?? '',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const color = CAT_COLORS[tx.category] || '#888'

  function save() {
    const payload = {
      category: f.tags[0] ?? 'Otros',
      tags: f.tags.length ? f.tags : ['Otros'],
      notes: f.notes.trim() || null,
      key_user: f.keyUser.trim() || null,
    }
    onUpdate({ ...tx, ...payload })
    onClose()
    api.updateTransaction(tx.id, payload).catch(() => {})
  }

  return (
    <div className="overlay fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Immutable header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ width: 44, height: 44, borderRadius: 8, background: color + '22', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(tx.date)}</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: tx.flow === 'INCOME' ? 'var(--green)' : 'var(--red)' }}>
              {tx.flow === 'INCOME' ? '+' : '-'}{formatCLP(tx.amount)}
            </div>
          </div>
        </div>

        <div className="fgrid">
          <div className="ff full">
            <div className="flbl">Subkey <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: 9 }}>tu alias</span></div>
            <input className="finput" placeholder="Tu código / alias" value={f.keyUser}
              onChange={e => set('keyUser', e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
          </div>
          <div className="ff full">
            <div className="flbl">Tags / Categorías</div>
            <TagPicker selected={f.tags} onChange={v => set('tags', v)} />
          </div>
          <div className="ff full">
            <div className="flbl">Descripción</div>
            <textarea className="finput" rows={3} placeholder="Observaciones, contexto…" value={f.notes}
              onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', fontFamily: 'var(--font)' }} />
          </div>
        </div>
        <div className="mfooter">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-gold" onClick={save}>Guardar cambios</button>
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZES = [25, 50, 100]
const CUR_YEAR   = new Date().getFullYear()
const YEARS      = Array.from({ length: 5 }, (_, i) => CUR_YEAR - i)

export default function Ledger() {
  const now = new Date()
  const [searchParams] = useSearchParams()

  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState(searchParams.get('category') ?? '')
  const [flow, setFlow]         = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [year, setYear]         = useState(CUR_YEAR)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(100)

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [editing, setEditing]     = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeFilters =
    [search, category, flow, dateFrom, dateTo].filter(Boolean).length +
    (year !== CUR_YEAR ? 1 : 0)

  function clearFilters() {
    setSearch(''); setCategory(''); setFlow('')
    setDateFrom(''); setDateTo(''); setYear(CUR_YEAR)
  }

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

  // Reset to page 1 whenever filters or page size change
  useEffect(() => { setPage(1) }, [search, category, flow, dateFrom, dateTo, year, pageSize])

  const filtered = useMemo(() => {
    let list = transactions
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(tx =>
        tx.description?.toLowerCase().includes(q) ||
        tx.key_user?.toLowerCase().includes(q) ||
        tx.notes?.toLowerCase().includes(q) ||
        tx.category?.toLowerCase().includes(q) ||
        tx.tags?.some(t => t.toLowerCase().includes(q))
      )
    }
    if (dateFrom) list = list.filter(tx => tx.date?.slice(0, 10) >= dateFrom)
    if (dateTo)   list = list.filter(tx => tx.date?.slice(0, 10) <= dateTo)
    return list
  }, [transactions, search, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const curSaldo = filtered.length > 0 ? (filtered[0].running_balance ?? null) : null

  function handleUpdate(updated) {
    setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  return (
    <div className="fade">
      <div className="ph ph-row">
        <div>
          <div className="ph-title">Movimientos</div>
          <div className="ph-sub">
            {filtered.length} registros
            {curSaldo !== null && <> · Saldo: <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{formatCLP(curSaldo)}</span></>}
          </div>
        </div>
        <button className="btn-gold" onClick={() => setShowAdd(true)}>+ Agregar</button>
      </div>

      <div className="filters-wrap">
        <div className="filter-bar">
          <div className="fi-search-wrap">
            <input className="fi fi-search" placeholder="Buscar desc, key, tag…" value={search}
              onChange={e => setSearch(e.target.value)} />
            {search && (
              <button className="fi-search-clear" onClick={() => setSearch('')} aria-label="Clear search">✕</button>
            )}
          </div>
          <button className={`btn-filter-toggle${filtersOpen ? ' active' : ''}`} onClick={() => setFiltersOpen(o => !o)}>
            Filtros
            {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
          </button>
        </div>
        {filtersOpen && (
          <div className="extra-filters">
            <CustomSelect
              className="fi-sel"
              value={category}
              onChange={setCategory}
              placeholder="Todos los tags"
              options={[{ value: '', label: 'Todos los tags' }, ...CATEGORIES.map(c => ({ value: c, label: c }))]}
            />
            <CustomSelect
              className="fi-sel"
              value={flow}
              onChange={setFlow}
              placeholder="Tipo"
              options={[{ value: '', label: 'Tipo' }, ...FLOW_TYPES.map(f => ({ value: f.value, label: f.label }))]}
            />
            <CustomSelect
              className="fi-year"
              value={year}
              onChange={v => setYear(Number(v))}
              options={YEARS.map(y => ({ value: y, label: String(y) }))}
            />
            <DatePicker className="fi-date" value={dateFrom} onChange={setDateFrom} placeholder="Desde" />
            <DatePicker className="fi-date" value={dateTo}   onChange={setDateTo}   placeholder="Hasta" />
            {activeFilters > 0 && (
              <button className="fi-clear" onClick={clearFilters}>✕ Limpiar</button>
            )}
          </div>
        )}
      </div>

      {loading ? <Spinner /> : (
        transactions.length === 0 ? (
          <div className="tbl-wrap">
            <div className="empty">
              <h3>Sin movimientos aún</h3>
              <p>Agrega tu primer movimiento.</p>
              <button className="btn-gold" onClick={() => setShowAdd(true)}>+ Agregar</button>
            </div>
          </div>
        ) : (
          <>
            {/* Pagination rendered above table/list */}
            <div className="pagination-bar pagination-top">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {filtered.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)}`} de {filtered.length}
                </span>
                <div className="ps-group">
                  {PAGE_SIZES.map(s => (
                    <button key={s} className={`ps-btn${pageSize === s ? ' active' : ''}`} onClick={() => setPageSize(s)}>{s}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, visibility: totalPages > 1 ? 'visible' : 'hidden' }}>
                <button className="nav-arrow" onClick={() => setPage(1)} disabled={safePage === 1}
                  style={{ opacity: safePage === 1 ? .3 : 1, fontSize: 12 }}>«</button>
                <button className="nav-arrow" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  style={{ opacity: safePage === 1 ? .3 : 1 }}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('…')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) => p === '…' ? (
                    <span key={`ellipsis-top-${i}`} style={{ fontSize: 12, color: 'var(--text-dim)', padding: '0 4px' }}>…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ minWidth: 32, height: 32, borderRadius: 6, border: `1px solid ${p === safePage ? 'var(--accent)' : 'var(--border)'}`, background: p === safePage ? 'var(--accent-dim)' : 'transparent', color: p === safePage ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12, fontWeight: p === safePage ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all var(--t)' }}>
                      {p}
                    </button>
                  ))
                }
                <button className="nav-arrow" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  style={{ opacity: safePage === totalPages ? .3 : 1 }}>›</button>
                <button className="nav-arrow" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
                  style={{ opacity: safePage === totalPages ? .3 : 1, fontSize: 12 }}>»</button>
              </div>
            </div>

            {/* Desktop table */}
            <div className="tbl-wrap tbl-desktop">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="col-key">Key</th>
                    <th style={{ minWidth: 200 }}>Descripción</th>
                    <th className="col-tags">Tags</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th style={{ textAlign: 'right' }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(tx => {
                    const tags = (tx.tags?.length ? tx.tags : (tx.category ? [tx.category] : [])).filter(t => CATEGORIES.includes(t) && t !== 'Otros')
                    const isSalary = tx.tags?.includes('Sueldo') || tx.category === 'Sueldo'
                    return (
                      <tr key={tx.id} onClick={() => setEditing(tx)} style={{ cursor: 'pointer' }} className={isSalary ? 'tr-salary' : undefined}>
                        <td className="td-date">{formatDate(tx.date)}</td>
                        <td className="col-key" style={{ maxWidth: 130 }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description}>{tx.description}</div>
                          {tx.key_user && (
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.key_user}>{tx.key_user}</div>
                          )}
                        </td>
                        <td style={{ minWidth: 200, maxWidth: 320 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500, color: 'var(--text-dim)' }}>
                            {tx.notes ?? '—'}
                          </div>
                        </td>
                        <td className="col-tags" style={{ minWidth: 120 }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {tags.map(t => (
                              <span key={t} style={{
                                fontSize: 10, padding: '3px 7px',
                                background: (CAT_COLORS[t] || '#888') + '28',
                                color: CAT_COLORS[t] || '#888',
                                border: `1px solid ${(CAT_COLORS[t] || '#888')}44`,
                                borderRadius: 4, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap',
                              }}>{t}</span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                            background: tx.flow === 'INCOME' ? 'rgba(76,175,125,.15)' : 'rgba(224,92,92,.15)',
                            color: tx.flow === 'INCOME' ? 'var(--green)' : 'var(--red)',
                          }}>
                            {tx.flow === 'INCOME' ? 'INGRESO' : tx.flow === 'INVEST' ? 'INVERSIÓN' : 'EGRESO'}
                          </span>
                        </td>
                        <td className="td-mono" style={{ textAlign: 'right', color: isSalary ? 'var(--accent)' : tx.flow === 'INCOME' ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap', fontWeight: 700 }}>
                          {isSalary ? '✦ ' : (tx.flow === 'INCOME' ? '+' : '-')}{formatCLP(tx.amount)}
                        </td>
                        <td className="td-mono" style={{ textAlign: 'right', color: (tx.running_balance ?? 0) >= 0 ? 'var(--text-muted)' : 'var(--red)', whiteSpace: 'nowrap' }}>
                          {tx.running_balance != null ? formatCLP(tx.running_balance) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="tx-list">
              {pageRows.map(tx => {
                const tags = (tx.tags?.length ? tx.tags : (tx.category ? [tx.category] : [])).filter(t => t !== 'Otros')
                const isIncome = tx.flow === 'INCOME'
                const isSalaryCard = tx.tags?.includes('Sueldo') || tx.category === 'Sueldo'
                return (
                  <div key={tx.id} className={`tx-card${isSalaryCard ? ' tx-card-salary' : ''}`} onClick={() => setEditing(tx)}>
                    <div className="tx-card-top">
                      <span className="tx-card-date">{formatDate(tx.date)}</span>
                      <span className="tx-card-amt" style={{ color: isSalaryCard ? 'var(--accent)' : isIncome ? 'var(--green)' : 'var(--red)' }}>
                        {isSalaryCard ? '✦ ' : (isIncome ? '+' : '-')}{formatCLP(tx.amount)}
                      </span>
                    </div>
                    <div className="tx-card-desc" style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                      {tx.description}
                      {tx.key_user && <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>{tx.key_user}</span>}
                    </div>
                    {tx.notes && (
                      <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {tx.notes}
                      </div>
                    )}
                    <div className="tx-card-foot">
                      <div className="tx-card-tags">
                        {tags.slice(0, 2).map(t => (
                          <span key={t} style={{
                            fontSize: 10, padding: '2px 6px',
                            background: (CAT_COLORS[t] || '#888') + '28',
                            color: CAT_COLORS[t] || '#888',
                            border: `1px solid ${(CAT_COLORS[t] || '#888')}44`,
                            borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap',
                          }}>{t}</span>
                        ))}
                        {tags.length > 2 && (
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>+{tags.length - 2} más</span>
                        )}
                      </div>
                      {tx.running_balance != null && (
                        <span className="tx-card-saldo" style={{ color: (tx.running_balance ?? 0) >= 0 ? 'var(--text-dim)' : 'var(--red)' }}>
                          {formatCLP(tx.running_balance)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination bar */}
            <div className="pagination-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {filtered.length === 0 ? '0' : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)}`} de {filtered.length}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, visibility: totalPages > 1 ? 'visible' : 'hidden' }}>
                <button className="nav-arrow" onClick={() => setPage(1)} disabled={safePage === 1}
                  style={{ opacity: safePage === 1 ? .3 : 1, fontSize: 12 }}>«</button>
                <button className="nav-arrow" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  style={{ opacity: safePage === 1 ? .3 : 1 }}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('…')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) => p === '…' ? (
                    <span key={`ellipsis-${i}`} style={{ fontSize: 12, color: 'var(--text-dim)', padding: '0 4px' }}>…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ minWidth: 32, height: 32, borderRadius: 6, border: `1px solid ${p === safePage ? 'var(--accent)' : 'var(--border)'}`, background: p === safePage ? 'var(--accent-dim)' : 'transparent', color: p === safePage ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12, fontWeight: p === safePage ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all var(--t)' }}>
                      {p}
                    </button>
                  ))
                }
                <button className="nav-arrow" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  style={{ opacity: safePage === totalPages ? .3 : 1 }}>›</button>
                <button className="nav-arrow" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
                  style={{ opacity: safePage === totalPages ? .3 : 1, fontSize: 12 }}>»</button>
              </div>
            </div>
          </>
        )
      )}

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
          currentSaldo={curSaldo ?? 0}
        />
      )}
      {editing && (
        <EditModal
          tx={editing}
          onClose={() => setEditing(null)}
          onUpdate={upd => { handleUpdate(upd); setEditing(null) }}
        />
      )}
    </div>
  )
}
