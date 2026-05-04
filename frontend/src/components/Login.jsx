import { useState } from 'react'
import { api } from '../api/client'

export default function Login({ onLogin }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const result = await api.login(email, password)
      onLogin(result)
    } catch {
      setError('Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card fade">
        <div className="login-wordmark">ARASAKA</div>
        <div className="login-line" />
        <div className="login-sub">Control financiero personal</div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              color: 'var(--text)',
              padding: '10px 14px',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'var(--font)',
            }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              color: 'var(--text)',
              padding: '10px 14px',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'var(--font)',
            }}
          />

          {error && (
            <div style={{ fontSize: 13, color: 'var(--red)', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
