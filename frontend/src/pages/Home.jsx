import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { formatCLP, monthName } from '../lib/formatters'
import { CATEGORY_COLORS } from '../lib/constants'
import Spinner from '../components/Spinner'

const CATEGORY_BAR_COLORS = {
  Personal:      '#8b5cf6',
  Casa:          '#eab308',
  Otros:         '#64748b',
  Salud:         '#22c55e',
  Transporte:    '#f59e0b',
  Suscripciones: '#6366f1',
  Gustos:        '#ec4899',
  Mascota:       '#f97316',
  Inversion:     '#06b6d4',
  Patrimonio:    '#94a3b8',
}

function BudgetBattery({ category, spent, budget }) {
  const pct = budget > 0 ? Math.min(spent / budget, 1) : 0
  const barColor = CATEGORY_BAR_COLORS[category] ?? '#64748b'
  const pctDisplay = budget > 0 ? Math.round(pct * 100) : 0
  const shortLabel = category.slice(0, 6).toUpperCase()
  const spentK = spent >= 1000 ? `${Math.round(spent / 1000)}k` : String(spent)
  const budgetK = budget >= 1000 ? `${Math.round(budget / 1000)}k` : String(budget)

  return (
    <div className="flex flex-col items-center gap-1.5" style={{ width: 60 }}>
      <span className="text-white/70 text-[11px] font-semibold tabular">{spentK}</span>
      <div
        className="relative rounded-xl border-2 overflow-hidden"
        style={{
          width: 40,
          height: 100,
          borderColor: `${barColor}40`,
          borderStyle: pct < 1 ? 'dashed' : 'solid',
        }}
      >
        <div
          className="absolute bottom-0 left-0 right-0 rounded-b-lg transition-all"
          style={{
            height: `${Math.max(pct * 100, 2)}%`,
            background: barColor,
            opacity: 0.85,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">{pctDisplay}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-white/50 text-[10px] leading-tight">{shortLabel}.</p>
        <p className="text-white/25 text-[10px] leading-tight">{budgetK}</p>
      </div>
    </div>
  )
}

function CategoryDot({ category }) {
  const colors = CATEGORY_COLORS[category]
  if (!colors) return <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
}

function formatDateLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const today = new Date()
  const diffMs = today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)
  const diffDays = Math.round(diffMs / 86400000)
  if (diffDays === 0) return 'HOY'
  if (diffDays === 1) return 'AYER'
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }).toUpperCase()
}

function groupByDay(transactions) {
  const groups = []
  const seen = {}
  for (const tx of transactions) {
    const key = tx.date?.slice(0, 10) ?? ''
    if (!seen[key]) {
      seen[key] = true
      groups.push({ key, label: formatDateLabel(tx.date), transactions: [] })
    }
    groups[groups.length - 1].transactions.push(tx)
  }
  return groups
}

export default function Home() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())

  const [monthly, setMonthly]   = useState(null)
  const [kpis, setKpis]         = useState(null)
  const [budgets, setBudgets]   = useState([])
  const [recent, setRecent]     = useState([])
  const [loading, setLoading]   = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.monthly(month, year),
      api.kpis(year),
      api.budgetVsActual(month, year),
      api.transactions({ month, year, limit: 15 }),
    ])
      .then(([mon, kpiData, budgetData, txData]) => {
        setMonthly(mon)
        setKpis(kpiData)
        const cats = Array.isArray(budgetData) ? budgetData : (budgetData?.categories ?? [])
        setBudgets(cats.filter(c => c.budget > 0 || c.total > 0))
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

  const netWorth  = kpis?.net_worth ?? 0
  const income    = monthly?.income ?? 0
  const expenses  = monthly?.expenses ?? 0
  const balance   = monthly?.balance ?? 0
  const groups    = groupByDay(recent.slice(0, 12))

  const budgetBars = budgets.filter(b => b.budget > 0).slice(0, 5)

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Home</h1>
          <p className="text-white/35 text-sm mt-0.5">Resumen + presupuestos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg glass text-white/40 hover:text-white transition-colors text-base leading-none"
          >
            ‹
          </button>
          <span className="text-white/70 text-sm font-medium min-w-[90px] text-center">
            {monthName(month)} {year}
          </span>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg glass text-white/40 hover:text-white transition-colors text-base leading-none"
          >
            ›
          </button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Balance hero */}
          <div className="mb-5">
            <p className="text-white/35 text-[11px] font-semibold uppercase tracking-widest mb-1">
              Saldo actual
            </p>
            <p className="text-4xl font-bold text-violet-300 tabular mb-2">
              {formatCLP(netWorth)}
            </p>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-400 tabular">+{formatCLP(income)} ingresos</span>
              <span className="text-rose-400 tabular">-{formatCLP(expenses)} egresos</span>
              <span className={`tabular ${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCLP(balance)} balance caja
              </span>
            </div>
          </div>

          {/* Budget batteries */}
          {budgetBars.length > 0 && (
            <div className="glass rounded-2xl p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">
                  Presupuesto — {monthName(month)}
                </span>
                <span className="text-[11px] text-white/20">Arrastra ↕ para ajustar presupuesto</span>
              </div>
              <div className="flex items-end gap-4">
                {budgetBars.map(b => (
                  <BudgetBattery
                    key={b.category}
                    category={b.category}
                    spent={b.total ?? 0}
                    budget={b.budget ?? 0}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent transactions */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-semibold text-white/35 uppercase tracking-wider">
                Movimientos recientes
              </span>
              <button
                onClick={() => navigate('/movimientos')}
                className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
              >
                Ver todos →
              </button>
            </div>

            {groups.length === 0 && (
              <p className="text-center py-8 text-white/25 text-sm">
                Sin movimientos este mes
              </p>
            )}

            {groups.map(group => (
              <div key={group.key} className="mb-4 last:mb-0">
                <p className="text-[10px] font-semibold text-white/25 uppercase tracking-wider mb-2">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.transactions.map(tx => (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 py-2 rounded-xl hover:bg-white/5 transition-colors px-2 -mx-2 cursor-pointer"
                      onClick={() => navigate('/movimientos')}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${CATEGORY_BAR_COLORS[tx.category] ?? '#64748b'}22` }}>
                        <CategoryDot category={tx.category} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 truncate leading-tight">{tx.description}</p>
                        <p className="text-[11px] text-white/30 uppercase tracking-wide leading-tight">{tx.category}</p>
                      </div>
                      <span className={`text-sm font-semibold tabular flex-shrink-0 ${
                        tx.flow === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {tx.flow === 'INCOME' ? '+' : '-'}{formatCLP(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
