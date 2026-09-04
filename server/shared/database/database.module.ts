import { PrismaClient } from '@prisma/client';
import { env } from '../../env.ts';
import { logger } from '../../logger.js';
import { getPrismaClient } from '../../db.js';

class DatabaseModule {
  /**
   * Mengembalikan instance Prisma Client (PostgreSQL) aman
   */
  public static getPrisma(): PrismaClient {
    return getPrismaClient();
  }

  public static isPostgresAvailable(): boolean {
    return true; // Prisma Client manages fallback
  }
}

export { DatabaseModule };
