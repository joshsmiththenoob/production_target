import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

function LocationProbe() {
  return <output aria-label="current path">{useLocation().pathname}</output>
}

function renderRoute(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
})
afterEach(() => vi.unstubAllGlobals())

describe('application routes', () => {
  it('shows the home heading and both task entries', () => {
    renderRoute()
    expect(screen.getByRole('heading', { level: 1, name: '今天要處理哪一項工作？' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '果品生產量值整併' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'DOCX／XLSX 表格比對' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '開始果品整併' })).toHaveAttribute('href', '/fruit-merge')
    expect(screen.getByRole('link', { name: '查看比對功能說明' })).toHaveAttribute('href', '/table-compare')
  })
  // 針對 cta, path, placeholder 進行測試 
  it.each([
    ['開始果品整併', '/fruit-merge', '功能建置中'],
    ['查看比對功能說明', '/table-compare', '尚未開放'],
  ])('navigates with %s and returns home', (cta, path, placeholder) => {
    renderRoute()
    // 確認點擊連結的 (name: cta)
    fireEvent.click(screen.getByRole('link', { name: cta }))
    expect(screen.getByLabelText('current path')).toHaveTextContent(path)
    expect(screen.getByRole('heading', { name: placeholder })).toBeInTheDocument()
    expect(screen.queryByLabelText('系統連線狀態')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: '返回首頁' }))
    expect(screen.getByRole('heading', { level: 1, name: '今天要處理哪一項工作？' })).toBeInTheDocument()
  })

  it.each([
    ['/fruit-merge', '果品生產量值整併'],
    ['/table-compare', 'DOCX／XLSX 表格比對'],
  ])('renders a direct visit to %s with shared navigation', (path, title) => {
    renderRoute(path)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: '首頁' }))
    expect(screen.getByRole('heading', { level: 1, name: '今天要處理哪一項工作？' })).toBeInTheDocument()
  })
})
