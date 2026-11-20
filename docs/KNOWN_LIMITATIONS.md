# 已知限制

- 僅供本機與隔離展示，沒有公開部署、正式使用者或真實供應商／付款整合。
- 單一企業與幣別，固定標準成本；沒有總帳、稅額、付款、應付帳款、退貨、批號、盤點調整或多倉轉撥。
- 目前工程進度以專案狀態與物料需求呈現，沒有施工排程、工時、里程碑或可推論現場完工率的資料。
- 預算以請購核准承諾控制，實際成本依領料帳另算。未提供正式會計或庫存估價；周轉率因缺少期間估值快照回 null。
- 表單物料 catalog 上限 500；本次 Demo 120 個品項在範圍內。若要使用更大的品項庫，需加遠端搜尋選項與主檔 API 分頁。
- 一個 app instance 的記憶體 limiter（登入 15/min，一般 2,000/min/IP），沒有分散式 rate-limit store 或可信任 proxy 設定。
- Session 8 小時；沒有密碼重設、帳號停用、MFA、SSO 或帳號管理介面。Demo 五角色密碼由本機環境設定，不適用公開共用部署。
- Idempotency 紀錄不自動過期；Audit 與 session 清理、資料保留政策及備份排程未自動化。
- 大型報表查詢與 OFFSET 深頁有成本，Benchmark 是本機短測；不能當成 production SLA 或容量承諾。未執行長時間 soak 與跨主機負載。
- UCI 只使用商品代碼與名稱；其 TWD 成本是合成的。WWI 僅研究，未執行 SQL Server restore／轉譯。
- 真實手機、Safari／Firefox、螢幕閱讀器與正式滲透測試未驗證；截圖與 keyboard tests 不等同完整無障礙認證。
- Feature Branch 的 PR 不自動合併；main 保留初始 commit，需完成審查後再整合。
