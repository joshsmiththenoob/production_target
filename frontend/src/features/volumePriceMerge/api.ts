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

interface ErrorResponse {
  code: string
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
