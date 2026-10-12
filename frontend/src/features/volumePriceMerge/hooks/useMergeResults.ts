import { useCallback, useEffect, useRef, useState } from 'react'

import {
  downloadVolumePriceMergeResult,
  queryVolumePriceMergeResult,
  ResultApiError,
} from '../api'
import type { MergeQueryResult } from '../types'

type DownloadKind = 'all' | 'product'

export function useMergeResults(publicId: string | null) {
  const queryLock = useRef(false)
  const downloadLock = useRef(false)
  const queryRequestId = useRef(0)
  const downloadRequestId = useRef(0)
  const queryController = useRef<AbortController | null>(null)
  const downloadController = useRef<AbortController | null>(null)
  const activeObjectUrls = useRef(new Set<string>())
  const currentPublicId = useRef(publicId)
  const previousPublicId = useRef(publicId)
  const [selectedProduct, setSelectedProduct] = useState('')
  const [queryResult, setQueryResult] = useState<MergeQueryResult | null>(null)
  const [isQuerying, setIsQuerying] = useState(false)
  const [queryError, setQueryError] = useState<ResultApiError | null>(null)
  const [downloadKind, setDownloadKind] = useState<DownloadKind | null>(null)
  const [downloadError, setDownloadError] = useState<ResultApiError | null>(null)
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null)
  const [jobUnavailable, setJobUnavailable] = useState(false)

  currentPublicId.current = publicId

  const invalidateRequests = useCallback(() => {
    queryRequestId.current += 1
    downloadRequestId.current += 1
    queryController.current?.abort()
    downloadController.current?.abort()
    queryController.current = null
    downloadController.current = null
    queryLock.current = false
    downloadLock.current = false
  }, [])

  const revokeObjectUrls = useCallback(() => {
    activeObjectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    activeObjectUrls.current.clear()
  }, [])

  const reset = useCallback(() => {
    invalidateRequests()
    revokeObjectUrls()
    setSelectedProduct('')
    setQueryResult(null)
    setIsQuerying(false)
    setQueryError(null)
    setDownloadKind(null)
    setDownloadError(null)
    setDownloadMessage(null)
    setJobUnavailable(false)
  }, [invalidateRequests, revokeObjectUrls])

  useEffect(() => {
    if (previousPublicId.current === publicId) return

    previousPublicId.current = publicId
    reset()
  }, [publicId, reset])

  useEffect(() => () => {
    invalidateRequests()
    revokeObjectUrls()
  }, [invalidateRequests, revokeObjectUrls])

  function selectProduct(product: string) {
    if (downloadLock.current) return

    queryRequestId.current += 1
    queryController.current?.abort()
    queryController.current = null
    queryLock.current = false
    setIsQuerying(false)
    setSelectedProduct(product)
    setQueryResult(null)
    setQueryError(null)
    setDownloadError(null)
    setDownloadMessage(null)
  }

  async function queryProduct() {
    const requestPublicId = publicId
    const product = selectedProduct
    if (!requestPublicId || !product || queryLock.current || downloadLock.current || jobUnavailable) return

    const requestId = queryRequestId.current + 1
    queryRequestId.current = requestId
    queryController.current?.abort()
    const controller = new AbortController()
    queryController.current = controller
    queryLock.current = true
    setIsQuerying(true)
    setQueryResult(null)
    setQueryError(null)
    setDownloadError(null)
    setDownloadMessage(null)

    try {
      const result = await queryVolumePriceMergeResult(requestPublicId, product, controller.signal)
      if (queryRequestId.current !== requestId || currentPublicId.current !== requestPublicId) return
      setQueryResult(result.query_result)
    } catch (error: unknown) {
      if (
        queryRequestId.current !== requestId ||
        currentPublicId.current !== requestPublicId ||
        (error instanceof Error && error.name === 'AbortError')
      ) return

      const apiError = error instanceof ResultApiError
        ? error
        : new ResultApiError('network_error')
      setQueryError(apiError)
      if (apiError.jobUnavailable) setJobUnavailable(true)
    } finally {
      if (queryRequestId.current === requestId && currentPublicId.current === requestPublicId) {
        queryLock.current = false
        queryController.current = null
        setIsQuerying(false)
      }
    }
  }

  async function download(kind: DownloadKind) {
    const requestPublicId = publicId
    const product = kind === 'product' ? queryResult?.product : undefined
    if (
      !requestPublicId ||
      downloadLock.current ||
      queryLock.current ||
      jobUnavailable ||
      (kind === 'product' && (!product || product !== selectedProduct))
    ) return

    const requestId = downloadRequestId.current + 1
    downloadRequestId.current = requestId
    downloadController.current?.abort()
    const controller = new AbortController()
    downloadController.current = controller
    downloadLock.current = true
    setDownloadKind(kind)
    setDownloadError(null)
    setDownloadMessage(null)

    try {
      const result = await downloadVolumePriceMergeResult(requestPublicId, product, controller.signal)
      if (downloadRequestId.current !== requestId || currentPublicId.current !== requestPublicId) return

      const objectUrl = URL.createObjectURL(result.blob)
      activeObjectUrls.current.add(objectUrl)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = result.filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => {
        if (activeObjectUrls.current.delete(objectUrl)) URL.revokeObjectURL(objectUrl)
      }, 0)
      setDownloadMessage(`已送出下載：${result.filename}`)
    } catch (error: unknown) {
      if (
        downloadRequestId.current !== requestId ||
        currentPublicId.current !== requestPublicId ||
        (error instanceof Error && error.name === 'AbortError')
      ) return

      const apiError = error instanceof ResultApiError
        ? error
        : new ResultApiError('network_error')
      setDownloadError(apiError)
      if (apiError.jobUnavailable) setJobUnavailable(true)
    } finally {
      if (downloadRequestId.current === requestId && currentPublicId.current === requestPublicId) {
        downloadLock.current = false
        downloadController.current = null
        setDownloadKind(null)
      }
    }
  }

  return {
    selectedProduct,
    queryResult,
    isQuerying,
    queryError,
    downloadKind,
    downloadError,
    downloadMessage,
    jobUnavailable,
    selectProduct,
    queryProduct,
    downloadAll: () => download('all'),
    downloadProduct: () => download('product'),
    reset,
  }
}
