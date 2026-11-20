# Data Dictionary

此表直接取自 prisma/schema.prisma；所有金額為 TWD 整數分，數量為整數，DateTime 儲存 UTC，介面以台北時間顯示。`?` 表示 nullable，`[]` 表示關聯集合。`@relation`、unique、索引與預設值照實保留。

業務含義：RequestLine 是請購價格快照；OrderLine.receivedQty 是已收累計；Stock 是倉庫／物料餘額；Movement 是不可由一般 API 編輯的入出庫帳；ReceiptLine 是收貨與 ledger 的連結；Approval 保存當次 submittedAt 以計算重送後的簽核耗時；Idempotency 保存 actor/scope/hash/result；AuditLog 不保存密碼或 Cookie。

## Department

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| name | String | @unique @db.VarChar(120) |
| users | User[] | — |

## User

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| email | String | @unique @db.VarChar(120) |
| name | String | @db.VarChar(120) |
| passwordHash | String | @db.VarChar(255) |
| role | Role | — |
| departmentId | Int | — |
| department | Department | @relation(fields:[departmentId],references:[id]) |
| sessions | Session[] | — |
| ownedProjects | Project[] | — |
| memberships | ProjectMember[] | — |
| requests | PurchaseRequest[] | — |
| approvals | Approval[] | — |
| receipts | Receipt[] | — |
| movements | Movement[] | — |
| audits | AuditLog[] | — |

## Session

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| tokenHash | String | @id @db.VarChar(64) |
| userId | Int | — |
| user | User | @relation(fields:[userId],references:[id],onDelete:Cascade) |
| csrf | String | @db.VarChar(64) |
| expiresAt | DateTime | — |

表級約束：`@@index([expiresAt])`

## Project

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| code | String | @unique @db.VarChar(40) |
| name | String | @db.VarChar(120) |
| budgetCents | Int | — |
| status | ProjectStatus | @default(ACTIVE) |
| ownerId | Int | — |
| owner | User | @relation(fields:[ownerId],references:[id]) |
| members | ProjectMember[] | — |
| requirements | Requirement[] | — |
| requests | PurchaseRequest[] | — |
| movements | Movement[] | — |
| createdAt | DateTime | @default(now()) |

## ProjectMember

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| projectId | Int | — |
| userId | Int | — |
| project | Project | @relation(fields:[projectId],references:[id],onDelete:Cascade) |
| user | User | @relation(fields:[userId],references:[id]) |

表級約束：`@@id([projectId,userId])`

## Requirement

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| projectId | Int | — |
| materialId | Int | — |
| quantity | Int | — |
| project | Project | @relation(fields:[projectId],references:[id],onDelete:Cascade) |
| material | Material | @relation(fields:[materialId],references:[id]) |

表級約束：`@@id([projectId,materialId])`

## Supplier

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| name | String | @unique @db.VarChar(120) |
| contact | String | @db.VarChar(120) |
| leadDays | Int | — |
| orders | PurchaseOrder[] | — |

## Material

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| sku | String | @unique @db.VarChar(120) |
| name | String | @db.VarChar(120) |
| unit | String | @db.VarChar(120) |
| unitCostCents | Int | — |
| reorderPoint | Int | @default(10) |
| origin | Origin | @default(SYNTHETIC) |
| sourceKey | String? | @db.VarChar(120) |
| stocks | Stock[] | — |
| requirements | Requirement[] | — |
| requestLines | RequestLine[] | — |
| orderLines | OrderLine[] | — |
| movements | Movement[] | — |

## Warehouse

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| name | String | @unique @db.VarChar(120) |
| stocks | Stock[] | — |
| receipts | Receipt[] | — |
| movements | Movement[] | — |

## Stock

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| warehouseId | Int | — |
| materialId | Int | — |
| quantity | Int | @default(0) |
| warehouse | Warehouse | @relation(fields:[warehouseId],references:[id]) |
| material | Material | @relation(fields:[materialId],references:[id]) |

表級約束：`@@id([warehouseId,materialId])`

## PurchaseRequest

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| number | String | @unique @db.VarChar(40) |
| title | String | @db.VarChar(120) |
| projectId | Int | — |
| project | Project | @relation(fields:[projectId],references:[id]) |
| requesterId | Int | — |
| requester | User | @relation(fields:[requesterId],references:[id]) |
| status | RequestStatus | @default(SUBMITTED) |
| submittedAt | DateTime | @default(now()) |
| lines | RequestLine[] | — |
| approvals | Approval[] | — |
| order | PurchaseOrder? | — |

表級約束：`@@index([status,submittedAt])`

