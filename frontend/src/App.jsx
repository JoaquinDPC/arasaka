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

function getUser() {
  try { return JSON.parse(localStorage.getItem('arasaka_user')) } catch { return null }
}

export default function App() {
  const [user, setUser] = useState(() => getUser())

  const handleLogout = useCallback(() => {
    localStorage.removeItem('arasaka_user')
    localStorage.removeItem('arasaka_token')
    setUser(null)
  }, [])

  // Auto-logout when any API call receives a 401
  useEffect(() => {
    window.addEventListener('arasaka:unauthorized', handleLogout)
    return () => window.removeEventListener('arasaka:unauthorized', handleLogout)
  }, [handleLogout])

  function handleLogin({ token, user: u }) {
    localStorage.setItem('arasaka_token', token)
    localStorage.setItem('arasaka_user', JSON.stringify(u))
    setUser(u)
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
