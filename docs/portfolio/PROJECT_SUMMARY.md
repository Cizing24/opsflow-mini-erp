# OpsFlow ERP 作品摘要

## 繁體中文

OpsFlow ERP 是以 Vue 3、NestJS、Prisma 與 MySQL 建立的工程營運展示系統。它將工程師請購、主管簽核、採購建單、倉庫部分收貨及專案領料串成可實際操作的完整流程，並以資料庫計算專案預算承諾、實際成本與營運 KPI。

開發重點是交易一致性、權限與可維護性：以列鎖處理核准與重新送審競爭、以條件 UPDATE 防止負庫存、以持久化 Idempotency Key 防止重複入庫。以真實 MySQL 與 Chromium 驗證跨角色流程，另建立大量合成交易的 Benchmark、來源清洗、備份還原及隔離故障演練。

這是虛構工程企業的作品，不宣稱為完整商用 ERP，也不宣稱已為真實企業改善營運。

## English

OpsFlow ERP is a working engineering-operations demo built with Vue 3, NestJS, Prisma, and MySQL. It connects material requisitions, managerial approvals, purchase orders, partial receipts, and project material issues in one database-backed workflow. The portal calculates commitments, actual material costs, and operational KPIs from stored records.

The engineering focus is transactional integrity and maintainability: row locks serialize approvals with resubmissions, conditional stock updates prevent negative inventory, and persistent idempotency records prevent duplicate postings. Verification includes real MySQL integration and concurrency tests, a Chromium journey across five roles, reproducible synthetic data, measured API/SQL benchmarks, and isolated maintenance drills.

The company and business transactions are fictional. This project demonstrates implementation and verification skills; it is not presented as a full commercial ERP or evidence of a real company's operational improvements.
