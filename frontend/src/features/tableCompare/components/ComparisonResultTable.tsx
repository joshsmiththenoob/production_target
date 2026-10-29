import type { ComparisonRow } from '../types'

interface Props {
  rows: ComparisonRow[]
  rowCount: number
}

function value(value: string | null) {
  return value === null ? <span aria-label="空值">—</span> : value
}

export default function ComparisonResultTable({ rows, rowCount }: Props) {
  if (rows.length === 0) return <p className="compare-empty-result">本次範圍沒有比對明細。</p>
  return (
    <div className="compare-result-table-wrap" tabIndex={0} aria-label="比對結果表格，可水平捲動">
      <table className="compare-result-table">
        <caption>本次完整比對結果，共 {rowCount} 筆</caption>
        <thead>
          <tr>
            <th scope="col">作物</th><th scope="col">年度</th><th scope="col">指標</th>
            <th scope="col">PDF 單位</th><th scope="col">PDF 數值</th>
            <th scope="col">Excel 單位</th><th scope="col">Excel 數值</th><th scope="col">比對結果</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.crop}-${row.year}-${row.metric}-${index}`}>
              <th scope="row">{row.crop}</th>
              <td>{row.year}</td><td>{row.metric}</td><td>{value(row.pdf_unit)}</td>
              <td>{value(row.pdf_value)}</td><td>{value(row.excel_unit)}</td>
              <td>{value(row.excel_value)}</td><td>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
