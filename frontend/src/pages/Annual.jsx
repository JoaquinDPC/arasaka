import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import { formatCLP, formatPct } from '../lib/formatters'
import { CATEGORY_COLORS } from '../lib/constants'
import KpiCard from '../components/KpiCard'
import Spinner from '../components/Spinner'

const YEARS = [2024, 2025, 2026]
const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const FALLBACK_COLOR = { bg: 'bg-slate-500/15', text: 'text-slate-300', dot: 'bg-slate-400' }

function AnnualTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(24,10,56,0.95)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '0.75rem',
      padding: '0.75rem',
      fontSize: '0.875rem',
    }}>
      <p className="font-semibold text-white mb-2">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.fill }} className="leading-snug">
          {p.name}: {formatCLP(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function Annual() {
  const [year, setYear]     = useState(new Date().getFullYear())
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.annual(year)
      .then(setData)
      .catch(() => setError('No se pudo cargar el resumen anual'))
      .finally(() => setLoading(false))
  }, [year])

  const chartData = useMemo(() => {
    const trendMap = Object.fromEntries(
      (data?.monthly_trend ?? []).map(m => [m.month, m])
    )
    return Array.from({ length: 12 }, (_, i) => {
      const m = trendMap[i + 1]
      return {
        name:        MONTH_ABBR[i],
        Ingresos:    m?.income      ?? 0,
        Gastos:      m?.expenses    ?? 0,
        Inversiones: m?.investments ?? 0,
      }
    })
  }, [data])

  const kpis = data?.kpis ?? {}
  const netSavings = (kpis.income_ytd ?? 0) - (kpis.expenses_ytd ?? 0) - (kpis.investments_ytd ?? 0)

  function yAxisFormatter(v) {
    if (v === 0) return '0'
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    return `$${(v / 1_000).toFixed(0)}k`
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-white">Resumen Anual</h2>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="glass-input rounded-xl px-3 py-2 text-sm"
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <Spinner />}
      {error && <div className="text-center py-16 text-white/50">{error}</div>}

      {!loading && !error && data && (
        <>
          {/* Primary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              title="Ingresos"
              value={formatCLP(kpis.income_ytd ?? 0)}
              color="text-emerald-400"
            />
            <KpiCard
              title="Gastos"
              value={formatCLP(kpis.expenses_ytd ?? 0)}
              color="text-rose-400"
            />
            <KpiCard
              title="Invertido"
              value={formatCLP(kpis.investments_ytd ?? 0)}
              color="text-cyan-400"
            />
            <KpiCard
              title="Ahorro neto"
              value={formatCLP(netSavings)}
              color={netSavings >= 0 ? 'text-violet-300' : 'text-rose-400'}
            />
          </div>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              title="Patrimonio neto"
              value={formatCLP(kpis.net_worth ?? 0)}
              color="text-violet-300"
            />
            <KpiCard
              title="Cash balance"
              value={formatCLP(kpis.cash_balance ?? 0)}
              color={(kpis.cash_balance ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-400'}
            />
            <KpiCard
              title="Tasa inversión"
              value={formatPct(kpis.investment_rate ?? 0)}
              color="text-cyan-300"
            />
            <KpiCard
              title="Cost of living"
              value={formatPct(kpis.cost_of_living ?? 0)}
              color={(kpis.cost_of_living ?? 0) > 0.9 ? 'text-rose-400' : (kpis.cost_of_living ?? 0) > 0.7 ? 'text-amber-300' : 'text-emerald-300'}
            />
          </div>

          {/* Monthly trend chart */}
          <div className="glass rounded-2xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
              Tendencia mensual
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barCategoryGap="22%">
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={yAxisFormatter}
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <Tooltip content={<AnnualTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', paddingTop: '12px' }}
                />
                <Bar dataKey="Ingresos"    fill="#34d399" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Gastos"      fill="#f43f5e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Inversiones" fill="#22d3ee" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category breakdown */}
          <div className="glass rounded-2xl p-4 sm:p-6">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
              Gastos por categoría
            </h3>

            {data.category_totals.length === 0 ? (
              <p className="text-center py-8 text-white/30 text-sm">Sin datos para este año</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.category_totals.map(cat => {
                  const colors = CATEGORY_COLORS[cat.category] ?? FALLBACK_COLOR
                  const isNavigable = cat.category !== 'Sin categoría'
                  return (
                    <div
                      key={cat.category}
                      onClick={isNavigable ? () => navigate(`/ledger?category=${cat.category}&year=${year}`) : undefined}
                      className={`${colors.bg} rounded-xl p-4 flex items-center gap-3 ${isNavigable ? 'cursor-pointer hover:brightness-110 transition-all' : ''}`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
                          {cat.category}
                        </p>
                        <p className="text-white text-base font-bold mt-0.5 leading-tight">
                          {formatCLP(cat.total)}
                        </p>
                      </div>
                      <p className="text-xs text-white/35 flex-shrink-0">
                        {cat.transactions} mov.
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
