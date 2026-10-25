import type { CompareFileField } from '../types'

interface Props {
  field: CompareFileField
  label: string
  file: File | null
  error?: string
  disabled: boolean
  onChange: (field: CompareFileField, file: File | null) => void
}

export default function CompareFilePicker({ field, label, file, error, disabled, onChange }: Props) {
  const extension = field === 'excel_file' ? '.xlsx' : '.pdf'
  return (
    <fieldset className="file-input-group">
      <legend>{label}</legend>
      <p id={`${field}-help`}>選擇一份 {extension}；目前保留的檔案列於下方，可直接重新送出。</p>
      <input className="motion-file-picker__input" id={field} type="file" accept={extension}
        disabled={disabled} aria-label={`選擇${label}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${field}-help ${field}-selected${error ? ` ${field}-error` : ''}`}
        onChange={event => {
          const next = event.currentTarget.files?.[0]
          if (next) onChange(field, next)
          event.currentTarget.value = ''
        }} />
      <div className="motion-file-picker" data-disabled={disabled || undefined}>
        <label className="motion-file-picker__label" htmlFor={field}>{file ? '更換檔案' : '選擇檔案'}</label>
      </div>
      <p className="selected-files" id={`${field}-selected`}>{file ? `已保留：${file.name}` : '尚未選擇檔案'}</p>
      {error && <p className="compare-field-error" id={`${field}-error`}>{error}</p>}
      {file && <button type="button" className="button--secondary" disabled={disabled}
        onClick={() => onChange(field, null)}>移除{label}</button>}
    </fieldset>
  )
}
