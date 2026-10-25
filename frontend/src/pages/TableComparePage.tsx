import { type FormEvent, useCallback, useRef, useState } from 'react'
import { AnimatePresence, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import CompareFilePicker from '../features/tableCompare/components/CompareFilePicker'
import ComparePanel from '../features/tableCompare/components/ComparePanel'
import ScopeChoices from '../features/tableCompare/components/ScopeChoices'
import { useComparisonPreview } from '../features/tableCompare/hooks/useComparisonPreview'

const steps = ['選擇檔案', '確認比對範圍', '執行比對', '結果與下載']
type Step = 1 | 2

export default function TableComparePage() {
  const workflow = useComparisonPreview()
  const { files, job, selection, setSelection, loading, error } = workflow
  const [step, setStep] = useState<Step>(1)
  const [direction, setDirection] = useState(1)
  const [transitioning, setTransitioning] = useState(false)
  const transitionLock = useRef(false)
  const currentStep = useRef<Step>(1)
  const heading = useRef<HTMLHeadingElement>(null)
  const reducedMotion = useReducedMotion() === true

  function changeStep(next: Step) {
    if (transitionLock.current || loading || next === currentStep.current) return
    transitionLock.current = true
    setTransitioning(true)
    setDirection(next > currentStep.current ? 1 : -1)
    currentStep.current = next
    setStep(next)
  }
  const entered = useCallback((panelStep: Step) => {
    if (!transitionLock.current || currentStep.current !== panelStep) return
    transitionLock.current = false
    setTransitioning(false)
    heading.current?.focus()
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (transitionLock.current || loading) return
    if (await workflow.upload()) changeStep(2)
  }

  const panel = (
    <ComparePanel key={step} direction={direction} reducedMotion={reducedMotion} onEntered={() => entered(step)}>
      <h2 ref={heading} tabIndex={-1}>{step}. {steps[step - 1]}</h2>
      {step === 1 ? (
        <form onSubmit={submit} aria-busy={loading}>
          <p className="work-surface__intro">上傳完整合併 Excel 與文字型 PDF，先確認可核對範圍與解析限制。</p>
          <div className="file-input-grid">
            <CompareFilePicker field="excel_file" label="完整合併 Excel（.xlsx）" file={files.excel_file}
              error={error?.fields.excel_file} disabled={transitioning} onChange={workflow.changeFile} />
            <CompareFilePicker field="pdf_file" label="核對 PDF（.pdf）" file={files.pdf_file}
              error={error?.fields.pdf_file} disabled={transitioning} onChange={workflow.changeFile} />
          </div>
          {loading && <p role="status">正在解析檔案並建立比對範圍… 更換或移除檔案會取消本次預覽。</p>}
          {error && <div className="form-error" role="alert"><strong>未能建立比對範圍</strong><p>{error.message}</p></div>}
          <div className="work-action-bar">
            <p>兩份檔案都選好後即可送出；本階段不執行數值比對。</p>
            <div className="work-action-buttons">
              {job && <button type="button" className="button--secondary" disabled={loading || transitioning}
                onClick={() => changeStep(2)}>返回原預覽</button>}
              <button type="submit" className="primary-button" disabled={!files.excel_file || !files.pdf_file || loading || transitioning}>
                {loading ? '正在產生比對範圍…' : '產生比對範圍'}
              </button>
            </div>
          </div>
        </form>
      ) : job && (
        <>
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
            <p id="compare-run-help">比對執行功能尚未開放，本版可先確認範圍。</p>
            <div className="work-action-buttons">
              <button type="button" className="button--secondary" disabled={transitioning}
                onClick={() => changeStep(1)}>返回修改檔案</button>
              <button type="button" className="primary-button" disabled aria-describedby="compare-run-help">開始比對</button>
            </div>
          </div>
        </>
      )}
    </ComparePanel>
  )

  return (
    <div className="work-page table-compare-page">
      <Link className="work-page__back-link" to="/">← 返回工作入口</Link>
      <header className="work-page__header">
        <h1>PDF／XLSX 資料比對</h1>
        <p className="work-page__lead">先上傳 Excel 與 PDF，再確認作物、共同實績年度及指標。</p>
      </header>
      <ol className="workflow-steps" aria-label="表格比對工作流程">
        {steps.map((label, index) => {
          const state = index < step - 1 ? 'complete' : index === step - 1 ? 'active' : 'locked'
          return <li key={label} data-state={state} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="workflow-steps__number" aria-hidden="true">{state === 'complete' ? '✓' : index + 1}</span>
            <span>{label}</span>
            <span className="workflow-steps__status">{state === 'complete' ? '已完成' : state === 'active' ? '目前' : '未開放'}</span>
            {index < 3 && <span className="workflow-steps__connector" aria-hidden="true" />}
          </li>
        })}
      </ol>
      <div className="table-compare-layout">
        <div className="workflow-panel-slot compare-panel-slot" data-direction={direction}>
          {reducedMotion ? panel : <AnimatePresence initial={false} mode="wait" custom={direction}>{panel}</AnimatePresence>}
        </div>
        <aside className="file-preparation" aria-labelledby="compare-guide-title">
          <h2 id="compare-guide-title">檔案準備說明</h2>
          <ul>
            <li>Excel：請使用第一模組的完整合併 .xlsx，非單一作物查詢下載檔。</li>
            <li>PDF：請使用文字型農產品實績表，不支援掃描影像或 OCR。</li>
            <li>目前僅支援部分表格版型，請在下一步閱讀解析提醒。</li>
            <li>此頁可上傳與確認範圍，執行比對、結果與下載尚未開放。</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}
