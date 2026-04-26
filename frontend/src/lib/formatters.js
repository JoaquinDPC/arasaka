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
  return isoString.slice(0, 10).split('-').reverse().join('/')
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function monthName(month) {
  return MONTH_NAMES[(month - 1) % 12] ?? ''
}
