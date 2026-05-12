import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'

const NATIONAL_ID = 'credit_card_nacional_facturados'
const INTL_ID     = 'credit_card_internacional_facturados'

// ── Formatting ────────────────────────────────────────────────────────────

function fmtCLP(n) {
  return `$ ${Math.abs(n).toLocaleString('es-CL')}`
}
function fmtUSD(cents) {
  return `US$ ${(Math.abs(cents) / 100).toFixed(2)}`
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
  const current    = it.installment_current ?? 1
  const total      = it.installment_total   ?? 1
  const origAmount = it.amount                        // total purchase price from PDF
  const monthlyAmt = Math.round(origAmount / total)  // cuota mensual
  const paidAmount = monthlyAmt * current
  const pct        = Math.round((current / total) * 100)

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {it.description}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 3 }}>
            {fmtDate(it.date)} · Compra {fmt(origAmount, currency)}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent)' }}>
            {fmt(monthlyAmt, currency)}<span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>/mes</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)', marginTop: 2 }}>
            {fmt(paidAmount, currency)} de {fmt(origAmount, currency)}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width .4s ease' }} />
        </div>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
          {current}/{total}
        </span>
      </div>
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
  const totalInstOrig = installments.reduce((s, it) => s + it.amount, 0)
  const totalPurchases   = purchases.reduce((s, it) => s + it.amount, 0)
  const totalCommissions = commissions.reduce((s, it) => s + it.amount, 0)

  const sectionLabel = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
    textTransform: 'uppercase', color: 'var(--text-muted)',
  }

  return (
    <div className="card" style={{ borderColor: isIntl ? 'rgba(155,127,212,.25)' : 'rgba(201,168,76,.18)' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: accent, marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 28, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
              {fmt(stmt.total_amount, stmt.currency)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 6 }}>
              {fmtDate(stmt.period_from)} – {fmtDate(stmt.period_to)}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {stmt.due_date && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>Vence</div>
                <div style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: accent }}>{fmtDate(stmt.due_date)}</div>
              </div>
            )}
            {stmt.min_payment > 0 && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>Pago mínimo</div>
                <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>{fmt(stmt.min_payment, stmt.currency)}</div>
              </div>
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
          {purchases.map(it => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-dim)', flexShrink: 0 }}>{fmtDate(it.date)}</span>
                <span style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</span>
              </div>
              <span style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>{fmt(it.amount, it.currency)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Commissions */}
      {commissions.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ ...sectionLabel, color: 'var(--red)' }}>Cargos adicionales</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--red)' }}>{fmt(totalCommissions, stmt.currency)}</span>
          </div>
          {commissions.map(it => (
            <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</span>
              <span style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--red)', flexShrink: 0 }}>{fmt(it.amount, it.currency)}</span>
            </div>
          ))}
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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('password', password)
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
              placeholder="••••"
              style={{ width: 100, padding: '7px 10px', borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13 }}
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

  const [allStmts, setAllStmts]       = useState([])
  const [periods, setPeriods]         = useState([])
  const [selectedPeriod, setSelected] = useState(null)
  const [stmtsWithItems, setWithItems] = useState([])
  const [summaryStmts, setSummaryStmts] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const list = await api.ccStatements()
      setAllStmts(list ?? [])

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
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Tarjeta de Crédito</h1>
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
