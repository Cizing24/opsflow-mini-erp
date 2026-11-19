import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
export default function setup() {
  execFileSync(
    process.execPath,
    [
      resolve("node_modules/tsx/dist/cli.mjs"),
      "scripts/test-database.ts",
      "--setup",
      "--reset",
      "--seed-only",
      "--e2e",
    ],
    { stdio: "inherit" },
  );
}
