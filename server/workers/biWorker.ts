import { getPrismaClient } from '../db.js';
import { logger } from '../logger.js';
import { ProfitLeakEngine } from '../modules/bi/ProfitLeakEngine.js';
import { BusinessAuditorService } from '../modules/bi/BusinessAuditorService.js';
import { BenchmarkEngine } from '../modules/bi/BenchmarkEngine.js';

export function startBIWorker() {
  logger.info('[BI Worker] Starting Business Intelligence Engine... ');

  // Simulated crons using setInterval for demonstration:
  // In a real system, you'd use a robust queue/scheduler like BullMQ or Agenda.

  const ONE_HOUR = 60 * 60 * 1000;
  
  // 1. Daily Business Audit (Run every 12 hours hypothetically for demo, but represents daily)
  setInterval(async () => {
    try {
      logger.info('[BI Worker] Running Scheduled Business Audit...');
      const prisma = getPrismaClient();
      const activeTenants = await prisma.tenant.findMany({ select: { id: true } });
      
      for (const t of activeTenants) {
        await BusinessAuditorService.generateDailySummary(t.id);
      }
    } catch (e: any) {
      logger.error(`[BI Worker] Error running Business Audit: ${e.message}`);
    }
  }, ONE_HOUR * 12);

  // 2. Weekly Profit Leak Analysis (Run every 24 hours in demo)
  setInterval(async () => {
    try {
      logger.info('[BI Worker] Running Scheduled Profit Leak Scan...');
      const prisma = getPrismaClient();
      const activeTenants = await prisma.tenant.findMany({ select: { id: true } });
      
      for (const t of activeTenants) {
        await ProfitLeakEngine.runFullScan(t.id);
      }
    } catch (e: any) {
      logger.error(`[BI Worker] Error running Profit Leak Scan: ${e.message}`);
    }
  }, ONE_HOUR * 24);

  // 3. Monthly Industry Benchmark (Run every week in demo)
  setInterval(async () => {
    try {
      logger.info('[BI Worker] Running Scheduled Market Benchmark Generation...');
      await BenchmarkEngine.generateMarketBenchmark();
    } catch (e: any) {
        logger.error(`[BI Worker] Error running Market Benchmark: ${e.message}`);
    }
  }, ONE_HOUR * 168);
}
