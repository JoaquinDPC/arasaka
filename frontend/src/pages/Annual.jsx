import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import { formatCLP, formatPct } from '../lib/formatters'
import { CATEGORY_COLORS } from '../lib/constants'
import Spinner from '../components/Spinner'

const YEARS = [2024, 2025, 2026]
const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const FALLBACK_COLORS = { dot: 'bg-slate-400', text: 'text-slate-300' }

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '0.75rem', fontSize: '0.8125rem' }}>
      <p className="font-semibold text-white mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.fill }} className="leading-snug">
          {p.name}: {formatCLP(p.value)}
        </p>
      ))}
    </div>
  )
}

function yFmt(v) {
  if (!v) return '0'
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  return `$${(v / 1_000).toFixed(0)}k`
}

function InsightRow({ icon, label, value, valueColor = 'text-white/80' }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2.5">
        <span className="text-base">{icon}</span>
        <div>
          <p className="text-xs font-medium text-white/60">{label}</p>
        </div>
      </div>
      <span className={`text-sm font-bold tabular ${valueColor}`}>{value}</span>
    </div>
  )
}

export default function Annual() {
  const [year, setYear]       = useState(new Date().getFullYear())
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.annual(year)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year])

  const chartData = useMemo(() => {
    const trendMap = Object.fromEntries(
      (data?.monthly_trend ?? []).map(m => [m.month, m])
    )
    return Array.from({ length: 12 }, (_, i) => {
      const m = trendMap[i + 1]
      return {
        name:      MONTH_ABBR[i],
        Ingresos:  m?.income   ?? 0,
        Egresos:   m?.expenses ?? 0,
      }
    })
  }, [data])

  const kpis = data?.kpis ?? {}
  const netSavings = (kpis.income_ytd ?? 0) - (kpis.expenses_ytd ?? 0) - (kpis.investments_ytd ?? 0)

  const months = data?.monthly_trend ?? []
  const bestMonth = months.reduce(
    (best, m) => (m.balance > (best?.balance ?? -Infinity) ? m : best),
    null
  )
  const worstMonth = months.filter(m => m.expenses > 0).reduce(
    (worst, m) => (m.expenses > (worst?.expenses ?? -Infinity) ? m : worst),
    null
  )

  const top10 = (data?.top_expenses ?? []).slice(0, 10)
  const installments = data?.active_installments ?? []

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Vista Anual</h1>
          <p className="text-white/35 text-sm mt-0.5">Resumen, proyecciones e insights</p>
        </div>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="glass-input rounded-xl px-3 py-2 text-sm"
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: `Ingresos ${year}`,  value: formatCLP(kpis.income_ytd ?? 0),     color: 'text-emerald-400' },
              { label: `Egresos ${year}`,   value: formatCLP(kpis.expenses_ytd ?? 0),   color: 'text-rose-400'    },
              { label: 'Inversiones',        value: formatCLP(kpis.investments_ytd ?? 0), color: 'text-cyan-400'   },
              { label: 'Balance neto',       value: formatCLP(netSavings),                color: netSavings >= 0 ? 'text-violet-300' : 'text-rose-400' },
            ].map(k => (
              <div key={k.label} className="glass rounded-xl p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">{k.label}</p>
                <p className={`text-lg font-bold tabular ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Main two columns */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left: chart */}
            <div className="glass rounded-2xl p-5">
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-4">
                Ingresos vs Egresos — {year}
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={yFmt} tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.25)' }} tickLine={false} axisLine={false} width={44} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', paddingTop: 8 }} />
                  <Bar dataKey="Ingresos" fill="#34d399" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Egresos"  fill="#f43f5e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-4">
              {/* Top 10 expenses */}
              <div className="glass rounded-2xl p-5">
                <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-3">
                  Top 10 gastos del año
                </p>
                {top10.length === 0 ? (
                  <p className="text-center py-4 text-white/25 text-sm">Sin datos</p>
                ) : (
                  <div className="space-y-2">
                    {top10.map((tx, i) => {
                      const colors = CATEGORY_COLORS[tx.category] ?? FALLBACK_COLORS
                      return (
                        <div key={tx.id ?? i} className="flex items-center gap-2.5">
                          <span className="text-white/20 text-[10px] w-4 text-right flex-shrink-0">{i + 1}</span>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/70 truncate leading-tight">{tx.description}</p>
                            <p className="text-[10px] text-white/30 uppercase leading-tight">{tx.category}</p>
                          </div>
                          <span className="text-xs font-semibold text-rose-400 tabular flex-shrink-0">
                            -{formatCLP(tx.amount)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Insights */}
              <div className="glass rounded-2xl p-5">
                <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-2">
                  Insights económicos
                </p>
                <InsightRow
                  icon="📊"
                  label="Tasa de ahorro"
                  value={formatPct(kpis.investment_rate ?? 0)}
                  valueColor={(kpis.investment_rate ?? 0) >= 0.1 ? 'text-emerald-400' : 'text-rose-400'}
                />
                <InsightRow
                  icon="🏠"
                  label="Costo de vida / Ingresos"
                  value={formatPct(kpis.cost_of_living ?? 0)}
                  valueColor={(kpis.cost_of_living ?? 0) <= 0.7 ? 'text-emerald-400' : (kpis.cost_of_living ?? 0) <= 0.9 ? 'text-amber-400' : 'text-rose-400'}
                />
                <InsightRow
                  icon="📈"
                  label="% Invertido"
                  value={formatPct(kpis.investment_rate ?? 0)}
                  valueColor="text-cyan-400"
                />
                <InsightRow
                  icon="⬆"
                  label="Mejor mes"
                  value={bestMonth ? MONTH_ABBR[(bestMonth.month ?? 1) - 1] : '—'}
                  valueColor="text-emerald-400"
                />
                <InsightRow
                  icon="⬇"
                  label="Mes más caro"
                  value={worstMonth ? MONTH_ABBR[(worstMonth.month ?? 1) - 1] : '—'}
                  valueColor="text-rose-400"
                />
                <InsightRow
                  icon="🔮"
                  label={`Proyección ${year}`}
                  value={formatCLP(data?.projection ?? 0)}
                  valueColor="text-violet-300"
                />
              </div>

              {/* Active installments */}
              {installments.length > 0 && (
                <div className="glass rounded-2xl p-5">
                  <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-3">
                    Cuotas de tarjeta activas
                  </p>
                  <div className="space-y-2">
                    {installments.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-white/65 truncate">{item.description}</p>
                          <p className="text-[10px] text-white/30">
                            {item.installment_current}/{item.installment_total} cuotas
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-rose-400 tabular">{formatCLP(item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {installments.length === 0 && (
                <div className="glass rounded-2xl p-5">
                  <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-2">
                    Cuotas de tarjeta activas
                  </p>
                  <p className="text-xs text-white/25 py-2">
                    Sin cuotas activas. Al agregar movimientos con cuotas aparecerán aquí.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
