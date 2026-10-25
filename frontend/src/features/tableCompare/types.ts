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

export type CompareFileField = 'excel_file' | 'pdf_file'
