import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../api/client'
import { formatCLP } from '../lib/formatters'
import { MONTH_ABBR } from '../lib/constants'
import Spinner from '../components/Spinner'
import CatIcon from '../components/CatIcon'
import { useAccount } from '../context/AccountContext'

function InsightRow({ icon, label, value, sub, good }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <span style={{ fontSize: 15, width: 22, textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: good ? 'var(--green)' : 'var(--red)', whiteSpace: 'nowrap' }}>
        {value}
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const income   = payload.find(p => p.dataKey === 'Ingresos')?.value ?? 0
  const expenses = payload.find(p => p.dataKey === 'Egresos')?.value ?? 0
  const savings  = income - expenses
  return (
    <div style={{ background: '#111114', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font)' }}>
      <p style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.fill }}>{p.name}: {formatCLP(p.value)}</p>
      ))}
      {income > 0 && (
        <p style={{ color: savings >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 5, paddingTop: 5, borderTop: '1px solid rgba(255,255,255,.08)' }}>
          Ahorro: {savings >= 0 ? '+' : ''}{formatCLP(savings)}
        </p>
      )}
    </div>
  )
}

export default function Annual() {
  const { selectedId } = useAccount()
  const [year, setYear]       = useState(new Date().getFullYear())
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.annual(year, selectedId).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [year, selectedId])

  const chartData = useMemo(() => {
    const trendMap = Object.fromEntries((data?.monthly_trend ?? []).map(m => [m.month, m]))
    return Array.from({ length: 12 }, (_, i) => {
      const m = trendMap[i + 1]
      return { name: MONTH_ABBR[i], Ingresos: m?.income ?? 0, Egresos: m?.expenses ?? 0 }
    })
  }, [data])

  const kpis = data?.kpis ?? {}
  const income      = kpis.income_ytd      ?? 0
  const expenses    = kpis.expenses_ytd    ?? 0
  const investments = kpis.investments_ytd ?? 0
  const netWorth    = kpis.net_worth       ?? 0
  const balNeto     = income - expenses

  const months = data?.monthly_trend ?? []
  const monthFlows = months.map(m => (m.income ?? 0) - (m.expenses ?? 0))
  const completedM  = months.filter(m => (m.income ?? 0) > 0 || (m.expenses ?? 0) > 0).length
  const bestIdx     = monthFlows.indexOf(Math.max(...monthFlows, -Infinity))
  const worstIdx    = monthFlows.indexOf(Math.min(...monthFlows, Infinity))
  const avgIn       = completedM > 0 ? income / completedM : 0
  const avgEg       = completedM > 0 ? expenses / completedM : 0
  const now         = new Date()
  const remMonths   = year === now.getFullYear() ? 11 - now.getMonth() : 0
  const projSaldo   = netWorth + (avgIn - avgEg) * remMonths

  const pctAhorro   = income > 0 ? +(balNeto / income * 100).toFixed(1) : 0
  const pctVida     = income > 0 ? +(expenses / income * 100).toFixed(1) : 0
  const pctInvPct   = income > 0 ? +(investments / income * 100).toFixed(1) : 0

  const top10 = [...(data?.top_expenses ?? [])].sort((a, b) => b.amount - a.amount).slice(0, 10)
  const catSummary = data?.categories ?? []
  const MONTHS_ARR = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return (
    <div className="fade">
      <div className="ph ph-row">
        <div>
          <div className="ph-title">Vista Anual</div>
          <div className="ph-sub">Resumen, proyecciones e insights</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="nav-arrow" onClick={() => setYear(y => y - 1)}>‹</button>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{year}</span>
          <button className="nav-arrow" onClick={() => setYear(y => y + 1)}>›</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><div className="stat-lbl">Ingresos {year}</div><div className="stat-val" style={{ color: 'var(--green)', fontSize: 17 }}>{formatCLP(income)}</div></div>
        <div className="stat"><div className="stat-lbl">Egresos {year}</div><div className="stat-val" style={{ color: 'var(--red)', fontSize: 17 }}>{formatCLP(expenses)}</div></div>
        <div className="stat"><div className="stat-lbl">Inversiones</div><div className="stat-val" style={{ color: '#4cb8af', fontSize: 17 }}>{formatCLP(investments)}</div></div>
        <div className="stat" style={{ borderColor: 'rgba(201,168,76,.25)' }}><div className="stat-lbl">Balance neto</div><div className="stat-val" style={{ color: balNeto >= 0 ? 'var(--accent)' : 'var(--red)', fontSize: 17 }}>{formatCLP(balNeto)}</div></div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Full-year bar chart */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">Ingresos vs Egresos — {year}</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barCategoryGap="35%" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'Space Grotesk' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#888', fontFamily: 'Space Grotesk' }} />
                <Bar dataKey="Ingresos" fill="rgba(76,175,125,0.55)" stroke="rgba(76,175,125,.9)" strokeWidth={1} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Egresos" fill="rgba(224,92,92,0.55)" stroke="rgba(224,92,92,.9)" strokeWidth={1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="charts">
            {/* Top 10 */}
            <div className="card">
              <div className="card-title">Top gastos del año</div>
              {top10.length > 0 ? (
                <ul className="top-list">
                  {top10.map((t, i) => (
                    <li key={i} className="top-item" style={{ padding: '3px 0' }}>
                      <div className="top-left">
                        <span style={{ width: 18, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                        <CatIcon name={t.category} size={14} style={{ flexShrink: 0 }} />
                        <div>
                          <div className="top-desc">{t.description ?? t.desc ?? '—'}</div>
                          <div className="top-cat">{t.date?.slice(0, 10)} · {t.category}</div>
                        </div>
                      </div>
                      <div className="top-amt">-{formatCLP(t.amount)}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-msg">Sin gastos este año</div>
              )}
            </div>

            {/* Insights */}
            <div className="card">
              <div className="card-title">Insights económicos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <InsightRow icon="%" label="Tasa de ahorro" value={`${pctAhorro}%`}
                  sub={pctAhorro >= 20 ? 'Sobre el 20% — excelente' : 'Por debajo del objetivo del 20%'}
                  good={pctAhorro >= 20} />
                <InsightRow icon="⌂" label="Costo de vida / ingresos" value={`${pctVida}%`}
                  sub={pctVida <= 50 ? 'Bajo control — regla del 50%' : 'Por encima del 50% recomendado'}
                  good={pctVida <= 50} />
                <InsightRow icon="↑" label="% invertido" value={`${pctInvPct}%`}
                  sub={pctInvPct >= 20 ? 'Sobre el 20% — muy bien' : 'Regla del 20% en inversiones'}
                  good={pctInvPct >= 20} />
                {bestIdx >= 0 && months[bestIdx] && (
                  <InsightRow icon="★" label="Mejor mes"
                    value={MONTHS_ARR[months[bestIdx].month - 1] ?? '—'}
                    sub={`Flujo: +${formatCLP(monthFlows[bestIdx])}`}
                    good={true} />
                )}
                {worstIdx >= 0 && months[worstIdx] && (
                  <InsightRow icon="▼" label="Mes más caro"
                    value={MONTHS_ARR[months[worstIdx].month - 1] ?? '—'}
                    sub={`Flujo: ${formatCLP(monthFlows[worstIdx])}`}
                    good={monthFlows[worstIdx] >= 0} />
                )}
                {remMonths > 0 && (
                  <InsightRow icon="→" label={`Proyección ${year}`}
                    value={formatCLP(projSaldo)}
                    sub={`Estimado al 31/12 (${remMonths} meses restantes)`}
                    good={projSaldo >= netWorth} />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
