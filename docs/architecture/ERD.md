# 資料關聯

```mermaid
erDiagram
  Department ||--o{ User : contains
  User ||--o{ Session : authenticates
  User ||--o{ Project : owns
  Project ||--o{ ProjectMember : includes
  User ||--o{ ProjectMember : joins
  Project ||--o{ Requirement : requires
  Material ||--o{ Requirement : describes
  Project ||--o{ PurchaseRequest : requests
  User ||--o{ PurchaseRequest : submits
  PurchaseRequest ||--|{ RequestLine : contains
  Material ||--o{ RequestLine : references
  PurchaseRequest ||--o{ Approval : decisions
  User ||--o{ Approval : decides
  PurchaseRequest ||--o| PurchaseOrder : converts
  Supplier ||--o{ PurchaseOrder : supplies
  PurchaseOrder ||--|{ OrderLine : contains
  Material ||--o{ OrderLine : references
  PurchaseOrder ||--o{ Receipt : receives
  Receipt ||--|{ ReceiptLine : contains
  OrderLine ||--o{ ReceiptLine : fulfills
  ReceiptLine ||--|| Movement : posts
  Warehouse ||--o{ Stock : holds
  Material ||--o{ Stock : balances
  Material ||--o{ Movement : records
  Project ||--o{ Movement : consumes
  User ||--o{ AuditLog : acts
```

Request → PO 為 unique 1:0..1。Stock 的主鍵是 warehouseId + materialId。ReceiptLine → Movement 由 unique receiptLineId 保證單次入庫。Idempotency 以 client key 為主鍵，同時核對 actor、scope 與 payload hash。完整外鍵、索引及 enum 以 prisma/schema.prisma 為準；初始 Migration 是實際 MySQL DDL，並已套用。
