import { useState, useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { api } from '../api/client'
import { formatCLP, formatDate } from '../lib/formatters'
import { getCatColor, MONTHS, MONTH_ABBR } from '../lib/constants'
import Spinner from '../components/Spinner'

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{ background: '#111114', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ fontWeight: 600, color: 'var(--text)' }}>{d.name}</p>
      <p style={{ color: d.payload.fill }}>{formatCLP(d.value)}</p>
    </div>
  )
}

export default function Categories() {
  const now = new Date()
  const [period, setPeriod] = useState('month')
  const [year, setYear]     = useState(now.getFullYear())
  const [month, setMonth]   = useState(now.getMonth() + 1)
  const [data, setData]     = useState([])
  const [loading, setLoading]  = useState(true)
  const [selCat, setSelCat]    = useState(null)
  const [catMovs, setCatMovs]  = useState([])
  const [catLoading, setCatLoading] = useState(false)

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

  useEffect(() => {
    if (!selCat) { setCatMovs([]); return }
    setCatLoading(true)
    const params = { category: selCat, year }
    if (period === 'month') params.month = month
    api.transactions(params)
      .then(d => setCatMovs(Array.isArray(d) ? d : (d?.transactions ?? [])))
      .catch(() => setCatMovs([]))
      .finally(() => setCatLoading(false))
  }, [selCat, period, month, year])

  function prevPeriod() {
    if (period === 'month') { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }
    else setYear(y => y - 1)
  }
  function nextPeriod() {
    if (period === 'month') { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }
    else setYear(y => y + 1)
  }

  const total    = data.reduce((s, d) => s + d.total, 0)
  const maxTotal = data.reduce((m, d) => Math.max(m, d.total), 0)
  const pieData  = data.map(d => ({ name: d.category, value: d.total, fill: getCatColor(d.category) }))

  const periodLabel = period === 'month' ? `${MONTHS[month - 1]} ${year}` : `${year}`

  return (
    <div className="fade">
      <div className="ph" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="ph-title">Gastos por Categoría</div>
          <div className="ph-sub">{periodLabel} · {formatCLP(total)} total</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="toggle" style={{ width: 'auto' }}>
            {[['month','Mes'],['year','Año']].map(([p, l]) => (
              <button key={p} className={`tbtn${period === p ? ' ti' : ''}`} onClick={() => setPeriod(p)} style={{ padding: '7px 16px' }}>{l}</button>
            ))}
          </div>
          <button className="nav-arrow" onClick={prevPeriod}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 100, textAlign: 'center' }}>
            {period === 'month' ? `${MONTH_ABBR[month - 1]} ${year}` : year}
          </span>
          <button className="nav-arrow" onClick={nextPeriod}>›</button>
        </div>
      </div>

      {loading ? <Spinner /> : data.length === 0 ? (
        <div className="empty-msg" style={{ marginTop: 80 }}>Sin egresos en este período</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14, marginBottom: 14 }}>
            {/* Category list */}
            <div className="card">
              <div className="card-title">Categorías — haz clic para ver detalle</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.map(cat => {
                  const p = total > 0 ? +(cat.total / total * 100).toFixed(1) : 0
                  const active = selCat === cat.category
                  const color = getCatColor(cat.category)
                  return (
                    <div key={cat.category}
                      onClick={() => setSelCat(active ? null : cat.category)}
                      style={{ padding: '10px 12px', background: active ? color + '1a' : 'var(--surface2)', border: `1px solid ${active ? color + '55' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', transition: 'all .15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: active ? color : 'var(--text)', letterSpacing: '0.04em' }}>{cat.category}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p}%</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: color, fontWeight: 500 }}>{formatCLP(cat.total)}</span>
                        </div>
                      </div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p}%`, background: color, borderRadius: 2, opacity: .75 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Donut */}
            <div className="card">
              <div className="card-title">Distribución</div>
              <ResponsiveContainer width="100%" height={Math.min(data.length * 26 + 80, 320)}>
                <PieChart>
                  <Pie data={pieData} cx="45%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <Legend layout="vertical" align="right" verticalAlign="middle"
                    wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 8 }} iconSize={9} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Drill-down */}
          {selCat && (
            <div className="card fade" key={selCat}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: getCatColor(selCat) }} />
                <div className="card-title" style={{ marginBottom: 0, color: getCatColor(selCat) }}>{selCat}</div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
                  {catMovs.filter(m => m.flow !== 'INCOME').length} movimientos · {formatCLP(data.find(d => d.category === selCat)?.total ?? 0)}
                </span>
                <button onClick={() => setSelCat(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
              {catLoading ? <Spinner /> : (
                <div className="tbl-wrap" style={{ border: 'none', background: 'transparent' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Key</th>
                        <th>Descripción</th>
                        <th style={{ textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...catMovs].filter(m => m.flow !== 'INCOME').sort((a, b) => b.date.localeCompare(a.date)).map(m => (
                        <tr key={m.id}>
                          <td className="td-date">{formatDate(m.date)}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>{m.asset ?? '—'}</td>
                          <td>{m.description}</td>
                          <td className="td-mono" style={{ textAlign: 'right', color: 'var(--red)', whiteSpace: 'nowrap' }}>-{formatCLP(m.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
