import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Monthly from './pages/Monthly'
import Annual from './pages/Annual'
import Ledger from './pages/Ledger'
import Categories from './pages/Categories'
import CreditCard from './pages/CreditCard'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/monthly" replace />} />
          <Route path="monthly"     element={<Monthly />} />
          <Route path="annual"      element={<Annual />} />
          <Route path="ledger"      element={<Ledger />} />
          <Route path="categories"  element={<Categories />} />
          <Route path="credit-card" element={<CreditCard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
