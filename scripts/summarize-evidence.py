"""Build delivery prose only from recorded test and benchmark evidence."""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def read(path):
    return json.loads((ROOT/path).read_text(encoding='utf-8-sig'))
def write(path, text):
    (ROOT/path).write_text(text, encoding='utf-8')

bench=read('docs/benchmarks/results.json')
baseline=read('docs/benchmarks/before-project-aggregation.json')
demo=read('docs/benchmarks/demo-kpis.json')
unit=read('docs/testing/unit-results.json')
integration=read('docs/testing/integration-results.json')
e2e=read('docs/testing/e2e-results.json')
ci=read('docs/testing/ci-result.json')
linux_unit=read('docs/testing/ci-artifacts/testing/unit-results.json')
linux_integration=read('docs/testing/ci-artifacts/testing/integration-results.json')
linux_e2e=read('docs/testing/ci-artifacts/testing/e2e-results.json')
linux_audit=read('docs/testing/ci-artifacts/testing/npm-audit.json')
linux_fault=read('docs/testing/ci-artifacts/maintenance/fault-results.json')
linux_backup=read('docs/testing/ci-artifacts/maintenance/backup-restore-results.json')
linux_docker=read('docs/testing/ci-artifacts/testing/docker-smoke.json')
assert ci['conclusion']=='success'
assert not bench['workingTreeDirty'] and bench['dataset']['counts']['movements']>=100000
assert bench['dataset']['counts']==baseline['dataset']['counts']
assert all(s['errors']==0 and s['samples']==120 for s in bench['api'])
assert unit['numFailedTests']==integration['numFailedTests']==linux_unit['numFailedTests']==linux_integration['numFailedTests']==0
assert e2e['exitCode']==linux_e2e['exitCode']==0
assert all(t['status']=='passed' for t in e2e['tests']+linux_e2e['tests'])
assert linux_backup['matched'] and linux_docker['browserLogin']
assert linux_fault['migration']['forwardFixExit']==0 and linux_fault['regression']['mutantExit']==1
assert linux_audit['metadata']['vulnerabilities']['total']==0
stamp=datetime.now(timezone.utc).isoformat()
ci_summary={'verifiedAt':stamp,'runUrl':ci['url'],'headSha':ci['headSha'],'conclusion':ci['conclusion'],'platform':linux_e2e['environment'],'unitPassed':linux_unit['numPassedTests'],'integrationPassed':linux_integration['numPassedTests'],'e2ePassed':len(linux_e2e['tests']),'auditVulnerabilities':0,'backupMatched':True,'dockerBrowserLogin':True,'migrationForwardFixExit':0,'intentionalRegressionFailureExit':1}
write('docs/testing/ci-artifact-summary.json',json.dumps(ci_summary,ensure_ascii=False,indent=2)+'\n')

table=['| API | 並行 | Avg ms | P50 | P95 | P99 | req/s | Error |','|---|---:|---:|---:|---:|---:|---:|---:|']
for item in bench['api']:
    table.append(f"| {item['path']} | {item['concurrency']} | {item['averageMs']:.2f} | {item['p50Ms']:.2f} | {item['p95Ms']:.2f} | {item['p99Ms']:.2f} | {item['throughputRps']:.2f} | {item['errorRate']:.1%} |")
