# Migration 與故障復原

目前正式 migration 為 `prisma/migrations/202611200001_init/migration.sql`，建立 schema、索引、unique 與外鍵。Prisma 7 的 datasource URL 由 prisma.config.ts 讀取 .env；不得把憑證放 schema 或 migration。

```powershell
npm run db:generate
npm run db:migrate
```

新增 migration 需在開發／測試 DB 生成並審閱 SQL，再由 `migrate deploy` 在部署時執行。本專案啟動不用 db push 或 migrate reset。既有 applied migration 不能改 checksum 來掩蓋問題。

## 失敗處理

1. 停止相關寫入並備份，保存錯誤碼及 migration 狀態。
2. 查明哪些 DDL 已執行。MySQL DDL 可能 implicit commit，不能假設 transaction 能回滾整個 migration。
3. 若確定沒有殘留變更或已完成修復，使用 `prisma migrate resolve --rolled-back <name>` 標記；這個指令只改 migration 紀錄，**不會自動回滾資料表**。
4. 修正部署來源或新增安全前向 migration，重新 deploy，執行 data-check 與回歸測試。
5. 若要在有重要資料的環境復原／刪欄位／重設，需先取得明確授權，不能照搬演練的 CREATE/DROP。

本次實際演練由 `scripts/fault-drills.ts` 建立隨機命名的全新隔離資料庫：錯誤 ALTER 不存在資料表導致 P3018/1146；標記 rolled-back 後改為建立專用 marker table，再 deploy 成功。結果見 fault-results.json；fixture 不在正式 migration 目錄，正常版本不保留此故障。
