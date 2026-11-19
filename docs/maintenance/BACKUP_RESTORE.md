# 備份與還原

```powershell
node --import tsx scripts/backup-restore.ts
```

此程式只讀 opsflow_demo，以 mysqldump `--single-transaction --routines --triggers --no-tablespaces --default-character-set=utf8mb4` 產生一致性備份。密碼從容器環境讀入 MYSQL_PWD，沒有寫入命令輸出或 SQL 檔。備份保存在 gitignored backups/；內容包含 password hash、session 及 audit，仍屬本機受保護資料。

還原目標為本次新建、隨機命名的 `opsflow_restore_<hex>`，不覆寫 demo。程式比對來源與副本的表筆數及所有 data-check 結果，保存檔案大小、SHA-256、比對與 sourceModified=false；最後只移除此新建副本。實測結果在 backup-restore-results.json。

這是功能性還原演練，沒有宣稱已具備 RPO/RTO、排程保留、異地備份或完整位元層級校驗。若要還原到重要既有資料庫，先停止寫入並另外備份；確認來源／目標、權限、空間與版本後取得授權，再執行復原。不得將本機演練程式改成接收任意 DROP 目標。
