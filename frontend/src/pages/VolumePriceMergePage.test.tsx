import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'

import VolumePriceMergePage from './VolumePriceMergePage'

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return { ...actual, useReducedMotion: () => true }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const publicId = '04aa5e62-6b20-4cbd-8555-9a0cc83d121d'

const pairingPayload = {
  data: {
    public_id: publicId,
    pairing_result: {
      is_valid: true,
      pairs: [{
        major_category: '果品',
        production_files: ['果品產量及產值.xlsx'],
        area_files: ['果品種植及收穫面積.xlsx'],
        complete: true,
      }],
      errors: [],
    },
  },
}

const mergePayload = {
  data: {
    public_id: publicId,
    status: 'succeeded',
    summary: {
      column_count: 3,
      row_count: 3,
      available_crops: ['香蕉', '鳳梨'],
    },
  },
}

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response
}

function workbookResponse(filename: string): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    }),
    blob: vi.fn().mockResolvedValue(new Blob(['anonymous workbook'])),
  } as unknown as Response
}

function selectFiles() {
  fireEvent.change(screen.getByLabelText('選擇產量及產值檔案'), {
    target: { files: [new File(['a'], '果品產量及產值.xlsx')] },
  })
  fireEvent.change(screen.getByLabelText('選擇種植及收穫面積檔案'), {
    target: { files: [new File(['b'], '果品種植及收穫面積.xlsx')] },
  })
}

async function reachStepFour() {
  selectFiles()
  fireEvent.click(screen.getByRole('button', { name: '檢查檔案配對' }))
  const startButton = await screen.findByRole('button', { name: '開始整併' })
  await waitFor(() => expect(startButton).toBeEnabled())
  fireEvent.click(startButton)
  return screen.findByRole('heading', { name: '4. 查詢與下載' })
}

it('keeps step changes and heading focus usable with reduced motion', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({
      data: {
        public_id: '04aa5e62-6b20-4cbd-8555-9a0cc83d121d',
        pairing_result: {
          is_valid: true,
          pairs: [{
            major_category: '果品',
            production_files: ['果品產量及產值.xlsx'],
            area_files: ['果品種植及收穫面積.xlsx'],
            complete: true,
          }],
          errors: [],
        },
      },
    }),
  }))

  render(<MemoryRouter><VolumePriceMergePage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('選擇產量及產值檔案'), {
    target: { files: [new File(['a'], '果品產量及產值.xlsx')] },
  })
  fireEvent.change(screen.getByLabelText('選擇種植及收穫面積檔案'), {
    target: { files: [new File(['b'], '果品種植及收穫面積.xlsx')] },
  })

  fireEvent.click(screen.getByRole('button', { name: '檢查檔案配對' }))
  const reviewHeading = await screen.findByRole('heading', { name: '2. 檢查配對' })
  await waitFor(() => expect(reviewHeading).toHaveFocus())
  expect(screen.getByText('檔案配對完整')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '返回選擇檔案' }))
  const selectionHeading = await screen.findByRole('heading', { name: '1. 選擇檔案' })
  await waitFor(() => expect(selectionHeading).toHaveFocus())
  expect(screen.getByText('果品產量及產值.xlsx')).toBeInTheDocument()
  expect(screen.getByText('果品種植及收穫面積.xlsx')).toBeInTheDocument()
})

it('moves directly to the real summary after a successful reduced-motion merge', async () => {
  const publicId = '04aa5e62-6b20-4cbd-8555-9a0cc83d121d'
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(jsonResponse(201, {
      data: {
        public_id: publicId,
        pairing_result: {
          is_valid: true,
          pairs: [{
            major_category: '果品',
            production_files: ['果品產量及產值.xlsx'],
            area_files: ['果品種植及收穫面積.xlsx'],
            complete: true,
          }],
          errors: [],
        },
      },
    }))
    .mockResolvedValueOnce(jsonResponse(200, {
      data: {
        public_id: publicId,
        status: 'succeeded',
        summary: {
          column_count: 2,
          row_count: 2,
          available_crops: ['香蕉'],
        },
      },
    })))

  render(<MemoryRouter><VolumePriceMergePage /></MemoryRouter>)
  fireEvent.change(screen.getByLabelText('選擇產量及產值檔案'), {
    target: { files: [new File(['a'], '果品產量及產值.xlsx')] },
  })
  fireEvent.change(screen.getByLabelText('選擇種植及收穫面積檔案'), {
    target: { files: [new File(['b'], '果品種植及收穫面積.xlsx')] },
  })

  fireEvent.click(screen.getByRole('button', { name: '檢查檔案配對' }))
  const startButton = await screen.findByRole('button', { name: '開始整併' })
  await waitFor(() => expect(startButton).toBeEnabled())
  fireEvent.click(startButton)

  const resultHeading = await screen.findByRole('heading', { name: '4. 查詢與下載' })
  await waitFor(() => expect(resultHeading).toHaveFocus())
  expect(screen.getByText('香蕉')).toBeInTheDocument()
})

