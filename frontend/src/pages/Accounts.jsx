import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { formatCLP, formatDate } from '../lib/formatters'
import { ACCT_COLORS, SUPPORTED_BANKS, ACCT_TYPES, getBankLabel, getCatColor } from '../lib/constants'
import Spinner from '../components/Spinner'
import CatIcon from '../components/CatIcon'
import CustomSelect from '../components/CustomSelect'

// ── TC Text Parser ──────────────────────────────────────────────────────────

const TC_TAG_OPTIONS = ['Transporte', 'Casa', 'Salud', 'Suscripciones', 'Gustos', 'Seguros', 'Personal', 'Otros']

function guessTag(desc) {
  const d = desc.toLowerCase()
  if (/uber|metro|copec|shell|bip|transantiago|cabify|lyft/i.test(d)) return 'Transporte'
  if (/jumbo|l[ií]der|tottus|unimarc|walmart|santa isabel|supermercado/i.test(d)) return 'Casa'
  if (/farmacia|cruz verde|salcobrand|cl[ií]nica|hospital|m[eé]dico|dental/i.test(d)) return 'Salud'
  if (/netflix|spotify|apple|google|amazon|hbo|disney|prime|youtube/i.test(d)) return 'Suscripciones'
  if (/restaurant|caf[eé]|starbucks|rappi|uber eats|pedidos|dominos|pizza|sushi/i.test(d)) return 'Gustos'
  if (/seguro|consorcio|mapfre|liberty|bci seguros/i.test(d)) return 'Seguros'
  return 'Gustos'
}

function parseCardLines(text) {
  const results = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    let working = line

    // 1. Find date (yyyy-mm-dd takes priority; fallback to dd/mm/yy or dd-mm-yy)
    let fecha = null
    let dateStr = ''
    const ymd = working.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
    const dmy = working.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/)
    if (ymd) {
      fecha = ymd[0]
      dateStr = ymd[0]
    } else if (dmy) {
      const [full, d, m, y] = dmy
      const year = y.length === 2 ? '20' + y : y
      fecha = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      dateStr = full
    }
    if (!fecha) continue
    working = working.replace(dateStr, ' ')

    // 2. Find installments — "Cuota 1 de 12" or bare "N/M" (both ≤ 2 digits)
    let cuotas = null
    const cuotaText = working.match(/[Cc]uota\s+(\d+)\s+de\s+(\d+)/i)
    const cuotaSlash = working.match(/\b(\d{1,2})\/(\d{1,2})\b/)
    if (cuotaText) {
      cuotas = { num: parseInt(cuotaText[1], 10), total: parseInt(cuotaText[2], 10) }
      working = working.replace(cuotaText[0], ' ')
    } else if (cuotaSlash && parseInt(cuotaSlash[2], 10) > 1) {
      cuotas = { num: parseInt(cuotaSlash[1], 10), total: parseInt(cuotaSlash[2], 10) }
      working = working.replace(cuotaSlash[0], ' ')
    }

    // 3. Find amount — last number in remaining text; Chilean format (dot=thousands, comma=decimal)
    const amtMatch = working.match(/\$?((?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?)\s*$/)
    let monto = 0
    if (amtMatch) {
      const raw = amtMatch[1].replace(/\./g, '').replace(',', '.')
      monto = Math.round(parseFloat(raw) || 0)
      working = working.substring(0, amtMatch.index)
    }
    if (monto <= 0) continue

    // 4. Clean description
    const desc = working.replace(/^[\s\-·•|]+/, '').replace(/[\s\-·•|]+$/, '').trim()
    if (!desc) continue

    results.push({ fecha, descripcion: desc, monto, cuotas, tags: [guessTag(desc)] })
  }
  return results
}

// ── Step 1: Paste text ──────────────────────────────────────────────────────

function TCImportStep1({ text, onTextChange, onAnalyze, onClose }) {
  return (
    <>
      <div className="modal-hdr">
        <div className="modal-ttl">Cargar movimientos · Paso 1/2</div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
        Pega el texto de tu estado de cuenta. El parser detecta fecha, descripción, monto y cuotas opcionales (ej. 1/12).
      </p>
      <textarea
        value={text}
        onChange={e => onTextChange(e.target.value)}
        className="finput"
        rows={12}
        autoFocus
        placeholder={`Ejemplo:\n05/01/2026  SUPERMERCADO LIDER         12.345\n15/01/2026  NETFLIX.COM                  9.990\n20/01/2026  FARMACIA CRUZ VERDE 1/3     15.000`}
        style={{ fontFamily: 'var(--mono)', fontSize: 12, resize: 'vertical', lineHeight: 1.7 }}
      />
      <div className="mfooter" style={{ marginTop: 16 }}>
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-gold" onClick={onAnalyze} disabled={!text.trim()}>Analizar →</button>
      </div>
    </>
  )
}

// ── Step 2: Preview table ───────────────────────────────────────────────────

