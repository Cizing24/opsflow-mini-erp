# Regression Matrix

| 風險 | 自動檢查 | 失敗時期望 |
|---|---|---|
| 越權操作／非成員 | role、CSRF、Origin、membership、自我及跨部門簽核 | 401/403，不寫入 |
| 非法狀態轉換 | 未核准建 PO、重複 PO、再次簽核、退回重送 | 409，歷程保留 |
| 重複收貨 | 同 Key 8 並行；變更 payload 重用 Key | 一次入庫；衝突 409 |
| 超收與競爭 | 超過剩餘、不同 Key 搶收剩餘 | rollback、無超收 |
| 負庫存 | 12 人搶最後一件 | 一成功、11 衝突、庫存 0 |
| 重複領料成本 | 同 Key replay、跨 actor 重用 | 成本一次；跨 actor 409 |
| 舊明細核准 | row lock 協調重送與核准 | 新金額超預算時 409 |
| CSV 成本失真 | 空白、負數、重複 header、原子匯入 | 400 且整批不寫入 |
| CSV 公式 | = 開頭 SKU 匯出 | 加單引號防護 |
| 搜尋回應競爭 | unit 延後舊 Promise 回傳 | 最新結果不被覆蓋 |
| 供應商失效 | timeout 600ms × 2 | 502，沒有訂單副作用 |
| 前端流程回歸 | Chromium 完整跨角色業務流程 | 單據與成本真的更新 |
| Migration 失敗 | 獨立隨機 DB fixture | 非零 exit、可前向修復 |
| 新功能破壞舊公式 | 刻意錯誤 fixture | 測試非零，正式規則 GREEN |

執行結果在 integration-results.json 與 e2e-results.json。RED 報告是歷史失敗證據，不能納入最終通過數或宣稱原版一直正確。
