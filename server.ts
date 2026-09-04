import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import { getPrismaClient } from "./server/db.ts";

import { apiRouter } from "./server/routes/api.ts";

export async function createApp() {
  const app = express();

  // Basic Middlewares
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.get("/api/health", async (req: Request, res: Response) => {
    try {
      const prisma = getPrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "healthy", database: "connected" });
    } catch (error) {
      res.status(500).json({ status: "error", message: "Database connection failed" });
    }
  });

  app.use("/api", apiRouter);

  // Start Vite dev server for frontend if in development
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    (app as any).vite = vite;
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(`[UNHANDLED ERROR] ${err.message}`, err);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  });

  return app;
}

async function startServer() {
  const PORT = 3000;
  const app = await createApp();
  
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER RUNNING] Access locally on http://localhost:${PORT}`);
  });

  const handleShutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000);
  };
  
  process.on("SIGTERM", handleShutdown);
  process.on("SIGINT", handleShutdown);
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch(console.error);
}
