import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '../../App'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('health status', () => {
  it('shows loading while the request is pending', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))

    render(<App />)

    expect(screen.getByText('正在檢查服務…')).toBeInTheDocument()
  })

  it('shows backend, database and API version details after a successful request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'ok',
          service: 'production-target-backend',
          database: 'connected',
          api_version: "v1",
        }),
      }),
    )

    render(<App />)


    // 檢查 render後的測試畫面是否正常
    expect(await screen.findByText('服務連線正常')).toBeInTheDocument()
    expect(screen.getByText('production-target-backend')).toBeInTheDocument()
    expect(screen.getByText('connected')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
  })

  it('shows an error and retry action when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))

    render(<App />)

    expect(await screen.findByText('無法連線服務')).toBeInTheDocument()
    expect(screen.getByText('Network unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新檢查' })).toBeInTheDocument()
  })
})

