import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { formatCLP, formatDate } from '../lib/formatters'
import { ACCT_COLORS, SUPPORTED_BANKS, ACCT_TYPES, getBankLabel } from '../lib/constants'
import Spinner from '../components/Spinner'

function AccountModal({ account, onSave, onDelete, onClose }) {
  const [f, setF] = useState({
    name:     account?.name      ?? '',
    bank_id: account?.bank_id ?? SUPPORTED_BANKS[0]?.id ?? 'banco_de_chile',
    type:     account?.type      ?? 'Cuenta corriente',
    color:    account?.color     ?? ACCT_COLORS[0],
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <div className="overlay fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 440 }}>
        <div className="modal-ttl">{account ? 'Editar cuenta' : 'Nueva cuenta'}</div>
        <div style={{ height: 4, borderRadius: 2, background: f.color, marginBottom: 20, opacity: .7 }} />
        <div className="fgrid">
          <div className="ff full">
            <div className="flbl">Nombre</div>
            <input className="finput" placeholder="Ej: Cuenta corriente BCI" value={f.name} onChange={e => set('name', e.target.value)} autoFocus />
          </div>
          <div className="ff">
            <div className="flbl">Banco</div>
            <select className="finput" value={f.bank_id} onChange={e => set('bank_id', e.target.value)}>
              {SUPPORTED_BANKS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div className="ff">
            <div className="flbl">Tipo</div>
            <select className="finput" value={f.type} onChange={e => set('type', e.target.value)}>
              {ACCT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="ff full">
            <div className="flbl">Color</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              {ACCT_COLORS.map(c => (
                <div key={c} onClick={() => set('color', c)}
                  style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${f.color === c ? 'white' : 'transparent'}`, transition: 'border-color var(--t)' }} />
              ))}
            </div>
          </div>
        </div>
        <div className="mfooter">
          {onDelete && (
            <button onClick={onDelete} style={{ padding: '8px 16px', background: 'rgba(224,92,92,.15)', border: '1px solid rgba(224,92,92,.3)', borderRadius: 7, color: 'var(--red)', fontSize: 13, fontFamily: 'var(--font)', cursor: 'pointer', marginRight: 'auto' }}>
              Eliminar
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-gold" onClick={() => f.name.trim() && onSave(f)}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState(null)

  function load() {
    setLoading(true)
    api.accounts()
      .then(d => setAccounts(Array.isArray(d) ? d : []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function save(f) {
    if (editing) await api.updateAccount(editing.id, f).catch(() => {})
    else await api.createAccount(f).catch(() => {})
    load()
    setModal(false)
    setEditing(null)
  }

  async function remove(id) {
    await api.deleteAccount(id).catch(() => {})
    load()
    setModal(false)
    setEditing(null)
  }

  return (
    <div className="fade">
      <div className="ph" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="ph-title">Cuentas</div>
          <div className="ph-sub">Gestiona tus cuentas bancarias</div>
        </div>
        <button className="btn-gold" onClick={() => { setEditing(null); setModal(true) }}>+ Nueva cuenta</button>
      </div>

      {loading ? <Spinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
          {accounts.map((a, i) => {
            const color = a.color ?? ACCT_COLORS[i % ACCT_COLORS.length]
            const bal = a.balance ?? 0
            const last = a.last_movement ? formatDate(a.last_movement) : null
            return (
              <div key={a.id} className="card" style={{ borderColor: color + '44', cursor: 'pointer', transition: 'all var(--t)' }}
                onClick={() => { setEditing(a); setModal(true) }}
                onMouseEnter={e => e.currentTarget.style.borderColor = color + '99'}
                onMouseLeave={e => e.currentTarget.style.borderColor = color + '44'}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 10, color, padding: '2px 8px', background: color + '18', borderRadius: 4, fontWeight: 700, letterSpacing: '0.04em' }}>{a.type || 'Cuenta'}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600, letterSpacing: '0.04em' }}>{getBankLabel(a.bank_id)}</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{a.name}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, color: bal >= 0 ? color : 'var(--red)', lineHeight: 1, marginBottom: 12 }}>
                  {formatCLP(bal)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {a.movement_count ?? 0} movimientos{last ? ` · último: ${last}` : ''}
                </div>
              </div>
            )
          })}

          {/* Add card */}
          <div className="card" style={{ border: '1px dashed var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160, opacity: .5, transition: 'opacity var(--t)' }}
            onClick={() => { setEditing(null); setModal(true) }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '.5'}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>+</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Nueva cuenta</div>
            </div>
          </div>
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <div className="empty">
          <h3>Sin cuentas</h3>
          <p>Agrega tu primera cuenta bancaria.</p>
        </div>
      )}

      {modal && (
        <AccountModal
          account={editing}
          onSave={save}
          onDelete={editing ? () => remove(editing.id) : null}
          onClose={() => { setModal(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
