import { useState, useEffect, useMemo } from 'react'
import { api } from '../api/client'
import { formatCLP, formatDate } from '../lib/formatters'
import { getCatColor, CATEGORIES, MONTHS } from '../lib/constants'
import Spinner from '../components/Spinner'

function fmtDate(ds) {
  const d = new Date(ds + 'T12:00')
  const today = new Date()
  const diff = Math.floor((today - d) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return formatDate(ds)
}

function groupByDate(txs) {
  const groups = []
  let cur = null
  ;[...txs].forEach(tx => {
    const date = tx.date?.slice(0, 10) ?? ''
    if (date !== cur) { cur = date; groups.push({ date, items: [] }) }
    groups[groups.length - 1].items.push(tx)
  })
  return groups
}

function BudgetRow({ cat, spent, budget }) {
  const color = getCatColor(cat)
  const over = budget > 0 && spent > budget
  const pct = budget > 0 ? Math.min(spent / budget * 100, 100) : 0
  const barColor = over ? 'var(--red)' : pct > 80 ? '#d4884c' : color

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{cat.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {budget > 0 && (
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: over ? 'var(--red)' : 'var(--text-dim)' }}>
              {over ? `+${formatCLP(spent - budget)}` : `${Math.round(pct)}%`}
            </span>
          )}
          <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, color: over ? 'var(--red)' : color }}>
            {formatCLP(spent)}
          </span>
        </div>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: budget > 0 ? `${pct}%` : '100%', background: budget > 0 ? barColor : color + '40', borderRadius: 2, transition: 'width .4s ease' }} />
      </div>
      {budget > 0 && (
        <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 3 }}>
          límite {formatCLP(budget)}
        </div>
      )}
    </div>
  )
}

