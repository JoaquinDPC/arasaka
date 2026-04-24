import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { api } from '../api/client'
import { formatCLP, formatPct } from '../lib/formatters'
import { CATEGORY_COLORS } from '../lib/constants'
import Spinner from '../components/Spinner'

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: new Date(2026, i, 1).toLocaleDateString('es-CL', { month: 'long' }),
}))

const YEARS = [2024, 2025, 2026]

function barFill(pctUsed) {
  if (!pctUsed)       return '#818cf8'
  if (pctUsed >= 1.0) return '#f43f5e'
  if (pctUsed >= 0.8) return '#fbbf24'
  return '#34d399'
}

function textColor(pctUsed) {
  if (!pctUsed)       return 'text-indigo-300'
  if (pctUsed >= 1.0) return 'text-rose-400'
  if (pctUsed >= 0.8) return 'text-amber-400'
  return 'text-emerald-400'
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'rgba(24, 10, 56, 0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '0.75rem', padding: '0.75rem', fontSize: '0.875rem' }}>
      <p className="font-semibold text-white mb-1">{d.category}</p>
      <p className="text-white/60">Gastado: <span className="font-medium text-white">{formatCLP(d.total)}</span></p>
      {d.budget > 0 && (
        <>
          <p className="text-white/60">Presupuesto: <span className="font-medium text-white">{formatCLP(d.budget)}</span></p>
          <p className={`font-medium mt-0.5 ${textColor(d.pct_used)}`}>{formatPct(d.pct_used)} usado</p>
        </>
      )}
    </div>
  )
}

const selectClass = 'glass-input rounded-xl px-3 py-2 text-sm'

export default function Categories() {
  const navigate = useNavigate()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const [data, setData]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.budgetVsActual(month, year)
      .then(res => setData(Array.isArray(res) ? res : (res?.categories ?? [])))
      .catch(() => setError('No se pudo conectar al servidor'))
      .finally(() => setLoading(false))
  }, [month, year])

  const chartData = data.filter(d => d.total > 0)
  const active = data.filter(d => d.total > 0)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

      {/* Header + filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-white mr-auto">Categorías</h2>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className={selectClass}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))} className={selectClass}>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <Spinner />}
      {error && <div className="text-center py-16 text-white/50">{error}</div>}

      {!loading && !error && (
        <>
          {/* Horizontal bar chart */}
          {chartData.length > 0 && (
            <div className="glass rounded-2xl p-5 sm:p-6 mb-6">
              <h3 className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-5">
                Gasto vs presupuesto
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40)}>
                <BarChart
                  layout="vertical"
                  data={chartData}
                  margin={{ top: 0, right: 16, left: 90, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="category"
                    tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.55)' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="budget" fill="rgba(255,255,255,0.1)" radius={[0, 4, 4, 0]} barSize={7} />
                  <Bar dataKey="total"  radius={[0, 4, 4, 0]} barSize={7}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={barFill(entry.pct_used)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map(cat => {
              const colors  = CATEGORY_COLORS[cat.category] ?? { bg: 'bg-slate-500/15', text: 'text-slate-300', dot: 'bg-slate-400' }
              const hasBudget = (cat.budget ?? 0) > 0
              const pct       = cat.pct_used ?? 0

              return (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => navigate(`/ledger?category=${cat.category}&month=${month}`)}
                  className="glass rounded-2xl p-5 text-left hover:bg-white/10 transition-colors cursor-pointer w-full"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${colors.text} ${colors.bg}`}>
                      {cat.category}
                    </span>
                  </div>

                  <p className="text-2xl font-bold text-white mb-3">{formatCLP(cat.total)}</p>

                  {hasBudget ? (
                    <>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 1.0 ? 'bg-rose-500' : pct >= 0.8 ? 'bg-amber-400' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(pct * 100, 100)}%` }}
                        />
                      </div>
                      <p className={`text-xs font-medium ${textColor(pct)}`}>
                        {formatPct(pct)} del límite
                        {pct >= 1.0 && ' ⚠'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-white/30">Sin presupuesto definido</p>
                  )}

                  {cat.transactions > 0 && (
                    <p className="text-xs text-white/25 mt-1">{cat.transactions} transacciones</p>
                  )}
                </button>
              )
            })}
          </div>

          {active.length === 0 && (
            <div className="text-center py-16 text-white/30 text-sm">
              No hay gastos para este período
            </div>
          )}
        </>
      )}
    </div>
  )
}
