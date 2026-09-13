import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HealthStatus from './HealthStatus'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('health status', () => {
  it('retries through loading to success with a fresh request', async () => {
    let resolveRetry!: (value: unknown) => void
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRetry = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    render(<HealthStatus />)
    fireEvent.click(await screen.findByRole('button', { name: '重新檢查' }))
    expect(screen.getByText('正在檢查服務…')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstSignal = fetchMock.mock.calls[0][1].signal as AbortSignal
    const retrySignal = fetchMock.mock.calls[1][1].signal as AbortSignal
    expect(firstSignal.aborted).toBe(true)
    expect(retrySignal.aborted).toBe(false)
    expect(retrySignal).not.toBe(firstSignal)
    await act(async () => resolveRetry({
      ok: true,
      json: async () => ({ status: 'ok', service: 'production-target-backend', database: 'connected', api_version: 'v1' }),
    }))
    expect(await screen.findByText('服務連線正常')).toBeInTheDocument()
  })

  it('aborts the pending health request when unmounted', () => {
    const fetchMock = vi.fn(() => new Promise(() => undefined))
    vi.stubGlobal('fetch', fetchMock)
    const { unmount } = render(<HealthStatus />)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/health/', {
      headers: { Accept: 'application/json' }, signal: expect.any(AbortSignal),
    })
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal
    expect(signal?.aborted).toBe(false)
    unmount()
    expect(signal?.aborted).toBe(true)
  })

  it('shows loading while the request is pending', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))

    render(<HealthStatus />)

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

    render(<HealthStatus />)


    // 檢查 render後的測試畫面是否正常
    expect(await screen.findByText('服務連線正常')).toBeInTheDocument()
    expect(screen.getByText('production-target-backend')).toBeInTheDocument()
    expect(screen.getByText('connected')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
  })

  it('shows an error and retry action when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')))

    render(<HealthStatus />)

    expect(await screen.findByText('無法連線服務')).toBeInTheDocument()
    expect(screen.getByText('Network unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重新檢查' })).toBeInTheDocument()
  })
})

