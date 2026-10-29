import type { ComparisonRow } from './types'

export type ComparisonStatusGroup = 'same' | 'difference' | 'review'

const differenceStatuses = new Set(['數值不同', '單位不同'])
const reviewStatuses = new Set([
  'PDF 缺少資料',
  'Excel 缺少資料',
  '缺值／標記，暫不比對',
])

export function getComparisonStatusGroup(status: string): ComparisonStatusGroup {
  if (status === '相同') return 'same'
  if (differenceStatuses.has(status)) return 'difference'
  if (reviewStatuses.has(status)) return 'review'
  return 'review'
}

export function countComparisonStatuses(rows: ComparisonRow[]) {
  const counts: Record<ComparisonStatusGroup, number> = {
    same: 0,
    difference: 0,
    review: 0,
  }
  for (const row of rows) counts[getComparisonStatusGroup(row.status)] += 1
  return counts
}
