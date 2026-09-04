import { getPrismaClient } from '../server/db.js';

async function test() {
  const prisma = getPrismaClient();
  const suppliers = await prisma.supplier.findMany();
  console.log('Suppliers:', suppliers);
  
  const res = await fetch('http://localhost:3000/api/suppliers/public', {
    headers: { 'X-Tenant-Id': 'tenant_db_1' }
  });
  console.log('API output:', await res.text());
}
test();
