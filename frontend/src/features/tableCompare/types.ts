export interface CompareScope {
  crops: string[]
  years: number[]
  metrics: string[]
}

export interface ComparisonPreview extends CompareScope {
  defaults: CompareScope
  issues: string[]
}

export interface CreatedComparisonJob {
  public_id: string
  preview: ComparisonPreview
}

export interface ComparisonRow {
  crop: string
  year: number
  metric: string
  pdf_unit: string | null
  excel_unit: string | null
  pdf_value: string | null
  excel_value: string | null
  status: string
}

export interface ComparisonResult {
  row_count: number
  rows: ComparisonRow[]
}

export interface ComparisonRunSnapshot {
  publicId: string
  scope: CompareScope
  issues: string[]
}

export interface ComparisonDownload {
  blob: Blob
  filename: string
}

export type CompareFileField = 'excel_file' | 'pdf_file'
export type CompareScopeField = keyof CompareScope
