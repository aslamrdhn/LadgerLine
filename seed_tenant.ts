import { getPrismaClient } from './server/db.js';
import bcrypt from 'bcryptjs';

async function seed() {
  const prisma = getPrismaClient();
  const defaultTenantId = 'aslam-brew';
  
  console.log('Seeding demo tenant...');
  await prisma.tenant.create({
    data: {
      id: defaultTenantId,
      storeName: 'Ledger Line by Aslam',
      cashierEmail: 'cashier@ledgerline.local',
      ownerEmail: 'admin@ledgerline.local',
      ownerPasswordHash: await bcrypt.hash('securepassword', 10),
      activeOperatorRole: 'Owner'
    }
  });
  console.log('Seeded tenant.');
}

seed().catch(console.error).finally(() => process.exit(0));
