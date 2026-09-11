import type { HealthResponse } from './types'

function isHealthResponse(value: unknown): value is HealthResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const health = value as Record<string, unknown>
  return (
    health.status === 'ok' &&
    typeof health.service === 'string' &&
    health.database === 'connected' &&
    typeof health.api_version === 'string'
  )
}


export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/v1/health/', {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error('Health API 回應錯誤（HTTP ' + response.status + '）')
  }

  const data: unknown = await response.json()
  if (!isHealthResponse(data)) {
    throw new Error('Health API 回傳了無法辨識的資料格式')
  }

  return data
}

