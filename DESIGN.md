---
name: OpsFlow ERP
description: 明亮、可追溯的工程營運工作區
colors:
  accent: "#087f83"
  nav: "#133647"
  nav-hover: "#254b5b"
  nav-selected: "#1d626d"
  ink: "#243a46"
  muted: "#5b707b"
  regular: "#344b57"
  canvas: "#f3f6f8"
  surface: "#fff"
  line: "#dce5e9"
  field-border: "#bdcdd5"
  control-border: "#c9d6dc"
  focus: "#20b9b0"
  success: "#28744e"
  warning: "#9b6417"
  danger: "#b53b40"
  info: "#596f7a"
  attention-bg: "#fff8ea"
  attention-border: "#ead7af"
  attention-ink: "#75501d"
  table-header: "#f5f8fa"
  table-border: "#e7edf0"
  row-hover: "#f6fafb"
typography:
  display:
    fontFamily: '"Segoe UI", "Microsoft JhengHei", sans-serif'
    fontSize: "38px"
    fontWeight: 650
    lineHeight: 1.65
    letterSpacing: "-0.025em"
  headline:
    fontFamily: '"Segoe UI", "Microsoft JhengHei", sans-serif'
    fontSize: "27px"
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: "-0.02em"
  title:
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.5
  body:
    fontFamily: '"Segoe UI", "Microsoft JhengHei", sans-serif'
    fontSize: "14px"
  paragraph:
    lineHeight: 1.8
  label:
    fontSize: "12px"
  metric:
    fontSize: "29px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-0.02em"
rounded:
  tag: "4px"
  control: "6px"
  attention: "7px"
  panel: "8px"
  overview: "9px"
spacing:
  compact: "8px"
  inline: "12px"
  mobile: "16px"
  columns: "22px"
  panel: "24px"
  section: "32px"
  desktop: "36px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "8px 15px"
    height: "32px"
  button-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.regular}"
    rounded: "{rounded.control}"
    padding: "8px 15px"
    height: "32px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  nav-selected:
    backgroundColor: "{colors.nav-selected}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  attention:
    backgroundColor: "{colors.attention-bg}"
    textColor: "{colors.attention-ink}"
    rounded: "{rounded.attention}"
    padding: "16px 21px"
  status-tag:
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "0 7px"
    height: "20px"
---

# Design System: OpsFlow ERP

## Overview

**Creative North Star: "工程營運工作區"**

明亮的企業作業介面，以深藍固定側欄提供位置感，青綠連結及主要動作引導下一步。白色內容面與淡灰藍工作底色分層，資訊透過標題、細邊框、單據編號及狀態文字排列，保持長時間閱讀表格所需的清楚秩序。

繁體中文採系統無襯線字型，狀態保留文字標籤，數據和金額使用清楚的大小層級。元件以 Element Plus 為基礎，搭配原生欄位及自訂作業面板；不以額外裝飾取代作業內容。

**Key Characteristics:**

- 明亮工作底色、白色面板與深藍導覽。
- 青綠動作、具文字的語意狀態與可追蹤單據。
- 緊湊表格、柔和小圓角與清楚鍵盤焦點。

本文件為實作掃描紀錄。依據 `apps/web/src/style.css`、`App.vue`、`pages/Dashboard.vue`、`components/StateTag.vue` 及已安裝的 Element Plus 樣式；對照 `.impeccable/review/desktop.png` 與 `mobile.png`。截圖僅代表該次擷取畫面，不表示後續修改或所有互動均已驗證。

## Colors

色彩原值以上方 frontmatter 為準；CSS custom properties 是實作來源。

### Primary

- **營運青綠**（`accent`）：主要按鈕、文字連結、欄位 caret 與原生欄位焦點。
- **深海藍**（`nav`）：固定側欄及登入故事區；導覽 hover 與 selected 使用各自的深色層次。

### Neutral

- **工作底色**（`canvas`）承接白色 `surface`；`line` 分隔面板及工作區。
- **正文墨色**（`ink`）、**次要藍灰**（`muted`）與控制項 `regular` 區分標題、正文及輔助資訊。
- `field-border` 用於原生欄位；`control-border` 為 Element Plus 控制項邊框。
- `table-header` 與 `table-border` 提供表格列序；`row-hover` 提示可點擊待辦列。

### Semantic states

- `success`、`warning`、`danger`、`info` 對應 Element Plus 狀態。待審核與部分收貨使用 warning，已核准與已收貨使用 success。
- `attention-bg`、`attention-border`、`attention-ink` 組成營運提醒帶。
- `focus` 提供連結及原生按鈕的鍵盤 outline；Element Plus 按鈕保留套件自己的 focus 與狀態衍生變數。

## Typography

**Display Font / Body Font:** Segoe UI、Microsoft JhengHei、sans-serif 系統字型堆疊，無外載字型。

### Hierarchy

