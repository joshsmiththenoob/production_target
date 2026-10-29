export default function ComparisonIssues({ issues }: { issues: string[] }) {
  return (
    <section className="compare-result-issues" aria-label="來源解析提醒">
      <details>
        <summary>來源解析提醒（{issues.length}）</summary>
        {issues.length > 0 && <ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
      </details>
      <p>{issues.length > 0
        ? '解析資料缺漏不代表原始 PDF 一定沒有資料。'
        : '目前沒有來源解析提醒。'}</p>
    </section>
  )
}
