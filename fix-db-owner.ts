import { PrismaClient } from '@prisma/client'
const user = process.env.SQL_USER;
const password = process.env.SQL_PASSWORD || '';
const dbname = process.env.SQL_DB_NAME;
const host = process.env.SQL_HOST;
const dbUrl = `postgresql://${user}:${encodeURIComponent(password)}@localhost/${dbname}?host=${host}`;

process.env.DATABASE_URL = dbUrl;
const prisma = new PrismaClient()
async function main() {
  try {
    const tables = ['migration_tickets', 'expenses', 'expense_allocation_rules', 'audit_logs', 'migration_requests', 'migration_files', 'mapping_templates', 'order_items', 'orders', 'tenants', 'products', 'inventory_transactions', 'coffee_tables', 'finance_logs', 'raw_materials'];
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`ALTER TABLE ${table} OWNER TO ai_studio_app_user`);
        console.log(`Success fixing owner for ${table}`);
      } catch (err) {
        console.error(`Error fixing ${table}:`, err.message);
      }
    }
  } catch(e) {
    console.log("Failed:", e.message);
  }
}
main().finally(()=>prisma.$disconnect());
