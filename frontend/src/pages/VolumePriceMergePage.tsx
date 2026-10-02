import {
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'

import {
  createPairingPreview,
  type MergeSummary,
  MergeApiError,
  PairingApiError,
  runVolumePriceMerge,
  type PairingPair,
  type PairingResult,
} from '../features/volumePriceMerge/api'

type WorkflowStep = 'select' | 'review' | 'merge' | 'summary'
type TransitionDirection = 1 | -1
type MergePhase = 'idle' | 'processing' | 'success' | 'error'

const workflowStepOrder: WorkflowStep[] = ['select', 'review', 'merge', 'summary']

const workflowStepLabels: Record<WorkflowStep, string> = {
  select: '選擇檔案',
  review: '檢查配對',
  merge: '開始整併',
  summary: '查詢與下載',
}

const panelVariants = {
  enter: (direction: TransitionDirection) => ({ x: direction * 16, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: TransitionDirection) => ({ x: direction * -16, opacity: 0 }),
}

const reducedMotionVariants = {
  enter: { x: 0, opacity: 1 },
  center: { x: 0, opacity: 1 },
  exit: { x: 0, opacity: 1 },
}

const buttonContentVariants = {
  rest: { x: 0 },
  hover: { x: 4 },
  pressed: { x: 2 },
}

const filePickerVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.018 },
}

function WorkActionButton({
  children,
  disabled,
  reducedMotion,
  ...buttonProps
}: ComponentPropsWithoutRef<typeof motion.button> & { reducedMotion: boolean }) {
  return (
    <motion.button
      {...buttonProps}
      disabled={disabled}
      initial={false}
      animate="rest"
      whileHover={disabled || reducedMotion ? 'rest' : 'hover'}
      whileTap={disabled || reducedMotion ? 'rest' : 'pressed'}
    >
      <motion.span
        className="work-action-button__content"
        variants={buttonContentVariants}
        transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
      >
        {children}
      </motion.span>
    </motion.button>
  )
}

