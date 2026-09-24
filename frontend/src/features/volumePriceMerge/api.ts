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