## RequestLine

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| requestId | Int | — |
| request | PurchaseRequest | @relation(fields:[requestId],references:[id],onDelete:Cascade) |
| materialId | Int | — |
| material | Material | @relation(fields:[materialId],references:[id]) |
| quantity | Int | — |
| unitCostCents | Int | — |

表級約束：`@@unique([requestId,materialId])`

## Approval

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| requestId | Int | — |
| request | PurchaseRequest | @relation(fields:[requestId],references:[id]) |
| actorId | Int | — |
| actor | User | @relation(fields:[actorId],references:[id]) |
| decision | RequestStatus | — |
| comment | String | @db.VarChar(500) |
| submittedAt | DateTime | — |
| createdAt | DateTime | @default(now()) |

## PurchaseOrder

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| number | String | @unique @db.VarChar(40) |
| requestId | Int | @unique |
| request | PurchaseRequest | @relation(fields:[requestId],references:[id]) |
| supplierId | Int | — |
| supplier | Supplier | @relation(fields:[supplierId],references:[id]) |
| status | OrderStatus | @default(OPEN) |
| orderedAt | DateTime | @default(now()) |
| expectedAt | DateTime | — |
| completedAt | DateTime? | — |
| lines | OrderLine[] | — |
| receipts | Receipt[] | — |

表級約束：`@@index([status,expectedAt])`

## OrderLine

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| orderId | Int | — |
| order | PurchaseOrder | @relation(fields:[orderId],references:[id],onDelete:Cascade) |
| materialId | Int | — |
| material | Material | @relation(fields:[materialId],references:[id]) |
| quantity | Int | — |
| receivedQty | Int | @default(0) |
| unitCostCents | Int | — |
| receiptLines | ReceiptLine[] | — |

表級約束：`@@unique([orderId,materialId])`

## Receipt

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| orderId | Int | — |
| order | PurchaseOrder | @relation(fields:[orderId],references:[id]) |
| warehouseId | Int | — |
| warehouse | Warehouse | @relation(fields:[warehouseId],references:[id]) |
| actorId | Int | — |
| actor | User | @relation(fields:[actorId],references:[id]) |
| createdAt | DateTime | @default(now()) |
| lines | ReceiptLine[] | — |

## ReceiptLine

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| receiptId | Int | — |
| receipt | Receipt | @relation(fields:[receiptId],references:[id]) |
| orderLineId | Int | — |
| orderLine | OrderLine | @relation(fields:[orderLineId],references:[id]) |
| quantity | Int | — |
| movement | Movement? | — |

表級約束：`@@unique([receiptId,orderLineId])`

## Movement

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| materialId | Int | — |
| material | Material | @relation(fields:[materialId],references:[id]) |
| warehouseId | Int | — |
| warehouse | Warehouse | @relation(fields:[warehouseId],references:[id]) |
| projectId | Int? | — |
| project | Project? | @relation(fields:[projectId],references:[id]) |
| actorId | Int | — |
| actor | User | @relation(fields:[actorId],references:[id]) |
| receiptLineId | Int? | @unique |
| receiptLine | ReceiptLine? | @relation(fields:[receiptLineId],references:[id]) |
| kind | MovementKind | — |
| quantity | Int | — |
| unitCostCents | Int | — |
| note | String | @db.VarChar(200) |
| origin | Origin | @default(SYNTHETIC) |
| sourceKey | String? | @unique @db.VarChar(120) |
| createdAt | DateTime | @default(now()) |

表級約束：`@@index([projectId,createdAt])`；`@@index([materialId,warehouseId,createdAt])`

## Idempotency

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| key | String | @id @db.VarChar(120) |
| actorId | Int | — |
| scope | String | @db.VarChar(80) |
| hash | String | @db.VarChar(64) |
| result | Json? | — |
| createdAt | DateTime | @default(now()) |

## AuditLog

| 欄位 | Prisma 型別 | 約束／關聯 |
|---|---|---|
| id | Int | @id @default(autoincrement()) |
| actorId | Int? | — |
| actor | User? | @relation(fields:[actorId],references:[id]) |
| action | String | @db.VarChar(100) |
| entity | String | @db.VarChar(100) |
| requestId | String | @db.VarChar(64) |
| detail | Json | — |
| createdAt | DateTime | @default(now()) |

表級約束：`@@index([createdAt])`

## Enum Role

ADMIN、MANAGER、ENGINEER、BUYER、WAREHOUSE

## Enum ProjectStatus

PLANNED、ACTIVE、COMPLETED

## Enum RequestStatus

SUBMITTED、RETURNED、REJECTED、APPROVED、ORDERED

## Enum OrderStatus

OPEN、PARTIAL、RECEIVED

## Enum MovementKind

IN、OUT

## Enum Origin

SYNTHETIC、PUBLIC_DERIVED、TEST
