import "dotenv/config";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyMiddie from "@fastify/middie";
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

export async function createApp() {
  const fastify = Fastify({
    logger: true,
  });

  // Basic Middlewares
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });
  await fastify.register(fastifyCors);

  // Register API Routes
  fastify.register(async (api) => {
    api.get("/health", async (request, reply) => {
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
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        return {};
      } catch (e) {
        return {};
      }
    });

    // Register Auth Routes
    api.register(authRoutes, { prefix: '/auth' });
    api.register(supplierRoutes, { prefix: '/supplier' });
    api.register(publicRoutes, { prefix: '/orders' });
    api.register(mockRoutes, { prefix: '' });

    // Register POS Routes
    api.register(posRoutes, { prefix: '/pos' });

    // Register Offline Sync Routes
    api.register(offlineRoutes, { prefix: '/offline' });

    // Register Inventory Routes
    api.register(inventoryRoutes, { prefix: '/inventory' });

    // Register Shift Routes
    api.register(shiftRoutes, { prefix: '/shift' });

    // Register Finance Routes
    api.register(financeRoutes, { prefix: '/finance' });

    // Register Sync Routes
    api.register(syncRoutes, { prefix: '/orders' });
  }, { prefix: "/api" });

  // Start Vite dev server for frontend if in development
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    await fastify.register(fastifyMiddie);
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    fastify.use((req: any, res: any, next: any) => {
      if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return next();
      }
      vite.middlewares(req, res, next);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    await fastify.register(fastifyStatic, {
      root: distPath,
      wildcard: false,
    });
    
    // Fallback for SPA routing
    fastify.setNotFoundHandler((request, reply) => {
      if (request.raw.url && request.raw.url.startsWith('/api/')) {
        reply.code(404).send({ error: "Not Found", message: `Route ${request.method}:${request.raw.url} not found` });
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

    // Boot Background Workers if database is configured
    if (process.env.DATABASE_URL) {
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
