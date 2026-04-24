import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'

const NATIONAL_ID = 'credit_card_nacional_facturados'
const INTL_ID     = 'credit_card_internacional_facturados'

// ── Formatting ────────────────────────────────────────────────────────────

function fmtCLP(n) {
  return `$\u00a0${Math.abs(n).toLocaleString('es-CL')}`
}
function fmtUSD(cents) {
  return `US$\u00a0${(Math.abs(cents) / 100).toFixed(2)}`
}
function fmt(amount, currency) {
  return currency === 'USD' ? fmtUSD(amount) : fmtCLP(amount)
}

// Always one line: dd/mm/yyyy
function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// "2026-03-24" → "Marzo 2026"
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
function periodLabel(isoDate) {
  const [y, m] = isoDate.slice(0, 10).split('-')
  return `${MONTHS_ES[parseInt(m, 10) - 1]} ${y}`
}

// ── Installment row ───────────────────────────────────────────────────────

function InstallmentRow({ it, currency }) {
  const current    = it.installment_current ?? 1
  const total      = it.installment_total   ?? 1
  const remaining  = total - current
  const remAmount  = remaining * it.amount
  const origAmount = total * it.amount
  const pct        = Math.round((current / total) * 100)

  return (
    <div className="rounded-xl bg-white/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{it.description}</p>
          <p className="text-xs text-white/40 mt-0.5 whitespace-nowrap">{fmtDate(it.date)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-amber-300 whitespace-nowrap">
            {fmt(it.amount, currency)}<span className="text-white/30 font-normal">/mes</span>
          </p>
          <p className="text-xs text-white/40 mt-0.5 whitespace-nowrap">
            Compra: {fmt(origAmount, currency)}
          </p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-white/40 mb-1">
          <span>Cuota {current} de {total}</span>
          <span>{pct}% pagado</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {remaining > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Quedan {remaining} cuota{remaining !== 1 ? 's' : ''}</span>
          <span className="text-white/70 font-medium whitespace-nowrap">{fmt(remAmount, currency)} restantes</span>
        </div>
      )}
    </div>
  )
}

// ── Statement card ────────────────────────────────────────────────────────

