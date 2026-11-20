import "dotenv/config";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { materialSchema } from "@opsflow/shared";
import { db } from "../../apps/api/src/db.js";
const database = new URL(process.env.DATABASE_URL!).pathname.slice(1);
if (!["opsflow_demo", "opsflow_test", "opsflow_benchmark"].includes(database))
  throw new Error("Public import only allows isolated OpsFlow databases");
try {
  const schema = materialSchema.extend({
    origin: z.literal("PUBLIC_DERIVED"),
    sourceKey: z.string().startsWith("uci:352:StockCode:"),
  });
  const products = z
    .array(schema)
    .min(1)
    .max(500)
    .parse(
      JSON.parse(await readFile("data/mappings/uci-catalog.json", "utf8")),
    );
  if (
    new Set(products.map((p) => p.sku.toUpperCase())).size !== products.length
  )
    throw new Error(
      "SKU case collision; normalize source keys before importing into MySQL",
    );
  const existing = await db.material.count({
    where: { origin: "PUBLIC_DERIVED" },
  });
  await db.$transaction(
    async (tx) => {
      for (const product of products) {
        await tx.material.upsert({
          where: { sku: product.sku },
          create: product,
          update: { name: product.name, sourceKey: product.sourceKey },
        });
        await tx.material.updateMany({
          where: {
            sku: product.sku,
            movements: { none: {} },
            requestLines: { none: {} },
            orderLines: { none: {} },
            requirements: { none: {} },
          },
          data: { unitCostCents: product.unitCostCents },
        });
      }
      await tx.auditLog.create({
        data: {
          action: "PUBLIC_CATALOG_IMPORT",
          entity: "Material",
          requestId: "public-import",
          detail: {
            source: "UCI Online Retail 352",
            count: products.length,
            costBasis: "synthetic",
            transactionsImported: 0,
          },
        },
      });
    },
    { timeout: 30000 },
  );
  const result = {
    database,
    source: "UCI Online Retail 352",
    before: existing,
    after: await db.material.count({ where: { origin: "PUBLIC_DERIVED" } }),
    transactionsImported: 0,
    at: new Date().toISOString(),
  };
  await writeFile(
    "data/sources/import-result.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await db.$disconnect();
}
