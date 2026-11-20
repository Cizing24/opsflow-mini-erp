import "dotenv/config";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { db, createDb } from "../apps/api/src/db.js";
import { validateData } from "./data-check.js";
if (new URL(process.env.DATABASE_URL!).pathname !== "/opsflow_demo")
  throw new Error("This read-only backup drill expects opsflow_demo");
const name = `opsflow_restore_${randomBytes(5).toString("hex")}`;
const command = (sql: string) =>
  execFileSync("docker", [
    "compose",
    "exec",
    "-T",
    "db",
    "sh",
    "-c",
    `MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "${sql}"`,
  ]);
const dump = execFileSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "db",
    "sh",
    "-c",
    'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump -uopsflow --single-transaction --routines --triggers --no-tablespaces --default-character-set=utf8mb4 opsflow_demo',
  ],
  { maxBuffer: 64 * 1024 * 1024 },
);
await mkdir("backups", { recursive: true });
const file = `backups/opsflow-demo-${Date.now()}.sql`;
await writeFile(file, dump);
command(
  `CREATE DATABASE ${name}; GRANT ALL PRIVILEGES ON ${name}.* TO 'opsflow'@'%';`,
);
const url = new URL(process.env.DATABASE_URL!);
url.pathname = `/${name}`;
const restored = createDb(url.toString());
try {
  execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "db",
      "sh",
      "-c",
      `MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 ${name}`,
    ],
    { input: dump },
  );
  const source = await validateData(db),
    target = await validateData(restored);
  assert.deepEqual(target, source);
  await writeFile(
    "docs/maintenance/backup-restore-results.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        source: "opsflow_demo",
        restoredInto: name,
        backupFile: file,
        bytes: dump.length,
        sha256: createHash("sha256").update(dump).digest("hex"),
        validation: target,
        matched: true,
        sourceModified: false,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      matched: true,
      bytes: dump.length,
      counts: target.counts,
    }),
  );
} finally {
  await restored.$disconnect();
  await db.$disconnect();
  assert.match(name, /^opsflow_restore_[a-f0-9]{10}$/);
  command(`DROP DATABASE ${name};`);
}
