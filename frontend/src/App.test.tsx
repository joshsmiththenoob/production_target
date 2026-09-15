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
    const { container } = renderRoute()
    const hero = screen.getByRole('region', { name: '今天要處理哪一項工作？' })
    expect(within(hero).getByRole('heading', { level: 1, name: '今天要處理哪一項工作？' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '果品生產量值整併' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'DOCX／XLSX 表格比對' })).toBeInTheDocument()
    expect(screen.getByText('已開放')).toBeInTheDocument()
    expect(screen.getByText('規劃中')).toBeInTheDocument()
    expect(
      screen.getByText('將統計處 SD 產出的同品項生產量與生產值資料，整併為單一匯總資料。'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('比對 Word 與 Excel 表格的表頭、欄位名稱及欄位值，快速確認資料差異。'),
    ).toBeInTheDocument()

    const availableCard = screen.getByRole('link', { name: '前往果品生產量值整併' })
    expect(availableCard).toHaveAttribute('href', '/fruit-merge')
    expect(availableCard).toHaveClass('feature-card--available')

    const plannedCard = screen.getByRole('link', {
      name: '查看 DOCX／XLSX 表格比對功能說明（規劃中）',
    })
    expect(plannedCard).toHaveAttribute('href', '/table-compare')
    expect(plannedCard).toHaveClass('feature-card--planned')

    const mediaImages = container.querySelectorAll<HTMLImageElement>('.feature-media__image')
    expect(mediaImages).toHaveLength(2)
    expect(mediaImages[0]).toHaveAttribute('src', expect.stringContaining('fruit-merge-card.png'))
    expect(mediaImages[1]).toHaveAttribute('src', expect.stringContaining('table-compare-card.png'))
    mediaImages.forEach((image) => expect(image).toHaveAttribute('alt', ''))
    expect(availableCard.querySelector('.feature-media--fruit-merge')).toContainElement(mediaImages[0])
    expect(plannedCard.querySelector('.feature-media--table-compare')).toContainElement(mediaImages[1])
    for (const card of [availableCard, plannedCard]) {
      expect(card.children[0]).toHaveClass('feature-media')
      expect(card.children[1]).toHaveClass('feature-card__content')
      expect(card.querySelector('.feature-media > .feature-status')).toBeInTheDocument()
      expect(card.querySelector('.feature-card__content .feature-status')).not.toBeInTheDocument()
    }
    expect(screen.queryByText('輸入')).not.toBeInTheDocument()
    expect(screen.queryByText('處理')).not.toBeInTheDocument()
    expect(screen.queryByText('輸出')).not.toBeInTheDocument()
    expect(screen.queryByText('開始果品整併')).not.toBeInTheDocument()
    expect(screen.queryByText('查看比對功能說明')).not.toBeInTheDocument()
  })
  // 針對 card link、path、placeholder 進行測試
  it.each([
    ['前往果品生產量值整併', '/fruit-merge', '功能建置中'],
    ['查看 DOCX／XLSX 表格比對功能說明（規劃中）', '/table-compare', '尚未開放'],
  ])('navigates with %s and returns home', (linkName, path, placeholder) => {
    renderRoute()
    // 確認點擊整張卡片的連結
    fireEvent.click(screen.getByRole('link', { name: linkName }))
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
