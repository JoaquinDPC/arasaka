import { Outlet } from 'react-router-dom'
import TopNav from './TopNav'
import ScrollToTop from './ScrollToTop'

export default function Layout() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="pb-10">
        <Outlet />
      </main>
      <ScrollToTop />
    </div>
  )
}
