# 可量化結果

以下均為本作品實測或資料庫計算，非企業導入績效。

| 項目 | 實際結果 |
|---|---|
| 本機核心自動化案例 | Unit 7/7、MySQL Integration 27/27、Chromium E2E 4/4 |
| Ubuntu CI | success，該次 artifact 為 Unit 6 / Integration 27 / E2E 4，含 Docker smoke |
| Guided / Business / Benchmark | 5/30/60；50/1,000/706；50/1,000/100,706（專案/PO/異動） |
| 公開資料 | 讀取 541,909 列，匯入 100 個商品衍生目錄；交易匯入 0 |
| 一致性 | 同 Key 8 並行一次入庫；最後一件 12 並行一成功 |
| 專案列表後測（16 並行） | P95 303.19ms、58.91req/s、error 0% |
| SQL index 觀察 | Avg 4.324→2.179ms，各 30 次 |
| Guided 平均核准時間 | 15.68 小時（近 90 天口徑） |
| Guided 待審核／準時／部分收貨 | 5 件 / 80.0% / 33.3% |
| Guided 逾期待收／實際領用 | TWD 83,609.47 / 88,267.08 |

資料與日期在 demo-kpis.json、results.json、各測試摘要；測量限制及原基準在 RESULTS.md。截圖取自完成交易後的隔離 E2E DB，數字與初始化 Guided 快照可不同。周轉率未計算，因缺少期間平均庫存估值。
