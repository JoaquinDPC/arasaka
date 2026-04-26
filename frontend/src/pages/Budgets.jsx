import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { formatCLP } from '../lib/formatters'
import { CATEGORIES, CAT_COLORS } from '../lib/constants'
import Spinner from '../components/Spinner'

function parseBudgets(rawBudgets) {
  const base = {}
  for (const b of rawBudgets) {
    if (b.month === 0) base[b.category] = b.amount
  }
  const result = {}
  for (const cat of CATEGORIES) result[cat] = base[cat] ?? 0
  return result
}

const BUDGET_CATS = CATEGORIES.filter(c => !['Sueldo', 'Devolucion'].includes(c))

export default function Budgets() {
  const year = new Date().getFullYear()
  const [limits, setLimits]   = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    setLoading(true)
    api.budgets(year)
      .then(data => setLimits(parseBudgets(Array.isArray(data) ? data : [])))
      .catch(() => { const d = {}; for (const c of CATEGORIES) d[c] = 0; setLimits(d) })
      .finally(() => setLoading(false))
  }, [year])

  function setLimit(cat, value) {
    setLimits(prev => ({ ...prev, [cat]: Math.max(0, Number(value) || 0) }))
  }

  const total  = Object.values(limits).reduce((s, v) => s + v, 0)
  const maxVal = Math.max(...Object.values(limits), 1)
  const active = BUDGET_CATS.filter(c => (limits[c] ?? 0) > 0).sort((a, b) => (limits[b] || 0) - (limits[a] || 0))

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const budgets = CATEGORIES.map(cat => ({ category: cat, amount: limits[cat] ?? 0 }))
      await api.upsertBudgetsBase({ year, budgets })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  return (
    <div className="fade">
      <div className="ph">
        <div className="ph-title">Presupuestos Base</div>
        <div className="ph-sub">Valores por defecto para todos los meses. Desde Home o Vista Mensual puedes ajustarlos por mes.</div>
      </div>

      {loading ? <Spinner /> : (
        <div className="budgets-grid">
          {/* Budget inputs */}
          <div className="card">
            <div className="card-title">Límites mensuales por categoría</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {BUDGET_CATS.map(cat => {
                const color = CAT_COLORS[cat] || '#888'
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', width: 110, letterSpacing: '0.04em' }}>{cat}</div>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input type="number" className="finput" placeholder="Sin límite"
                        value={limits[cat] || ''} onChange={e => setLimit(cat, e.target.value)}
                        style={{ fontFamily: 'var(--mono)', fontSize: 13, paddingRight: 36 }} />
                      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-dim)', pointerEvents: 'none' }}>CLP</span>
                    </div>
                    {(limits[cat] ?? 0) > 0 && (
                      <button onClick={() => setLimit(cat, '')} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>×</button>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Total: <span style={{ fontFamily: 'var(--mono)', color: 'var(--accent)', fontWeight: 600 }}>{formatCLP(total)}</span>
              </div>
              <button className="btn-gold" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar base'}
              </button>
            </div>
          </div>

          {/* Preview + note */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ flex: 1 }}>
              <div className="card-title">Vista previa</div>
              {active.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {active.map(cat => {
                    const v = limits[cat] ?? 0
                    const barW = maxVal > 0 ? (v / maxVal) * 100 : 0
                    const color = CAT_COLORS[cat] || '#888'
                    return (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', width: 90, fontWeight: 600, letterSpacing: '0.04em' }}>{cat}</div>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,.05)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${barW}%`, background: color, borderRadius: 3, opacity: .7 }} />
                        </div>
                        <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-muted)', width: 60, textAlign: 'right' }}>{formatCLP(v)}</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-msg" style={{ padding: '32px 0' }}>Ingresa presupuestos para ver la vista previa</div>
              )}
            </div>

            <div className="card" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <div className="card-title" style={{ marginBottom: 10 }}>Nota sobre herencia</div>
              Los presupuestos base aplican a todos los meses por defecto.<br />
              En <strong style={{ color: 'var(--text)' }}>Home</strong> o <strong style={{ color: 'var(--text)' }}>Vista Mensual</strong>, los valores reales vs límite se muestran con barras de progreso.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
