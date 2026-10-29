import { countComparisonStatuses } from '../resultPresentation'
import type { ComparisonRow } from '../types'

export default function ComparisonStatusSummary({ rows }: { rows: ComparisonRow[] }) {
  const counts = countComparisonStatuses(rows)
  const groups = [
    ['same', '相同', '數值與單位一致'],
    ['difference', '有差異', '數值不同或單位不同'],
    ['review', '待確認', '缺漏、標記或未辨識狀態'],
  ] as const
  return (
    <section className="compare-status-summary" aria-labelledby="compare-status-summary-title">
      <div className="compare-status-summary__heading">
        <h3 id="compare-status-summary-title">狀態摘要</h3>
        <p>狀態合計 {rows.length} 筆</p>
      </div>
      <ul className="compare-status-summary__items">
        {groups.map(([key, label, description]) => <li key={key} className={`compare-status-summary__item compare-status-summary__item--${key}`}>
          <strong>{label}</strong><span>{counts[key]} 筆</span><small>{description}</small>
        </li>)}
      </ul>
    </section>
  )
}