api_table='\n'.join(table)
old=next(x for x in baseline['api'] if 'projects?' in x['path'] and x['concurrency']==16)
new=next(x for x in bench['api'] if 'projects?' in x['path'] and x['concurrency']==16)
reduction=(old['p95Ms']-new['p95Ms'])/old['p95Ms']*100
sql_before=bench['sql']['beforeIndex']
sql_after=bench['sql']['afterIndex']
business=read('docs/benchmarks/seed-business.json')
seed=read('docs/benchmarks/seed-benchmark.json')
results=f'''# Benchmark 實測結果

日期（UTC）：{bench['at']}。程式 Commit：`{bench['commit']}`，量測開始時 working tree clean。資料：{bench['dataset']['counts']['projects']} 專案、{bench['dataset']['counts']['orders']:,} PO、{bench['dataset']['counts']['movements']:,} 異動；品質檢查全部 0。Seed 設定：{json.dumps(bench['datasetSeed'],ensure_ascii=False)}。

環境：{bench['environment']['os']} {bench['environment']['release']}、{bench['environment']['cpu'].strip()}、{bench['environment']['logicalCpus']} logical CPUs、{bench['environment']['memoryBytes']/1024**3:.2f} GiB RAM、Node {bench['environment']['node']}、MySQL {bench['environment']['mysql'][0]['version']}（Docker {bench['environment']['docker']}）。API 與負載程序在 Windows 同機，DB 在 Docker Desktop。

## API

每情境 120 次、暖機 5 次、nearest-rank 分位數，共 {sum(x['samples'] for x in bench['api']):,} 個正式樣本，皆為 200。

{api_table}

## 實際查詢修正

Issue #12 的專案列表改為 SQL GROUP BY SUM。相同資料與腳本下，16 並行 P95：{old['p95Ms']:.2f} → {new['p95Ms']:.2f} ms；throughput：{old['throughputRps']:.2f} → {new['throughputRps']:.2f} req/s。兩次觀察的 P95 差異為 {reduction:.2f}%。原基準 Commit `{baseline['commit']}`，完整資料在 before-project-aggregation.json。

這不是隨機交錯或獨立負載主機的控制實驗；未修改的端點也有時間差，顯示主機／快取狀態會影響數據。因此不能把全部差異單獨歸因於這幾行 SQL，也不能當成跨環境的改善保證。回歸測試另外直接核對彙總成本與數量，確保沒有靠少算資料加速。

## SQL、分頁及生成

相同 Movement JOIN Project 查詢各 30 次：移除 composite index 時 Avg {sql_before['averageMs']:.3f} ms、P95 {sql_before['p95Ms']:.3f} ms；恢復 index 後 Avg {sql_after['averageMs']:.3f} ms、P95 {sql_after['p95Ms']:.3f} ms。EXPLAIN FORMAT=JSON 原文及 OFFSET 0／50,000／100,000 各 10 次測量在 results.json。DDL 僅在 opsflow_benchmark，最終索引已恢復。

Business 模式重置與生成實測 {business['durationMs']/1000:.3f} 秒；Benchmark 模式 {seed['durationMs']/1000:.3f} 秒。計時包含該模式全部資料建立及重置，沒有把它冒充純 100k ledger 插入吞吐；完整 counts 與零異常在 seed-business.json / seed-benchmark.json。

Consistency 來自實際 MySQL integration：8 同 Key 收貨只入庫一次、不同 Key 超收競爭只一人成功、12 人搶最後一件只一人成功、延後失敗會 rollback、簽核／重送競態被拒絕。這些是正確性結果，不以讀 API throughput 推論。

限制：短期 closed-loop、無信賴區間、無 soak、無網際網路或實機量測。k6 script 已提供，但本次數字均來自 Node harness，未宣稱已執行 k6。重現方式見 METHODOLOGY.md。
'''
write('docs/benchmarks/RESULTS.md',results)

