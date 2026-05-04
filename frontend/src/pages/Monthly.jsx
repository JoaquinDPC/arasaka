import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { api } from '../api/client'
import { formatCLP } from '../lib/formatters'
import { getCatColor, MONTHS } from '../lib/constants'
import Spinner from '../components/Spinner'
import CatIcon from '../components/CatIcon'
import { useAccount } from '../context/AccountContext'

function Ring({ value, max = 100, label, size = 130 }) {
  const r = 48, circ = 2 * Math.PI * r
  const v = Math.min(Math.max(value, 0), max)
  const offset = circ * (1 - v / max)
  const c = v / max > 0.8 ? '#e05c5c' : v / max > 0.6 ? '#d4884c' : '#4caf7d'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={c} strokeWidth="9"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset .5s ease' }} />
        <text x="60" y="57" textAnchor="middle" fill="#f0ede6" fontSize="19" fontWeight="600" fontFamily="DM Mono">{value.toFixed(0)}%</text>
        <text x="60" y="72" textAnchor="middle" fill="#88888f" fontSize="10" fontFamily="Space Grotesk">{label}</text>
      </svg>
    </div>
  )
}

function BudgetBar({ cat, spent, budget }) {
  const p = budget > 0 ? Math.min(spent / budget * 100, 100) : 0
  const over = budget > 0 && spent > budget
  const bar = over ? 'var(--red)' : p > 80 ? '#d4884c' : 'var(--accent)'
  return (
    <div className="bud-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <CatIcon name={cat} size={13} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{cat.toUpperCase()}</span>
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: over ? 'var(--red)' : 'var(--text-muted)' }}>
          {formatCLP(spent)}{budget > 0 ? ` / ${formatCLP(budget)}` : ''}
        </span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p}%`, background: bar, borderRadius: 2, transition: 'width .4s ease' }} />
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111114', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font)' }}>
      <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.fill }}>{p.name}: {formatCLP(p.value)}</p>
      ))}
    </div>
  )
}

export default function Monthly() {
  const now = new Date()
  const navigate = useNavigate()
  const { selectedId } = useAccount()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const [monthly, setMonthly]   = useState(null)
  const [kpis, setKpis]         = useState(null)
  const [budgets, setBudgets]   = useState([])
  const [tagData, setTagData]   = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.monthly(month, year, selectedId),
      api.kpis(year, selectedId),
      api.budgetVsActual(month, year, selectedId),
      api.tagSpending({ month, year, ...(selectedId ? { account_id: selectedId } : {}) }),
    ])
      .then(([mon, kpiData, budgetData, tags]) => {
        setMonthly(mon)
        setKpis(kpiData)
        const cats = Array.isArray(budgetData) ? budgetData : (budgetData?.categories ?? [])
        setBudgets(cats)
        setTagData(Array.isArray(tags) ? tags.filter(t => t.total > 0) : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month, year, selectedId])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const income      = monthly?.income      ?? 0
  const expenses    = monthly?.expenses    ?? 0
  const investments = monthly?.investments ?? 0
  const balance     = monthly?.balance     ?? 0
  const netWorth    = kpis?.net_worth      ?? 0

  const pctVida   = income > 0 ? +(expenses / income * 100).toFixed(1) : 0
  const pctAhorro = income > 0 ? +(Math.max(balance, 0) / income * 100).toFixed(1) : 0
  const pctInv    = income > 0 ? +(investments / income * 100).toFixed(1) : 0

  const catData = tagData.slice().sort((a, b) => b.total - a.total)
  const budgetCats = budgets
    .filter(b => !['sueldo', 'devolucion'].includes(b.category))
    .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))

  return (
    <div className="fade">
      <div className="ph ph-row">
        <div>
          <div className="ph-title">Vista Mensual</div>
          <div className="ph-sub">Análisis detallado</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="nav-arrow" onClick={prevMonth}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 130, textAlign: 'center' }}>{MONTHS[month - 1]} {year}</span>
          <button className="nav-arrow" onClick={nextMonth}>›</button>
        </div>
      </div>

      {/* 5-stat row */}
      <div className="stats stats-5">
        <div className="stat"><div className="stat-lbl">Ingresos</div><div className="stat-val" style={{ color: 'var(--green)', fontSize: 16 }}>{formatCLP(income)}</div></div>
        <div className="stat"><div className="stat-lbl">Egresos</div><div className="stat-val" style={{ color: 'var(--red)', fontSize: 16 }}>{formatCLP(expenses)}</div></div>
        <div className="stat"><div className="stat-lbl">Inversiones</div><div className="stat-val" style={{ color: '#4cb8af', fontSize: 16 }}>{formatCLP(investments)}</div></div>
        <div className="stat"><div className="stat-lbl">Balance de caja</div><div className="stat-val" style={{ color: balance >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 16 }}>{formatCLP(balance)}</div></div>
        <div className="stat" style={{ borderColor: 'rgba(201,168,76,.25)' }}><div className="stat-lbl">Patrimonio</div><div className="stat-val" style={{ color: 'var(--accent)', fontSize: 16 }}>{formatCLP(netWorth)}</div></div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Rings + horizontal category chart */}
          <div className="monthly-grid">
            <div className="card rings-card">
              <div style={{ textAlign: 'center' }}>
                <Ring value={pctVida} label="Costo de vida" size={130} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{formatCLP(expenses)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Ring value={pctAhorro} label="Ahorro" size={108} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{formatCLP(Math.max(balance, 0))}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Ring value={pctInv} label="Inversión" size={108} />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>{formatCLP(investments)}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Gastos por Tag</div>
              {catData.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(catData.length * 28, 100)}>
                  <BarChart data={catData} layout="vertical" barSize={10} margin={{ left: 60, right: 30, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="tag"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'Space Grotesk' }}
                      axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} name="Gasto">
                      {catData.map(d => <Cell key={d.tag} fill={getCatColor(d.tag)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-msg">Sin egresos este mes</div>
              )}
            </div>
          </div>

          {/* Budget bars */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Presupuestos mensuales</div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer' }}
                onClick={() => navigate('/presupuestos')}>
                Definir base →
              </span>
            </div>
            <div className="budget-grid">
              {budgetCats.map(b => (
                <BudgetBar key={b.category} cat={b.category} spent={b.total ?? 0} budget={b.budget ?? 0} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
