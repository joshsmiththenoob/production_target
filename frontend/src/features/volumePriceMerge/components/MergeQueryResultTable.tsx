import type { Ref } from 'react'

import type { MergeQueryResult } from '../types'

interface MergeQueryResultTableProps {
  publicId: string
  queryResult: MergeQueryResult
  headingRef: Ref<HTMLHeadingElement>
}

export default function MergeQueryResultTable({
  publicId,
  queryResult,
  headingRef,
}: MergeQueryResultTableProps) {
  return (
    <section className="merge-query-result" aria-labelledby="merge-query-result-title">
      <h3 id="merge-query-result-title" ref={headingRef} tabIndex={-1}>
        查詢結果：{queryResult.product}
      </h3>
      <p>共 {queryResult.columns.length} 個欄位、{queryResult.rows.length} 列統計指標。</p>
      {queryResult.rows.length > 0 ? (
        <div
          className="merge-query-result__table-scroll"
          role="region"
          aria-label={`${queryResult.product}查詢結果表格`}
          tabIndex={0}
        >
          <table>
            <caption>{queryResult.product}的合併資料</caption>
            <thead>
              <tr>
                <th scope="col">統計指標</th>
                {queryResult.columns.map((column) => (
                  <th scope="col" key={column.key}>
                    <span>{column.major_category}</span>
                    <span>{column.year}</span>
                    <span>{column.crop}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queryResult.rows.map((row, rowIndex) => (
                <tr key={`${publicId}-${queryResult.product}-${rowIndex}`}>
                  <th scope="row">{row.metric}</th>
                  {row.values.map((value, valueIndex) => (
                    <td key={`${queryResult.columns[valueIndex].key}-${valueIndex}`}>
                      {value === null ? <span aria-label="空值">—</span> : value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="merge-query__empty">這個作物目前沒有非空白的統計指標資料。</p>
      )}
    </section>
  )
}
