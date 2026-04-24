export default function KpiCard({ title, value, subtitle, color = 'text-white' }) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <p className="text-xs font-medium text-white/45 uppercase tracking-wider leading-tight">{title}</p>
      <p className={`mt-1.5 text-lg sm:text-2xl font-bold leading-tight ${color}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-white/35 leading-tight">{subtitle}</p>}
    </div>
  )
}
