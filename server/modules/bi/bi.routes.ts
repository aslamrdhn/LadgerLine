import { Router } from 'express';
import { ProfitLeakEngine } from './ProfitLeakEngine.js';
import { BusinessAuditorService } from './BusinessAuditorService.js';
import { BenchmarkEngine } from './BenchmarkEngine.js';
import { getPrismaClient } from '../../db.js';

const router = Router();

// Endpoint to fetch latest business insights
router.get('/insights', async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const prisma = getPrismaClient();
    const insights = await prisma.businessInsight.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch profit leaks
router.get('/profit-leaks', async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const prisma = getPrismaClient();
    const leaks = await prisma.profitLeakEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    res.json(leaks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual run (for testing/demo)
router.post('/trigger-run', async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await ProfitLeakEngine.runFullScan(tenantId);
    await BusinessAuditorService.generateDailySummary(tenantId);
    await BenchmarkEngine.generateMarketBenchmark(); // Usually system-wide, but safe to run here

    res.json({ message: 'BI Engine scans triggered successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch benchmarks
router.get('/benchmarks', async (req: any, res) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const status = await BenchmarkEngine.getTenantBenchmarkStatus(tenantId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const biRouter = router;
