import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import TableComparePage from './TableComparePage'

const motionPreference = vi.hoisted(() => ({ reduced: false }))
vi.mock('motion/react', async importOriginal => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return { ...actual, useReducedMotion: () => motionPreference.reduced }
})
afterEach(() => { vi.unstubAllGlobals(); motionPreference.reduced = false })
const id = '04aa5e62-6b20-4cbd-8555-9a0cc83d121d'
const preview = {
  crops: ['香蕉', '茶'], years: [111, 112], metrics: ['產量', '產值'],
  defaults: { crops: ['香蕉', '茶'], years: [112], metrics: ['產量'] },
  issues: ['目前的 PDF 解析結果未找到作物「茶」；這不代表來源 PDF 沒有資料。', 'PDF 第 3 頁未解析：目前尚未支援這個表格版型'],
}
const payload = { data: { public_id: id, preview }, message: 'created', meta: null }
function response(status: number, value: unknown): Response {
  return { status, ok: status < 300, json: vi.fn().mockResolvedValue(value) } as unknown as Response
}
function selectFiles() {
  const excel = new File(['xlsx'], 'anonymous.xlsx')
  const pdf = new File(['pdf'], 'anonymous.pdf')
  fireEvent.change(screen.getByLabelText('選擇完整合併 Excel（.xlsx）'), { target: { files: [excel] } })
  fireEvent.change(screen.getByLabelText('選擇核對 PDF（.pdf）'), { target: { files: [pdf] } })
  return { excel, pdf }
}
function renderPage() { return render(<MemoryRouter><TableComparePage /></MemoryRouter>) }
async function review() {
  fireEvent.click(screen.getByRole('button', { name: '產生比對範圍' }))
  const heading = await screen.findByRole('heading', { name: '2. 確認比對範圍' })
  await waitFor(() => expect(heading).toHaveFocus())
  return heading
}
async function back() {
  fireEvent.click(screen.getByRole('button', { name: '返回修改檔案' }))
  const heading = await screen.findByRole('heading', { name: '1. 選擇檔案' })
  await waitFor(() => expect(heading).toHaveFocus())
}

it('uploads exact multipart files once, renders defaults/issues, and never runs comparison', async () => {
  let resolve!: (value: Response) => void
  const fetchMock = vi.fn(() => new Promise<Response>(done => { resolve = done }))
  vi.stubGlobal('fetch', fetchMock)
  renderPage()
  expect(screen.getByRole('button', { name: '產生比對範圍' })).toBeDisabled()
  const { excel, pdf } = selectFiles()
  for (const input of document.querySelectorAll('input[type=file]')) expect(input).not.toHaveAttribute('multiple')
  const button = screen.getByRole('button', { name: '產生比對範圍' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status')).toHaveTextContent('正在解析檔案')
  expect(button).toBeDisabled()
  const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('/api/v1/table-compare/jobs/')
  expect(options.headers).toBeUndefined()
  expect(options.method).toBe('POST')
  expect((options.body as FormData).getAll('excel_file')).toEqual([excel])
  expect((options.body as FormData).getAll('pdf_file')).toEqual([pdf])
  resolve(response(201, payload))
  await waitFor(() => expect(screen.getByRole('heading', { name: '2. 確認比對範圍' })).toHaveFocus())
  expect(screen.getByRole('checkbox', { name: '茶' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: '111' })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: '112' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: '產值' })).not.toBeChecked()
  const issues = screen.getByRole('region', { name: '解析提醒與待確認事項' })
  expect(within(issues).getAllByRole('listitem').map(node => node.textContent)).toEqual(preview.issues)
  expect(issues).toHaveTextContent('不代表 PDF 原檔一定沒有資料')
  expect(screen.getByRole('button', { name: '開始比對' })).toBeDisabled()
  const steps = within(screen.getByRole('list', { name: '表格比對工作流程' })).getAllByRole('listitem')
  expect(steps[0]).toHaveTextContent('已完成')
  expect(steps[1]).toHaveAttribute('aria-current', 'step')
  expect(steps[2]).toHaveTextContent('未開放')
  expect(steps[3]).toHaveTextContent('未開放')
  fireEvent.click(screen.getByRole('checkbox', { name: '茶' }))
  expect(screen.getByRole('checkbox', { name: '茶' })).not.toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: '開始比對' }))
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('keeps controlled Files after native inputs remount, preserves selections on return, and can upload a new job', async () => {
  const nextId = '14aa5e62-6b20-4cbd-8555-9a0cc83d121d'
  const fetchMock = vi.fn().mockResolvedValueOnce(response(201, payload))
    .mockResolvedValueOnce(response(201, { ...payload, data: { ...payload.data, public_id: nextId } }))
  vi.stubGlobal('fetch', fetchMock)
  renderPage()
  const { excel, pdf } = selectFiles()
  await review()
  fireEvent.click(screen.getByRole('checkbox', { name: '茶' }))
  await back()
  expect(screen.getByText(`已保留：${excel.name}`)).toBeInTheDocument()
  expect(screen.getByText(`已保留：${pdf.name}`)).toBeInTheDocument()
  expect((screen.getByLabelText('選擇完整合併 Excel（.xlsx）') as HTMLInputElement).files).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: '返回原預覽' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: '2. 確認比對範圍' })).toHaveFocus())
  expect(screen.getByRole('checkbox', { name: '茶' })).not.toBeChecked()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await back()
  await review()
  const body = fetchMock.mock.calls[1][1].body as FormData
  expect(body.get('excel_file')).toEqual(excel)
  expect(body.get('pdf_file')).toEqual(pdf)
  expect(screen.getByText(`工作編號：${nextId}`)).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: '茶' })).toBeChecked()
})

