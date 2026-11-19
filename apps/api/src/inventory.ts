import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query, Req, UseGuards, ConflictException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { receiptSchema,issueSchema,listSchema } from '@opsflow/shared';
import { db } from './db.js';
import { AuthGuard,permit,type AuthRequest } from './security.js';
import { audit,projectAccess,uniqueLines,idempotent } from './transactions.js';
@ApiTags('庫存交易') @Controller('api') @UseGuards(AuthGuard)
export class InventoryController {
  @Post('orders/:id/receipts') @ApiOperation({summary:'交易式部分收貨，重複請求 replay，防止超收'}) @ApiHeader({name:'Idempotency-Key',required:true})
  async receive(@Param('id',ParseIntPipe) id:number,@Body() body:unknown,@Headers('idempotency-key') key:unknown,@Req() req:AuthRequest) {
    permit(req.user,['ADMIN','WAREHOUSE']);const input=receiptSchema.parse(body);uniqueLines(input.lines.map(l=>l.lineId));
    return idempotent(req.user,key,`receipt:${id}`,input,async tx=>{
      await tx.$queryRaw`SELECT id FROM PurchaseOrder WHERE id=${id} FOR UPDATE`;
      const order=await tx.purchaseOrder.findUnique({where:{id},include:{lines:true}});if(!order)throw new NotFoundException('找不到採購單');
      if(order.status==='RECEIVED')throw new ConflictException('採購單已收齊');
      const receipt=await tx.receipt.create({data:{orderId:id,warehouseId:input.warehouseId,actorId:req.user.id}});
      // Lock the order before validating quantities; different keys still serialize on this PO.
      for(const line of [...input.lines].sort((a,b)=>a.lineId-b.lineId)) {
        const current=order.lines.find(l=>l.id===line.lineId);if(!current)throw new ConflictException('收貨明細不屬於此採購單');
        const changed=await tx.orderLine.updateMany({where:{id:line.lineId,receivedQty:{lte:current.quantity-line.quantity}},data:{receivedQty:{increment:line.quantity}}});if(!changed.count)throw new ConflictException('收貨數量超過待收數量');
        const receiptLine=await tx.receiptLine.create({data:{receiptId:receipt.id,orderLineId:line.lineId,quantity:line.quantity}});
        await tx.stock.upsert({where:{warehouseId_materialId:{warehouseId:input.warehouseId,materialId:current.materialId}},create:{warehouseId:input.warehouseId,materialId:current.materialId,quantity:line.quantity},update:{quantity:{increment:line.quantity}}});
        await tx.movement.create({data:{materialId:current.materialId,warehouseId:input.warehouseId,actorId:req.user.id,receiptLineId:receiptLine.id,kind:'IN',quantity:line.quantity,unitCostCents:current.unitCostCents,note:`採購 ${order.number} 收貨`}});
      }
      const remaining=await tx.orderLine.findMany({where:{orderId:id}});const complete=remaining.every(l=>l.receivedQty===l.quantity);
      const status=complete?'RECEIVED':'PARTIAL';await tx.purchaseOrder.update({where:{id},data:{status,completedAt:complete?new Date():null}});await audit(tx,req.user,req.requestId,'RECEIPT_CREATE',`Order:${id}`,{receiptId:receipt.id});return {id:receipt.id,orderId:id,status};
    });
  }
  @Post('issues') @ApiOperation({summary:'條件扣庫存與專案成本寫入同一交易'}) @ApiHeader({name:'Idempotency-Key',required:true})
  async issue(@Body() body:unknown,@Headers('idempotency-key') key:unknown,@Req() req:AuthRequest) {
    permit(req.user,['ADMIN','ENGINEER']);const input=issueSchema.parse(body);
    return idempotent(req.user,key,'issue',input,async tx=>{
      const project=await projectAccess(tx,req.user,input.projectId);if(project.status!=='ACTIVE')throw new ConflictException('只有進行中專案可領料');
      const material=await tx.material.findUnique({where:{id:input.materialId}});if(!material)throw new NotFoundException('找不到物料');
      const changed=await tx.stock.updateMany({where:{warehouseId:input.warehouseId,materialId:input.materialId,quantity:{gte:input.quantity}},data:{quantity:{decrement:input.quantity}}});if(!changed.count)throw new ConflictException('庫存不足，請重新查詢可用數量');
      const row=await tx.movement.create({data:{...input,actorId:req.user.id,kind:'OUT',unitCostCents:material.unitCostCents}});await audit(tx,req.user,req.requestId,'MATERIAL_ISSUE',`Movement:${row.id}`,{projectId:input.projectId,quantity:input.quantity});return {id:row.id,costCents:row.quantity*row.unitCostCents};
    });
  }
  @Get('inventory') @ApiOperation({summary:'庫存餘額與低庫存狀態'})
  async stocks(@Query() query:unknown) {
    const p=listSchema.parse(query);const where={material:{name:{contains:p.q}}};const [total,items]=await Promise.all([db.stock.count({where}),db.stock.findMany({where,include:{material:true,warehouse:true},skip:(p.page-1)*p.pageSize,take:p.pageSize,orderBy:[{materialId:p.sort},{warehouseId:'asc'}]})]);return {total,items,page:p.page,pageSize:p.pageSize};
  }
  @Get('movements') @ApiOperation({summary:'分頁追蹤入庫及專案領料帳'})
  async movements(@Query() query:unknown,@Req() req:AuthRequest) {
    const p=listSchema.parse(query);const where={note:{contains:p.q},...(req.user.role==='ENGINEER'?{OR:[{kind:'IN' as const},{project:{OR:[{ownerId:req.user.id},{members:{some:{userId:req.user.id}}}]}}]}:{})};const [total,items]=await Promise.all([db.movement.count({where}),db.movement.findMany({where,include:{material:true,warehouse:true,project:{select:{id:true,name:true}},actor:{select:{name:true}}},orderBy:{id:p.sort},skip:(p.page-1)*p.pageSize,take:p.pageSize})]);return {total,items,page:p.page,pageSize:p.pageSize};
  }
}
