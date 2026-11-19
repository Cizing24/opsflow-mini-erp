import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Catch,
  type ArgumentsHost,
  type ExceptionFilter,
  HttpException,
} from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import type { UserView, Role } from "@opsflow/shared";
import { db } from "./db.js";
const scrypt = promisify(scryptCallback);
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${((await scrypt(password, salt, 64)) as Buffer).toString("hex")}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const expected = Buffer.from(key, "hex");
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export interface AuthRequest extends Request {
  user: UserView;
  requestId: string;
  csrf: string;
}
export function permit(user: UserView, roles: Role[]) {
  if (!roles.includes(user.role))
    throw new ForbiddenException("此角色沒有執行此操作的權限");
}
export function originCheck(req: Request) {
  if (req.headers.origin !== process.env.APP_ORIGIN)
    throw new ForbiddenException("來源驗證失敗，請從系統頁面重試");
}
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.cookies?.opsflow_session as unknown;
    if (typeof token !== "string" || token.length > 128)
      throw new UnauthorizedException("請先登入");
    const session = await db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departmentId: true,
          },
        },
      },
    });
    if (!session || session.expiresAt < new Date())
      throw new UnauthorizedException("登入已逾時，請重新登入");
    req.user = session.user;
    req.csrf = session.csrf;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      originCheck(req);
      const csrf = req.headers["x-csrf-token"];
      if (typeof csrf !== "string" || csrf !== session.csrf)
        throw new ForbiddenException("安全驗證失敗，請重新登入");
    }
    return true;
  }
}
const windows = new Map<string, { count: number; expires: number }>();
export function requestMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const request = req as AuthRequest;
  request.requestId = randomUUID();
  res.setHeader("X-Request-ID", request.requestId);
  const started = performance.now();
  res.on("finish", () =>
    console.log(
      JSON.stringify({
        level: res.statusCode >= 500 ? "error" : "info",
        requestId: request.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(performance.now() - started),
        actorId: request.user?.id,
      }),
    ),
  );
  const now = Date.now();
  if (windows.size > 10000)
    for (const [key, value] of windows)
      if (value.expires < now) windows.delete(key);
  const isLogin =
    req.path.toLowerCase().replace(/\/+$/, "") === "/api/auth/login";
  const key = `${req.ip}:${isLogin ? "login" : "api"}`;
  const window = windows.get(key);
  const current =
    !window || window.expires < now
      ? { count: 0, expires: now + 60000 }
      : window;
  current.count++;
  windows.set(key, current);
  if (current.count > (isLogin ? 15 : 2000)) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({
      error: {
        code: "RATE_LIMIT",
        message: "操作過於頻繁，請稍後重試",
        requestId: request.requestId,
      },
    });
    return;
  }
  next();
}
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const req = host.switchToHttp().getRequest<AuthRequest>();
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500,
      message = "系統暫時無法處理，請提供追蹤編號聯絡管理員",
      code = "INTERNAL_ERROR";
    if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.message;
      code = `HTTP_${status}`;
    } else if (error instanceof ZodError) {
      status = 400;
      message = error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("；");
      code = "VALIDATION_ERROR";
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        status = 409;
        message = "資料已存在或請求重複";
        code = "CONFLICT";
      } else if (["P2003", "P2025"].includes(error.code)) {
        status = 400;
        message = "參照的資料不存在或仍被使用";
        code = "REFERENCE_ERROR";
      }
    }
    if (status === 500)
      console.error(
        JSON.stringify({
          level: "error",
          requestId: req.requestId,
          errorType:
            error instanceof Error ? error.constructor.name : "Unknown",
        }),
      );
    res
      .status(status)
      .json({ error: { code, message, requestId: req.requestId } });
  }
}
