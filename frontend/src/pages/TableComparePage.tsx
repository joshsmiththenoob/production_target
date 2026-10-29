import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import CompareFilePicker from '../features/tableCompare/components/CompareFilePicker'
import ComparePanel from '../features/tableCompare/components/ComparePanel'
import ComparisonResultTable from '../features/tableCompare/components/ComparisonResultTable'
import ScopeChoices from '../features/tableCompare/components/ScopeChoices'
import { useComparisonPreview } from '../features/tableCompare/hooks/useComparisonPreview'
import { useComparisonRun } from '../features/tableCompare/hooks/useComparisonRun'
import type { CompareFileField, ComparisonRunSnapshot } from '../features/tableCompare/types'

const steps = ['選擇檔案', '確認比對範圍', '執行比對', '結果與下載']
type Step = 1 | 2 | 3 | 4

function ScopeSummary({ snapshot }: { snapshot: ComparisonRunSnapshot }) {
  return (
    <dl className="compare-submitted-scope">
      <div><dt>作物</dt><dd>{snapshot.scope.crops.join('、')}</dd></div>
      <div><dt>年度</dt><dd>{snapshot.scope.years.join('、')}</dd></div>
      <div><dt>指標</dt><dd>{snapshot.scope.metrics.join('、')}</dd></div>
    </dl>
  )
}

