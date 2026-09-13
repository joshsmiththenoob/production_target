import { useEffect, useState } from 'react'

import { fetchHealth } from './api'
import type { HealthState } from './types'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '發生未知錯誤'
}

function HealthStatus() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' })
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setHealth({ status: 'loading' })

    fetchHealth(controller.signal)
      .then((data) => setHealth({ status: 'success', data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setHealth({ status: 'error', message: getErrorMessage(error) })
      })

    return () => controller.abort()
  }, [requestKey])

  return (
    <section aria-label="系統連線狀態">
      <div
        className={'status-card status-card--' + health.status}
        aria-live="polite"
      >
        {health.status === 'loading' && (
          <>
            <span
              className="status-dot status-dot--loading"
              aria-hidden="true"
            />
            <div>
              <h2>正在檢查服務…</h2>
              <p>React 正在呼叫 Django health API。</p>
            </div>
          </>
        )}

        {health.status === 'success' && (
          <>
            <span
              className="status-dot status-dot--success"
              aria-hidden="true"
            />
            <div>
              <h2>服務連線正常</h2>
              <dl>
                <div>
                  <dt>Backend</dt>
                  <dd>{health.data.service}</dd>
                </div>
                <div>
                  <dt>PostgreSQL</dt>
                  <dd>{health.data.database}</dd>
                </div>
                <div>
                  <dt>API Version</dt>
                  <dd>{health.data.api_version}</dd>
                </div>
              </dl>
            </div>
          </>
        )}

        {health.status === 'error' && (
          <>
            <span
              className="status-dot status-dot--error"
              aria-hidden="true"
            />
            <div>
              <h2>無法連線服務</h2>
              <p>{health.message}</p>
              <button
                type="button"
                onClick={() => setRequestKey((key) => key + 1)}
              >
                重新檢查
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default HealthStatus

