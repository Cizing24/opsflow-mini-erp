import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import type { UserView } from "@opsflow/shared";
import { db } from "./db.js";
export type Tx = Prisma.TransactionClient;
export function audit(
  tx: Tx,
  user: UserView,
  requestId: string,
  action: string,
  entity: string,
  detail: Prisma.InputJsonObject = {},
) {
  return tx.auditLog.create({
    data: { actorId: user.id, requestId, action, entity, detail },
  });
}
export async function projectAccess(tx: Tx, user: UserView, projectId: number) {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    include: { members: true },
  });
  if (!project) throw new NotFoundException("找不到專案");
  if (
    user.role === "ENGINEER" &&
    project.ownerId !== user.id &&
    !project.members.some((m) => m.userId === user.id)
  )
    throw new ForbiddenException("您不是此專案成員");
  return project;
}
export function uniqueLines(ids: number[]) {
  if (new Set(ids).size !== ids.length)
    throw new BadRequestException("同一張單據的物料不能重複");
}
export function amount(lines: { quantity: number; unitCostCents: number }[]) {
  const value = lines.reduce((sum, l) => sum + l.quantity * l.unitCostCents, 0);
  if (!Number.isSafeInteger(value) || value > 2_000_000_000)
    throw new BadRequestException("單據金額超過上限");
  return value;
}
export async function idempotent<T extends Prisma.InputJsonObject>(
  user: UserView,
  key: unknown,
  scope: string,
  body: unknown,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (typeof key !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(key))
    throw new BadRequestException("請提供 8–100 字元的 Idempotency-Key");
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const replay = async () => {
    const existing = await db.idempotency.findUnique({ where: { key } });
    if (!existing) return null;
    if (
      existing.actorId !== user.id ||
      existing.scope !== scope ||
      existing.hash !== hash
    )
      throw new ConflictException("此 Idempotency-Key 已用於不同請求");
    if (!existing.result)
      throw new ConflictException("請求處理中，請稍後以相同 Key 重試");
    return existing.result as T;
  };
  const found = await replay();
  if (found) return found;
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.idempotency.create({
          data: { key, actorId: user.id, scope, hash },
        });
        const result = await work(tx);
        await tx.idempotency.update({ where: { key }, data: { result } });
        return result;
      },
      { isolationLevel: "ReadCommitted", timeout: 15000 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const result = await replay();
      if (result) return result;
    }
    throw error;
  }
}
