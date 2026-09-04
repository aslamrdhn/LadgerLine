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
    const res = await prisma.$queryRawUnsafe(`
      SELECT tc.constraint_name,
             tc.table_name,
             kcu.column_name,
             ccu.table_name AS foreign_table_name,
             ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'security_audit_logs';
    `);
    console.log(res);
  } catch(e) {
    console.log("Failed:", e.message);
  }
}
main().finally(()=>prisma.$disconnect());
