import type { ComparisonResult } from '../types'

interface SummaryProps {
  result: ComparisonResult
}

export default function ComparisonResultSummary({ result }: SummaryProps) {
  const metricCount = new Set(result.rows.map(row => row.metric)).size
  return (
    <section className="compare-result-overview" aria-label="本次結果摘要">
      <dl className="compare-result-metrics">
        <div><dt>比對筆數</dt><dd>{result.row_count}</dd></div>
        <div><dt>指標種類</dt><dd>{metricCount}</dd></div>
      </dl>
    </section>
  )
}
