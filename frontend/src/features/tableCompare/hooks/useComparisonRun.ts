import { useCallback, useEffect, useRef, useState } from 'react'
import { ComparisonApiError, runComparison } from '../api'
import type { ComparisonResult, ComparisonRunSnapshot } from '../types'

export type ComparisonRunStatus = 'idle' | 'loading' | 'success' | 'error'

function copySnapshot(snapshot: ComparisonRunSnapshot): ComparisonRunSnapshot {
  return {
    publicId: snapshot.publicId,
    scope: {
      crops: [...snapshot.scope.crops],
      years: [...snapshot.scope.years],
      metrics: [...snapshot.scope.metrics],
    },
    issues: [...snapshot.issues],
  }
}

export function useComparisonRun() {
  const [status, setStatus] = useState<ComparisonRunStatus>('idle')
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [snapshot, setSnapshot] = useState<ComparisonRunSnapshot | null>(null)
  const [error, setError] = useState<ComparisonApiError | null>(null)
  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const locked = useRef(false)

  const reset = useCallback(() => {
    requestId.current += 1
    controller.current?.abort()
    controller.current = null
    locked.current = false
    setStatus('idle')
    setResult(null)
    setSnapshot(null)
    setError(null)
  }, [])
  useEffect(() => reset, [reset])

  async function start(nextSnapshot: ComparisonRunSnapshot): Promise<boolean> {
    if (locked.current) return false
    locked.current = true
    requestId.current += 1
    const id = requestId.current
    const request = new AbortController()
    const submitted = copySnapshot(nextSnapshot)
    controller.current = request
    setSnapshot(submitted)
    setResult(null)
    setError(null)
    setStatus('loading')
    try {
      const nextResult = await runComparison(submitted.publicId, submitted.scope, request.signal)
      if (id !== requestId.current) return false
      setResult(nextResult)
      setStatus('success')
      return true
    } catch (caught: unknown) {
      if (id === requestId.current) {
        setError(caught instanceof ComparisonApiError ? caught : new ComparisonApiError('network_error'))
        setStatus('error')
      }
      return false
    } finally {
      if (id === requestId.current) {
        controller.current = null
        locked.current = false
      }
    }
  }

  return { status, result, snapshot, error, start, reset }
}
