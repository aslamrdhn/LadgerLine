import { getPrismaClient } from '../../db.js';
import { logger } from '../../logger.js';

function serializeDbBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (obj instanceof Date) return obj;
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber();
  if (Array.isArray(obj)) return obj.map(serializeDbBigInts);
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = serializeDbBigInts(obj[key]);
      }
    }
    return serialized;
  }
  return obj;
}

export class AuthRepository {
  async getTenant(tenantId: string): Promise<any | null> {
    try {
      const prisma = getPrismaClient();
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      return serializeDbBigInts(tenant);
    } catch (err: any) {
      logger.error(`[Auth Repo Prisma - getTenant] Failed: ${err.message}`);
      throw err;
    }
  }

  async findTenantByEmail(email: string): Promise<any | null> {
    try {
      const prisma = getPrismaClient();
      const tenant = await prisma.tenant.findFirst({
        where: {
          OR: [
            { ownerEmail: { equals: email, mode: 'insensitive' } },
            { cashierEmail: { equals: email, mode: 'insensitive' } }
          ]
        }
      });
      return serializeDbBigInts(tenant);
    } catch (err: any) {
      logger.error(`[Auth Repo Prisma - findTenantByEmail] Failed: ${err.message}`);
      throw err;
    }
  }

  async listTenants(): Promise<any[]> {
    try {
      const prisma = getPrismaClient();
      const tenants = await prisma.tenant.findMany();
      return serializeDbBigInts(tenants);
    } catch (err: any) {
      logger.error(`[Auth Repo Prisma - listTenants] Failed: ${err.message}`);
      throw err;
    }
  }

  async updateTenantRole(tenantId: string, role: string): Promise<void> {
    try {
      const prisma = getPrismaClient();
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { activeOperatorRole: role }
      });
    } catch (err: any) {
      logger.error(`[Auth Repo Prisma - updateTenantRole] Failed: ${err.message}`);
      throw err;
    }
  }

  async updateTenantPassword(tenantId: string, hashedPassword: string, newPin?: string): Promise<void> {
    try {
      const prisma = getPrismaClient();
      const data: any = { ownerPasswordHash: hashedPassword };
      if (newPin) data.cashierPin = newPin;
      await prisma.tenant.update({
        where: { id: tenantId },
        data
      });
    } catch (err: any) {
      logger.error(`[Auth Repo Prisma - updateTenantPassword] Failed: ${err.message}`);
      throw err;
    }
  }
}
