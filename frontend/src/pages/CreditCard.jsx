import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../api/client'
import { useAccount } from '../context/AccountContext'
import { getCatColor } from '../lib/constants'

const NATIONAL_ID = 'credit_card_nacional_facturados'
const INTL_ID     = 'credit_card_internacional_facturados'

// ── Formatting ────────────────────────────────────────────────────────────

function fmtCLP(n) {
  return `$ ${Math.abs(n).toLocaleString('es-CL')}`
}
function fmtUSD(cents) {
  return `US$ ${(Math.abs(cents) / 100).toFixed(2)}`
}
function fmt(amount, currency) {
  return currency === 'USD' ? fmtUSD(amount) : fmtCLP(amount)
}
function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function periodLabel(isoDate) {
  const [y, m] = isoDate.slice(0, 10).split('-')
  return `${MONTHS_ES[parseInt(m, 10) - 1]} ${y}`
}

function inPeriod(itemDate, periodFrom, periodTo) {
  if (!itemDate || !periodFrom || !periodTo) return true
  const d  = itemDate.slice(0, 10)
  const pf = periodFrom.slice(0, 10)
  const pt = periodTo.slice(0, 10)
  return d >= pf && d <= pt
}

// ── Billing window ────────────────────────────────────────────────────────

function currentBillingWindow(allStmts) {
  const today = new Date().toISOString().slice(0, 10)
  if (!allStmts || allStmts.length === 0) {
    const d = new Date(); d.setDate(d.getDate() - 45)
    return { from: d.toISOString().slice(0, 10), to: today }
  }
  const lastCut = allStmts[0].period_to.slice(0, 10)
  const next = new Date(lastCut); next.setDate(next.getDate() + 1)
  return { from: next.toISOString().slice(0, 10), to: today }
}

// ── Current period movements ──────────────────────────────────────────────

function CurrentPeriodMovements({ transactions, billingWindow, ccAccount }) {
  if (!ccAccount) return null

  const total = transactions.reduce((s, t) => {
    return t.flow === 'INCOME' ? s - t.amount : s + t.amount
  }, 0)

  const sectionLabel = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ ...sectionLabel, marginBottom: 4 }}>Movimientos del período</div>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
            {fmtDate(billingWindow?.from)} – hoy
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontFamily: 'var(--mono)', fontWeight: 700, color: total > 0 ? 'var(--red)' : 'var(--text)', lineHeight: 1 }}>
            {fmtCLP(total)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>{transactions.length} movimiento{transactions.length !== 1 ? 's' : ''}</div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Sin movimientos registrados en este período</div>
          <Link
            to="/movimientos"
            style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
          >
            Agregar en Ledger →
          </Link>
        </div>
      ) : (
        <>
          {transactions.map(t => {
            const isIncome = t.flow === 'INCOME'
            const desc = t.custom_description || t.description
            return (
              <div
                key={t.id}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}
              >
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', flexShrink: 0, minWidth: 42 }}>
                  {fmtDate(t.date)}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {desc}
                </span>
                {t.tags && t.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {t.tags.slice(0, 2).map(tag => {
                      const c = getCatColor(tag)
                      return (
                        <span key={tag} style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '.04em',
                          padding: '1px 5px', borderRadius: 4,
                          background: c + '28', border: `1px solid ${c}44`,
                          color: c,
                        }}>
                          {tag}
                        </span>
                      )
                    })}
                  </div>
                )}
                <span style={{
                  fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, flexShrink: 0,
                  color: isIncome ? 'var(--green)' : 'var(--red)',
                }}>
                  {isIncome ? '+' : '-'}{fmtCLP(t.amount)}
                </span>
              </div>
            )
          })}
          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <Link to="/movimientos" style={{ fontSize: 11, color: 'var(--text-dim)', textDecoration: 'none' }}>
              Agregar en Ledger →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

// ── Period navigator ──────────────────────────────────────────────────────

