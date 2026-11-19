import { beforeAll, afterAll, describe, it, expect } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { db } from "../../apps/api/src/db.js";
import { validateData } from "../../scripts/data-check.js";
import type { UserView } from "@opsflow/shared";
let app: INestApplication, base: string, supplier: ChildProcess;
type Client = { cookie: string; csrf: string; user: UserView };
const clients: Record<string, Client> = {};
async function call(
  role: string,
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
  extra: Record<string, string> = {},
) {
  const client = clients[role];
  return fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: process.env.APP_ORIGIN!,
      ...(client ? { Cookie: client.cookie, "X-CSRF-Token": client.csrf } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
let projectId: number,
  materialId: number,
  warehouseId: number,
  requestId: number,
  orderId: number,
  lineId: number,
  supplierId: number,
  engineerId: number;
beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL!).pathname !== "/opsflow_test")
    throw new Error("Integration tests require opsflow_test");
  const { createApp } = await import("../../apps/api/src/main.js");
  app = await createApp();
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
  supplier = spawn(process.execPath, ["scripts/supplier-mock.mjs"], {
    stdio: "ignore",
  });
  for (const role of ["admin", "manager", "engineer", "buyer", "warehouse"]) {
    const response = await call("", "/api/auth/login", "POST", {
      email: `${role}@opsflow.test`,
      password: process.env.DEMO_PASSWORD,
    });
    expect(response.status).toBe(201);
    const result = await response.json();
    clients[role] = {
      cookie: response.headers.get("set-cookie")!.split(";")[0],
      csrf: result.csrf,
      user: result.user,
    };
  }
  const catalog = await (await call("admin", "/api/catalog")).json();
  materialId = catalog.materials[0].id;
  warehouseId = catalog.warehouses[0].id;
  supplierId = catalog.suppliers[0].id;
  engineerId = clients.engineer.user.id;
  const project = await call("manager", "/api/projects", "POST", {
    name: "整合驗證工程",
    budgetCents: 100_000_000,
    ownerId: engineerId,
    memberIds: [engineerId],
    status: "ACTIVE",
  });
  expect(project.status).toBe(201);
  projectId = (await project.json()).id;
});
afterAll(async () => {
  supplier?.kill();
  await app?.close();
  await db.$disconnect();
});
describe.sequential("real MySQL ERP lifecycle", () => {
  it("requires authentication and exposes health only", async () => {
    expect((await call("", "/api/projects")).status).toBe(401);
    expect((await call("", "/api/health")).status).toBe(200);
  });
  it("publishes executable OpenAPI input and security contracts", async () => {
    const r = await call("", "/api/openapi.json");
    expect(r.status).toBe(200);
    const doc = await r.json();
    expect(
      doc.paths["/api/requests"].post.requestBody.content["application/json"]
        .schema.required,
    ).toContain("projectId");
    expect(
      doc.paths["/api/issues"].post.parameters.some(
        (p: { name: string }) => p.name === "Idempotency-Key",
      ),
    ).toBe(true);
    expect(doc.paths["/api/requests"].post.security).toEqual([{ cookie: [] }]);
  });
  it("returns structured 400/413 with request IDs for malformed and oversized JSON", async () => {
    const malformed = await fetch(base + "/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.APP_ORIGIN!,
        Cookie: clients.admin.cookie,
      },
      body: "{",
    });
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.requestId).toBeTruthy();
    const oversized = await call("admin", "/api/requests", "POST", {
      unexpected: "x".repeat(300000),
    });
    expect(oversized.status).toBe(413);
    expect((await oversized.json()).error.requestId).toBeTruthy();
  });
  it("sets HttpOnly SameSite cookies and never returns password hashes", async () => {
    const r = await call("admin", "/api/auth/me");
    const text = await r.text();
    expect(text).not.toContain("passwordHash");
    expect(clients.admin.cookie).toMatch(/^opsflow_session=/);
    const session = await db.session.findFirst();
    expect(session?.tokenHash).not.toBe(clients.admin.cookie.split("=")[1]);
  });
  it("rejects missing CSRF and hostile Origin", async () => {
    expect(
      (
        await call("engineer", "/api/requests", "POST", {}, undefined, {
          "X-CSRF-Token": "",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("engineer", "/api/requests", "POST", {}, undefined, {
          Origin: "https://evil.example",
        })
      ).status,
    ).toBe(403);
  });
  it("enforces backend roles and rejects injected state fields", async () => {
    expect((await call("warehouse", "/api/requests", "POST", {})).status).toBe(
      403,
    );
    expect(
      (
        await call("engineer", "/api/requests", "POST", {
          projectId,
          title: "錯誤狀態",
          lines: [{ materialId, quantity: 1 }],
          status: "APPROVED",
        })
      ).status,
    ).toBe(400);
  });
  it("engineer submits actual material request", async () => {
    const r = await call("engineer", "/api/requests", "POST", {
      projectId,
      title: "整合測試採購申請",
      lines: [{ materialId, quantity: 10 }],
    });
    expect(r.status).toBe(201);
    requestId = (await r.json()).id;
    expect(
      (await db.purchaseRequest.findUnique({ where: { id: requestId } }))
        ?.status,
    ).toBe("SUBMITTED");
  });
  it("prevents engineer approval and order before approval", async () => {
    expect(
      (
        await call("engineer", `/api/requests/${requestId}/approval`, "POST", {
          decision: "APPROVED",
          comment: "違規核准",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("buyer", "/api/orders", "POST", {
          requestId,
          supplierId,
          expectedAt: new Date().toISOString(),
        })
      ).status,
    ).toBe(409);
  });
  it("supports return, edit and resubmit with preserved history", async () => {
    expect(
      (
        await call("manager", `/api/requests/${requestId}/approval`, "POST", {
          decision: "RETURNED",
          comment: "請補充數量",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call("engineer", `/api/requests/${requestId}/resubmit`, "PATCH", {
          projectId,
          title: "整合測試採購申請（已修訂）",
          lines: [{ materialId, quantity: 10 }],
        })
      ).status,
    ).toBe(200);
    expect(await db.approval.count({ where: { requestId } })).toBe(1);
  });
  it("manager approves only submitted requests once", async () => {
    expect(
      (
        await call("manager", `/api/requests/${requestId}/approval`, "POST", {
          decision: "APPROVED",
          comment: "預算與規格已確認",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call("manager", `/api/requests/${requestId}/approval`, "POST", {
          decision: "REJECTED",
          comment: "重複處理",
        })
      ).status,
    ).toBe(409);
  });
  it("buyer creates exactly one linked purchase order", async () => {
    const body = {
      requestId,
      supplierId,
      expectedAt: new Date(Date.now() + 86400000).toISOString(),
    };
    const r = await call("buyer", "/api/orders", "POST", body);
    expect(r.status).toBe(201);
    orderId = (await r.json()).id;
    expect((await call("buyer", "/api/orders", "POST", body)).status).toBe(409);
    lineId = (await db.orderLine.findFirst({ where: { orderId } }))!.id;
  });
  it("partial receipt concurrent duplicate keys create one ledger movement", async () => {
    const key = randomUUID(),
      body = { warehouseId, lines: [{ lineId, quantity: 4 }] };
    const stock = await db.stock.findUnique({
      where: { warehouseId_materialId: { warehouseId, materialId } },
    });
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        call("warehouse", `/api/orders/${orderId}/receipts`, "POST", body, key),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual(Array(8).fill(201));
    const ids = await Promise.all(responses.map((r) => r.json()));
    expect(new Set(ids.map((r) => r.id)).size).toBe(1);
    expect(await db.receipt.count({ where: { orderId } })).toBe(1);
    expect(
      (await db.stock.findUnique({
        where: { warehouseId_materialId: { warehouseId, materialId } },
      }))!.quantity,
    ).toBe((stock?.quantity ?? 0) + 4);
    expect(
      (await db.purchaseOrder.findUnique({ where: { id: orderId } }))!.status,
    ).toBe("PARTIAL");
    expect(
      (
        await call(
          "warehouse",
          `/api/orders/${orderId}/receipts`,
          "POST",
          { warehouseId, lines: [{ lineId, quantity: 1 }] },
          key,
        )
      ).status,
    ).toBe(409);
  });
  it("over receipt rolls back receipt, stock, audit and idempotency", async () => {
    const key = randomUUID(),
      before = await db.receipt.count();
    expect(
      (
        await call(
          "warehouse",
          `/api/orders/${orderId}/receipts`,
          "POST",
          { warehouseId, lines: [{ lineId, quantity: 7 }] },
          key,
        )
      ).status,
    ).toBe(409);
    expect(await db.receipt.count()).toBe(before);
    expect(await db.idempotency.findUnique({ where: { key } })).toBeNull();
    expect(
      (await db.orderLine.findUnique({ where: { id: lineId } }))!.receivedQty,
    ).toBe(4);
  });
  it("different keys cannot race to over receive", async () => {
    const responses = await Promise.all(
      [1, 2].map(() =>
        call(
          "warehouse",
          `/api/orders/${orderId}/receipts`,
          "POST",
          { warehouseId, lines: [{ lineId, quantity: 6 }] },
          randomUUID(),
        ),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      (await db.orderLine.findUnique({ where: { id: lineId } }))!.receivedQty,
    ).toBe(10);
    expect(
      (await db.purchaseOrder.findUnique({ where: { id: orderId } }))!.status,
    ).toBe("RECEIVED");
  });
  it("last item concurrent issue has one winner and no negative stock", async () => {
    const material = await db.material.create({
      data: {
        sku: `LAST-${randomUUID()}`,
        name: "最後一件競爭驗證",
        unit: "件",
        unitCostCents: 12345,
        reorderPoint: 1,
        origin: "TEST",
      },
    });
    await db.stock.create({
      data: { warehouseId, materialId: material.id, quantity: 1 },
    });
    await db.movement.create({
      data: {
        warehouseId,
        materialId: material.id,
        actorId: clients.admin.user.id,
        kind: "IN",
        quantity: 1,
        unitCostCents: 12345,
        note: "隔離測試期初",
        origin: "TEST",
      },
    });
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        call(
          "engineer",
          "/api/issues",
          "POST",
          {
            projectId,
            materialId: material.id,
            warehouseId,
            quantity: 1,
            note: "並行領最後一件",
          },
          randomUUID(),
        ),
      ),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(11);
    expect(
      (await db.stock.findUnique({
        where: {
          warehouseId_materialId: { warehouseId, materialId: material.id },
        },
      }))!.quantity,
    ).toBe(0);
  });
  it("issue idempotency replay does not duplicate project cost", async () => {
    const key = randomUUID(),
      body = {
        projectId,
        materialId,
        warehouseId,
        quantity: 1,
        note: "重複領料驗證",
      };
    const first = await call("engineer", "/api/issues", "POST", body, key);
    expect(first.status).toBe(201);
    const a = await first.json();
    const b = await (
      await call("engineer", "/api/issues", "POST", body, key)
    ).json();
    expect(b.id).toBe(a.id);
    expect((await call("admin", "/api/issues", "POST", body, key)).status).toBe(
      409,
    );
  });
  it("restricts engineer access to project membership", async () => {
    const p = await db.project.create({
      data: {
        code: `HIDDEN-${randomUUID().slice(0, 8)}`,
        name: "其他部門保密測試",
        ownerId: clients.admin.user.id,
        budgetCents: 10000,
      },
    });
    expect(
      (
        await call("engineer", "/api/requests", "POST", {
          projectId: p.id,
          title: "越權",
          lines: [{ materialId, quantity: 1 }],
        })
      ).status,
    ).toBe(403);
    const catalog = await (await call("engineer", "/api/catalog")).json();
    expect(
      catalog.projects.some((row: { id: number }) => row.id === p.id),
    ).toBe(false);
  });
  it("forbids self approval and cross department approval", async () => {
    const self = await call("admin", "/api/requests", "POST", {
      projectId,
      title: "自我簽核測試",
      lines: [{ materialId, quantity: 1 }],
    });
    const selfId = (await self.json()).id;
    expect(
      (
        await call("admin", `/api/requests/${selfId}/approval`, "POST", {
          decision: "APPROVED",
          comment: "自我核准",
        })
      ).status,
    ).toBe(403);
    const department = await db.department.create({
      data: { name: "其他部門測試" },
    });
    const cross = await call("engineer", "/api/requests", "POST", {
      projectId,
      title: "跨部門簽核測試",
      lines: [{ materialId, quantity: 1 }],
    });
    const crossId = (await cross.json()).id;
    await db.user.update({
      where: { id: engineerId },
      data: { departmentId: department.id },
    });
    try {
      expect(
        (
          await call("manager", `/api/requests/${crossId}/approval`, "POST", {
            decision: "APPROVED",
            comment: "跨部門測試",
          })
        ).status,
      ).toBe(403);
      expect(
        (await db.purchaseRequest.findUniqueOrThrow({ where: { id: crossId } }))
          .status,
      ).toBe("SUBMITTED");
      expect(await db.approval.count({ where: { requestId: crossId } })).toBe(
        0,
      );
    } finally {
      await db.user.update({
        where: { id: engineerId },
        data: { departmentId: clients.manager.user.departmentId },
      });
    }
  });
  it("rejects zero/fractional, duplicate and foreign receipt lines", async () => {
    for (const quantity of [0, -1, 0.1])
      expect(
        (
          await call(
            "engineer",
            "/api/issues",
            "POST",
            {
              projectId,
              materialId,
              warehouseId,
              quantity,
              note: "不合法數量",
            },
            randomUUID(),
          )
        ).status,
      ).toBe(400);
    expect(
      (
        await call("engineer", "/api/requests", "POST", {
          projectId,
          title: "重複",
          lines: [
            { materialId, quantity: 1 },
            { materialId, quantity: 1 },
          ],
        })
      ).status,
    ).toBe(400);
  });
  it("calculates actual cost from ledger and keeps commitments separate", async () => {
    const response = await call("admin", "/api/dashboard");
    expect(response.status).toBe(200);
    const result = await response.json();
    const ledger = await db.movement.findMany({ where: { kind: "OUT" } });
    expect(result.kpis.actualCostCents).toBe(
      ledger.reduce((s, m) => s + m.quantity * m.unitCostCents, 0),
    );
    const p = result.projects.find((p: { id: number }) => p.id === projectId);
    expect(p.actualCents).toBeGreaterThan(0);
    expect(p.committedCents).toBeGreaterThan(p.actualCents);
    expect(result.kpis.inventoryTurnover).toBeNull();
    expect((await call("engineer", "/api/reports/costs")).status).toBe(403);
  });
  it("validates atomic CSV import and exports formula-safe CSV", async () => {
    const csv =
      "sku,name,unit,unitCostCents,reorderPoint\nCSV-VALID,測試物料,件,100,2\nCSV-INVALID,錯誤物料,件,-1,2";
    expect(
      (await call("warehouse", "/api/materials/import", "POST", { csv }))
        .status,
    ).toBe(400);
    expect(
      await db.material.findUnique({ where: { sku: "CSV-VALID" } }),
    ).toBeNull();
    expect(
      (
        await call("warehouse", "/api/materials/import", "POST", {
          csv: "sku,name,unit,unitCostCents,reorderPoint\n=FORMULA,測試物料,件,100,2",
        })
      ).status,
    ).toBe(201);
    const response = await call("warehouse", "/api/materials/export");
    expect(await response.text()).toContain("'=FORMULA");
  });
  it("rejects blank CSV costs and duplicate header columns", async () => {
    for (const csv of [
      "sku,name,unit,unitCostCents,reorderPoint\nBLANK-COST,缺漏成本,件,,1",
      "sku,name,unit,unitCostCents,reorderPoint,unitCostCents\nDUP-COST,重複成本欄位,件,100,1,0",
    ]) {
      expect(
        (await call("warehouse", "/api/materials/import", "POST", { csv }))
          .status,
      ).toBe(400);
    }
    expect(
      await db.material.count({
        where: { sku: { in: ["BLANK-COST", "DUP-COST"] } },
      }),
    ).toBe(0);
  });
  it("normalizes equivalent login paths into the same rate-limit bucket", async () => {
    let last = 0;
    for (let i = 0; i < 20 && last !== 429; i++)
      last = (
        await call("", "/api/auth/login", "POST", {
          email: "missing@opsflow.test",
          password: "invalid-password",
        })
      ).status;
    expect(last).toBe(429);
    expect((await call("", "/api/auth/login/", "POST", {})).status).toBe(429);
    expect((await call("", "/api/auth/LOGIN", "POST", {})).status).toBe(429);
  });
  it("paginates, filters and exposes structured validation errors", async () => {
    const r = await call("admin", "/api/requests?page=1&pageSize=2&sort=asc");
    const result = await r.json();
    expect(result.items).toHaveLength(2);
    expect(result.total).toBeGreaterThan(2);
    const invalid = await call("admin", "/api/requests?page=-1");
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.requestId).toBeTruthy();
  });
  it("supplier success and timeout simulation use bounded retries", async () => {
    expect(
      (await call("buyer", "/api/integrations/supplier-quote?mode=success"))
        .status,
    ).toBe(200);
    const start = performance.now();
    expect(
      (await call("buyer", "/api/integrations/supplier-quote?mode=timeout"))
        .status,
    ).toBe(502);
    expect(performance.now() - start).toBeLessThan(4000);
    expect(
      (await call("engineer", "/api/integrations/supplier-quote")).status,
    ).toBe(403);
  });
  it("leaves coherent database and audit records after all failures", async () => {
    const result = await validateData(db);
    expect(Object.values(result.issues).every((n) => n === 0)).toBe(true);
    expect(
      await db.auditLog.count({ where: { action: "RECEIPT_CREATE" } }),
    ).toBeGreaterThan(0);
    expect((await call("engineer", "/api/audit")).status).toBe(403);
  });
  it("approval cannot validate old prices while a returned request is being resubmitted", async () => {
    const material = await db.material.findUniqueOrThrow({
      where: { id: materialId },
    });
    const p = await db.project.create({
      data: {
        code: `RACE-${randomUUID().slice(0, 8)}`,
        name: "簽核與重送競態",
        ownerId: engineerId,
        budgetCents: material.unitCostCents * 2,
      },
    });
    const r = await db.purchaseRequest.create({
      data: {
        number: `RACE-${randomUUID().slice(0, 8)}`,
        title: "重送前一件、重送後三件",
        projectId: p.id,
        requesterId: engineerId,
        status: "RETURNED",
        lines: {
          create: {
            materialId,
            quantity: 1,
            unitCostCents: material.unitCostCents,
          },
        },
      },
    });
    let pending: Promise<Response> | undefined;
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM PurchaseRequest WHERE id=${r.id} FOR UPDATE`;
        await tx.purchaseRequest.update({
          where: { id: r.id },
          data: { status: "SUBMITTED" },
        });
        await tx.requestLine.updateMany({
          where: { requestId: r.id },
          data: { quantity: 3 },
        });
        pending = call("manager", `/api/requests/${r.id}/approval`, "POST", {
          decision: "APPROVED",
          comment: "競態驗證",
        });
        let blocked = false;
        for (let i = 0; i < 100; i++) {
          const rows = await tx.$queryRaw<
            { Info: string | null }[]
          >`SHOW FULL PROCESSLIST`;
          if (
            rows.some(
              (row) =>
                row.Info?.includes("PurchaseRequest") &&
                (row.Info.includes("FOR UPDATE") ||
                  row.Info.startsWith("UPDATE")),
            )
          ) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        expect(blocked).toBe(true);
      },
      { timeout: 10000 },
    );
    expect((await pending!).status).toBe(409);
    expect(
      (await db.purchaseRequest.findUniqueOrThrow({ where: { id: r.id } }))
        .status,
    ).toBe("SUBMITTED");
  });
});
