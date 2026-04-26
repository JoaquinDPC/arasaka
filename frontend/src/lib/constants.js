export const CAT_COLORS = {
  Casa:          '#c9a84c',
  Personal:      '#9b7fd4',
  Salud:         '#4caf7d',
  Inversion:     '#4cb8af',
  Patrimonio:    '#af4c8a',
  Transporte:    '#d4884c',
  Suscripciones: '#80af4c',
  Gustos:        '#e07c5c',
  Otros:         '#888888',
  Sueldo:        '#50b87a',
  Devolucion:    '#4cb8af',
  Mascota:       '#c9784c',
  Regalo:        '#c94c8a',
  Seguros:       '#7c9faf',
  Vacaciones:    '#afb04c',
}

export const CATEGORIES = Object.keys(CAT_COLORS)

export function getCatColor(cat) {
  if (!cat) return '#888888'
  if (CAT_COLORS[cat]) return CAT_COLORS[cat]
  let hash = 0
  for (let i = 0; i < cat.length; i++) {
    hash = cat.charCodeAt(i) + ((hash << 5) - hash)
  }
  return `hsl(${Math.abs(hash) % 360}, 52%, 54%)`
}

// Backward compat alias used by some components
export const CATEGORY_COLORS = Object.fromEntries(
  Object.entries(CAT_COLORS).map(([k, hex]) => [
    k,
    { hex, dot: hex, text: hex, bg: hex + '22' },
  ])
)

export const FLOW_TYPES = [
  { value: 'INCOME',  label: 'Ingresos'     },
  { value: 'EXPENSE', label: 'Gastos'        },
  { value: 'INVEST',  label: 'Inversiones'   },
  { value: 'OPENING', label: 'Saldo inicial' },
]

export const LIFE_CATS    = ['Casa', 'Personal', 'Salud', 'Transporte', 'Suscripciones', 'Mascota', 'Seguros', 'Otros']
export const INV_CATS     = ['Inversion', 'Patrimonio']
export const INCOME_CATS  = ['Sueldo', 'Devolucion']

export const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

export const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export const BANKS = [
  'BCI','Banco de Chile','Santander','BancoEstado','Scotiabank',
  'Itaú','BICE','Falabella','Ripley','Mercado Pago','Otro',
]
export const ACCT_TYPES = [
  'Cuenta corriente','Cuenta de ahorro','Tarjeta de crédito',
  'Cuenta vista','Inversión','Otro',
]
export const ACCT_COLORS = [
  '#c9a84c','#4cb8af','#9b7fd4','#e07c5c','#4caf7d',
  '#d4884c','#c94c8a','#7c9faf','#afb04c',
]
