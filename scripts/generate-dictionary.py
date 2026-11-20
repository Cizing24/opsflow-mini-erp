"""Generate the schema field inventory from the owning Prisma schema."""
import re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
schema=(root/'prisma/schema.prisma').read_text(encoding='utf-8')
models=re.findall(r'^model (\w+) \{(.*?)^\}',schema,re.M|re.S)
assert len(models)>=20
lines=['# Data Dictionary','','此表直接取自 prisma/schema.prisma；所有金額為 TWD 整數分，數量為整數，DateTime 儲存 UTC，介面以台北時間顯示。`?` 表示 nullable，`[]` 表示關聯集合。`@relation`、unique、索引與預設值照實保留。','','業務含義：RequestLine 是請購價格快照；OrderLine.receivedQty 是已收累計；Stock 是倉庫／物料餘額；Movement 是不可由一般 API 編輯的入出庫帳；ReceiptLine 是收貨與 ledger 的連結；Approval 保存當次 submittedAt 以計算重送後的簽核耗時；Idempotency 保存 actor/scope/hash/result；AuditLog 不保存密碼或 Cookie。']
for name,body in models:
    lines += ['',f'## {name}','','| 欄位 | Prisma 型別 | 約束／關聯 |','|---|---|---|']
    for row in body.splitlines():
        field=re.match(r'\s*(\w+)\s+([\w\[\]?]+)\s*(.*)',row)
        if field and not row.strip().startswith('//'):
            column,kind,attributes=field.groups()
            lines.append(f'| {column} | {kind} | {attributes.replace(chr(124),chr(92)+chr(124)) or "—"} |')
    indexes=[row.strip() for row in body.splitlines() if row.strip().startswith('@@')]
    if indexes: lines += ['', '表級約束：'+ '；'.join(f'`{value}`' for value in indexes)]
for name,body in re.findall(r'^enum (\w+) \{(.*?)^\}',schema,re.M|re.S):
    lines += ['',f'## Enum {name}','','、'.join(body.split())]
(root/'docs/data-sources/DATA_DICTIONARY.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(f'Generated dictionary for {len(models)} models')
