import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import TableComparePage from './TableComparePage'

const motionPreference = vi.hoisted(() => ({ reduced: true }))
vi.mock('motion/react', async importOriginal => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return { ...actual, useReducedMotion: () => motionPreference.reduced }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  motionPreference.reduced = true
})

const publicId = '04aa5e62-6b20-4cbd-8555-9a0cc83d121d'
const preview = {
  crops: ['香蕉', '茶'], years: [111, 112], metrics: ['產量', '產值'],
  defaults: { crops: ['香蕉', '茶'], years: [112], metrics: ['產量'] },
  issues: ['目前的 PDF 解析結果未找到作物「茶」；這不代表來源 PDF 沒有資料。', 'PDF 第 3 頁未解析：目前尚未支援這個表格版型'],
}
const previewPayload = { data: { public_id: publicId, preview }, message: 'created', meta: null }
const runPayload = {
  data: {
    row_count: 3,
    rows: [
      { crop: '香蕉', year: 112, metric: '產量', pdf_unit: '公噸', excel_unit: '公噸', pdf_value: '0', excel_value: '0', status: '相同' },
      { crop: '茶', year: 112, metric: '產量', pdf_unit: null, excel_unit: '公噸', pdf_value: null, excel_value: '…', status: 'PDF 缺少資料' },
      { crop: '香蕉', year: 112, metric: '產值', pdf_unit: '千元', excel_unit: '千元', pdf_value: '12', excel_value: '13', status: '數值不同' },
    ],
  },
  message: '比對完成。',
  meta: null,
}

function response(status: number, value: unknown): Response {
  return { status, ok: status >= 200 && status < 300, json: vi.fn().mockResolvedValue(value) } as unknown as Response
}

function selectFiles() {
  const excel = new File(['xlsx'], 'anonymous.xlsx')
  const pdf = new File(['pdf'], 'anonymous.pdf')
  fireEvent.change(screen.getByLabelText('選擇完整合併 Excel（.xlsx）'), { target: { files: [excel] } })
  fireEvent.change(screen.getByLabelText('選擇核對 PDF（.pdf）'), { target: { files: [pdf] } })
  return { excel, pdf }
}

function renderPage() {
  return render(<MemoryRouter><TableComparePage /></MemoryRouter>)
}

async function reachReview() {
  selectFiles()
  fireEvent.click(screen.getByRole('button', { name: '產生比對範圍' }))
  const heading = await screen.findByRole('heading', { name: '2. 確認比對範圍' })
  await waitFor(() => expect(heading).toHaveFocus())
  return heading
}

it('keeps the Step 1/2 multipart, defaults, issues and controlled Files behavior', async () => {
  const fetchMock = vi.fn().mockResolvedValue(response(201, previewPayload))
  vi.stubGlobal('fetch', fetchMock)
  renderPage()
  const { excel, pdf } = selectFiles()
  fireEvent.click(screen.getByRole('button', { name: '產生比對範圍' }))

  const heading = await screen.findByRole('heading', { name: '2. 確認比對範圍' })
  await waitFor(() => expect(heading).toHaveFocus())
  const body = fetchMock.mock.calls[0][1].body as FormData
  expect(body.getAll('excel_file')).toEqual([excel])
  expect(body.getAll('pdf_file')).toEqual([pdf])
  expect(fetchMock.mock.calls[0][1].headers).toBeUndefined()
  expect(screen.getByRole('checkbox', { name: '茶' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: '111' })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: '112' })).toBeChecked()
  expect(within(screen.getByRole('region', { name: '解析提醒與待確認事項' })).getAllByRole('listitem'))
    .toHaveLength(2)

  fireEvent.click(screen.getByRole('button', { name: '返回修改檔案' }))
  await screen.findByRole('heading', { name: '1. 選擇檔案' })
  expect(screen.getByText(`已保留：${excel.name}`)).toBeInTheDocument()
  expect(screen.getByText(`已保留：${pdf.name}`)).toBeInTheDocument()
  expect((screen.getByLabelText('選擇完整合併 Excel（.xlsx）') as HTMLInputElement).files).toHaveLength(0)
})

it('posts one immutable run snapshot and moves a fast reduced-motion success to Step 4', async () => {
  let resolveRun!: (value: Response) => void
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response(201, previewPayload))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { resolveRun = resolve }))
  vi.stubGlobal('fetch', fetchMock)
  renderPage()
  await reachReview()
  fireEvent.click(screen.getByRole('checkbox', { name: '茶' }))
  const start = screen.getByRole('button', { name: '開始比對' })
  fireEvent.click(start)
  fireEvent.click(start)

  expect(await screen.findByRole('heading', { name: '3. 執行比對' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('正在執行比對')
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[1][0]).toBe(`/api/v1/table-compare/jobs/${publicId}/run/`)
  expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual({
    crops: ['香蕉'], years: [112], metrics: ['產量'],
  })

  resolveRun(response(200, runPayload))
  const resultHeading = await screen.findByRole('heading', { name: '4. 結果與下載' })
  await waitFor(() => expect(resultHeading).toHaveFocus())
  expect(screen.getByText('共 3 筆比對明細。')).toBeInTheDocument()
  expect(screen.getAllByText('0')).toHaveLength(2)
  expect(screen.getByText('…')).toBeInTheDocument()
  expect(screen.getAllByLabelText('空值')).toHaveLength(2)
  expect(within(screen.getByRole('region', { name: '本次結果摘要' })).getAllByRole('listitem')
    .map(item => item.textContent)).toContain('數值不同：1 筆')
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '查詢' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '下載比對結果 Excel' })).toBeDisabled()
  expect(screen.getByText(/下載功能尚未開放/)).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it('shows the 500ms success state in normal motion before entering results', async () => {
  motionPreference.reduced = false
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(response(201, previewPayload))
    .mockResolvedValueOnce(response(200, runPayload)))
  renderPage()
  await reachReview()
  const start = screen.getByRole('button', { name: '開始比對' })
  await waitFor(() => expect(start).toBeEnabled())
  fireEvent.click(start)

  expect(await screen.findByText('比對完成，正在顯示結果。找到差異仍屬正常完成。')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '4. 結果與下載' })).not.toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: '4. 結果與下載' }, { timeout: 1500 })).toBeInTheDocument()
})

