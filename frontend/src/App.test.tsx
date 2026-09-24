import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response
}

function makeFile(name: string): File {
  return new File(['anonymous workbook'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function selectMergeFiles(productionFile: File, areaFile: File) {
  fireEvent.change(screen.getByLabelText('選擇產量及產值檔案'), {
    target: { files: [productionFile] },
  })
  fireEvent.change(screen.getByLabelText('選擇種植及收穫面積檔案'), {
    target: { files: [areaFile] },
  })
}

const successfulPairingPayload = {
  data: {
    public_id: '04aa5e62-6b20-4cbd-8555-9a0cc83d121d',
    pairing_result: {
      is_valid: true,
      pairs: [
        {
          major_category: '果品',
          production_files: ['果品產量及產值.xlsx'],
          area_files: ['果品種植及收穫面積.xlsx'],
          complete: true,
        },
      ],
      errors: [],
    },
  },
  message: 'Pairing Sucessfully! And Job created.',
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
    expect(screen.getByRole('heading', { name: '生產量值整併' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'DOCX／XLSX 表格比對' })).toBeInTheDocument()
    expect(screen.getByText('已開放')).toBeInTheDocument()
    expect(screen.getByText('規劃中')).toBeInTheDocument()
    expect(
      screen.getByText('將統計處 SD 產出的同品項生產量與生產值資料，整併為單一匯總資料。'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('比對 Word 與 Excel 表格的表頭、欄位名稱及欄位值，快速確認資料差異。'),
    ).toBeInTheDocument()

    const availableCard = screen.getByRole('link', { name: '前往生產量值整併' })
    expect(availableCard).toHaveAttribute('href', '/volume-price-merge')
    expect(availableCard).toHaveClass('feature-card--available')

    const plannedCard = screen.getByRole('link', {
      name: '查看 DOCX／XLSX 表格比對功能說明（規劃中）',
    })
    expect(plannedCard).toHaveAttribute('href', '/table-compare')
    expect(plannedCard).toHaveClass('feature-card--planned')

    const mediaImages = container.querySelectorAll<HTMLImageElement>('.feature-media__image')
    expect(mediaImages).toHaveLength(2)
    expect(mediaImages[0]).toHaveAttribute(
      'src',
      expect.stringContaining('volume-price-merge-card.png'),
    )
    expect(mediaImages[1]).toHaveAttribute('src', expect.stringContaining('table-compare-card.png'))
    mediaImages.forEach((image) => expect(image).toHaveAttribute('alt', ''))
    expect(availableCard.querySelector('.feature-media--volume-price-merge')).toContainElement(
      mediaImages[0],
    )
    expect(plannedCard.querySelector('.feature-media--table-compare')).toContainElement(mediaImages[1])
    for (const card of [availableCard, plannedCard]) {
      expect(within(card).queryByRole('button')).not.toBeInTheDocument()
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
    ['前往生產量值整併', '/volume-price-merge', '1. 選擇檔案', '← 返回工作入口'],
    ['查看 DOCX／XLSX 表格比對功能說明（規劃中）', '/table-compare', '尚未開放', '返回首頁'],
  ])('navigates with %s and returns home', (linkName, path, pageHeading, returnLinkName) => {
    renderRoute()
    // 確認點擊整張卡片的連結
    fireEvent.click(screen.getByRole('link', { name: linkName }))
    expect(screen.getByLabelText('current path')).toHaveTextContent(path)
    expect(screen.getByRole('heading', { name: pageHeading })).toBeInTheDocument()
    expect(screen.queryByLabelText('系統連線狀態')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: returnLinkName }))
    expect(screen.getByRole('heading', { level: 1, name: '今天要處理哪一項工作？' })).toBeInTheDocument()
  })

  it('renders enabled file selection without fake processing or results', () => {
    renderRoute('/volume-price-merge')

    expect(screen.getByRole('heading', { level: 1, name: '生產量值整併' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← 返回工作入口' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('heading', { level: 2, name: '1. 選擇檔案' })).toBeInTheDocument()
    const steps = within(screen.getByRole('list', { name: '果品整併工作流程' })).getAllByRole('listitem')
    expect(steps).toHaveLength(4)
    expect(steps[0]).toHaveAttribute('aria-current', 'step')
    expect(steps[0]).toHaveTextContent('目前')
    for (const lockedStep of steps.slice(1)) {
      expect(lockedStep).toHaveTextContent('未開放')
      expect(within(lockedStep).queryByRole('button')).not.toBeInTheDocument()
      expect(within(lockedStep).queryByRole('link')).not.toBeInTheDocument()
    }
    expect(screen.getByRole('group', { name: '產量及產值 Excel' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '種植及收穫面積 Excel' })).toBeInTheDocument()

    const productionFiles = screen.getByLabelText('選擇產量及產值檔案')
    expect(productionFiles).toBeEnabled()
    expect(productionFiles).toHaveClass('motion-file-picker__input')
    expect(productionFiles).toHaveAttribute('aria-labelledby', 'production-files-label')
    expect(productionFiles).toHaveAttribute('multiple')
    expect(productionFiles).toHaveAccessibleDescription(/多份 \.xlsx/)
    expect(document.getElementById('production-files-label')).toHaveClass('motion-file-picker__label')
    expect(document.getElementById('production-files-label')?.parentElement).toHaveClass('motion-file-picker')

    const areaFiles = screen.getByLabelText('選擇種植及收穫面積檔案')
    expect(areaFiles).toBeEnabled()
    expect(areaFiles).toHaveClass('motion-file-picker__input')
    expect(areaFiles).toHaveAttribute('aria-labelledby', 'area-files-label')
    expect(areaFiles).toHaveAttribute('multiple')
    expect(areaFiles).toHaveAccessibleDescription(/多份 \.xlsx/)
    expect(document.getElementById('area-files-label')).toHaveClass('motion-file-picker__label')
    expect(document.getElementById('area-files-label')?.parentElement).toHaveClass('motion-file-picker')

    expect(screen.getByRole('button', { name: '檢查檔案配對' })).toBeDisabled()
    expect(
      screen.getByText('兩類檔案都選好後即可檢查；檢查期間請勿重複送出。'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '檔案準備說明' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '功能建置中' })).not.toBeInTheDocument()
    expect(screen.queryByText('處理中')).not.toBeInTheDocument()
    expect(screen.queryByText('配對成功')).not.toBeInTheDocument()
    expect(screen.queryByText('下載結果')).not.toBeInTheDocument()
  })

  it('uploads both file groups once and shows the successful pairing in step 2', async () => {
    let resolveRequest!: (response: Response) => void
    vi.mocked(fetch).mockImplementation(
      () => new Promise((resolve) => { resolveRequest = resolve }),
    )
    renderRoute('/volume-price-merge')
    const productionFile = makeFile('果品產量及產值.xlsx')
    const areaFile = makeFile('果品種植及收穫面積.xlsx')
    selectMergeFiles(productionFile, areaFile)

    expect(screen.getByText(productionFile.name)).toBeInTheDocument()
    expect(screen.getByText(areaFile.name)).toBeInTheDocument()
    const submitButton = screen.getByRole('button', { name: '檢查檔案配對' })
    expect(submitButton).toBeEnabled()

    fireEvent.click(submitButton)
    expect(screen.getByRole('button', { name: '正在檢查檔案配對…' })).toBeDisabled()
    fireEvent.click(submitButton)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/price-volume-merge/jobs/',
      expect.objectContaining({ method: 'POST' }),
    )

    const requestOptions = vi.mocked(fetch).mock.calls[0][1]
    const requestBody = requestOptions?.body as FormData
    expect(requestOptions?.headers).toBeUndefined()
    expect(requestBody.getAll('production_files')).toEqual([productionFile])
    expect(requestBody.getAll('area_files')).toEqual([areaFile])

    resolveRequest(jsonResponse(201, successfulPairingPayload))

    expect(await screen.findByRole('heading', { name: '2. 檢查配對' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '檢查檔案配對' })).not.toBeInTheDocument()
    const steps = within(screen.getByRole('list', { name: '果品整併工作流程' })).getAllByRole('listitem')
    expect(steps[0]).toHaveTextContent('已完成')
    expect(steps[1]).toHaveAttribute('aria-current', 'step')
    expect(steps[1]).toHaveTextContent('目前')
    expect(steps[2]).toHaveTextContent('未開放')
    expect(steps[3]).toHaveTextContent('未開放')
    await waitFor(() => expect(screen.getByRole('heading', { name: '2. 檢查配對' })).toHaveFocus())
    expect(screen.getByText('檔案配對完整')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: '果品' })).toBeInTheDocument()
    expect(screen.getByText('配對完整')).toBeInTheDocument()
    expect(screen.getByText(/04aa5e62-6b20-4cbd-8555-9a0cc83d121d/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '返回選擇檔案' }))
    expect(await screen.findByRole('heading', { name: '1. 選擇檔案' })).toBeInTheDocument()
    expect(screen.getByText(productionFile.name)).toBeInTheDocument()
    expect(screen.getByText(areaFile.name)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { name: '1. 選擇檔案' })).toHaveFocus())
    expect((screen.getByLabelText('選擇產量及產值檔案') as HTMLInputElement).files).toHaveLength(0)
    expect(screen.getByRole('button', { name: '檢查檔案配對' })).toBeEnabled()

    vi.mocked(fetch).mockResolvedValue(jsonResponse(201, successfulPairingPayload))
    fireEvent.click(screen.getByRole('button', { name: '檢查檔案配對' }))
    await screen.findByRole('heading', { name: '2. 檢查配對' })
    const secondBody = vi.mocked(fetch).mock.calls[1][1]?.body as FormData
    expect(secondBody.getAll('production_files')).toEqual([productionFile])
    expect(secondBody.getAll('area_files')).toEqual([areaFile])
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('shows an incomplete pairing in step 2 and keeps files when returning to fix it', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(400, {
      code: 'invalid_pairing',
      message: 'Pairing is incomplete.',
      field_errors: {
        is_valid: false,
        pairs: [
          {
            major_category: '果品',
            production_files: ['果品產量及產值.xlsx'],
            area_files: [],
            complete: false,
          },
          {
            major_category: '蔬菜',
            production_files: [],
            area_files: ['蔬菜種植及收穫面積.xlsx'],
            complete: false,
          },
        ],
        errors: ['「果品」缺少種植及收穫面積檔案。', '「蔬菜」缺少產量及產值檔案。'],
      },
    }))
    renderRoute('/volume-price-merge')
    const productionFile = makeFile('果品產量及產值.xlsx')
    const areaFile = makeFile('蔬菜種植及收穫面積.xlsx')
    selectMergeFiles(productionFile, areaFile)

    fireEvent.click(screen.getByRole('button', { name: '檢查檔案配對' }))

    expect(await screen.findByText('檔案配對尚未完整')).toBeInTheDocument()
    expect(screen.getAllByText('配對不完整')).toHaveLength(2)
    expect(screen.getAllByText('缺少檔案')).toHaveLength(2)
    expect(screen.getByText('「果品」缺少種植及收穫面積檔案。')).toBeInTheDocument()
    expect(screen.queryByText(/工作編號/)).not.toBeInTheDocument()

    await waitFor(() => expect(screen.getByRole('button', { name: '返回選擇檔案' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '返回選擇檔案' }))
    expect(await screen.findByRole('heading', { name: '1. 選擇檔案' })).toBeInTheDocument()
    expect(screen.getByText(productionFile.name)).toBeInTheDocument()
    expect(screen.getByText(areaFile.name)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '檢查檔案配對' })).toBeEnabled())
  })

  it('replaces a selected group after returning and does not reuse the old job result', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(201, successfulPairingPayload))
      .mockResolvedValueOnce(jsonResponse(400, {
        code: 'invalid_pairing',
        message: 'Pairing is incomplete.',
        field_errors: {
          is_valid: false,
          pairs: [
            { major_category: '果品', production_files: ['果品產量及產值.xlsx'], area_files: [], complete: false },
            { major_category: '蔬菜', production_files: [], area_files: ['蔬菜種植及收穫面積.xlsx'], complete: false },
          ],
          errors: ['「果品」缺少種植及收穫面積檔案。'],
        },
      }))
    renderRoute('/volume-price-merge')
    const productionFile = makeFile('果品產量及產值.xlsx')
    const originalAreaFile = makeFile('果品種植及收穫面積.xlsx')
    const replacementAreaFile = makeFile('蔬菜種植及收穫面積.xlsx')
    selectMergeFiles(productionFile, originalAreaFile)

    fireEvent.click(screen.getByRole('button', { name: '檢查檔案配對' }))
    expect(await screen.findByText(/04aa5e62-6b20-4cbd-8555-9a0cc83d121d/)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByRole('button', { name: '返回選擇檔案' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '返回選擇檔案' }))
    const areaInput = await screen.findByLabelText('選擇種植及收穫面積檔案')
    await waitFor(() => expect(areaInput).toBeEnabled())
    fireEvent.change(areaInput, { target: { files: [replacementAreaFile] } })

    expect(screen.getByText(replacementAreaFile.name)).toBeInTheDocument()
    expect(screen.queryByText(originalAreaFile.name)).not.toBeInTheDocument()
    expect(screen.queryByText(/04aa5e62-6b20-4cbd-8555-9a0cc83d121d/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '檢查檔案配對' }))
    expect(await screen.findByText('檔案配對尚未完整')).toBeInTheDocument()
    expect(screen.queryByText(/工作編號/)).not.toBeInTheDocument()
    const secondBody = vi.mocked(fetch).mock.calls[1][1]?.body as FormData
    expect(secondBody.getAll('production_files')).toEqual([productionFile])
    expect(secondBody.getAll('area_files')).toEqual([replacementAreaFile])
  })

  it.each([
    [
      'invalid_upload',
      '檔案未通過上傳檢查。請確認兩類都已選擇，且檔案格式為 .xlsx。',
    ],
    [
      'invalid_workbook',
      'Excel 檔案無法讀取，或檔名與工作表 A1 標題不一致。請檢查後重試。',
    ],
  ])('keeps %s errors in step 1', async (code, expectedMessage) => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(400, {
      code,
      message: 'Traceback: internal details must stay hidden',
      field_errors: {},
    }))
    renderRoute('/volume-price-merge')
    selectMergeFiles(
      makeFile('果品產量及產值.xlsx'),
      makeFile('果品種植及收穫面積.xlsx'),
    )

    fireEvent.click(screen.getByRole('button', { name: '檢查檔案配對' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(expectedMessage)
    expect(screen.getByRole('heading', { name: '1. 選擇檔案' })).toBeInTheDocument()
    expect(screen.queryByText(/Traceback/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '檢查檔案配對' })).toBeEnabled()
  })

  it('allows retrying a network error without exposing its internal message', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Traceback: C:\\private\\server-path'))
      .mockResolvedValueOnce(jsonResponse(201, successfulPairingPayload))
    renderRoute('/volume-price-merge')
    selectMergeFiles(
      makeFile('果品產量及產值.xlsx'),
      makeFile('果品種植及收穫面積.xlsx'),
    )

    fireEvent.click(screen.getByRole('button', { name: '檢查檔案配對' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('目前無法檢查檔案配對，請稍後重試。')
    expect(alert).not.toHaveTextContent('Traceback')

    fireEvent.click(screen.getByRole('button', { name: '檢查檔案配對' }))
    expect(await screen.findByText('檔案配對完整')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['/volume-price-merge', '生產量值整併'],
    ['/table-compare', 'DOCX／XLSX 表格比對'],
  ])('renders a direct visit to %s with shared navigation', (path, title) => {
    renderRoute(path)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: '首頁' }))
    expect(screen.getByRole('heading', { level: 1, name: '今天要處理哪一項工作？' })).toBeInTheDocument()
  })
})
