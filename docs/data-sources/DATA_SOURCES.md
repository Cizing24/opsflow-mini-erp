# 公開資料、授權與實際使用

## UCI Online Retail：已使用

來源：[UCI 官方頁](https://archive.ics.uci.edu/dataset/352/online+retail)。引用：Chen, D. (2015). Online Retail [Dataset]. UCI Machine Learning Repository. DOI [10.24432/C5BW33](https://doi.org/10.24432/C5BW33)。授權為 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。來源描述為英國非店面零售業 2010-12-01 至 2011-12-09 的歷史交易，不能當作工程企業採購與簽核紀錄。

實際官方 ZIP 已下載並用 Python 標準庫解析 XLSX；處理 541,909 列。排除取消 9,288 列、非正數數量／售價 2,517 列、不符合商品代碼或缺名稱 2,762 列。商品代碼統一大寫後有 3,790 種符合條件品項，按代碼排序取 100 個。

只保留 StockCode 與 Description，未輸出 CustomerID、Country、發票、日期或交易明細。名稱保留來源原文；SKU 加 `UCI-` 前綴。unit、reorderPoint 與 TWD 標準成本皆是明確的合成欄位；**未把 GBP 售價轉成 TWD 採購成本**。這些物料是資料整合展示用參考品項，不宣稱為工程必需材料。

可驗證檔案：`data/sources/uci-manifest.json` 保存下載 SHA-256、XLSX SHA-256、處理時間及各項統計；`data/mappings/uci-catalog.json` 為授權允許的 100 筆商品衍生目錄；`data/sources/import-result.json` 保存 DB 匯入前後實際數量。原始 ZIP 不提交。

```powershell
python data/generators/prepare-uci.py
npm run data:public
```

匯入會驗證大小寫正規化後 SKU 唯一性。重跑不新增重複物料；未被業務資料使用的物料可同步衍生成本，已有請購／庫存紀錄的標準成本保持原值，避免歷史成本改寫。

## Microsoft WideWorldImporters：已研究，未匯入

來源：[Microsoft SQL Server samples](https://learn.microsoft.com/en-us/sql/samples/sql-samples-where-are) 與 [官方 Repository](https://github.com/microsoft/sql-server-samples/tree/master/samples/databases/wide-world-importers)。本次唯讀查得 master commit `26dc1258b431470f515775b8c98ae77e1d66e39a`。官方範例程式授權見 [MIT license](https://github.com/microsoft/sql-server-samples/blob/master/license.txt)。

WWI 是官方虛構批發企業範例，包含 SQL Server backup、SSDT 專案、T-SQL schema 與模擬資料生成程序。本次檢視了官方目錄的 Purchasing、Warehouse、DataLoadSimulation、PostDeploymentScripts 等結構，沒有將 SQL Server 的備份或生成程序誤稱為已成功匯入 MySQL。

本次採有官方授權、可獨立清洗的 UCI 商品目錄作為公開來源實作，工程公司／專案／供應商／簽核／採購與庫存交易由固定 seed 合成。WWI 的 SQL Server restore 與 T-SQL 轉譯不納入本次執行；沒有依 WWI 編造公開供應商或交易。

## Provenance

| 標記 | 意義 |
|---|---|
| SYNTHETIC | 虛構工程企業資料或 demo 交易 |
| PUBLIC_DERIVED | UCI 商品代碼／名稱，搭配明確合成成本欄位 |
| TEST | 測試資料庫內的種子與 API 庫存交易 |

Performance Benchmark 為獨立 DB 的合成配對交易，sourceKey 逐筆包含 seed 與序號。從公開物料建立的採購／領料仍是模擬企業交易，不會因此變成真實公開營運紀錄。
