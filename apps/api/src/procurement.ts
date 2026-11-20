import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import {
  requestSchema,
  approvalSchema,
  orderSchema,
  listSchema,
} from "@opsflow/shared";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { AuthGuard, permit, type AuthRequest } from "./security.js";
import {
  audit,
  projectAccess,
  uniqueLines,
  amount,
  type Tx,
} from "./transactions.js";
const requestInclude = {
  project: { select: { id: true, name: true, code: true } },
  requester: { select: { id: true, name: true, departmentId: true } },
  lines: { include: { material: true } },
  approvals: { include: { actor: { select: { name: true } } } },
  order: { select: { id: true, number: true, status: true } },
} as const;
export const orderInclude = {
  supplier: true,
  request: {
    select: {
      id: true,
      number: true,
      projectId: true,
      project: { select: { id: true, name: true } },
    },
  },
  lines: { include: { material: true } },
  receipts: {
    include: {
      lines: true,
      actor: { select: { name: true } },
      warehouse: true,
    },
  },
} as const;
async function pricedLines(
  tx: Tx,
  lines: { materialId: number; quantity: number }[],
) {
  uniqueLines(lines.map((l) => l.materialId));
  const materials = await tx.material.findMany({
    where: { id: { in: lines.map((l) => l.materialId) } },
  });
  const result = lines.map((l) => {
    const m = materials.find((m) => m.id === l.materialId);
    if (!m) throw new NotFoundException("找不到物料");
    return { ...l, unitCostCents: m.unitCostCents };
  });
  amount(result);
  return result;
}
@ApiTags("請購簽核與採購")
@Controller("api")
@UseGuards(AuthGuard)
export class ProcurementController {
  @Get("requests")
  @ApiOperation({ summary: "請購查詢，工程師限可存取專案" })
  async requests(@Query() query: unknown, @Req() req: AuthRequest) {
    const p = listSchema.parse(query);
    const status = z
      .enum(["SUBMITTED", "RETURNED", "REJECTED", "APPROVED", "ORDERED"])
      .optional()
      .parse(p.status || undefined);
    const where = {
      ...(status ? { status } : {}),
      title: { contains: p.q },
      ...(req.user.role === "ENGINEER"
        ? {
            project: {
              OR: [
                { ownerId: req.user.id },
                { members: { some: { userId: req.user.id } } },
              ],
            },
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      db.purchaseRequest.count({ where }),
      db.purchaseRequest.findMany({
        where,
        orderBy: { id: p.sort },
        skip: (p.page - 1) * p.pageSize,
        take: p.pageSize,
        include: requestInclude,
      }),
    ]);
    return { total, items, page: p.page, pageSize: p.pageSize };
  }
  @Get("requests/:id")
  @ApiOperation({ summary: "完整請購單據及簽核歷程" })
  async request(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: AuthRequest,
  ) {
    const row = await db.purchaseRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    if (!row) throw new NotFoundException("找不到請購單");
    await projectAccess(db, req.user, row.projectId);
    return row;
  }
  @Post("requests")
  @ApiOperation({ summary: "工程師建立並送出請購" })
  async create(@Body() body: unknown, @Req() req: AuthRequest) {
    permit(req.user, ["ADMIN", "ENGINEER"]);
    const input = requestSchema.parse(body);
    return db.$transaction(async (tx) => {
      const p = await projectAccess(tx, req.user, input.projectId);
      if (p.status !== "ACTIVE")
        throw new ConflictException("只有進行中的專案可請購");
      const lines = await pricedLines(tx, input.lines);
      const row = await tx.purchaseRequest.create({
        data: {
          number: `REQ-${randomUUID().slice(0, 8).toUpperCase()}`,
          title: input.title,
          projectId: input.projectId,
          requesterId: req.user.id,
          lines: { create: lines },
        },
      });
      await audit(
        tx,
        req.user,
        req.requestId,
        "REQUEST_SUBMIT",
        `Request:${row.id}`,
      );
      return row;
    });
  }
  @Patch("requests/:id/resubmit")
  @ApiOperation({ summary: "申請人修改退回單並重新送審" })
  async resubmit(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    permit(req.user, ["ADMIN", "ENGINEER"]);
    const input = requestSchema.parse(body);
    return db.$transaction(async (tx) => {
      const p = await projectAccess(tx, req.user, input.projectId);
      if (p.status !== "ACTIVE") throw new ConflictException("專案未進行中");
      const row = await tx.purchaseRequest.findUnique({ where: { id } });
      if (!row) throw new NotFoundException("找不到請購單");
      if (row.requesterId !== req.user.id)
        throw new ForbiddenException("只有原申請人能重新送審");
      if (row.projectId !== input.projectId)
        throw new ConflictException("重新送審不能更換專案");
      const changed = await tx.purchaseRequest.updateMany({
        where: { id, status: "RETURNED" },
        data: {
          status: "SUBMITTED",
          title: input.title,
          submittedAt: new Date(),
        },
      });
      if (!changed.count)
        throw new ConflictException("只有退回的請購單可重新送審");
      const lines = await pricedLines(tx, input.lines);
      await tx.requestLine.deleteMany({ where: { requestId: id } });
      await tx.requestLine.createMany({
        data: lines.map((l) => ({ ...l, requestId: id })),
      });
      await audit(
        tx,
        req.user,
        req.requestId,
        "REQUEST_RESUBMIT",
        `Request:${id}`,
      );
      return { id, status: "SUBMITTED" };
    });
  }
  @Post("requests/:id/approval")
  @ApiOperation({ summary: "同部門主管簽核；禁止自我簽核與非法狀態轉換" })
  async approve(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    permit(req.user, ["ADMIN", "MANAGER"]);
    const input = approvalSchema.parse(body);
    return db.$transaction(
      async (tx) => {
        // Serialize approval with resubmission before reading the priced lines.
        await tx.$queryRaw`SELECT id FROM PurchaseRequest WHERE id=${id} FOR UPDATE`;
        const row = await tx.purchaseRequest.findUnique({
          where: { id },
          include: { lines: true, requester: true },
        });
        if (!row) throw new NotFoundException("找不到請購單");
        if (row.status !== "SUBMITTED")
          throw new ConflictException("此單已處理，只有待審核單可簽核");
        if (
          row.requesterId === req.user.id ||
          (req.user.role === "MANAGER" &&
            row.requester.departmentId !== req.user.departmentId)
        )
          throw new ForbiddenException("不可簽核自己的申請或其他部門的申請");
        await tx.$queryRaw`SELECT id FROM Project WHERE id=${row.projectId} FOR UPDATE`;
        const project = await projectAccess(tx, req.user, row.projectId);
        if (input.decision === "APPROVED") {
          if (project.status !== "ACTIVE")
            throw new ConflictException("專案未進行中");
          const requests = await tx.purchaseRequest.findMany({
            where: {
              projectId: row.projectId,
              status: { in: ["APPROVED", "ORDERED"] },
            },
            include: { lines: true },
          });
          if (
            requests.reduce((s, r) => s + amount(r.lines), 0) +
              amount(row.lines) >
            project.budgetCents
          )
            throw new ConflictException(
              "核准後將超過專案預算，請先調整預算或退回申請",
            );
        }
        const changed = await tx.purchaseRequest.updateMany({
          where: { id, status: "SUBMITTED" },
          data: { status: input.decision },
        });
        if (!changed.count)
          throw new ConflictException("此單已處理，只有待審核單可簽核");
        await tx.approval.create({
          data: {
            requestId: id,
            actorId: req.user.id,
            decision: input.decision,
            comment: input.comment,
            submittedAt: row.submittedAt,
          },
        });
        await audit(
          tx,
          req.user,
          req.requestId,
          `REQUEST_${input.decision}`,
          `Request:${id}`,
          { comment: input.comment },
        );
        return { id, status: input.decision };
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
  @Get("orders")
  @ApiOperation({ summary: "採購單、待收數量及收貨紀錄" })
  async orders(@Query() query: unknown, @Req() req: AuthRequest) {
    const p = listSchema.parse(query);
    const status = z
      .enum(["OPEN", "PARTIAL", "RECEIVED"])
      .optional()
      .parse(p.status || undefined);
    const where = {
      ...(status ? { status } : {}),
      number: { contains: p.q },
      ...(req.user.role === "ENGINEER"
        ? {
            request: {
              project: {
                OR: [
                  { ownerId: req.user.id },
                  { members: { some: { userId: req.user.id } } },
                ],
              },
            },
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      db.purchaseOrder.count({ where }),
      db.purchaseOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { id: p.sort },
        skip: (p.page - 1) * p.pageSize,
        take: p.pageSize,
      }),
    ]);
    return { total, items, page: p.page, pageSize: p.pageSize };
  }
  @Get("orders/:id")
  @ApiOperation({ summary: "追蹤採購及部分收貨" })
  async order(@Param("id", ParseIntPipe) id: number, @Req() req: AuthRequest) {
    const row = await db.purchaseOrder.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!row) throw new NotFoundException("找不到採購單");
    await projectAccess(db, req.user, row.request.projectId);
    return row;
  }
  @Post("orders")
  @ApiOperation({ summary: "由已核准請購建立唯一採購單" })
  async createOrder(@Body() body: unknown, @Req() req: AuthRequest) {
    permit(req.user, ["ADMIN", "BUYER"]);
    const input = orderSchema.parse(body);
    return db.$transaction(async (tx) => {
      const changed = await tx.purchaseRequest.updateMany({
        where: { id: input.requestId, status: "APPROVED" },
        data: { status: "ORDERED" },
      });
      if (!changed.count)
        throw new ConflictException("請購單必須已核准且尚未建立採購單");
      const lines = await tx.requestLine.findMany({
        where: { requestId: input.requestId },
      });
      const row = await tx.purchaseOrder.create({
        data: {
          ...input,
          expectedAt: new Date(input.expectedAt),
          number: `PO-${randomUUID().slice(0, 8).toUpperCase()}`,
          lines: {
            create: lines.map((l) => ({
              materialId: l.materialId,
              quantity: l.quantity,
              unitCostCents: l.unitCostCents,
            })),
          },
        },
      });
      await audit(
        tx,
        req.user,
        req.requestId,
        "ORDER_CREATE",
        `Order:${row.id}`,
      );
      return row;
    });
  }
}
