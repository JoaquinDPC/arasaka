import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
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

function getUser() {
  try { return JSON.parse(localStorage.getItem('arasaka_user')) } catch { return null }
}

export default function App() {
  const [user, setUser] = useState(() => getUser())

  function handleLogin(u) {
    localStorage.setItem('arasaka_user', JSON.stringify(u))
    setUser(u)
  }
  function handleLogout() {
    localStorage.removeItem('arasaka_user')
    setUser(null)
  }

  if (!user) return <Login onLogin={handleLogin} />

  return (
    <BrowserRouter>
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
