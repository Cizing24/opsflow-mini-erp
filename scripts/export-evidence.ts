import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
process.env.OPSFLOW_IMPORT_ONLY = "1";
const { createApp } = await import("../apps/api/src/main.js");
const { db } = await import("../apps/api/src/db.js");
const { validateData } = await import("./data-check.js");
const app = await createApp();
await app.listen(0, "127.0.0.1");
try {
  const base = await app.getUrl();
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
  if (login.status !== 201) throw new Error("Evidence login failed");
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const dashboard = await (
    await fetch(base + "/api/dashboard", { headers: { Cookie: cookie } })
  ).json();
  const openapi = await (await fetch(base + "/api/openapi.json")).json();
  await mkdir("docs/api", { recursive: true });
  await writeFile("docs/api/openapi.json", JSON.stringify(openapi, null, 2));
  await writeFile(
    "docs/benchmarks/demo-kpis.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        dataset: await validateData(db),
        kpis: dashboard.kpis,
        projects: dashboard.projects,
        from: dashboard.from,
        asOf: dashboard.asOf,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { kpis: dashboard.kpis, dataset: await validateData(db) },
      null,
      2,
    ),
  );
} finally {
  await app.close();
  await db.$disconnect();
}