u=unit['numPassedTests']; i=integration['numPassedTests']; e=len(e2e['tests'])
k=demo['kpis']
quant=f'''# 可量化結果

以下均為本作品實測或資料庫計算，非企業導入績效。

| 項目 | 實際結果 |
|---|---|
| 本機核心自動化案例 | Unit {u}/{u}、MySQL Integration {i}/{i}、Chromium E2E {e}/{e} |
| Ubuntu CI | {ci['conclusion']}，該次 artifact 為 Unit {linux_unit['numPassedTests']} / Integration {linux_integration['numPassedTests']} / E2E {len(linux_e2e['tests'])}，含 Docker smoke |
| Guided / Business / Benchmark | 5/30/60；50/1,000/706；50/1,000/100,706（專案/PO/異動） |
| 公開資料 | 讀取 541,909 列，匯入 100 個商品衍生目錄；交易匯入 0 |
| 一致性 | 同 Key 8 並行一次入庫；最後一件 12 並行一成功 |
| 專案列表後測（16 並行） | P95 {new['p95Ms']:.2f}ms、{new['throughputRps']:.2f}req/s、error 0% |
| SQL index 觀察 | Avg {sql_before['averageMs']:.3f}→{sql_after['averageMs']:.3f}ms，各 30 次 |
| Guided 平均核准時間 | {k['averageApprovalHours']:.2f} 小時（近 90 天口徑） |
| Guided 待審核／準時／部分收貨 | {k['pendingApprovals']} 件 / {k['onTimeDeliveryRate']:.1%} / {k['partialReceiptRate']:.1%} |
| Guided 逾期待收／實際領用 | TWD {k['overdueCents']/100:,.2f} / {k['actualCostCents']/100:,.2f} |

資料與日期在 demo-kpis.json、results.json、各測試摘要；測量限制及原基準在 RESULTS.md。截圖取自完成交易後的隔離 E2E DB，數字與初始化 Guided 快照可不同。周轉率未計算，因缺少期間平均庫存估值。
'''
write('docs/portfolio/QUANTIFIABLE_RESULTS.md',quant)

