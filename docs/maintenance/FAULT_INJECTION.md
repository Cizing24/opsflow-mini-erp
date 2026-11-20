# 隔離故障演練（Simulation）

以下不是歷史事故。所有故障均在測試／benchmark DB、獨立 fixture 或供應商模擬服務中，正常 ERP 不保留刻意缺陷。

| 演練 | 注入與檢查 | 證據 |
|---|---|---|
| 重複收貨 | 8 個 HTTP 請求共用 Key，檢查一張 Receipt 與一次 ledger | integration-results.json |
| 最後一件庫存競爭 | 新增 TEST 期初 1 件，12 個請求同時扣庫存 | 1 成功、11 個 409、餘額 0 |
| 報表索引退化 | 在 opsflow_benchmark 加臨時 FK index，移除 composite index，量測後恢復 | benchmarks/results.json 的 EXPLAIN 與前後 30 次樣本 |
| Migration 失敗 | 新隨機 DB 上 ALTER 不存在資料表，resolve rolled-back 後前向修復 | fault-results.json；錯誤 exit 非零、修復 exit 0 |
| 外部 API 無回應 | supplier 模擬延遲 1,500ms，client 每次 600ms、最多兩次 | integration timeout 502，沒有 PO 副作用 |
| 新功能破壞舊功能 | tests/fixtures 故意把 3×199 改成 3+199；正式 amount 規則另外驗證 | mutant exit 1，production unit exit 0 |

```powershell
node --import tsx scripts/fault-drills.ts
```

程式只會對本次自行建立的 `opsflow_drill_<random>` 執行 CREATE/DROP，確認名稱格式後清理。SQL 索引退化在 benchmark.ts 的 finally 保證恢復，不能對 demo 或正式 DB 執行。原始錯誤與復原狀態已保存，不使用預填「成功」數字。
