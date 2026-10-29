import type { ComparisonRunSnapshot } from '../types'

export default function ComparisonScopeSummary({ snapshot }: { snapshot: ComparisonRunSnapshot }) {
  const { crops, years, metrics } = snapshot.scope
  const summary = `作物 ${crops.length} 項｜實績年度 ${years.join('、') || '未選擇'}｜指標 ${metrics.join('、') || '未選擇'}`
  return (
    <details className="compare-scope-summary">
      <summary><span>本次提交範圍</span><span>{summary}</span></summary>
      <dl>
        <div><dt>作物</dt><dd>{crops.join('、') || '未選擇'}</dd></div>
        <div><dt>實績年度</dt><dd>{years.join('、') || '未選擇'}</dd></div>
        <div><dt>指標</dt><dd>{metrics.join('、') || '未選擇'}</dd></div>
        <div><dt>工作編號</dt><dd>{snapshot.publicId}</dd></div>
      </dl>
    </details>
  )
}
