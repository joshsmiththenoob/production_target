import { Link } from 'react-router'

export default function TableComparePage() {
  return (
    <>
      <h1>DOCX／XLSX 表格比對</h1>
      <p className="subtitle">選擇 Word 與 Excel 中的表格、key 與比對欄位，找出相同、不同與缺漏資料。</p>
      <section className="placeholder" aria-labelledby="placeholder-title">
        <h2 id="placeholder-title">尚未開放</h2>
        <p>目前尚未開放檔案上傳與表格比對。功能完成後，將可檢視並下載比對報表。</p>
        <Link className="cta" to="/">返回首頁</Link>
      </section>
    </>
  )
}
