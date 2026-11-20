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
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import {
  projectSchema,
  supplierSchema,
  materialSchema,
  requirementSchema,
  listSchema,
} from "@opsflow/shared";
import { z } from "zod";
import { db, runtimeOrigin } from "./db.js";
import { AuthGuard, permit, type AuthRequest } from "./security.js";
import { audit, projectAccess } from "./transactions.js";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
@ApiTags("主檔與專案")
@Controller("api")
@UseGuards(AuthGuard)
export class ResourcesController {
  @Get("catalog")
  @ApiOperation({ summary: "角色可用的專案、物料、供應商、倉庫及同事選項" })
  async catalog(@Req() req: AuthRequest) {
    const [projects, materials, suppliers, warehouses, users] =
      await Promise.all([
        db.project.findMany({
          where:
            req.user.role === "ENGINEER"
              ? {
                  OR: [
                    { ownerId: req.user.id },
                    { members: { some: { userId: req.user.id } } },
                  ],
                }
              : {},
          orderBy: { id: "desc" },
          select: {
            id: true,
            code: true,
            name: true,
            budgetCents: true,
            status: true,
            ownerId: true,
            members: { select: { userId: true } },
          },
        }),
        db.material.findMany({ orderBy: { sku: "asc" }, take: 500 }),
        db.supplier.findMany({ orderBy: { name: "asc" } }),
        db.warehouse.findMany(),
        db.user.findMany({
          select: { id: true, name: true, role: true, departmentId: true },
        }),
      ]);
    return { projects, materials, suppliers, warehouses, users };
  }
  @Get("projects")
  @ApiOperation({ summary: "分頁查詢專案、預算承諾及實際成本" })
  async projects(@Query() query: unknown, @Req() req: AuthRequest) {
    const p = listSchema.parse(query);
    const filter = z
      .enum(["ACTIVE", "PLANNED", "COMPLETED"])
      .optional()
      .parse(p.status || undefined);
    const where = {
      ...(req.user.role === "ENGINEER"
        ? {
            OR: [
              { ownerId: req.user.id },
              { members: { some: { userId: req.user.id } } },
            ],
          }
        : {}),
      ...(filter ? { status: filter } : {}),
      name: { contains: p.q },
    };
    const [total, rows] = await Promise.all([
      db.project.count({ where }),
      db.project.findMany({
        where,
        skip: (p.page - 1) * p.pageSize,
        take: p.pageSize,
        orderBy: { id: p.sort },
        include: {
          owner: { select: { id: true, name: true } },
          members: { include: { user: { select: { id: true, name: true } } } },
          requirements: { include: { material: true } },
          requests: {
            where: { status: { in: ["APPROVED", "ORDERED"] } },
            include: { lines: true },
          },
        },
      }),
    ]);
    const costs = rows.length
      ? await db.$queryRaw<
          {
            projectId: number;
            actualCents: Prisma.Decimal;
            issuedQuantity: Prisma.Decimal;
          }[]
        >`SELECT projectId,SUM(quantity*unitCostCents) actualCents,SUM(quantity) issuedQuantity FROM Movement WHERE kind='OUT' AND projectId IN (${Prisma.join(rows.map((r) => r.id))}) GROUP BY projectId`
      : [];
    return {
      total,
      page: p.page,
      pageSize: p.pageSize,
      items: rows.map((r) => ({
        ...r,
        requests: undefined,
        committedCents: r.requests.reduce(
          (s, a) =>
            s + a.lines.reduce((v, l) => v + l.quantity * l.unitCostCents, 0),
          0,
        ),
        actualCents: Number(
          costs.find((c) => c.projectId === r.id)?.actualCents ?? 0,
        ),
        issuedQuantity: Number(
          costs.find((c) => c.projectId === r.id)?.issuedQuantity ?? 0,
        ),
      })),
    };
  }
  @Post("projects")
  @ApiOperation({ summary: "管理員或主管建立專案" })
  async createProject(@Body() body: unknown, @Req() req: AuthRequest) {
    permit(req.user, ["ADMIN", "MANAGER"]);
    const { memberIds, ...input } = projectSchema.parse(body);
    return db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ...input,
          code: `PRJ-${randomUUID().slice(0, 8).toUpperCase()}`,
          members: {
            create: [...new Set(memberIds)].map((userId) => ({ userId })),
          },
        },
      });
      await audit(
        tx,
        req.user,
        req.requestId,
        "PROJECT_CREATE",
        `Project:${project.id}`,
      );
      return project;
    });
  }
  @Patch("projects/:id")
  @ApiOperation({ summary: "更新專案，保護已核准承諾預算" })
  async updateProject(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    permit(req.user, ["ADMIN", "MANAGER"]);
    const { memberIds, ...input } = projectSchema.parse(body);
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM Project WHERE id=${id} FOR UPDATE`;
      await projectAccess(tx, req.user, id);
      const requests = await tx.purchaseRequest.findMany({
        where: { projectId: id, status: { in: ["APPROVED", "ORDERED"] } },
        include: { lines: true },
      });
      const committed = requests.reduce(
        (s, r) =>
          s + r.lines.reduce((v, l) => v + l.quantity * l.unitCostCents, 0),
        0,
      );
      if (input.budgetCents < committed)
        throw new ConflictException("預算不得低於已核准承諾金額");
      await tx.projectMember.deleteMany({ where: { projectId: id } });
      const project = await tx.project.update({
        where: { id },
        data: {
          ...input,
          members: {
            create: [...new Set(memberIds)].map((userId) => ({ userId })),
          },
        },
      });
      await audit(
        tx,
        req.user,
        req.requestId,
        "PROJECT_UPDATE",
        `Project:${id}`,
      );
      return project;
    });
  }
  @Post("projects/:id/requirements")
  @ApiOperation({ summary: "登錄專案物料需求" })
  async requirement(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    permit(req.user, ["ADMIN", "MANAGER", "ENGINEER"]);
    const input = requirementSchema.parse(body);
    return db.$transaction(async (tx) => {
      await projectAccess(tx, req.user, id);
      const result = await tx.requirement.upsert({
        where: {
          projectId_materialId: { projectId: id, materialId: input.materialId },
        },
        create: { projectId: id, ...input },
        update: { quantity: input.quantity },
      });
      await audit(
        tx,
        req.user,
        req.requestId,
        "REQUIREMENT_SET",
        `Project:${id}`,
        input,
      );
      return result;
    });
  }
  @Post("suppliers")
  @ApiOperation({ summary: "建立供應商" })
  async supplier(@Body() body: unknown, @Req() req: AuthRequest) {
    permit(req.user, ["ADMIN", "BUYER"]);
    const input = supplierSchema.parse(body);
    return db.$transaction(async (tx) => {
      const row = await tx.supplier.create({ data: input });
      await audit(
        tx,
        req.user,
        req.requestId,
        "SUPPLIER_CREATE",
        `Supplier:${row.id}`,
      );
      return row;
    });
  }
  @Patch("suppliers/:id")
  @ApiOperation({ summary: "修改供應商" })
  async updateSupplier(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    permit(req.user, ["ADMIN", "BUYER"]);
    const input = supplierSchema.parse(body);
    return db.$transaction(async (tx) => {
      const row = await tx.supplier.update({ where: { id }, data: input });
      await audit(
        tx,
        req.user,
        req.requestId,
        "SUPPLIER_UPDATE",
        `Supplier:${id}`,
      );
      return row;
    });
  }
  @Post("materials")
  @ApiOperation({ summary: "建立標準成本物料" })
  async material(@Body() body: unknown, @Req() req: AuthRequest) {
    permit(req.user, ["ADMIN", "WAREHOUSE"]);
    const input = materialSchema.parse(body);
    return db.$transaction(async (tx) => {
      const row = await tx.material.create({
        data: { ...input, origin: runtimeOrigin },
      });
      await audit(
        tx,
        req.user,
        req.requestId,
        "MATERIAL_CREATE",
        `Material:${row.id}`,
      );
      return row;
    });
  }
}