delivery=f'''# OpsFlow Mini ERP 交付報告

彙整時間（UTC）：{stamp}；使用者時區 Asia/Taipei，交付日 2026-11-20。

## Repository、版本與審查

- Private Repository：https://github.com/Cizing24/opsflow-mini-erp
- Branch：`feature/erp-core`；PR：https://github.com/Cizing24/opsflow-mini-erp/pull/10
- 核心程式與最後量測 Commit：`{bench['commit']}`。
- 已核對的成功 Ubuntu CI：[Run {ci['databaseId']}]({ci['url']})，head `{ci['headSha']}`。
- 後續文件／測試證據彙整會產生新 Commit；目前 PR head 與最新 checks 見 [PR checks](https://github.com/Cizing24/opsflow-mini-erp/pull/10/checks)，本報告不寫入無法自指的文件 Commit SHA。沒有合併 main 或部署 production。

## 已完成模組與架構

Vue 3 / TypeScript / Vite / Element Plus / Pinia + NestJS Modular Monolith + Prisma 7 / MariaDB adapter + MySQL 8.4。具專案預算／成員／需求、請購及重送、主管核准／退回／拒絕、唯一 PO、分批收貨、庫存帳與領料、Portal KPI／成本、CSV、OpenAPI、供應商模擬。Cookie、CSRF、RBAC、交易、Idempotency、rate limit、Audit 與 Request ID 在後端執行。

## 資料、角色與公開來源

五角色為 ADMIN、MANAGER、ENGINEER、BUYER、WAREHOUSE。本機 Guided：5 專案、38 請購、30 PO、20 收貨、60 異動；20 合成物料加 100 公開衍生物料，共 120。Business：50 專案、1,008 請購、1,000 PO、666 收貨、706 異動。Benchmark：同業務規模與 100,706 異動。固定 seed 與受控 reset，資料檢查零異常。

UCI Online Retail（Chen 2015，CC BY 4.0）實際讀 541,909 列，只取代碼與名稱，清洗後匯入 100 商品；TWD 成本為合成、客戶欄位及交易未匯入。WWI 已研究官方來源、格式與 MIT 說明，未匯入 SQL Server backup 或資料。詳 Data Sources / manifest / mapping / THIRD_PARTY_NOTICES。

## Business KPI 實際快照

近 90 天平均核准 {k['averageApprovalHours']:.2f} 小時；待審核 {k['pendingApprovals']}；準時到貨 {k['onTimeDeliveryRate']:.1%}；目前部分收貨 {k['partialReceiptRate']:.1%}；逾期待收 TWD {k['overdueCents']/100:,.2f}；專案實際領用 TWD {k['actualCostCents']/100:,.2f}；異常提醒 {k['anomalyCount']}。專案承諾與實際分開，不重複加總。周轉率明確 null。公式、範圍與排除條件在 KPI_DEFINITIONS.md。

## API、SQL 與並行實測

{api_table}

資料量 100,706；正式樣本 1,080 全部成功。專案列表 P95（16 並行）本次由 {old['p95Ms']:.2f} 降至 {new['p95Ms']:.2f}ms，保留前後版本與資料。SQL index 前後 Avg {sql_before['averageMs']:.3f}→{sql_after['averageMs']:.3f}ms；EXPLAIN、分頁、生成時間、硬體及限制見 benchmarks/RESULTS.md。不能將短測外推為 SLA，亦不宣稱全部差異只有 SQL 造成。

並行收貨、領料與 rollback 使用真實 HTTP／MySQL；同 Key 8 次只入庫一次、12 人搶最後一件只有一人成功。核准／重送競態有真實 RED/GREEN 證據。

## 測試、CI 與維護

本機 Unit {u}/{u}、Integration {i}/{i}、E2E {e}/{e}，共 {u+i+e} 個案例，未 skip。Lint、Typecheck、Build、Migration 已執行。已核對的 Ubuntu CI 快照為 Unit {linux_unit['numPassedTests']}、Integration {linux_integration['numPassedTests']}、E2E {len(linux_e2e['tests'])}；最新版本以 PR checks 為準。該次 npm audit 0、故障演練、備份與 Docker browser smoke 全部通過；artifact 已下載核對，摘要在 testing/ci-artifact-summary.json。刻意 mutant 的失敗不納入正式通過率。

真實問題有搜尋競爭、SKU 大小寫碰撞、簽核舊明細競態、CSV 空白／重複 header、workspace 路徑、全新 E2E DB 順序、parser Request ID、clean CI shared build 與登入逾時恢復；Issue／RCA／修復與回歸位置在 maintenance/REAL_BUG_RECORDS.md。六項 Simulation 與真實問題分開，沒有編造歷史事故。

## Docker 與操作

全新 opsflow-clean Volume 已實測自動 Migration、Seed、healthy、Chromium 登入及零異常資料檢查；完成後清理該專用副本。保留原資料的主 Demo 已更新並驗證於 http://localhost:3000 。

Windows 執行 `./scripts/init.ps1`；密碼在本機 .env 的 DEMO_PASSWORD。帳號為 admin / manager / engineer / buyer / warehouse 加 `@opsflow.test`，右上角登出切換。依「操作導覽」完成 10 件請購、核准、建 PO、收 4、領 1、查看成本。

## 文件與作品素材

README、REQUIREMENTS、PRODUCT_OVERVIEW、業務流程、架構、ERD、OpenAPI、ADR、Data Sources／Dictionary／Seed、KPI、Benchmark、Test Strategy／Regression Matrix、Runbook、RCA、Migration、Backup／Restore、中英作品摘要、技術重點及 Demo 指引均已建立。真實截圖在 docs/screenshots；設計系統與 UI 審查有獨立證據，ship 只涵蓋原兩項修正評分範圍。

## 限制與後續

單一企業／TWD／固定標準成本；未做總帳、稅、付款、庫存期間估值、SSO／帳號生命週期、異地備份排程或分散式 limiter。表單物料選項上限 500。本次沒有公開部署、實機手機、Safari／Firefox、螢幕閱讀器、完整滲透或長時間負載測試；k6 script 提供但未實跑。詳 KNOWN_LIMITATIONS.md。所有公司與業務數字是模擬，不能宣稱實際導入成效。
'''
write('docs/DELIVERY_REPORT.md',delivery)
print(json.dumps({'tests':u+i+e,'ci':ci['conclusion'],'benchmarkSamples':sum(x['samples'] for x in bench['api']),'projectP95ReductionObservedPercent':round(reduction,2),'reportsWritten':4},ensure_ascii=False))
