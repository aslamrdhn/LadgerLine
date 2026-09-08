import "dotenv/config";
import Fastify, { FastifyRequest, FastifyReply } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import path from "path";
import { prisma } from "./server/lib/prisma.ts";
import { authRoutes } from "./server/routes/auth.routes.ts";
import { posRoutes } from "./server/routes/pos.routes.ts";
import { offlineRoutes } from "./server/routes/offline.routes.ts";
import { inventoryRoutes } from "./server/routes/inventory.routes.ts";
import { shiftRoutes } from "./server/routes/shift.routes.ts";
import { financeRoutes } from "./server/routes/finance.routes.ts";
import { syncRoutes } from "./server/routes/sync.routes.ts";
import { supplierRoutes } from "./server/routes/supplier.routes.ts";
import { publicRoutes } from "./server/routes/public.routes.ts";
import { mockRoutes } from "./server/routes/mock.routes.ts";
import { startOfflineSyncWorker } from "./server/workers/offlineSyncWorker.ts";
import { startOutboxWorker } from "./server/workers/outboxWorker.ts";
import { startDailyClosingCron } from "./server/workers/dailyClosingWorker.ts";
import { validateEnv } from "./server/src/utils/envValidator.ts";

export async function createApp() {
  validateEnv();

  const fastify = Fastify({
    logger: true,
  });

  // Global Error Handler
  fastify.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
    fastify.log.error(error);
    reply.status(500).send({
      success: false,
      message: error.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  });

  await fastify.register(fastifyHelmet, { contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: false, crossOriginResourcePolicy: false, frameguard: false });

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:5173", "http://localhost:3000"];

  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.some(o => new RegExp(o.replace('*', '.*')).test(origin))) {
        cb(null, true);
        return;
      }
      cb(null, true);
    },
    credentials: true,
  });

  fastify.register(async (api) => {
    api.get("/health", async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { status: "healthy", database: "connected" };
      } catch (error) {
        reply.status(500);
        return { status: "error", message: "Database connection failed" };
      }
    });

    api.get("/config", async () => {
      try {
        const fs = require("fs");
        const path = require("path");
        const configPath = path.join(process.cwd(), "firebase-applet-config.json");
        if (fs.existsSync(configPath)) {
          return JSON.parse(fs.readFileSync(configPath, "utf8"));
        }
        return {};
      } catch (e) {
        return {};
      }
    });

    api.register(authRoutes, { prefix: "/auth" });
    api.register(supplierRoutes, { prefix: "/supplier" });
    api.register(publicRoutes, { prefix: "/orders/public" });
    api.register(syncRoutes, { prefix: "/orders/sync" });
    api.register(mockRoutes, { prefix: "" });
    api.register(posRoutes, { prefix: "/pos" });
    api.register(offlineRoutes, { prefix: "/offline" });
    api.register(inventoryRoutes, { prefix: "/inventory" });
    api.register(shiftRoutes, { prefix: "/shift" });
    api.register(financeRoutes, { prefix: "/finance" });
  }, { prefix: "/api" });

  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    fastify.addHook("onRequest", (request: FastifyRequest, reply: FastifyReply, done) => {
      if (request.url.startsWith("/api")) {
        return done();
      }
      vite.middlewares(request.raw, reply.raw, done);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    await fastify.register(fastifyStatic, {
      root: distPath,
      wildcard: false,
    });

    fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
      if (request.raw.url && request.raw.url.startsWith("/api/")) {
        reply.code(404).send({ success: false, message: `Route ${request.method}:${request.raw.url} not found` });
      } else {
        reply.sendFile("index.html");
      }
    });
  }

  return fastify;
}

async function startServer() {
  const PORT = 3000;
  const app = await createApp();

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`[SERVER RUNNING] Access locally on http://localhost:${PORT}`);

    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes("postgresql")) {
      startOfflineSyncWorker().catch((err) => console.error("Error starting offline worker:", err));
      startOutboxWorker().catch((err) => console.error("Error starting outbox worker:", err));
      startDailyClosingCron().catch((err) => console.error("Error starting daily closing cron:", err));
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const handleShutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", handleShutdown);
  process.on("SIGINT", handleShutdown);
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch(console.error);
}
