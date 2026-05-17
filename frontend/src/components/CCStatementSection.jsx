import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { formatCLP } from '../lib/formatters'

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function fmtAmount(amount, currency) {
  if (currency === 'USD') return `US$ ${(Math.abs(amount) / 100).toFixed(2)}`
  return formatCLP(Math.abs(amount))
}

export default function CCStatementSection({ statementId }) {
  const [stmt, setStmt]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen]     = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    api.ccStatement(statementId)
      .then(setStmt)
      .catch(() => setStmt(null))
      .finally(() => setLoading(false))
  }, [open, statementId])

  const items        = stmt?.items ?? []
  const purchases    = items.filter(it => it.item_type === 'purchase')
  const installments = items.filter(it => it.item_type === 'installment')
  const commissions  = items.filter(it => it.item_type === 'commission')

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
          color: 'var(--accent)', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.07em', textTransform: 'uppercase',
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>{open ? '▾' : '▸'}</span>
        Detalle facturación TC
        {stmt && !loading && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
            {fmtAmount(stmt.total_amount, stmt.currency)}
          </span>
        )}
      </button>

      {open && (
        <div className="fade" style={{ marginTop: 10 }}>
          {loading && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Cargando…</div>
          )}

          {!loading && stmt && (
            <>
              {/* Statement header */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>
                <span>Período {fmtDate(stmt.period_from)} – {fmtDate(stmt.period_to)}</span>
                {stmt.due_date && <span>Vence {fmtDate(stmt.due_date)}</span>}
              </div>

              {/* Purchases */}
              {purchases.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Compras</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                      {fmtAmount(purchases.reduce((s, it) => s + it.amount, 0), stmt.currency)}
                    </span>
                  </div>
                  {purchases.map(it => (
                    <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>{fmtDate(it.date)}</div>
                      </div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--text)', flexShrink: 0 }}>
                        {fmtAmount(it.amount, it.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Installments */}
              {installments.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Cuotas</span>
                  </div>
                  {installments.map(it => {
                    const pct = Math.round(((it.installment_current ?? 1) / (it.installment_total ?? 1)) * 100)
                    return (
                      <div key={it.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)', marginTop: 2 }}>
                              Cuota {it.installment_current ?? 1} de {it.installment_total ?? 1}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                              {fmtAmount(it.amount, it.currency)}<span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>/mes</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ height: 3, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 2, background: 'var(--accent)', width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Commissions */}
              {commissions.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Cargos adicionales</span>
                    {commissions.length > 1 && (
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--red)' }}>
                        {fmtAmount(commissions.reduce((s, it) => s + it.amount, 0), stmt.currency)}
                      </span>
                    )}
                  </div>
                  {commissions.map(it => (
                    <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.description}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--red)', flexShrink: 0 }}>
                        {fmtAmount(it.amount, it.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && !stmt && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '4px 0' }}>No se pudo cargar el detalle.</div>
          )}
        </div>
      )}
    </div>
  )
}
