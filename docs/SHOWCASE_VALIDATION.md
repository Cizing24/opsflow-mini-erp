# GitHub 展示更新與驗證

日期：2026-11-21（Asia/Taipei）。基準為已合併 PR #10 的 `main`，提交 `aa2f234dbee3f2e550762dedd5f544cbdc7f5781`。本次使用 `docs/github-showcase-refresh` 隔離 worktree，只修改 README、文件、媒體及本機素材暫存的忽略規則，沒有變更產品功能、依賴、Migration 或部署設定。

## 媒體與資料

`docs/media/cover.png`、`requests.png`、`orders.png`、`inventory.png`、`projects.png` 為本次真實桌面畫面，1280×720。既有 `docs/screenshots/desktop.png`、`mobile.png` 保留原樣，沒有以新圖覆蓋歷史證據。

`demo.mp4` 為 74.68 秒連續 Chromium 操作錄製，依序經過工程師請購、主管核准、採購建單、倉庫部分收貨、工程師領料、管理員專案與稽核紀錄，以及操作導覽。`demo.gif` 為其中 20 秒連續節錄，800×450、140 幀、7 fps，3,724,176 bytes；只降低解析度與影格率，未製作假操作或攔截 API 回應。影片可在 Repository 下載，沒有新增外部影片平台或公開 ERP。

使用全新 `opsflow-showcase` MySQL 容器與獨立 Volume，只綁定 localhost；資料庫名稱沿用 Seed 允許的 `opsflow_demo`，但連線位址、容器及儲存空間與既有 Demo 分開。Guided 初始化建立 5 專案、5 帳號、20 物料、38 請購、30 PO、20 收貨、60 異動，資料驗證 8 類異常均為 0。後續錄製產生的單據亦為合成展示資料；沒有匯入真實公司、客戶、公開零售交易或舊環境資料。

登入密碼從本機忽略的 `.env` 讀取，只輸入密碼欄位；沒有將帳密、Session、Cookie、Token、資料庫或原始設定提交。截圖及影片已目視檢查。README 明列公開目錄是可選匯入，乾淨 Guided 只有 20 項物料；原有 120 項物料數字已限定為歷史交付環境。

## 架構與決策查核

graphify 0.9.113 對 API、Vue、shared、Prisma 來源共 29 個 code files 進行 AST 抽取，建立 375 nodes／805 edges 的本機查核圖，查詢 `InventoryController`、`idempotent` 及資料庫關係，再讀原始碼與 schema 核對：

| 關係或規則                                  | owning source                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| Vue Router、頁面與登入狀態                  | `apps/web/src/main.ts`、`App.vue`、`pages/`                                  |
| Same-origin API、Cookie／CSRF／RBAC         | `apps/api/src/main.ts`、`auth.ts`、`security.ts`                             |
| 請購、核准與唯一 PO                         | `apps/api/src/procurement.ts`、`prisma/schema.prisma`                        |
| 收貨鎖 PO、超收檢查、Stock／Movement／Audit | `apps/api/src/inventory.ts`                                                  |
| Actor／scope／payload replay 與交易邊界     | `apps/api/src/transactions.ts`                                               |
| 原子領料、金額與報表                        | `inventory.ts`、`reports.ts`、`resources.ts`、`packages/shared/src/index.ts` |
| MySQL adapter 與供應商模擬                  | `db.ts`、`integrations.ts`、`scripts/supplier-mock.mjs`、`compose.yaml`      |

`media/architecture.svg` 對應目前單一 Nest module、按業務分檔的單體。沒有額外微服務或 Message Broker；供應商為隔離模擬服務，不是真實供應商整合。既有 [SYSTEM_ARCHITECTURE](architecture/SYSTEM_ARCHITECTURE.md)、[ERD](architecture/ERD.md) 與 [ADR](decisions/ADR-001.md) 保留。

graphify 診斷限制：1 份 SQL Migration 因未安裝選用 SQL parser 而未建圖，1 份 Vue 元件沒有符號；原始抽取有 3 條 dangling endpoint，同端點不同關係合併 9 條。SQL、Prisma schema 與交易語意已人工核對，不以節點數或 AST 覆蓋取代執行期測試。

## 本次實際驗證

環境：Windows、Node 24.22.1、MySQL 8.4、Chromium。沒有修改測試斷言、安全邏輯或套件版本。

- `npm ci --ignore-scripts` 成功，安裝當下 audit 摘要為 0 vulnerabilities。
- `npm run db:generate`、`npm run build` 成功，包含 shared、NestJS、Vue TypeScript 及 Vite 編譯。
- `npm test`：3 個檔案、7 項 Unit 通過。
- `npm run db:migrate` 與 Guided Seed 在全新隔離 MySQL 成功，初始化資料檢查沒有異常。
- 真實錄製以斷言檢查請購可讀回、核准選項、待收貨、部分收貨、領料異動與 MATERIAL_ISSUE 稽核；完整成功，瀏覽器 `pageerror` 為 0。這是展示 smoke，不宣稱本次本機完整重跑全部 E2E。
- 媒體、Markdown、SVG 與瀏覽器播放結果見 `media/capture.json`、`media/validation.json`。GitHub GFM 輸出在 1280／390 px 各有 7 張圖片成功載入；GIF 實測動畫、74.68 秒 MP4 播放與 3 處 seek、SVG 解碼及影片完整解碼通過，瀏覽器 pageerror 為 0。本次提交的檔案另經 46 個本地連結、格式、staged 及敏感資料檢查。

歷史交付 `bc92260` 的 [CI 44629535764](https://github.com/Cizing24/opsflow-mini-erp/actions/runs/44629535764) 已查核為 success；既有證據為 Unit 7、MySQL Integration 27、Chromium E2E 4，共 38 項。新的 PR 檢查另以該次 head 為準。既有 100,706 筆異動、1,080 次讀 API 的 Benchmark 仍是當時本機短測，沒有在本次重跑，也不是 production SLA。

## 排查與限制

Windows 的 `.showcase` 隱藏工作目錄下，直接重新載入 SPA 深路由曾回 500；同一份 index 用 Express 絕對路徑 `sendFile` 對照回 404，以 `root` 加相對檔名則為 200，確認是隱藏目錄的靜態檔案處理限制。錄製改用介面內導覽後全流程正常。產品程式未修改；一般 clone 路徑與 Docker 不含該隱藏父目錄，本次沒有因此宣稱所有深連結環境都已驗證。

初版錄製腳本另修正非同步選單等待、等待登出完成後才換角色，以及以唯一合成用途定位新領料；未將錄製腳本失敗算作產品測試失敗，也未掩蓋它們。工具與失敗原片留在忽略的本機暫存，只有最終成功影片提交。

未重跑本機 Integration／完整 E2E、Benchmark、故障注入、備份還原、實機、Safari／Firefox、人工讀屏與長時間負載。沒有新增正式部署、真實金流或商業成效聲明。原有授權、資料來源、有效啟動及維運文件均保留。