it.each([
  [400, 'invalid_scope', '比對條件無效'],
  [400, 'invalid_comparison', '本次比對範圍無法執行'],
  [404, 'job_not_found', '找不到這個比對工作'],
  [409, 'job_not_runnable', '這個工作目前無法執行'],
  [410, 'job_expired', '這個工作已過期'],
  [500, 'comparison_failed', '比對處理失敗'],
])('keeps HTTP %s %s in Step 3 without fake completion', async (status, code, message) => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(response(201, previewPayload))
    .mockResolvedValueOnce(response(status, {
      code, message: 'Traceback /srv/private', field_errors: code === 'invalid_scope' ? { crops: ['bad'] } : {},
    })))
  renderPage()
  await reachReview()
  fireEvent.click(screen.getByRole('button', { name: '開始比對' }))

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent(message)
  expect(alert).not.toHaveTextContent('Traceback')
  expect(alert).not.toHaveTextContent('/srv')
  expect(screen.getByRole('heading', { name: '3. 執行比對' })).toBeInTheDocument()
  expect(screen.queryByText('比對完成')).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '4. 結果與下載' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '重新開始' })).toBeEnabled()
})

it('treats an unknown network result as non-retryable on the same Job', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(response(201, previewPayload))
    .mockRejectedValueOnce(new Error('private network trace')))
  renderPage()
  await reachReview()
  fireEvent.click(screen.getByRole('button', { name: '開始比對' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('網路狀態不明')
  expect(screen.queryByRole('button', { name: '重試比對' })).not.toBeInTheDocument()
})

it('invalidates a late run response after restart and keeps the selected Files', async () => {
  let resolveRun!: (value: Response) => void
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response(201, previewPayload))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { resolveRun = resolve }))
  vi.stubGlobal('fetch', fetchMock)
  renderPage()
  const { excel, pdf } = selectFiles()
  fireEvent.click(screen.getByRole('button', { name: '產生比對範圍' }))
  await screen.findByRole('heading', { name: '2. 確認比對範圍' })
  const start = screen.getByRole('button', { name: '開始比對' })
  await waitFor(() => expect(start).toBeEnabled())
  fireEvent.click(start)
  await screen.findByRole('heading', { name: '3. 執行比對' })
  const restart = screen.getByRole('button', { name: '重新開始' })
  await waitFor(() => expect(restart).toBeEnabled())
  fireEvent.click(restart)
  await screen.findByRole('heading', { name: '1. 選擇檔案' })

  const late = response(200, runPayload)
  resolveRun(late)
  await waitFor(() => expect(late.json).toHaveBeenCalled())
  expect(screen.queryByRole('heading', { name: '4. 結果與下載' })).not.toBeInTheDocument()
  expect(screen.getByText(`已保留：${excel.name}`)).toBeInTheDocument()
  expect(screen.getByText(`已保留：${pdf.name}`)).toBeInTheDocument()
  expect(screen.queryByText(publicId)).not.toBeInTheDocument()
})

it('cancels a pending success timer when the user restarts', async () => {
  motionPreference.reduced = false
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(response(201, previewPayload))
    .mockResolvedValueOnce(response(200, runPayload)))
  renderPage()
  await reachReview()
  const start = screen.getByRole('button', { name: '開始比對' })
  await waitFor(() => expect(start).toBeEnabled())
  fireEvent.click(start)
  await screen.findByText('比對完成，正在顯示結果。找到差異仍屬正常完成。')
  const restart = screen.getByRole('button', { name: '重新開始' })
  await waitFor(() => expect(restart).toBeEnabled())
  fireEvent.click(restart)
  await screen.findByRole('heading', { name: '1. 選擇檔案' })
  await new Promise(resolve => setTimeout(resolve, 650))
  expect(screen.queryByRole('heading', { name: '4. 結果與下載' })).not.toBeInTheDocument()
})

it('invalidates preview and UUID when either source file changes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(201, previewPayload)))
  renderPage()
  await reachReview()
  fireEvent.click(screen.getByRole('button', { name: '返回修改檔案' }))
  await screen.findByRole('heading', { name: '1. 選擇檔案' })
  fireEvent.change(screen.getByLabelText('選擇核對 PDF（.pdf）'), { target: { files: [new File(['new'], 'new.pdf')] } })
  expect(screen.queryByRole('button', { name: '返回原預覽' })).not.toBeInTheDocument()
  expect(screen.queryByText(`工作編號：${publicId}`)).not.toBeInTheDocument()
})
