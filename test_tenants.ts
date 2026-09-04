import { getPrismaClient } from './server/db.js';
async function run() {
  const prisma = getPrismaClient();
  const c = await prisma.tenant.count();
  console.log('tenants:', c);
}
run();
