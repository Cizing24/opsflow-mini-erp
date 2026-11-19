import "dotenv/config";
import { defineConfig } from "@playwright/test";
const url = new URL(process.env.DATABASE_URL!);
url.pathname = "/opsflow_e2e";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  globalSetup: "./tests/e2e/setup.ts",
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/e2e-raw.json" }],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node apps/api/dist/main.js",
    url: "http://localhost:3001/api/health",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      DATABASE_URL: url.toString(),
      APP_ORIGIN: "http://localhost:3001",
      PORT: "3001",
      NODE_ENV: "development",
      OPSFLOW_IMPORT_ONLY: "0",
    },
  },
});