it('queries one product, preserves duplicate rows and scalar values, then focuses the result', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(jsonResponse(201, pairingPayload))
    .mockResolvedValueOnce(jsonResponse(200, mergePayload))
    .mockResolvedValueOnce(jsonResponse(200, {
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
    })))

  render(<MemoryRouter><VolumePriceMergePage /></MemoryRouter>)
  await reachStepFour()

  fireEvent.change(screen.getByRole('combobox', { name: '作物' }), { target: { value: '香蕉' } })
  fireEvent.click(screen.getByRole('button', { name: '查詢' }))

  const heading = await screen.findByRole('heading', { name: '查詢結果：香蕉' })
  await waitFor(() => expect(heading).toHaveFocus())
  expect(screen.getAllByRole('rowheader', { name: '果品產量' })).toHaveLength(2)
  expect(screen.getByText('10 / 20')).toBeInTheDocument()
  expect(screen.getByText('0')).toBeInTheDocument()
  expect(screen.getByLabelText('空值')).toHaveTextContent('—')
  expect(screen.getByRole('button', { name: '下載此作物查詢結果' })).toBeEnabled()
  expect(fetch).toHaveBeenLastCalledWith(
    `/api/v1/price-volume-merge/jobs/${publicId}/result/?product=%E9%A6%99%E8%95%89`,
    expect.objectContaining({ method: 'GET', cache: 'no-store' }),
  )
})

it('ignores an older query that finishes after the selected product changes', async () => {
  let resolveBanana!: (response: Response) => void
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(jsonResponse(201, pairingPayload))
    .mockResolvedValueOnce(jsonResponse(200, mergePayload))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveBanana = resolve }))
    .mockResolvedValueOnce(jsonResponse(200, {
      data: {
        public_id: publicId,
        query_result: {
          product: '鳳梨',
          columns: [{ key: '果品||110年||鳳梨', major_category: '果品', year: '110年', crop: '鳳梨' }],
          rows: [{ metric: '果品產量', values: [88] }],
        },
      },
    }))
  vi.stubGlobal('fetch', fetchMock)

  render(<MemoryRouter><VolumePriceMergePage /></MemoryRouter>)
  await reachStepFour()
  const select = screen.getByRole('combobox', { name: '作物' })
  fireEvent.change(select, { target: { value: '香蕉' } })
  fireEvent.click(screen.getByRole('button', { name: '查詢' }))
  expect(await screen.findByText('正在查詢「香蕉」…')).toBeInTheDocument()

  fireEvent.change(select, { target: { value: '鳳梨' } })
  expect(screen.queryByText('正在查詢「香蕉」…')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '查詢' }))
  expect(await screen.findByRole('heading', { name: '查詢結果：鳳梨' })).toBeInTheDocument()

  resolveBanana(jsonResponse(200, {
    data: {
      public_id: publicId,
      query_result: {
        product: '香蕉',
        columns: [{ key: '果品||110年||香蕉', major_category: '果品', year: '110年', crop: '香蕉' }],
        rows: [{ metric: '舊資料', values: [1] }],
      },
    },
  }))

  await waitFor(() => expect(screen.queryByText('舊資料')).not.toBeInTheDocument())
  expect(screen.getByRole('heading', { name: '查詢結果：鳳梨' })).toBeInTheDocument()
})

it('does not let an old query update a newly created job', async () => {
  const nextPublicId = '15bb6f73-7c31-4dce-9666-ab1dd94e232e'
  let resolveOldQuery!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(jsonResponse(201, pairingPayload))
    .mockResolvedValueOnce(jsonResponse(200, mergePayload))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveOldQuery = resolve }))
    .mockResolvedValueOnce(jsonResponse(201, {
      ...pairingPayload,
      data: { ...pairingPayload.data, public_id: nextPublicId },
    }))
    .mockResolvedValueOnce(jsonResponse(200, {
      ...mergePayload,
      data: { ...mergePayload.data, public_id: nextPublicId },
    })))

  render(<MemoryRouter><VolumePriceMergePage /></MemoryRouter>)
  await reachStepFour()
  fireEvent.change(screen.getByRole('combobox', { name: '作物' }), { target: { value: '香蕉' } })
  fireEvent.click(screen.getByRole('button', { name: '查詢' }))
  expect(await screen.findByText('正在查詢「香蕉」…')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '重新開始' }))
  await screen.findByRole('heading', { name: '1. 選擇檔案' })
  const checkButton = screen.getByRole('button', { name: '檢查檔案配對' })
  await waitFor(() => expect(checkButton).toBeEnabled())
  fireEvent.click(checkButton)
  const startButton = await screen.findByRole('button', { name: '開始整併' })
  await waitFor(() => expect(startButton).toBeEnabled())
  fireEvent.click(startButton)
  await screen.findByRole('heading', { name: '4. 查詢與下載' })
  expect(screen.getByText(new RegExp(nextPublicId))).toBeInTheDocument()

  resolveOldQuery(jsonResponse(200, {
    data: {
      public_id: publicId,
      query_result: {
        product: '香蕉',
        columns: [{ key: 'old', major_category: '果品', year: '110年', crop: '香蕉' }],
        rows: [{ metric: '舊工作資料', values: [1] }],
      },
    },
  }))

  await waitFor(() => expect(screen.queryByText('舊工作資料')).not.toBeInTheDocument())
  expect(screen.queryByRole('heading', { name: '查詢結果：香蕉' })).not.toBeInTheDocument()
})

