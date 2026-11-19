import "dotenv/config";
import assert from "node:assert/strict";
import { cpus, totalmem, platform, release } from "node:os";
import { execFileSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { performance } from "node:perf_hooks";
if (new URL(process.env.DATABASE_URL!).pathname !== "/opsflow_benchmark")
  throw new Error("Benchmarks require isolated opsflow_benchmark");
process.env.OPSFLOW_IMPORT_ONLY = "1";
const { db } = await import("../apps/api/src/db.js");
const { createApp } = await import("../apps/api/src/main.js");
const { validateData } = await import("./data-check.js");
function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b),
    quantile = (p: number) => sorted[Math.ceil(p * sorted.length) - 1];
  return {
    samples: samples.length,
    averageMs: samples.reduce((s, v) => s + v, 0) / samples.length,
    p50Ms: quantile(0.5),
    p95Ms: quantile(0.95),
    p99Ms: quantile(0.99),
  };
}
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  dirty = Boolean(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  );
const app = await createApp();
await app.listen(0, "127.0.0.1");
const base = await app.getUrl();
try {
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: process.env.APP_ORIGIN!,
    },
    body: JSON.stringify({
      email: "admin@opsflow.test",
      password: process.env.DEMO_PASSWORD,
    }),
  });
  assert.equal(login.status, 201);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const api = [];
  for (const path of [
    "/api/movements?page=1&pageSize=20",
    "/api/projects?page=1&pageSize=20",
    "/api/reports/costs",
  ]) {
    for (let i = 0; i < 5; i++)
      await (
        await fetch(base + path, { headers: { Cookie: cookie } })
      ).arrayBuffer();
    for (const concurrency of [1, 4, 16]) {
      let next = 0,
        errors = 0;
      const times: number[] = [],
        start = performance.now();
      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          while (next++ < 120) {
            const t = performance.now();
            try {
              const response = await fetch(base + path, {
                headers: { Cookie: cookie },
              });
              await response.arrayBuffer();
              if (response.status !== 200) errors++;
            } catch {
              errors++;
            }
            times.push(performance.now() - t);
          }
        }),
      );
      const elapsedMs = performance.now() - start;
      api.push({
        path,
        concurrency,
        ...stats(times),
        elapsedMs,
        throughputRps: times.length / (elapsedMs / 1000),
        errorRate: errors / times.length,
        errors,
      });
    }
  }
  const project = (await db.project.findFirst({ orderBy: { id: "asc" } }))!;
  const query = () =>
    db.$queryRaw`SELECT m.id,m.quantity,m.unitCostCents,p.name FROM Movement m JOIN Project p ON p.id=m.projectId WHERE m.projectId=${project.id} AND m.createdAt>='2026-11-01' ORDER BY m.createdAt DESC,m.id DESC LIMIT 50`;
  const explain = () =>
    db.$queryRaw`EXPLAIN FORMAT=JSON SELECT m.id,m.quantity,m.unitCostCents,p.name FROM Movement m JOIN Project p ON p.id=m.projectId WHERE m.projectId=${project.id} AND m.createdAt>='2026-11-01' ORDER BY m.createdAt DESC,m.id DESC LIMIT 50`;
  const measure = async () => {
    const t: number[] = [];
    for (let i = 0; i < 30; i++) {
      const start = performance.now();
      await query();
      t.push(performance.now() - start);
    }
    return stats(t);
  };
  const index = "Movement_projectId_createdAt_idx";
  const metadata = await db.$queryRaw<
    { INDEX_NAME: string }[]
  >`SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Movement' AND INDEX_NAME='Movement_projectId_createdAt_idx'`;
  assert(metadata.length > 0);
  // Simulation only: keep a temporary FK-supporting index while removing the composite index.
  await db.$executeRawUnsafe(
    "CREATE INDEX benchmark_fk_project ON Movement(projectId)",
  );
  let before, after, beforePlan, afterPlan;
  try {
    await db.$executeRawUnsafe(`DROP INDEX ${index} ON Movement`);
    await db.$executeRawUnsafe("ANALYZE TABLE Movement");
    beforePlan = await explain();
    before = await measure();
    await db.$executeRawUnsafe(
      `CREATE INDEX ${index} ON Movement(projectId,createdAt)`,
    );
    await db.$executeRawUnsafe("ANALYZE TABLE Movement");
    afterPlan = await explain();
    after = await measure();
  } finally {
    const existing = await db.$queryRaw<
      { INDEX_NAME: string }[]
    >`SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Movement' AND INDEX_NAME='Movement_projectId_createdAt_idx'`;
    if (!existing.length)
      await db.$executeRawUnsafe(
        `CREATE INDEX ${index} ON Movement(projectId,createdAt)`,
      );
    await db.$executeRawUnsafe("DROP INDEX benchmark_fk_project ON Movement");
  }
  const pages = [];
  for (const offset of [0, 50000, 100000]) {
    const samples = [];
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await db.$queryRaw`SELECT id,kind,quantity FROM Movement ORDER BY id DESC LIMIT 20 OFFSET ${offset}`;
      samples.push(performance.now() - start);
    }
    pages.push({ offset, ...stats(samples) });
  }
  const validation = await validateData(db);
  const dashboard = await (
    await fetch(base + "/api/dashboard", { headers: { Cookie: cookie } })
  ).json();
  const report = {
    at: new Date().toISOString(),
    commit,
    workingTreeDirty: dirty,
    command: "DATABASE_URL=<opsflow_benchmark> npm run benchmark",
    environment: {
      os: platform(),
      release: release(),
      cpu: cpus()[0].model,
      logicalCpus: cpus().length,
      memoryBytes: totalmem(),
      node: process.version,
      mysql: await db.$queryRaw`SELECT VERSION() version`,
      docker: execFileSync(
        "docker",
        ["version", "--format", "{{.Server.Version}}"],
        { encoding: "utf8" },
      ).trim(),
    },
    dataset: validation,
    load: {
      samplesPerScenario: 120,
      concurrency: [1, 4, 16],
      warmup: 5,
      quantiles: "nearest-rank",
      network: "loopback; NestJS on Windows; MySQL in Docker Desktop",
      limit:
        "Closed-loop short runs; no confidence interval or sustained-load capacity claim",
    },
    api,
    sql: {
      query:
        "Movement JOIN Project by projectId and createdAt ordered with LIMIT 50",
      beforeIndex: before,
      afterIndex: after,
      beforePlan,
      afterPlan,
      pagination: pages,
    },
    kpis: dashboard.kpis,
  };
  await mkdir("docs/benchmarks", { recursive: true });
  await writeFile(
    "docs/benchmarks/results.json",
    JSON.stringify(
      report,
      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { api, sql: { before, after }, counts: validation.counts },
      null,
      2,
    ),
  );
  assert(api.every((s) => s.errors === 0));
} finally {
  await app.close();
  await db.$disconnect();
}
