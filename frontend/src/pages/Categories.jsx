import { useState, useEffect, useRef } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../api/client'
import { formatCLP, formatDate } from '../lib/formatters'
import { getCatColor, MONTHS, MONTH_ABBR } from '../lib/constants'
import { useTags, clearTagsCache } from '../lib/useTags'
import Spinner from '../components/Spinner'
import CatIcon from '../components/CatIcon'
import { useAccount } from '../context/AccountContext'
import { ICON_BY_NAME } from '../lib/icons'

const INCOME_TAGS = ['sueldo', 'devolucion']

function normalizeTag(raw) {
  const stripped = raw.replace(/^#+/, '').trim()
  const words = stripped.split(/[\s_-]+/).filter(Boolean)
  if (!words.length) return ''
  return words[0].toLowerCase() + words.slice(1).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('')
}

function parseBudgets(rawBudgets, recognizedTags) {
  const base = {}
  for (const b of rawBudgets) {
    if (b.month === 0) base[b.category] = b.amount
  }
  const result = {}
  for (const cat of recognizedTags) result[cat] = base[cat] ?? 0
  for (const b of rawBudgets) {
    if (b.month === 0 && !recognizedTags.includes(b.category)) result[b.category] = b.amount
  }
  return result
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{ background: '#111114', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ fontWeight: 600, color: 'var(--text)' }}>{d.name}</p>
      <p style={{ color: d.payload.fill }}>{formatCLP(d.value)}</p>
    </div>
  )
}

const ICON_NAMES = Object.keys(ICON_BY_NAME)