function PeriodNav({ periods, selected, onChange }) {
  const idx = periods.indexOf(selected)
  const canPrev = idx < periods.length - 1
  const canNext = idx > 0

  const navBtn = {
    width: 32, height: 32, borderRadius: 6,
    border: '1px solid var(--border)', background: 'none',
    color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'var(--t)', flexShrink: 0,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        style={{ ...navBtn, opacity: canPrev ? 1 : 0.2, cursor: canPrev ? 'pointer' : 'default' }}
        onClick={() => canPrev && onChange(periods[idx + 1])}
      >‹</button>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', minWidth: 120, textAlign: 'center' }}>
        {selected ? periodLabel(selected + '-01') : '—'}
      </span>
      <button
        style={{ ...navBtn, opacity: canNext ? 1 : 0.2, cursor: canNext ? 'pointer' : 'default' }}
        onClick={() => canNext && onChange(periods[idx - 1])}
      >›</button>
    </div>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────

function SummaryBar({ stmts }) {
  const nacional = stmts.find(s => s.external_account_id === NATIONAL_ID)
  const intl     = stmts.find(s => s.external_account_id === INTL_ID)

  const hasBoth = nacional && intl

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: hasBoth ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
      gap: 14,
    }}>
      {nacional && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Nacional</div>
          <div style={{ fontSize: 22, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
            {fmtCLP(nacional.total_amount)}
          </div>
          {nacional.due_date && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 5 }}>
              Vence {fmtDate(nacional.due_date)}
            </div>
          )}
        </div>
      )}
      {intl && (
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Internacional</div>
          <div style={{ fontSize: 22, fontFamily: 'var(--mono)', fontWeight: 700, color: '#9b7fd4', lineHeight: 1 }}>
            {fmtUSD(intl.total_amount)}
          </div>
          {intl.due_date && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 5 }}>
              Vence {fmtDate(intl.due_date)}
            </div>
          )}
        </div>
      )}
      {hasBoth && (
        <div className="card" style={{ padding: '16px 20px', borderColor: 'rgba(201,168,76,.25)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>Total CLP estimado</div>
          <div style={{ fontSize: 18, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)', lineHeight: 1 }}>
            {fmtCLP(nacional.total_amount + intl.total_amount)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5 }}>
            incl. USD (sin conversión)
          </div>
        </div>
      )}
    </div>
  )
}

// ── Installment row ───────────────────────────────────────────────────────

