import type { CompareFileField, CompareScope, CreatedComparisonJob } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}
function isScope(value: unknown): value is CompareScope {
  return isRecord(value) && strings(value.crops) && strings(value.metrics) &&
    Array.isArray(value.years) && value.years.every(year => Number.isInteger(year))
}
function isJob(value: unknown): value is CreatedComparisonJob {
  return isRecord(value) && typeof value.public_id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.public_id) &&
    isRecord(value.preview) && isScope(value.preview) &&
    isScope(value.preview.defaults) && strings(value.preview.issues)
}

export class ComparisonApiError extends Error {
  readonly fields: Partial<Record<CompareFileField, string>>

  constructor(code: string, fieldErrors?: unknown) {
    super(code === 'invalid_upload'
      ? '檔案未通過上傳檢查，請確認已選擇一份 .xlsx 與一份 .pdf。'
      : code === 'invalid_preview'
        ? '無法解析檔案，請確認 Excel 檔案完整，PDF 為文字型且可正常開啟。'
        : '目前無法建立比對範圍，請檢查網路連線後重試。')
    this.name = 'ComparisonApiError'
    this.fields = {}
    if (code === 'invalid_upload' && isRecord(fieldErrors)) {
      if ('excel_file' in fieldErrors) this.fields.excel_file = '請選擇有效且非空白的 .xlsx 檔案。'
      if ('pdf_file' in fieldErrors) this.fields.pdf_file = '請選擇有效且非空白的 .pdf 檔案。'
    }
  }
}

export async function createComparisonPreview(
  excel: File, pdf: File, signal: AbortSignal,
): Promise<CreatedComparisonJob> {
  const body = new FormData()
  body.append('excel_file', excel)
  body.append('pdf_file', pdf)
  // Same-origin fetch, matching the existing feature client. The browser supplies the boundary.
  const response = await fetch('/api/v1/table-compare/jobs/', { method: 'POST', body, signal })
  const payload: unknown = await response.json()
  if (response.status === 201 && isRecord(payload) && isJob(payload.data)) return payload.data
  if (response.status === 400 && isRecord(payload) && typeof payload.code === 'string') {
    throw new ComparisonApiError(payload.code, payload.field_errors)
  }
  throw new ComparisonApiError('invalid_response')
}
