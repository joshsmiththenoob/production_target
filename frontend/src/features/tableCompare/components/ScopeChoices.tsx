interface Props<T extends string | number> {
  label: string
  options: T[]
  selected: T[]
  emptyMessage: string
  disabled: boolean
  onChange: (values: T[]) => void
}

export default function ScopeChoices<T extends string | number>({ label, options, selected, emptyMessage, disabled, onChange }: Props<T>) {
  return (
    <fieldset className="compare-scope" disabled={disabled}>
      <legend>{label}</legend>
      {options.length === 0 ? <p>{emptyMessage}請返回修改檔案。</p> : (
        <div className="compare-scope__choices">
          {options.map(option => <label key={option}>
            <input type="checkbox" checked={selected.includes(option)}
              onChange={event => onChange(event.currentTarget.checked
                ? [...selected, option] : selected.filter(value => value !== option))} />
            <span>{option}</span>
          </label>)}
        </div>
      )}
    </fieldset>
  )
}
