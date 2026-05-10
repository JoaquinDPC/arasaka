import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { formatCLP } from '../lib/formatters'
import { ACCT_COLORS, getBankLabel } from '../lib/constants'
import { useAccount } from '../context/AccountContext'

// Maps our bank_id constants to the fintself scraper bank identifiers.
const FINTSELF_IDS = {
  banco_de_chile: 'cl_banco_chile',
  santander:      'cl_santander',
}

function SyncButton() {
  const { selectedAccount, notifySynced } = useAccount()
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState(null) // 'ok' | 'err' | null

  const bankId = FINTSELF_IDS[selectedAccount?.bank_id] ?? null
  const bankLabel = selectedAccount ? getBankLabel(selectedAccount.bank_id) : null

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    setStatus(null)
    try {
      await api.sync(bankId)
      setStatus('ok')
      notifySynced()
    } catch {
      setStatus('err')
    } finally {
      setSyncing(false)
      setTimeout(() => setStatus(null), 3000)
    }
  }

  const idleLabel = bankLabel ? `Sync ${bankLabel}` : 'Sincronizar'

  return (
    <div className="sb-sync">
      <button
        className={`sync-btn${syncing ? ' spinning' : ''}${status === 'ok' ? ' sync-ok' : ''}${status === 'err' ? ' sync-err' : ''}`}
        onClick={handleSync}
        disabled={syncing}
        title={idleLabel}
      >
        <span className="sync-icon">⟳</span>
        <span className="sync-label">
          {syncing ? 'Sincronizando…' : status === 'ok' ? 'Listo' : status === 'err' ? 'Error' : idleLabel}
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
  { to: '/importar',     label: 'Importar',     icon: '↑' },
]

function AccountSwitcher() {
  const { accounts, selectedAccount, selectedId, select } = useAccount()
  const [open, setOpen] = useState(false)

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0)
  const selectedIdx  = selectedAccount ? accounts.indexOf(selectedAccount) : -1
  const activeColor  = selectedAccount ? ACCT_COLORS[selectedIdx % ACCT_COLORS.length] : 'var(--accent)'

  function choose(id) {
    select(id)
    setOpen(false)
  }

  return (
    <div className="acct-switcher">
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 6px', borderRadius: 7, cursor: 'pointer', transition: 'background var(--t)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeColor, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: activeColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedAccount ? selectedAccount.name : 'Todas las cuentas'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>
            {formatCLP(selectedAccount ? (selectedAccount.balance ?? 0) : totalBalance)}
          </div>
        </div>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* All accounts option */}
          <div
            onClick={() => choose(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 5, cursor: 'pointer', background: selectedId === null ? 'var(--surface2)' : 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
            onMouseLeave={e => e.currentTarget.style.background = selectedId === null ? 'var(--surface2)' : 'transparent'}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: selectedId === null ? 700 : 500, color: selectedId === null ? 'var(--accent)' : 'var(--text-muted)' }}>
                Todas las cuentas
              </div>
            </div>
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
              {formatCLP(totalBalance)}
            </span>
          </div>

          {accounts.map((a, i) => {
            const color = ACCT_COLORS[i % ACCT_COLORS.length]
            const isSelected = selectedId === a.id
            return (
              <div
                key={a.id}
                onClick={() => choose(a.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 5, cursor: 'pointer', background: isSelected ? 'var(--surface2)' : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = isSelected ? 'var(--surface2)' : 'transparent'}
              >
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: isSelected ? 700 : 500, color: isSelected ? color : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{getBankLabel(a.bank_id)}</div>
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

function InferenceToggle() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('arasaka_user'))
      return u?.settings?.inference_enabled !== false
    } catch { return true }
  })
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const next = !enabled
    setEnabled(next)
    setSaving(true)
    try {
      const u = JSON.parse(localStorage.getItem('arasaka_user'))
      const nextSettings = { ...(u?.settings ?? { personal_enabled: true, app_enabled: true }), inference_enabled: next }
      await api.updateUserSettings(nextSettings)
      if (u) localStorage.setItem('arasaka_user', JSON.stringify({ ...u, settings: nextSettings }))
    } catch { setEnabled(!next) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.03em' }}>
        Inferencia tags
      </span>
      <button
        onClick={toggle}
        disabled={saving}
        style={{
          fontSize: 10, padding: '3px 10px', borderRadius: 4, cursor: saving ? 'default' : 'pointer',
          fontWeight: 700, border: `1px solid ${enabled ? 'var(--accent)66' : 'var(--border)'}`,
          background: enabled ? 'var(--accent)22' : 'var(--surface2)',
          color: enabled ? 'var(--accent)' : 'var(--text-dim)',
          transition: 'all var(--t)',
        }}
      >
        {saving ? '…' : enabled ? 'ON' : 'OFF'}
      </button>
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

      <InferenceToggle />

      <SyncButton />

      <div className="sb-user">
        <div className="avatar">{(user?.email || 'U')[0].toUpperCase()}</div>
        <div>
          <div className="sb-user-name">{user?.email || 'Usuario'}</div>
          <div className="sb-user-out" onClick={onLogout}>Cerrar sesión</div>
        </div>
      </div>
    </aside>
  )
}
