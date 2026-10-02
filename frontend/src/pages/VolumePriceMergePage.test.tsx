import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'

import VolumePriceMergePage from './VolumePriceMergePage'

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>()
  return { ...actual, useReducedMotion: () => true }
})

afterEach(() => vi.unstubAllGlobals())

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response
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
