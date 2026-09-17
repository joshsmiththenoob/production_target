import { Link } from 'react-router'

export default function VolumePriceMergePage() {
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
        <li><span aria-hidden="true">1</span>選擇檔案</li>
        <li><span aria-hidden="true">2</span>檢查配對</li>
        <li><span aria-hidden="true">3</span>開始整併</li>
        <li><span aria-hidden="true">4</span>查詢與下載</li>
      </ol>

      <div className="volume-price-layout">
        <section className="work-surface" aria-labelledby="file-selection-title">
          <h2 id="file-selection-title">1. 選擇檔案</h2>
          <p className="work-surface__intro">
            準備以下兩類 Excel。後續版本會先檢查大項是否完整配對，再進行資料整併。
          </p>

          <div className="file-input-grid">
            <fieldset className="file-input-group">
              <legend>產量及產值 Excel</legend>
              <p id="production-files-help">
                未來可選擇多份 .xlsx，用於提供各大項、年度與作物的產量及產值資料。
              </p>
              <label htmlFor="production-files">選擇產量及產值檔案</label>
              <input
                id="production-files"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                multiple
                disabled
                aria-describedby="production-files-help"
              />
            </fieldset>

            <fieldset className="file-input-group">
              <legend>種植及收穫面積 Excel</legend>
              <p id="area-files-help">
                未來可選擇多份 .xlsx，用於提供對應大項、年度與作物的種植及收穫面積資料。
              </p>
              <label htmlFor="area-files">選擇種植及收穫面積檔案</label>
              <input
                id="area-files"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                multiple
                disabled
                aria-describedby="area-files-help"
              />
            </fieldset>
          </div>

          <div className="work-action-bar">
            <button type="button" disabled>檢查檔案配對</button>
            <p>
              此版本先建立工作頁版面；檔案選擇與配對功能將於後續 Phase 啟用。
            </p>
          </div>
        </section>

        <aside className="file-preparation" aria-labelledby="file-preparation-title">
          <h2 id="file-preparation-title">檔案準備說明</h2>
          <ul>
            <li>需要同時準備「產量及產值」與「種植及收穫面積」兩類資料。</li>
            <li>每一類未來都可選擇多份 .xlsx。</li>
            <li>系統後續會先檢查大項配對，再進行整併。</li>
            <li>Phase 0.62 不會讀取、解析或上傳檔案。</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}
