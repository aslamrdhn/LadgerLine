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
      SELECT tablename, tableowner
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'security_audit_logs';
    `);
    console.log(res);
  } catch(e) {
    console.log("Failed:", e.message);
  }
}
main().finally(()=>prisma.$disconnect());
