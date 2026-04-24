const typeConfig = {
  warning:  { bg: 'bg-amber-500/12',   border: 'border-amber-500/30',   text: 'text-amber-300',   icon: '⚠' },
  positive: { bg: 'bg-emerald-500/12', border: 'border-emerald-500/30', text: 'text-emerald-300', icon: '✓' },
  info:     { bg: 'bg-cyan-500/12',    border: 'border-cyan-500/30',    text: 'text-cyan-300',    icon: 'ℹ' },
}

export default function InsightCard({ message, type = 'info' }) {
  const config = typeConfig[type] ?? typeConfig.info
  return (
    <div className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm ${config.bg} ${config.border}`}>
      <span className={`flex-shrink-0 mt-0.5 text-xs font-bold ${config.text}`}>{config.icon}</span>
      <span className="text-white/75 leading-snug">{message}</span>
    </div>
  )
}
