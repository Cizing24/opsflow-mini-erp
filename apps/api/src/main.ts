import "reflect-metadata";
import "dotenv/config";
import {
  Module,
  Controller,
  Get,
  ServiceUnavailableException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { AuthController } from "./auth.js";
import { AuthGuard, ErrorFilter, requestMiddleware } from "./security.js";
import { ResourcesController } from "./resources.js";
import { ProcurementController } from "./procurement.js";
import { InventoryController } from "./inventory.js";
import { ReportsController } from "./reports.js";
import { IntegrationsController } from "./integrations.js";
import { db } from "./db.js";
@Controller("api")
class HealthController {
  @Get("health") async health() {
    try {
      await db.$queryRaw`SELECT 1`;
      return { status: "ok", database: "connected" };
    } catch {
      throw new ServiceUnavailableException("資料庫尚未就緒");
    }
  }
}
@Module({
  controllers: [
    HealthController,
    AuthController,
    ResourcesController,
    ProcurementController,
    InventoryController,
    ReportsController,
    IntegrationsController,
  ],
  providers: [AuthGuard],
})
class AppModule {}
export async function createApp() {
  if (!process.env.APP_ORIGIN) throw new Error("APP_ORIGIN is required");
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn"],
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());
  app.use(requestMiddleware);
  app.useGlobalFilters(new ErrorFilter());
  const config = new DocumentBuilder()
    .setTitle("OpsFlow ERP API")
    .setDescription(
      "虛構工程企業的簽核、採購、庫存與成本交易；寫入請帶 Origin、X-CSRF-Token，收貨／領料需 Idempotency-Key。",
    )
    .setVersion("1.0.0")
    .addCookieAuth("opsflow_session")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  app
    .getHttpAdapter()
    .get("/api/openapi.json", (_req: express.Request, res: express.Response) =>
      res.json(document),
    );
  app.use(
    "/api/docs",
    (
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
      );
      next();
    },
  );
  SwaggerModule.setup("api/docs", app, document);
  const web = fileURLToPath(new URL("../../web/dist/", import.meta.url));
  if (existsSync(web)) {
    app.use(express.static(web));
    app.use(
      (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
      ) =>
        req.method === "GET" && !req.path.startsWith("/api/")
          ? res.sendFile(resolve(web, "index.html"))
          : next(),
    );
  }
  app.enableShutdownHooks();
  return app;
}
if (process.env.VITEST !== "true" && process.env.OPSFLOW_IMPORT_ONLY !== "1") {
  const app = await createApp();
  await app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
  console.log(
    JSON.stringify({
      level: "info",
      message: "OpsFlow API ready",
      port: Number(process.env.PORT ?? 3000),
    }),
  );
}
