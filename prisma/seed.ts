import "dotenv/config";
import { hashPassword } from "../apps/api/src/security.js";
import { db } from "../apps/api/src/db.js";
import { validateData } from "../scripts/data-check.js";
import { performance } from "node:perf_hooks";
const args = process.argv.slice(2),
  option = (name: string, fallback: string) =>
    args
      .find((a) => a.startsWith(`--${name}=`))
      ?.split("=")
      .slice(1)
      .join("=") ??
    (args.includes(`--${name}`)
      ? args[args.indexOf(`--${name}`) + 1]
      : fallback);
const mode = option("mode", "guided");
if (!["guided", "business", "benchmark", "test"].includes(mode))
  throw new Error("Unknown seed mode");
const database = new URL(process.env.DATABASE_URL!).pathname.slice(1);
if (
  ![
    "opsflow_demo",
    "opsflow_test",
    "opsflow_e2e",
    "opsflow_benchmark",
  ].includes(database)
)
  throw new Error("Seed only permits named isolated OpsFlow databases");
if (mode === "benchmark" && database !== "opsflow_benchmark")
  throw new Error("Benchmark seed requires opsflow_benchmark");
if (mode === "test" && !["opsflow_test", "opsflow_e2e"].includes(database))
  throw new Error("Test seed requires opsflow_test");
