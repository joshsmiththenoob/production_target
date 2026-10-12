import type {
  CompletedMergeJob,
  CreatedPairingJob,
  DownloadedWorkbook,
  MergeQueryResult,
  MergeResultColumn,
  MergeResultValue,
  MergeSummary,
  PairingPair,
  PairingResult,
  QueriedMergeJob,
} from './types'

interface ErrorResponse {
  code: string
  message?: string
  field_errors: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isPairingPair(value: unknown): value is PairingPair {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.major_category === 'string' &&
    isStringArray(value.production_files) &&
    isStringArray(value.area_files) &&
    typeof value.complete === 'boolean'
  )
}

export function isPairingResult(value: unknown): value is PairingResult {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.is_valid === 'boolean' &&
    Array.isArray(value.pairs) &&
    value.pairs.every(isPairingPair) &&
    isStringArray(value.errors)
  )
}

function isCreatedPairingJob(value: unknown): value is CreatedPairingJob {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.public_id === 'string' && isPairingResult(value.pairing_result)
}

function isSuccessResponse(value: unknown): value is { data: CreatedPairingJob } {
  return isRecord(value) && isCreatedPairingJob(value.data)
}

function isMergeSummary(value: unknown): value is MergeSummary {
  return (
    isRecord(value) &&
    typeof value.column_count === 'number' &&
    Number.isInteger(value.column_count) &&
    value.column_count >= 0 &&
    typeof value.row_count === 'number' &&
    Number.isInteger(value.row_count) &&
    value.row_count >= 0 &&
    isStringArray(value.available_crops)
  )
}

function isCompletedMergeJob(value: unknown): value is CompletedMergeJob {
  return (
    isRecord(value) &&
    typeof value.public_id === 'string' &&
    value.status === 'succeeded' &&
    isMergeSummary(value.summary)
  )
}

function isMergeSuccessResponse(value: unknown): value is { data: CompletedMergeJob } {
  return isRecord(value) && isCompletedMergeJob(value.data)
}

function isMergeResultValue(value: unknown): value is MergeResultValue {
  return value === null || typeof value === 'string' || (
    typeof value === 'number' && Number.isFinite(value)
  )
}

function isMergeResultColumn(value: unknown): value is MergeResultColumn {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.major_category === 'string' &&
    typeof value.year === 'string' &&
    typeof value.crop === 'string'
  )
}

function isMergeQueryResult(value: unknown): value is MergeQueryResult {
  if (
    !isRecord(value) ||
    typeof value.product !== 'string' ||
    !Array.isArray(value.columns) ||
    !value.columns.every(isMergeResultColumn) ||
    !Array.isArray(value.rows)
  ) {
    return false
  }

  const columns = value.columns
  const rows = value.rows
  return rows.every((row) => (
    isRecord(row) &&
    typeof row.metric === 'string' &&
    Array.isArray(row.values) &&
    row.values.length === columns.length &&
    row.values.every(isMergeResultValue)
  ))
}

function isQueriedMergeJob(value: unknown): value is QueriedMergeJob {
  return (
    isRecord(value) &&
    typeof value.public_id === 'string' &&
    isMergeQueryResult(value.query_result)
  )
}

function isQuerySuccessResponse(value: unknown): value is { data: QueriedMergeJob } {
  return isRecord(value) && isQueriedMergeJob(value.data)
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return isRecord(value) && typeof value.code === 'string' && 'field_errors' in value
}

function getSafeErrorMessage(code: string): string {
  if (code === 'invalid_upload') {
    return '檔案未通過上傳檢查。請確認兩類都已選擇，且檔案格式為 .xlsx。'
  }

  if (code === 'invalid_workbook') {
    return 'Excel 檔案無法讀取，或檔名與工作表 A1 標題不一致。請檢查後重試。'
  }

  return '目前無法檢查檔案配對，請稍後重試。'
}

export class PairingApiError extends Error {
  readonly code: string
  readonly pairingResult: PairingResult | null

  constructor(code: string, fieldErrors: unknown) {
    super(getSafeErrorMessage(code))
    this.name = 'PairingApiError'
    this.code = code
    this.pairingResult =
      code === 'invalid_pairing' && isPairingResult(fieldErrors) ? fieldErrors : null
  }
}

function getMergeErrorMessage(code: string): string {
  if (code === 'job_not_found') {
    return '找不到這筆整併工作，請返回重新上傳並建立工作。'
  }
  if (code === 'job_expired') {
    return '這筆整併工作已過期，請返回重新上傳並建立工作。'
  }
  if (code === 'job_not_runnable') {
    return '這筆工作的目前狀態不允許再次整併，請返回重新建立工作。'
  }
  return '伺服器未能完成整併，請返回重新建立工作後再試。'
}

export class MergeApiError extends Error {
  readonly code: string
  readonly resultIsUnknown: boolean

  constructor(code: string, message?: string, resultIsUnknown = false) {
    super(message ?? getMergeErrorMessage(code))
    this.name = 'MergeApiError'
    this.code = code
    this.resultIsUnknown = resultIsUnknown
  }
}

function getResultErrorMessage(code: string): string {
  if (code === 'invalid_product') return '查詢條件無效，請重新選擇作物。'
  if (code === 'job_not_found') return '找不到這筆整併工作，請重新開始建立工作。'
  if (code === 'job_expired') return '這筆整併工作已過期，請重新開始建立工作。'
  if (code === 'job_not_successful' || code === 'job_not_runnable') {
    return '這筆工作目前無法讀取結果，請重新開始建立工作。'
  }
  if (code === 'invalid_response') return '伺服器回傳的結果格式不正確，請稍後重試。'
  return '目前無法取得整併結果，請稍後重試。'
}

