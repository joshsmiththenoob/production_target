# 年度生產目標比較器

Phase 0 建立 React → Django REST Framework → PostgreSQL 的第一條可測試資料流。目前只有 health check，尚未建立任何業務 model 或演算法。

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

1. App component 類似一個會依狀態重新 render 的 view fragment。
2. useState 保存瀏覽器端的 request 狀態，角色類似 view 執行期間的區域狀態，但它會跨 render 保留。
3. useEffect 在 component 掛載後呼叫 /api/v1/health/；Vite dev server 把 /api proxy 到 Compose service backend:8000。
4. Django URL 將 request 交給 HealthView，view 用目前 database connection 執行 SELECT 1。
5. Promise 完成後，React 將 state 改為 success 或 error，component 隨 state 自動重新 render。
6. PostgreSQL hostname 是 Compose service 名稱 db；localhost 在 backend container 內只代表 backend container 自己。

## 目前範圍

Phase 0 刻意不包含 ProductionTarget model、檔案上傳、JWT、Redux、Celery、Redis、Nginx 或業務演算法。完整脈絡見 docs/PROJECT_CONTEXT.md。

