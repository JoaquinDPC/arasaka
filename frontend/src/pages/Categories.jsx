import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../api/client'
import { formatCLP, formatPct, monthName } from '../lib/formatters'
import { CATEGORY_COLORS } from '../lib/constants'
import Spinner from '../components/Spinner'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const YEARS  = [2024, 2025, 2026]
const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const CAT_PIE_COLORS = {
  Personal: '#8b5cf6', Casa: '#eab308', Otros: '#64748b',
  Salud: '#22c55e', Transporte: '#f59e0b', Suscripciones: '#6366f1',
  Gustos: '#ec4899', Mascota: '#f97316', Inversion: '#06b6d4', Patrimonio: '#94a3b8',
}
const DEFAULT_PIE_COLOR = '#4b5563'

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', padding: '0.6rem 0.9rem', fontSize: '0.8rem' }}>
      <p className="font-semibold text-white">{d.name}</p>
      <p style={{ color: d.payload.fill }}>{formatCLP(d.value)}</p>
    </div>
  )
}

const FALLBACK_COLORS = { dot: 'bg-slate-400', text: 'text-slate-300', bg: 'bg-slate-500/15' }

export default function Categories() {
  const navigate  = useNavigate()
  const now       = new Date()
  const [period, setPeriod] = useState('month')
  const [month, setMonth]   = useState(now.getMonth() + 1)
  const [year, setYear]     = useState(now.getFullYear())
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = { year }
    if (period === 'month') params.month = month
    api.budgetVsActual(params.month ?? month, params.year)
      .then(res => {
        const arr = Array.isArray(res) ? res : (res?.categories ?? [])
        setData(arr.filter(d => d.total > 0))
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [period, month, year])

  const total = data.reduce((s, d) => s + d.total, 0)
  const maxTotal = data.reduce((m, d) => Math.max(m, d.total), 0)

  const pieData = data.map(d => ({
    name:  d.category,
    value: d.total,
    fill:  CAT_PIE_COLORS[d.category] ?? DEFAULT_PIE_COLOR,
  }))

  const subtitle = period === 'month'
    ? `${monthName(month)} ${year} · ${formatCLP(total)} total`
    : `${year} · ${formatCLP(total)} total`

  function prevPeriod() {
    if (period === 'month') {
      if (month === 1) { setMonth(12); setYear(y => y - 1) }
      else setMonth(m => m - 1)
    } else {
      setYear(y => y - 1)
    }
  }
  function nextPeriod() {
    if (period === 'month') {
      if (month === 12) { setMonth(1); setYear(y => y + 1) }
      else setMonth(m => m + 1)
    } else {
      setYear(y => y + 1)
    }
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Gastos por Categoría</h1>
          <p className="text-white/35 text-sm mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period tabs */}
          <div className="flex rounded-xl overflow-hidden border border-white/10">
            {[
              { key: 'month', label: 'Mes' },
              { key: 'year',  label: 'Año' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setPeriod(t.key)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === t.key
                    ? 'bg-emerald-500 text-white'
                    : 'text-white/40 hover:text-white/70 bg-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {/* Period navigator */}
          <div className="flex items-center gap-2">
            <button onClick={prevPeriod} className="w-7 h-7 flex items-center justify-center rounded-lg glass text-white/40 hover:text-white transition-colors text-base">‹</button>
            <span className="text-white/60 text-sm min-w-[90px] text-center">
              {period === 'month' ? `${MONTH_ABBR[month - 1]} ${year}` : year}
            </span>
            <button onClick={nextPeriod} className="w-7 h-7 flex items-center justify-center rounded-lg glass text-white/40 hover:text-white transition-colors text-base">›</button>
          </div>
        </div>
      </div>

      {loading ? <Spinner /> : (
        data.length === 0 ? (
          <p className="text-center py-16 text-white/25 text-sm">Sin gastos para este período</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Category list */}
            <div className="glass rounded-2xl p-5">
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-4">
                Categorías — haz clic para ver detalle
              </p>
              <div className="space-y-3">
                {data.map(cat => {
                  const colors = CATEGORY_COLORS[cat.category] ?? FALLBACK_COLORS
                  const barW = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0
                  const pct = total > 0 ? cat.total / total : 0
                  return (
                    <button
                      key={cat.category}
                      onClick={() => navigate(`/movimientos?category=${cat.category}`)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                          <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>
                            {cat.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-white/35">{formatPct(pct)}</span>
                          <span className="text-xs font-bold text-white/70 tabular">{formatCLP(cat.total)}</span>
                        </div>
                      </div>
                      <div className="h-1 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all group-hover:brightness-125"
                          style={{
                            width: `${barW}%`,
                            background: CAT_PIE_COLORS[cat.category] ?? DEFAULT_PIE_COLOR,
                          }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Donut chart */}
            <div className="glass rounded-2xl p-5">
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-4">
                Distribución
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="45%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconType="square"
                    iconSize={9}
                    wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', paddingLeft: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      )}
    </div>
  )
}
