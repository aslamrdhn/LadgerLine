import { getPrismaClient } from '../../db.ts';
import { logger } from '../../logger.js';
import bcrypt from 'bcryptjs';


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

export class SystemRepository {
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
      logger.error(`[Prisma - findTenantByEmail] Failed: ${err.message}`);
      throw err;
    }
  }

  async getSecurityAuditLogs(tenantId: string): Promise<any[]> {
    const prisma = getPrismaClient();
    try {
      return await prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (err: any) {
      logger.error(`[Prisma - getSecurityAuditLogs] Failed: ${err.message}`);
      throw err;
    }
  }

  async createSecurityAuditLog(tenantId: string, logData: any): Promise<any> {
    const prisma = getPrismaClient();
    const entryPrisma = {
      userId: logData.userId || logData.operator || 'SYSTEM',
      action: logData.action,
      entityName: logData.entityName || 'System',
      entityId: logData.entityId || 'N/A',
      oldValue: logData.oldValue ? JSON.stringify(logData.oldValue) : null,
      newValue: logData.newValue ? JSON.stringify(logData.newValue) : (logData.details ? logData.details : null),
      ipAddress: logData.ipAddress || '0.0.0.0',
      createdAt: new Date()
    };

    try {
      return await prisma.auditLog.create({
        data: { tenantId, ...entryPrisma }
      });
    } catch (err: any) {
      logger.error(`[Prisma - createSecurityAuditLog] Failed: ${err.message}`);
      throw err;
    }
  }

  async getCustomers(tenantId: string): Promise<any[]> {
    const prisma = getPrismaClient();
    try {
      return await prisma.customer.findMany({ where: { tenantId } });
    } catch (err: any) {
      logger.error(`[Prisma - getCustomers] Failed: ${err.message}`);
      throw err;
    }
  }

  async getSystemSetting(tenantId: string, key: string, defaultValue: string): Promise<string> {
    try {
      const prisma = getPrismaClient();
      const setting = await prisma.systemSettings.findUnique({
        where: { tenantId_key: { tenantId, key } }
      });
      return setting ? setting.value : defaultValue;
    } catch (err: any) {
      logger.error(`[Prisma - getSystemSetting] Failed: ${err.message}`);
      throw err;
    }
  }

  async saveSystemSetting(tenantId: string, key: string, value: string): Promise<void> {
    try {
      const prisma = getPrismaClient();
      await prisma.systemSettings.upsert({
        where: { tenantId_key: { tenantId, key } },
        create: { tenantId, key, value },
        update: { value }
      });
    } catch (err: any) {
      logger.error(`[Prisma - saveSystemSetting] Failed: ${err.message}`);
      throw err;
    }
  }
}