function MovDetail({ tx, onClose }) {
  const tags = (tx.tags?.length ? tx.tags : (tx.category ? [tx.category] : [])).filter(t => CATEGORIES.includes(t))
  return (
    <div className="overlay fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: getCatColor(tx.category), flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{tx.description}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(tx.date)}</div>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600, color: tx.flow === 'INCOME' ? 'var(--green)' : 'var(--red)' }}>
            {tx.flow === 'INCOME' ? '+' : '-'}{formatCLP(tx.amount)}
          </div>
        </div>
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {tags.map(t => (
              <span key={t} style={{ fontSize: 11, padding: '3px 9px', background: getCatColor(t) + '22', color: getCatColor(t), borderRadius: 5, fontWeight: 700 }}>
                {t}
              </span>
            ))}
          </div>
        )}
        {tx.notes && (
          <div style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.5, color: 'var(--text)', background: 'var(--surface2)', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)' }}>
            {tx.notes}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())

  const [kpis, setKpis]       = useState(null)
  const [budgets, setBudgets] = useState([])
  const [recent, setRecent]   = useState([])
  const [loading, setLoading] = useState(true)
  const [selTx, setSelTx]     = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.kpis(year),
      api.budgetVsActual(month, year),
      api.transactions({ month, year, limit: 30 }),
    ])
      .then(([kpiData, budgetData, txData]) => {
        setKpis(kpiData)
        const cats = Array.isArray(budgetData) ? budgetData : (budgetData?.categories ?? [])
        setBudgets(cats)
        setRecent(Array.isArray(txData) ? txData : (txData?.transactions ?? []))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month, year])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const netWorth   = kpis?.net_worth ?? 0
  const incomeYtd  = kpis?.income_ytd ?? 0
  const expensesYtd = kpis?.expenses_ytd ?? 0
  const investYtd  = kpis?.investments_ytd ?? 0
  const pctInv     = incomeYtd > 0 ? +(investYtd / incomeYtd * 100).toFixed(1) : 0

  const topBudgets = useMemo(() =>
    budgets
      .filter(b => !['Sueldo', 'Devolucion'].includes(b.category) && (b.total > 0 || b.budget > 0))
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
      .slice(0, 6)
  , [budgets])

  const grouped = useMemo(() => groupByDate(recent), [recent])

  return (
    <div className="fade">
      {/* ── HERO ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6 }}>
          Patrimonio total
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'clamp(32px,6vw,48px)', fontWeight: 700, letterSpacing: '-0.02em', color: netWorth >= 0 ? 'var(--accent)' : 'var(--red)', lineHeight: 1 }}>
          {formatCLP(netWorth)}
        </div>
      </div>

      {/* ── ANNUAL STATS ── */}
      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-lbl">Entradas {year}</div>
          <div className="stat-val" style={{ color: 'var(--green)', fontSize: 17 }}>{formatCLP(incomeYtd)}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Salidas {year}</div>
          <div className="stat-val" style={{ color: 'var(--red)', fontSize: 17 }}>{formatCLP(expensesYtd)}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Inversión {year}</div>
          <div className="stat-val" style={{ color: '#4cb8af', fontSize: 17 }}>{formatCLP(investYtd)}</div>
          <div className="stat-delta"><span style={{ color: '#4cb8af', fontWeight: 700 }}>{pctInv}%</span> de ingresos</div>
        </div>
        <div className="stat" style={{ borderColor: 'rgba(201,168,76,.25)' }}>
          <div className="stat-lbl">Balance neto</div>
          <div className="stat-val" style={{ color: incomeYtd - expensesYtd >= 0 ? 'var(--accent)' : 'var(--red)', fontSize: 17 }}>
            {formatCLP(incomeYtd - expensesYtd)}
          </div>
        </div>
      </div>

      {/* ── MONTH NAV ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Detalle mensual
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="nav-arrow" onClick={prevMonth}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 120, textAlign: 'center' }}>
            {MONTHS[month - 1]} {year}
          </span>
          <button className="nav-arrow" onClick={nextMonth}>›</button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        /* ── TWO-COLUMN: budget bars + movements ── */
        <div className="home-grid">
          {/* Budget bars */}
          <div className="card" style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Top gastos</div>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{MONTHS[month - 1]}</span>
            </div>
            {topBudgets.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {topBudgets.map(b => (
                  <BudgetRow key={b.category} cat={b.category} spent={b.total ?? 0} budget={b.budget ?? 0} />
                ))}
              </div>
            ) : (
              <div className="empty-msg" style={{ padding: '32px 0' }}>Sin movimientos este mes</div>
            )}
          </div>

          {/* Monthly movements */}
          <div className="card" style={{ minWidth: 0, maxHeight: 560, overflowY: 'auto' }}>
            <div className="card-title">Movimientos — {MONTHS[month - 1]}</div>
            {grouped.length > 0 ? (
              grouped.map(g => (
                <div key={g.date} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, paddingBottom: 5, borderBottom: '1px solid var(--border)' }}>
                    {fmtDate(g.date)}
                  </div>
                  {g.items.map(tx => {
                    const color = getCatColor(tx.category)
                    const tags = (tx.tags?.length ? tx.tags : (tx.category ? [tx.category] : [])).filter(t => CATEGORIES.includes(t))
                    return (
                      <div
                        key={tx.id}
                        onClick={() => setSelTx(tx)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 7, cursor: 'pointer', transition: 'background var(--t)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 7, background: color + '22', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                          <div style={{ display: 'flex', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                            {tags.slice(0, 3).map(t => (
                              <span key={t} style={{ fontSize: 9, padding: '1px 6px', background: getCatColor(t) + '22', color: getCatColor(t), borderRadius: 3, fontWeight: 700 }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: tx.flow === 'INCOME' ? 'var(--green)' : 'var(--red)' }}>
                            {tx.flow === 'INCOME' ? '+' : '-'}{formatCLP(tx.amount)}
                          </div>
                          {tx.running_balance != null && (
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                              {formatCLP(tx.running_balance)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            ) : (
              <div className="empty-msg">Sin movimientos en {MONTHS[month - 1]}</div>
            )}
          </div>
        </div>
      )}

      {selTx && <MovDetail tx={selTx} onClose={() => setSelTx(null)} />}
    </div>
  )
}
