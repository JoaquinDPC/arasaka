const _clpFmt = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

const _pctFmt = new Intl.NumberFormat('es-CL', {
  style: 'percent',
  maximumFractionDigits: 1,
})

export function formatCLP(amount) {
  return _clpFmt.format(amount ?? 0)
}

export function formatPct(ratio) {
  return _pctFmt.format(ratio ?? 0)
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
