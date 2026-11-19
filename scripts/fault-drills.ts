import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { stripVTControlCharacters } from "node:util";
const name = `opsflow_drill_${randomBytes(5).toString("hex")}`;
const rootSql = (sql: string) =>
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
    { stdio: "pipe" },
  );
rootSql(
  `CREATE DATABASE ${name}; GRANT ALL PRIVILEGES ON ${name}.* TO 'opsflow'@'%';`,
);
const url = new URL(process.env.DATABASE_URL!);
url.pathname = `/${name}`;
const env = { ...process.env, DATABASE_URL: url.toString() };
const folder = resolve(`tests/.generated/${name}`),
  migration = "202611200099_simulation";
await mkdir(`${folder}/migrations/${migration}`, { recursive: true });
await writeFile(
  `${folder}/prisma.config.ts`,
  `import {defineConfig} from 'prisma/config'; export default defineConfig({schema:${JSON.stringify(resolve("prisma/schema.prisma"))},migrations:{path:'./migrations'},datasource:{url:process.env.DATABASE_URL!}});`,
);
await writeFile(
  `${folder}/migrations/migration_lock.toml`,
  'provider = "mysql"\n',
);
await writeFile(
  `${folder}/migrations/${migration}/migration.sql`,
  "ALTER TABLE MissingSimulationTable ADD COLUMN demo INT;",
);
const cli = (args: string[]) =>
  spawnSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      ...args,
      "--config",
      `${folder}/prisma.config.ts`,
    ],
    { env, encoding: "utf8" },
  );
try {
  const failed = cli(["migrate", "deploy"]);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout + failed.stderr, /P3018|1146|doesn't exist/);
  const resolved = cli(["migrate", "resolve", "--rolled-back", migration]);
  assert.equal(resolved.status, 0);
  await writeFile(
    `${folder}/migrations/${migration}/migration.sql`,
    "CREATE TABLE SimulationMarker (id INT PRIMARY KEY, note VARCHAR(40));",
  );
  const fixed = cli(["migrate", "deploy"]);
  assert.equal(fixed.status, 0);
  const regression = spawnSync(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "tests/fixtures/regression-simulation.test.ts",
    ],
    { encoding: "utf8" },
  );
  assert.equal(regression.status, 1);
  assert.match(
    stripVTControlCharacters(regression.stdout + regression.stderr),
    /expected 202 to be 597/,
  );
  const green = spawnSync(
    process.execPath,
    ["node_modules/vitest/vitest.mjs", "run", "tests/unit/rules.test.ts"],
    { encoding: "utf8" },
  );
  assert.equal(green.status, 0);
  await mkdir("docs/maintenance", { recursive: true });
  const clean = (text: string) =>
    text.replaceAll(url.toString(), "[isolated database URL]");
  await writeFile(
    "docs/maintenance/fault-results.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        simulation: true,
        isolatedDatabase: name,
        migration: {
          failureExit: failed.status,
          failure: clean(failed.stdout + failed.stderr),
          resolveExit: resolved.status,
          forwardFixExit: fixed.status,
        },
        regression: {
          mutantExit: regression.status,
          observed: "202 instead of 597",
          productionRulesExit: green.status,
        },
        otherDrills: {
          duplicateReceipts:
            "tests/integration/workflow.test.ts: 8 concurrent same-key requests",
          lastItem:
            "tests/integration/workflow.test.ts: 12 callers, one winner",
          slowReport:
            "scripts/benchmark.ts: composite-index removal and restoration in opsflow_benchmark",
          supplierTimeout:
            "tests/integration/workflow.test.ts: 600ms x 2 attempts => 502",
        },
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      simulation: true,
      migrationFailureObserved: true,
      forwardFixPassed: true,
      regressionCaught: true,
      productionRulesPassed: true,
    }),
  );
} finally {
  // This name was randomly created by this run; never accept a caller-provided database name.
  assert.match(name, /^opsflow_drill_[a-f0-9]{10}$/);
  rootSql(`DROP DATABASE ${name};`);
}
