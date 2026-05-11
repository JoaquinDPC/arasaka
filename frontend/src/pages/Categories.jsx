import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api/client'
import { formatCLP } from '../lib/formatters'
import { getCatColor, MONTH_ABBR } from '../lib/constants'
import { useTags, clearTagsCache } from '../lib/useTags'
import Spinner from '../components/Spinner'
import CatIcon from '../components/CatIcon'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAccount } from '../context/AccountContext'
import { ICON_BY_NAME } from '../lib/icons'

const ICON_NAMES = Object.keys(ICON_BY_NAME)
const NOW = new Date()

// ── Helpers ─────────────────────────────────────────────────────────────────

function readSalary() {
  try {
    const u = JSON.parse(localStorage.getItem('arasaka_user'))
    return u?.settings?.monthly_salary ?? 0
  } catch { return 0 }
}

function writeSalaryLocal(val) {
  try {
    const u = JSON.parse(localStorage.getItem('arasaka_user'))
    if (u) localStorage.setItem('arasaka_user', JSON.stringify({
      ...u, settings: { ...(u.settings ?? {}), monthly_salary: val },
    }))
  } catch {}
}

function readSettings() {
  try {
    const u = JSON.parse(localStorage.getItem('arasaka_user'))
    return u?.settings ?? {}
  } catch { return {} }
}

// All maps are keyed by lowercase tag. Use this to look up.
function lk(tag) { return (tag ?? '').toLowerCase() }

// ── IconPickerModal ──────────────────────────────────────────────────────────

function IconPickerModal({ tag, currentIcon, onSelect, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.65)' }}>
      <div ref={ref} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, width: 360, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Ícono — {tag}</div>
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

// ── MiniBarChart ─────────────────────────────────────────────────────────────

function MiniBarChart({ values, budget, color, currentMonth }) {
  const W = 180, H = 36, pad = 2
  const barW = (W - pad * 11) / 12
  const max = Math.max(...values, budget, 1)
  const budgetY = H - (budget / max) * H

  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
      {values.map((v, i) => {
        const bh = Math.max(2, (v / max) * H)
        const x = i * (barW + pad)
        return (
          <rect
            key={i}
            x={x}
            y={H - bh}
            width={barW}
            height={bh}
            rx={1}
            fill={i === (currentMonth - 1) ? color : color + '55'}
          />
        )
      })}
      {budget > 0 && (
        <line x1={0} y1={budgetY} x2={W} y2={budgetY}
          stroke={color} strokeWidth={1} strokeDasharray="3 2" opacity={0.7} />
      )}
    </svg>
  )
}

// ── SalaryDistBar ─────────────────────────────────────────────────────────────
// budgets / spending are keyed by lowercase tag

