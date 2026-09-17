# 年度生產目標比較器

Phase 0 建立 React → Django REST Framework → PostgreSQL 的第一條可測試資料流。Phase 0.5 加入共用 Layout、首頁任務卡片與 React Router；Phase 0.6 採用「林下工作桌 Woodland Desk」視覺方向，加入集中式 design tokens、清楚的任務層級與可辨識的鍵盤 focus。兩個業務模組目前仍只有 placeholder，尚未建立業務 model 或演算法。

## 固定版本

- Python 3.13.15
- Django 5.2.17 LTS
- Django REST Framework 3.17.2
- Node.js 24.19.0 LTS
- React 19.2.8
- Vite 8.1.5
- PostgreSQL 17.11

其餘 JavaScript patch 版本記錄在 frontend/package-lock.json，Python dependency 記錄在 backend/requirements.txt。

## 啟動

先建立本機環境檔；.env 已被 Git 忽略，不要提交：

    Copy-Item .env.example .env
    # 編輯 .env，替換兩個 replace-with... 範例值
    docker compose up --build

開啟：

- React UI：http://localhost:5173
- Health API：http://localhost:8000/api/v1/health/

正常 API response：

    {
      "status": "ok",
      "service": "production-target-backend",
      "database": "connected",
      "api_version": "v1"
    }

## 驗證

另開一個 terminal，在專案根目錄執行：

    docker compose run --rm backend python manage.py test
    docker compose run --rm --no-deps frontend npm test
    docker compose run --rm --no-deps frontend npm run lint
    docker compose run --rm --no-deps frontend npm run build

## 停止與清理

停止 containers、保留 PostgreSQL volume：

    docker compose down

一併刪除本專案的 PostgreSQL 開發資料（不可復原）：

    docker compose down --volumes

## 資料流（用 DRF 概念理解 React）

1. App 定義 routes，類似 Django URLConf；AppLayout 類似 base.html，Outlet 類似 content block，依 URL 放入對應 Page。
2. useState 保存瀏覽器端的 request 狀態，角色類似 view 執行期間的區域狀態，但它會跨 render 保留。
3. HomePage 組合 FeatureCard 與 HealthStatus。HealthStatus 的 useEffect 在掛載後透過 fetchHealth 呼叫 /api/v1/health/；Vite dev server 把 /api proxy 到 Compose service backend:8000。離開首頁時 AbortController 取消請求，失敗時可重新檢查。
4. Django URL 將 request 交給 HealthView，view 用目前 database connection 執行 SELECT 1。
5. Promise 完成後，React 將 state 改為 success 或 error，component 隨 state 自動重新 render。
6. PostgreSQL hostname 是 Compose service 名稱 db；localhost 在 backend container 內只代表 backend container 自己。

## 目前範圍

Phase 0／0.5 刻意不包含 ProductionTarget model、檔案上傳、JWT、Redux、Celery、Redis、Nginx 或業務演算法。完整脈絡見 docs/PROJECT_CONTEXT.md。

## Phase 0.5 路由驗收

- `/`：任務選擇與 HealthStatus。
- `/volume-price-merge`：生產量值整併工作頁。
- `/table-compare`：表格比對說明與「尚未開放」。

啟動 Compose 後，在 http://localhost:5173 分別點擊兩張卡片、返回首頁，並直接開啟及重新整理上述三個 URL。Vite 開發伺服器的 SPA fallback 會回傳 index.html，再由 BrowserRouter 配對 Page；這不代表已設定正式環境的 fallback。

Desktop 超過 1024px 為兩欄，Tablet／Mobile 為單欄。可用 Tab 鍵確認導覽、CTA 與 retry 的 focus 樣式。

`frontend/src/test_app.tsx` 是未匯入 useState、含未使用變數的獨立練習草稿，未被 application 匯入。保留原檔，在 ESLint 與 TypeScript 設定僅排除此檔；其餘 src 與 tests 仍接受檢查。

## Phase 0.6 視覺基線

- `frontend/src/index.css` 集中管理 semantic colors、字體、spacing、radius、shadow、focus 與 transition tokens。
- 首頁依序呈現深林綠 Hero、兩個任務入口與 compact HealthStatus；第一個可用功能採 primary CTA，規劃中的功能採 outline CTA。
- 工作頁維持暖白 surface 與高對比文字，不把深色 Hero 背景延伸到未來表單或結果區。
- 動態效果為 180ms，並由 `prefers-reduced-motion: reduce` 關閉非必要動畫與 transition。
- 原創枝葉圖形為 inline SVG 純裝飾，不包含正式角色或第三方照片。

### JasonHandwriting1 字體

專案只載入 `frontend/public/fonts/JasonHandwriting1.woff2`，檔案大小為 4,326,200 bytes，SHA-256 為 `A937A66F01912696B302F23188FBE168585034C5E3A6F794A58717F8A6496250`。檔案取自作者游清松的[官方 GitHub repository](https://github.com/jasonhandwriting/JasonHandwriting)所提供的 `JasonHandWriting1-5_WebFont_woff2.zip`，只從壓縮檔取出第一套字體，沒有載入其他字型。

作者在官方 README 宣告 JasonHandwriting 系列採用 **SIL Open Font License**，可供個人與商業使用。網頁透過本機 WOFF2 與 `font-display: swap` 載入，不在瀏覽器執行時連線第三方 raw URL。字體只用於品牌與 Hero 短句；載入前及載入失敗時依序 fallback 至 `Noto Sans TC`、system UI 與 sans-serif。
