# API 使用說明

啟動後：`GET /api/docs` 為 Swagger UI，`GET /api/openapi.json` 為即時規格。`docs/api/openapi.json` 是本次由實際 app 匯出的快照，包含共享 Zod 輸入 schema、Cookie security、CSRF／Origin、Idempotency-Key 及分頁參數。

## 認證與錯誤

POST /api/auth/login 送 `{email,password}`，來源須等於 APP_ORIGIN。伺服器設定 HttpOnly cookie，回應使用者安全欄位與 csrf；後續寫入加 `X-CSRF-Token`。GET /api/auth/me 可恢復 session。POST /api/auth/logout 會撤銷 DB session。不要把 session token 放 localStorage。

所有錯誤為 `{error:{code,message,requestId}}`；HTTP 400 輸入或參照錯誤、401 未登入、403 來源／CSRF／權限錯誤、409 狀態／預算／庫存／Idempotency 衝突、429 限流、502 模擬供應商失敗。未知錯誤只回一般訊息；可用 response X-Request-ID 查結構化 log。

## 主要端點

| 方法／路徑 | 行為 |
|---|---|
| GET /api/catalog | 表單選項；工程師專案受 membership 篩選；不回密碼欄位 |
| GET/POST /api/projects；PATCH /api/projects/:id | 專案查詢、建立、修改 |
| POST /api/projects/:id/requirements | upsert 物料需求 |
| POST /api/suppliers；PATCH /api/suppliers/:id | 供應商維護 |
| POST /api/materials | 建立固定標準成本物料 |
| GET/POST /api/requests；GET /api/requests/:id | 請購查詢／送出／單據 |
| PATCH /api/requests/:id/resubmit | 原申請人修改 RETURNED 單 |
| POST /api/requests/:id/approval | decision 為 APPROVED / RETURNED / REJECTED，comment 必填 |
| GET/POST /api/orders；GET /api/orders/:id | 查詢或由已核准請購建 PO |
| POST /api/orders/:id/receipts | warehouseId 與 `{lineId,quantity}[]`，需 Idempotency-Key |
| POST /api/issues | projectId、materialId、warehouseId、quantity、note，需 Idempotency-Key |
| GET /api/inventory；GET /api/movements | 分頁庫存與 ledger |
| GET /api/dashboard；GET /api/reports/costs | 即時 KPI、成本；報表限 ADMIN / MANAGER |
| GET /api/audit | 限 ADMIN 的操作軌跡 |
| POST /api/materials/import；GET /api/materials/export | CSV 匯入／匯出 |
| GET /api/integrations/supplier-quote?mode=success | 對隔離服務的唯讀查詢 |

列表接受 q、page、pageSize（1–100）、sort（asc/desc）；專案、請購及 PO 另接受合法 status。回應 `{items,total,page,pageSize}`。預設 pageSize 20，UI 為 10。表單 catalog 物料選項上限 500，適用本次 120 品項 Demo；超過此規模需增加遠端選項查詢。

## Idempotency

收貨與領料 Key 為 8–100 個英數、底線或連字號。相同 actor、scope 與同一份 JSON payload 使用相同 Key 可取得原結果；不同 payload、角色或單據重用 Key 回 409。Key 在 DB 永久保存至受控重置；不會自動釋放後讓舊請求再次入庫。連線不確定時原樣重試；更改內容需使用新 Key。

## CSV

匯入欄位精確為 `sku,name,unit,unitCostCents,reorderPoint`，順序可調整但不可重複或多欄；最多 500 列。成本與安全量必須是非空十進位整數字串，再通過 Zod 範圍驗證。整批交易，SKU 既存時整批回滾。匯出包含 origin/sourceKey，並以單引號防護公式起始字元；因此完整 provenance 匯出檔不是直接覆寫主檔的匯入模板，匯入前應整理為上述五欄。