function StatementCard({ stmt }) {
  const isIntl = stmt.account_id === INTL_ID
  const label  = isIntl ? 'Tarjeta Internacional' : 'Tarjeta Nacional'
  const accent = isIntl ? 'text-purple-300' : 'text-cyan-300'

  const items        = stmt.items ?? []
  const installments = items.filter(it => it.item_type === 'installment')
  const purchases    = items.filter(it => it.item_type === 'purchase')
  const commissions  = items.filter(it => it.item_type === 'commission')

  const totalInstRem   = installments.reduce((s, it) => {
    return s + ((it.installment_total ?? 1) - (it.installment_current ?? 1)) * it.amount
  }, 0)
  const totalPurchases   = purchases.reduce((s, it) => s + it.amount, 0)
  const totalCommissions = commissions.reduce((s, it) => s + it.amount, 0)

  return (
    <div className="glass rounded-2xl p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${accent}`}>{label}</p>
          <p className="text-3xl font-bold text-white">{fmt(stmt.total_amount, stmt.currency)}</p>
          <p className="text-xs text-white/40 mt-1 whitespace-nowrap">
            Período {fmtDate(stmt.period_from)} – {fmtDate(stmt.period_to)}
          </p>
        </div>
        <div className="text-right shrink-0 space-y-2">
          {stmt.due_date && (
            <div>
              <p className="text-xs text-white/40">Vence</p>
              <p className="text-sm font-semibold text-amber-300 whitespace-nowrap">{fmtDate(stmt.due_date)}</p>
            </div>
          )}
          {stmt.min_payment > 0 && (
            <div>
              <p className="text-xs text-white/40">Pago mínimo</p>
              <p className="text-sm font-medium text-white/60 whitespace-nowrap">{fmt(stmt.min_payment, stmt.currency)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Installments */}
      {installments.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">Cuotas</h3>
            {totalInstRem > 0 && (
              <span className="text-xs text-white/40 whitespace-nowrap">
                Remanente: <span className="text-white/70 font-medium">{fmt(totalInstRem, stmt.currency)}</span>
              </span>
            )}
          </div>
          {installments.map(it => (
            <InstallmentRow key={it.id} it={it} currency={stmt.currency} />
          ))}
        </section>
      )}

      {/* Purchases */}
      {purchases.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-blue-400/80">Compras</h3>
            <span className="text-xs text-white/50 font-medium whitespace-nowrap">{fmt(totalPurchases, stmt.currency)}</span>
          </div>
          <div className="divide-y divide-white/5">
            {purchases.map(it => (
              <div key={it.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-white/30 text-xs whitespace-nowrap shrink-0">{fmtDate(it.date)}</span>
                  <span className="text-white/80 text-sm truncate">{it.description}</span>
                </div>
                <span className="text-white text-sm font-medium shrink-0 whitespace-nowrap">{fmt(it.amount, it.currency)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Commissions */}
      {commissions.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-red-400/80">Cargos adicionales</h3>
            <span className="text-xs text-white/50 font-medium whitespace-nowrap">{fmt(totalCommissions, stmt.currency)}</span>
          </div>
          <div className="divide-y divide-white/5">
            {commissions.map(it => (
              <div key={it.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-white/60 text-sm truncate">{it.description}</span>
                <span className="text-red-300 text-sm font-medium shrink-0 whitespace-nowrap">{fmt(it.amount, it.currency)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Import panel ──────────────────────────────────────────────────────────

function ImportPanel({ onImported }) {
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
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-5 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-white/40 font-medium">Estado de cuenta PDF</label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          onChange={e => setFile(e.target.files[0])}
          className="text-sm text-white/70 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white/70 file:text-sm file:cursor-pointer hover:file:bg-white/15"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-white/40 font-medium">Clave PDF</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••"
          className="w-28 px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
        />
      </div>
      <button
        type="submit"
        disabled={!file || loading}
        className="px-4 py-1.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 disabled:opacity-40 transition-colors cursor-pointer"
      >
        {loading ? 'Importando…' : 'Importar PDF'}
      </button>
      <button
        type="button"
        onClick={handleLink}
        disabled={linking}
        className="px-4 py-1.5 rounded-xl bg-white/10 text-white/60 text-sm font-medium hover:bg-white/15 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
      >
        {linking ? 'Vinculando…' : 'Vincular pagos'}
      </button>
      {msg && (
        <p className={`text-sm ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
      )}
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function CreditCard() {
  const [searchParams] = useSearchParams()

  const [allStmts, setAllStmts]       = useState([])
  const [periods, setPeriods]         = useState([])
  const [selectedPeriod, setSelected] = useState(null)
  const [stmtsWithItems, setWithItems] = useState([])
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

      // Honour ?period=YYYY-MM from navigation; fall back to most recent
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

  // Whenever selected period changes, fetch the two statements with items
  useEffect(() => {
    if (!selectedPeriod || allStmts.length === 0) return

    const matches = allStmts.filter(s => s.period_to.slice(0, 7) === selectedPeriod)
    const targets = [NATIONAL_ID, INTL_ID]
      .map(id => matches.find(s => s.account_id === id))
      .filter(Boolean)

    setWithItems([])
    Promise.all(targets.map(s => api.ccStatement(s.id)))
      .then(setWithItems)
      .catch(err => setError(err.message))
  }, [selectedPeriod, allStmts])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <h1 className="text-xl font-semibold text-white">Tarjeta de Crédito</h1>

      <ImportPanel onImported={loadAll} />

      {loading && <p className="text-white/40 text-sm">Cargando…</p>}
      {error   && <p className="text-red-400 text-sm">{error}</p>}

      {/* Period tabs */}
      {periods.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {periods.map(p => (
            <button
              key={p}
              onClick={() => setSelected(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                p === selectedPeriod
                  ? 'bg-white/15 text-white'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/8'
              }`}
            >
              {periodLabel(p + '-01')}
            </button>
          ))}
        </div>
      )}

      {/* Period heading when single period */}
      {periods.length === 1 && selectedPeriod && (
        <p className="text-sm text-white/40">{periodLabel(selectedPeriod + '-01')}</p>
      )}

      {!loading && periods.length === 0 && (
        <p className="text-white/40 text-sm">No hay estados de cuenta. Importa un PDF para comenzar.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {stmtsWithItems.map(stmt => (
          <StatementCard key={stmt.id} stmt={stmt} />
        ))}
      </div>
    </div>
  )
}
