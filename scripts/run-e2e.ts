import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import setup from "../tests/e2e/setup.js";
interface RawResult {
  status: string;
  duration: number;
  error?: { message?: string };
}
interface RawSuite {
  title: string;
  suites?: RawSuite[];
  specs?: { title: string; tests: { results: RawResult[] }[] }[];
}
setup();
const result = spawnSync(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
const raw = JSON.parse(await readFile("test-results/e2e-raw.json", "utf8")) as {
  stats: unknown;
  suites: RawSuite[];
};
const secrets = Object.entries(process.env)
  .filter(
    ([key, value]) =>
      /PASSWORD|SECRET|TOKEN|API_KEY/i.test(key) && value && value.length > 5,
  )
  .map(([, value]) => value!);
function clean(text: string) {
  for (const value of secrets) text = text.replaceAll(value, "[redacted]");
  return text;
}
const tests: {
  title: string;
  status: string;
  durationMs: number;
  error?: string;
}[] = [];
function walk(suite: RawSuite) {
  for (const spec of suite.specs ?? [])
    for (const test of spec.tests)
      for (const result of test.results)
        tests.push({
          title: spec.title,
          status: result.status,
          durationMs: result.duration,
          ...(result.error?.message
            ? { error: clean(result.error.message) }
            : {}),
        });
  for (const child of suite.suites ?? []) walk(child);
}
raw.suites.forEach(walk);
await writeFile(
  "docs/testing/e2e-results.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      stats: raw.stats,
      tests,
      exitCode: result.status,
      environment: {
        browser: "Chromium",
        platform: process.platform,
        node: process.version,
        database: "opsflow_e2e",
        credentialsOmitted: true,
      },
    },
    null,
    2,
  ),
);
process.exitCode = result.status ?? 1;
