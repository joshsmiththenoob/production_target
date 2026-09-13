import FeatureCard from '../components/FeatureCard'
import HealthStatus from '../features/health/HealthStatus'

export default function HomePage() {
  return (
    <>
      <h1>今天要處理哪一項工作？</h1>
      <p className="subtitle">從下方選擇任務，了解處理流程。</p>
      <div className="feature-grid">
        <FeatureCard
          title="果品生產量值整併"
          input="產量產值與種植收穫面積 Excel"
          process="檢查配對、整併、依作物查詢"
          output="完整或篩選後的 Excel"
          cta="開始果品整併"
          to="/fruit-merge"
        />
        <FeatureCard
          title="DOCX／XLSX 表格比對"
          input="Word 與 Excel"
          process="選擇表格、key 與比對欄位"
          output="兩種檔案之比對結果"
          status="尚未開放"
          cta="查看比對功能說明"
          to="/table-compare"
        />
      </div>
      <HealthStatus />
    </>
  )
}
