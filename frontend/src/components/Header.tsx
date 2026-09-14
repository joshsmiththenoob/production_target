import { Link, NavLink } from 'react-router'

export default function Header() {
  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
          <path d="M20 34V15" />
          <path d="M20 23c-7 0-12-4-13-11 7-1 13 2 15 8" />
          <path d="M20 18c2-7 7-11 14-10 0 7-5 13-14 14" />
        </svg>
        <span>農業資料處理平台</span>
      </Link>
      <nav aria-label="主要導覽">
        <NavLink to="/" end>首頁</NavLink>
      </nav>
    </header>
  )
}
