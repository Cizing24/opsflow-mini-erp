# Benchmark 實測結果

日期（UTC）：2026-11-19T21:34:05.923Z。程式 Commit：`7cdf7422fd0215800d1a33d91225337a0cbd8440`，量測開始時 working tree clean。資料：50 專案、1,000 PO、100,706 異動；品質檢查全部 0。Seed 設定：{"asOf": "2026-11-19T00:00:00.000Z", "mode": "benchmark", "origin": "SYNTHETIC", "randomSeed": "20261120"}。

環境：win32 10.0.26300、AMD Ryzen 5 5600H with Radeon Graphics、12 logical CPUs、15.41 GiB RAM、Node v24.22.1、MySQL 8.4.13（Docker 29.9.3）。API 與負載程序在 Windows 同機，DB 在 Docker Desktop。

## API

每情境 120 次、暖機 5 次、nearest-rank 分位數，共 1,080 個正式樣本，皆為 200。

| API | 並行 | Avg ms | P50 | P95 | P99 | req/s | Error |
|---|---:|---:|---:|---:|---:|---:|---:|
| /api/movements?page=1&pageSize=20 | 1 | 23.38 | 22.54 | 29.52 | 33.08 | 42.78 | 0.0% |
| /api/movements?page=1&pageSize=20 | 4 | 35.80 | 34.67 | 45.50 | 48.78 | 110.82 | 0.0% |
| /api/movements?page=1&pageSize=20 | 16 | 118.19 | 118.29 | 137.55 | 144.36 | 130.30 | 0.0% |
| /api/projects?page=1&pageSize=20 | 1 | 44.36 | 43.49 | 50.12 | 57.88 | 22.54 | 0.0% |
| /api/projects?page=1&pageSize=20 | 4 | 74.91 | 74.49 | 85.42 | 100.23 | 52.85 | 0.0% |
| /api/projects?page=1&pageSize=20 | 16 | 262.05 | 264.47 | 303.19 | 305.33 | 58.91 | 0.0% |
| /api/reports/costs | 1 | 64.23 | 63.49 | 68.68 | 72.67 | 15.57 | 0.0% |
| /api/reports/costs | 4 | 105.41 | 99.99 | 156.50 | 169.49 | 37.75 | 0.0% |
| /api/reports/costs | 16 | 250.86 | 248.36 | 315.39 | 357.13 | 61.14 | 0.0% |

## 實際查詢修正

Issue #12 的專案列表改為 SQL GROUP BY SUM。相同資料與腳本下，16 並行 P95：2291.71 → 303.19 ms；throughput：8.58 → 58.91 req/s。兩次觀察的 P95 差異為 86.77%。原基準 Commit `3a98e220a38645164bf05beb45a0f6d18197de72`，完整資料在 before-project-aggregation.json。

這不是隨機交錯或獨立負載主機的控制實驗；未修改的端點也有時間差，顯示主機／快取狀態會影響數據。因此不能把全部差異單獨歸因於這幾行 SQL，也不能當成跨環境的改善保證。回歸測試另外直接核對彙總成本與數量，確保沒有靠少算資料加速。

## SQL、分頁及生成

相同 Movement JOIN Project 查詢各 30 次：移除 composite index 時 Avg 4.324 ms、P95 4.997 ms；恢復 index 後 Avg 2.179 ms、P95 2.905 ms。EXPLAIN FORMAT=JSON 原文及 OFFSET 0／50,000／100,000 各 10 次測量在 results.json。DDL 僅在 opsflow_benchmark，最終索引已恢復。

Business 模式重置與生成實測 93.799 秒；Benchmark 模式 165.903 秒。計時包含該模式全部資料建立及重置，沒有把它冒充純 100k ledger 插入吞吐；完整 counts 與零異常在 seed-business.json / seed-benchmark.json。

Consistency 來自實際 MySQL integration：8 同 Key 收貨只入庫一次、不同 Key 超收競爭只一人成功、12 人搶最後一件只一人成功、延後失敗會 rollback、簽核／重送競態被拒絕。這些是正確性結果，不以讀 API throughput 推論。

限制：短期 closed-loop、無信賴區間、無 soak、無網際網路或實機量測。k6 script 已提供，但本次數字均來自 Node harness，未宣稱已執行 k6。重現方式見 METHODOLOGY.md。
