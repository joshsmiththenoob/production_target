import { type ChangeEvent, type FormEvent, useState } from 'react'
import { Link } from 'react-router'

import {
  createPairingPreview,
  PairingApiError,
  type PairingPair,
  type PairingResult,
} from '../features/volumePriceMerge/api'

type WorkflowStep = 'select' | 'review'

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
  const [productionFiles, setProductionFiles] = useState<File[]>([])
  const [areaFiles, setAreaFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pairingResult, setPairingResult] = useState<PairingResult | null>(null)
  const [publicId, setPublicId] = useState<string | null>(null)

  const canSubmit = productionFiles.length > 0 && areaFiles.length > 0 && !isSubmitting

  function resetPreviousResult() {
    setStep('select')
    setPairingResult(null)
    setPublicId(null)
    setErrorMessage(null)
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
    if (!canSubmit) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setPairingResult(null)
    setPublicId(null)

    try {
      const result = await createPairingPreview(productionFiles, areaFiles)
      setPairingResult(result.pairing_result)
      setPublicId(result.public_id)
      setStep('review')
    } catch (error: unknown) {
      if (error instanceof PairingApiError && error.pairingResult) {
        setPairingResult(error.pairingResult)
        setStep('review')
      } else {
        setErrorMessage(
          error instanceof PairingApiError
            ? error.message
            : '目前無法檢查檔案配對，請稍後重試。',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

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
        <li aria-current={step === 'select' ? 'step' : undefined}><span aria-hidden="true">1</span>選擇檔案</li>
        <li aria-current={step === 'review' ? 'step' : undefined}><span aria-hidden="true">2</span>檢查配對</li>
        <li><span aria-hidden="true">3</span>開始整併</li>
        <li><span aria-hidden="true">4</span>查詢與下載</li>
      </ol>

      <div className="volume-price-layout">
        <form
          className="work-surface"
          aria-labelledby="file-selection-title"
          onSubmit={handleSubmit}
          hidden={step !== 'select'}
        >
          <h2 id="file-selection-title">1. 選擇檔案</h2>
          <p className="work-surface__intro">
            選擇以下兩類 Excel，系統會檢查每個大項是否各有一份對應檔案。
          </p>

          <div className="file-input-grid">
            <fieldset className="file-input-group">
              <legend>產量及產值 Excel</legend>
              <p id="production-files-help">
                可選擇多份 .xlsx，用於提供各大項、年度與作物的產量及產值資料。
              </p>
              <label htmlFor="production-files">選擇產量及產值檔案</label>
              <input
                id="production-files"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                multiple
                disabled={isSubmitting}
                aria-describedby="production-files-help"
                onChange={handleProductionFiles}
              />
              <SelectedFiles files={productionFiles} />
            </fieldset>

            <fieldset className="file-input-group">
              <legend>種植及收穫面積 Excel</legend>
              <p id="area-files-help">
                可選擇多份 .xlsx，用於提供對應大項、年度與作物的種植及收穫面積資料。
              </p>
              <label htmlFor="area-files">選擇種植及收穫面積檔案</label>
              <input
                id="area-files"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                multiple
                disabled={isSubmitting}
                aria-describedby="area-files-help"
                onChange={handleAreaFiles}
              />
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
            <button type="submit" disabled={!canSubmit}>
              {isSubmitting ? '正在檢查檔案配對…' : '檢查檔案配對'}
            </button>
            <p>
              兩類檔案都選好後即可檢查；檢查期間請勿重複送出。
            </p>
          </div>
        </form>

        {step === 'review' && pairingResult && (
          <section className="work-surface pairing-review" aria-labelledby="pairing-review-title">
            <h2 id="pairing-review-title">2. 檢查配對</h2>
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
              <button type="button" className="button--secondary" onClick={() => setStep('select')}>
                返回選擇檔案
              </button>
              <p>返回後會保留目前選取的檔案，方便直接調整。</p>
            </div>
          </section>
        )}

        <aside className="file-preparation" aria-labelledby="file-preparation-title">
          <h2 id="file-preparation-title">檔案準備說明</h2>
          <ul>
            <li>需要同時準備「產量及產值」與「種植及收穫面積」兩類資料。</li>
            <li>每一類都可選擇多份 .xlsx。</li>
            <li>檔名的大項必須與第一張工作表的 A1 標題一致。</li>
            <li>每個大項必須剛好各有一份兩種類型的檔案。</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}
