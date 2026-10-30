import type {
  ComparisonDownloadStatus,
} from '../hooks/useComparisonDownload'

interface Props {
  status: ComparisonDownloadStatus
  message: string | null
  errorMessage: string | null
  disabled: boolean
  onDownload: () => void
}

export default function ComparisonDownloadActions({
  status,
  message,
  errorMessage,
  disabled,
  onDownload,
}: Props) {
  const feedbackId = message || errorMessage
    ? 'compare-download-feedback'
    : undefined

  return (
    <div className="compare-download-state">
      <button
        type="button"
        className="primary-button"
        disabled={disabled}
        aria-busy={status === 'downloading'}
        aria-describedby={feedbackId}
        onClick={onDownload}
      >
        {status === 'downloading'
          ? '準備下載中…'
          : '下載比對結果 Excel'}
      </button>
      {message && (
        <span id={feedbackId} role="status">{message}</span>
      )}
      {errorMessage && (
        <span
          id={feedbackId}
          className="compare-download-error"
          role="alert"
        >
          {errorMessage}
        </span>
      )}
    </div>
  )
}
