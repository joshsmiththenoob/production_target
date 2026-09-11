export interface HealthResponse {
  status: 'ok'
  service: string
  database: 'connected'
  api_version: string
}

export type HealthState =
  | { status: 'loading' }
  | { status: 'success'; data: HealthResponse }
  | { status: 'error'; message: string }

