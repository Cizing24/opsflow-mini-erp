# OpsFlow Mini ERP 交付報告

彙整時間（UTC）：2026-11-19T22:30:41.546455+00:00；使用者時區 Asia/Taipei，交付日 2026-11-20。

## Repository、版本與審查

- Private Repository：https://github.com/Cizing24/opsflow-mini-erp
- Branch：`feature/erp-core`；PR：https://github.com/Cizing24/opsflow-mini-erp/pull/10
- 核心程式與最後量測 Commit：`7cdf7422fd0215800d1a33d91225337a0cbd8440`。
- 已核對的成功 Ubuntu CI：[Run 44619892805](https://github.com/Cizing24/opsflow-mini-erp/actions/runs/44619892805)，head `7cdf7422fd0215800d1a33d91225337a0cbd8440`。
- 後續文件／測試證據彙整會產生新 Commit；目前 PR head 與最新 checks 見 [PR checks](https://github.com/Cizing24/opsflow-mini-erp/pull/10/checks)，本報告不寫入無法自指的文件 Commit SHA。沒有合併 main 或部署 production。

## 已完成模組與架構

Vue 3 / TypeScript / Vite / Element Plus / Pinia + NestJS Modular Monolith + Prisma 7 / MariaDB adapter + MySQL 8.4。具專案預算／成員／需求、請購及重送、主管核准／退回／拒絕、唯一 PO、分批收貨、庫存帳與領料、Portal KPI／成本、CSV、OpenAPI、供應商模擬。Cookie、CSRF、RBAC、交易、Idempotency、rate limit、Audit 與 Request ID 在後端執行。

## 資料、角色與公開來源

五角色為 ADMIN、MANAGER、ENGINEER、BUYER、WAREHOUSE。本機 Guided：5 專案、38 請購、30 PO、20 收貨、60 異動；20 合成物料加 100 公開衍生物料，共 120。Business：50 專案、1,008 請購、1,000 PO、666 收貨、706 異動。Benchmark：同業務規模與 100,706 異動。固定 seed 與受控 reset，資料檢查零異常。

UCI Online Retail（Chen 2015，CC BY 4.0）實際讀 541,909 列，只取代碼與名稱，清洗後匯入 100 商品；TWD 成本為合成、客戶欄位及交易未匯入。WWI 已研究官方來源、格式與 MIT 說明，未匯入 SQL Server backup 或資料。詳 Data Sources / manifest / mapping / THIRD_PARTY_NOTICES。

## Business KPI 實際快照

近 90 天平均核准 15.68 小時；待審核 5；準時到貨 80.0%；目前部分收貨 33.3%；逾期待收 TWD 83,609.47；專案實際領用 TWD 88,267.08；異常提醒 22。專案承諾與實際分開，不重複加總。周轉率明確 null。公式、範圍與排除條件在 KPI_DEFINITIONS.md。

## API、SQL 與並行實測

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

資料量 100,706；正式樣本 1,080 全部成功。專案列表 P95（16 並行）本次由 2291.71 降至 303.19ms，保留前後版本與資料。SQL index 前後 Avg 4.324→2.179ms；EXPLAIN、分頁、生成時間、硬體及限制見 benchmarks/RESULTS.md。不能將短測外推為 SLA，亦不宣稱全部差異只有 SQL 造成。

並行收貨、領料與 rollback 使用真實 HTTP／MySQL；同 Key 8 次只入庫一次、12 人搶最後一件只有一人成功。核准／重送競態有真實 RED/GREEN 證據。

## 測試、CI 與維護

本機 Unit 7/7、Integration 27/27、E2E 4/4，共 38 個案例，未 skip。Lint、Typecheck、Build、Migration 已執行。已核對的 Ubuntu CI 快照為 Unit 6、Integration 27、E2E 4；最新版本以 PR checks 為準。該次 npm audit 0、故障演練、備份與 Docker browser smoke 全部通過；artifact 已下載核對，摘要在 testing/ci-artifact-summary.json。刻意 mutant 的失敗不納入正式通過率。

真實問題有搜尋競爭、SKU 大小寫碰撞、簽核舊明細競態、CSV 空白／重複 header、workspace 路徑、全新 E2E DB 順序、parser Request ID、clean CI shared build 與登入逾時恢復；Issue／RCA／修復與回歸位置在 maintenance/REAL_BUG_RECORDS.md。六項 Simulation 與真實問題分開，沒有編造歷史事故。

交付前新增的 Effect ReDoS advisory 曾使後續 CI audit 失敗（Issue #14）；已用 scoped override 修至 effect 3.22.1（Commit `fda00d7`），npm audit 回到 0，Prisma generate／migrate 通過。保留 RED 報告與修復紀錄，沒有降低檢查門檻。

## Docker 與操作

全新 opsflow-clean Volume 已實測自動 Migration、Seed、healthy、Chromium 登入及零異常資料檢查；完成後清理該專用副本。保留原資料的主 Demo 已更新並驗證於 http://localhost:3000 。

Windows 執行 `./scripts/init.ps1`；密碼在本機 .env 的 DEMO_PASSWORD。帳號為 admin / manager / engineer / buyer / warehouse 加 `@opsflow.test`，右上角登出切換。依「操作導覽」完成 10 件請購、核准、建 PO、收 4、領 1、查看成本。

## 文件與作品素材

README、REQUIREMENTS、PRODUCT_OVERVIEW、業務流程、架構、ERD、OpenAPI、ADR、Data Sources／Dictionary／Seed、KPI、Benchmark、Test Strategy／Regression Matrix、Runbook、RCA、Migration、Backup／Restore、中英作品摘要、技術重點及 Demo 指引均已建立。真實截圖在 docs/screenshots；設計系統與 UI 審查有獨立證據，ship 只涵蓋原兩項修正評分範圍。

## 限制與後續

單一企業／TWD／固定標準成本；未做總帳、稅、付款、庫存期間估值、SSO／帳號生命週期、異地備份排程或分散式 limiter。表單物料選項上限 500。本次沒有公開部署、實機手機、Safari／Firefox、螢幕閱讀器、完整滲透或長時間負載測試；k6 script 提供但未實跑。詳 KNOWN_LIMITATIONS.md。所有公司與業務數字是模擬，不能宣稱實際導入成效。
