# 維運操作手冊

## 啟動與健康檢查

Windows PowerShell 執行 `./scripts/init.ps1`。首次建立本機 .env 後建置 Compose，app 自動 migration、非破壞性 seed，並等待 DB 與 app healthcheck。開啟 http://localhost:3000 。開發模式可執行 `npm run dev:api` 與 `npm run dev:web`，APP_ORIGIN 應為 http://localhost:5173。

```powershell
docker compose ps
docker compose logs --tail 100 app
docker compose logs --tail 100 db
Invoke-RestMethod http://localhost:3000/api/health
npm run data:check
```

Health 成功表示 HTTP app 可執行 DB SELECT 1；不等同所有業務功能或供應商都健康。先用回應的 Request ID 查 JSON log，再查單據、AuditLog 與資料完整性。請勿把 .env、Cookie、原始 Playwright report 或備份貼到公開 Issue。

## 常見問題

| 現象 | 檢查與處置 |
|---|---|
| Docker pipe 不存在／拒絕存取 | 先啟動 Docker Desktop，確認 Linux Engine；Codex sandbox 可能需要經授權的 Engine 存取 |
| 401 | 重新登入；確認 session 過期或已登出 |
| 403 來源錯誤 | 瀏覽器使用的 origin 必須精確符合 APP_ORIGIN，包含 localhost/127.0.0.1 與 port |
| 403 權限錯誤 | 核對角色、工程師成員資格、簽核人與 requester 部門；不可為了測試移除後端 guard |
| 409 超收／庫存不足 | 重新查目前單據與倉庫；不要改 DB 餘額或強迫狀態 |
| Idempotency 衝突 | 原請求原樣重試同 Key；新內容使用新 Key，先確認原結果 |
| supplier 502 | 模擬 timeout 或服務未啟動；檢查 supplier log 與 SUPPLIER_API_URL；不重試有副作用的 PO POST |
| Migration 失敗 | 停止寫入，保留 Prisma 錯誤及 _prisma_migrations，依 Migration Guide 前向修復 |
| 查詢變慢 | 先記錄資料量與 EXPLAIN，再比較索引；不可在 demo 或正式 DB 執行 benchmark 的索引移除 |

## 停止與資料保護

`docker compose down` 停止並移除此專案容器，保留 MySQL volume。不要加 `--volumes`，除非確認資料可刪除。重置只使用 Seed Guide 的明確 confirm；沒有 HTTP 重置入口。

上線前仍需 HTTPS、專用強密碼、管理帳號生命週期、實際備份排程、異地復原、網路與資料庫權限審查。這些沒有在本機 Demo 冒充已完成。
