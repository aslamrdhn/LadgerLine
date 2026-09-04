import { getPrismaClient } from '../server/db.js';
import { ProfitLeakEngine } from '../server/modules/bi/ProfitLeakEngine.js';
import { BusinessAuditorService } from '../server/modules/bi/BusinessAuditorService.js';
import { BenchmarkEngine } from '../server/modules/bi/BenchmarkEngine.js';

async function testBI() {
  const prisma = getPrismaClient();
  const tenants = await prisma.tenant.findMany();
  if (tenants.length === 0) {
    console.log("No tenants found.");
    return;
  }
  
  const tenantId = tenants[0].id;
  console.log(`Testing BI Engine for tenant: ${tenantId}`);

  console.log("Running Profit Leak Scan...");
  await ProfitLeakEngine.runFullScan(tenantId);
  
  console.log("Generating Daily Audit...");
  await BusinessAuditorService.generateDailySummary(tenantId);
  
  console.log("Generating Benchmarks...");
  await BenchmarkEngine.generateMarketBenchmark();

  console.log("Checking DB Results...");
  const leaks = await prisma.profitLeakEvent.findMany({ where: { tenantId }});
  console.log(`Found ${leaks.length} profit leak events.`);
  console.dir(leaks, { depth: null });
  
  const insights = await prisma.businessInsight.findMany({ where: { tenantId }});
  console.log(`Found ${insights.length} business insights.`);
  console.dir(insights, { depth: null });

  const benchmarks = await prisma.benchmarkSnapshot.findMany();
  console.log(`Found ${benchmarks.length} benchmarks.`);
  console.dir(benchmarks, { depth: null });

  console.log("BI Engine Test Complete!");
}

testBI().catch(console.error).finally(() => process.exit(0));
