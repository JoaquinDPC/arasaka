import { formatCLP, formatPct } from '../lib/formatters'

function barColor(pctUsed) {
  if (pctUsed >= 1.0) return 'bg-rose-500'
  if (pctUsed >= 0.8) return 'bg-amber-400'
  return 'bg-emerald-500'
}

function textColor(pctUsed) {
  if (pctUsed >= 1.0) return 'text-rose-400'
  if (pctUsed >= 0.8) return 'text-amber-400'
  return 'text-emerald-400'
}

export default function BudgetBar({ category, total, budget, pctUsed }) {
  const hasBudget = budget > 0

  return (
    <div className="flex items-center gap-2 sm:gap-3 py-2.5">
      <span className="w-24 sm:w-32 text-sm text-white/65 font-medium truncate flex-shrink-0">{category}</span>
      <div className="flex-1 min-w-0">
        {hasBudget ? (
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor(pctUsed)}`}
              style={{ width: `${Math.min(pctUsed * 100, 100)}%` }}
            />
          </div>
        ) : (
          <div className="h-1.5 bg-white/10 rounded-full" />
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <span className={`text-sm font-semibold ${hasBudget ? textColor(pctUsed) : 'text-white/75'}`}>
          {formatCLP(total)}
        </span>
        {hasBudget && (
          <span className="text-xs text-white/35 ml-1 hidden sm:inline">/ {formatCLP(budget)}</span>
        )}
      </div>
      {hasBudget && (
        <span className={`text-xs font-medium w-8 text-right flex-shrink-0 ${textColor(pctUsed)}`}>
          {formatPct(pctUsed)}
        </span>
      )}
    </div>
  )
}