- **Display**：登入故事標題；沿用 frontmatter 的 display，在較窄螢幕依現有 media query 縮小。
- **Headline**：作業頁 h1；桌面使用 headline，1200px 以下為 24px，700px 以下為 23px。
- **Title**：面板 h2；行動版面板標題為 15px。
- **Body**：根字級使用 body；只有段落套用 paragraph 的行高，不將此行高推定成所有表格及控制項的共用值。
- **Label**：摘要標籤與表格內文；輔助資料常用 11px，頁首說明及待辦標題常用 13px。
- **Metric**：摘要數字使用 metric，金額為 24px；數字使用 `tabular-nums`。1200px 以下數字／金額為 25px／21px，700px 以下為 26px／20px。

## Layout

桌面採固定側欄（232px）與內容區。頂列高 78px，水平留白 36px；主要內容 padding 為 `32px 36px 24px`。摘要為四欄，欄內水平 padding 為 24px；待辦面板為等寬雙欄，欄距 22px。面板標頭 padding 為 `21px 24px 16px`，待辦列為 `14px 24px`、最小高度 74px。

- **1600px 以上**：主內容最大寬度 1600px，置中，頂部 padding 為 38px。
- **1200px 以下**：側欄縮為 210px，主要內容 padding 為 `25px 24px`，雙欄間距為 16px。
- **950px 以下**：摘要改為二欄、列距 25px；待辦面板改為單欄。
- **700px 以下**：側欄收起為滑入導覽，內容寬度 100%，頂列高 68px；主要內容 padding 為 `24px 16px`。頁首可換行，提醒帶改為直向。面板標頭 padding 為 `17px 16px 13px`，待辦列為 `14px 16px`。

表格保留欄位定義及元件的水平捲動，不將成本欄位改成不可讀的窄字。登入頁原為 `1.1fr 1fr` 雙欄，700px 以下改為單欄。文件明細採側邊 drawer，body padding 為 `5px 25px 30px`，行動版左右縮為 18px。

## Elevation & Depth

內容面板使用白底、細邊框及底色分層，靜止時不加陰影。行動導覽展開才出現側向陰影（`8px 0 28px #13364733`）；Element Plus drawer 與 overlay 沿用套件層級，專案明確取消 overlay 的 backdrop blur。

側欄滑入使用 `transform 0.18s ease-out`。`prefers-reduced-motion: reduce` 時停用 transition、animation 及平滑捲動。

## Shapes

圓角以小尺度區分用途：控制項、一般導覽使用 control；面板使用 panel；摘要帶使用 overview；提醒帶使用 attention；狀態標籤使用 tag。邊框通常為 1px 實線；頭像、狀態點及導覽步驟編號使用正圓。面板裁切溢出，表格自行提供水平捲動區。

## Components

### Buttons

Element Plus 按鈕提供主要、一般及 text 變體，尺寸與 padding 以 frontmatter 為準。主要動作用 primary，一般更新動作用白底描邊按鈕；loading 保留套件 spinner 及停用互動。hover、active、disabled、focus 使用實際 `--el-button-*` 與 `--el-color-*-light-*` 變數，不能只由 primary 原值推定衍生色。登入按鈕佔滿表單寬度，最小高度 45px。

### Chips

狀態元件採 Element Plus `effect="light"`、`size="small"`，保留狀態名稱。狀態 chip 是資訊，不是按鈕；不新增 hover 動作暗示。其底色及邊框由各狀態的 Element Plus light 變數提供。

### Cards / Containers

白底面板配 line 邊框與 panel 圓角，內部分隔列使用細線。摘要帶將多個數據放在同一個容器中並以直線分欄；狹窄時保持二欄。提醒帶以語意底色、邊框及完整句子陳述需處理事項。

### Inputs / Fields

原生 input、select、textarea 使用白底、field-border、control 圓角與 `10px 12px` padding，最小高度 42px；登入欄位最小高度 46px。焦點為 2px accent outline、offset 2px。表單有獨立 label；錯誤顯示於具 `role="alert"` 的文字區塊，保留重試或修正方式。

### Navigation

深藍側欄的連結以圖示搭配繁中名稱，項目間距 7px，padding 為 `12px 14px`；目前位置使用 nav-selected 底色與白字。行動導覽由頁首按鈕開啟，提供明確關閉按鈕；程式支援 Escape、Tab 循環與關閉後焦點回復，背景內容使用 inert。這些是 code 中已實作行為，需由 E2E 另行驗證。

### Document drawer and tables

單據 drawer 保留標題、狀態、資訊、歷程及下一步動作的順序。Element Plus 表格採 12px 內文、45px 表頭，cell padding 為 `0 19px`、行高 1.6，資料格垂直 padding 為 15px。金額欄靠右；預算使用 5px 高的進度條並同步顯示百分比，警示不只靠顏色傳達。

## Do's and Don'ts

### Do:

- **Do** 沿用深藍側欄、明亮工作底色與白色資料面板。
- **Do** 以繁中狀態文字、單據編號、數值與明確焦點支援辨識及鍵盤操作。
- **Do** 沿用既有 Element Plus 控制項及響應式斷點，保留表格水平捲動。

### Don't:

- **Don't** 把狀態簡化為只有色點或只有進度條。
- **Don't** 讓主要內容面板增加常駐裝飾陰影或 overlay 模糊效果。
- **Don't** 將未實測的畫面、互動或裝置宣稱已通過驗證。
