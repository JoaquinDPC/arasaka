import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { api } from '../api/client'

const links = [
  { to: '/monthly',     label: 'Reporte'       },
  { to: '/annual',      label: 'Anual'         },
  { to: '/ledger',      label: 'Movimientos'   },
  { to: '/categories',  label: 'Categorías'    },
  { to: '/credit-card', label: 'Tarjeta'       },
]

export default function TopNav() {
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  async function handleImport() {
    setImporting(true)
    setImportMsg(null)
    try {
      const res = await api.importBank()
      setImportMsg(res?.message ?? 'Importación completada')
    } catch {
      setImportMsg('Error al importar')
    } finally {
      setImporting(false)
      setTimeout(() => setImportMsg(null), 3000)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await api.sync()
      setSyncMsg(res?.message ?? 'Sync complete')
    } catch {
      setSyncMsg('Sync error')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 3000)
    }
  }

  return (
    <header className="glass-nav sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4 h-14">

          {/* Logo */}
          <div className="flex-shrink-0 mr-1 sm:mr-2">
            <span className="text-white font-bold text-base sm:text-lg tracking-tight">Arasaka</span>
          </div>

          {/* Nav links */}
          <nav className="flex-1 flex items-center justify-center gap-0.5 sm:gap-1">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/8'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Action buttons */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <div className="flex flex-col items-end gap-0.5">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-xl glass text-white/70 hover:text-white disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
              >
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
              {syncMsg && (
                <p className="text-xs text-white/45">{syncMsg}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-xl glass text-white/70 hover:text-white disabled:opacity-40 transition-colors whitespace-nowrap cursor-pointer"
              >
                {importing ? 'Importando…' : 'Importar'}
              </button>
              {importMsg && (
                <p className="text-xs text-white/45">{importMsg}</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </header>
  )
}
