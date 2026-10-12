import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  downloadVolumePriceMergeResult,
  queryVolumePriceMergeResult,
} from './api'

const publicId = '04aa5e62-6b20-4cbd-8555-9a0cc83d121d'

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response
}

function workbookResponse(contentDisposition?: string): Response {
  const headers = new Headers({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  if (contentDisposition) headers.set('Content-Disposition', contentDisposition)
  return {
    ok: true,
    status: 200,
    headers,
    blob: vi.fn().mockResolvedValue(new Blob(['anonymous workbook'])),
  } as unknown as Response
}

afterEach(() => vi.unstubAllGlobals())

describe('volume price merge result API', () => {
  it('encodes a Chinese product, disables cache, and preserves ordered scalar values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {
      data: {
        public_id: publicId,
        query_result: {
          product: '香蕉',
          columns: [
            { key: '果品||110年||香蕉', major_category: '果品', year: '110年', crop: '香蕉' },
            { key: '果品||111年||香蕉', major_category: '果品', year: '111年', crop: '香蕉' },
          ],
          rows: [
            { metric: '果品產量', values: [0, '10 / 20'] },
            { metric: '果品產量', values: [null, 5] },
          ],
        },
      },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await queryVolumePriceMergeResult(publicId, '香蕉')

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/price-volume-merge/jobs/${publicId}/result/?product=%E9%A6%99%E8%95%89`,
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    )
    expect(result.query_result.rows).toEqual([
      { metric: '果品產量', values: [0, '10 / 20'] },
      { metric: '果品產量', values: [null, 5] },
    ])
  })

  it.each([
    ['a mismatched product', { product: '鳳梨', values: [1] }],
    ['a row with the wrong value count', { product: '香蕉', values: [] }],
  ])('rejects %s response', async (_label, fixture) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {
      data: {
        public_id: publicId,
        query_result: {
          product: fixture.product,
          columns: [{ key: 'key', major_category: '果品', year: '110年', crop: '香蕉' }],
          rows: [{ metric: '果品產量', values: fixture.values }],
        },
      },
    })))

    await expect(queryVolumePriceMergeResult(publicId, '香蕉')).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })

  it('downloads the complete workbook without product and prefers UTF-8 filename*', async () => {
    const fetchMock = vi.fn().mockResolvedValue(workbookResponse(
      "attachment; filename=legacy.xlsx; filename*=UTF-8''%E6%B0%91%E5%9C%8B115%E5%B9%B4_%E5%90%88%E4%BD%B5%E7%B5%90%E6%9E%9C.xlsx",
    ))
    vi.stubGlobal('fetch', fetchMock)

    const result = await downloadVolumePriceMergeResult(publicId)

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/price-volume-merge/jobs/${publicId}/download/`,
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    )
    expect(result.filename).toBe('民國115年_合併結果.xlsx')
  })

  it.each([
    ['attachment; filename="server-result.xlsx"', 'server-result.xlsx'],
    [undefined, 'production-target-result.xlsx'],
    ['attachment; filename="unsafe.txt"', 'production-target-result.xlsx'],
  ])('uses a safe filename for %s', async (header, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(workbookResponse(header)))

    await expect(downloadVolumePriceMergeResult(publicId, '香蕉')).resolves.toMatchObject({
      filename: expected,
    })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('download/?product=%E9%A6%99%E8%95%89'),
      expect.objectContaining({ cache: 'no-store' }),
    )
  })

  it('does not read an error JSON response as a workbook blob', async () => {
    const blobMock = vi.fn()
    const response = {
      ...jsonResponse(410, {
        code: 'job_expired',
        message: 'expired',
        field_errors: {},
      }),
      blob: blobMock,
    } as unknown as Response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await expect(downloadVolumePriceMergeResult(publicId)).rejects.toEqual(
      expect.objectContaining({ code: 'job_expired', jobUnavailable: true }),
    )
    expect(blobMock).not.toHaveBeenCalled()
  })

  it('rejects a successful non-XLSX response before reading its blob', async () => {
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      blob: vi.fn(),
    } as unknown as Response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    await expect(downloadVolumePriceMergeResult(publicId)).rejects.toMatchObject({
      code: 'invalid_response',
    })
    expect(response.blob).not.toHaveBeenCalled()
  })
})