function MotionFilePicker({
  id,
  label,
  accessibleLabel,
  helpId,
  disabled,
  reducedMotion,
  onChange,
}: {
  id: string
  label: string
  accessibleLabel: string
  helpId: string
  disabled: boolean
  reducedMotion: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  const labelId = `${id}-label`

  return (
    <>
      <input
        className="motion-file-picker__input"
        id={id}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        multiple
        disabled={disabled}
        aria-label={accessibleLabel}
        aria-describedby={helpId}
        onChange={onChange}
      />
      <motion.div
        className="motion-file-picker"
        data-disabled={disabled ? 'true' : undefined}
        variants={filePickerVariants}
        initial={false}
        animate="rest"
        whileHover={disabled || reducedMotion ? 'rest' : 'hover'}
        transition={reducedMotion
          ? { duration: 0 }
          : { type: 'spring', stiffness: 420, damping: 28, mass: 0.55 }}
      >
        <label className="motion-file-picker__label" id={labelId} htmlFor={id}>
          <span className="motion-file-picker__icon" aria-hidden="true" />
          <span>{label}</span>
        </label>
      </motion.div>
    </>
  )
}

function WorkflowPanel({
  children,
  reducedMotion,
  onEntered,
}: {
  children: ReactNode
  reducedMotion: boolean
  onEntered: () => void
}) {
  const isPresent = useIsPresent()

  useEffect(() => {
    if (reducedMotion && isPresent) onEntered()
  }, [isPresent, onEntered, reducedMotion])

  return (
    <motion.div
      className="work-surface workflow-panel"
      aria-hidden={!isPresent}
      inert={!isPresent}
      variants={reducedMotion ? reducedMotionVariants : panelVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeInOut' }}
      onAnimationComplete={() => { if (isPresent) onEntered() }}
    >
      {children}
    </motion.div>
  )
}

function SelectedFiles({ files }: { files: File[] }) {
  if (files.length === 0) {
    return <p className="selected-files selected-files--empty">尚未選擇檔案</p>
  }

  return (
    <ul className="selected-files" aria-label="已選擇的檔案">
      {files.map((file, index) => (
        <li key={`${file.name}-${file.lastModified}-${index}`}>{file.name}</li>
      ))}
    </ul>
  )
}

function PairFileNames({ files, emptyText }: { files: string[]; emptyText: string }) {
  if (files.length === 0) {
    return <span className="pair-card__missing">{emptyText}</span>
  }

  return (
    <ul>
      {files.map((fileName, index) => <li key={`${fileName}-${index}`}>{fileName}</li>)}
    </ul>
  )
}

function PairCard({ pair }: { pair: PairingPair }) {
  return (
    <li className="pair-card">
      <div className="pair-card__heading">
        <h3>{pair.major_category}</h3>
        <strong className={`pair-card__status pair-card__status--${pair.complete ? 'complete' : 'incomplete'}`}>
          {pair.complete ? '配對完整' : '配對不完整'}
        </strong>
      </div>
      <dl>
        <div>
          <dt>產量及產值</dt>
          <dd><PairFileNames files={pair.production_files} emptyText="缺少檔案" /></dd>
        </div>
        <div>
          <dt>種植及收穫面積</dt>
          <dd><PairFileNames files={pair.area_files} emptyText="缺少檔案" /></dd>
        </div>
      </dl>
    </li>
  )
}

export default function VolumePriceMergePage() {
  const [step, setStep] = useState<WorkflowStep>('select')
  const [direction, setDirection] = useState<TransitionDirection>(1)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const transitionLock = useRef(false)
  const requestLock = useRef(false)
  const currentStep = useRef<WorkflowStep>('select')
  const selectionHeading = useRef<HTMLHeadingElement>(null)
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  const mergeHeading = useRef<HTMLHeadingElement>(null)
  const summaryHeading = useRef<HTMLHeadingElement>(null)
  const reducedMotion = useReducedMotion() === true
  const [productionFiles, setProductionFiles] = useState<File[]>([])
  const [areaFiles, setAreaFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pairingResult, setPairingResult] = useState<PairingResult | null>(null)
  const [publicId, setPublicId] = useState<string | null>(null)
  const [mergePhase, setMergePhase] = useState<MergePhase>('idle')
  const [mergeSummary, setMergeSummary] = useState<MergeSummary | null>(null)
  const [mergeError, setMergeError] = useState<MergeApiError | null>(null)
  const [isMerging, setIsMerging] = useState(false)

  const canSubmit = productionFiles.length > 0 && areaFiles.length > 0 && !isSubmitting && !isTransitioning
  const canStartMerge = (
    pairingResult?.is_valid === true &&
    publicId !== null &&
    !isMerging &&
    !isTransitioning
  )

  const changeStep = useCallback((nextStep: WorkflowStep) => {
    if (transitionLock.current || requestLock.current || currentStep.current === nextStep) return

    transitionLock.current = true
    const currentIndex = workflowStepOrder.indexOf(currentStep.current)
    const nextIndex = workflowStepOrder.indexOf(nextStep)
    currentStep.current = nextStep
    setIsTransitioning(true)
    setDirection(nextIndex > currentIndex ? 1 : -1)
    setStep(nextStep)
  }, [])

  const handlePanelEntered = useCallback((panelStep: WorkflowStep) => {
    if (!transitionLock.current || currentStep.current !== panelStep) return

    transitionLock.current = false
    setIsTransitioning(false)
    const heading = {
      select: selectionHeading.current,
      review: reviewHeading.current,
      merge: mergeHeading.current,
      summary: summaryHeading.current,
    }[panelStep]
    heading?.focus()
  }, [])

  useEffect(() => {
    if (step !== 'merge' || mergePhase !== 'success' || isTransitioning) return

    if (reducedMotion) {
      changeStep('summary')
      return
    }

    const successNoticeTimer = window.setTimeout(() => {
      changeStep('summary')
    }, 500)

    return () => window.clearTimeout(successNoticeTimer)
  }, [changeStep, isTransitioning, mergePhase, reducedMotion, step])

  function resetPreviousResult() {
    setStep('select')
    setPairingResult(null)
    setPublicId(null)
    setErrorMessage(null)
    setMergePhase('idle')
    setMergeSummary(null)
    setMergeError(null)
  }

  function handleProductionFiles(event: ChangeEvent<HTMLInputElement>) {
    setProductionFiles(Array.from(event.currentTarget.files ?? []))
    resetPreviousResult()
  }

  function handleAreaFiles(event: ChangeEvent<HTMLInputElement>) {
    setAreaFiles(Array.from(event.currentTarget.files ?? []))
    resetPreviousResult()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || requestLock.current || transitionLock.current) {
      return
    }

    requestLock.current = true
    setIsSubmitting(true)
    setErrorMessage(null)
    setPairingResult(null)
    setPublicId(null)

    try {
      const result = await createPairingPreview(productionFiles, areaFiles)
      setPairingResult(result.pairing_result)
      setPublicId(result.public_id)
      requestLock.current = false
      changeStep('review')
    } catch (error: unknown) {
      if (error instanceof PairingApiError && error.pairingResult) {
        setPairingResult(error.pairingResult)
        requestLock.current = false
        changeStep('review')
      } else {
        setErrorMessage(
          error instanceof PairingApiError
            ? error.message
            : '目前無法檢查檔案配對，請稍後重試。',
        )
      }
    } finally {
      requestLock.current = false
      setIsSubmitting(false)
    }
  }

  async function handleStartMerge() {
    if (!canStartMerge || !publicId || requestLock.current || transitionLock.current) {
      return
    }

    changeStep('merge')
    requestLock.current = true
    setIsMerging(true)
    setMergePhase('processing')
    setMergeSummary(null)
    setMergeError(null)

    try {
      const result = await runVolumePriceMerge(publicId)
      setMergeSummary(result.summary)
      setMergePhase('success')
    } catch (error: unknown) {
      setMergeError(
        error instanceof MergeApiError
          ? error
          : new MergeApiError(
            'network_unknown',
            '無法確認伺服器是否已完成整併。請勿直接重送同一工作。',
            true,
          ),
      )
      setMergePhase('error')
    } finally {
      requestLock.current = false
      setIsMerging(false)
    }
  }

  function handleRestartAfterMerge() {
    if (requestLock.current || transitionLock.current) return

    changeStep('select')
    setPairingResult(null)
    setPublicId(null)
    setMergePhase('idle')
    setMergeSummary(null)
    setMergeError(null)
  }

  const currentStepIndex = workflowStepOrder.indexOf(step)

  return (
    <div className="work-page volume-price-merge-page">
      <Link className="work-page__back-link" to="/">← 返回工作入口</Link>

      <header className="work-page__header">
        <h1>生產量值整併</h1>
        <p className="work-page__lead">
          整合產量產值與種植收穫面積 Excel，完成大項配對、整併及依作物查詢。
        </p>
      </header>

      <ol className="workflow-steps" aria-label="果品整併工作流程">
        {workflowStepOrder.map((workflowStep, index) => {
          const stepState = index < currentStepIndex
            ? 'complete'
            : index === currentStepIndex ? 'active' : 'locked'
          return (
            <li
              key={workflowStep}
              data-state={stepState}
              aria-current={stepState === 'active' ? 'step' : undefined}
            >
              <span className="workflow-steps__number" aria-hidden="true">
                {stepState === 'complete' ? '✓' : index + 1}
              </span>
              <span>{workflowStepLabels[workflowStep]}</span>
              <span className="workflow-steps__status">
                {stepState === 'complete' ? '已完成' : stepState === 'active' ? '目前' : '未開放'}
              </span>
              {index < workflowStepOrder.length - 1 && (
                <span className="workflow-steps__connector" aria-hidden="true" />
              )}
            </li>
          )
        })}
      </ol>

      <div className="volume-price-layout">
        <div className="workflow-panel-slot">
          <AnimatePresence initial={false} mode="wait" custom={direction}>
            {step === 'select' ? (
              <WorkflowPanel key="select" reducedMotion={reducedMotion} onEntered={() => handlePanelEntered('select')}>
                <form aria-labelledby="file-selection-title" onSubmit={handleSubmit}>
                  <h2 id="file-selection-title" ref={selectionHeading} tabIndex={-1}>1. 選擇檔案</h2>
                  <p className="work-surface__intro">
                    選擇以下兩類 Excel，系統會檢查每個大項是否各有一份對應檔案。
                  </p>

                  <div className="file-input-grid">
                    <fieldset className="file-input-group">
                      <legend>產量及產值 Excel</legend>
                      <p className="file-input-group__description" id="production-files-help">
                        可選擇多份 .xlsx，用於提供各大項、年度與作物的產量及產值資料。
                      </p>
                      <MotionFilePicker
                        id="production-files"
                        label="選擇檔案"
                        accessibleLabel="選擇產量及產值檔案"
                        helpId="production-files-help"
                        disabled={isSubmitting || isTransitioning}
                        reducedMotion={reducedMotion}
                        onChange={handleProductionFiles}
                      />
                      {productionFiles.length > 0 && <p className="selected-files__hint">已選檔案保留在下方；重新選取會替換此類檔案。</p>}
                      <SelectedFiles files={productionFiles} />
                    </fieldset>

                    <fieldset className="file-input-group">
                      <legend>種植及收穫面積 Excel</legend>
                      <p className="file-input-group__description" id="area-files-help">
                        可選擇多份 .xlsx，用於提供對應大項、年度與作物的種植及收穫面積資料。
                      </p>
                      <MotionFilePicker
                        id="area-files"
                        label="選擇檔案"
                        accessibleLabel="選擇種植及收穫面積檔案"
                        helpId="area-files-help"
                        disabled={isSubmitting || isTransitioning}
                        reducedMotion={reducedMotion}
                        onChange={handleAreaFiles}
                      />
                      {areaFiles.length > 0 && <p className="selected-files__hint">已選檔案保留在下方；重新選取會替換此類檔案。</p>}
                      <SelectedFiles files={areaFiles} />
                    </fieldset>
                  </div>

                  {errorMessage && (
                    <div className="form-error" role="alert">
                      <strong>無法檢查檔案</strong>
                      <p>{errorMessage}</p>
                      <p>您可以確認檔案後再次按下「檢查檔案配對」。</p>
                    </div>
                  )}

                  <div className="work-action-bar">
                    <WorkActionButton type="submit" disabled={!canSubmit} reducedMotion={reducedMotion}>
                      {isSubmitting ? '正在檢查檔案配對…' : '檢查檔案配對'}
                    </WorkActionButton>
                    <p>
                      兩類檔案都選好後即可檢查；檢查期間請勿重複送出。
                    </p>
                  </div>
                </form>
              </WorkflowPanel>
            ) : step === 'review' && pairingResult ? (
              <WorkflowPanel key="review" reducedMotion={reducedMotion} onEntered={() => handlePanelEntered('review')}>
                <section className="pairing-review" aria-labelledby="pairing-review-title">
                  <h2 id="pairing-review-title" ref={reviewHeading} tabIndex={-1}>2. 檢查配對</h2>
                  <div
                    className={`pairing-summary pairing-summary--${pairingResult.is_valid ? 'success' : 'error'}`}
                    role={pairingResult.is_valid ? 'status' : 'alert'}
                  >
                    <strong>{pairingResult.is_valid ? '檔案配對完整' : '檔案配對尚未完整'}</strong>
                    <p>
                      {pairingResult.is_valid
                        ? '每個大項都包含一份產量及產值檔案與一份種植及收穫面積檔案。'
                        : '請查看缺少或重複的檔案，返回上一步修正後再重新檢查。'}
                    </p>
                  </div>

                  {publicId && <p className="pairing-job-id">工作編號：<code>{publicId}</code></p>}

                  {pairingResult.errors.length > 0 && (
                    <ul className="pairing-errors" aria-label="配對問題">
                      {pairingResult.errors.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                  )}

                  <ul className="pairing-list">
                    {pairingResult.pairs.map((pair) => (
                      <PairCard key={pair.major_category} pair={pair} />
                    ))}
                  </ul>

                  <div className="work-action-bar">
                    <div className="work-action-buttons">
                      <WorkActionButton
                        type="button"
                        className="button--secondary"
                        disabled={isTransitioning}
                        reducedMotion={reducedMotion}
                        onClick={() => changeStep('select')}
                      >
                        返回選擇檔案
                      </WorkActionButton>
                      {pairingResult.is_valid && publicId && (
                        <WorkActionButton
                          type="button"
                          disabled={!canStartMerge}
                          reducedMotion={reducedMotion}
                          onClick={handleStartMerge}
                        >
                          開始整併
                        </WorkActionButton>
                      )}
                    </div>
                    <p>
                      {pairingResult.is_valid && publicId
                        ? '確認配對內容後開始整併；送出後請等待真實處理結果。'
                        : '返回後會保留目前選取的檔案，方便直接調整。'}
                    </p>
                  </div>
                </section>
              </WorkflowPanel>
            ) : step === 'merge' && publicId ? (
              <WorkflowPanel key="merge" reducedMotion={reducedMotion} onEntered={() => handlePanelEntered('merge')}>
                <section className="merge-progress" aria-labelledby="merge-progress-title">
                  <h2 id="merge-progress-title" ref={mergeHeading} tabIndex={-1}>3. 開始整併</h2>
                  <div
                    className={`merge-status merge-status--${mergePhase}`}
                    role={mergePhase === 'error' ? 'alert' : 'status'}
                    aria-busy={mergePhase === 'processing'}
                  >
                    <div className="merge-status__icon-frame" aria-hidden="true">
                      <AnimatePresence initial={false} mode="wait">
                        {mergePhase === 'processing' ? (
                          <motion.span
                            key="processing"
                            className="merge-status__spinner"
                            animate={reducedMotion ? { rotate: 0 } : { rotate: 360 }}
                            transition={reducedMotion
                              ? { duration: 0 }
                              : { duration: 0.9, ease: 'linear', repeat: Number.POSITIVE_INFINITY }}
                          />
                        ) : mergePhase === 'success' ? (
                          <motion.span
                            key="success"
                            className="merge-status__check"
                            initial={reducedMotion ? false : { scale: 0.72, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
                          >
                            ✓
                          </motion.span>
                        ) : (
                          <span className="merge-status__error-icon">!</span>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="merge-status__copy">
                      <strong>
                        {mergePhase === 'processing'
                          ? '正在整併資料…'
                          : mergePhase === 'success' ? '整併完成' : '整併未完成'}
                      </strong>
                      {mergePhase === 'processing' && (
                        <p>系統正在讀取並整合已配對的 Excel，請保留此頁面。</p>
                      )}
                      {mergePhase === 'success' && <p>結果已確認並保存，正在顯示摘要。</p>}
                      {mergePhase === 'error' && mergeError && (
                        <>
                          <p>{mergeError.message}</p>
                          <p>
                            {mergeError.resultIsUnknown
                              ? '目前結果不明，不會自動重送這個工作編號。'
                              : '這個工作不會自動重送；請重新建立工作後再試。'}
                          </p>
                        </>
                      )}
                      <p className="merge-status__job-id">工作編號：<code>{publicId}</code></p>
                    </div>
                  </div>

                  {mergePhase === 'error' && (
                    <div className="work-action-bar">
                      <WorkActionButton
                        type="button"
                        className="button--secondary"
                        disabled={isTransitioning}
                        reducedMotion={reducedMotion}
                        onClick={handleRestartAfterMerge}
                      >
                        返回重新建立工作
                      </WorkActionButton>
                      <p>已選檔案仍會保留；重新檢查配對會建立新的工作編號。</p>
                    </div>
                  )}
                </section>
              </WorkflowPanel>
            ) : step === 'summary' && mergeSummary && publicId ? (
              <WorkflowPanel key="summary" reducedMotion={reducedMotion} onEntered={() => handlePanelEntered('summary')}>
                <section className="merge-result" aria-labelledby="merge-result-title">
                  <h2 id="merge-result-title" ref={summaryHeading} tabIndex={-1}>4. 查詢與下載</h2>
                  <p className="work-surface__intro">整併已完成。以下摘要來自這次工作的真實結果。</p>
                  <p className="pairing-job-id">工作編號：<code>{publicId}</code></p>

                  <dl className="merge-result__summary">
                    <div>
                      <dt>結果欄數</dt>
                      <dd>{mergeSummary.column_count}</dd>
                    </div>
                    <div>
                      <dt>統計指標列數</dt>
                      <dd>{mergeSummary.row_count}</dd>
                    </div>
                  </dl>

                  <section className="merge-result__crops" aria-labelledby="available-crops-title">
                    <h3 id="available-crops-title">可用作物</h3>
                    {mergeSummary.available_crops.length > 0 ? (
                      <ul>
                        {mergeSummary.available_crops.map((crop) => <li key={crop}>{crop}</li>)}
                      </ul>
                    ) : (
                      <p>這次整併結果沒有可供查詢的作物。</p>
                    )}
                  </section>

                  <div className="merge-result__pending" role="note">
                    <strong>查詢與 Excel 下載尚未提供</strong>
                    <p>本階段只顯示整併摘要；作物查詢與下載會在後續 API 完成後開放。</p>
                  </div>

                  <div className="work-action-bar">
                    <WorkActionButton
                      type="button"
                      className="button--secondary"
                      disabled={isTransitioning}
                      reducedMotion={reducedMotion}
                      onClick={handleRestartAfterMerge}
                    >
                      重新開始
                    </WorkActionButton>
                    <p>返回 Step 1 後會保留已選檔案，但會清除目前工作編號與結果。</p>
                  </div>
                </section>
              </WorkflowPanel>
            ) : null}
          </AnimatePresence>
        </div>

        <aside className="file-preparation" aria-labelledby="file-preparation-title">
          <h2 id="file-preparation-title">
            {step === 'merge' ? '整併期間說明' : step === 'summary' ? '結果功能說明' : '檔案準備說明'}
          </h2>
          {step === 'merge' ? (
            <ul>
              <li>畫面只顯示真實請求狀態，不代表百分比進度。</li>
              <li>離開頁面不等於取消伺服器上的整併工作。</li>
              <li>網路中斷時不會自動重送相同工作。</li>
            </ul>
          ) : step === 'summary' ? (
            <ul>
              <li>摘要列數、欄數及作物均來自本次整併結果。</li>
              <li>重新整理後目前無法恢復這個畫面。</li>
              <li>作物查詢與 Excel 下載仍待後端 API 實作。</li>
            </ul>
          ) : (
            <ul>
              <li>需要同時準備「產量及產值」與「種植及收穫面積」兩類資料。</li>
              <li>每一類都可選擇多份 .xlsx。</li>
              <li>檔名的大項必須與第一張工作表的 A1 標題一致。</li>
              <li>每個大項必須剛好各有一份兩種類型的檔案。</li>
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
