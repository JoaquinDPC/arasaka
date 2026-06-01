import { useState, useEffect, useMemo } from 'react'
import { api } from '../api/client'
import { formatCLP, formatDate } from '../lib/formatters'
import { getCatColor, MONTHS, getBankLabel } from '../lib/constants'
import Spinner from '../components/Spinner'
import CatIcon from '../components/CatIcon'
import { useAccount } from '../context/AccountContext'
import { InfoTooltip, InsightExplain } from '../components/InfoTooltip'
import CCBillSection from '../components/CCBillSection'

function fmtDate(ds) {
  const d = new Date(ds + 'T12:00')
  const today = new Date()
  const diff = Math.floor((today - d) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  return formatDate(ds)
}

function groupByDate(txs) {
  const groups = []
  let cur = null
  ;[...txs].forEach(tx => {
    const date = tx.date?.slice(0, 10) ?? ''
    if (date !== cur) { cur = date; groups.push({ date, items: [] }) }
    groups[groups.length - 1].items.push(tx)
  })
  return groups
}

function BudgetRow({ cat, spent, budget }) {
  const color = getCatColor(cat)
  const over = budget > 0 && spent > budget
  const pct = budget > 0 ? Math.min(spent / budget * 100, 100) : 0
  const barColor = over ? 'var(--red)' : pct > 80 ? '#d4884c' : color

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <CatIcon name={cat} size={13} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{cat.toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {budget > 0 && (
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: over ? 'var(--red)' : 'var(--text-dim)' }}>
              {over ? `+${formatCLP(spent - budget)}` : `${Math.round(pct)}%`}
            </span>
          )}
          <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, color: over ? 'var(--red)' : color }}>
            {formatCLP(spent)}
          </span>
        </div>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: budget > 0 ? `${pct}%` : '100%', background: budget > 0 ? barColor : color + '40', borderRadius: 2, transition: 'width .4s ease' }} />
      </div>
      {budget > 0 && (
        <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 3 }}>
          límite {formatCLP(budget)}
        </div>
      )}
    </div>
  )
}

