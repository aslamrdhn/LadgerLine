import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  sqlitePragmasInitialized: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type PrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Executes a transactional callback scoped to the given tenantId.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: PrismaTransaction) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    return fn(tx);
  });
}

/**
 * Configures SQLite for high-concurrency enterprise workloads using WAL mode.
 * Safe no-op if the underlying database is PostgreSQL/MySQL.
 */
export async function initSqlitePragmas(): Promise<void> {
  if (globalForPrisma.sqlitePragmasInitialized) return;
  try {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 10000;");
    await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL;");
    await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
    await prisma.$queryRawUnsafe("PRAGMA temp_store = MEMORY;");
    globalForPrisma.sqlitePragmasInitialized = true;
  } catch (err) {
    console.warn("[DB] SQLite PRAGMA initialization skipped:", err);
  }
}
