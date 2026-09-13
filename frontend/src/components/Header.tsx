import { Link, NavLink } from 'react-router'

export default function Header() {
  return (
    <header className="site-header">
      <Link className="brand" to="/">農業資料處理平台</Link>
      <nav aria-label="主要導覽">
        <NavLink to="/" end>首頁</NavLink>
      </nav>
    </header>
  )
}