export default function TableComparePage() {
  const workflow = useComparisonPreview()
  const comparison = useComparisonRun()
  const { files, job, selection, setSelection, loading, error } = workflow
  const [step, setStep] = useState<Step>(1)
  const [direction, setDirection] = useState(1)
  const [transitioning, setTransitioning] = useState(false)
  const transitionLock = useRef(false)
  const currentStep = useRef<Step>(1)
  const heading = useRef<HTMLHeadingElement>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reducedMotion = useReducedMotion() === true

  const clearSuccessTimer = useCallback(() => {
    if (successTimer.current !== null) clearTimeout(successTimer.current)
    successTimer.current = null
  }, [])

  const changeStep = useCallback((next: Step) => {
    if (transitionLock.current || next === currentStep.current) return false
    transitionLock.current = true
    setTransitioning(true)
    setDirection(next > currentStep.current ? 1 : -1)
    currentStep.current = next
    setStep(next)
    return true
  }, [])

  const entered = useCallback((panelStep: Step) => {
    if (!transitionLock.current || currentStep.current !== panelStep) return
    transitionLock.current = false
    setTransitioning(false)
    heading.current?.focus()
  }, [])

  useEffect(() => {
    if (step !== 3 || comparison.status !== 'success' || transitioning) return
    clearSuccessTimer()
    if (reducedMotion) {
      changeStep(4)
      return
    }
    successTimer.current = setTimeout(() => {
      successTimer.current = null
      changeStep(4)
    }, 500)
    return clearSuccessTimer
  }, [changeStep, clearSuccessTimer, comparison.status, reducedMotion, step, transitioning])

  useEffect(() => clearSuccessTimer, [clearSuccessTimer])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (transitionLock.current || loading || comparison.status === 'loading') return
    if (await workflow.upload()) changeStep(2)
  }

  function changeFile(field: CompareFileField, file: File | null) {
    clearSuccessTimer()
    comparison.reset()
    workflow.changeFile(field, file)
  }

  function startComparison() {
    if (!job || transitioning || loading || comparison.status !== 'idle' ||
      selection.crops.length === 0 || selection.years.length === 0 || selection.metrics.length === 0) return
    const snapshot: ComparisonRunSnapshot = {
      publicId: job.public_id,
      scope: {
        crops: [...selection.crops],
        years: [...selection.years],
        metrics: [...selection.metrics],
      },
      issues: [...job.preview.issues],
    }
    if (!changeStep(3)) return
    void comparison.start(snapshot)
  }

  function restart() {
    if (transitioning) return
    clearSuccessTimer()
    comparison.reset()
    workflow.resetJob()
    changeStep(1)
  }

  const canStart = Boolean(job) && selection.crops.length > 0 && selection.years.length > 0 &&
    selection.metrics.length > 0 && !loading && !transitioning && comparison.status === 'idle'

  let content
  if (step === 1) {
    content = (
      <>
        <h2 ref={heading} tabIndex={-1}>1. {steps[0]}</h2>
        <form onSubmit={submit} aria-busy={loading}>
          <p className="work-surface__intro">上傳完整合併 Excel 與文字型 PDF，先確認可核對範圍與解析限制。</p>
          <div className="file-input-grid">
            <CompareFilePicker field="excel_file" label="完整合併 Excel（.xlsx）" file={files.excel_file}
              error={error?.fileFields.excel_file} disabled={transitioning || loading} onChange={changeFile} />
            <CompareFilePicker field="pdf_file" label="核對 PDF（.pdf）" file={files.pdf_file}
              error={error?.fileFields.pdf_file} disabled={transitioning || loading} onChange={changeFile} />
          </div>
          {loading && <p role="status">正在解析檔案並建立比對範圍… 更換或移除檔案會取消本次預覽。</p>}
          {error && <div className="form-error" role="alert"><strong>未能建立比對範圍</strong><p>{error.message}</p></div>}
          <div className="work-action-bar">
            <p>兩份檔案都選好後即可送出；這一步只建立預覽，不執行數值比對。</p>
            <div className="work-action-buttons">
              {job && <button type="button" className="button--secondary" disabled={loading || transitioning}
                onClick={() => changeStep(2)}>返回原預覽</button>}
              <button type="submit" className="primary-button" disabled={!files.excel_file || !files.pdf_file || loading || transitioning}>
                {loading ? '正在產生比對範圍…' : '產生比對範圍'}
              </button>
            </div>
          </div>
        </form>
      </>
    )
  } else if (step === 2 && job) {
    content = (
      <>
        <h2 ref={heading} tabIndex={-1}>2. {steps[1]}</h2>
        <p className="work-surface__intro">依預設範圍勾選，也可自行調整。作物清單以 Excel 為準。</p>
        <p className="pairing-job-id">工作編號：{job.public_id}</p>
        <div className="compare-scopes">
          <ScopeChoices label="作物" options={job.preview.crops} selected={selection.crops}
            emptyMessage="Excel 解析資料中沒有可供預覽的作物。" disabled={transitioning}
            onChange={crops => setSelection(current => ({ ...current, crops }))} />
          <ScopeChoices label="共同實績年度" options={job.preview.years} selected={selection.years}
            emptyMessage="Excel 與 PDF 沒有共同實績年度。" disabled={transitioning}
            onChange={years => setSelection(current => ({ ...current, years }))} />
          <ScopeChoices label="指標" options={job.preview.metrics} selected={selection.metrics}
            emptyMessage="Excel 解析資料中沒有支援的比對指標。" disabled={transitioning}
            onChange={metrics => setSelection(current => ({ ...current, metrics }))} />
        </div>
        <section className="compare-issues" aria-labelledby="compare-issues-title">
          <h3 id="compare-issues-title">解析提醒與待確認事項</h3>
          <p>「PDF 解析結果未找到」不代表 PDF 原檔一定沒有資料；部分頁面或版型可能尚未支援。</p>
          {job.preview.issues.length > 0
            ? <ul>{job.preview.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
            : <p>目前沒有解析提醒。預覽尚未執行數值比對。</p>}
        </section>
        <div className="work-action-bar">
          <p id="compare-run-help">三組條件都至少選一項後，即可執行本次工作一次。</p>
          <div className="work-action-buttons">
            <button type="button" className="button--secondary" disabled={transitioning}
              onClick={() => changeStep(1)}>返回修改檔案</button>
            <button type="button" className="primary-button" disabled={!canStart}
              aria-describedby="compare-run-help" onClick={startComparison}>開始比對</button>
          </div>
        </div>
      </>
    )
  } else if (step === 3) {
    content = (
      <>
        <h2 ref={heading} tabIndex={-1}>3. {steps[2]}</h2>
        <p className="pairing-job-id">工作編號：{comparison.snapshot?.publicId ?? '準備中'}</p>
        <div className={`compare-run-status compare-run-status--${comparison.status}`}
          role={comparison.status === 'error' ? 'alert' : 'status'} aria-live="polite" aria-busy={comparison.status === 'loading'}>
          {comparison.status === 'loading' && <>
            <span className="compare-run-spinner" aria-hidden="true" />
            <div><h3>正在執行比對</h3><p>正在比對所選資料，請稍候。不顯示假百分比。</p></div>
          </>}
          {comparison.status === 'success' && <>
            <span className="compare-run-check" aria-hidden="true">✓</span>
            <div><h3>比對完成</h3><p>比對完成，正在顯示結果。找到差異仍屬正常完成。</p></div>
          </>}
          {comparison.status === 'error' && <>
            <span className="compare-run-error" aria-hidden="true">!</span>
            <div><h3>未能完成比對</h3><p>{comparison.error?.message}</p>
              {comparison.error && Object.keys(comparison.error.scopeFields).length > 0 &&
                <ul>{Object.values(comparison.error.scopeFields).map(message => <li key={message}>{message}</li>)}</ul>}
            </div>
          </>}
        </div>
        <div className="work-action-bar">
          <p>離開或取消瀏覽器等待，不代表後端工作已取消；不會自動重送 run。</p>
          <button type="button" className="button--secondary" disabled={transitioning} onClick={restart}>重新開始</button>
        </div>
      </>
    )
  } else {
    const statusCounts = new Map<string, number>()
    for (const row of comparison.result?.rows ?? []) {
      statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1)
    }
    content = (
      <>
        <h2 ref={heading} tabIndex={-1}>4. {steps[3]}</h2>
        {comparison.result && comparison.snapshot ? <>
          <p className="work-surface__intro">以下為本次 run 回傳的完整比對結果，保留原始順序與文字值。</p>
          <p className="pairing-job-id">工作編號：{comparison.snapshot.publicId}</p>
          <section className="compare-result-summary" aria-labelledby="compare-result-summary-title">
            <h3 id="compare-result-summary-title">本次結果摘要</h3>
            <p>共 {comparison.result.row_count} 筆比對明細。</p>
            <ScopeSummary snapshot={comparison.snapshot} />
            {statusCounts.size > 0 && <ul className="compare-status-counts">
              {[...statusCounts].map(([label, count]) => <li key={label}><strong>{label}</strong>：{count} 筆</li>)}
            </ul>}
          </section>
          <section className="compare-issues" aria-labelledby="submitted-issues-title">
            <h3 id="submitted-issues-title">本次來源解析提醒</h3>
            <p>缺漏狀態是解析資料的比對結果；未解析頁面仍以下列提醒為準。</p>
            {comparison.snapshot.issues.length > 0
              ? <ul>{comparison.snapshot.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
              : <p>本次預覽沒有解析提醒。</p>}
          </section>
          <ComparisonResultTable rows={comparison.result.rows} rowCount={comparison.result.row_count} />
          <div className="compare-download" aria-labelledby="compare-download-title">
            <h3 id="compare-download-title">下載本次結果</h3>
            <button type="button" disabled aria-describedby="compare-download-unavailable">下載比對結果 Excel</button>
            <p id="compare-download-unavailable">下載功能尚未開放：後端尚未註冊可用的 table-compare download API。</p>
          </div>
          <div className="work-action-bar">
            <p>重新開始會保留已選檔案，但必須建立新工作並取得新的工作編號。</p>
            <button type="button" className="button--secondary" disabled={transitioning} onClick={restart}>重新開始</button>
          </div>
        </> : <div className="form-error" role="alert"><strong>找不到本次結果</strong><p>請重新建立工作。</p></div>}
      </>
    )
  }

  const panel = (
    <ComparePanel key={step} direction={direction} reducedMotion={reducedMotion} onEntered={() => entered(step)}>
      {content}
    </ComparePanel>
  )

  return (
    <div className="work-page table-compare-page">
      <Link className="work-page__back-link" to="/">← 返回工作入口</Link>
      <header className="work-page__header">
        <h1>PDF／XLSX 資料比對</h1>
        <p className="work-page__lead">上傳 Excel 與 PDF、確認範圍，再執行真實比對並檢視完整結果。</p>
      </header>
      <ol className="workflow-steps" aria-label="表格比對工作流程">
        {steps.map((label, index) => {
          const state = index < step - 1 ? 'complete' : index === step - 1 ? 'active' : 'locked'
          return <li key={label} data-state={state} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="workflow-steps__number" aria-hidden="true">{state === 'complete' ? '✓' : index + 1}</span>
            <span>{label}</span>
            <span className="workflow-steps__status">{state === 'complete' ? '已完成' : state === 'active' ? '目前' : '未進行'}</span>
            {index < 3 && <span className="workflow-steps__connector" aria-hidden="true" />}
          </li>
        })}
      </ol>
      <div className="table-compare-layout">
        <div className="workflow-panel-slot compare-panel-slot" data-direction={direction}>
          {reducedMotion ? panel : <AnimatePresence initial={false} mode="wait" custom={direction}>{panel}</AnimatePresence>}
        </div>
        <aside className="file-preparation" aria-labelledby="compare-guide-title">
          <h2 id="compare-guide-title">{step < 3 ? '檔案準備說明' : step === 3 ? '執行期間說明' : '結果閱讀說明'}</h2>
          {step < 3 ? <ul>
            <li>Excel：請使用第一模組的完整合併 .xlsx，非單一作物查詢下載檔。</li>
            <li>PDF：請使用文字型農產品實績表，不支援掃描影像或 OCR。</li>
            <li>目前僅支援部分表格版型，請在下一步閱讀解析提醒。</li>
          </ul> : step === 3 ? <ul>
            <li>畫面只呈現真實請求狀態，不代表百分比進度。</li>
            <li>瀏覽器中止等待不等於取消伺服器處理。</li>
            <li>錯誤後不會自動重送只能執行一次的工作。</li>
          </ul> : <ul>
            <li>差異與缺漏是成功比對後的結果，不代表工作失敗。</li>
            <li>數值 0 與來源標記會原樣呈現，空值顯示為「—」。</li>
            <li>本版直接顯示全部結果，不提供第二組查詢或篩選。</li>
          </ul>}
        </aside>
      </div>
    </div>
  )
}
