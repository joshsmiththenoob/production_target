export interface PairingPair {
  major_category: string
  production_files: string[]
  area_files: string[]
  complete: boolean
}

export interface PairingResult {
  is_valid: boolean
  pairs: PairingPair[]
  errors: string[]
}

export interface CreatedPairingJob {
  public_id: string
  pairing_result: PairingResult
}

export interface MergeSummary {
  column_count: number
  row_count: number
  available_crops: string[]
}

export interface CompletedMergeJob {
  public_id: string
  status: 'succeeded'
  summary: MergeSummary
}

export type MergeResultValue = number | string | null

export interface MergeResultColumn {
  key: string
  major_category: string
  year: string
  crop: string
}

export interface MergeResultRow {
  metric: string
  values: MergeResultValue[]
}

export interface MergeQueryResult {
  product: string
  columns: MergeResultColumn[]
  rows: MergeResultRow[]
}

export interface QueriedMergeJob {
  public_id: string
  query_result: MergeQueryResult
}

export interface DownloadedWorkbook {
  blob: Blob
  filename: string
}
