import type { PrismaClient } from '@prisma/client';
export async function validateData(client:PrismaClient) {
  const scalar=async(sql:TemplateStringsArray)=>{const result=await client.$queryRaw<{n:bigint}[]>(sql);return Number(result[0].n);};
  const issues={
    negativeStock:await client.stock.count({where:{quantity:{lt:0}}}),
    stockLedgerMismatch:await scalar`SELECT COUNT(*) n FROM Stock s LEFT JOIN (SELECT materialId,warehouseId,SUM(CASE WHEN kind='IN' THEN quantity ELSE -quantity END) balance FROM Movement GROUP BY materialId,warehouseId) m ON m.materialId=s.materialId AND m.warehouseId=s.warehouseId WHERE s.quantity<>COALESCE(m.balance,0)`,
    missingStock:await scalar`SELECT COUNT(*) n FROM (SELECT materialId,warehouseId FROM Movement GROUP BY materialId,warehouseId) m LEFT JOIN Stock s ON s.materialId=m.materialId AND s.warehouseId=m.warehouseId WHERE s.materialId IS NULL`,
    receiptMismatch:await scalar`SELECT COUNT(*) n FROM OrderLine l LEFT JOIN (SELECT orderLineId,SUM(quantity) qty FROM ReceiptLine GROUP BY orderLineId) r ON r.orderLineId=l.id WHERE l.receivedQty<>COALESCE(r.qty,0) OR l.receivedQty>l.quantity`,
    movementMismatch:await scalar`SELECT COUNT(*) n FROM ReceiptLine r LEFT JOIN Movement m ON m.receiptLineId=r.id WHERE m.id IS NULL OR m.quantity<>r.quantity OR m.kind<>'IN'`,
    stateMismatch:await scalar`SELECT COUNT(*) n FROM PurchaseOrder o WHERE (o.status='RECEIVED' AND EXISTS (SELECT 1 FROM OrderLine l WHERE l.orderId=o.id AND l.receivedQty<>l.quantity)) OR (o.status='OPEN' AND EXISTS (SELECT 1 FROM OrderLine l WHERE l.orderId=o.id AND l.receivedQty>0)) OR (o.status='PARTIAL' AND (NOT EXISTS (SELECT 1 FROM OrderLine l WHERE l.orderId=o.id AND l.receivedQty>0) OR NOT EXISTS (SELECT 1 FROM OrderLine l WHERE l.orderId=o.id AND l.receivedQty<l.quantity)))`,
    approvalOrderMismatch:await scalar`SELECT COUNT(*) n FROM PurchaseOrder o JOIN PurchaseRequest r ON r.id=o.requestId WHERE r.status<>'ORDERED'`,
    negativeQuantity:await scalar`SELECT COUNT(*) n FROM Movement WHERE quantity<=0 OR unitCostCents<0`
  };
  if(Object.values(issues).some(n=>n!==0))throw new Error(`Data integrity failed: ${JSON.stringify(issues)}`);
  return {issues,counts:{projects:await client.project.count(),users:await client.user.count(),materials:await client.material.count(),requests:await client.purchaseRequest.count(),orders:await client.purchaseOrder.count(),receipts:await client.receipt.count(),movements:await client.movement.count()}};
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/scripts/data-check.ts')){const {db}=await import('../apps/api/src/db.js');try{console.log(JSON.stringify(await validateData(db),null,2));}finally{await db.$disconnect();}}
