import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { formatCLP } from '../lib/formatters'

function HomeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7.5" cy="7.5" r="5.5" />
    </svg>
  )
}

function MensualIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.5" y="1.5" width="12" height="12" rx="2" />
    </svg>
  )
}

function AnualIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M7.5 1L14 7.5L7.5 14L1 7.5Z" />
    </svg>
  )
}

function CategoriasIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="8.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="8.5" width="5" height="5" rx="1" />
      <rect x="8.5" y="8.5" width="5" height="5" rx="1" />
    </svg>
  )
}

function MovimientosIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="2" y1="4.5" x2="13" y2="4.5" />
      <line x1="2" y1="7.5" x2="13" y2="7.5" />
      <line x1="2" y1="10.5" x2="13" y2="10.5" />
    </svg>
  )
}

function CuentasIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7.5" cy="7.5" r="5.5" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  )
}

function PresupuestosIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7.5" cy="7.5" r="5.5" />
      <circle cx="7.5" cy="7.5" r="2.5" />
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/home',         label: 'Home',         Icon: HomeIcon         },
  { to: '/mensual',      label: 'Mensual',       Icon: MensualIcon      },
  { to: '/anual',        label: 'Anual',         Icon: AnualIcon        },
  { to: '/categorias',   label: 'Categorías',    Icon: CategoriasIcon   },
  { to: '/movimientos',  label: 'Movimientos',   Icon: MovimientosIcon  },
  { to: '/cuentas',      label: 'Cuentas',       Icon: CuentasIcon      },
  { to: '/presupuestos', label: 'Presupuestos',  Icon: PresupuestosIcon },
]

export default function Sidebar() {
  const [netWorth, setNetWorth] = useState(null)

  useEffect(() => {
    api.kpis(new Date().getFullYear())
      .then(k => setNetWorth(k.net_worth ?? null))
      .catch(() => {})
  }, [])

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <span className="text-violet-400 font-bold text-xs tracking-[0.25em] uppercase select-none">
          Arasaka
        </span>
      </div>

      {/* Account selector */}
      <div className="px-3 mb-5">
        <div className="rounded-xl px-3 py-2.5 glass cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-emerald-400 text-xs font-medium">• Todas las cuentas</span>
            <span className="text-white/20 text-[10px]">▾</span>
          </div>
          {netWorth !== null && (
            <p className="text-white/40 text-[11px] mt-0.5 tabular">
              {formatCLP(netWorth)}
            </p>
          )}
        </div>
      </div>

      {/* Nav label */}
      <div className="px-5 mb-2">
        <span className="text-white/20 text-[9px] font-semibold uppercase tracking-[0.2em]">
          Navegación
        </span>
      </div>

      {/* Nav items */}
      <nav className="px-2 flex-1">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-[7px] rounded-xl text-[13px] font-medium mb-0.5 transition-colors ${
                isActive
                  ? 'bg-violet-500/20 text-white'
                  : 'text-white/40 hover:text-white/65 hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-violet-400' : 'text-white/25'}>
                  <Icon />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 mt-auto border-t border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-violet-500/25 border border-violet-500/35 flex items-center justify-center text-[11px] font-semibold text-violet-300 flex-shrink-0">
            U
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-white leading-tight">Usuario</p>
            <button className="text-[11px] text-white/25 hover:text-white/45 transition-colors leading-tight">
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
