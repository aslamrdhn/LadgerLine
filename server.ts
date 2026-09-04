/**
 * LedgerLine - Multi-Tenant Coffee Shop POS Platform
 * Production Server Entry Point
 * @license Apache-2.0
 */

import 'dotenv/config';
import { env } from './server/env.ts'; // Load and validate env first
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import crypto from 'crypto';
import promClient from 'prom-client';
import { createServer as createViteServer } from 'vite';
import { getPrismaClient } from './server/db.js';
import { setupSwagger } from './server/swagger.ts';
import { securityHeaders, authenticateToken, enforceTenantBoundary } from './server/middlewares/auth.ts';
import { csrfDoubleSubmit } from './server/middlewares/csrf.ts';
import { apiRateLimiter } from './server/middlewares/rateLimiter.ts';
import { logger, requestLogger } from './server/logger.js';

// Router Imports
import { authRouter } from './server/routes/auth.ts';
import { productsRouter } from './server/routes/products.ts';
import { ordersRouter } from './server/routes/orders.ts';
import { financeRouter } from './server/routes/finance.ts';
import { systemRouter } from './server/routes/system.ts';
import { customerRouter } from './server/routes/customers.ts';
import { costEngineRouter } from './server/routes/costEngine.ts';
import { ledgerlineRouter } from './server/routes/ledgerline.ts';
import { adminRouter } from './server/routes/admin.ts';
import { posRouter } from "./server/routes/pos.js";
import { businessRouter } from "./server/routes/business.js";

import { startSubscriptionWorker } from './server/workers/subscriptionEnforcer.ts';

