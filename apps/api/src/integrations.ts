import { Body, Controller, Get, Post, Query, Req, Res, UseGuards, BadGatewayException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { z } from 'zod';
import type { Response } from 'express';
import { materialSchema } from '@opsflow/shared';
import { db } from './db.js';
import { audit } from './transactions.js';
import { AuthGuard,permit,type AuthRequest } from './security.js';
export function csvSafe(value:unknown) {const s=String(value??'');return /^[=+\-@\t\r\n]/.test(s)?`'${s}`:s;}
export async function supplierQuote(mode:string) {
  const url=new URL('/quote',process.env.SUPPLIER_API_URL??'http://127.0.0.1:3010');url.searchParams.set('mode',mode);
  for(let attempt=1;attempt<=2;attempt++) {
    try {const response=await fetch(url,{signal:AbortSignal.timeout(600),redirect:'error'});if(!response.ok){if(response.status>=500&&attempt<2)continue;throw new Error('SUPPLIER_ERROR');}const result=z.object({reference:z.string(),leadDays:z.number().int().min(0),available:z.boolean()}).parse(await response.json());return {...result,attempts:attempt};}catch{if(attempt===2)throw new BadGatewayException('模擬供應商無回應，已安全重試 2 次；未建立或修改採購單');}
  }
  throw new BadGatewayException('供應商無回應');
}
@ApiTags('CSV 與供應商整合') @Controller('api') @UseGuards(AuthGuard)
export class IntegrationsController {
  @Post('materials/import') @ApiOperation({summary:'原子匯入 CSV 物料主檔，最多 500 列'})
  async importMaterials(@Body() body:unknown,@Req() req:AuthRequest) {
    permit(req.user,['ADMIN','WAREHOUSE']);const {csv}=z.object({csv:z.string().min(1).max(150000)}).strict().parse(body);
    let rows:Record<string,string>[];
    try {rows=parse(csv,{columns:true,skip_empty_lines:true,bom:true,max_record_size:2048}) as Record<string,string>[];}catch{throw new BadRequestException('CSV 格式無法解析');}
    if(!rows.length||rows.length>500)throw new BadRequestException('CSV 必須包含 1–500 列');
    const data=rows.map(row=>materialSchema.parse({...row,unitCostCents:Number(row.unitCostCents),reorderPoint:Number(row.reorderPoint)}));
    if(new Set(data.map(m=>m.sku)).size!==data.length)throw new BadRequestException('CSV 有重複 SKU');
    return db.$transaction(async tx=>{await tx.material.createMany({data});await audit(tx,req.user,req.requestId,'MATERIAL_CSV_IMPORT','Material',{count:data.length});return {imported:data.length};});
  }
  @Get('materials/export') @ApiOperation({summary:'匯出防公式注入的物料 CSV'})
  async export(@Req() req:AuthRequest,@Res() res:Response) {permit(req.user,['ADMIN','WAREHOUSE','BUYER']);const rows=await db.material.findMany({orderBy:{id:'asc'}});const data=rows.map(m=>({sku:csvSafe(m.sku),name:csvSafe(m.name),unit:csvSafe(m.unit),unitCostCents:m.unitCostCents,reorderPoint:m.reorderPoint,origin:m.origin,sourceKey:csvSafe(m.sourceKey)}));res.setHeader('Content-Disposition','attachment; filename="materials.csv"');res.type('text/csv').send('\uFEFF'+stringify(data,{header:true}));}
  @Get('integrations/supplier-quote') @ApiOperation({summary:'對隔離模擬供應商 GET，timeout 600ms、最多兩次'})
  async quote(@Query() query:unknown,@Req() req:AuthRequest) {permit(req.user,['ADMIN','BUYER']);const {mode}=z.object({mode:z.enum(['success','timeout','error']).default('success')}).parse(query);if(process.env.NODE_ENV==='production'&&mode!=='success')throw new BadRequestException('正式模式不允許故障注入');const result=await supplierQuote(mode);await audit(db,req.user,req.requestId,'SUPPLIER_QUOTE','Integration',{mode,attempts:result.attempts});return result;}
}
