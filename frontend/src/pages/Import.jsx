import { useState, useRef, useCallback } from 'react'
import { api } from '../api/client'
import { formatDate } from '../lib/formatters'
import { SUPPORTED_BANKS, getBankLabel } from '../lib/constants'
import { useAccount } from '../context/AccountContext'

// ─── helpers ────────────────────────────────────────────────────────────────

function formatPeriod(from, to) {
  if (!from && !to) return null
  if (from && to) return `${formatDate(from)} → ${formatDate(to)}`
  return formatDate(from || to)
}

function docTypeLabel(dt) {
  switch (dt) {
    case 'debit_monthly': return 'Cuenta corriente · mes completo'
    case 'debit_partial': return 'Cuenta corriente · parcial'
    case 'credit_card':   return 'Tarjeta de crédito'
    default: return null
  }
}

function FileStatusIcon({ result }) {
  if (result.error) return <span style={{ color: 'var(--red)' }}>✕</span>
  if (result.duplicates > 0 && result.imported === 0)
    return <span style={{ color: 'var(--text-dim)' }}>—</span>
  return <span style={{ color: 'var(--green, #4caf7d)' }}>✓</span>
}

// ─── sub-components ─────────────────────────────────────────────────────────

function DropZone({ files, onAdd, onRemove, disabled }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(e => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const dropped = [...e.dataTransfer.files].filter(f =>
      f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    )
    if (dropped.length) onAdd(dropped)
  }, [disabled, onAdd])

  const handleDragOver = useCallback(e => {
    e.preventDefault()
    if (!disabled) setDragging(true)
  }, [disabled])

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onClick={() => !disabled && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12,
          padding: '32px 24px',
          textAlign: 'center',
          cursor: disabled ? 'default' : 'pointer',
          transition: 'all var(--t)',
          background: dragging ? 'var(--accent)11' : 'transparent',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 8, color: 'var(--text-dim)' }}>📂</div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          Arrastra PDFs aquí o haz clic para seleccionar
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Máx 12 archivos · 10 MB cada uno · Solo PDF
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            const selected = [...e.target.files]
            if (selected.length) onAdd(selected)
            e.target.value = ''
          }}
        />
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--surface2)', borderRadius: 8, padding: '6px 12px',
            }}>
              <span style={{ fontSize: 14 }}>📄</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {(f.size / 1024).toFixed(0)} KB
                </div>
              </div>
              {!disabled && (
                <button
                  onClick={e => { e.stopPropagation(); onRemove(i) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 14, padding: '0 4px', lineHeight: 1 }}
                >✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ResultPanel({ result }) {
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Importación completada</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {getBankLabel(result.bank_id)} · cuenta #{result.account_id}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--accent)' }}>
            {result.total_imported}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>importados</div>
        </div>
        {result.total_duplicates > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-dim)' }}>
              {result.total_duplicates}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>duplicados</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(result.files || []).map((fr, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '20px 1fr auto auto',
            alignItems: 'center',
            gap: 10,
            background: 'var(--surface2)',
            borderRadius: 8,
            padding: '8px 12px',
          }}>
            <FileStatusIcon result={fr} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {fr.filename}
                </span>
                {fr.doc_type && !fr.error && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase',
                    color: 'var(--accent)', background: 'var(--accent-dim)',
                    border: '1px solid rgba(201,168,76,.2)',
                    borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {docTypeLabel(fr.doc_type)}
                  </span>
                )}
              </div>
              {fr.error
                ? <div style={{ fontSize: 10, color: 'var(--red)' }}>{fr.error}</div>
                : <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {formatPeriod(fr.period_from, fr.period_to)}
                  </div>
              }
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)' }}>
              {fr.imported > 0 ? `+${fr.imported}` : ''}
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)', minWidth: 28 }}>
              {fr.duplicates > 0 ? `${fr.duplicates} dup` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function Import() {
  const { selectedAccount } = useAccount()
  const [files, setFiles]           = useState([])
  const [uploading, setUploading]   = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)

  const isSupported = selectedAccount && SUPPORTED_BANKS.some(b => b.id === selectedAccount.bank_id)

  function addFiles(newFiles) {
    setFiles(prev => [...prev, ...newFiles].slice(0, 12))
    setResult(null)
    setError(null)
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleImport() {
    if (!isSupported || files.length === 0 || uploading) return
    setUploading(true)
    setResult(null)
    setError(null)
    try {
      const res = await api.importAccountPDF(selectedAccount.id, files)
      setResult(res)
      setFiles([])
    } catch (e) {
      setError(e.message || 'Error al importar')
    } finally {
      setUploading(false)
    }
  }

  const canImport = isSupported && files.length > 0 && !uploading

  return (
    <div className="fade">
      <div className="ph">
        <div className="ph-title">Importar cartola</div>
        <div className="ph-sub">
          {isSupported
            ? `Sube PDFs de ${getBankLabel(selectedAccount.bank_id)} para cargar movimientos en ${selectedAccount.name}`
            : 'Sube PDFs de Santander o Banco de Chile para cargar tus movimientos'}
        </div>
      </div>

      {!selectedAccount ? (
        <div className="empty">
          <h3>Selecciona una cuenta</h3>
          <p>Elige una cuenta en el menú lateral para importar su cartola.</p>
        </div>
      ) : !isSupported ? (
        <div className="empty">
          <h3>Cuenta no compatible</h3>
          <p>{selectedAccount.name} no tiene importación PDF disponible. Selecciona una cuenta de Santander o Banco de Chile.</p>
        </div>
      ) : (
        <>
          {/* ── File dropzone ────────────────────────────────────── */}
          <div style={{ marginBottom: 24 }}>
            <DropZone
              files={files}
              onAdd={addFiles}
              onRemove={removeFile}
              disabled={uploading}
            />
          </div>

          {/* ── Action button ────────────────────────────────────── */}
          {error && (
            <div style={{ background: 'rgba(224,92,92,.12)', border: '1px solid rgba(224,92,92,.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn-gold"
              onClick={handleImport}
              disabled={!canImport}
              style={{ opacity: canImport ? 1 : 0.4, cursor: canImport ? 'pointer' : 'default' }}
            >
              {uploading
                ? 'Importando…'
                : `Importar${files.length > 0 ? ` (${files.length} PDF${files.length > 1 ? 's' : ''})` : ''}`}
            </button>
            {files.length > 0 && !uploading && (
              <button className="btn-ghost" onClick={() => setFiles([])}>Limpiar lista</button>
            )}
          </div>

          {/* ── Results ──────────────────────────────────────────── */}
          {result && <ResultPanel result={result} />}
        </>
      )}
    </div>
  )
}
