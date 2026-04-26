import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { formatCLP } from '../lib/formatters'
import { ACCT_COLORS } from '../lib/constants'

function SyncButton() {
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState(null) // 'ok' | 'err' | null

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    setStatus(null)
    try {
      await api.sync()
      setStatus('ok')
    } catch {
      setStatus('err')
    } finally {
      setSyncing(false)
      setTimeout(() => setStatus(null), 3000)
    }
  }

  return (
    <div className="sb-sync">
      <button
        className={`sync-btn${syncing ? ' spinning' : ''}${status === 'ok' ? ' sync-ok' : ''}${status === 'err' ? ' sync-err' : ''}`}
        onClick={handleSync}
        disabled={syncing}
        title="Sincronizar movimientos"
      >
        <span className="sync-icon">⟳</span>
        <span className="sync-label">
          {syncing ? 'Sincronizando…' : status === 'ok' ? 'Listo' : status === 'err' ? 'Error' : 'Sincronizar'}
        </span>
      </button>
    </div>
  )
}

const NAV_ITEMS = [
  { to: '/home',         label: 'Home',        icon: '⬡' },
  { to: '/mensual',      label: 'Mensual',      icon: '◫' },
  { to: '/anual',        label: 'Anual',        icon: '◈' },
  { to: '/categorias',   label: 'Categorías',   icon: '◧' },
  { to: '/movimientos',  label: 'Movimientos',  icon: '≡' },
  { to: '/cuentas',      label: 'Cuentas',      icon: '◎' },
  { to: '/deudas',       label: 'Deudas',       icon: '⇄' },
  { to: '/presupuestos', label: 'Presupuestos', icon: '◉' },
]

function AccountSwitcher() {
  const [accounts, setAccounts] = useState([])
  const [netWorth, setNetWorth] = useState(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api.accounts().then(d => setAccounts(Array.isArray(d) ? d : [])).catch(() => {})
    api.kpis(new Date().getFullYear()).then(k => setNetWorth(k?.net_worth ?? null)).catch(() => {})
  }, [])

  return (
    <div className="acct-switcher">
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px',
          borderRadius: 7, cursor: 'pointer', transition: 'background var(--t)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Todas las cuentas
          </div>
          {netWorth !== null && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{formatCLP(netWorth)}</div>
          )}
        </div>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && accounts.length > 0 && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {accounts.map((a, i) => {
            const color = ACCT_COLORS[i % ACCT_COLORS.length]
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{a.bank_name}</div>
                </div>
                <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
                  {formatCLP(a.balance ?? 0)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ user, onLogout, open, onClose }) {
  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sb-logo">ARASAKA</div>

      <AccountSwitcher />

      <div className="sb-label">Navegación</div>

      <nav className="sb-nav">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <SyncButton />

      <div className="sb-user">
        <div className="avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
        <div>
          <div className="sb-user-name">{user?.name || 'Usuario'}</div>
          <div className="sb-user-out" onClick={onLogout}>Cerrar sesión</div>
        </div>
      </div>
    </aside>
  )
}
