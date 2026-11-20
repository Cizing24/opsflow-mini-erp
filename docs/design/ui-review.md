# OpsFlow ERP UI Finish Review

## Disposition: ship — F1 / F2 verdict pass

**原兩項 material findings 均評為 resolved。** 此為原 F1 / F2 的 verdict pass：已核對修正程式碼、現有測試內容及更新截圖，並採用 build thread 回報的 E2E 4/4 成功結果。允許在此評分範圍繼續交付；本次沒有重開全產品審查，不能把這個 verdict 擴寫成全產品或所有狀態均已通過。

產品視角：工程師、主管、採購、倉儲及管理員，要從自己的待辦找到單據，完成請購、簽核、採購、收貨與領料。第一眼應辨識角色、目前需處理的單據及風險；主要動作是開啟那一筆單據並接續作業。桌面採可掃讀的摘要與密集列表，窄螢幕保留單據編號、狀態及下一步；長表格允許局部水平捲動。所有企業、金額及 KPI 均為合成測試資料，不代表真實營運成果。

## Material findings — 修正評分

| ID | 原問題 | 評分 | 修正及證據 |
| --- | --- | --- | --- |
| F1 | 手機關閉側欄仍可聚焦；開啟後缺少可見關閉控制。 | **resolved** | `App.vue` 在窄螢幕關閉時對 sidebar 設定 `inert`；開啟時隔離 workspace-body，將焦點移至具名稱的關閉鈕，支援 Tab / Shift+Tab 循環與 Escape，關閉後返回切換鈕，並設定 aria-expanded / aria-controls。已看 `mobile-nav.png`，關閉鈕及可見 focus ring 存在。第四項 E2E 明確檢查 390px 的 inert、開啟焦點、前後循環、Escape 與返回焦點。桌面不啟用 mobile inert 或焦點循環。 |
| F2 | 工作台逐筆入口只到列表，遺失所選單據 ID。 | **resolved** | `Dashboard.vue` 分別帶 `requestId` / `orderId`；`Requests.vue`、`Orders.vue` 以該 ID 呼叫單筆 API，再傳給原本 `view()` 開啟 drawer，不依第一頁資料尋找。查看全部仍到完整列表。讀取失敗會進入現有 error alert。第四項 E2E 檢查請購連結 URL 與 drawer，以及最舊採購的 ID 直接開啟 drawer；build thread 回報全套 4/4 成功。請購及採購沿用既有角色控制，沒有為深連結另開操作捷徑。 |

本次沒有要求重新設計 KPI、顏色、卡片或字體。它們在這個 Operate 工作區服務真實單據與狀態，不能僅因屬於常見企業後台模式就視為缺陷。

## Direction contract 核對

- **User + job / story：F2 resolved。** 工作台逐筆入口已把所選單據 ID 接到目的頁 drawer。
- **First-read object / hierarchy：符合截圖範圍。** 頁名、角色、待審核數、提醒、待辦與待收貨均有明確層級。桌面 232px 側欄與 4 欄摘要符合承諾。
- **Density / type / layout：符合截圖範圍。** 明亮作業面與深色固定導覽支援辦公室操作；單據編號、日期、文字狀態及成本欄位提供實際資訊，不依裝飾填密度。桌面雙欄任務與下方成本表成立。
- **Interaction model：F2 resolved。** 表格與既有 drawer 的入口脈絡完成；drawer 內部版面仍不在本次視覺證據範圍。
- **Responsive priority：F1 resolved。** 390px 摘要改為 2 欄、任務單欄，狀態保留。成本表的局部水平捲動符合 PRODUCT.md；手機導覽的焦點隔離與關閉操作已有程式碼及測試證據。
- **Forbidden defaults：截圖未見無理由的 hero、裝飾漸層、玻璃效果或等權重圖示卡片牆。** 摘要數字有計算口徑，預算進度與成本表有業務意義。固定導覽、表格及狀態 tag 應保留。
- **Comparable patterns：僅取操作規則，不複製視覺。** [Element Plus Drawer](https://element-plus.org/en-US/component/drawer.html) 的 Escape 關閉規則適合本專案的窄螢幕導覽；[ERPNext Purchase Receipt](https://docs.frappe.io/erpnext/purchase-receipt) 從來源採購單接續收貨的模式說明保留單據脈絡的重要性；[ERPNext Connections](https://www.youtube.com/watch?v=utWyHxul8Bk) 的關聯交易導覽支援跨單據追蹤。這些為已查閱的官方操作資料，不代表本 reviewer 親自操作過對照產品。

## Evidence / viewport scope

- 親自開啟並檢查 `.impeccable/review/desktop.png`：1440px 寬、完整頁面、管理員工作台。
- 親自開啟並檢查 `.impeccable/review/mobile.png`：390px 寬、完整頁面、管理員工作台，導覽關閉。
- 本輪另親自開啟並檢查 `.impeccable/review/mobile-nav.png`：390px 寬、管理員導覽開啟，關閉鈕呈現 focus ring。
- 三張內容完整，未見黑塊、空白捕捉、動畫隱藏或半載入內容，無須再 recapture 才能進行本次判定。
- 已讀 PRODUCT.md、docs/design/surface.md、craft-floor.md、style.css、App.vue、Dashboard.vue，並針對 F2 讀取 Requests.vue / Orders.vue 的開啟與載入流程。
- 本輪讀取最新 App.vue、Dashboard.vue、Requests.vue、Orders.vue 及 tests/e2e/erp.spec.ts，限於原 F1/F2 修正評分，沒有新增缺陷搜尋。
- build thread 回報 Browser E2E **4/4 通過**：前三項保留跨角色交易、320/390/768/1024/1440 無 document overflow、所有 routes、empty/focus/role state，第四項直接涵蓋 F1/F2。這是交接的執行結果，本 reviewer 讀取了測試內容，沒有重新執行測試。
- code-led，無 approved comp，因此本次不做 comp fidelity 宣稱。方向以現有 contract 與可見作業結果判定。

## 未驗證限制

未視覺檢查登入、其他 routes、表單、drawer 內部、loading、error、empty 或長內容狀態；沒有這些截圖，不能宣稱它們已通過視覺 finish gate。F1 的新增互動測試為 390px，未額外逐次操作 320px；F2 的新增測試不是桌面與手機各兩單據的完整矩陣，也未逐筆比對 drawer 的文字編號，但單筆 ID API 與 `view()` 銜接已由程式碼確認。未操作真實裝置、screen reader 或其他瀏覽器，也未重新驗證資料庫交易。**ship 僅表示本 reviewer 將原 F1/F2 兩項均評為 resolved。**
