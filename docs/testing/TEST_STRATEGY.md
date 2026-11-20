# 測試策略與執行

Unit 使用 Vitest 驗證 strict schemas、整數成本／上限、密碼雜湊及前端查詢競爭。Integration 透過真實 Nest HTTP app、Cookie、MySQL driver 執行，不替換 repository 或 DB。Playwright 使用真正 Chromium，所有畫面都來自 API；完整跨角色交易會實際寫入 opsflow_e2e。

```powershell
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm run build
npm test
node --import tsx scripts/test-database.ts --setup --reset
npx playwright install chromium
npm run test:e2e
node --import tsx scripts/fault-drills.ts
node --import tsx scripts/backup-restore.ts
```

Integration 使用 opsflow_test；E2E 使用 opsflow_e2e，均需專案 Compose db 啟動。測試 runner 只重置明確命名的測試庫。正常 ERP 沒有故障注入開關；Simulation fixture 位於 tests/fixtures，不包含在正常 `npm test` 的 tests/unit 範圍。

## 真實並行與 rollback

8 個相同 Key 收貨同時到達，斷言只有一張 Receipt、一次庫存增加與相同回應 ID。2 個不同 Key 搶收剩餘數量，只有一個成功。12 個 Key 搶領最後一件，只有一個 201、其餘 409，最終庫存為 0。失敗後檢查 Idempotency 沒有殘留、ledger 與 Stock 一致。

簽核／重送競態以 MySQL row lock 及 SHOW FULL PROCESSLIST 確認另一個 HTTP 請求正在等待，才提交更新後的明細；不是以固定 sleep 猜測交錯。已保留修正前 201（應為 409）的 RED 報告與修正後 GREEN 結果。

## Browser 檢查

完整情境包含工程師送請購、主管核准、採購建 PO、倉庫收 4/10、工程師領 1、管理員核對成本與 audit。測試 320、390、768、1024、1440 寬度的 document overflow，並涵蓋空結果、focus、Escape、角色隱藏與 session 恢復。截圖關閉有限動畫後擷取，避免標籤進場動畫造成假缺漏。

原始 Playwright JSON、trace、HTML report 可能包含 session 或環境設定，只保留在 gitignored test-results / playwright-report。本次提交與 CI 上傳只使用已去除 config/env 的摘要 JSON 與安全截圖；不提交 raw trace、Cookie 或 .env。

未以真實手機、Safari、Firefox、螢幕閱讀器或外部滲透測試驗證。Responsive 截圖與自動化 keyboard checks 不等同完整 WCAG 認證。
