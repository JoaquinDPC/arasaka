import { useState, useRef, useEffect } from 'react'
import { MONTHS } from '../lib/constants'

const DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']

function pad(n) { return String(n).padStart(2, '0') }

function parseDate(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return { y, m: m - 1, d }
}

function toISO(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

function formatDisplay(str) {
  if (!str) return ''
  const [y, m, d] = str.split('-')
  return `${d}/${m}/${y}`
}

export default function DatePicker({ value, onChange, placeholder = 'dd/mm/aaaa', className = '', style = {} }) {
  const today = new Date()
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate())

  const [open, setOpen] = useState(false)
  const [viewY, setViewY] = useState(() => {
    const p = parseDate(value)
    return p ? p.y : today.getFullYear()
  })
  const [viewM, setViewM] = useState(() => {
    const p = parseDate(value)
    return p ? p.m : today.getMonth()
  })
  const ref = useRef(null)

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function handleOpen() {
    if (!open && value) {
      const p = parseDate(value)
      if (p) { setViewY(p.y); setViewM(p.m) }
    }
    setOpen(o => !o)
  }

  function prevMonth() {
    if (viewM === 0) { setViewM(11); setViewY(y => y - 1) }
    else setViewM(m => m - 1)
  }
  function nextMonth() {
    if (viewM === 11) { setViewM(0); setViewY(y => y + 1) }
    else setViewM(m => m + 1)
  }

  function cells() {
    const firstDow = new Date(viewY, viewM, 1).getDay()
    const daysInMonth = new Date(viewY, viewM + 1, 0).getDate()
    const out = []
    for (let i = 0; i < firstDow; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) out.push(d)
    while (out.length % 7 !== 0) out.push(null)
    return out
  }

  function selectDay(d) {
    onChange(toISO(viewY, viewM, d))
    setOpen(false)
  }

  function goToday() {
    onChange(todayISO)
    setOpen(false)
  }

  return (
    <div ref={ref} className={className} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        className="fi dp-trigger"
        onClick={handleOpen}
        style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
      >
        <span style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 12, color: value ? 'var(--text)' : 'var(--text-dim)', letterSpacing: '0.04em' }}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity: 0.45, flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div className="cal-panel">
          <div className="cal-header">
            <button type="button" className="cal-nav" onClick={prevMonth}>‹</button>
            <span className="cal-month-lbl">{MONTHS[viewM]} {viewY}</span>
            <button type="button" className="cal-nav" onClick={nextMonth}>›</button>
          </div>

          <div className="cal-grid">
            {DAYS.map(d => (
              <div key={d} className="cal-dow">{d}</div>
            ))}
            {cells().map((d, i) => {
              if (!d) return <div key={`e-${i}`} />
              const iso = toISO(viewY, viewM, d)
              const isSelected = value === iso
              const isToday = todayISO === iso
              return (
                <button
                  key={i}
                  type="button"
                  className={`cal-day${isSelected ? ' selected' : ''}${isToday && !isSelected ? ' today' : ''}`}
                  onClick={() => selectDay(d)}
                >
                  {d}
                </button>
              )
            })}
          </div>

          <div className="cal-footer">
            {value && (
              <button type="button" className="cal-act" onClick={() => { onChange(''); setOpen(false) }}>
                Borrar
              </button>
            )}
            <button type="button" className="cal-act cal-act-today" onClick={goToday}>
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
