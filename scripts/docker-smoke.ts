import "dotenv/config";
import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
let healthy = false;
for (let i = 0; i < 60; i++) {
  try {
    const r = await fetch(base + "/api/health");
    if (r.ok) {
      healthy = true;
      break;
    }
  } catch {
    /* Container may still be migrating. */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!healthy) throw new Error("Docker health did not become ready");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(base);
  await page.getByLabel("電子郵件", { exact: true }).fill("admin@opsflow.test");
  await page
    .getByLabel("密碼", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "登入工作區", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "營運工作台", exact: true }),
  ).toBeVisible();
  const result = await (await page.request.get(base + "/api/dashboard")).json();
  await writeFile(
    "docs/testing/docker-smoke.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        base,
        health: "ok",
        browserLogin: true,
        dashboardKpis: result.kpis,
        source: "Docker Compose app and MySQL; real Chromium",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ health: "ok", browserLogin: true, base }));
} finally {
  await browser.close();
}
