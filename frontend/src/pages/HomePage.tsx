import FeatureCard from '../components/FeatureCard'
import HomeHero from '../components/HomeHero'
// import HealthStatus from '../features/health/HealthStatus'
import volumePriceMergeImage from '../assets/feature-cards/volume-price-merge-card.png'
import tableCompareImage from '../assets/feature-cards/table-compare-card.png'

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <div className="home-content">
        <div className="feature-grid">
          <FeatureCard
            title="生產量值整併"
            summary="將統計處 SD 產出的同品項生產量與生產值資料，整併為單一匯總資料。"
            status="available"
            to="/volume-price-merge"
            accessibleLabel="前往生產量值整併"
            mediaVariant="volume-price-merge"
            imageSrc={volumePriceMergeImage}
            imageAlt=""
          />

          <FeatureCard
            title="PDF／XLSX 資料比對"
            summary="上傳完整合併 Excel 與文字型 PDF，確認作物、年度及指標；執行比對尚未開放。"
            status="planned"
            to="/table-compare"
            accessibleLabel="前往 PDF／XLSX 資料比對（上傳與預覽）"
            mediaVariant="table-compare"
            imageSrc={tableCompareImage}
            imageAlt=""
          />
        </div>
        {/* <HealthStatus /> */}
      </div>
    </>
  )
}