function IconPickerModal({ tag, currentIcon, onSelect, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.6)' }}>
      <div ref={ref} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, width: 360, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Icono — {tag}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <button
          onClick={() => onSelect(null)}
          style={{ width: '100%', marginBottom: 10, padding: '6px 10px', background: !currentIcon ? 'var(--accent)22' : 'var(--surface2)', border: `1px solid ${!currentIcon ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}
        >
          Auto (por nombre)
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
          {ICON_NAMES.map(name => {
            const Icon = ICON_BY_NAME[name]
            const active = currentIcon === name
            return (
              <button
                key={name}
                title={name}
                onClick={() => onSelect(name)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', background: active ? 'var(--accent)22' : 'var(--surface2)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer' }}
              >
                <Icon size={16} color={active ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth={1.5} />
                <span style={{ fontSize: 8, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TagsPanel({ usedTags, initialPersonal, initialPersonalEntries }) {
  const [personal, setPersonal] = useState(initialPersonal)
  const [entries, setEntries]   = useState(initialPersonalEntries)
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [saving, setSaving] = useState(false)
  const [pickerTag, setPickerTag] = useState(null)

  useEffect(() => { setPersonal(initialPersonal) }, [initialPersonal.join(',')])
  useEffect(() => { setEntries(initialPersonalEntries) }, [initialPersonalEntries.map(e => e.tag + (e.icon ?? '')).join(',')])

  const top15 = usedTags.slice(0, 15)

  function iconForTag(tag) {
    return entries.find(e => e.tag === tag)?.icon ?? null
  }

  function updateSuggestions(val) {
    if (!val.trim()) { setSuggestions([]); return }
    const norm = normalizeTag(val)
    const pool = [...new Set([...personal, ...usedTags])]
    const lc = (norm || val).toLowerCase()
    const filtered = pool.filter(t => t.toLowerCase().includes(lc)).slice(0, 8)
    const result = [...filtered]
    if (norm && !pool.some(t => t.toLowerCase() === norm.toLowerCase())) {
      result.push('__new__:' + norm)
    }
    setSuggestions(result)
  }

  async function addTag(raw) {
    const tag = normalizeTag(raw)
    if (!tag) return
    if (personal.includes(tag)) { setInput(''); setSuggestions([]); return }
    setSaving(true)
    try {
      await api.savePersonalTag(tag)
      setPersonal(prev => [...prev, tag].sort())
      setEntries(prev => [...prev, { tag, icon: null }].sort((a, b) => a.tag.localeCompare(b.tag)))
      clearTagsCache()
    } catch { /* silent */ }
    finally { setSaving(false) }
    setInput('')
    setSuggestions([])
  }

  async function handleSetIcon(tag, iconName) {
    try {
      await api.setTagIcon(tag, iconName ?? '')
      setEntries(prev => prev.map(e => e.tag === tag ? { ...e, icon: iconName } : e))
      clearTagsCache()
    } catch { /* silent */ }
    setPickerTag(null)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); addTag(input) }
    if (e.key === 'Escape') { setSuggestions([]) }
  }

  const pickerEntry = pickerTag ? entries.find(e => e.tag === pickerTag) : null

  return (
    <div className="card">
      {pickerTag && (
        <IconPickerModal
          tag={pickerTag}
          currentIcon={pickerEntry?.icon ?? null}
          onSelect={icon => handleSetIcon(pickerTag, icon)}
          onClose={() => setPickerTag(null)}
        />
      )}

      <div className="card-title">Tags Personales</div>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input
          className="finput"
          placeholder="Ej. #MiTag o #Ropa Cara"
          value={input}
          onChange={e => { setInput(e.target.value); updateSuggestions(e.target.value) }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setSuggestions([]), 150)}
          style={{ width: '100%', boxSizing: 'border-box' }}
          disabled={saving}
        />
        {suggestions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, marginTop: 2, overflow: 'hidden' }}>
            {suggestions.map(s => {
              const isNew = s.startsWith('__new__:')
              const label = isNew ? s.slice(8) : s
              return (
                <div
                  key={s}
                  onMouseDown={() => addTag(label)}
                  style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', color: isNew ? 'var(--accent)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {isNew && <span style={{ fontSize: 10, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 3, padding: '1px 4px' }}>nuevo</span>}
                  {label}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {top15.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.06em' }}>MÁS USADOS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {top15.map(t => {
              const inPersonal = personal.includes(t)
              return (
                <button
                  key={t}
                  onClick={() => addTag(t)}
                  disabled={inPersonal || saving}
                  style={{
                    background: inPersonal ? 'var(--border)' : 'var(--surface2)',
                    border: `1px solid ${inPersonal ? 'var(--border)' : 'var(--accent)33'}`,
                    borderRadius: 4, padding: '3px 8px', fontSize: 11,
                    color: inPersonal ? 'var(--text-dim)' : 'var(--text-muted)',
                    cursor: inPersonal ? 'default' : 'pointer',
                  }}
                >
                  {t}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {personal.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '0.06em' }}>MIS TAGS ({personal.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {personal.map(t => (
              <span
                key={t}
                style={{ background: 'var(--accent)1a', border: '1px solid var(--accent)44', borderRadius: 4, padding: '3px 6px', fontSize: 11, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <button
                  onClick={() => setPickerTag(t)}
                  title="Cambiar icono"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'inherit' }}
                >
                  <CatIcon name={t} overrideIcon={iconForTag(t)} size={11} />
                </button>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TagBudgetsPanel({ tagSpendingData }) {
  const year = new Date().getFullYear()
  const [budgets, setBudgets]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [tagInput, setTagInput]     = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    setLoading(true)
    api.tagBudgets(year)
      .then(data => setBudgets(Array.isArray(data) ? data : []))
      .catch(() => setBudgets([]))
      .finally(() => setLoading(false))
  }, [year])

  const spendMap = Object.fromEntries((tagSpendingData ?? []).map(d => [d.tag.toLowerCase(), d.total]))

  async function handleAdd(e) {
    e.preventDefault()
    const tag = normalizeTag(tagInput)
    const amount = Math.max(0, Number(amountInput) || 0)
    if (!tag) return
    setSaving(true)
    try {
      await api.upsertTagBudget({ tag, year, month: 0, amount })
      setBudgets(prev => {
        const existing = prev.findIndex(b => b.tag.toLowerCase() === tag.toLowerCase() && b.month === 0)
        if (existing >= 0) {
          const next = [...prev]; next[existing] = { ...next[existing], amount }; return next
        }
        return [...prev, { tag, year, month: 0, amount }]
      })
      setTagInput('')
      setAmountInput('')
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const basebudgets = budgets.filter(b => b.month === 0)

  return (
    <div className="card">
      <div className="card-title">Presupuesto por Tag</div>
      {loading ? <Spinner /> : (
        <>
          {basebudgets.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {basebudgets.map(b => {
                const spent = spendMap[b.tag.toLowerCase()] ?? 0
                const pct   = b.amount > 0 ? Math.min(100, +(spent / b.amount * 100).toFixed(1)) : 0
                const color = getCatColor(b.tag)
                const over  = spent > b.amount && b.amount > 0
                return (
                  <div key={b.tag}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <CatIcon name={b.tag} size={12} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flex: 1, letterSpacing: '0.04em' }}>{b.tag}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: over ? 'var(--red)' : color }}>
                        {formatCLP(spent)} / {formatCLP(b.amount)}
                      </span>
                    </div>
                    <div style={{ height: 3, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: over ? 'var(--red)' : color, borderRadius: 2 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              className="finput"
              placeholder="Tag"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              style={{ flex: 1, fontSize: 11, boxSizing: 'border-box' }}
            />
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <input
                type="number"
                className="finput"
                placeholder="0"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                style={{ fontFamily: 'var(--mono)', fontSize: 11, paddingRight: 30, width: 90, boxSizing: 'border-box' }}
              />
              <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'var(--text-dim)', pointerEvents: 'none' }}>CLP</span>
            </div>
            <button type="submit" className="btn-gold" disabled={saving} style={{ fontSize: 11, padding: '5px 10px', flexShrink: 0 }}>+</button>
          </form>
        </>
      )}
    </div>
  )
}

function BudgetsPanel({ recognizedTags, tagsLoaded }) {
  const year = new Date().getFullYear()
  const budgetCats = recognizedTags.filter(c => !INCOME_TAGS.includes(c))

  const [limits, setLimits]         = useState({})
  const [customCats, setCustomCats] = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)

  useEffect(() => {
    if (!tagsLoaded) return
    setLoading(true)
    api.budgets(year)
      .then(data => {
        const arr = Array.isArray(data) ? data : []
        setLimits(parseBudgets(arr, recognizedTags))
        const custom = arr
          .filter(b => b.month === 0 && !recognizedTags.includes(b.category))
          .map((b, i) => ({ id: Date.now() + i, name: b.category }))
        setCustomCats(custom)
      })
      .catch(() => { const d = {}; for (const c of recognizedTags) d[c] = 0; setLimits(d) })
      .finally(() => setLoading(false))
  }, [year, tagsLoaded, recognizedTags.join(',')])

  function setLimit(cat, value) {
    setLimits(prev => ({ ...prev, [cat]: Math.max(0, Number(value) || 0) }))
  }

  function addCustomCat() {
    setCustomCats(prev => [...prev, { id: Date.now(), name: '' }])
  }

  function renameCustomCat(id, newName) {
    const oldName = customCats.find(c => c.id === id)?.name
    setCustomCats(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c))
    if (oldName !== undefined && oldName !== newName) {
      setLimits(prev => {
        const n = { ...prev, [newName]: prev[oldName] ?? 0 }
        if (oldName) delete n[oldName]
        return n
      })
    }
  }

  function removeCustomCat(id, name) {
    setCustomCats(prev => prev.filter(c => c.id !== id))
    setLimits(prev => { const n = { ...prev }; delete n[name]; return n })
  }

  const allCats = [...budgetCats, ...customCats.map(c => c.name).filter(Boolean)]
  const total   = allCats.reduce((s, c) => s + (limits[c] ?? 0), 0)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const budgets = [
        ...recognizedTags.map(cat => ({ category: cat, amount: limits[cat] ?? 0 })),
        ...customCats.filter(c => c.name).map(c => ({ category: c.name, amount: limits[c.name] ?? 0 })),
      ]
      await api.upsertBudgetsBase({ year, budgets })
      clearTagsCache()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  return (
    <div className="card">
      <div className="card-title">Presupuestos base</div>
      {loading ? <Spinner /> : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {budgetCats.map(cat => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CatIcon name={cat} size={13} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flex: 1, letterSpacing: '0.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</div>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <input type="number" className="finput" placeholder="0"
                    value={limits[cat] || ''}
                    onChange={e => setLimit(cat, e.target.value)}
                    style={{ fontFamily: 'var(--mono)', fontSize: 12, paddingRight: 30, width: 100, boxSizing: 'border-box' }} />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'var(--text-dim)', pointerEvents: 'none' }}>CLP</span>
                </div>
              </div>
            ))}
            {customCats.map(({ id, name }) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CatIcon name={name || 'custom'} size={13} style={{ flexShrink: 0 }} />
                <input type="text" className="finput" placeholder="Categoría"
                  value={name}
                  onChange={e => renameCustomCat(id, e.target.value)}
                  style={{ fontSize: 11, flex: 1, width: 0, boxSizing: 'border-box', letterSpacing: '0.04em' }} />
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <input type="number" className="finput" placeholder="0"
                    value={(name && limits[name]) || ''}
                    onChange={e => name && setLimit(name, e.target.value)}
                    style={{ fontFamily: 'var(--mono)', fontSize: 12, paddingRight: 30, width: 100, boxSizing: 'border-box' }} />
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: 'var(--text-dim)', pointerEvents: 'none' }}>CLP</span>
                </div>
                <button onClick={() => removeCustomCat(id, name)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>

          <button onClick={addCustomCat} style={{ marginTop: 8, background: 'none', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11, padding: '4px 12px' }}>
            + Agregar categoría
          </button>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Total: <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600 }}>{formatCLP(total)}</span>
            </div>
            <button className="btn-gold" onClick={handleSave} disabled={saving} style={{ fontSize: 12, padding: '6px 14px' }}>
              {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const PAGE_SIZE = 25

export default function Categories() {
  const now = new Date()
  const { selectedId } = useAccount()
  const { recognized, usedTags, personal, personalEntries, loaded: tagsLoaded } = useTags()
  const [period, setPeriod] = useState('month')
  const [year, setYear]     = useState(now.getFullYear())
  const [month, setMonth]   = useState(now.getMonth() + 1)
  const [data, setData]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [selTag, setSelTag]         = useState(null)
  const [tagMovs, setTagMovs]       = useState([])
  const [tagLoading, setTagLoading] = useState(false)
  const [page, setPage]             = useState(0)

  useEffect(() => {
    setLoading(true)
    setPage(0)
    setSelTag(null)
    const params = { year }
    if (period === 'month') params.month = month
    if (selectedId) params.account_id = selectedId
    api.tagSpending(params)
      .then(res => setData(Array.isArray(res) ? res.filter(d => d.total > 0) : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [period, month, year, selectedId])

  useEffect(() => {
    if (!selTag) { setTagMovs([]); return }
    setTagLoading(true)
    const params = { tags: selTag.toLowerCase(), year }
    if (period === 'month') params.month = month
    if (selectedId) params.account_id = selectedId
    api.transactions(params)
      .then(d => setTagMovs(Array.isArray(d) ? d : (d?.transactions ?? [])))
      .catch(() => setTagMovs([]))
      .finally(() => setTagLoading(false))
  }, [selTag, period, month, year, selectedId])

  function prevPeriod() {
    if (period === 'month') { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
    else setYear(y => y - 1)
  }
  function nextPeriod() {
    if (period === 'month') { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }
    else setYear(y => y + 1)
  }

  const total      = data.reduce((s, d) => s + d.total, 0)
  const totalPages = Math.ceil(data.length / PAGE_SIZE)
  const pageData   = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const pieData    = data.slice(0, 10).map(d => ({ name: d.tag, value: d.total, fill: getCatColor(d.tag) }))
  const periodLabel = period === 'month' ? `${MONTHS[month - 1]} ${year}` : `${year}`

  return (
    <div className="fade">
      <div className="ph" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="ph-title">Tags</div>
          <div className="ph-sub">{periodLabel} · {formatCLP(total)} total · {data.length} tags</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="toggle" style={{ width: 'auto' }}>
            {[['month','Mes'],['year','Año']].map(([p, l]) => (
              <button key={p} className={`tbtn${period === p ? ' ti' : ''}`} onClick={() => setPeriod(p)} style={{ padding: '7px 16px' }}>{l}</button>
            ))}
          </div>
          <button className="nav-arrow" onClick={prevPeriod}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 100, textAlign: 'center' }}>
            {period === 'month' ? `${MONTH_ABBR[month - 1]} ${year}` : year}
          </span>
          <button className="nav-arrow" onClick={nextPeriod}>›</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        {/* LEFT: tag spending */}
        <div style={{ flex: '1 1 500px', minWidth: 0 }}>
          {loading ? <Spinner /> : data.length === 0 ? (
            <div className="empty-msg" style={{ marginTop: 80 }}>Sin egresos en este período</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14, marginBottom: 14 }}>
                <div className="card">
                  <div className="card-title">Tags — haz clic para ver detalle</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pageData.map(tag => {
                      const p = total > 0 ? +(tag.total / total * 100).toFixed(1) : 0
                      const active = selTag === tag.tag
                      const color = getCatColor(tag.tag)
                      return (
                        <div key={tag.tag}
                          onClick={() => setSelTag(active ? null : tag.tag)}
                          style={{ padding: '10px 12px', background: active ? color + '1a' : 'var(--surface2)', border: `1px solid ${active ? color + '55' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', transition: 'all .15s' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <CatIcon name={tag.tag} size={14} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: active ? color : 'var(--text)', letterSpacing: '0.04em' }}>{tag.tag}</span>
                              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tag.transactions}×</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p}%</span>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: color, fontWeight: 500 }}>{formatCLP(tag.total)}</span>
                            </div>
                          </div>
                          <div style={{ height: 3, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${p}%`, background: color, borderRadius: 2, opacity: .75 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                      <button className="tbtn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '4px 10px', opacity: page === 0 ? .4 : 1 }}>‹</button>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button key={i} className={`tbtn${page === i ? ' ti' : ''}`} onClick={() => setPage(i)} style={{ padding: '4px 10px', minWidth: 32 }}>{i + 1}</button>
                      ))}
                      <button className="tbtn" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ padding: '4px 10px', opacity: page === totalPages - 1 ? .4 : 1 }}>›</button>
                    </div>
                  )}
                </div>

                <div className="card">
                  <div className="card-title">Distribución (top 10)</div>
                  <ResponsiveContainer width="100%" height={Math.max(240, Math.min(pieData.length * 26 + 80, 320))}>
                    <PieChart>
                      <Pie data={pieData} cx="45%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={pieData.length > 1 ? 2 : 0}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend layout="vertical" align="right" verticalAlign="middle"
                        wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 8 }} iconSize={9} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {selTag && (
                <div className="card fade" key={selTag}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <CatIcon name={selTag} size={18} />
                    <div className="card-title" style={{ marginBottom: 0, color: getCatColor(selTag) }}>{selTag}</div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
                      {tagMovs.filter(m => m.flow !== 'INCOME').length} movimientos · {formatCLP(data.find(d => d.tag === selTag)?.total ?? 0)}
                    </span>
                    <button onClick={() => setSelTag(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
                  </div>
                  {tagLoading ? <Spinner /> : (
                    <div className="tbl-wrap" style={{ border: 'none', background: 'transparent' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Key</th>
                            <th>Descripción</th>
                            <th style={{ textAlign: 'right' }}>Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...tagMovs].filter(m => m.flow !== 'INCOME').sort((a, b) => b.date.localeCompare(a.date)).map(m => (
                            <tr key={m.id}>
                              <td className="td-date">{formatDate(m.date)}</td>
                              <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{m.asset ?? '—'}</td>
                              <td>{m.description}</td>
                              <td className="td-mono" style={{ textAlign: 'right', color: 'var(--red)', whiteSpace: 'nowrap' }}>-{formatCLP(m.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT: budgets + tags */}
        <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <BudgetsPanel recognizedTags={recognized} tagsLoaded={tagsLoaded} />
          <TagBudgetsPanel tagSpendingData={data} />
          <TagsPanel usedTags={usedTags} initialPersonal={personal} initialPersonalEntries={personalEntries} />
        </div>
      </div>
    </div>
  )
}
