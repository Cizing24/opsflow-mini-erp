import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
async function login(page: Page, role: string) {
  await page.goto("/");
  await page
    .getByLabel("電子郵件", { exact: true })
    .fill(`${role}@opsflow.test`);
  await page
    .getByLabel("密碼", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "登入工作區", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "營運工作台", exact: true }),
  ).toBeVisible();
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "登出並切換角色" }).click();
  await expect(
    page.getByRole("heading", { name: "登入營運工作區" }),
  ).toBeVisible();
}
test("跨角色完整請購、簽核、採購、部分收貨、領料與成本", async ({ page }) => {
  const title = `E2E 現場佈建 ${Date.now()}`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "engineer");
  await page.getByRole("link", { name: "請購與簽核", exact: true }).click();
  await page.getByRole("button", { name: "新增請購", exact: true }).click();
  await page.getByLabel("請購主旨").fill(title);
  // Use the second project to leave the near-budget-limit example untouched.
  await page.getByLabel("工程專案", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("數量", { exact: true }).fill("10");
  await page.getByRole("button", { name: "送出請購", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await logout(page);
  await login(page, "manager");
  await page.getByRole("link", { name: "請購與簽核", exact: true }).click();
  await page.getByLabel("搜尋", { exact: true }).fill(title);
  await page.getByRole("button", { name: "查詢", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "檢視單據", exact: true }),
  ).toHaveCount(1);
  await page
    .getByRole("row")
    .filter({ hasText: title })
    .getByRole("button", { name: "檢視單據", exact: true })
    .click();
  await page.getByLabel("簽核意見").fill("E2E 規格及預算確認");
  await page.getByRole("button", { name: "送出簽核", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator("tbody").getByText("已核准", { exact: true }),
  ).toBeVisible();
  await logout(page);
  await login(page, "buyer");
  await page.getByRole("link", { name: "採購與收貨", exact: true }).click();
  await page.getByRole("button", { name: "建立採購單", exact: true }).click();
  await page.getByLabel("已核准請購", { exact: true }).selectOption({
    label: (
      await page.getByLabel("已核准請購").locator("option").allTextContents()
    ).find((t) => t.includes(title))!,
  });
  await page.getByRole("button", { name: "確認建立採購單" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const firstRow = page.locator(".el-table__body-wrapper tbody tr").first();
  const orderNumber = (await firstRow.locator("strong").first().textContent())!;
  await expect(firstRow).toContainText("待收貨");
  await logout(page);
  await login(page, "warehouse");
  await page.getByRole("link", { name: "採購與收貨", exact: true }).click();
  await page.getByLabel("搜尋", { exact: true }).fill(orderNumber);
  await page.getByRole("button", { name: "查詢", exact: true }).click();
  await page
    .getByRole("row")
    .filter({ hasText: orderNumber })
    .getByRole("button", { name: "檢視與收貨" })
    .click();
  const warehouseName = await page
    .getByLabel("入庫倉庫")
    .locator("option:checked")
    .textContent();
  await page.getByLabel(/本次收貨數量/).fill("4");
  await page.getByRole("button", { name: "確認收貨入庫" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator("tbody").getByText("部分收貨", { exact: true }),
  ).toBeVisible();
  await logout(page);
  await login(page, "engineer");
  await page.getByRole("link", { name: "庫存與領料", exact: true }).click();
  await page.getByRole("button", { name: "專案領料", exact: true }).click();
  await page.getByLabel("領用專案").selectOption({ index: 1 });
  await page.getByLabel("領料倉庫").selectOption({ label: warehouseName! });
  await page.getByLabel("領用數量").fill("1");
  await page.getByLabel("領用用途").fill("E2E 現場安裝");
  await page.getByRole("button", { name: "確認領料", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("tab", { name: "庫存異動紀錄" }).click();
  await expect(page.getByText("E2E 現場安裝", { exact: true })).toBeVisible();
  await logout(page);
  await login(page, "admin");
  const response = await page.request.get("/api/dashboard");
  expect(response.status()).toBe(200);
  const dashboard = await response.json();
  expect(dashboard.kpis.actualCostCents).toBeGreaterThan(0);
  await page.getByRole("link", { name: "稽核紀錄", exact: true }).click();
  await expect(
    page.getByText("MATERIAL_ISSUE", { exact: true }).first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("桌面與行動各路由、空狀態、focus 及實際畫面", async ({ page }) => {
  await login(page, "admin");
  await mkdir("docs/screenshots", { recursive: true });
  await mkdir(".impeccable/review", { recursive: true });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "營運工作台", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".overview-strip")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width === 1440 || width === 390) {
      const name = width === 1440 ? "desktop" : "mobile";
      await page.screenshot({
        path: `docs/screenshots/${name}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page.screenshot({
        path: `.impeccable/review/${name}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [path, title] of [
    ["/projects", "工程專案"],
    ["/requests", "請購與簽核"],
    ["/orders", "採購與收貨"],
    ["/inventory", "庫存與領料"],
    ["/masters", "供應商與物料"],
    ["/guide", "從需求到領料，走完一筆工程交易"],
    ["/audit", "稽核紀錄"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/requests");
  await page.getByLabel("搜尋", { exact: true }).fill("不存在的單號000000");
  await page.getByRole("button", { name: "查詢", exact: true }).click();
  await expect(
    page.getByText("沒有符合條件的請購單，請調整篩選或新增請購。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "新增請購", exact: true }).click();
  await page.getByLabel("請購主旨").focus();
  await expect(page.getByLabel("請購主旨")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("角色隱藏操作、重新整理延續 session、失效後可重新登入", async ({ page }) => {
  await login(page, "warehouse");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "營運工作台", exact: true }),
  ).toBeVisible();
  await page.goto("/requests");
  await expect(
    page.getByRole("button", { name: "新增請購", exact: true }),
  ).toHaveCount(0);
  await page.goto("/audit");
  await expect(page.getByRole("alert")).toContainText(
    "此角色沒有執行此操作的權限",
  );
  await page.context().clearCookies();
  await page.getByRole("link", { name: "營運工作台", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "登入營運工作區" }),
  ).toBeVisible();
  await login(page, "warehouse");
});
test("手機導覽隔離焦點且工作台保留所選單據 ID", async ({ page }) => {
  await login(page, "admin");
  const requestLink = page.locator('a.task-row[href*="requestId="]').first();
  const target = await requestLink.getAttribute("href");
  expect(target).toBeTruthy();
  await requestLink.click();
  await expect(page).toHaveURL(new RegExp(target!.replace("?", "\\?") + "$"));
  await expect(
    page.getByRole("dialog", { name: "請購單據追蹤" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto(
    "/orders?orderId=" +
      (await (await page.request.get("/api/orders?sort=asc&pageSize=1")).json())
        .items[0].id,
  );
  await expect(
    page.getByRole("dialog", { name: "採購單據追蹤" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");
  await expect(page.locator("#primary-sidebar")).toHaveAttribute("inert", "");
  const toggle = page.getByRole("button", { name: "切換導覽" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const close = page.getByRole("button", { name: "關閉導覽", exact: true });
  await expect(close).toBeFocused();
  await expect(close).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "API 文件" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.screenshot({
    path: ".impeccable/review/mobile-nav.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#primary-sidebar")).toHaveAttribute("inert", "");
});