export class ResultApiError extends Error {
  readonly code: string
  readonly jobUnavailable: boolean

  constructor(code: string, message?: string) {
    super(message ?? getResultErrorMessage(code))
    this.name = 'ResultApiError'
    this.code = code
    this.jobUnavailable = ['job_not_found', 'job_expired', 'job_not_successful', 'job_not_runnable'].includes(code)
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

async function readErrorResponse(response: Response): Promise<ErrorResponse | null> {
  try {
    const payload: unknown = await response.json()
    return isErrorResponse(payload) ? payload : null
  } catch {
    return null
  }
}

function safeWorkbookFilename(contentDisposition: string | null): string {
  let candidate: string | null = null

  if (contentDisposition) {
    const extendedMatch = contentDisposition.match(/filename\*\s*=\s*([^;]+)/i)
    if (extendedMatch) {
      const rawValue = extendedMatch[1].trim().replace(/^"|"$/g, '')
      const encodedValue = rawValue.match(/^UTF-8'[^']*'(.*)$/i)?.[1] ?? rawValue
      try {
        candidate = decodeURIComponent(encodedValue)
      } catch {
        candidate = null
      }
    }

    if (!candidate) {
      const filenameMatch = contentDisposition.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i)
      candidate = filenameMatch?.[1] ?? filenameMatch?.[2]?.trim() ?? null
    }
  }

  const safeName = candidate
    ?.split(/[\\/]/)
    .pop()
    ?.split('')
    .filter((character) => {
      const codePoint = character.charCodeAt(0)
      return codePoint >= 32 && codePoint !== 127
    })
    .join('')
    .trim()

  return safeName && safeName.toLowerCase().endsWith('.xlsx')
    ? safeName
    : 'production-target-result.xlsx'
}

export async function createPairingPreview(
  productionFiles: File[],
  areaFiles: File[],
): Promise<CreatedPairingJob> {
  const formData = new FormData()
  productionFiles.forEach((file) => formData.append('production_files', file))
  areaFiles.forEach((file) => formData.append('area_files', file))


  // Fetch(call) backend API
  const response = await fetch('/api/v1/price-volume-merge/jobs/', {
    method: 'POST',
    body: formData,
  })

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('目前無法檢查檔案配對，請稍後重試。')
  }

  if (response.status === 201 && isSuccessResponse(payload)) {
    return payload.data
  }

  if (!response.ok && isErrorResponse(payload)) {
    throw new PairingApiError(payload.code, payload.field_errors)
  }

  throw new Error('目前無法檢查檔案配對，請稍後重試。')
}

export async function runVolumePriceMerge(publicId: string): Promise<CompletedMergeJob> {
  let response: Response
  try {
    response = await fetch(
      `/api/v1/price-volume-merge/jobs/${encodeURIComponent(publicId)}/run/`,
      { method: 'POST' },
    )
  } catch {
    throw new MergeApiError(
      'network_unknown',
      '網路連線中斷，無法確認伺服器是否已完成整併。請勿直接重送同一工作。',
      true,
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new MergeApiError(
      'invalid_response',
      '伺服器回應無法確認，請勿直接重送同一工作。',
      true,
    )
  }

  if (response.status === 200 && isMergeSuccessResponse(payload)) {
    if (payload.data.public_id !== publicId) {
      throw new MergeApiError(
        'invalid_response',
        '伺服器回應的工作編號不一致，請勿直接重送同一工作。',
        true,
      )
    }
    return payload.data
  }

  if (!response.ok && isErrorResponse(payload)) {
    throw new MergeApiError(payload.code)
  }

  throw new MergeApiError(
    'invalid_response',
    '伺服器尚未回傳可確認的整併結果，請勿直接重送同一工作。',
    true,
  )
}

export async function queryVolumePriceMergeResult(
  publicId: string,
  product: string,
  signal?: AbortSignal,
): Promise<QueriedMergeJob> {
  const searchParams = new URLSearchParams({ product })
  const url = `/api/v1/price-volume-merge/jobs/${encodeURIComponent(publicId)}/result/?${searchParams.toString()}`

  let response: Response
  try {
    response = await fetch(url, { method: 'GET', cache: 'no-store', signal })
  } catch (error: unknown) {
    if (isAbortError(error)) throw error
    throw new ResultApiError('network_error')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ResultApiError('invalid_response')
  }

  if (response.status === 200 && isQuerySuccessResponse(payload)) {
    if (payload.data.public_id !== publicId || payload.data.query_result.product !== product) {
      throw new ResultApiError('invalid_response')
    }
    return payload.data
  }

  if (!response.ok && isErrorResponse(payload)) {
    throw new ResultApiError(payload.code)
  }

  throw new ResultApiError('invalid_response')
}

export async function downloadVolumePriceMergeResult(
  publicId: string,
  product?: string,
  signal?: AbortSignal,
): Promise<DownloadedWorkbook> {
  const searchParams = new URLSearchParams()
  if (product) searchParams.set('product', product)
  const queryString = searchParams.toString()
  const url = `/api/v1/price-volume-merge/jobs/${encodeURIComponent(publicId)}/download/${queryString ? `?${queryString}` : ''}`

  let response: Response
  try {
    response = await fetch(url, { method: 'GET', cache: 'no-store', signal })
  } catch (error: unknown) {
    if (isAbortError(error)) throw error
    throw new ResultApiError('network_error')
  }

  if (!response.ok) {
    const errorPayload = await readErrorResponse(response)
    throw new ResultApiError(errorPayload?.code ?? 'invalid_response')
  }

  const contentType = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()
  if (response.status !== 200 || contentType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    throw new ResultApiError('invalid_response')
  }

  return {
    blob: await response.blob(),
    filename: safeWorkbookFilename(response.headers.get('Content-Disposition')),
  }
}
