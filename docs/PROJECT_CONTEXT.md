# 年度生產目標比較器：專案脈絡

> 規格基準日：2026-08-24  
> 來源：Notion「Django-React: 年度生產目標比較器」與 CHATGPT_PROJECT_CONTEXT.md。

## 專案定位

本 repository 將建立單一 Django／React 農業資料處理平台。長期包含「果品生產量值整併」與「DOCX／XLSX 表格比對」兩個模組，但目前只做 Phase 0：可執行、可測試的現代化專案骨架與 health-check 垂直切片。

## 技術基線

- Backend：Python 3.13、Django 5.2 LTS、Django REST Framework 3.17。
- Frontend：React 19、TypeScript、Vite 8.1、Node.js 24 LTS。
- Database：PostgreSQL 17。
- 開發環境：Docker Compose v2。
- 實際 patch 版本由 dependency manifest、lock file 與固定 Docker image tag保存。

## Phase 0 範圍

1. GET /api/v1/health/ 經 DRF 執行資料庫查詢並回傳可讀 JSON。
2. React 首頁呼叫 health API，顯示 loading、success、error 三種狀態。
3. Compose 啟動 frontend、backend、db 三個 services。
4. Backend tests、frontend tests、lint 與 production build 均可重現。
5. 所有 secret 僅由環境變數提供；repository 只保留 .env.example。

## 架構與責任

    Browser → React/Vite → DRF Health API → PostgreSQL

React 只處理 UI、互動、瀏覽器狀態與 HTTP 呼叫。DRF 負責 request／response contract。未來的 Excel／DOCX 解析、整併與比對必須放在可脫離 HTTP、model 與 React 單獨測試的 Python services。

## 本階段刻意不做

- ProductionTarget 或其他 domain/job models。
- 果品整併、表格比對、檔案上傳與業務演算法。
- JWT、Redux、Celery、Redis、WebSocket、Kubernetes、微服務。
- Nginx 與正式環境部署設定。

## Phase 0 驗收

- docker compose up --build 後，瀏覽器可看到 backend 與 database 正常。
- Health API 的成功狀態為 HTTP 200；資料庫不可用時為 HTTP 503。
- React 三種狀態都有 component tests。
- README 清楚記錄啟動、測試、停止與清理指令。

完整願景與後續 phase 仍以 Notion 原始規格為準。

