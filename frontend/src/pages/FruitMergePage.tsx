import { Link } from 'react-router'

export default function FruitMergePage() {
  return (
    <div className="work-page">
      <h1>果品生產量值整併</h1>
      <p className="subtitle">整合產量產值與種植收穫面積 Excel，完成配對、整併與依作物查詢。</p>
      <section className="placeholder" aria-labelledby="placeholder-title">
        <h2 id="placeholder-title">功能建置中</h2>
        <p>目前尚未開放檔案上傳與整併。功能完成後，將可下載完整或篩選後的 Excel。</p>
        <Link className="cta" to="/">返回首頁</Link>
      </section>
    </div>
  )
}
