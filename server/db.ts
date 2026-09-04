import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

let prismaInstance: PrismaClient | null = null;

function resolveDatabaseUrl(): string {
  if (process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME) {
    const user = process.env.SQL_USER;
    const password = process.env.SQL_PASSWORD || '';
    const dbname = process.env.SQL_DB_NAME;
    const host = process.env.SQL_HOST;
    return `postgresql://${user}:${encodeURIComponent(password)}@localhost/${dbname}?host=${host}`;
  }

  let url = process.env.DATABASE_URL?.trim();
  
  if (url && url !== 'postgresql://dummy:dummy@localhost:5432/dummy') {
    url = url.replace(/^['"]|['"]$/g, '');
    if (url.startsWith?.('postgresql://') || url.startsWith?.('postgres://')) {
      return url;
    }
  }
  
  logger.warn(`[DATABASE] Loaded DATABASE_URL was invalid and no Cloud SQL env vars found. Setting syntactic fallback to pass Prisma validation.`);
  return 'postgresql://dummy:dummy@localhost:5432/dummy';
}

process.env.DATABASE_URL = resolveDatabaseUrl();

export function getPrismaClient(): any {
  if (!prismaInstance) {
    const dbUrl = process.env.DATABASE_URL;
    try {
      logger.info('[DATABASE] Initializing PrismaClient on PostgreSQL target...');
      prismaInstance = new PrismaClient({
        datasources: {
          db: {
            url: dbUrl
          }
        },
        log: ['error', 'warn']
      });
    } catch (err: any) {
      logger.error(`[DATABASE] Failed to initialize PrismaClient constructor: ${err.message}`);
      throw err;
    }
  }
  return prismaInstance;
}
