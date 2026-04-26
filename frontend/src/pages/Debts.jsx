import { useState } from 'react'
import { formatCLP, formatDate } from '../lib/formatters'

function today() { return new Date().toISOString().slice(0, 10) }
function ls(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
function ss(k, v) { localStorage.setItem(k, JSON.stringify(v)) }

function DebtModal({ debt, onSave, onClose }) {
  const [f, setF] = useState({
    name:      debt?.name      ?? '',
    direction: debt?.direction ?? 'me-deben',
    amount:    debt?.amount    ?? '',
    desc:      debt?.desc      ?? '',
    date:      debt?.date      ?? today(),
    status:    debt?.status    ?? 'pendiente',
    notes:     debt?.notes     ?? '',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <div className="overlay fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 440 }}>
        <div className="modal-ttl">{debt ? 'Editar deuda' : 'Nueva deuda'}</div>
        <div className="fgrid">
          <div className="ff full">
            <div className="flbl">Dirección</div>
            <div className="toggle">
              <button className={`tbtn${f.direction === 'me-deben' ? ' ti' : ''}`} onClick={() => set('direction', 'me-deben')} style={{ fontSize: 12 }}>Me deben</button>
              <button className={`tbtn${f.direction === 'les-debo' ? ' te' : ''}`} onClick={() => set('direction', 'les-debo')} style={{ fontSize: 12 }}>Les debo</button>
            </div>
          </div>
          <div className="ff full">
            <div className="flbl">Persona</div>
            <input className="finput" placeholder="Nombre o apodo" value={f.name} onChange={e => set('name', e.target.value)} autoFocus />
          </div>
          <div className="ff">
            <div className="flbl">Monto CLP</div>
            <input type="number" className="finput" placeholder="0" value={f.amount} onChange={e => set('amount', e.target.value)} />
          </div>
          <div className="ff">
            <div className="flbl">Fecha</div>
            <input type="date" className="finput" value={f.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="ff full">
            <div className="flbl">Descripción</div>
            <input className="finput" placeholder="Ej: Cena, préstamo, split de cuenta…" value={f.desc} onChange={e => set('desc', e.target.value)} />
          </div>
          <div className="ff full">
            <div className="flbl">Notas</div>
            <textarea className="finput" rows={2} placeholder="Detalles adicionales…" value={f.notes}
              onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical', fontFamily: 'var(--font)' }} />
          </div>
          <div className="ff full">
            <div className="flbl">Estado</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['pendiente', 'parcial', 'pagado'].map(s => (
                <button key={s} onClick={() => set('status', s)}
                  style={{ flex: 1, padding: 8, borderRadius: 6, border: `1px solid ${f.status === s ? 'var(--accent)' : 'var(--border)'}`, background: f.status === s ? 'var(--accent-dim)' : 'transparent', color: f.status === s ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', textTransform: 'capitalize', transition: 'all var(--t)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mfooter">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-gold" onClick={() => f.name.trim() && f.amount && onSave(f)}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function DebtCard({ d, onClick }) {
  const isCredit = d.direction === 'me-deben'
  const color = isCredit ? 'var(--green)' : 'var(--red)'
  const statusC = { pendiente: 'var(--red)', parcial: '#d4884c', pagado: 'var(--green)' }[d.status]
  const days = Math.floor((new Date() - new Date(d.date + 'T12:00')) / 86400000)
  const borderBase = isCredit ? 'rgba(76,175,125,.25)' : 'rgba(224,92,92,.25)'
  const borderHover = isCredit ? 'rgba(76,175,125,.55)' : 'rgba(224,92,92,.55)'

  return (
    <div onClick={onClick} className="card" style={{ cursor: 'pointer', borderColor: d.status === 'pagado' ? 'var(--border)' : borderBase, opacity: d.status === 'pagado' ? .55 : 1, transition: 'all var(--t)' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = borderHover}
      onMouseLeave={e => e.currentTarget.style.borderColor = d.status === 'pagado' ? 'var(--border)' : borderBase}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{d.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d.desc || '—'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: d.status === 'pagado' ? 'var(--text-muted)' : color }}>
            {formatCLP(parseFloat(d.amount))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: statusC + '22', color: statusC, textTransform: 'capitalize' }}>{d.status}</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatDate(d.date)}</span>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {days === 0 ? 'hoy' : days === 1 ? 'ayer' : `hace ${days}d`}
        </span>
      </div>
      {d.notes && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8, lineHeight: 1.4 }}>{d.notes}</div>
      )}
    </div>
  )
}

export default function Debts() {
  const [debts, setDebts]   = useState(() => ls('arasaka_debts', []))
  const [modal, setModal]   = useState(false)
  const [editing, setEditing] = useState(null)

  function save(f) {
    let upd
    if (editing) {
      upd = debts.map(d => d.id === editing.id ? { ...d, ...f } : d)
    } else {
      upd = [...debts, { id: 'debt_' + Date.now(), ...f }]
    }
    setDebts(upd)
    ss('arasaka_debts', upd)
    setModal(false)
    setEditing(null)
  }

  function open(d = null) { setEditing(d); setModal(true) }

  const meDeben  = debts.filter(d => d.direction === 'me-deben')
  const lesDebo  = debts.filter(d => d.direction === 'les-debo')
  const totalMeDeben = meDeben.filter(d => d.status !== 'pagado').reduce((s, d) => s + parseFloat(d.amount || 0), 0)
  const totalLesDebo = lesDebo.filter(d => d.status !== 'pagado').reduce((s, d) => s + parseFloat(d.amount || 0), 0)
  const balance = totalMeDeben - totalLesDebo

  return (
    <div className="fade">
      <div className="ph" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="ph-title">Deudas</div>
          <div className="ph-sub">Seguimiento de préstamos y deudas personales</div>
        </div>
        <button className="btn-gold" onClick={() => open()}>+ Nueva</button>
      </div>

      {/* Summary */}
      <div className="stats" style={{ marginBottom: 24 }}>
        <div className="stat">
          <div className="stat-lbl">Me deben (pendiente)</div>
          <div className="stat-val" style={{ color: 'var(--green)', fontSize: 18 }}>{formatCLP(totalMeDeben)}</div>
          <div className="stat-delta">{meDeben.filter(d => d.status !== 'pagado').length} activas</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Les debo (pendiente)</div>
          <div className="stat-val" style={{ color: 'var(--red)', fontSize: 18 }}>{formatCLP(totalLesDebo)}</div>
          <div className="stat-delta">{lesDebo.filter(d => d.status !== 'pagado').length} activas</div>
        </div>
        <div className="stat" style={{ borderColor: balance >= 0 ? 'rgba(76,175,125,.25)' : 'rgba(224,92,92,.25)' }}>
          <div className="stat-lbl">Balance neto</div>
          <div className="stat-val" style={{ color: balance >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 18 }}>{formatCLP(Math.abs(balance))}</div>
          <div className="stat-delta">{balance >= 0 ? 'a tu favor' : 'debes más de lo que te deben'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
        {/* Me deben */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Me deben</div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>{meDeben.length}</span>
          </div>
          {meDeben.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...meDeben].sort((a, b) => a.status === 'pagado' ? 1 : b.status === 'pagado' ? -1 : 0).map(d => (
                <DebtCard key={d.id} d={d} onClick={() => open(d)} />
              ))}
            </div>
          ) : (
            <div className="card" style={{ border: '1px dashed var(--border)', textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: 13 }}>
              Nadie te debe nada<br /><span style={{ fontSize: 11 }}>por ahora</span>
            </div>
          )}
        </div>

        {/* Les debo */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)' }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Les debo</div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>{lesDebo.length}</span>
          </div>
          {lesDebo.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...lesDebo].sort((a, b) => a.status === 'pagado' ? 1 : b.status === 'pagado' ? -1 : 0).map(d => (
                <DebtCard key={d.id} d={d} onClick={() => open(d)} />
              ))}
            </div>
          ) : (
            <div className="card" style={{ border: '1px dashed var(--border)', textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: 13 }}>
              No le debes a nadie<br /><span style={{ fontSize: 11 }}>bien hecho</span>
            </div>
          )}
        </div>
      </div>

      {modal && <DebtModal debt={editing} onSave={save} onClose={() => { setModal(false); setEditing(null) }} />}
    </div>
  )
}
