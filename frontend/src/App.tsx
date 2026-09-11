import { useEffect, useState } from 'react'

import './App.css'
import { fetchHealth } from './features/health/api'
import type { HealthState } from './features/health/types'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '發生未知錯誤'
}


function App() {
  const [health, setHealth] = useState<HealthState>({ status: 'loading' })
  const [requestKey, setRequestKey] = useState(0)


  // Use useEffect() function to refresh page from first representation of webpage
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
    <main className="page-shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Phase 0 · Health Check</p>
        <h1 id="page-title">年度生產目標比較器</h1>
        <p className="subtitle">
          第一條 React → DRF → PostgreSQL 資料流
        </p>

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
    </main>
  )
}

export default App