function InstallmentRow({ it, currency }) {
  const cur      = it.installment_current ?? 1
  const total    = it.installment_total   ?? 1
  const origAmt  = it.amount
  const monthly  = Math.round(origAmt / total)
  const paid     = monthly * cur
  const pct      = Math.round((cur / total) * 100)
  const remaining = total - cur

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {it.description}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 3 }}>
            {fmtDate(it.date)} · Compra {fmt(origAmt, currency ?? it.currency)}
            {remaining > 0 && (
              <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>· {remaining} cuota{remaining !== 1 ? 's' : ''} restante{remaining !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>
            {fmt(monthly, currency ?? it.currency)}<span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>/mes</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>
            {fmt(paid, currency ?? it.currency)} de {fmt(origAmt, currency ?? it.currency)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width .4s ease' }} />
        </div>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
          {cur}/{total}
        </span>
      </div>
    </div>
  )
}

// ── Active installments panel ─────────────────────────────────────────────

function ActiveInstallmentsPanel({ items }) {
  const [open, setOpen] = useState(true)
  if (!items || items.length === 0) return null

  const sorted = [...items].sort((a, b) => {
    const ra = (a.installment_total ?? 1) - (a.installment_current ?? 1)
    const rb = (b.installment_total ?? 1) - (b.installment_current ?? 1)
    return rb - ra
  })

  const clpItems = sorted.filter(it => it.currency !== 'USD')
  const usdItems = sorted.filter(it => it.currency === 'USD')

  const totalMonthlyCLP = clpItems.reduce((s, it) => {
    return s + Math.round(it.amount / (it.installment_total ?? 1))
  }, 0)
  const totalMonthlyUSD = usdItems.reduce((s, it) => {
    return s + Math.round(it.amount / (it.installment_total ?? 1))
  }, 0)

  return (
    <div className="card" style={{ marginBottom: 20, borderColor: 'rgba(201,168,76,.18)' }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--accent)' }}>
            Cuotas activas
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '.04em',
            padding: '1px 6px', borderRadius: 4,
            background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.25)',
            color: 'var(--accent)', fontFamily: 'var(--mono)',
          }}>
            {items.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {totalMonthlyCLP > 0 && (
            <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
              {fmtCLP(totalMonthlyCLP)}<span style={{ color: 'var(--text-dim)', fontSize: 10 }}>/mes</span>
            </span>
          )}
          {totalMonthlyUSD > 0 && (
            <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
              {fmtUSD(totalMonthlyUSD)}<span style={{ color: 'var(--text-dim)', fontSize: 10 }}>/mes</span>
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{open ? '▾' : '▸'}</span>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          {sorted.map(it => (
            <InstallmentRow key={it.id} it={it} currency={it.currency} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Statement card ────────────────────────────────────────────────────────

function StatementCard({ stmt }) {
  const isIntl  = stmt.external_account_id === INTL_ID
  const label   = isIntl ? 'Tarjeta Internacional' : 'Tarjeta Nacional'
  const accent  = isIntl ? '#9b7fd4' : 'var(--accent)'

  const items        = stmt.items ?? []
  const installments = items.filter(it => it.item_type === 'installment')
  const purchases    = items.filter(it => it.item_type === 'purchase')
  const commissions  = items.filter(it => it.item_type === 'commission')

  const totalInstPaid = installments.reduce((s, it) => {
    const tot = it.installment_total ?? 1
    return s + Math.round(it.amount / tot) * (it.installment_current ?? 1)
  }, 0)
  const totalInstOrig    = installments.reduce((s, it) => s + it.amount, 0)
  const totalPurchases   = purchases.reduce((s, it) => s + it.amount, 0)
  const totalCommissions = commissions.reduce((s, it) => s + it.amount, 0)

  const sectionLabel = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
  }

  const metaLabel = {
    fontSize: 10, fontWeight: 600, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
  }

  const metaValue = {
    fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text)',
  }

  const antBadge = {
    fontSize: 9, fontWeight: 700, letterSpacing: '.04em',
    padding: '1px 5px', borderRadius: 4, flexShrink: 0,
    background: 'rgba(136,136,143,.08)', border: '1px solid rgba(136,136,143,.2)',
    color: 'var(--text-muted)',
  }

  return (
    <div className="card" style={{ borderColor: isIntl ? 'rgba(155,127,212,.25)' : 'rgba(201,168,76,.18)' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: accent, marginBottom: 10 }}>
          {label}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          {/* Total amount */}
          <div>
            <div style={{ fontSize: 28, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
              {fmt(stmt.total_amount, stmt.currency)}
            </div>
          </div>

          {/* Billing cycle metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 16px', alignItems: 'center' }}>
            <span style={metaLabel}>Período</span>
            <span style={metaValue}>{fmtDate(stmt.period_from)} – {fmtDate(stmt.period_to)}</span>

            <span style={metaLabel}>Corte</span>
            <span style={{ ...metaValue, color: accent }}>{fmtDate(stmt.period_to)}</span>

            {stmt.due_date && (
              <>
                <span style={metaLabel}>Vence</span>
                <span style={{ ...metaValue, fontWeight: 600, color: accent }}>{fmtDate(stmt.due_date)}</span>
              </>
            )}
            {stmt.min_payment > 0 && (
              <>
                <span style={metaLabel}>Pago mín.</span>
                <span style={{ ...metaValue, color: 'var(--text-muted)' }}>{fmt(stmt.min_payment, stmt.currency)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Installments */}
      {installments.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ ...sectionLabel, color: 'var(--accent)' }}>Cuotas ({installments.length})</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
              {fmt(totalInstPaid, stmt.currency)} de {fmt(totalInstOrig, stmt.currency)}
            </span>
          </div>
          {installments.map(it => (
            <InstallmentRow key={it.id} it={it} currency={stmt.currency} />
          ))}
        </div>
      )}

      {/* Purchases */}
      {purchases.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={sectionLabel}>Compras ({purchases.length})</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>{fmt(totalPurchases, stmt.currency)}</span>
          </div>
          {purchases.map(it => {
            const outside = !inPeriod(it.date, stmt.period_from, stmt.period_to)
            return (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', flexShrink: 0 }}>{fmtDate(it.date)}</span>
                  {outside && <span style={antBadge}>◂ ant.</span>}
                  <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</span>
                </div>
                <span style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{fmt(it.amount, it.currency)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Commissions */}
      {commissions.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ ...sectionLabel, color: 'var(--red)' }}>Cargos adicionales</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--red)' }}>{fmt(totalCommissions, stmt.currency)}</span>
          </div>
          {commissions.map(it => {
            const outside = !inPeriod(it.date, stmt.period_from, stmt.period_to)
            return (
              <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                  {outside && <span style={antBadge}>◂ ant.</span>}
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</span>
                </div>
                <span style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--red)', flexShrink: 0 }}>{fmt(it.amount, it.currency)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Import panel ──────────────────────────────────────────────────────────

function ImportPanel({ onImported }) {
  const [open, setOpen]         = useState(false)
  const [file, setFile]         = useState(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [linking, setLinking]   = useState(false)
  const [msg, setMsg]           = useState(null)
  const fileRef = useRef(null)
  const { selectedAccount } = useAccount()
  const ccAccount = selectedAccount?.type === 'Tarjeta de crédito' ? selectedAccount : null
  const hasStoredPassword = ccAccount?.settings?.pdf_password !== undefined && ccAccount?.settings?.pdf_password !== ''

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('password', password)
      if (ccAccount) fd.append('account_id', String(ccAccount.id))
      const res = await api.ccImportPDF(fd)
      setMsg({ ok: true, text: `${res.imported} ítems importados` })
      setFile(null)
      setPassword('')
      if (fileRef.current) fileRef.current.value = ''
      onImported()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function handleLink() {
    setLinking(true)
    setMsg(null)
    try {
      await api.ccLinkPayments()
      setMsg({ ok: true, text: 'Pagos vinculados' })
      onImported()
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setLinking(false)
    }
  }

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: '1px solid var(--border)',
          borderRadius: 7, padding: '6px 14px', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
          letterSpacing: '0.03em', transition: 'var(--t)',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'rgba(201,168,76,.4)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        <span style={{ fontSize: 13 }}>{open ? '▾' : '▸'}</span>
        Importar PDF
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="fade card" style={{ marginTop: 10, padding: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Estado de cuenta PDF</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              onChange={e => setFile(e.target.files[0])}
              style={{ fontSize: 12, color: 'var(--text-muted)' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Clave PDF</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={hasStoredPassword ? 'Clave guardada' : '••••'}
              style={{ width: 120, padding: '7px 10px', borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13 }}
            />
          </div>
          <button
            type="submit"
            disabled={!file || loading}
            className="btn-gold"
            style={{ opacity: (!file || loading) ? 0.4 : 1 }}
          >
            {loading ? 'Importando…' : 'Importar'}
          </button>
          <button
            type="button"
            onClick={handleLink}
            disabled={linking}
            className="btn-ghost"
          >
            {linking ? 'Vinculando…' : 'Vincular pagos'}
          </button>
          {msg && (
            <span style={{ fontSize: 12, color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.text}</span>
          )}
        </form>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function CreditCard() {
  const [searchParams] = useSearchParams()

  const [allStmts, setAllStmts]           = useState([])
  const [periods, setPeriods]             = useState([])
  const [selectedPeriod, setSelected]     = useState(null)
  const [stmtsWithItems, setWithItems]    = useState([])
  const [summaryStmts, setSummaryStmts]   = useState([])
  const [activeInstallments, setActiveInstallments] = useState([])
  const [ccTransactions, setCCTransactions] = useState([])
  const [billingWindow, setBillingWindow] = useState(null)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  const { accounts } = useAccount()
  const ccAccount = accounts?.find(a => a.type === 'Tarjeta de crédito') ?? null

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [list, installs] = await Promise.all([
        api.ccStatements(),
        api.installments(),
      ])
      setAllStmts(list ?? [])
      setActiveInstallments(installs ?? [])

      const win = currentBillingWindow(list ?? [])
      setBillingWindow(win)
      if (ccAccount) {
        const txns = await api.transactions({
          account_id: ccAccount.id,
          date_from: win.from,
          date_to: win.to,
        })
        setCCTransactions(Array.isArray(txns) ? txns : (txns?.transactions ?? []))
      }

      const seen = new Set()
      const ps = []
      for (const s of (list ?? [])) {
        const key = s.period_to.slice(0, 7)
        if (!seen.has(key)) { seen.add(key); ps.push(key) }
      }
      ps.sort((a, b) => b.localeCompare(a))
      setPeriods(ps)

      const requested = searchParams.get('period')
      const initial = (requested && ps.includes(requested)) ? requested : (ps[0] ?? null)
      setSelected(initial)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    if (!selectedPeriod || allStmts.length === 0) return

    const matches = allStmts.filter(s => s.period_to.slice(0, 7) === selectedPeriod)
    const targets = [NATIONAL_ID, INTL_ID]
      .map(id => matches.find(s => s.external_account_id === id))
      .filter(Boolean)

    setSummaryStmts(targets)
    setWithItems([])
    Promise.all(targets.map(s => api.ccStatement(s.id)))
      .then(setWithItems)
      .catch(err => setError(err.message))
  }, [selectedPeriod, allStmts])

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 48px' }}>

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Movimientos Tarjeta de Crédito</h1>
          {periods.length > 1 && selectedPeriod && (
            <PeriodNav periods={periods} selected={selectedPeriod} onChange={setSelected} />
          )}
          {periods.length === 1 && selectedPeriod && (
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{periodLabel(selectedPeriod + '-01')}</span>
          )}
        </div>
        <ImportPanel onImported={loadAll} />
      </div>

      {loading && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Cargando…</p>}
      {error   && <p style={{ fontSize: 13, color: 'var(--red)' }}>{error}</p>}

      {!loading && periods.length === 0 && (
        <div className="empty">
          <h3>Sin estados de cuenta</h3>
          <p>Importa un PDF para comenzar.</p>
        </div>
      )}

      {/* Active installments — global, not period-dependent */}
      {!loading && <ActiveInstallmentsPanel items={activeInstallments} />}

      {/* Current period transactions — from transactions table */}
      {!loading && (
        <CurrentPeriodMovements
          transactions={ccTransactions}
          billingWindow={billingWindow}
          ccAccount={ccAccount}
        />
      )}

      {/* Summary bar */}
      {summaryStmts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SummaryBar stmts={summaryStmts} />
        </div>
      )}

      {/* Statement cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {stmtsWithItems.map(stmt => (
          <StatementCard key={stmt.id} stmt={stmt} />
        ))}
      </div>
    </div>
  )
}
