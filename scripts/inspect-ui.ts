import "dotenv/config";
import { chromium } from "@playwright/test";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:3000");
  await page.getByLabel("電子郵件", { exact: true }).fill("admin@opsflow.test");
  await page
    .getByLabel("密碼", { exact: true })
    .fill(process.env.DEMO_PASSWORD!);
  await page.getByRole("button", { name: "登入工作區", exact: true }).click();
  await page.locator(".task-row").first().waitFor();
  console.log(
    JSON.stringify(
      await page
        .locator(".el-tag")
        .first()
        .evaluate((element) => ({
          html: element.outerHTML,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
          font: getComputedStyle(element).fontSize,
          color: getComputedStyle(element).color,
          background: getComputedStyle(element).backgroundColor,
          child: element.firstElementChild
            ? getComputedStyle(element.firstElementChild).cssText
            : null,
        })),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
