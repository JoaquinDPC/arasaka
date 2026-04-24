export function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount ?? 0)
}

export function formatPct(ratio) {
  return new Intl.NumberFormat('es-CL', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(ratio ?? 0)
}

export function formatDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function monthName(month) {
  return MONTH_NAMES[(month - 1) % 12] ?? ''
}
