import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

export function InfoTooltip({ title, children, width = 300, align = 'left' }) {
  const [open, setOpen] = useState(false)
  const [popPos, setPopPos] = useState({ top: 0, left: 0, width, arrowLeft: 7 })
  const btnRef = useRef(null)
  const popRef = useRef(null)
  const isTouch = useRef(
    typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches
  )

  const calcPos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const popW = Math.min(width, vw - 32)

    let left = align === 'right'
      ? r.right - popW
      : r.left
    left = Math.max(16, Math.min(left, vw - popW - 16))

    const arrowLeft = Math.max(5, Math.min(r.left + r.width / 2 - left - 5, popW - 15))

    setPopPos({ top: r.bottom + 10, left, width: popW, arrowLeft })
  }, [width, align])

  useEffect(() => {
    if (!open) return
    calcPos()
    function onOutside(e) {
      if (btnRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [open, calcPos])

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 6 }}
      onMouseEnter={() => { if (!isTouch.current) setOpen(true) }}
      onMouseLeave={() => { if (!isTouch.current) setOpen(false) }}
    >
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        style={{
          width: 15, height: 15, borderRadius: '50%',
          border: '1px solid var(--text-muted)', background: 'transparent',
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', padding: 0, opacity: 0.6,
          fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 10,
          color: 'var(--text-muted)', lineHeight: 1, flexShrink: 0,
        }}
      >i</button>

      {open && createPortal(
        <div
          ref={popRef}
          style={{
            position: 'fixed',
            top: popPos.top,
            left: popPos.left,
            width: popPos.width,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '14px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,.65)',
            zIndex: 1000,
            animation: 'tooltip-in 180ms ease',
          }}
        >
          <span style={{
            position: 'absolute',
            top: -5,
            left: popPos.arrowLeft,
            width: 9, height: 9,
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            borderTop: '1px solid var(--border)',
            transform: 'rotate(45deg)',
          }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 20, height: 1.5, background: 'var(--accent)', borderRadius: 1, opacity: 0.8 }} />
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.13em',
              textTransform: 'uppercase', color: 'var(--accent)',
            }}>{title}</span>
          </div>

          {children}
        </div>,
        document.body
      )}
    </span>
  )
}

export function InsightExplain({ desc, formula, ranges, note }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
      <p style={{ margin: '0 0 8px 0' }}>{desc}</p>

      {formula && (
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 11,
          background: 'rgba(0,0,0,.4)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '7px 10px', margin: '0 0 10px 0',
          color: 'var(--text-muted)', whiteSpace: 'pre-wrap',
        }}>
          {formula}
        </div>
      )}

      {ranges?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          {ranges.map(r => (
            <div key={r.range} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: r.color === 'green' ? 'var(--green)'
                  : r.color === 'orange' ? '#d4884c'
                  : 'var(--red)',
              }} />
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-muted)', minWidth: 54 }}>
                {r.range}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{r.label}</span>
            </div>
          ))}
        </div>
      )}

      {note && (
        <p style={{ margin: 0, fontSize: 11, fontStyle: 'italic', color: 'var(--text-dim)' }}>{note}</p>
      )}
    </div>
  )
}