function TCImportStep2({ rows, onRowsChange, onBack, onClose, onImport, importing }) {
  const selected = rows.filter(r => r.selected)
  const total = selected.reduce((sum, r) => sum + r.monto, 0)

  function setRow(idx, patch) {
    onRowsChange(rows.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function toggleAll() {
    const allOn = rows.every(r => r.selected)
    onRowsChange(rows.map(r => ({ ...r, selected: !allOn })))
  }

  return (
    <>
      <div className="modal-hdr">
        <div className="modal-ttl">Cargar movimientos · Paso 2/2</div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>
          {selected.length} de {rows.length} seleccionados
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>
          Total: {formatCLP(total)}
        </span>
      </div>

      {/* Scrollable table */}
      <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0, zIndex: 1 }}>
              <th style={{ width: 30, padding: '6px 8px' }}>
                <input type="checkbox" checked={rows.every(r => r.selected)} onChange={toggleAll}
                  style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
              </th>
              <th style={{ padding: '6px 8px', fontSize: 10, textAlign: 'left', letterSpacing: '.07em', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Fecha</th>
              <th style={{ padding: '6px 8px', fontSize: 10, textAlign: 'left', letterSpacing: '.07em', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Descripción</th>
              <th style={{ padding: '6px 8px', fontSize: 10, textAlign: 'left', letterSpacing: '.07em', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Tag</th>
              <th style={{ padding: '6px 8px', fontSize: 10, textAlign: 'right', letterSpacing: '.07em', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Monto</th>
              <th style={{ width: 28 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} style={{ borderBottom: '1px solid rgba(39,39,41,.7)', opacity: row.selected ? 1 : .45, transition: 'opacity var(--t)' }}>
                <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                  <input type="checkbox" checked={row.selected} onChange={() => setRow(idx, { selected: !row.selected })}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent)' }} />
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <input type="date" value={row.fecha} onChange={e => setRow(idx, { fecha: e.target.value })}
                    style={{ fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 5px', color: 'var(--text)', width: 120 }} />
                </td>
                <td style={{ padding: '4px 6px', minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <input value={row.descripcion} onChange={e => setRow(idx, { descripcion: e.target.value })}
                      style={{ fontFamily: 'var(--font)', fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 6px', color: 'var(--text)', width: '100%' }} />
                    {row.cuotas && (
                      <span style={{ fontSize: 9, whiteSpace: 'nowrap', padding: '2px 5px', borderRadius: 3, background: 'rgba(201,168,76,.15)', color: 'var(--accent)', fontFamily: 'var(--mono)', fontWeight: 700 }}>
                        {row.cuotas.num}/{row.cuotas.total}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <select value={row.tags[0] || 'Gustos'} onChange={e => setRow(idx, { tags: [e.target.value] })}
                    style={{ fontFamily: 'var(--font)', fontSize: 11, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 5px', color: getCatColor(row.tags[0] || 'Gustos') }}>
                    {TC_TAG_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                  <input type="number" value={row.monto} onChange={e => setRow(idx, { monto: Math.abs(parseInt(e.target.value, 10) || 0) })}
                    style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 6px', color: 'var(--red)', textAlign: 'right', width: 90, fontWeight: 700 }} />
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                  <button onClick={() => onRowsChange(rows.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}
                    title="Eliminar fila">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-dim)', fontSize: 13 }}>
          No se detectaron movimientos válidos.
        </div>
      )}

      <div className="mfooter" style={{ marginTop: 16 }}>
        <button className="btn-ghost" onClick={onBack} style={{ marginRight: 'auto' }}>← Volver</button>
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-gold" onClick={onImport} disabled={importing || selected.length === 0}>
          {importing ? 'Importando…' : `Importar ${selected.length} movimiento${selected.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </>
  )
}

// ── TCImportModal ───────────────────────────────────────────────────────────

function TCImportModal({ account, onClose, onDone }) {
  const [step, setStep] = useState(1)
  const [text, setText] = useState('')
  const [rows, setRows] = useState([])
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)

  function analyze() {
    const parsed = parseCardLines(text)
    setRows(parsed.map((r, i) => ({ ...r, id: `tc_${Date.now()}_${i}`, selected: true })))
    setStep(2)
  }

  async function doImport() {
    const selected = rows.filter(r => r.selected)
    if (!selected.length) return
    setImporting(true)
    setError(null)
    try {
      const transactions = selected.map(r => ({
        date:        r.fecha,
        description: r.descripcion,
        amount:      r.monto,
        flow:        'EXPENSE',
        tags:        r.tags,
      }))
      await api.createTransactionBatch(account.id, transactions)
      onDone()
      onClose()
    } catch (e) {
      setError(e.message || 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="overlay fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 720, maxWidth: '96vw' }}>
        {error && <p style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{error}</p>}
        {step === 1
          ? <TCImportStep1 text={text} onTextChange={setText} onAnalyze={analyze} onClose={onClose} />
          : <TCImportStep2 rows={rows} onRowsChange={setRows} onBack={() => setStep(1)} onClose={onClose} onImport={doImport} importing={importing} />
        }
      </div>
    </div>
  )
}

function PillToggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 40, height: 22, borderRadius: 11, flexShrink: 0,
        background: value ? 'var(--accent)' : 'var(--surface2)',
        border: `1px solid ${value ? 'var(--accent)' : 'var(--border)'}`,
        cursor: 'pointer', position: 'relative',
        transition: 'background var(--t), border-color var(--t)',
      }}
    >
      <div style={{
        position: 'absolute', top: 2,
        left: value ? 20 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: value ? '#0c0c0e' : 'var(--text-dim)',
        transition: 'left var(--t)',
      }} />
    </div>
  )
}

function SettingRow({ label, description, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{description}</div>}
      </div>
      {children}
    </div>
  )
}

function AccountModal({ account, onSave, onDelete, onClose }) {
  const hasStoredPassword = !!(account?.settings?.pdf_password)
  const [f, setF] = useState({
    name:              account?.name      ?? '',
    bank_id:           account?.bank_id   ?? SUPPORTED_BANKS[0]?.id ?? 'banco_de_chile',
    type:              account?.type      ?? 'Cuenta corriente',
    color:             account?.color     ?? ACCT_COLORS[0],
    inference_enabled: account?.settings?.inference_enabled ?? true,
    pdf_password:      '',
  })
  const [showPwd, setShowPwd] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const isCC = f.type === 'Tarjeta de crédito'

  return (
    <div className="overlay fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 440 }}>
        <div className="modal-ttl">{account ? 'Editar cuenta' : 'Nueva cuenta'}</div>
        <div style={{ height: 4, borderRadius: 2, background: f.color, marginBottom: 20, opacity: .7 }} />

        {/* ── Datos ── */}
        <div className="fgrid">
          <div className="ff full">
            <div className="flbl">Nombre</div>
            <input className="finput" placeholder="Ej: Cuenta corriente BCI" value={f.name} onChange={e => set('name', e.target.value)} autoFocus />
          </div>
          <div className="ff">
            <div className="flbl">Banco</div>
            <CustomSelect
              value={f.bank_id}
              onChange={v => set('bank_id', v)}
              options={SUPPORTED_BANKS.map(b => ({ value: b.id, label: b.label }))}
            />
          </div>
          <div className="ff">
            <div className="flbl">Tipo</div>
            <CustomSelect
              value={f.type}
              onChange={v => set('type', v)}
              options={ACCT_TYPES.map(t => ({ value: t, label: t }))}
            />
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

        {/* ── Separador Configuración ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 18px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Configuración</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Inference toggle */}
          <SettingRow label="Inferencia de tags" description="Sugerencias automáticas al escribir transacciones">
            <PillToggle value={f.inference_enabled} onChange={v => set('inference_enabled', v)} />
          </SettingRow>

          {/* PDF password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SettingRow label="Clave PDF" description="Descifra PDFs automáticamente al importar">
              {hasStoredPassword && !f.pdf_password && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                  background: 'rgba(76,175,125,.12)', border: '1px solid rgba(76,175,125,.25)',
                  color: 'var(--green)', letterSpacing: '0.04em',
                }}>✓ Guardada</span>
              )}
            </SettingRow>
            <div style={{ position: 'relative' }}>
              <input
                className="finput"
                type={showPwd ? 'text' : 'password'}
                placeholder={hasStoredPassword ? 'Dejar vacío para no cambiar' : 'Sin clave configurada'}
                value={f.pdf_password}
                onChange={e => set('pdf_password', e.target.value)}
                style={{ paddingRight: 38 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                title={showPwd ? 'Ocultar' : 'Mostrar'}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: showPwd ? 'var(--accent)' : 'var(--text-dim)',
                  fontSize: 14, lineHeight: 1, padding: 2, transition: 'color var(--t)',
                }}
              >
                {showPwd ? '●' : '○'}
              </button>
            </div>
          </div>
        </div>

        <div className="mfooter" style={{ marginTop: 24 }}>
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
  const [tcImport, setTcImport] = useState(null) // account being imported into

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
            const isTC = a.type === 'Tarjeta de crédito'
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
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: isTC ? 12 : 0 }}>
                  {a.movement_count ?? 0} movimientos{last ? ` · último: ${last}` : ''}
                </div>
                {isTC && (
                  <button
                    onClick={e => { e.stopPropagation(); setTcImport(a) }}
                    style={{
                      display: 'block', width: '100%', padding: '7px 0',
                      background: color + '18', border: `1px solid ${color}44`,
                      borderRadius: 6, color, fontSize: 11, fontWeight: 700,
                      letterSpacing: '.04em', cursor: 'pointer', fontFamily: 'var(--font)',
                      transition: 'background var(--t), border-color var(--t)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = color + '30'; e.currentTarget.style.borderColor = color + '88' }}
                    onMouseLeave={e => { e.currentTarget.style.background = color + '18'; e.currentTarget.style.borderColor = color + '44' }}
                  >
                    + CARGAR MOVIMIENTOS
                  </button>
                )}
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
      {tcImport && (
        <TCImportModal
          account={tcImport}
          onClose={() => setTcImport(null)}
          onDone={load}
        />
      )}
    </div>
  )
}
