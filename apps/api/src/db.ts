import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});
export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is required");
  const parsed = new URL(url);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
    connectionLimit: 12,
    connectTimeout: 10000,
  });
  return new PrismaClient({ adapter });
}
export const db = createDb();
export const runtimeOrigin = ["/opsflow_test", "/opsflow_e2e"].includes(
  new URL(process.env.DATABASE_URL!).pathname,
)
  ? ("TEST" as const)
  : ("SYNTHETIC" as const);