it.each(['invalid_upload', 'invalid_preview', 'network'])('keeps Files and Step 1 on %s and safely retries', async code => {
  const fetchMock = vi.fn()
  if (code === 'network') fetchMock.mockRejectedValueOnce(new Error('Traceback /srv/private'))
  else fetchMock.mockResolvedValueOnce(response(400, { code, message: 'Traceback /srv/private', field_errors: { pdf_file: ['secret path'] } }))
  fetchMock.mockResolvedValueOnce(response(201, payload))
  vi.stubGlobal('fetch', fetchMock)
  renderPage()
  const { excel, pdf } = selectFiles()
  fireEvent.click(screen.getByRole('button', { name: '產生比對範圍' }))
  const alert = await screen.findByRole('alert')
  expect(alert).not.toHaveTextContent('Traceback')
  expect(alert).not.toHaveTextContent('/srv')
  expect(screen.getByRole('heading', { name: '1. 選擇檔案' })).toBeInTheDocument()
  expect(screen.getByText(`已保留：${excel.name}`)).toBeInTheDocument()
  expect(screen.getByText(`已保留：${pdf.name}`)).toBeInTheDocument()
  if (code === 'invalid_upload') {
    expect(screen.getByLabelText('選擇核對 PDF（.pdf）')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('選擇核對 PDF（.pdf）')).toHaveAccessibleDescription(/有效且非空白/)
  }
  await review()
})

it('invalidates preview, UUID and selection when either file changes or is removed', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(201, payload)))
  renderPage()
  selectFiles()
  await review()
  await back()
  fireEvent.change(screen.getByLabelText('選擇核對 PDF（.pdf）'), { target: { files: [new File(['new'], 'new.pdf')] } })
  expect(screen.queryByRole('button', { name: '返回原預覽' })).not.toBeInTheDocument()
  expect(screen.queryByText(`工作編號：${id}`)).not.toBeInTheDocument()
  await review()
  await back()
  fireEvent.click(screen.getByRole('button', { name: '移除完整合併 Excel（.xlsx）' }))
  expect(screen.queryByRole('button', { name: '返回原預覽' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '產生比對範圍' })).toBeDisabled()
})

it('aborts and ignores a late response after file replacement, then aborts on unmount', async () => {
  let resolve!: (value: Response) => void
  const fetchMock = vi.fn().mockImplementationOnce(() => new Promise<Response>(done => { resolve = done }))
    .mockImplementationOnce(() => new Promise(() => undefined))
  vi.stubGlobal('fetch', fetchMock)
  const { unmount } = renderPage()
  selectFiles()
  fireEvent.click(screen.getByRole('button', { name: '產生比對範圍' }))
  const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
  fireEvent.change(screen.getByLabelText('選擇完整合併 Excel（.xlsx）'), { target: { files: [new File(['new'], 'new.xlsx')] } })
  expect(signal.aborted).toBe(true)
  const late = response(201, payload)
  resolve(late)
  await waitFor(() => expect(late.json).toHaveBeenCalled())
  expect(screen.queryByRole('heading', { name: '2. 確認比對範圍' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '返回原預覽' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '產生比對範圍' }))
  unmount()
  expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true)
})

it('shows empty reasons without fabricated options and switches immediately with reduced motion', async () => {
  motionPreference.reduced = true
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(201, {
    data: { public_id: id, preview: { crops: [], years: [], metrics: [], defaults: { crops: [], years: [], metrics: [] }, issues: ['Excel 與 PDF 沒有共同實績年度。'] } },
  })))
  const { container } = renderPage()
  selectFiles()
  await review()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.getByText('Excel 與 PDF 沒有共同實績年度。請返回修改檔案。')).toBeInTheDocument()
  expect(container.querySelector('.workflow-panel')).not.toHaveAttribute('style')
  expect(container.querySelectorAll('.workflow-panel')).toHaveLength(1)
  await back()
  expect(container.querySelectorAll('.workflow-panel')).toHaveLength(1)
  expect(container.querySelector('.workflow-panel')).not.toHaveAttribute('style')
})
