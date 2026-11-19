# 面試展示步驟

1. 執行 `./scripts/init.ps1`，確認 Compose 的 db/app healthy，開啟 http://localhost:3000 。
2. 以 engineer@opsflow.test 登入。密碼取本機 .env 的 DEMO_PASSWORD，不必把它放進投影片或 Repository。
3. 在請購建立 10 件物料，選擇預算較充足的專案，記下主旨或單號。
4. 右上角登出，改用 manager@opsflow.test 核准；展示簽核意見與歷程。也可用既有退回單展示補件重送。
5. buyer@opsflow.test 建 PO，指定供應商與預計到貨日。
6. warehouse@opsflow.test 先收 4 件，展示待收 6、PO PARTIAL、該倉庫庫存增加 4。
7. engineer@opsflow.test 從相同倉庫領 1 件，填寫用途。
8. admin@opsflow.test 開工作台及稽核，核對成本增加一件標準成本；承諾金額保持完整請購總額，不因領料再加一次。
9. 開 docs/testing、docs/benchmarks、docs/maintenance，說明實測環境、失敗紀錄、修復與限制。

網站的「操作導覽」提供相同流程。不要在正在展示的資料庫執行 reset 或 benchmark；需重新開始時先停止操作，再使用明確 confirm 的 CLI。

Screenshots 在 docs/screenshots，來自真實 Chromium 的合成測試企業，並非設計 Mock。桌面與行動畫面分別為 desktop.png、mobile.png；視覺審查範圍詳 docs/design/ui-review.md。

截圖取自完成測試交易後的 opsflow_e2e，與 demo-kpis.json 的 Guided 初始化快照可能不同；兩者不是同一時間點的資料。
