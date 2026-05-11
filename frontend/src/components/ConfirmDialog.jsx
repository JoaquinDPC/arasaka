import { useEffect, useRef } from 'react'

function TrashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function TriangleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

// Props:
//   open, onClose, onConfirm — visibility + callbacks
//   title — bold heading
//   message? — body text
//   details? — Array<{ label, value, color?, mono? }>
//   warning? — banner text with danger border
//   confirmLabel? — default "Eliminar"
//   cancelLabel? — default "Cancelar"
//   danger? — true = red + trash icon, false = accent + info icon
//   accentColor? — custom hex color overrides danger/accent
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  details,
  warning,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  danger = true,
  accentColor,
}) {
  const ref = useRef(null)

  // Resolve colors: cssColor for text/border (can be var()), baseHex for backgrounds with alpha
  const baseHex  = accentColor ?? (danger ? '#e05c5c' : '#c9a84c')
  const cssColor = accentColor ?? (danger ? 'var(--red)' : 'var(--accent)')
  const iconBg   = baseHex + '2e'
  const warnBg   = baseHex + '12'

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') onConfirm()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, onConfirm])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'cd-overlay-in 260ms ease',
      }}
    >
      <div
        ref={ref}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '28px 28px 24px',
          width: '100%',
          maxWidth: 440,
          margin: '0 16px',
          animation: 'cd-modal-in 260ms cubic-bezier(.22,.68,0,1.2)',
        }}
      >
        {/* Icon + Title */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20, textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
            color: cssColor,
          }}>
            {danger ? <TrashIcon /> : <InfoIcon />}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{title}</div>
        </div>

        {/* Message */}
        {message && (
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 18, lineHeight: 1.55 }}>
            {message}
          </div>
        )}

        {/* Details box */}
        {details && details.length > 0 && (
          <div style={{
            background: 'var(--surface2)', borderRadius: 8,
            padding: '12px 14px', marginBottom: 16,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {details.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{d.label}</span>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  fontFamily: d.mono ? 'var(--mono)' : undefined,
                  color: d.color ?? 'var(--text-muted)',
                }}>
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Warning banner */}
        {warning && (
          <div style={{
            borderLeft: `2px solid ${cssColor}`,
            background: warnBg,
            borderRadius: '0 6px 6px 0',
            padding: '9px 12px',
            marginBottom: 22,
            display: 'flex', alignItems: 'flex-start', gap: 8,
            color: cssColor,
          }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}><TriangleIcon /></span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{warning}</span>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 7,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: 7,
              border: 'none',
              background: cssColor,
              color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
