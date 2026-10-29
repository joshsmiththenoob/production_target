import { afterEach, expect, it, vi } from 'vitest'
import {
  ComparisonApiError,
  createComparisonPreview,
  downloadComparisonWorkbook,
  runComparison,
} from './api'

afterEach(() => vi.unstubAllGlobals())

const publicId = '04aa5e62-6b20-4cbd-8555-9a0cc83d121d'
const preview = {
  public_id: publicId,
  preview: {
    crops: ['茶'], years: [112], metrics: ['產量'],
    defaults: { crops: ['茶'], years: [112], metrics: ['產量'] }, issues: [],
  },
}

function jsonResponse(status: number, payload: unknown): Response {
  return { status, ok: status >= 200 && status < 300, json: vi.fn().mockResolvedValue(payload) } as unknown as Response
}

it.each([
  [200, preview],
  [201, { ...preview, public_id: 'not-a-uuid' }],
  [201, { ...preview, preview: { ...preview.preview, years: ['111'] } }],
  [201, { ...preview, preview: { ...preview.preview, defaults: null } }],
])('rejects an invalid status or preview contract (%s)', async (status, data) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { data })))
  await expect(createComparisonPreview(
    new File(['xlsx'], 'anonymous.xlsx'), new File(['pdf'], 'anonymous.pdf'), new AbortController().signal,
  )).rejects.toThrow('伺服器回傳了無法辨識')
})

it('posts an immutable JSON scope to the real run URL and validates every row', async () => {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {
    data: {
      row_count: 1,
      rows: [{
        crop: '香蕉', year: 112, metric: '產量', pdf_unit: '公噸', excel_unit: '公噸',
        pdf_value: '0', excel_value: null, status: 'Excel 缺少資料',
      }],
    },
    message: '比對完成。', meta: null,
  }))
  vi.stubGlobal('fetch', fetchMock)
  const scope = { crops: ['香蕉'], years: [112], metrics: ['產量'] }

  const result = await runComparison(publicId, scope, new AbortController().signal)

  expect(result.rows[0]).toMatchObject({ pdf_value: '0', excel_value: null })
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/v1/table-compare/jobs/${publicId}/run/`,
    expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scope),
    }),
  )
})

it.each([
  { row_count: 2, rows: [] },
  { row_count: 1, rows: [{ crop: '香蕉', year: 112, metric: '產量', pdf_unit: null, excel_unit: null, pdf_value: 0, excel_value: null, status: '相同' }] },
  { summary: { row_count: 0 }, rows: [] },
])('rejects malformed run data without inventing a result', async data => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { data })))
  await expect(runComparison(
    publicId, { crops: ['香蕉'], years: [112], metrics: ['產量'] }, new AbortController().signal,
  )).rejects.toMatchObject({ code: 'invalid_response' })
})

it('keeps run field errors separate from upload errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(400, {
    code: 'invalid_scope', message: 'internal', field_errors: { crops: ['required'], years: ['required'] },
  })))
  await expect(runComparison(
    publicId, { crops: [], years: [], metrics: ['產量'] }, new AbortController().signal,
  )).rejects.toMatchObject({
    code: 'invalid_scope',
    scopeFields: { crops: 'crops 的比對條件無效。', years: 'years 的比對條件無效。' },
    fileFields: {},
  })
})

it('prepares the documented download request, UTF-8 filename and blob safely', async () => {
  const blob = new Blob(['xlsx'])
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('比對結果.xlsx')}`,
    }),
    blob: vi.fn().mockResolvedValue(blob),
  } as unknown as Response)
  vi.stubGlobal('fetch', fetchMock)

  await expect(downloadComparisonWorkbook(publicId, new AbortController().signal)).resolves.toEqual({
    blob,
    filename: '比對結果.xlsx',
  })
  expect(fetchMock).toHaveBeenCalledWith(
    `/api/v1/table-compare/jobs/${publicId}/download/`,
    expect.objectContaining({ method: 'GET', cache: 'no-store' }),
  )
})

it('never accepts JSON or HTML as an xlsx download', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    blob: vi.fn(),
  } as unknown as Response))
  await expect(downloadComparisonWorkbook(publicId, new AbortController().signal))
    .rejects.toEqual(expect.objectContaining<Partial<ComparisonApiError>>({ code: 'invalid_download' }))
})