it('downloads the complete and currently displayed product workbooks without duplicate actions', async () => {
  let resolveFullDownload!: (response: Response) => void
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(jsonResponse(201, pairingPayload))
    .mockResolvedValueOnce(jsonResponse(200, mergePayload))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveFullDownload = resolve }))
    .mockResolvedValueOnce(jsonResponse(200, {
      data: {
        public_id: publicId,
        query_result: {
          product: '香蕉',
          columns: [{ key: '果品||110年||香蕉', major_category: '果品', year: '110年', crop: '香蕉' }],
          rows: [{ metric: '果品產量', values: [0] }],
        },
      },
    }))
    .mockResolvedValueOnce(workbookResponse('香蕉合併結果.xlsx'))
  vi.stubGlobal('fetch', fetchMock)
  const createObjectURL = vi.fn().mockReturnValue('blob:anonymous-workbook')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

  render(<MemoryRouter><VolumePriceMergePage /></MemoryRouter>)
  await reachStepFour()

  const fullDownload = screen.getByRole('button', { name: '下載全部合併結果' })
  fireEvent.click(fullDownload)
  fireEvent.click(fullDownload)
  expect(fetchMock).toHaveBeenCalledTimes(3)
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/v1/price-volume-merge/jobs/${publicId}/download/`,
    expect.objectContaining({ cache: 'no-store' }),
  )
  expect(screen.getByRole('combobox', { name: '作物' })).toBeDisabled()

  resolveFullDownload(workbookResponse('完整合併結果.xlsx'))
  expect(await screen.findByText('已送出下載：完整合併結果.xlsx')).toBeInTheDocument()
  expect(clickSpy).toHaveBeenCalledTimes(1)

  const select = screen.getByRole('combobox', { name: '作物' })
  await waitFor(() => expect(select).toBeEnabled())
  fireEvent.change(select, { target: { value: '香蕉' } })
  fireEvent.click(screen.getByRole('button', { name: '查詢' }))
  await screen.findByRole('heading', { name: '查詢結果：香蕉' })
  fireEvent.click(screen.getByRole('button', { name: '下載此作物查詢結果' }))

  expect(await screen.findByText('已送出下載：香蕉合併結果.xlsx')).toBeInTheDocument()
  expect(fetchMock).toHaveBeenLastCalledWith(
    `/api/v1/price-volume-merge/jobs/${publicId}/download/?product=%E9%A6%99%E8%95%89`,
    expect.objectContaining({ cache: 'no-store' }),
  )
  expect(clickSpy).toHaveBeenCalledTimes(2)
  await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledTimes(2))
})

it('does not trigger a late download after the user restarts the workflow', async () => {
  let resolveDownload!: (response: Response) => void
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(jsonResponse(201, pairingPayload))
    .mockResolvedValueOnce(jsonResponse(200, mergePayload))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveDownload = resolve }))
  vi.stubGlobal('fetch', fetchMock)
  const createObjectURL = vi.fn().mockReturnValue('blob:late-workbook')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

  render(<MemoryRouter><VolumePriceMergePage /></MemoryRouter>)
  await reachStepFour()

  fireEvent.click(screen.getByRole('button', { name: '下載全部合併結果' }))
  expect(await screen.findByText('正在準備完整 Excel…')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '重新開始' }))
  await screen.findByRole('heading', { name: '1. 選擇檔案' })

  const lateResponse = workbookResponse('不應下載.xlsx')
  resolveDownload(lateResponse)
  await waitFor(() => expect(lateResponse.blob).toHaveBeenCalledTimes(1))

  expect(createObjectURL).not.toHaveBeenCalled()
  expect(clickSpy).not.toHaveBeenCalled()
  expect(screen.queryByText('已送出下載：不應下載.xlsx')).not.toBeInTheDocument()
  expect(screen.getByText('果品產量及產值.xlsx')).toBeInTheDocument()
  expect(screen.getByText('果品種植及收穫面積.xlsx')).toBeInTheDocument()
})

it('locks an expired job and keeps a restart path without turning JSON into a download', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(jsonResponse(201, pairingPayload))
    .mockResolvedValueOnce(jsonResponse(200, mergePayload))
    .mockResolvedValueOnce(jsonResponse(410, {
      code: 'job_expired',
      message: 'internal message',
      field_errors: {},
    })))

  render(<MemoryRouter><VolumePriceMergePage /></MemoryRouter>)
  await reachStepFour()
  fireEvent.change(screen.getByRole('combobox', { name: '作物' }), { target: { value: '香蕉' } })
  fireEvent.click(screen.getByRole('button', { name: '查詢' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('已過期')
  expect(screen.getByRole('combobox', { name: '作物' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '下載全部合併結果' })).toBeDisabled()
  expect(screen.getByRole('button', { name: '重新開始' })).toBeEnabled()
  expect(screen.getByText('這個工作已無法繼續查詢或下載。')).toBeInTheDocument()
})
