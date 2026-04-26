import { useState } from 'react'

export default function Login({ onLogin }) {
  const [loading, setLoading] = useState(false)

  function go() {
    setLoading(true)
    setTimeout(() => onLogin({ name: 'Usuario', email: 'usuario@gmail.com' }), 800)
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card fade">
        <div className="login-wordmark">ARASAKA</div>
        <div className="login-line" />
        <div className="login-sub">Control financiero personal</div>
        <button className="login-btn" onClick={go} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6A7.8 7.8 0 0 0 17 9c0-.57-.05-.97-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
          </svg>
          {loading ? 'Conectando…' : 'Continuar con Google'}
        </button>
      </div>
    </div>
  )
}
