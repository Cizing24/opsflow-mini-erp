# 資料生成與受控重置

固定 random seed 預設 `20261120`，固定 as-of 預設 `2026-11-19T00:00:00Z`。過去的時間錨點避免已完成事件出現在未來；預計到貨日可在未來。可用 `--seed`、`--as-of` 明確覆寫；as-of 不允許晚於現在。

| 模式 | 實際生成規模 |
|---|---|
| guided | 5 專案、5 使用者、20 合成物料、38 請購、30 PO、20 收貨、60 異動 |
| business | 50 專案、5 使用者、20 物料、1,008 請購、1,000 PO、666 收貨、706 異動 |
| benchmark | Business 規模加 100,000 筆配對 IN/OUT；總異動 100,706 |

Guided 本機再匯入 UCI 後共有 120 物料，其中 100 為 PUBLIC_DERIVED。資料完整性檢查包含負庫存、餘額對帳、缺少庫存列、收貨加總、Movement 對應、PO 狀態、PO 與請購狀態及數量／成本界線。

```powershell
npm run seed -- --mode guided
# 存在使用者時保留資料並執行檢查，不自動覆寫。
npm run seed -- --mode guided --reset --confirm=opsflow_demo
npm run data:public
npm run data:check

# 建立獨立 benchmark DB，先生成 business，再另一次重置成 benchmark。
node --import tsx scripts/test-database.ts --setup --benchmark --business --reset
node --import tsx scripts/test-database.ts --setup --benchmark --reset
```

Seed 只允許 opsflow_demo、opsflow_test、opsflow_e2e、opsflow_benchmark。重置需完整 DB 名稱確認；Benchmark 只允許 opsflow_benchmark。HTTP 沒有重置入口。測試 runner 明確指定測試 DB，且 Integration 與 E2E 各用不同 DB。

相同 seed 與日期產生相同業務內容、單號、數量、價格與狀態；auto-increment ID、密碼 salt、執行 Audit 時間不保證相同。生成中的失敗會留下可檢查的未完成資料；修復後需明確 reset 重跑，不會偷偷接續或覆寫。

DEMO_PASSWORD 只在初始化帳號時使用；已有資料時改動環境值不會自動更換密碼。請保留原值，或在確認合成資料可刪除後受控 reset；本版本沒有線上密碼變更／重設介面。
