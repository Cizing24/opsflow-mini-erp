# KPI 定義

Portal 每次 GET /api/dashboard 即時讀取 MySQL，不使用硬編碼統計。`asOf` 為伺服器本次查詢時間；近 90 天採 UTC 滾動 90 × 24 小時。介面日期使用 Asia/Taipei 顯示。ENGINEER 只計算自己可存取專案；其他角色可看企業彙總，MANAGER 的待簽核清單限同部門且不是自己。

| 指標 | 公式與資料來源 | 範圍、排除條件 |
|---|---|---|
| 平均簽核時間 | AVG(Approval.createdAt − Approval.submittedAt)，小時 | 近 90 天內的 APPROVED 決策；排除退回、拒絕、未核准、未來時間。退回重送以該次重送時間計算，不含之前補件時間 |
| 待審核案件數 | COUNT(PurchaseRequest.status = SUBMITTED) | 當下所有未結案件；依角色縮限；不是「已核准但未採購」數 |
| 採購準時到貨率 | completedAt ≤ expectedAt 的單數 / 已收齊單數 | 近 90 天完成收貨的 PO；尚未收齊與未來完成時間排除。無分母為 null |
| 部分收貨率 | 目前 status = PARTIAL 的 PO / 期間建立 PO | orderedAt 在近 90 天；是當下仍部分收貨比例，不是歷史曾經分批比例。無分母為 null |
| 採購逾期金額 | Σ((OrderLine.quantity − receivedQty) × unitCostCents) | 預計日早於當下且未 RECEIVED 的全部 PO；只算尚未收的部分，不含已收價值 |
| 預算承諾率 | 已核准／已轉 PO 的 RequestLine 金額 / Project.budgetCents | 專案全生命週期；SUBMITTED、RETURNED、REJECTED 排除；預算為 0 時 null |
| 專案實際領用成本 | Σ(Movement.quantity × unitCostCents)，kind = OUT | 專案全生命週期；入庫不計成本。/reports/costs 可另指定 from/to |
| 庫存周轉率 | 期間領用成本 / 期間平均庫存成本 | 未保存期初／期末估值快照，回 null 與原因；不以隨意固定值補足 |
| 異常件數 | 逾期待收 PO 數 + 低庫存 Stock 列數 + 承諾率 ≥ 80% 專案數 | 當下；同一專案或物料可能觸發不同類型提醒，這是提醒件數，不是去重事故數 |

低庫存以 `Stock.quantity < Material.reorderPoint` 判斷；尚未建立 Stock 的倉庫／物料組合不當作已建置的安全庫存項目。固定標準成本與金額單位見 ADR-001。所有數字都是模擬資料的當下結果，不能解讀為實際企業的營運績效改善。

實際 Guided Demo 的結果在 `docs/benchmarks/demo-kpis.json`，保留資料量與查詢時間。測試直接把 ledger 加總與 API 回應比對。
