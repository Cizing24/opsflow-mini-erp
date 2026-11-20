# 需求與驗收對照

需求來自本次 OpsFlow Mini ERP 完整交付附件。下列位置是實際實作，測試結果以 JSON 證據為準。

| 能力 | 實作 | 驗證 |
|---|---|---|
| 專案建立／修改、負責人／成員、預算與物料需求 | resources.ts、Projects.vue | MySQL integration 建立專案、membership、預算競態；E2E routes |
| 請購多明細、送審、退回重送、拒絕／核准 | procurement.ts、Requests.vue | return/resubmit、狀態與自我／跨部門簽核測試 |
| 唯一 PO、交期、待收數量、部分收貨 | procurement.ts、inventory.ts、Orders.vue | 建單前提、重複建單、超收及並行收貨測試 |
| 入庫、出庫、專案領料、庫存帳 | inventory.ts、Inventory.vue | 最後一件 12 並行請求、Idempotency、資料完整性 |
| Cookie Authentication、CSRF、RBAC | auth.ts、security.ts | 未登入、Origin、CSRF、越權、session hash、rate limit |
| Portal、個人待辦、成本與警示 | reports.ts、Dashboard.vue | ledger 成本比對、報表權限、真實 API KPI 匯出 |
| CSV、REST、OpenAPI、供應商模擬 | integrations.ts、openapi.ts | 原子匯入、公式防護、空白／重複欄位、timeout |
| 固定 seed、三種資料模式 | prisma/seed.ts | Guided / Business / Benchmark 實際 counts 與 data-check |
| 公開資料 provenance | data/generators、mappings、sources | UCI 官方 541,909 列清洗、100 個衍生物料 |
| 維護及可重建環境 | scripts/fault-drills.ts、backup-restore.ts、Dockerfile、CI | 故障 JSON、備份比對、Compose Chromium smoke |

## 驗收門檻

Lint 不可有 error；Typecheck、Build、Migration、Unit、Integration 與 E2E 均須成功。故障注入測試的刻意失敗只存在 tests/fixtures，由演練程式確認非零 exit；不納入正式通過率，也不會混進 production migration。

尚未具備庫存期初／期末估值快照，因此周轉率明確回傳 null 與原因。沒有公開部署要求的授權，本次交付為本機 Docker 與 Private Repository；PR 不自行合併。
