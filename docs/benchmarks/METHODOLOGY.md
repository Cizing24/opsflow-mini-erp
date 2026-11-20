# Benchmark 方法

主量測工具為可執行的 Node harness `scripts/benchmark.ts`；另附 k6 script 供獨立延伸負載。本次報告只引用實際執行的工具，k6 數字沒有混進 Node 結果。

## 資料與環境

必須使用 opsflow_benchmark，至少有 100,000 筆可追溯庫存異動；資料品質先通過 data-check。results.json 保存 Git SHA、workingTreeDirty、OS、CPU、logical cores、memory、Node、MySQL、Docker 版本、日期與資料量。產生資料的時間由 seed 真實計時；不當成 API throughput。

## API

對 authenticated movements 分頁、projects 分頁、costs JOIN 報表各執行 1／4／16 並行，情境前 5 次 warm-up，每個情境 120 次完整 response body。平均值為算術平均，P50／P95／P99 採 nearest-rank。throughput = 完成樣本數 / wall-clock 秒；任何非 200 或網路錯誤計入 error rate。Session 已登入，不把 scrypt 登入延遲混入業務 API。

這是 closed-loop 短時間本機測試；沒有獨立負載主機、持續數小時 soak、信賴區間或端到端網際網路量測。不能外推為 production SLA、使用者容量或跨硬體比較。其他建置程序若同時消耗資源也可能影響結果，環境差異需重測。

## SQL

指定 projectId 與 createdAt 範圍，以 Movement JOIN Project、ORDER BY createdAt/id、LIMIT 50。前後各 30 次，保存 EXPLAIN FORMAT=JSON。前測移除 `(projectId,createdAt)` composite index，但保留臨時 projectId index 支援 FK；後測恢復正式 composite index並刪除臨時 index。ANALYZE TABLE 更新統計。所有 DDL 僅在隔離 benchmark DB，finally 處理復原。

另測 OFFSET 0／50,000／100,000 各 10 次，觀察大量資料深分頁成本。沒有宣稱 OFFSET 是無成本；若未來互動需要深頁掃描，應考慮 keyset pagination。索引前後以相同 query 與資料比較，但未隨機交錯 cold/warm cache，因此只作本機觀察。

```powershell
node --import tsx scripts/test-database.ts --setup --benchmark --reset
# 將 DATABASE_URL 指向 opsflow_benchmark（沿用本機帳密；不要將 URL 貼到公開記錄）
npm run benchmark
```

Concurrency correctness 由 integration suite 的真實 HTTP／MySQL 測試提供，不以讀 API benchmark 推論寫入一致性。腳本拒絕 demo 資料庫。