const started = performance.now();
let state = Number(option("seed", "20261120")) >>> 0;
function random(max: number) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) % max;
}
const anchor = new Date(option("as-of", "2026-11-20T04:00:00Z"));
if (Number.isNaN(anchor.getTime())) throw new Error("Invalid --as-of date");
const day = (offset: number) => new Date(anchor.getTime() + offset * 86400000);
try {
  if (args.includes("--reset")) {
    if (option("confirm", "") !== database)
      throw new Error(`Reset requires --confirm=${database}`);
    // Explicit opt-in deletes only this allowlisted project database, in FK dependency order.
    await db.$transaction(
      async (tx) => {
        await tx.session.deleteMany();
        await tx.idempotency.deleteMany();
        await tx.auditLog.deleteMany();
        await tx.movement.deleteMany();
        await tx.receiptLine.deleteMany();
        await tx.receipt.deleteMany();
        await tx.orderLine.deleteMany();
        await tx.purchaseOrder.deleteMany();
        await tx.approval.deleteMany();
        await tx.requestLine.deleteMany();
        await tx.purchaseRequest.deleteMany();
        await tx.requirement.deleteMany();
        await tx.projectMember.deleteMany();
        await tx.project.deleteMany();
        await tx.stock.deleteMany();
        await tx.material.deleteMany();
        await tx.supplier.deleteMany();
        await tx.warehouse.deleteMany();
        await tx.user.deleteMany();
        await tx.department.deleteMany();
      },
      { timeout: 120000 },
    );
  }
  if (await db.user.count()) {
    console.log(
      JSON.stringify({
        seed: "unchanged",
        database,
        reason:
          "Existing data preserved; explicit --reset --confirm is required",
        validation: await validateData(db),
      }),
    );
  } else {
    const password = process.env.DEMO_PASSWORD;
    if (!password || password.length < 12)
      throw new Error("DEMO_PASSWORD must be set to at least 12 characters");
    const passwordHash = await hashPassword(password),
      origin = mode === "test" ? ("TEST" as const) : ("SYNTHETIC" as const);
    const department = await db.department.create({
      data: { name: "工程營運部" },
    });
    const users = [];
    for (const [role, name, email] of [
      ["ADMIN", "林以安", "admin"],
      ["MANAGER", "陳怡君", "manager"],
      ["ENGINEER", "王子謙", "engineer"],
      ["BUYER", "黃筱晴", "buyer"],
      ["WAREHOUSE", "李承翰", "warehouse"],
    ] as const)
      users.push(
        await db.user.create({
          data: {
            role,
            name,
            email: `${email}@opsflow.test`,
            passwordHash,
            departmentId: department.id,
          },
        }),
      );
    const engineer = users[2],
      manager = users[1],
      warehouseUser = users[4];
    const warehouse = await db.warehouse.create({
      data: { name: "高雄中央倉" },
    });
    await db.warehouse.create({ data: { name: "台南備品倉" } });
    const suppliers = [];
    for (const [name, contact, leadDays] of [
      ["東岸電機材料", "陳先生 · 07-000-0101", 7],
      ["禾田網路設備", "林小姐 · 06-000-0202", 10],
      ["立川工程五金", "李先生 · 07-000-0303", 5],
    ] as const)
      suppliers.push(
        await db.supplier.create({ data: { name, contact, leadDays } }),
      );
    const materials = [];
    for (const [i, name] of [
      "Cat6 網路線",
      "工業交換器",
      "配電箱",
      "控制電纜",
      "不鏽鋼線槽",
      "光纖跳線",
      "端子台",
      "電源供應器",
      "溫度感測器",
      "安全斷路器",
      "機櫃層板",
      "接地銅線",
      "防水接頭",
      "繼電器模組",
      "標示套管",
      "監控鏡頭",
      "無線基地台",
      "訊號轉換器",
      "配線架",
      "工業插座",
    ].entries())
      materials.push(
        await db.material.create({
          data: {
            sku: `MAT-${String(i + 1).padStart(3, "0")}`,
            name,
            unit: i % 3 === 0 ? "公尺" : "件",
            unitCostCents: 500 + random(49500),
            reorderPoint: 30,
            origin,
          },
        }),
      );
    const projectCount = mode === "guided" || mode === "test" ? 5 : 50,
      orderCount = mode === "guided" || mode === "test" ? 30 : 1000;
    const projects = [];
    for (let i = 0; i < projectCount; i++)
      projects.push(
        await db.project.create({
          data: {
            code: `PRJ-${String(i + 1).padStart(3, "0")}`,
            name:
              [
                "南港智慧辦公室佈建",
                "左營廠區網路更新",
                "台南產線監控整合",
                "屏東倉儲電力改善",
                "高雄總部機房擴建",
              ][i % 5] + (i >= 5 ? ` 第 ${Math.floor(i / 5) + 1} 期` : ""),
            budgetCents: 100_000_000,
            ownerId: engineer.id,
            members: {
              create: [{ userId: engineer.id }, { userId: manager.id }],
            },
            requirements: {
              create: materials
                .slice(0, 5)
                .map((m) => ({ materialId: m.id, quantity: 100 })),
            },
          },
        }),
      );
    for (let i = 0; i < orderCount; i++) {
      const material = materials[i % materials.length],
        project = projects[i % projects.length],
        quantity = 10 + random(31),
        bucket = i % 3,
        receivedQty =
          bucket === 0 ? 0 : bucket === 1 ? Math.floor(quantity / 2) : quantity;
      const submittedAt = day(-30 + random(15)),
        approvedAt = new Date(
          submittedAt.getTime() + (2 + random(24)) * 3600000,
        ),
        orderedAt = new Date(approvedAt.getTime() + 3600000),
        expectedAt = new Date(
          orderedAt.getTime() + (5 + random(10)) * 86400000,
        ),
        completedAt =
          bucket === 2
            ? new Date(expectedAt.getTime() + (i % 4 === 0 ? 2 : -1) * 86400000)
            : null;
      await db.$transaction(async (tx) => {
        const request = await tx.purchaseRequest.create({
          data: {
            number: `REQ-SEED-${String(i + 1).padStart(5, "0")}`,
            title: `${project.name} · ${material.name} 備料`,
            projectId: project.id,
            requesterId: engineer.id,
            status: "ORDERED",
            submittedAt,
            lines: {
              create: {
                materialId: material.id,
                quantity,
                unitCostCents: material.unitCostCents,
              },
            },
            approvals: {
              create: {
                actorId: manager.id,
                decision: "APPROVED",
                comment: "規格與預算確認，核准採購。",
                submittedAt,
                createdAt: approvedAt,
              },
            },
          },
        });
        const order = await tx.purchaseOrder.create({
          data: {
            number: `PO-SEED-${String(i + 1).padStart(5, "0")}`,
            requestId: request.id,
            supplierId: suppliers[i % 3].id,
            status:
              bucket === 0 ? "OPEN" : bucket === 1 ? "PARTIAL" : "RECEIVED",
            orderedAt,
            expectedAt,
            completedAt,
            lines: {
              create: {
                materialId: material.id,
                quantity,
                receivedQty,
                unitCostCents: material.unitCostCents,
              },
            },
          },
          include: { lines: true },
        });
        if (receivedQty) {
          const date =
            completedAt ?? new Date(orderedAt.getTime() + 3 * 86400000);
          const receipt = await tx.receipt.create({
            data: {
              orderId: order.id,
              warehouseId: warehouse.id,
              actorId: warehouseUser.id,
              createdAt: date,
              lines: {
                create: {
                  orderLineId: order.lines[0].id,
                  quantity: receivedQty,
                },
              },
            },
            include: { lines: true },
          });
          await tx.movement.create({
            data: {
              materialId: material.id,
              warehouseId: warehouse.id,
              actorId: warehouseUser.id,
              receiptLineId: receipt.lines[0].id,
              kind: "IN",
              quantity: receivedQty,
              unitCostCents: material.unitCostCents,
              note: `種子採購 ${order.number} 收貨`,
              origin,
              sourceKey: `seed:${mode}:${i}:receipt`,
              createdAt: date,
            },
          });
          await tx.stock.upsert({
            where: {
              warehouseId_materialId: {
                warehouseId: warehouse.id,
                materialId: material.id,
              },
            },
            create: {
              warehouseId: warehouse.id,
              materialId: material.id,
              quantity: receivedQty,
            },
            update: { quantity: { increment: receivedQty } },
          });
        }
      });
    }
    for (const material of materials) {
      const quantity = material.id === materials[0].id ? 5 : 80;
      await db.movement.create({
        data: {
          materialId: material.id,
          warehouseId: warehouse.id,
          actorId: warehouseUser.id,
          kind: "IN",
          quantity,
          unitCostCents: material.unitCostCents,
          note: "期初庫存（合成資料）",
          origin,
          sourceKey: `opening:${mode}:${material.sku}`,
          createdAt: day(-60),
        },
      });
      await db.stock.upsert({
        where: {
          warehouseId_materialId: {
            warehouseId: warehouse.id,
            materialId: material.id,
          },
        },
        create: {
          warehouseId: warehouse.id,
          materialId: material.id,
          quantity,
        },
        update: { quantity: { increment: quantity } },
      });
      const issued = material.id === materials[0].id ? 2 : 20;
      await db.movement.create({
        data: {
          materialId: material.id,
          warehouseId: warehouse.id,
          projectId: projects[random(projects.length)].id,
          actorId: engineer.id,
          kind: "OUT",
          quantity: issued,
          unitCostCents: material.unitCostCents,
          note: "工程安裝領料（合成資料）",
          origin,
          sourceKey: `opening-issue:${mode}:${material.sku}`,
          createdAt: day(-2),
        },
      });
      await db.stock.update({
        where: {
          warehouseId_materialId: {
            warehouseId: warehouse.id,
            materialId: material.id,
          },
        },
        data: { quantity: { decrement: issued } },
      });
    }
    for (let i = 0; i < 8; i++) {
      const status =
        i < 5
          ? "SUBMITTED"
          : i === 5
            ? "RETURNED"
            : i === 6
              ? "REJECTED"
              : "APPROVED";
      const request = await db.purchaseRequest.create({
        data: {
          number: `REQ-TODO-${i + 1}`,
          title: ["機房備品補充", "現場施工追加材料", "測試設備申購"][i % 3],
          projectId: projects[i % projects.length].id,
          requesterId: engineer.id,
          status,
          submittedAt: day(-1),
          lines: {
            create: {
              materialId: materials[i].id,
              quantity: 2,
              unitCostCents: materials[i].unitCostCents,
            },
          },
        },
      });
      if (status !== "SUBMITTED")
        await db.approval.create({
          data: {
            requestId: request.id,
            actorId: manager.id,
            decision: status,
            comment:
              status === "RETURNED" ? "請補充現場需求說明" : "已完成規格審查",
            submittedAt: day(-1),
            createdAt: anchor,
          },
        });
    }
    for (const [i, project] of projects.entries()) {
      const rows = await db.requestLine.findMany({
        where: {
          request: {
            projectId: project.id,
            status: { in: ["APPROVED", "ORDERED"] },
          },
        },
      });
      const committed = rows.reduce(
        (s, l) => s + l.quantity * l.unitCostCents,
        0,
      );
      await db.project.update({
        where: { id: project.id },
        data: {
          budgetCents: Math.ceil(committed * (i === 0 ? 1.12 : 2)) + 10000,
        },
      });
    }
    if (mode === "benchmark") {
      for (let start = 0; start < 100000; start += 1000) {
        const rows = Array.from({ length: 1000 }, (_, j) => {
          const i = start + j,
            material = materials[Math.floor(i / 2) % materials.length];
          return {
            materialId: material.id,
            warehouseId: warehouse.id,
            projectId:
              i % 2 ? projects[Math.floor(i / 2) % projects.length].id : null,
            actorId: engineer.id,
            kind: i % 2 ? ("OUT" as const) : ("IN" as const),
            quantity: 1,
            unitCostCents: material.unitCostCents,
            note: "效能測試配對交易（合成）",
            origin,
            sourceKey: `benchmark:${option("seed", "20261120")}:${i}`,
            createdAt: new Date(day(-10).getTime() + i * 1000),
          };
        });
        await db.movement.createMany({ data: rows });
      }
    }
    await db.auditLog.create({
      data: {
        actorId: users[0].id,
        action: "SEED_COMPLETE",
        entity: "Dataset",
        requestId: "seed",
        detail: {
          mode,
          randomSeed: option("seed", "20261120"),
          asOf: anchor.toISOString(),
          origin,
        },
      },
    });
    console.log(
      JSON.stringify(
        {
          seed: "created",
          mode,
          database,
          durationMs: Math.round(performance.now() - started),
          validation: await validateData(db),
        },
        null,
        2,
      ),
    );
  }
} finally {
  await db.$disconnect();
}
