import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { formatCLP, formatDate } from '../lib/formatters'
import { FLOW_TYPES, getCatColor, getBankLabel } from '../lib/constants'
import { useTags } from '../lib/useTags'
import Spinner from '../components/Spinner'
import CatIcon from '../components/CatIcon'
import CustomSelect from '../components/CustomSelect'
import DatePicker from '../components/DatePicker'
import { useAccount } from '../context/AccountContext'

// Tags stored as "First-letter-uppercase-rest-lowercase" (e.g. "Sueldo", "Comida-mascota").
// Comparisons are case-insensitive for backwards compat with existing data.

function tagEq(a, b) { return a.toLowerCase() === b.toLowerCase() }
function isSelected(selected, tag) { return selected.some(t => tagEq(t, tag)) }

// Module-level cache for inference results to avoid redundant API calls
const inferCache = new Map()

// TagPicker lets the user select from top-used tags (chips) and type free-form tags.
// usedTags:             string[] top-used tags from transactions (shown as chips)
// recognized:           string[] budget categories (used for autocomplete suggestions)
// selected:             string[] currently chosen tags
// onChange:             (string[]) => void
// inferenceSuggestions: [{tag, source}] from the inference API
const TagPicker = memo(function TagPicker({ selected, onChange, usedTags, recognized, inferenceSuggestions = [] }) {
  const [input, setInput] = useState('')

  const trimmed = input.trim()
  const trimmedLower = trimmed.toLowerCase()

  const pool = useMemo(
    () => [...recognized, ...usedTags.filter(u => !recognized.some(r => tagEq(r, u)))],
    [recognized, usedTags]
  )

  const suggestions = useMemo(
    () => trimmedLower.length > 0
      ? pool.filter(r => r.toLowerCase().includes(trimmedLower) && !isSelected(selected, r))
      : [],
    [pool, trimmedLower, selected]
  )

  const isDuplicate = trimmedLower.length > 0 && isSelected(selected, trimmedLower)

  function toTagFormat(s) {
    if (!s) return s
    const split = s.replace(/([a-z])([A-Z])/g, '$1-$2')
    const words = split.split(/[\s\-_]+/).filter(Boolean)
    if (!words.length) return s
    const joined = words.join('-').toLowerCase()
    return joined.charAt(0).toUpperCase() + joined.slice(1)
  }

  function confirmInput() {
    if (!trimmed) return
    if (isDuplicate) { setInput(''); return }
    onChange([...selected, toTagFormat(trimmed)])
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (suggestions.length === 1 && suggestions[0].toLowerCase().startsWith(trimmedLower)) {
        addTag(suggestions[0])
      } else {
        confirmInput()
      }
    }
    if (e.key === 'Backspace' && input === '' && selected.length > 0) {
      onChange(selected.slice(0, -1))
    }
  }

  function addTag(tag) {
    if (!isSelected(selected, tag)) onChange([...selected, tag])
    setInput('')
  }

  function removeTag(tag) {
    onChange(selected.filter(t => !tagEq(t, tag)))
  }

  // Tags in the chip list (usedTags), plus any selected tags not in usedTags (free tags)
  const chipTags = usedTags
  const extraSelected = selected.filter(s => !usedTags.some(u => tagEq(u, s)))

  const visibleInference = inferenceSuggestions.filter(s => !isSelected(selected, s.tag))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Inference suggestion chips */}
      {visibleInference.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4, fontWeight: 700 }}>SUGERENCIAS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {visibleInference.map(s => {
              const color = getCatColor(s.tag)
              return (
                <div key={s.tag}
                  onClick={() => addTag(s.tag)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                    fontWeight: 700, letterSpacing: '0.04em',
                    background: 'transparent', color,
                    border: `1px dashed ${color}88`,
                  }}>
                  ✦ {s.tag}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Most-used tag chips */}
      {chipTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {chipTags.map(tag => {
            const on = isSelected(selected, tag)
            const color = getCatColor(tag)
            return (
              <div key={tag}
                onClick={() => on ? removeTag(tag) : addTag(tag)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                  fontWeight: 700, letterSpacing: '0.04em', transition: 'all var(--t)',
                  background: on ? color + '28' : 'var(--surface2)',
                  color: on ? color : 'var(--text-muted)',
                  border: `1px solid ${on ? color + '66' : 'var(--border)'}`,
                }}>
                <CatIcon name={tag} size={11} color={on ? color : 'currentColor'} />
                {tag}
              </div>
            )
          })}
        </div>
      )}

      {/* Free-tag input with autocomplete */}
      <div style={{ position: 'relative' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => trimmed && !isDuplicate && confirmInput()}
          placeholder="Tag libre — Enter o coma para agregar"
          className="finput"
          style={{ fontSize: 12, borderColor: isDuplicate ? 'var(--red)' : undefined }}
        />
        {isDuplicate && (
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--red)', pointerEvents: 'none' }}>
            ya agregado
          </span>
        )}
        {suggestions.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
            marginTop: 2, overflow: 'hidden',
          }}>
            {suggestions.map(s => {
              const color = getCatColor(s)
              return (
                <div key={s} onMouseDown={e => { e.preventDefault(); addTag(s) }} style={{
                  padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  color, display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'background var(--t)',
                }}>
                  <CatIcon name={s} size={12} style={{ flexShrink: 0 }} />
                  {s}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Free tags that aren't in the usedTags chip list */}
      {extraSelected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {extraSelected.map(t => {
            const color = getCatColor(t)
            return (
              <span key={t} onClick={() => removeTag(t)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, padding: '3px 7px', borderRadius: 4, cursor: 'pointer',
                background: color + '28', color, border: `1px solid ${color}44`, fontWeight: 700,
              }}>
                <CatIcon name={t} size={10} color={color} />
                {t} ×
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
})

function AddModal({ onClose, onSaved, currentSaldo, accountId, recognizedTags, usedTags }) {
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
  const [inferenceSuggestions, setInferenceSuggestions] = useState([])
  const set = useCallback((k, v) => setF(p => ({ ...p, [k]: v })), [])
  const onChangeTags = useCallback(v => setF(p => ({ ...p, tags: v })), [])

  useEffect(() => {
    const desc = f.description.trim()
    if (!desc) { setInferenceSuggestions([]); return }
    try {
      const user = JSON.parse(localStorage.getItem('arasaka_user'))
      if (user?.settings?.inference_enabled === false) return
    } catch {}
    if (inferCache.has(desc)) {
      setInferenceSuggestions(inferCache.get(desc))
      return
    }
    const t = setTimeout(() => {
      api.inferTags(desc)
        .then(r => {
          const suggs = r.suggestions ?? []
          inferCache.set(desc, suggs)
          setInferenceSuggestions(suggs)
        })
        .catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [f.description])

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
        tags:        f.tags.length ? f.tags : [],
        flow:        f.flow,
        amount:      Math.round(Math.abs(parseFloat(f.amount))),
        notes:       f.notes || undefined,
        key_user:    f.keyUser || undefined,
        source:      'manual',
        currency:    'CLP',
        account_id:  accountId ?? undefined,
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
        <div className="modal-hdr">
          <div className="modal-ttl">Nuevo Movimiento</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
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
            <TagPicker selected={f.tags} onChange={onChangeTags} usedTags={usedTags} recognized={recognizedTags} inferenceSuggestions={inferenceSuggestions} />
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

function EditModal({ tx, onClose, onUpdate, recognizedTags, usedTags }) {
  const [f, setF] = useState({
    date:    tx.date?.slice(0, 10) ?? '',
    keyUser: tx.key_user ?? '',
    tags:    tx.tags ?? [],
    notes:   tx.notes ?? '',
  })
  const set = useCallback((k, v) => setF(p => ({ ...p, [k]: v })), [])
  const onChangeTags = useCallback(v => setF(p => ({ ...p, tags: v })), [])
  const color = getCatColor(tx.category)
  const [inferenceSuggestions, setInferenceSuggestions] = useState([])

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('arasaka_user'))
      if (user?.settings?.inference_enabled === false) return
    } catch {}
    const desc = tx.description
    if (inferCache.has(desc)) {
      setInferenceSuggestions(inferCache.get(desc))
      return
    }
    api.inferTags(desc)
      .then(r => {
        const suggs = r.suggestions ?? []
        inferCache.set(desc, suggs)
        setInferenceSuggestions(suggs)
      })
      .catch(() => {})
  }, [])

  function save() {
    const payload = {
      date:     f.date || undefined,
      tags:     f.tags,
      notes:    f.notes.trim() || null,
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
            <CatIcon name={tx.category} size={22} />
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
            <div className="flbl">Fecha</div>
            <input type="date" className="finput" value={f.date}
              onChange={e => set('date', e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
          </div>
          <div className="ff full">
            <div className="flbl">Subkey <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: 9 }}>tu alias</span></div>
            <input className="finput" placeholder="Tu código / alias" value={f.keyUser}
              onChange={e => set('keyUser', e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 12 }} />
          </div>
          <div className="ff full">
            <div className="flbl">Tags / Categorías</div>
            <TagPicker selected={f.tags} onChange={onChangeTags} usedTags={usedTags} recognized={recognizedTags} inferenceSuggestions={inferenceSuggestions} />
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

function buildPageNumbers(totalPages, safePage) {
  return Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
    .reduce((acc, p, i, arr) => {
      if (i > 0 && p - arr[i - 1] > 1) acc.push('…')
      acc.push(p)
      return acc
    }, [])
}

const Pagination = memo(function Pagination({
  safePage, totalPages, onPageChange,
  filteredCount, pageSize, onPageSizeChange, showPageSizes,
  prefix = '',
}) {
  const pages = useMemo(
    () => buildPageNumbers(totalPages, safePage),
    [totalPages, safePage]
  )
  const rangeStart = filteredCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeEnd   = Math.min(safePage * pageSize, filteredCount)

  return (
    <div className={`pagination-bar${showPageSizes ? ' pagination-top' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {filteredCount === 0 ? '0' : `${rangeStart}–${rangeEnd}`} de {filteredCount}
        </span>
        {showPageSizes && (
          <div className="ps-group">
            {PAGE_SIZES.map(s => (
              <button key={s} className={`ps-btn${pageSize === s ? ' active' : ''}`} onClick={() => onPageSizeChange(s)}>{s}</button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, visibility: totalPages > 1 ? 'visible' : 'hidden' }}>
        <button className="nav-arrow" onClick={() => onPageChange(1)} disabled={safePage === 1}
          style={{ opacity: safePage === 1 ? .3 : 1, fontSize: 12 }}>«</button>
        <button className="nav-arrow" onClick={() => onPageChange(p => Math.max(1, p - 1))} disabled={safePage === 1}
          style={{ opacity: safePage === 1 ? .3 : 1 }}>‹</button>
        {pages.map((p, i) => p === '…' ? (
          <span key={`${prefix}ellipsis-${i}`} style={{ fontSize: 12, color: 'var(--text-dim)', padding: '0 4px' }}>…</span>
        ) : (
          <button key={p} onClick={() => onPageChange(p)}
            style={{ minWidth: 32, height: 32, borderRadius: 6, border: `1px solid ${p === safePage ? 'var(--accent)' : 'var(--border)'}`, background: p === safePage ? 'var(--accent-dim)' : 'transparent', color: p === safePage ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12, fontWeight: p === safePage ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all var(--t)' }}>
            {p}
          </button>
        ))}
        <button className="nav-arrow" onClick={() => onPageChange(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
          style={{ opacity: safePage === totalPages ? .3 : 1 }}>›</button>
        <button className="nav-arrow" onClick={() => onPageChange(totalPages)} disabled={safePage === totalPages}
          style={{ opacity: safePage === totalPages ? .3 : 1, fontSize: 12 }}>»</button>
      </div>
    </div>
  )
})

const TransactionRowDesktop = memo(function TransactionRowDesktop({ tx, selectedId, onEdit }) {
  const tags = tx.tags ?? []
  const isSalary = tx.tags?.includes('sueldo') || tx.category === 'sueldo'
  return (
    <tr onClick={() => onEdit(tx)} style={{ cursor: 'pointer' }} className={isSalary ? 'tr-salary' : undefined}>
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
          {tags.map(t => {
            const color = getCatColor(t)
            return (
              <span key={t} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, padding: '3px 7px',
                background: color + '28', color,
                border: `1px solid ${color}44`,
                borderRadius: 4, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap',
              }}>
                <CatIcon name={t} size={10} color={color} />
                {t}
              </span>
            )
          })}
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
      {selectedId && (
        <td className="td-mono" style={{ textAlign: 'right', color: (tx.running_balance ?? 0) >= 0 ? 'var(--text-muted)' : 'var(--red)', whiteSpace: 'nowrap' }}>
          {tx.running_balance != null ? formatCLP(tx.running_balance) : '—'}
        </td>
      )}
    </tr>
  )
})

const TransactionCardMobile = memo(function TransactionCardMobile({ tx, selectedId, onEdit }) {
  const tags = tx.tags ?? []
  const isIncome = tx.flow === 'INCOME'
  const isSalaryCard = tx.tags?.includes('sueldo') || tx.category === 'sueldo'
  return (
    <div className={`tx-card${isSalaryCard ? ' tx-card-salary' : ''}`} onClick={() => onEdit(tx)}>
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
          {tags.slice(0, 2).map(t => {
            const color = getCatColor(t)
            return (
              <span key={t} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, padding: '2px 6px',
                background: color + '28', color,
                border: `1px solid ${color}44`,
                borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap',
              }}>
                <CatIcon name={t} size={10} color={color} />
                {t}
              </span>
            )
          })}
          {tags.length > 2 && (
            <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>+{tags.length - 2} más</span>
          )}
        </div>
        {selectedId && tx.running_balance != null && (
          <span className="tx-card-saldo" style={{ color: (tx.running_balance ?? 0) >= 0 ? 'var(--text-dim)' : 'var(--red)' }}>
            {formatCLP(tx.running_balance)}
          </span>
        )}
      </div>
    </div>
  )
})

export default function Ledger() {
  const now = new Date()
  const [searchParams] = useSearchParams()
  const { selectedId, selectedAccount, syncVersion } = useAccount()
  const { recognized: recognizedTags, usedTags, personal: personalTags } = useTags()
  // Top 15 chips: most-used first, personal tags fill remaining slots
  const allUsedTags = useMemo(
    () => [...usedTags, ...personalTags.filter(p => !usedTags.some(u => tagEq(u, p)))].slice(0, 15),
    [usedTags, personalTags]
  )

  const [search, setSearch]           = useState('')
  const [selectedTags, setSelectedTags] = useState(() => {
    const c = searchParams.get('category')
    return c ? [c] : []
  })
  const [flow, setFlow]         = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [year, setYear]         = useState(CUR_YEAR)
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [editing, setEditing]     = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const activeFilters =
    [search, flow, dateFrom, dateTo].filter(Boolean).length +
    selectedTags.length +
    (year !== CUR_YEAR ? 1 : 0)

  function clearFilters() {
    setSearch(''); setSelectedTags([]); setFlow('')
    setDateFrom(''); setDateTo(''); setYear(CUR_YEAR)
  }

  function load() {
    if (!selectedId) {
      setTransactions([])
      setLoading(false)
      return
    }
    setLoading(true)
    const params = { year, account_id: selectedId }
    if (selectedTags.length) params.tags = selectedTags.join(',')
    if (flow) params.flow = flow
    api.transactions(params)
      .then(data => setTransactions(Array.isArray(data) ? data : (data?.transactions ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [year, selectedTags, flow, selectedId, syncVersion])

  // Reset to page 1 whenever filters or page size change
  useEffect(() => { setPage(1) }, [search, selectedTags, flow, dateFrom, dateTo, year, pageSize])

  // Pre-compute lowercase search fields once when transactions load, not on every keystroke
  const searchIndex = useMemo(
    () => new Map(transactions.map(tx => [tx.id, {
      desc:  tx.description?.toLowerCase() ?? '',
      key:   tx.key_user?.toLowerCase()    ?? '',
      notes: tx.notes?.toLowerCase()       ?? '',
      cat:   tx.category?.toLowerCase()    ?? '',
      tags:  tx.tags?.map(t => t.toLowerCase()) ?? [],
    }])),
    [transactions]
  )

  const filtered = useMemo(() => {
    let list = transactions
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(tx => {
        const idx = searchIndex.get(tx.id)
        return idx && (
          idx.desc.includes(q)  ||
          idx.key.includes(q)   ||
          idx.notes.includes(q) ||
          idx.cat.includes(q)   ||
          idx.tags.some(t => t.includes(q))
        )
      })
    }
    if (dateFrom) list = list.filter(tx => tx.date?.slice(0, 10) >= dateFrom)
    if (dateTo)   list = list.filter(tx => tx.date?.slice(0, 10) <= dateTo)
    return list
  }, [transactions, searchIndex, search, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  // running_balance is only meaningful when scoped to a single account
  const curSaldo = selectedId && filtered.length > 0 ? (filtered[0].running_balance ?? null) : null

  const handleUpdate = useCallback((updated) => {
    setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t))
  }, [])

  const handleEdit = useCallback((tx) => setEditing(tx), [])

  return (
    <div className="fade">
      <div className="ph ph-row">
        <div>
          <div className="ph-title">
            Movimientos
            {selectedAccount && (
              <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>
                · {getBankLabel(selectedAccount.bank_id)} / {selectedAccount.name}
              </span>
            )}
          </div>
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
            <input className="fi fi-search" placeholder="Buscar desc, key, Tag…" value={search}
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
              {recognizedTags.map(tag => {
                const on = selectedTags.some(t => t.toLowerCase() === tag.toLowerCase())
                const color = getCatColor(tag)
                return (
                  <div key={tag} onClick={() => setSelectedTags(
                    on
                      ? selectedTags.filter(t => !tagEq(t, tag))
                      : [...selectedTags, tag]
                  )} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                    fontWeight: 700, letterSpacing: '0.04em', transition: 'all var(--t)',
                    background: on ? color + '28' : 'var(--surface2)',
                    color: on ? color : 'var(--text-muted)',
                    border: `1px solid ${on ? color + '66' : 'var(--border)'}`,
                  }}>
                    <CatIcon name={tag} size={11} color={on ? color : 'currentColor'} />
                    {tag}
                  </div>
                )
              })}
            </div>
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
            <Pagination
              safePage={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              filteredCount={filtered.length}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              showPageSizes
              prefix="top-"
            />

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
                    {selectedId && <th style={{ textAlign: 'right' }}>Saldo</th>}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(tx => (
                    <TransactionRowDesktop key={tx.id} tx={tx} selectedId={selectedId} onEdit={handleEdit} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="tx-list">
              {pageRows.map(tx => (
                <TransactionCardMobile key={tx.id} tx={tx} selectedId={selectedId} onEdit={handleEdit} />
              ))}
            </div>

            <Pagination
              safePage={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              filteredCount={filtered.length}
              pageSize={pageSize}
              prefix="bot-"
            />
          </>
        )
      )}

      {showAdd && (
        <AddModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load() }}
          currentSaldo={curSaldo ?? 0}
          accountId={selectedId}
          recognizedTags={recognizedTags}
          usedTags={allUsedTags}
        />
      )}
      {editing && (
        <EditModal
          tx={editing}
          onClose={() => setEditing(null)}
          onUpdate={upd => { handleUpdate(upd); setEditing(null) }}
          recognizedTags={recognizedTags}
          usedTags={allUsedTags}
        />
      )}

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 200,
            width: 42, height: 42, borderRadius: '50%',
            background: 'var(--accent)', color: '#000',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700,
            boxShadow: '0 4px 16px rgba(0,0,0,.35)',
            transition: 'opacity var(--t), transform var(--t)',
          }}
          aria-label="Volver arriba"
        >↑</button>
      )}
    </div>
  )
}