export async function createApp() {
  const app = express();

  // Prometheus Metrics Setup
  const collectDefaultMetrics = promClient.collectDefaultMetrics;
  collectDefaultMetrics({ register: promClient.register });
  
  // Request ID Tracking Middleware
  app.use((req, res, next) => {
    const reqId = crypto.randomUUID();
    req.headers['x-request-id'] = reqId;
    res.setHeader('X-Request-Id', reqId);
    next();
  });

  // Compression
  app.use(compression());

  // 1. GLOBAL Middlewares
  const isProd = env.NODE_ENV === 'production';
  app.use(helmet({
    contentSecurityPolicy: isProd ? undefined : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: isProd ? undefined : false,
    xFrameOptions: isProd ? { action: 'sameorigin' } : false
  }));
  app.use(cors({
    origin: isProd ? (env.CORS_ORIGIN || false) : '*'
  }));
  app.use(cookieParser());
  
  morgan.token('req-id', (req: Request) => req.headers['x-request-id'] as string || '');
  app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms [ReqID: :req-id]', {
    stream: {
      write: (message) => requestLogger.info(message.trim())
    }
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(securityHeaders);
  
  // Swagger Documentation Setup
  setupSwagger(app);

  // API Rate Limiter
  app.use((req, res, next) => {
    if (typeof req.path === 'string' && req.path.startsWith('/api/')) {
      return apiRateLimiter(req, res, next);
    }
    next();
  });
  app.use(authenticateToken);
  app.use(enforceTenantBoundary);

  app.use((req, res, next) => {
    if (typeof req.path === 'string' && req.path.startsWith('/api/')) {
        return csrfDoubleSubmit(req, res, next);
    }
    next();
  });

  // 2. MOUNT API ROUTERS
  app.use('/api', authRouter);
  app.use('/api', productsRouter);
  app.use('/api', ordersRouter);
  app.use('/api', financeRouter);
  app.use('/api', systemRouter);
  app.use('/api', customerRouter);
  app.use('/api/cost-engine', costEngineRouter);
  app.use('/api', ledgerlineRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', posRouter);
  app.use('/api/v1/business', businessRouter);

  app.post('/api/log-client-error', express.json(), (req, res) => {
    require('fs').writeFileSync('client-error.log', JSON.stringify(req.body, null, 2));
    res.send({ ok: true });
  });

  // 3. HEALTH & ALIVE ENDPOINTS (Railway Readiness, Liveness)
  app.get('/api/baru', async (req: Request, res: Response) => {
    try {
      const { getPrismaClient } = await import('./server/db.ts');
      const prisma = getPrismaClient();
      
      const tenantsCount = await prisma.tenant.count();
      const suppliersCount = await prisma.supplier.count();
      const ordersCount = await prisma.purchaseRequest.count();

      res.json({
        success: true,
        message: 'Backend Ledgerline aktif. Ini adalah respons data global.',
        data: {
          timestamp: new Date().toISOString(),
          systemStats: {
            totalTenants: tenantsCount,
            totalSuppliers: suppliersCount,
            totalPurchaseRequests: ordersCount
          },
          note: 'Gunakan akses panel Superadmin untuk manajemen penuh.'
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      database: 'PostgreSQL Active',
      uptime: process.uptime()
    });
  });

  app.get('/api/metrics', async (req: Request, res: Response) => {
    res.set('Content-Type', promClient.register.contentType);
    res.send(await promClient.register.metrics());
  });

  // Load Prisma eagerly if connection is present
  try {
    getPrismaClient();
  } catch (err: any) {
    logger.error(`[DATABASE] Failed to initialize Prisma Client eagerly: ${err.message}`);
  }

  // Catch-all for undefined /api/* routes to return 404 JSON instead of HTML
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
  });

  // 4. CLIENT DEV INTERFACE OR PRODUCTION COMPILED STATIC SERVE
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    if (process.env.NODE_ENV !== 'test') {
      logger.info('[DEVELOPMENT] Booting Vite Development server middleware...');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      (app as any).vite = vite;
    }
  } else {
    logger.info('[PRODUCTION] Serving static compiled files from dist/');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 5. CENTRAL ERROR HANDLING MIDDLEWARE (Protects server from crashing/uncaught leaks)
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error(`[UNHANDLED SYSTEM ERROR] ${err.stack || err.message || err}`);
    if (res.headersSent) {
      return next(err);
    }

    if (err.name === 'LedgerError') {
      return res.status(err.status || 500).json({
        success: false,
        error: {
          code: err.code || 'SYS-001',
          message: err.message,
          category: err.category || 'SYSTEM',
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (err.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VAL-001',
          message: err.errors ? err.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') : err.message,
          category: 'VALIDATION',
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      success: false,
      message: 'Kesalahan internal tak terduga pada server. Tim teknis telah diberi tahu.',
      error: env.NODE_ENV !== 'production' ? err.message : undefined,
      stack: env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  return app;
}

async function startServer() {
  const PORT = 3000;
  logger.info('[SYSTEM STARTUP] Initializing LedgerLine Server...');
  // Start Background Workers
  startSubscriptionWorker();

  const app = await createApp();

  // 6. START LISTENING
  const serverInstance = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`[SERVER RUNNING] Access LedgerLine POS locally on http://localhost:${PORT}`);
  });

  // 7. GRACEFUL SHUTDOWN
  const handleShutdown = (signal: string) => {
    logger.warn(`[SHUTDOWN] Received signal ${signal}. Terminating connection streams gracefully...`);
    
    // Immediately close all connections to free up the port
    if (serverInstance && 'closeAllConnections' in serverInstance) {
      (serverInstance as any).closeAllConnections();
    }
    
    if ((app as any).vite) {
      (app as any).vite.close();
    }

    serverInstance.close(() => {
      logger.info('[SHUTDOWN] Connections drained. Server off safely.');
      process.exit(0);
    });

    // Force terminate after 3 seconds instead of 15
    setTimeout(() => {
      logger.error('[SHUTDOWN] Terminate timed out. Enforcing immediate process exit.');
      process.exit(1);
    }, 3000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  
  process.on('uncaughtException', (error) => {
    logger.error(`[FATAL UNCAUGHT] ${error.message}`, error);
    handleShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`[UNHANDLED REJECTION] Reason: ${reason}`);
  });
}

// Only start the server if we are running this file directly (not in a test runner)
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    logger.error(`[FATAL BOOT FAILURE] Failed to start LedgerLine platform: ${error.message}`);
    process.exit(1);
  });
}
