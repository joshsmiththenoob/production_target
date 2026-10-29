import type {
  CompareFileField,
  CompareScope,
  CompareScopeField,
  ComparisonDownload,
  ComparisonResult,
  CreatedComparisonJob,
} from './types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

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
    UUID_PATTERN.test(value.public_id) && isRecord(value.preview) &&
    isScope(value.preview) && isScope(value.preview.defaults) && strings(value.preview.issues)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isComparisonResult(value: unknown): value is ComparisonResult {
  if (!isRecord(value) || !Number.isInteger(value.row_count) || !Array.isArray(value.rows)) return false
  if (value.row_count !== value.rows.length) return false
  return value.rows.every(row => isRecord(row) &&
    typeof row.crop === 'string' && Number.isInteger(row.year) &&
    typeof row.metric === 'string' && isNullableString(row.pdf_unit) &&
    isNullableString(row.excel_unit) && isNullableString(row.pdf_value) &&
    isNullableString(row.excel_value) && typeof row.status === 'string')
}

function parseScopeFields(fieldErrors: unknown): Partial<Record<CompareScopeField, string>> {
  if (!isRecord(fieldErrors)) return {}
  const fields: Partial<Record<CompareScopeField, string>> = {}
  for (const field of ['crops', 'years', 'metrics'] as const) {
    if (field in fieldErrors) fields[field] = `${field} 的比對條件無效。`
  }
  return fields
}

export class ComparisonApiError extends Error {
  readonly code: string
  readonly status: number | null
  readonly fileFields: Partial<Record<CompareFileField, string>>
  readonly scopeFields: Partial<Record<CompareScopeField, string>>
  readonly jobUnavailable: boolean

  constructor(code: string, options: { status?: number; fieldErrors?: unknown } = {}) {
    const messages: Record<string, string> = {
      invalid_upload: '檔案未通過上傳檢查，請確認已選擇一份 .xlsx 與一份 .pdf。',
      invalid_preview: '無法解析檔案，請確認 Excel 檔案完整，PDF 為文字型且可正常開啟。',
      invalid_scope: '比對條件無效，請重新建立工作並確認三組條件。',
      invalid_comparison: '本次比對範圍無法執行，請重新建立工作並檢查來源資料。',
      job_not_found: '找不到這個比對工作，請重新建立工作。',
      job_not_runnable: '這個工作目前無法執行，請重新建立工作。',
      job_expired: '這個工作已過期，請重新建立工作。',
      comparison_failed: '比對處理失敗，請重新建立工作後再試。',
      invalid_response: '伺服器回傳了無法辨識的比對結果，請重新建立工作。',
      network_error: '網路狀態不明，無法確認工作是否已執行；請重新建立工作，勿直接重送。',
      invalid_download: '下載回應不是有效的 Excel 檔案，請稍後再試。',
      download_failed: '目前無法準備下載檔案，請稍後再試。',
    }
    super(messages[code] ?? messages.network_error)
    this.name = 'ComparisonApiError'
    this.code = code
    this.status = options.status ?? null
    this.fileFields = {}
    this.scopeFields = parseScopeFields(options.fieldErrors)
    this.jobUnavailable = ['job_not_found', 'job_not_runnable', 'job_expired'].includes(code)
    if (code === 'invalid_upload' && isRecord(options.fieldErrors)) {
      if ('excel_file' in options.fieldErrors) this.fileFields.excel_file = '請選擇有效且非空白的 .xlsx 檔案。'
      if ('pdf_file' in options.fieldErrors) this.fileFields.pdf_file = '請選擇有效且非空白的 .pdf 檔案。'
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function createComparisonPreview(
  excel: File, pdf: File, signal: AbortSignal,
): Promise<CreatedComparisonJob> {
  const body = new FormData()
  body.append('excel_file', excel)
  body.append('pdf_file', pdf)
  const response = await fetch('/api/v1/table-compare/jobs/', { method: 'POST', body, signal })
  const payload = await readJson(response)
  if (response.status === 201 && isRecord(payload) && isJob(payload.data)) return payload.data
  if (response.status === 400 && isRecord(payload) && typeof payload.code === 'string') {
    throw new ComparisonApiError(payload.code, { status: response.status, fieldErrors: payload.field_errors })
  }
  throw new ComparisonApiError('invalid_response', { status: response.status })
}

export async function runComparison(
  publicId: string, scope: CompareScope, signal: AbortSignal,
): Promise<ComparisonResult> {
  const response = await fetch(`/api/v1/table-compare/jobs/${publicId}/run/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scope),
    signal,
  })
  const payload = await readJson(response)
  if (response.status === 200 && isRecord(payload) && isComparisonResult(payload.data)) return payload.data
  if (isRecord(payload) && typeof payload.code === 'string') {
    throw new ComparisonApiError(payload.code, { status: response.status, fieldErrors: payload.field_errors })
  }
  throw new ComparisonApiError('invalid_response', { status: response.status })
}

function safeFilename(value: string): string {
  const invalidCharacters = '\\/:*?"<>|'
  const filename = [...value]
    .map(character => character.charCodeAt(0) < 32 || invalidCharacters.includes(character) ? '_' : character)
    .join('')
    .trim()
  return filename.toLowerCase().endsWith('.xlsx') && filename.length > 5
    ? filename
    : 'table-comparison-result.xlsx'
}

function responseFilename(header: string | null): string {
  if (!header) return 'table-comparison-result.xlsx'
  const utf8 = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]
  if (utf8) {
    try {
      return safeFilename(decodeURIComponent(utf8.replace(/^"|"$/g, '')))
    } catch {
      return 'table-comparison-result.xlsx'
    }
  }
  const plain = header.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i)
  return safeFilename((plain?.[1] ?? plain?.[2] ?? '').trim())
}

// The UI keeps this dormant until Django registers and verifies the download route.
export async function downloadComparisonWorkbook(
  publicId: string, signal: AbortSignal,
): Promise<ComparisonDownload> {
  const response = await fetch(`/api/v1/table-compare/jobs/${publicId}/download/`, {
    method: 'GET',
    cache: 'no-store',
    headers: { Accept: XLSX_TYPE },
    signal,
  })
  if (!response.ok) {
    const payload = await readJson(response)
    const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : 'download_failed'
    throw new ComparisonApiError(code, { status: response.status })
  }
  const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
  if (contentType !== XLSX_TYPE) throw new ComparisonApiError('invalid_download', { status: response.status })
  return {
    blob: await response.blob(),
    filename: responseFilename(response.headers.get('Content-Disposition')),
  }
}
