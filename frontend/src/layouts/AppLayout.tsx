import { Outlet } from 'react-router'
import Header from '../components/Header'

export default function AppLayout() {
  return (
    <>
      <Header />
      <main className="site-main"><Outlet /></main>
    </>
  )
}
