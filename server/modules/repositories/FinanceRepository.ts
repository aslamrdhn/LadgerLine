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

export class FinanceRepository {
  async getFinanceLogs(tenantId: string): Promise<any[]> {
    const prisma = getPrismaClient();
    try {
      const logs = await prisma.financeLog.findMany({
        where: { tenantId },
        orderBy: { logDate: 'desc' }
      });
      return logs.map((log: any) => ({
        ...log,
        date: log.logDate instanceof Date ? log.logDate.toISOString().split('T')[0] : log.logDate,
        time: log.logTime
      }));
    } catch (err: any) {
      logger.error(`[Prisma - getFinanceLogs] Failed: ${err.message}`);
      throw err;
    }
  }

  async createFinanceLog(tenantId: string, log: any): Promise<any> {
    const prisma = getPrismaClient();
    const cleanLogPrisma = {
      logDate: (log.logDate || log.date) ? new Date(log.logDate || log.date) : new Date(),
      logTime: log.logTime || log.time || new Date().toLocaleTimeString('id-ID'),
      type: log.type,
      category: log.category,
      amount: Number(log.amount),
      description: log.description || '',
      isEncrypted: log.isEncrypted !== false,
      secureHash: log.secureHash || ''
    };

    try {
      return await prisma.financeLog.create({
        data: { id: log.id, tenantId, ...cleanLogPrisma }
      });
    } catch (err: any) {
      logger.error(`[Prisma - createFinanceLog] Failed: ${err.message}`);
      throw err;
    }
  }
}
