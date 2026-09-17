import { Route, Routes } from 'react-router'

import './App.css'
import AppLayout from './layouts/AppLayout'
import HomePage from './pages/HomePage'
import VolumePriceMergePage from './pages/VolumePriceMergePage'
import TableComparePage from './pages/TableComparePage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* 當父路由沒有更多子路徑 Ex: "/volume-price-merge"，也就是網址正好是 '/' 時 -> 在 Outlet 顯示 HomePage */}
        <Route index element={<HomePage />} />
        <Route path="volume-price-merge" element={<VolumePriceMergePage />} />
        <Route path="table-compare" element={<TableComparePage />} />
      </Route>
    </Routes>
  )
}
