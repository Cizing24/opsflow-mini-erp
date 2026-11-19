# OpsFlow Mini ERP 執行計畫

以附件完整需求為驗收來源。單一虛構企業、TWD、固定標準成本；不處理會計總帳、稅務、跨幣別或真實採購。

1. 建立 Private Repository、版本鎖定、MySQL、Migration、共享 API 輸入契約。驗證安裝、schema 與 migration。
2. 認證與權限切片：Cookie session、CSRF、RBAC、結構化錯誤及 Audit。驗證未登入／越權／錯誤輸入。
3. 專案與請購切片：預算、成員、物料需求、送審／退回／拒絕／核准。驗證狀態與專案存取。
4. 採購與倉儲切片：PO、部分收貨、領料、金額與 idempotency；以交易與條件更新防止重複及負庫存。驗證實際 MySQL 並行與 rollback。
5. Portal、報表、CSV、外部供應商模擬服務。驗證公式、權限、timeout、重試。
6. Vue 介面與 Guided Demo；驗證桌面及行動尺寸、完整跨角色 E2E。
7. 三種固定亂數資料模式、公開資料轉換、100k ledger、API 與 SQL 實測及隔離故障演練。
8. Docker 乾淨建置、CI、維護文件、作品集素材、最終 PR；不合併。

Tasks 暫以 tasks/todo.md 記錄，再以 GitHub Issues 追蹤；問題需區分自然 bug 與 Simulation。

主要風險：收貨與領料的競爭、預算承諾與成本重複計算、外部資料來源及授權、Windows Docker 環境。所有測試與 benchmark 使用獨立資料庫。
