import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { AccountProvider } from './context/AccountContext'
import Layout from './components/Layout'
import Login from './components/Login'
import Home from './pages/Home'
import Monthly from './pages/Monthly'
import Annual from './pages/Annual'
import Categories from './pages/Categories'
import Ledger from './pages/Ledger'
import Accounts from './pages/Accounts'
import Budgets from './pages/Budgets'
import Debts from './pages/Debts'
import Import from './pages/Import'
import CreditCard from './pages/CreditCard'

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'
const DEV_USER = { id: 1, email: 'dev@local' }

function decodeToken(token) {
  try {
    const [, payload] = token.split('.')
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    if (!decoded.user_id || !decoded.email) return null
    return { id: decoded.user_id, email: decoded.email }
  } catch { return null }
}

function getUser() {
  if (DEV_BYPASS) return DEV_USER
  const token = localStorage.getItem('arasaka_token')
  if (!token) return null
  return decodeToken(token)
}

export default function App() {
  const [user, setUser] = useState(() => getUser())

  const handleLogout = useCallback(() => {
    localStorage.removeItem('arasaka_token')
    setUser(null)
  }, [])

  useEffect(() => {
    if (DEV_BYPASS) return
    window.addEventListener('arasaka:unauthorized', handleLogout)
    return () => window.removeEventListener('arasaka:unauthorized', handleLogout)
  }, [handleLogout])

  function handleLogin({ token }) {
    localStorage.setItem('arasaka_token', token)
    setUser(decodeToken(token))
  }

  if (!user) return <Login onLogin={handleLogin} />

  return (
    <BrowserRouter>
      <AccountProvider>
        <Routes>
          <Route path="/" element={<Layout user={user} onLogout={handleLogout} />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home"         element={<Home />}       />
          <Route path="mensual"      element={<Monthly />}    />
          <Route path="anual"        element={<Annual />}     />
          <Route path="categorias"   element={<Categories />} />
          <Route path="movimientos"  element={<Ledger />}     />
          <Route path="cuentas"      element={<Accounts />}   />
          <Route path="deudas"       element={<Debts />}      />
          <Route path="presupuestos" element={<Budgets />}    />
          <Route path="importar"     element={<Import />}     />
          <Route path="tarjeta"      element={<CreditCard />} />
          </Route>
        </Routes>
      </AccountProvider>
    </BrowserRouter>
  )
}
