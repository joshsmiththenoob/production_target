import { Route, Routes } from 'react-router'

import './App.css'
import AppLayout from './layouts/AppLayout'
import HomePage from './pages/HomePage'
import FruitMergePage from './pages/FruitMergePage'
import TableComparePage from './pages/TableComparePage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* 當父路由沒有更多子路徑 Ex: "/fruit-merge"，也就是網址正好是 '/' 時 -> 在 Outlet 顯示 HomePage */}
        <Route index element={<HomePage />} />
        <Route path="fruit-merge" element={<FruitMergePage />} />
        <Route path="table-compare" element={<TableComparePage />} />
      </Route>
    </Routes>
  )
}
