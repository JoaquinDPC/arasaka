import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { formatCLP, formatPct, monthName } from '../lib/formatters'
import { CATEGORY_COLORS } from '../lib/constants'
import Spinner from '../components/Spinner'

function CircleProgress({ pct, size = 120, label, sublabel, color = '#8b5cf6' }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.min(pct, 1)
  const dash = clamped * circ
  const displayPct = Math.round(pct * 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8"
          />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-white font-bold tabular" style={{ fontSize: size > 100 ? 20 : 14 }}>
            {displayPct}%
          </span>
        </div>
      </div>
      <div className="text-center">
        {label && <p className="text-white/50 text-xs">{label}</p>}
        {sublabel && <p className="text-white/30 text-[10px]">{sublabel}</p>}
      </div>
    </div>
  )
}

function catColor(category) {
  const map = {
    Personal: '#8b5cf6', Casa: '#eab308', Otros: '#64748b',
    Salud: '#22c55e', Transporte: '#f59e0b', Suscripciones: '#6366f1',
    Gustos: '#ec4899', Mascota: '#f97316', Inversion: '#06b6d4', Patrimonio: '#94a3b8',
  }
  return map[category] ?? '#64748b'
}

const FALLBACK_COLORS = { bg: 'bg-slate-500/15', text: 'text-slate-300', dot: 'bg-slate-400' }

export default function Monthly() {
  const now = new Date()
  const navigate = useNavigate()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const [monthly, setMonthly] = useState(null)
  const [kpis, setKpis]       = useState(null)
  const [budgets, setBudgets]  = useState([])
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.monthly(month, year),
      api.kpis(year),
      api.budgetVsActual(month, year),
    ])
      .then(([mon, kpiData, budgetData]) => {
        setMonthly(mon)
        setKpis(kpiData)
        const cats = Array.isArray(budgetData) ? budgetData : (budgetData?.categories ?? [])
        setBudgets(cats)
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

  const income      = monthly?.income ?? 0
  const expenses    = monthly?.expenses ?? 0
  const investments = monthly?.investments ?? 0
  const balance     = monthly?.balance ?? 0
  const netWorth    = kpis?.net_worth ?? 0

  const expenseRatio    = income > 0 ? expenses / income : 0
  const investmentRatio = income > 0 ? investments / income : 0
  const savingsRatio    = income > 0 ? Math.max(balance / income, 0) : 0

  const activeBudgets = budgets.filter(b => b.total > 0 || b.budget > 0)
  const maxTotal = activeBudgets.reduce((m, b) => Math.max(m, b.total, b.budget), 0)

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Vista Mensual</h1>
          <p className="text-white/35 text-sm mt-0.5">Análisis detallado</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg glass text-white/40 hover:text-white transition-colors text-base">‹</button>
          <span className="text-white/70 text-sm font-medium min-w-[90px] text-center">
            {monthName(month)} {year}
          </span>
          <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg glass text-white/40 hover:text-white transition-colors text-base">›</button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-5 gap-3 mb-5">
            {[
              { label: 'Ingresos',       value: formatCLP(income),      color: 'text-emerald-400' },
              { label: 'Egreso',         value: formatCLP(expenses),    color: 'text-rose-400'    },
              { label: 'Inversiones',    value: formatCLP(investments), color: 'text-cyan-400'    },
              { label: 'Balance de caja',value: formatCLP(balance),     color: balance >= 0 ? 'text-emerald-400' : 'text-rose-400' },
              { label: 'Patrimonio',     value: formatCLP(netWorth),    color: 'text-violet-300'  },
            ].map(k => (
              <div key={k.label} className="glass rounded-xl p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">{k.label}</p>
                <p className={`text-base font-bold tabular ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {/* Spending circles */}
            <div className="glass rounded-2xl p-5 flex flex-col items-center justify-center gap-4">
              <CircleProgress
                pct={expenseRatio}
                size={130}
                label="Gasto del ingreso"
                color={expenseRatio >= 1 ? '#f43f5e' : expenseRatio >= 0.8 ? '#fbbf24' : '#8b5cf6'}
              />
              <div className="flex items-center gap-8">
                <CircleProgress
                  pct={investmentRatio}
                  size={72}
                  label="Inversiones"
                  color="#06b6d4"
                />
                <CircleProgress
                  pct={savingsRatio}
                  size={72}
                  label="Ahorro"
                  color="#22c55e"
                />
              </div>
              <p className="text-white/60 text-sm font-bold tabular">{formatCLP(expenses)}</p>
            </div>

            {/* Category bars */}
            <div className="glass rounded-2xl p-5">
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-4">
                Gastos por categoría
              </p>
              {activeBudgets.length === 0 ? (
                <p className="text-center py-8 text-white/25 text-sm">Sin gastos este mes</p>
              ) : (
                <div className="space-y-3">
                  {activeBudgets.filter(b => b.total > 0).map(b => {
                    const colors = CATEGORY_COLORS[b.category] ?? FALLBACK_COLORS
                    const barW = maxTotal > 0 ? (b.total / maxTotal) * 100 : 0
                    return (
                      <div key={b.category}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            <span className={`text-xs font-semibold uppercase ${colors.text}`}>{b.category}</span>
                          </div>
                          <span className="text-xs text-white/60 tabular">{formatCLP(b.total)}</span>
                        </div>
                        <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${barW}%`, background: catColor(b.category) }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Monthly budgets grid */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">
                Presupuestos mensuales
              </p>
              <button
                onClick={() => navigate('/presupuestos')}
                className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                Definir mes categoría presupuesto →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {budgets.map(b => {
                const colors = CATEGORY_COLORS[b.category] ?? FALLBACK_COLORS
                const pct = b.budget > 0 ? b.total / b.budget : 0
                return (
                  <div key={b.category} className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                      <span className="text-xs text-white/55 truncate uppercase tracking-wide">{b.category}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      {b.budget > 0 ? (
                        <span className={`text-xs font-semibold tabular ${pct >= 1 ? 'text-rose-400' : pct >= 0.8 ? 'text-amber-400' : 'text-white/60'}`}>
                          {formatCLP(b.total)} / {formatCLP(b.budget)}
                        </span>
                      ) : (
                        <span className="text-xs text-white/25 tabular">{formatCLP(b.total)}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
