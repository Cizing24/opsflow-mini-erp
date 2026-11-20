import { z } from "zod";
import type { OpenAPIObject, SchemaObject } from "@nestjs/swagger";
import * as contract from "@opsflow/shared";
export function completeOpenApi(document: OpenAPIObject) {
  const bodies: [string, string, z.ZodType][] = [
    ["/api/auth/login", "post", contract.loginSchema],
    ["/api/projects", "post", contract.projectSchema],
    ["/api/projects/{id}", "patch", contract.projectSchema],
    ["/api/projects/{id}/requirements", "post", contract.requirementSchema],
    ["/api/suppliers", "post", contract.supplierSchema],
    ["/api/suppliers/{id}", "patch", contract.supplierSchema],
    ["/api/materials", "post", contract.materialSchema],
    ["/api/requests", "post", contract.requestSchema],
    ["/api/requests/{id}/resubmit", "patch", contract.requestSchema],
    ["/api/requests/{id}/approval", "post", contract.approvalSchema],
    ["/api/orders", "post", contract.orderSchema],
    ["/api/orders/{id}/receipts", "post", contract.receiptSchema],
    ["/api/issues", "post", contract.issueSchema],
    [
      "/api/materials/import",
      "post",
      z.object({ csv: z.string().min(1).max(150000) }),
    ],
  ];
  for (const [path, method, schema] of bodies) {
    const operation = document.paths[path]?.[method as "post" | "patch"];
    if (!operation) continue;
    const json = z.toJSONSchema(schema, { target: "openapi-3.0" });
    delete json.$schema;
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: json as SchemaObject } },
    };
  }
  for (const [path, item] of Object.entries(document.paths))
    for (const method of ["get", "post", "patch"] as const) {
      const op = item[method];
      if (!op) continue;
      if (!["/api/health", "/api/auth/login"].includes(path))
        op.security = [{ cookie: [] }];
      if (method !== "get" && path !== "/api/auth/login")
        op.parameters = [
          ...(op.parameters ?? []),
          {
            name: "Origin",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "必須等於 APP_ORIGIN",
          },
          {
            name: "X-CSRF-Token",
            in: "header",
            required: true,
            schema: { type: "string" },
            description: "由 login 或 me 回應取得",
          },
        ];
      if (
        method === "get" &&
        [
          "/api/projects",
          "/api/requests",
          "/api/orders",
          "/api/inventory",
          "/api/movements",
          "/api/audit",
        ].includes(path)
      )
        op.parameters = [
          ...(op.parameters ?? []),
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "pageSize",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: "q",
            in: "query",
            schema: { type: "string", maxLength: 100 },
          },
          {
            name: "sort",
            in: "query",
            schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
          },
          { name: "status", in: "query", schema: { type: "string" } },
        ];
      for (const status of ["400", "401", "403", "409", "429", "500"])
        op.responses[status] = {
          description:
            status === "409"
              ? "單據狀態／庫存／預算／重複請求衝突"
              : "結構化錯誤：{ error: { code, message, requestId } }",
        };
    }
  return document;
}
