import { useCallback, useEffect, useRef, useState } from 'react'
import { ComparisonApiError, createComparisonPreview } from '../api'
import type { CompareFileField, CompareScope, CreatedComparisonJob } from '../types'

const emptyScope = (): CompareScope => ({ crops: [], years: [], metrics: [] })

export function useComparisonPreview() {
  const [files, setFiles] = useState<Record<CompareFileField, File | null>>({ excel_file: null, pdf_file: null })
  const [job, setJob] = useState<CreatedComparisonJob | null>(null)
  const [selection, setSelection] = useState<CompareScope>(emptyScope)
  const [error, setError] = useState<ComparisonApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)

  const invalidate = useCallback(() => {
    requestId.current += 1
    controller.current?.abort()
    controller.current = null
  }, [])
  useEffect(() => invalidate, [invalidate])

  function changeFile(field: CompareFileField, file: File | null) {
    invalidate()
    setFiles(current => ({ ...current, [field]: file }))
    setJob(null)
    setSelection(emptyScope())
    setError(null)
    setLoading(false)
  }

  async function upload(): Promise<boolean> {
    if (!files.excel_file || !files.pdf_file || controller.current) return false
    invalidate()
    const id = requestId.current
    const request = new AbortController()
    controller.current = request
    setLoading(true)
    setError(null)
    setJob(null)
    setSelection(emptyScope())
    try {
      const result = await createComparisonPreview(files.excel_file, files.pdf_file, request.signal)
      if (id !== requestId.current) return false
      setJob(result)
      // Initialize once per accepted response, never during render or on return.
      setSelection({
        crops: [...result.preview.defaults.crops],
        years: [...result.preview.defaults.years],
        metrics: [...result.preview.defaults.metrics],
      })
      return true
    } catch (caught: unknown) {
      if (id === requestId.current) {
        setError(caught instanceof ComparisonApiError ? caught : new ComparisonApiError('network_error'))
      }
      return false
    } finally {
      if (id === requestId.current) {
        controller.current = null
        setLoading(false)
      }
    }
  }

  return { files, job, selection, setSelection, error, loading, changeFile, upload }
}
