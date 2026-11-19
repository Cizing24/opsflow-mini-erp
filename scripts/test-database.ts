import "dotenv/config";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const args = process.argv.slice(2),
  benchmark = args.includes("--benchmark");
const name = benchmark
  ? "opsflow_benchmark"
  : args.includes("--e2e")
    ? "opsflow_e2e"
    : "opsflow_test";
const url = new URL(process.env.DATABASE_URL!);
url.pathname = `/${name}`;
if (args.includes("--setup")) {
  const sql = `CREATE DATABASE IF NOT EXISTS ${name}; GRANT ALL PRIVILEGES ON ${name}.* TO 'opsflow'@'%';`;
  execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "db",
      "sh",
      "-c",
      `MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "${sql}"`,
    ],
    { stdio: "inherit" },
  );
}
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  OPSFLOW_IMPORT_ONLY: "1",
};
const run = (file: string, params: string[]) =>
  execFileSync(process.execPath, [resolve(file), ...params], {
    env,
    stdio: "inherit",
  });
run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
run("node_modules/tsx/dist/cli.mjs", [
  "prisma/seed.ts",
  "--mode",
  benchmark ? (args.includes("--business") ? "business" : "benchmark") : "test",
  ...(args.includes("--reset") ? ["--reset", `--confirm=${name}`] : []),
]);
if (!benchmark && !args.includes("--seed-only"))
  run("node_modules/vitest/vitest.mjs", [
    "run",
    "tests/integration",
    "--reporter=default",
    "--reporter=json",
    "--outputFile=docs/testing/integration-results.json",
  ]);
