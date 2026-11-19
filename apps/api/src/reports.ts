import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db.js";
import { AuthGuard, permit, type AuthRequest } from "./security.js";
import { listSchema } from "@opsflow/shared";
@ApiTags("工作台與報表")
@Controller("api")
@UseGuards(AuthGuard)
export class ReportsController {
  @Get("dashboard")
  @ApiOperation({ summary: "依角色計算工作台及近 90 天 KPI" })
  async dashboard(@Req() req: AuthRequest) {
    const now = new Date(),
      from = new Date(now.getTime() - 90 * 86400000);
    const projectWhere =
      req.user.role === "ENGINEER"
        ? {
            OR: [
              { ownerId: req.user.id },
              { members: { some: { userId: req.user.id } } },
            ],
          }
        : {};
    const projects = await db.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        code: true,
        budgetCents: true,
        status: true,
      },
    });
    const ids = projects.map((p) => p.id);
    const [requests, orders, approvals, stock, costs] = await Promise.all([
      db.purchaseRequest.findMany({
        where: { projectId: { in: ids } },
        include: { lines: true, requester: { select: { departmentId: true } } },
      }),
      db.purchaseOrder.findMany({
        where: { request: { projectId: { in: ids } } },
        include: {
          lines: true,
          request: { select: { projectId: true } },
          supplier: { select: { name: true } },
        },
      }),
      db.approval.findMany({
        where: {
          decision: "APPROVED",
          createdAt: { gte: from, lte: now },
          request: { projectId: { in: ids } },
        },
      }),
      db.stock.findMany({ include: { material: true, warehouse: true } }),
      ids.length
        ? db.$queryRaw<
            { projectId: number; cost: Prisma.Decimal }[]
          >`SELECT projectId,SUM(quantity*unitCostCents) cost FROM Movement WHERE kind='OUT' AND projectId IN (${Prisma.join(ids)}) GROUP BY projectId`
        : [],
    ]);
    const projectCosts = projects.map((p) => {
      const committedCents = requests
        .filter(
          (r) =>
            r.projectId === p.id && ["APPROVED", "ORDERED"].includes(r.status),
        )
        .reduce(
          (s, r) =>
            s + r.lines.reduce((v, l) => v + l.quantity * l.unitCostCents, 0),
          0,
        );
      return {
        ...p,
        committedCents,
        actualCents: Number(costs.find((c) => c.projectId === p.id)?.cost ?? 0),
        budgetUse: p.budgetCents ? committedCents / p.budgetCents : null,
      };
    });
    const overdue = orders.filter(
      (o) => o.expectedAt < now && o.status !== "RECEIVED",
    );
    const completed = orders.filter(
      (o) => o.completedAt && o.completedAt >= from && o.completedAt <= now,
    );
    const recent = orders.filter(
      (o) => o.orderedAt >= from && o.orderedAt <= now,
    );
    const pending = requests.filter((r) => r.status === "SUBMITTED");
    const myPending =
      req.user.role === "MANAGER"
        ? pending.filter(
            (r) =>
              r.requester.departmentId === req.user.departmentId &&
              r.requesterId !== req.user.id,
          )
        : req.user.role === "ENGINEER"
          ? pending.filter((r) => r.requesterId === req.user.id)
          : pending;
    const lowStock = stock.filter((s) => s.quantity < s.material.reorderPoint);
    return {
      company: "海嶼系統整合有限公司",
      asOf: now.toISOString(),
      from: from.toISOString(),
      kpis: {
        averageApprovalHours: approvals.length
          ? approvals.reduce(
              (s, a) =>
                s + (a.createdAt.getTime() - a.submittedAt.getTime()) / 3600000,
              0,
            ) / approvals.length
          : null,
        pendingApprovals: myPending.length,
        onTimeDeliveryRate: completed.length
          ? completed.filter((o) => o.completedAt! <= o.expectedAt).length /
            completed.length
          : null,
        partialReceiptRate: recent.length
          ? recent.filter((o) => o.status === "PARTIAL").length / recent.length
          : null,
        overdueCents: overdue.reduce(
          (s, o) =>
            s +
            o.lines.reduce(
              (v, l) => v + (l.quantity - l.receivedQty) * l.unitCostCents,
              0,
            ),
          0,
        ),
        actualCostCents: projectCosts.reduce((s, p) => s + p.actualCents, 0),
        inventoryTurnover: null,
        inventoryTurnoverReason:
          "尚無期初與期末庫存估值快照，無法計算期間平均庫存成本",
        anomalyCount:
          overdue.length +
          lowStock.length +
          projectCosts.filter((p) => (p.budgetUse ?? 0) >= 0.8).length,
      },
      projects: projectCosts,
      pendingRequests: myPending.slice(0, 8).map((r) => ({
        id: r.id,
        number: r.number,
        title: r.title,
        submittedAt: r.submittedAt,
      })),
      pendingOrders: orders
        .filter((o) => o.status !== "RECEIVED")
        .slice(0, 8)
        .map((o) => ({
          id: o.id,
          number: o.number,
          supplier: o.supplier.name,
          status: o.status,
          expectedAt: o.expectedAt,
        })),
      lowStock: lowStock.map((s) => ({
        materialId: s.materialId,
        name: s.material.name,
        warehouse: s.warehouse.name,
        quantity: s.quantity,
        reorderPoint: s.material.reorderPoint,
      })),
      budgetAlerts: projectCosts.filter((p) => (p.budgetUse ?? 0) >= 0.8),
    };
  }
  @Get("reports/costs")
  @ApiOperation({ summary: "管理者專案成本報表（可指定領料期間）" })
  async costs(@Query() query: unknown, @Req() req: AuthRequest) {
    permit(req.user, ["ADMIN", "MANAGER"]);
    const p = z
      .object({
        from: z.iso.datetime().optional(),
        to: z.iso.datetime().optional(),
      })
      .parse(query);
    const from = p.from ? new Date(p.from) : new Date("2000-01-01T00:00:00Z"),
      to = p.to ? new Date(p.to) : new Date();
    const rows = await db.$queryRaw<
      {
        id: number;
        code: string;
        name: string;
        budgetCents: number;
        actualCents: Prisma.Decimal;
      }[]
    >`SELECT p.id,p.code,p.name,p.budgetCents,COALESCE(SUM(m.quantity*m.unitCostCents),0) actualCents FROM Project p LEFT JOIN Movement m ON m.projectId=p.id AND m.kind='OUT' AND m.createdAt>=${from} AND m.createdAt<=${to} GROUP BY p.id ORDER BY p.id`;
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      items: rows.map((r) => ({ ...r, actualCents: Number(r.actualCents) })),
    };
  }
  @Get("audit")
  @ApiOperation({ summary: "管理員稽核軌跡" })
  async audit(@Query() query: unknown, @Req() req: AuthRequest) {
    permit(req.user, ["ADMIN"]);
    const p = listSchema.parse(query);
    const where = { action: { contains: p.q } };
    const [total, items] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        include: { actor: { select: { name: true } } },
        orderBy: { id: p.sort },
        take: p.pageSize,
        skip: (p.page - 1) * p.pageSize,
      }),
    ]);
    return { total, items, page: p.page, pageSize: p.pageSize };
  }
}
