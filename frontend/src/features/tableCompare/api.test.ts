import { afterEach, expect, it, vi } from 'vitest'
import { createComparisonPreview } from './api'

afterEach(() => vi.unstubAllGlobals())

const valid = {
  public_id: '04aa5e62-6b20-4cbd-8555-9a0cc83d121d',
  preview: {
    crops: ['茶'], years: [], metrics: ['產量'],
    defaults: { crops: ['茶'], years: [], metrics: ['產量'] }, issues: [],
  },
}

it.each([
  [200, valid],
  [201, { ...valid, public_id: 'not-a-uuid' }],
  [201, { ...valid, preview: { ...valid.preview, years: ['111'] } }],
  [201, { ...valid, preview: { ...valid.preview, defaults: null } }],
])('rejects an invalid status or preview contract (%s)', async (status, data) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, json: async () => ({ data }) }))
  await expect(createComparisonPreview(
    new File(['xlsx'], 'anonymous.xlsx'), new File(['pdf'], 'anonymous.pdf'), new AbortController().signal,
  )).rejects.toThrow('目前無法建立比對範圍')
})
