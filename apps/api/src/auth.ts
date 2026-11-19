import { Controller, Get, Post, Body, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { loginSchema } from '@opsflow/shared';
import { db } from './db.js';
import { AuthGuard, hashToken, verifyPassword, originCheck, type AuthRequest } from './security.js';
@ApiTags('認證')
@Controller('api/auth')
export class AuthController {
  @Post('login') @ApiOperation({summary:'以電子郵件與密碼建立 HttpOnly session'})
  @ApiBody({schema:{type:'object',required:['email','password'],properties:{email:{type:'string',format:'email'},password:{type:'string',format:'password'}}}})
  async login(@Body() body:unknown,@Req() req:AuthRequest,@Res({passthrough:true}) res:Response) {
    originCheck(req);const input=loginSchema.parse(body);
    const user=await db.user.findUnique({where:{email:input.email}});
    // Keep a real password derivation on unknown accounts to reduce account enumeration.
    const valid=await verifyPassword(input.password,user?.passwordHash??'00000000000000000000000000000000:'+ '00'.repeat(64));
    if(!user||!valid) {await db.auditLog.create({data:{action:'LOGIN_FAILED',entity:'Session',requestId:req.requestId,detail:{}}});throw new UnauthorizedException('帳號或密碼錯誤');}
    if(req.cookies?.opsflow_session)await db.session.deleteMany({where:{tokenHash:hashToken(String(req.cookies.opsflow_session))}});
    const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
    await db.session.create({data:{tokenHash:hashToken(token),userId:user.id,csrf,expiresAt:new Date(Date.now()+8*3600000)}});
    await db.auditLog.create({data:{actorId:user.id,action:'LOGIN',entity:'Session',requestId:req.requestId,detail:{}}});
    res.cookie('opsflow_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:8*3600000,path:'/'});
    return {user:{id:user.id,name:user.name,email:user.email,role:user.role,departmentId:user.departmentId},csrf};
  }
  @Get('me') @UseGuards(AuthGuard) @ApiOperation({summary:'讀取目前使用者及 CSRF token'})
  me(@Req() req:AuthRequest) {return {user:req.user,csrf:req.csrf};}
  @Post('logout') @UseGuards(AuthGuard) @ApiOperation({summary:'撤銷目前 session'})
  async logout(@Req() req:AuthRequest,@Res({passthrough:true}) res:Response) {await db.session.deleteMany({where:{tokenHash:hashToken(String(req.cookies.opsflow_session))}});res.clearCookie('opsflow_session',{path:'/'});return {ok:true};}
}
