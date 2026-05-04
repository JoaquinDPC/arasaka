export const CAT_COLORS = {
  casa:          '#c9a84c',
  personal:      '#9b7fd4',
  salud:         '#4caf7d',
  inversion:     '#4cb8af',
  patrimonio:    '#af4c8a',
  transporte:    '#d4884c',
  suscripciones: '#80af4c',
  gustos:        '#e07c5c',
  otros:         '#888888',
  sueldo:        '#50b87a',
  devolucion:    '#4cb8af',
  mascota:       '#c9784c',
  regalo:        '#c94c8a',
  seguros:       '#7c9faf',
  vacaciones:    '#afb04c',
}

const HASH_PALETTE = [
  '#e07c5c', '#4caf7d', '#4cb8af', '#9b7fd4', '#d4884c',
  '#80af4c', '#c9a84c', '#af4c8a', '#7c9faf', '#c94c8a',
  '#afb04c', '#4c7caf', '#af7c4c', '#7caf4c', '#af4c7c',
  '#4caf9b', '#a04caf', '#af4c4c', '#4c9baf', '#8caf4c',
]

export function hashString(s) {
  let hash = 0
  if (!s) return 0
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function getCatColor(cat) {
  if (!cat) return '#888888'
  if (CAT_COLORS[cat]) return CAT_COLORS[cat]
  const lower = cat.toLowerCase()
  for (const [k, v] of Object.entries(CAT_COLORS)) {
    if (k.toLowerCase() === lower) return v
  }
  return HASH_PALETTE[hashString(cat) % HASH_PALETTE.length]
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

export const LIFE_CATS    = ['casa', 'personal', 'salud', 'transporte', 'suscripciones', 'mascota', 'seguros', 'otros']
export const INV_CATS     = ['inversion', 'patrimonio']
export const INCOME_CATS  = ['sueldo', 'devolucion']

export const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

export const MONTH_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export const BANKS = [
  { id: 'banco_de_chile', label: 'Banco de Chile' },
  { id: 'santander',      label: 'Santander'      },
  { id: 'bci',           label: 'BCI'            },
  { id: 'banco_estado',  label: 'BancoEstado'    },
  { id: 'scotiabank',    label: 'Scotiabank'      },
  { id: 'itau',          label: 'Itaú'            },
  { id: 'bice',          label: 'BICE'            },
  { id: 'falabella',     label: 'Falabella'       },
  { id: 'ripley',        label: 'Ripley'          },
  { id: 'mercado_pago',  label: 'Mercado Pago'   },
  { id: 'otro',          label: 'Otro'            },
]

// Banks that have a PDF cartola importer. Used in account create/edit and the import page.
export const SUPPORTED_BANKS = BANKS.filter(b =>
  b.id === 'banco_de_chile' || b.id === 'santander'
)

export function getBankLabel(bankId) {
  return BANKS.find(b => b.id === bankId)?.label ?? bankId ?? '—'
}
export const ACCT_TYPES = [
  'Cuenta corriente','Cuenta de ahorro','Tarjeta de crédito',
  'Cuenta vista','Inversión','Otro',
]
export const ACCT_COLORS = [
  '#c9a84c','#4cb8af','#9b7fd4','#e07c5c','#4caf7d',
  '#d4884c','#c94c8a','#7c9faf','#afb04c',
]
