# 真實 Bug 與修復紀錄

這些問題在本次從零開發與驗證時自然發現，沒有編造歷史企業事故。早期測試 fixture／selector 錯誤另列在最下方，不能拿來宣稱產品事故。

## Issue #3：舊查詢覆蓋新結果

[Issue](https://github.com/Cizing24/opsflow-mini-erp/issues/3)。首次 E2E 的搜尋暴露非同步結果順序未受控。最小 unit 重現：舊 Promise 延後完成，新搜尋先回 id=2，舊搜尋最後回 id=1；原版錯誤顯示 id=1。修正以遞增 version，只允許最新請求更新 items、total、error 與 loading。Fix commit `575e37e`；search-regression.test.ts 已先 RED 再 GREEN，完整 E2E 也重新執行。

## Issue #4：公開 SKU 大小寫碰撞

[Issue](https://github.com/Cizing24/opsflow-mini-erp/issues/4)。初次轉換 100 列，DB 實際只有 97 列，原因是 MySQL 大小寫不敏感 unique 與來源大小寫變體不一致。修正先 uppercase 去重再取樣，匯入前檢查 case-folded 唯一性；重跑實際取得 100 筆。Fix commit `35d49c3`，最新 manifest／import-result 及 DB counts 可查。已使用的標準成本不回溯改寫。

## Issue #5：核准與重新送審的預算競態

[Issue](https://github.com/Cizing24/opsflow-mini-erp/issues/5)。這是獨立 adversarial review 發現並由真實 MySQL 證實的 P1。原版核准先讀舊低額明細；重送 transaction 可把狀態與高額明細更新後 commit；核准接著把新高額單標成 APPROVED。RED `approval-race-red.json` 實際回 201，應為 409。

修正先鎖 PurchaseRequest 再讀明細，接著鎖 Project 計算當下承諾。測試用 SHOW FULL PROCESSLIST 確認等待中的 SQL，再提交高額重送；修正後 409、狀態仍 SUBMITTED。Fix commit `35d49c3`；GREEN 在 integration-results.json。沒有把這個自然發現的問題寫成 Simulation。

## Issue #6：CSV 空白成本與重複欄位

[Issue](https://github.com/Cizing24/opsflow-mini-erp/issues/6)。Number('') 變 0，重複 unitCostCents header 也會覆蓋前欄。RED `csv-validation-red.json` 顯示空白成本被 201 接受。修正驗證精確唯一 headers、非空整數字串，再轉 number 並套用既有 schema，整批 transaction。Fix commit `35d49c3`；兩類錯誤現在 400 且不留資料。

## Issue #7：workspace 啟動位置

[Issue](https://github.com/Cizing24/opsflow-mini-erp/issues/7)。`npm run start -w @opsflow/api` 的 cwd 是 apps/api，原本找不到 root .env，靜態 web 路徑也錯誤。實際得到 DATABASE_URL is required。改以 import.meta.url 定位 root .env 與 apps/web/dist；Fix commit `35d49c3`。Docker app 用相同 workspace command，真正 Chromium smoke 會驗證登入與 Portal。

## 其他開發檢查

[Issue #13](https://github.com/Cizing24/opsflow-mini-erp/issues/13)：Session 到期後，API 回 401，但前端保留登入使用者，連登出也失敗，必須重新整理才能回登入頁。新增 unit 實際 RED 重現殘留使用者；共享 API client 現在收到屬於當前 Session 的 401 便清除登入狀態。以發送請求時的 CSRF 與目前值比對，避免舊請求延後回 401 清掉剛完成的新登入。Fix commit `7eadd36`；兩種情境在 session-recovery.test.ts 實際 GREEN，Chromium 清 Cookie 後操作、回登入頁及重新登入也通過。

[Issue #11](https://github.com/Cizing24/opsflow-mini-erp/issues/11)：真實 Ubuntu CI [44604237209](https://github.com/Cizing24/opsflow-mini-erp/actions/runs/44604237209) 的 Typecheck 找不到 @opsflow/shared；本機殘留的 dist 掩蓋了前置建置依賴。修正根層 Typecheck 與 dev:api 先 build shared；本機實際移開舊 dist 後重新 Typecheck 成功，沒有提交 dist 或放寬型別規則。後續完整 CI 結果見 DELIVERY_REPORT。

[Issue #12](https://github.com/Cizing24/opsflow-mini-erp/issues/12)：100,706 筆異動實測，專案列表 16 並行的 P95 為 2,291.707ms。原本將各專案所有 OUT 明細載回 Node 再 filter/reduce；改為參數化 SQL 的 GROUP BY SUM，僅回每專案彙總。原基準在 before-project-aggregation.json；integration 直接比對 SQL 回應與逐筆 ledger 的金額及數量。改善幅度以後測真實結果為準。

[Issue #8](https://github.com/Cizing24/opsflow-mini-erp/issues/8)：Playwright 的 webServer health 在 globalSetup 前執行；全新 opsflow_e2e 尚未建立時，health 等待 60 秒逾時。已將 setup/migrate/seed 前移到 E2E runner，再啟動 Playwright；從新建 DB 實測四項 E2E 通過。

[Issue #9](https://github.com/Cizing24/opsflow-mini-erp/issues/9)：Malformed JSON 回 400，但 parser 在 Request ID middleware 前，錯誤沒有追蹤編號。`json-boundary-red.json` 保留 undefined 的失敗；修正 middleware 順序，並明確處理 payload limit 為 413。新增測試同時核對 400／413 與 Request ID；27 項整合測試已實際通過。

登入 limiter 原本只比對精確 path，等價的尾斜線／大小寫可進一般額度，已在第一個後端 commit `0357ac8` 前修正並加入 HTTP regression。npm audit 曾發現 csv-parse <7.0.2 的 prototype replacement advisory [GHSA-8cw4-87c7-c6xx](https://github.com/advisories/GHSA-8cw4-87c7-c6xx)，已升級 7.0.3；audit 結果需以交付快照為準。

第一輪 integration 有測試把空倉期初 Stock 當作必存在，已改為 null 代表 0；E2E selector 也曾同時匹配原生 option 與 table 狀態標籤，已縮限單據列。這些是測試錯誤。曾有截圖捕捉到 Element Plus 標籤縮放進場的中間狀態，已用 animations=disabled 重拍；不把它宣稱為 UI 資料缺失。
