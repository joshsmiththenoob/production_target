export default function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero__inner">
        <div className="home-hero__content">
          <p className="home-hero__eyebrow">農業資料工作台(測試)</p>
          <h1 id="home-title">今天要處理哪一項工作？</h1>
          <p className="home-hero__lead">從下方選擇任務，了解輸入、處理流程與預期結果。</p>
        </div>
        <div className="home-hero__illustration" aria-hidden="true">
          <svg viewBox="0 0 220 180" focusable="false">
            <path className="home-hero__stem" d="M32 158C69 132 87 99 101 38M101 103c31-19 52-41 70-76M84 124c-20-20-35-42-43-67" />
            <path className="home-hero__leaf" d="M98 50c8-22 26-33 46-31-2 20-17 36-43 39Z" />
            <path className="home-hero__leaf" d="M124 84c20-18 42-18 59-7-10 19-30 27-57 18Z" />
            <path className="home-hero__leaf" d="M68 104c-25-5-39-21-42-41 22-4 41 8 50 34Z" />
            <path className="home-hero__seed" d="M158 116c15-13 34-13 49-3-9 16-27 22-47 14Z" />
          </svg>
        </div>
      </div>
    </section>
  )
}
