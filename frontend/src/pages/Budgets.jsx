import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { formatCLP } from '../lib/formatters'
import { CATEGORIES, CATEGORY_COLORS } from '../lib/constants'
import Spinner from '../components/Spinner'

const FALLBACK_COLORS = { dot: 'bg-slate-400', text: 'text-slate-300' }

const CAT_BAR_COLORS = {
  Personal: '#8b5cf6', Casa: '#eab308', Otros: '#64748b',
  Salud: '#22c55e', Transporte: '#f59e0b', Suscripciones: '#6366f1',
  Gustos: '#ec4899', Mascota: '#f97316', Inversion: '#06b6d4', Patrimonio: '#94a3b8',
}

function parseBudgets(rawBudgets) {
  const base = {}
  for (const b of rawBudgets) {
    if (b.month === 0) base[b.category] = b.amount
  }
  const result = {}
  for (const cat of CATEGORIES) {
    result[cat] = base[cat] ?? 0
  }
  return result
}

export default function Budgets() {
  const year = new Date().getFullYear()
  const [limits, setLimits]   = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    setLoading(true)
    api.budgets(year)
      .then(data => {
        setLimits(parseBudgets(Array.isArray(data) ? data : []))
      })
      .catch(() => {
        const defaults = {}
        for (const cat of CATEGORIES) defaults[cat] = 0
        setLimits(defaults)
      })
      .finally(() => setLoading(false))
  }, [year])

  function setLimit(cat, value) {
    setLimits(prev => ({ ...prev, [cat]: Math.max(0, Number(value) || 0) }))
  }

  const total = Object.values(limits).reduce((s, v) => s + v, 0)
  const maxVal = Math.max(...Object.values(limits), 1)

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

  const activeLimits = CATEGORIES.filter(cat => (limits[cat] ?? 0) > 0)

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Presupuestos Base</h1>
        <p className="text-white/35 text-sm mt-0.5">
          Estos son los valores por defecto para todos los meses. Desde la vista Mensual o el Home puedes ajustarlos por mes.
        </p>
      </div>

      {loading ? <Spinner /> : (
        <div className="grid grid-cols-2 gap-5">
          {/* Left: category limits */}
          <div className="glass rounded-2xl p-5">
            <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-4">
              Límites mensuales por categoría
            </p>
            <div className="space-y-2.5">
              {CATEGORIES.map(cat => {
                const colors = CATEGORY_COLORS[cat] ?? FALLBACK_COLORS
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-28 flex-shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                      <span className={`text-xs font-medium uppercase tracking-wide ${colors.text} truncate`}>
                        {cat}
                      </span>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={limits[cat] ?? 0}
                        onChange={e => setLimit(cat, e.target.value)}
                        placeholder="Sin límite"
                        className="glass-input rounded-lg px-3 py-1.5 text-sm w-full text-right tabular"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: visual preview */}
          <div className="flex flex-col gap-4">
            <div className="glass rounded-2xl p-5 flex-1">
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-4">
                Vista previa
              </p>
              {activeLimits.length === 0 ? (
                <p className="text-white/25 text-sm text-center py-8">
                  Define al menos un límite para ver la distribución
                </p>
              ) : (
                <div className="space-y-3">
                  {activeLimits.map(cat => {
                    const colors = CATEGORY_COLORS[cat] ?? FALLBACK_COLORS
                    const val    = limits[cat] ?? 0
                    const barW   = maxVal > 0 ? (val / maxVal) * 100 : 0
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>{cat}</span>
                          </div>
                          <span className="text-xs text-white/50 tabular">{formatCLP(val)}</span>
                        </div>
                        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${barW}%`,
                              background: CAT_BAR_COLORS[cat] ?? '#64748b',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Info note */}
            <div className="glass rounded-2xl p-4 text-[11px] text-white/35 leading-relaxed">
              <p className="font-semibold text-white/50 mb-1">Nota sobre herencia</p>
              <p>Los presupuestos base aplican a todos los meses por defecto.</p>
              <p className="mt-1">En <span className="text-violet-300">Home</span> · <span className="text-violet-300">Vista Mensual</span>, ajusta los límites por mes sin afectar la base.</p>
            </div>

            {/* Total + Save */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/35">Total presupuestado</p>
                <p className="text-base font-bold text-violet-300 tabular">{formatCLP(total)}</p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors cursor-pointer"
              >
                {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar base'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
