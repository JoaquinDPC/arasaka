import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { formatCLP, formatPct, monthName } from '../lib/formatters'
import KpiCard from '../components/KpiCard'
import BudgetBar from '../components/BudgetBar'
import InsightCard from '../components/InsightCard'
import Spinner from '../components/Spinner'

function balanceColor(balance, income) {
  if (balance < 0) return 'text-rose-400'
  const rate = income > 0 ? balance / income : 0
  if (rate >= 0.2) return 'text-emerald-400'
  if (rate >= 0.05) return 'text-amber-400'
  return 'text-rose-400'
}

export default function Monthly() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const [data, setData]   = useState(null)
  const [kpis, setKpis]   = useState(null)
  const [insights, setInsights] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      api.monthly(month, year),
      api.kpis(year),
      api.insights(month, year).catch(() => []),
    ])
      .then(([monthly, kpisData, insightsData]) => {
        setData(monthly)
        setKpis(kpisData)
        setInsights(Array.isArray(insightsData) ? insightsData : [])
      })
      .catch(() => setError('No se pudo conectar al servidor'))
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

  const categories = data?.by_category ?? data?.categories ?? []
  const investmentRate = data?.income > 0 ? (data.investments ?? 0) / data.income : 0
  const savingsRate = data?.savings_rate ?? (data?.income > 0 ? (data?.balance ?? 0) / data.income : 0)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

      {/* Month navigator */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          type="button"
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl glass text-white/60 hover:text-white transition-colors text-xl leading-none"
        >
          ‹
        </button>
        <h2 className="text-xl font-bold text-white capitalize min-w-[170px] text-center">
          {monthName(month)} {year}
        </h2>
        <button
          type="button"
          onClick={nextMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl glass text-white/60 hover:text-white transition-colors text-xl leading-none"
        >
          ›
        </button>
      </div>

      {loading && <Spinner />}
      {error && <div className="text-center py-16 text-white/50">{error}</div>}

      {!loading && !error && data && (
        <>
          {/* Hero balance card */}
          <div className="glass-strong rounded-2xl p-6 sm:p-8 mb-4 text-center">
            <p className="text-white/45 text-xs uppercase tracking-widest mb-3">Balance libre</p>
            <p className={`text-4xl sm:text-5xl font-bold mb-4 ${balanceColor(data.balance ?? 0, data.income ?? 0)}`}>
              {formatCLP(data.balance ?? 0)}
            </p>
            <div className="flex items-center justify-center gap-8 text-sm">
              <span className="text-white/45">
                Ahorro:{' '}
                <span className="font-semibold text-white/80">
                  {formatPct(savingsRate)}
                </span>
              </span>
              <span className="text-white/20">|</span>
              <span className="text-white/45">
                {monthName(month)} {year}
              </span>
            </div>
          </div>

          {/* 3 monthly KPIs */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
            <KpiCard
              title="Ingresos"
              value={formatCLP(data.income ?? 0)}
              color="text-emerald-400"
            />
            <KpiCard
              title="Gastos"
              value={formatCLP(data.expenses ?? 0)}
              subtitle={data.income > 0 ? `${formatPct((data.expenses ?? 0) / data.income)} del ingreso` : undefined}
              color="text-rose-400"
            />
            <KpiCard
              title="Invertido"
              value={formatCLP(data.investments ?? 0)}
              subtitle={data.income > 0 ? `${formatPct(investmentRate)} del ingreso` : undefined}
              color="text-cyan-400"
            />
          </div>

          {/* YTD KPIs */}
          {kpis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <KpiCard
                title="Patrimonio neto"
                value={formatCLP(kpis.net_worth ?? 0)}
                subtitle="cash + inversiones"
                color="text-violet-300"
              />
              <KpiCard
                title="Cash YTD"
                value={formatCLP(kpis.cash_balance ?? 0)}
                subtitle={`${year} acumulado`}
                color={(kpis.cash_balance ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}
              />
              <KpiCard
                title="Invertido YTD"
                value={formatCLP(kpis.investments_ytd ?? 0)}
                subtitle={kpis.income_ytd > 0 ? `${formatPct(kpis.investment_rate ?? 0)} del ingreso` : undefined}
                color="text-cyan-400"
              />
              <KpiCard
                title="Cost of living"
                value={formatPct(kpis.cost_of_living ?? 0)}
                subtitle="gastos / ingresos YTD"
                color={
                  (kpis.cost_of_living ?? 0) <= 0.6 ? 'text-emerald-400' :
                  (kpis.cost_of_living ?? 0) <= 0.8 ? 'text-amber-400' :
                  'text-rose-400'
                }
              />
            </div>
          )}

          {/* Budget bars + Top expenses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {categories.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-4">
                  Presupuesto por categoría
                </h3>
                <div className="divide-y divide-white/5">
                  {categories.map(cat => (
                    <BudgetBar
                      key={cat.category}
                      category={cat.category}
                      total={cat.total ?? 0}
                      budget={cat.budget ?? 0}
                      pctUsed={cat.pct_used ?? 0}
                    />
                  ))}
                </div>
              </div>
            )}

            {data.top_expenses?.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-4">
                  Top 5 gastos del mes
                </h3>
                <div className="space-y-3">
                  {data.top_expenses.slice(0, 5).map((tx, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs text-white/40 font-semibold">
                          {i + 1}
                        </span>
                        <span className="text-sm text-white/65 truncate">{tx.description}</span>
                      </div>
                      <span className="text-sm font-semibold text-rose-400 whitespace-nowrap flex-shrink-0">
                        {formatCLP(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Spending by type + Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.by_subtype && Object.keys(data.by_subtype).length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-4">
                  Gastos por tipo
                </h3>
                <div className="space-y-3">
                  {Object.entries(data.by_subtype).map(([type, amount]) => (
                    <div key={type} className="flex justify-between items-center">
                      <span className="text-sm text-white/55 capitalize">{type.toLowerCase()}</span>
                      <span className="text-sm font-semibold text-white/85">{formatCLP(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insights.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <h3 className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-4">
                  Insights del mes
                </h3>
                <div className="space-y-2">
                  {insights.map((insight, i) => (
                    <InsightCard key={i} message={insight.message} type={insight.type} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
