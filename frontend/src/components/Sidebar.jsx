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
  { to: '/tarjeta',      label: 'Tarjeta',      icon: '◉' },
  { to: '/cuentas',      label: 'Cuentas',      icon: '◎' },
  { to: '/deudas',       label: 'Deudas',       icon: '⇄' },
  { to: '/importar',     label: 'Importar',     icon: '↑' },
]

function AccountSettingsModal({ account, onClose, onSaved }) {
  const [inference, setInference]   = useState(account.settings?.inference_enabled ?? true)
  const [pwd, setPwd]               = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const hasStored                   = !!(account.settings?.pdf_password)

  async function save() {
    setSaving(true)
    try {
      await api.updateAccount(account.id, { inference_enabled: inference, pdf_password: pwd || undefined })
      onSaved()
      onClose()
    } catch { /* keep open */ }
    finally { setSaving(false) }
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, width: 360, maxWidth: '94vw' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Configuración</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{account.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Inference */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Inferencia de tags</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Sugerencias al escribir transacciones</div>
            </div>
            <div
              onClick={() => setInference(v => !v)}
              style={{
                width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                background: inference ? 'var(--accent)' : 'var(--surface2)',
                border: `1px solid ${inference ? 'var(--accent)' : 'var(--border)'}`,
                cursor: 'pointer', position: 'relative', transition: 'background var(--t), border-color var(--t)',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: inference ? 20 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: inference ? '#0c0c0e' : 'var(--text-dim)',
                transition: 'left var(--t)',
              }} />
            </div>
          </div>

          {/* PDF password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Clave PDF</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>Para descifrar PDFs al importar</div>
              </div>
              {hasStored && !pwd && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, flexShrink: 0, background: 'rgba(76,175,125,.12)', border: '1px solid rgba(76,175,125,.25)', color: 'var(--green)', letterSpacing: '0.04em' }}>
                  ✓ Guardada
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                placeholder={hasStored ? 'Dejar vacío para no cambiar' : 'Sin clave configurada'}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 38px 9px 13px', borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font)', outline: 'none' }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: showPwd ? 'var(--accent)' : 'var(--text-dim)', fontSize: 14, lineHeight: 1, padding: 2, transition: 'color var(--t)' }}
              >
                {showPwd ? '●' : '○'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'var(--t)' }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: 7, background: 'var(--accent)', border: 'none', color: '#0c0c0e', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font)', opacity: saving ? .6 : 1 }}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AccountSwitcher() {
  const { accounts, selectedAccount, selectedId, select, reload } = useAccount()
  const [open, setOpen]           = useState(false)
  const [settingsAcct, setSettingsAcct] = useState(null)

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0)
  const selectedIdx  = selectedAccount ? accounts.indexOf(selectedAccount) : -1
  const activeColor  = selectedAccount ? ACCT_COLORS[selectedIdx % ACCT_COLORS.length] : 'var(--accent)'

  function choose(id) {
    select(id)
    setOpen(false)
  }

  return (
    <>
    {settingsAcct && (
      <AccountSettingsModal
        account={settingsAcct}
        onClose={() => setSettingsAcct(null)}
        onSaved={reload}
      />
    )}
    <div className="acct-switcher">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
        <div
          onClick={() => setOpen(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 7, cursor: 'pointer', transition: 'background var(--t)', flex: 1, minWidth: 0 }}
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
          <span style={{ fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </div>

        {/* Gear button — only when a specific account is selected */}
        {selectedAccount && (
          <button
            onClick={e => { e.stopPropagation(); setSettingsAcct(selectedAccount) }}
            title="Configuración de cuenta"
            style={{
              background: 'none', border: '1px solid transparent', borderRadius: 6,
              color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, lineHeight: 1,
              padding: '5px 6px', flexShrink: 0, transition: 'color var(--t), border-color var(--t)',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)44' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'transparent' }}
          >
            ⚙
          </button>
        )}
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
    </>
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
        <div className="avatar">{(user?.email || 'U')[0].toUpperCase()}</div>
        <div>
          <div className="sb-user-name">{user?.email || 'Usuario'}</div>
          <div className="sb-user-out" onClick={onLogout}>Cerrar sesión</div>
        </div>
      </div>
    </aside>
  )
}
