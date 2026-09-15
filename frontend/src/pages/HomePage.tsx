import FeatureCard from '../components/FeatureCard'
import HomeHero from '../components/HomeHero'
import HealthStatus from '../features/health/HealthStatus'
import fruitMergeImage from '../assets/feature-cards/fruit-merge-card.png'
import tableCompareImage from '../assets/feature-cards/table-compare-card.png'

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <div className="home-content">
        <div className="feature-grid">
          <FeatureCard
            title="果品生產量值整併"
            summary="將統計處 SD 產出的同品項生產量與生產值資料，整併為單一匯總資料。"
            status="available"
            to="/fruit-merge"
            accessibleLabel="前往果品生產量值整併"
            mediaVariant="fruit-merge"
            imageSrc={fruitMergeImage}
            imageAlt=""
          />

          <FeatureCard
            title="DOCX／XLSX 表格比對"
            summary="比對 Word 與 Excel 表格的表頭、欄位名稱及欄位值，快速確認資料差異。"
            status="planned"
            to="/table-compare"
            accessibleLabel="查看 DOCX／XLSX 表格比對功能說明（規劃中）"
            mediaVariant="table-compare"
            imageSrc={tableCompareImage}
            imageAlt=""
          />
        </div>
        <HealthStatus />
      </div>
    </>
  )
}
