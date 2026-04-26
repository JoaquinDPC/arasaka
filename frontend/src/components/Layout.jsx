import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout({ user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="layout">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Mobile top bar */}
      <div className="top-bar">
        <button className="hamburger" onClick={() => setSidebarOpen(v => !v)} aria-label="Menú">
          <span /><span /><span />
        </button>
        <span className="top-bar-title">ARASAKA</span>
      </div>

      <Sidebar
        user={user}
        onLogout={onLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