function MovDetail({ tx, onClose }) {
  const tags = tx.tags ?? []
  return (
    <div className="overlay fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <CatIcon name={tx.tags?.[0]} size={18} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{tx.description}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{formatDate(tx.date)}</div>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600, color: tx.flow === 'INCOME' ? 'var(--green)' : 'var(--red)' }}>
            {tx.flow === 'INCOME' ? '+' : '-'}{formatCLP(tx.amount)}
          </div>
        </div>
        {tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {tags.map(t => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 9px', background: getCatColor(t) + '22', color: getCatColor(t), borderRadius: 5, fontWeight: 700 }}>
                <CatIcon name={t} size={11} />
                {t}
              </span>
            ))}
          </div>
        )}
        {tx.notes && (
          <div style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.5, color: 'var(--text)', background: 'var(--surface2)', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--border)' }}>
            {tx.notes}
          </div>
        )}
        {tx.cc_bill_id && <CCBillSection billId={tx.cc_bill_id} />}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear]   = useState(now.getFullYear())
  const { selectedId, selectedAccount } = useAccount()

  const [kpis, setKpis]             = useState(null)
  const [tagSpend, setTagSpend]     = useState([])
  const [recent, setRecent]         = useState([])
  const [installments, setInstallments] = useState([])
  const [loading, setLoading]       = useState(true)
  const [selTx, setSelTx]           = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.kpis(year, selectedId),
      api.tagSpending({ month, year, ...(selectedId ? { account_id: selectedId } : {}) }),
      api.transactions({ month, year, limit: 30, account_id: selectedId ?? undefined }),
      api.installments(),
    ])
      .then(([kpiData, tags, txData, instData]) => {
        setKpis(kpiData)
        setTagSpend(Array.isArray(tags) ? tags.filter(t => t.total > 0) : [])
        setRecent(Array.isArray(txData) ? txData : (txData?.transactions ?? []))
        setInstallments(Array.isArray(instData) ? instData : [])
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

  const netWorth   = kpis?.net_worth ?? 0
  const incomeYtd  = kpis?.income_ytd ?? 0
  const expensesYtd = kpis?.expenses_ytd ?? 0
  const investYtd  = kpis?.investments_ytd ?? 0
  const pctInv     = incomeYtd > 0 ? +(investYtd / incomeYtd * 100).toFixed(1) : 0

  const topBudgets = useMemo(() =>
    tagSpend
      .filter(t => !['Sueldo', 'Devolucion'].includes(t.tag))
      .slice(0, 6)
  , [tagSpend])

  const grouped = useMemo(() => groupByDate(recent), [recent])

  return (
    <div className="fade">
      {/* ── HERO ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center' }}>
          {selectedAccount ? `${getBankLabel(selectedAccount.bank_id)} · ${selectedAccount.name}` : 'Patrimonio total'}
          {!selectedAccount && (
            <InfoTooltip title="Patrimonio total" width={300}>
              <InsightExplain
                desc={<>El <strong style={{ color: 'var(--text)' }}>valor total acumulado</strong> de tu vida financiera: saldo en cuentas, inversiones y todo lo registrado.</>}
                formula="Saldo inicial + Ingresos − Egresos"
                note="Incluye todos los movimientos históricos desde el inicio de tu registro."
              />
            </InfoTooltip>
          )}
        </div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 'clamp(32px,6vw,48px)', fontWeight: 700, letterSpacing: '-0.02em', color: netWorth >= 0 ? 'var(--accent)' : 'var(--red)', lineHeight: 1 }}>
          {formatCLP(netWorth)}
        </div>
      </div>

      {/* ── ANNUAL STATS ── */}
      <div className="stats" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-lbl">Entradas {year}</div>
          <div className="stat-val" style={{ color: 'var(--green)', fontSize: 17 }}>{formatCLP(incomeYtd)}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Salidas {year}</div>
          <div className="stat-val" style={{ color: 'var(--red)', fontSize: 17 }}>{formatCLP(expensesYtd)}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Inversión {year}</div>
          <div className="stat-val" style={{ color: '#4cb8af', fontSize: 17 }}>{formatCLP(investYtd)}</div>
          <div className="stat-delta"><span style={{ color: '#4cb8af', fontWeight: 700 }}>{pctInv}%</span> de ingresos</div>
        </div>
        <div className="stat" style={{ borderColor: 'rgba(201,168,76,.25)' }}>
          <div className="stat-lbl" style={{ display: 'flex', alignItems: 'center' }}>
            Balance neto
            <InfoTooltip title="Balance neto" width={280}>
              <InsightExplain
                desc="Ingresos del año menos egresos del año. Positivo significa que gastaste menos de lo que ganaste."
                formula="Ingresos YTD − Egresos YTD"
                note="No confundir con patrimonio: el balance neto es solo el flujo del período, no tu riqueza total."
              />
            </InfoTooltip>
          </div>
          <div className="stat-val" style={{ color: incomeYtd - expensesYtd >= 0 ? 'var(--accent)' : 'var(--red)', fontSize: 17 }}>
            {formatCLP(incomeYtd - expensesYtd)}
          </div>
        </div>
      </div>

      {/* ── ACTIVE INSTALLMENTS ── */}
      {installments.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 10 }}>
            Cuotas de tarjeta activas
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {installments.map(inst => {
              const cur = inst.installment_current ?? 1
              const tot = inst.installment_total ?? 1
              const remaining = tot - cur
              const pct = Math.round((cur / tot) * 100)
              return (
                <div key={inst.id} style={{ minWidth: 200, maxWidth: 220, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px', flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8, color: 'var(--text)' }}>
                    {inst.description}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--red)', marginBottom: 2 }}>
                    {formatCLP(inst.amount)}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-dim)' }}>/mes</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
                    cuota {cur}/{tot} · {remaining} restante{remaining !== 1 ? 's' : ''}
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--surface2)' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MONTH NAV ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Detalle mensual
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="nav-arrow" onClick={prevMonth}>‹</button>
          <span style={{ fontSize: 13, fontWeight: 600, minWidth: 120, textAlign: 'center' }}>
            {MONTHS[month - 1]} {year}
          </span>
          <button className="nav-arrow" onClick={nextMonth}>›</button>
        </div>
      </div>

      {loading ? <Spinner /> : (
        /* ── TWO-COLUMN: budget bars + movements ── */
        <div className="home-grid">
          {/* Budget bars */}
          <div className="card" style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Top gastos</div>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{MONTHS[month - 1]}</span>
            </div>
            {topBudgets.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {topBudgets.map(b => (
                  <BudgetRow key={b.tag} cat={b.tag} spent={b.total ?? 0} budget={0} />
                ))}
              </div>
            ) : (
              <div className="empty-msg" style={{ padding: '32px 0' }}>Sin movimientos este mes</div>
            )}
          </div>

          {/* Monthly movements */}
          <div className="card" style={{ minWidth: 0, maxHeight: 560, overflowY: 'auto' }}>
            <div className="card-title">Movimientos — {MONTHS[month - 1]}</div>
            {grouped.length > 0 ? (
              grouped.map(g => (
                <div key={g.date} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, paddingBottom: 5, borderBottom: '1px solid var(--border)' }}>
                    {fmtDate(g.date)}
                  </div>
                  {g.items.map(tx => {
                    const iconName = tx.tags?.[0]
                    const color = getCatColor(iconName)
                    const tags = tx.tags ?? []
                    return (
                      <div
                        key={tx.id}
                        onClick={() => setSelTx(tx)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderRadius: 7, cursor: 'pointer', transition: 'background var(--t)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width: 32, height: 32, borderRadius: 7, background: color + '22', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CatIcon name={iconName} size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                          <div style={{ display: 'flex', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                            {tags.slice(0, 3).map(t => (
                              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '1px 6px', background: getCatColor(t) + '22', color: getCatColor(t), borderRadius: 3, fontWeight: 700 }}>
                                <CatIcon name={t} size={9} />
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: tx.flow === 'INCOME' ? 'var(--green)' : 'var(--red)' }}>
                            {tx.flow === 'INCOME' ? '+' : '-'}{formatCLP(tx.amount)}
                          </div>
                          {tx.running_balance != null && (
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
                              {formatCLP(tx.running_balance)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            ) : (
              <div className="empty-msg">Sin movimientos en {MONTHS[month - 1]}</div>
            )}
          </div>
        </div>
      )}

      {selTx && <MovDetail tx={selTx} onClose={() => setSelTx(null)} />}
    </div>
  )
}
