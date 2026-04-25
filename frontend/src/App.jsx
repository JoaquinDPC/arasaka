import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Monthly from './pages/Monthly'
import Annual from './pages/Annual'
import Categories from './pages/Categories'
import Ledger from './pages/Ledger'
import Accounts from './pages/Accounts'
import Budgets from './pages/Budgets'
import CreditCard from './pages/CreditCard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home"         element={<Home />}       />
          <Route path="mensual"      element={<Monthly />}    />
          <Route path="anual"        element={<Annual />}     />
          <Route path="categorias"   element={<Categories />} />
          <Route path="movimientos"  element={<Ledger />}     />
          <Route path="cuentas"      element={<Accounts />}   />
          <Route path="presupuestos" element={<Budgets />}    />
          <Route path="credit-card"  element={<CreditCard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
