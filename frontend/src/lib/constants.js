export const CATEGORY_COLORS = {
  Casa:          { bg: 'bg-blue-500/15',    text: 'text-blue-300',    dot: 'bg-blue-400'    },
  Personal:      { bg: 'bg-purple-500/15',  text: 'text-purple-300',  dot: 'bg-purple-400'  },
  Salud:         { bg: 'bg-green-500/15',   text: 'text-green-300',   dot: 'bg-green-400'   },
  Transporte:    { bg: 'bg-yellow-500/15',  text: 'text-yellow-300',  dot: 'bg-yellow-400'  },
  Suscripciones: { bg: 'bg-indigo-500/15',  text: 'text-indigo-300',  dot: 'bg-indigo-400'  },
  Gustos:        { bg: 'bg-pink-500/15',    text: 'text-pink-300',    dot: 'bg-pink-400'    },
  Mascota:       { bg: 'bg-orange-500/15',  text: 'text-orange-300',  dot: 'bg-orange-400'  },
  Otros:         { bg: 'bg-slate-500/15',   text: 'text-slate-300',   dot: 'bg-slate-400'   },
  Regalo:        { bg: 'bg-rose-500/15',    text: 'text-rose-300',    dot: 'bg-rose-400'    },
  Seguros:       { bg: 'bg-sky-500/15',     text: 'text-sky-300',     dot: 'bg-sky-400'     },
  Vacaciones:    { bg: 'bg-teal-500/15',    text: 'text-teal-300',    dot: 'bg-teal-400'    },
  Sueldo:        { bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  Devolucion:    { bg: 'bg-teal-500/15',    text: 'text-teal-300',    dot: 'bg-teal-400'    },
  Inversion:     { bg: 'bg-cyan-500/15',    text: 'text-cyan-300',    dot: 'bg-cyan-400'    },
  Patrimonio:    { bg: 'bg-slate-500/15',   text: 'text-slate-300',   dot: 'bg-slate-500'   },
}

export const CATEGORIES = Object.keys(CATEGORY_COLORS)

export const FLOW_TYPES = [
  { value: 'INCOME',  label: 'Ingresos'     },
  { value: 'EXPENSE', label: 'Gastos'        },
  { value: 'INVEST',  label: 'Inversiones'   },
  { value: 'OPENING', label: 'Saldo inicial' },
]
