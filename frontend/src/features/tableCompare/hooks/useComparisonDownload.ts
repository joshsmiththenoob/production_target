import { useCallback, useEffect, useRef, useState } from 'react'

import {
  ComparisonDownloadError,
  downloadComparisonWorkbook,
} from '../api'

export type ComparisonDownloadStatus =
  | 'idle'
  | 'downloading'
  | 'success'
  | 'error'

export function useComparisonDownload(publicId: string | null) {
  const [status, setStatus] = useState<ComparisonDownloadStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<ComparisonDownloadError | null>(null)
  const [jobUnavailable, setJobUnavailable] = useState(false)
  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const locked = useRef(false)
  const objectUrls = useRef(new Map<string, number>())

  const releaseObjectUrls = useCallback(() => {
    for (const [objectUrl, timer] of objectUrls.current) {
      window.clearTimeout(timer)
      URL.revokeObjectURL(objectUrl)
    }
    objectUrls.current.clear()
  }, [])

  const invalidate = useCallback(() => {
    requestId.current += 1
    controller.current?.abort()
    controller.current = null
    locked.current = false
    releaseObjectUrls()
  }, [releaseObjectUrls])

  const reset = useCallback(() => {
    invalidate()
    setStatus('idle')
    setMessage(null)
    setError(null)
    setJobUnavailable(false)
  }, [invalidate])

  useEffect(() => {
    reset()
  }, [publicId, reset])

  useEffect(() => () => invalidate(), [invalidate])

  async function download(): Promise<boolean> {
    if (!publicId || locked.current || jobUnavailable) return false

    const id = requestId.current + 1
    requestId.current = id
    const requestPublicId = publicId
    const request = new AbortController()
    controller.current = request
    locked.current = true
    setStatus('downloading')
    setMessage(null)
    setError(null)

    try {
      const result = await downloadComparisonWorkbook(
        requestPublicId,
        request.signal,
      )
      if (id !== requestId.current || request.signal.aborted) return false

      const objectUrl = URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = result.filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()

      const timer = window.setTimeout(() => {
        if (objectUrls.current.delete(objectUrl)) {
          URL.revokeObjectURL(objectUrl)
        }
      }, 0)
      objectUrls.current.set(objectUrl, timer)
      setStatus('success')
      setMessage(`已開始下載：${result.filename}`)
      return true
    } catch (caught: unknown) {
      if (
        id !== requestId.current ||
        request.signal.aborted ||
        (caught instanceof Error && caught.name === 'AbortError')
      ) return false

      const downloadError = caught instanceof ComparisonDownloadError
        ? caught
        : new ComparisonDownloadError('download_failed')
      setError(downloadError)
      setJobUnavailable(downloadError.jobUnavailable)
      setStatus('error')
      return false
    } finally {
      if (id === requestId.current) {
        controller.current = null
        locked.current = false
      }
    }
  }

  return {
    status,
    message,
    error,
    jobUnavailable,
    download,
    reset,
  }
}