function SalaryDistBar({ tags, budgets, spending, salary, onEditSalary }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  const totalBudgeted = tags.reduce((s, t) => s + (budgets[lk(t)] ?? 0), 0)
  const totalSpent    = tags.reduce((s, t) => s + (spending[lk(t)] ?? 0), 0)

  // When no salary, segments are proportional to totalBudgeted (relative distribution)
  const base = salary > 0 ? salary : totalBudgeted
  const pctBudgeted = salary > 0 ? Math.min(100, totalBudgeted / salary * 100) : 100
  const pctSpent    = salary > 0 ? Math.min(100, totalSpent    / salary * 100)
                    : totalBudgeted > 0 ? Math.min(100, totalSpent / totalBudgeted * 100) : 0
  const pctFree     = salary > 0 ? Math.max(0, 100 - pctBudgeted) : null

  function startEdit() { setInput(salary > 0 ? String(salary) : ''); setEditing(true) }
  function commitEdit() {
    const val = Math.max(0, Number(input.replace(/\D/g, '')) || 0)
    onEditSalary(val)
    setEditing(false)
  }

  let runningPct = 0
  const segments = tags
    .filter(t => (budgets[lk(t)] ?? 0) > 0 && base > 0)
    .map(t => {
      const pct = Math.min((budgets[lk(t)] / base) * 100, 100 - runningPct)
      const seg = { tag: t, pct, offset: runningPct, color: getCatColor(t) }
      runningPct += pct
      return seg
    })

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>DISTRIBUCIÓN DEL SUELDO</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Sueldo mensual:</span>
          {editing ? (
            <input
              autoFocus
              className="finput"
              value={input}
              onChange={e => setInput(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
              style={{ fontFamily: 'var(--mono)', fontSize: 12, width: 110, boxSizing: 'border-box' }}
            />
          ) : (
            <button
              onClick={startEdit}
              style={{ background: 'none', border: 'none', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', padding: '2px 4px' }}
            >
              {salary > 0 ? formatCLP(salary) : '+ Definir sueldo'}
            </button>
          )}
        </div>
      </div>

      {/* Barra apilada */}
      <div style={{ height: 12, background: 'rgba(255,255,255,.05)', borderRadius: 6, overflow: 'hidden', position: 'relative', marginBottom: 10 }}>
        {segments.map(s => (
          <div
            key={s.tag}
            title={`${s.tag}: ${s.pct.toFixed(1)}%`}
            style={{
              position: 'absolute',
              left: `${s.offset}%`,
              width: `${s.pct}%`,
              height: '100%',
              background: s.color,
              transition: 'width .3s',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>PRESUPUESTADO</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            {salary > 0 ? `${pctBudgeted.toFixed(1)}%` : formatCLP(totalBudgeted)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>GASTADO</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: totalSpent > totalBudgeted && totalBudgeted > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
            {salary > 0 ? `${pctSpent.toFixed(1)}%` : formatCLP(totalSpent)}
          </div>
        </div>
        {pctFree !== null && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>SIN ASIGNAR</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{pctFree.toFixed(1)}%</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TagCard ──────────────────────────────────────────────────────────────────

function TagCard({
  tag, icon, budget, spent, salary, view, monthlyValues, currentMonth,
  onEditBudget, onEditIcon, onDelete, onSelect, selected,
}) {
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const color = getCatColor(tag)

  const pct   = budget > 0 ? Math.min(100, spent / budget * 100) : 0
  const pctSalary = salary > 0 && budget > 0 ? (budget / salary * 100).toFixed(1) : null
  const over  = spent > budget && budget > 0

  function startEditBudget(e) {
    e.stopPropagation()
    setBudgetInput(budget > 0 ? String(budget) : '')
    setEditingBudget(true)
  }
  function commitBudget() {
    const val = Math.max(0, Number(budgetInput.replace(/\D/g, '')) || 0)
    onEditBudget(tag, val)
    setEditingBudget(false)
  }

  return (
    <div
      onClick={() => onSelect(tag)}
      style={{
        background: selected ? color + '18' : 'var(--surface2)',
        border: `1px solid ${selected ? color + '66' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all .15s',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button
          onClick={e => { e.stopPropagation(); onEditIcon(tag) }}
          title="Cambiar ícono"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
        >
          <CatIcon name={tag} overrideIcon={icon ?? null} size={18} />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: selected ? color : 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag}</span>
        {pctSalary && (
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', flexShrink: 0 }}>{pctSalary}% sueldo</span>
        )}
        <button
          onClick={e => { e.stopPropagation(); onDelete(tag) }}
          title="Eliminar"
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px', flexShrink: 0, opacity: 0.4 }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.4}
        >
          ×
        </button>
      </div>

      {view === 'year' && monthlyValues && (
        <div style={{ marginBottom: 10 }}>
          <MiniBarChart values={monthlyValues} budget={budget} color={color} currentMonth={currentMonth} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {[0, 3, 6, 9, 11].map(i => (
              <span key={i} style={{ fontSize: 8, color: 'var(--text-dim)' }}>{MONTH_ABBR[i]}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: over ? 'var(--red)' : color, fontWeight: 600 }}>{formatCLP(spent)}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>/ </span>
          {editingBudget ? (
            <input
              autoFocus
              className="finput"
              value={budgetInput}
              onChange={e => setBudgetInput(e.target.value)}
              onBlur={commitBudget}
              onKeyDown={e => { if (e.key === 'Enter') commitBudget(); if (e.key === 'Escape') setEditingBudget(false) }}
              onClick={e => e.stopPropagation()}
              style={{ fontFamily: 'var(--mono)', fontSize: 12, width: 90, boxSizing: 'border-box', padding: '2px 6px', borderRadius: 4 }}
            />
          ) : (
            <button
              onClick={startEditBudget}
              style={{
                background: budget > 0 ? 'none' : 'rgba(255,255,255,.04)',
                border: budget > 0 ? 'none' : '1px dashed var(--border)',
                borderRadius: 4,
                fontFamily: 'var(--mono)',
                fontSize: budget > 0 ? 12 : 11,
                color: budget > 0 ? 'var(--text-muted)' : 'var(--text-dim)',
                cursor: 'pointer',
                padding: budget > 0 ? '1px 3px' : '3px 7px',
                transition: 'border-color .15s',
              }}
            >
              {budget > 0 ? formatCLP(budget) : '+ presupuesto'}
            </button>
          )}
        </div>
      </div>

      <div style={{ height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: over ? 'var(--red)' : color, borderRadius: 2, transition: 'width .3s' }} />
      </div>
    </div>
  )
}

// ── AnnualDetailPanel ─────────────────────────────────────────────────────────

function AnnualDetailPanel({ tag, icon, budget, monthlyValues, salary, onClose }) {
  const color = getCatColor(tag)
  const upToNow = monthlyValues.slice(0, NOW.getMonth() + 1)
  const total = upToNow.reduce((s, v) => s + v, 0)
  const avg = upToNow.length > 0 ? total / upToNow.length : 0
  const pctIncome = salary > 0 ? (avg / salary * 100).toFixed(1) : null

  const W = 480, H = 120, pad = 4
  const barW = (W - pad * 11) / 12
  const max = Math.max(...monthlyValues, budget, 1)
  const budgetY = H - (budget / max) * H

  return (
    <div className="card fade" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <CatIcon name={tag} overrideIcon={icon ?? null} size={22} />
        <div style={{ fontSize: 16, fontWeight: 700, color }}>{tag}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>TOTAL AÑO</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color, fontWeight: 600 }}>{formatCLP(total)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>PROMEDIO/MES</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{formatCLP(avg)}</div>
          </div>
          {pctIncome && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>% SUELDO</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>{pctIncome}%</div>
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H + 16}`} style={{ display: 'block', marginBottom: 6 }}>
        {monthlyValues.map((v, i) => {
          const bh = Math.max(2, (v / max) * H)
          const x = i * (barW + pad)
          return (
            <g key={i}>
              <rect x={x} y={H - bh} width={barW} height={bh} rx={2}
                fill={i === NOW.getMonth() ? color : color + '66'} />
              <text x={x + barW / 2} y={H + 14} textAnchor="middle"
                fontSize={8} fill="var(--text-dim)">{MONTH_ABBR[i]}</text>
            </g>
          )
        })}
        {budget > 0 && (
          <line x1={0} y1={budgetY} x2={W} y2={budgetY}
            stroke={color} strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
        )}
      </svg>

      <div style={{ marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-dim)', fontWeight: 600 }}>Mes</th>
              <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-dim)', fontWeight: 600 }}>Gastado</th>
              {budget > 0 && <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--text-dim)', fontWeight: 600 }}>vs Presupuesto</th>}
            </tr>
          </thead>
          <tbody>
            {monthlyValues.map((v, i) => {
              const over = budget > 0 && v > budget
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: i === NOW.getMonth() ? color + '0d' : 'transparent' }}>
                  <td style={{ padding: '5px 8px', color: 'var(--text-muted)' }}>{MONTH_ABBR[i]}</td>
                  <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: over ? 'var(--red)' : 'var(--text)' }}>{v > 0 ? formatCLP(v) : '—'}</td>
                  {budget > 0 && (
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'var(--mono)', color: over ? 'var(--red)' : 'var(--text-dim)', fontSize: 10 }}>
                      {v > 0 ? `${(v / budget * 100).toFixed(0)}%` : '—'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── AddTagForm ────────────────────────────────────────────────────────────────

function AddTagForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    try { await onAdd(trimmed) } finally { setSaving(false) }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        autoFocus
        className="finput"
        placeholder="Nombre del tag"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Escape' && onCancel()}
        style={{ flex: 1, fontSize: 12, boxSizing: 'border-box' }}
        disabled={saving}
      />
      <button type="submit" className="btn-gold" disabled={saving || !name.trim()} style={{ fontSize: 12, padding: '5px 12px' }}>
        {saving ? '…' : 'Agregar'}
      </button>
      <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 15 }}>×</button>
    </form>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Categories() {
  const { selectedId } = useAccount()
  const { personalEntries, loaded: tagsLoaded } = useTags()

  const [view, setView]   = useState('month')
  const [year, setYear]   = useState(NOW.getFullYear())
  const [month, setMonth] = useState(NOW.getMonth() + 1)

  const [entries, setEntries] = useState([])
  useEffect(() => { if (tagsLoaded) setEntries(personalEntries) }, [tagsLoaded, personalEntries])

  // All maps keyed by lowercase tag
  const [budgets, setBudgets]     = useState({})
  const [spending, setSpending]   = useState({})
  const [txCount, setTxCount]     = useState({})
  const [monthlyData, setMonthlyData] = useState({})
  const [tagPage, setTagPage]     = useState(0)
  const PAGE_SIZE = 12

  const [loadingSpend, setLoadingSpend]     = useState(false)
  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [loadingBudgets, setLoadingBudgets] = useState(true)

  const [salary, setSalary]       = useState(readSalary)
  const [pickerTag, setPickerTag] = useState(null)
  const [selectedTag, setSelectedTag] = useState(null)
  const [addingTag, setAddingTag] = useState(false)
  const [confirmDeleteTag, setConfirmDeleteTag] = useState(null)

  // Load tag budgets — normalize keys to lowercase
  useEffect(() => {
    setLoadingBudgets(true)
    api.tagBudgets(year)
      .then(data => {
        const map = {}
        for (const b of (Array.isArray(data) ? data : [])) {
          if (b.month === 0) map[lk(b.tag)] = b.amount
        }
        setBudgets(map)
      })
      .catch(() => {})
      .finally(() => setLoadingBudgets(false))
  }, [year])

  // Load spending — normalize keys to lowercase
  useEffect(() => {
    setLoadingSpend(true)
    setSelectedTag(null)
    setTagPage(0)
    const params = { year }
    if (view === 'month') params.month = month
    if (selectedId) params.account_id = selectedId
    api.tagSpending(params)
      .then(data => {
        const smap = {}, tmap = {}
        for (const d of (Array.isArray(data) ? data : [])) {
          smap[lk(d.tag)] = d.total
          tmap[lk(d.tag)] = d.transactions
        }
        setSpending(smap)
        setTxCount(tmap)
      })
      .catch(() => {})
      .finally(() => setLoadingSpend(false))
  }, [view, year, month, selectedId])

  // Load 12-month breakdown — normalize keys to lowercase
  useEffect(() => {
    if (view !== 'year') return
    setLoadingMonthly(true)
    const fetches = Array.from({ length: 12 }, (_, i) =>
      api.tagSpending({ year, month: i + 1, ...(selectedId ? { account_id: selectedId } : {}) })
        .then(d => Array.isArray(d) ? d : [])
        .catch(() => [])
    )
    Promise.all(fetches).then(months => {
      const map = {}
      months.forEach((data, mi) => {
        for (const d of data) {
          const key = lk(d.tag)
          if (!map[key]) map[key] = Array(12).fill(0)
          map[key][mi] = d.total
        }
      })
      setMonthlyData(map)
      setLoadingMonthly(false)
    })
  }, [view, year, selectedId])

  const handleSalaryEdit = useCallback(async (val) => {
    setSalary(val)
    writeSalaryLocal(val)
    try {
      const s = readSettings()
      await api.updateUserSettings({ ...s, monthly_salary: val })
    } catch {}
  }, [])

  async function handleBudgetEdit(tag, amount) {
    setBudgets(prev => ({ ...prev, [lk(tag)]: amount }))
    try { await api.upsertTagBudget({ tag, year, month: 0, amount }) } catch {}
  }

  async function handleSetIcon(tag, iconName) {
    try {
      await api.setTagIcon(tag, iconName ?? '')
      setEntries(prev => prev.map(e => e.tag === tag ? { ...e, icon: iconName ?? null } : e))
      clearTagsCache()
    } catch {}
    setPickerTag(null)
  }

  async function handleDelete(tag) {
    setConfirmDeleteTag(tag)
  }

  async function confirmDelete() {
    const tag = confirmDeleteTag
    setConfirmDeleteTag(null)
    setEntries(prev => prev.filter(e => e.tag !== tag))
    if (selectedTag === tag) setSelectedTag(null)
    try { await api.deletePersonalTag(tag); clearTagsCache() } catch {}
  }

  async function handleAddTag(name) {
    try {
      await api.savePersonalTag(name)
      setEntries(prev => [...prev, { tag: name, icon: null }].sort((a, b) => a.tag.localeCompare(b.tag)))
      clearTagsCache()
    } catch {}
    setAddingTag(false)
  }

  function prevPeriod() {
    if (view === 'month') {
      if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
    } else setYear(y => y - 1)
  }
  function nextPeriod() {
    if (view === 'month') {
      if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
    } else setYear(y => y + 1)
  }

  const personalTags    = entries.map(e => e.tag).filter(t => txFor(t) > 0)
  const spendingOnlyTags = Object.keys(spending).filter(k => !personalTags.some(p => lk(p) === k))

  function txFor(tag)     { return txCount[lk(tag)] ?? 0 }
  const allTags         = [...personalTags, ...spendingOnlyTags]
    .sort((a, b) => txFor(b) - txFor(a))

  const pageCount   = Math.ceil(allTags.length / PAGE_SIZE)
  const visibleTags = allTags.slice(tagPage * PAGE_SIZE, (tagPage + 1) * PAGE_SIZE)

  function iconFor(tag)   { return entries.find(e => e.tag === tag)?.icon ?? null }
  function budgetFor(tag) { return budgets[lk(tag)] ?? 0 }
  function spentFor(tag)  { return spending[lk(tag)] ?? 0 }

  const pickerEntry = pickerTag ? entries.find(e => e.tag === pickerTag) : null
  const loading     = loadingSpend || loadingBudgets || !tagsLoaded

  return (
    <div className="fade">
      {pickerTag && (
        <IconPickerModal
          tag={pickerTag}
          currentIcon={pickerEntry?.icon ?? null}
          onSelect={icon => handleSetIcon(pickerTag, icon)}
          onClose={() => setPickerTag(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirmDeleteTag}
        onClose={() => setConfirmDeleteTag(null)}
        onConfirm={confirmDelete}
        title={`Eliminar categoría ${confirmDeleteTag ?? ''}`}
        message="Esta acción re-asignará todos los movimientos asociados a la categoría OTROS."
        details={confirmDeleteTag ? [
          {
            label: 'Movimientos afectados',
            value: String(txCount[lk(confirmDeleteTag)] ?? 0),
            mono: true,
          },
          {
            label: 'Total acumulado',
            value: formatCLP(spending[lk(confirmDeleteTag)] ?? 0),
            color: 'var(--red)',
            mono: true,
          },
          {
            label: 'Nueva categoría',
            value: 'OTROS',
            color: 'var(--accent)',
          },
        ] : []}
        confirmLabel="Sí, eliminar"
      />

      {/* Header */}
      <div className="ph" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="ph-title">Tags</div>
          <div className="ph-sub">
            {view === 'month' ? `${MONTH_ABBR[month - 1]} ${year}` : year} · {allTags.length} tags · más usados primero
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {addingTag ? (
            <AddTagForm onAdd={handleAddTag} onCancel={() => setAddingTag(false)} />
          ) : (
            <button
              onClick={() => setAddingTag(true)}
              style={{ background: 'none', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12, padding: '6px 12px' }}
            >
              + Nuevo tag
            </button>
          )}
          <div className="toggle" style={{ width: 'auto' }}>
            {[['month', 'Mes'], ['year', 'Año']].map(([v, l]) => (
              <button key={v} className={`tbtn${view === v ? ' ti' : ''}`} onClick={() => setView(v)} style={{ padding: '7px 16px' }}>{l}</button>
            ))}
          </div>
          <button className="nav-arrow" onClick={prevPeriod}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 80, textAlign: 'center' }}>
            {view === 'month' ? `${MONTH_ABBR[month - 1]} ${year}` : year}
          </span>
          <button className="nav-arrow" onClick={nextPeriod}>›</button>
        </div>
      </div>

      {/* Distribución del sueldo */}
      <SalaryDistBar
        tags={personalTags}
        budgets={budgets}
        spending={spending}
        salary={salary}
        onEditSalary={handleSalaryEdit}
      />

      {/* Grid de cards */}
      {loading ? <Spinner /> : allTags.length === 0 ? (
        <div className="empty-msg" style={{ marginTop: 60 }}>
          Sin tags — agrega uno arriba o importa transacciones.
        </div>
      ) : (
        <>
          {loadingMonthly && view === 'year' && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Cargando datos anuales…</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 16 }}>
            {visibleTags.map(tag => (
              <TagCard
                key={tag}
                tag={tag}
                icon={iconFor(tag)}
                budget={budgetFor(tag)}
                spent={spentFor(tag)}
                salary={salary}
                view={view}
                monthlyValues={monthlyData[lk(tag)] ?? Array(12).fill(0)}
                currentMonth={month}
                onEditBudget={handleBudgetEdit}
                onEditIcon={setPickerTag}
                onDelete={handleDelete}
                onSelect={t => setSelectedTag(prev => prev === t ? null : t)}
                selected={selectedTag === tag}
              />
            ))}
          </div>

          {pageCount > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <button className="nav-arrow" onClick={() => setTagPage(p => Math.max(0, p - 1))} disabled={tagPage === 0}>‹</button>
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setTagPage(i)}
                  style={{
                    fontSize: 12, padding: '4px 9px', borderRadius: 5, border: 'none',
                    background: tagPage === i ? 'var(--accent)' : 'var(--surface3)',
                    color: tagPage === i ? '#fff' : 'var(--text-dim)',
                    cursor: 'pointer',
                  }}
                >
                  {i + 1}
                </button>
              ))}
              <button className="nav-arrow" onClick={() => setTagPage(p => Math.min(pageCount - 1, p + 1))} disabled={tagPage === pageCount - 1}>›</button>
            </div>
          )}

          {selectedTag && view === 'year' && (
            <AnnualDetailPanel
              tag={selectedTag}
              icon={iconFor(selectedTag)}
              budget={budgetFor(selectedTag)}
              monthlyValues={monthlyData[lk(selectedTag)] ?? Array(12).fill(0)}
              salary={salary}
              onClose={() => setSelectedTag(null)}
            />
          )}

          {selectedTag && view === 'month' && (
            <SelectedTagPanel
              tag={selectedTag}
              year={year}
              month={month}
              selectedId={selectedId}
              color={getCatColor(selectedTag)}
              icon={iconFor(selectedTag)}
              total={spentFor(selectedTag)}
              onClose={() => setSelectedTag(null)}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── SelectedTagPanel ──────────────────────────────────────────────────────────

function SelectedTagPanel({ tag, year, month, selectedId, color, icon, total, onClose }) {
  const [movs, setMovs]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = { tags: tag, year, month }
    if (selectedId) params.account_id = selectedId
    api.transactions(params)
      .then(d => setMovs(Array.isArray(d) ? d : (d?.transactions ?? [])))
      .catch(() => setMovs([]))
      .finally(() => setLoading(false))
  }, [tag, year, month, selectedId])

  const expenses = [...movs]
    .filter(m => m.flow !== 'INCOME')
    .sort((a, b) => b.date.localeCompare(a.date))

  function fmtDate(iso) {
    if (!iso) return ''
    return iso.slice(0, 10).split('-').reverse().join('/')
  }

  return (
    <div className="card fade" key={tag}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <CatIcon name={tag} overrideIcon={icon} size={18} />
        <div style={{ fontSize: 14, fontWeight: 700, color }}>{tag}</div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
          {expenses.length} movimientos · {formatCLP(total)}
        </span>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
      </div>
      {loading ? <Spinner /> : (
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
              {expenses.map(m => (
                <tr key={m.id}>
                  <td className="td-date">{fmtDate(m.date)}</td>
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
  )
}
