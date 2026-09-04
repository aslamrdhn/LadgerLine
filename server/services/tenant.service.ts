import { getPrismaClient } from '../db.js';
import { logger } from '../logger.js';
import bcrypt from 'bcryptjs';
import { env } from '../env.ts';

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

export class TenantService {
  async getTenant(tenantId: string): Promise<any | null> {
    try {
      const prisma = getPrismaClient();
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      return serializeDbBigInts(tenant);
    } catch (err: any) {
      logger.error(`[Prisma - getTenant] Failed: ${err.message}`);
      throw err;
    }
  }

  async listTenants(): Promise<any[]> {
    try {
      const prisma = getPrismaClient();
      const tenants = await prisma.tenant.findMany();
      return serializeDbBigInts(tenants);
    } catch (err: any) {
      logger.error(`[Prisma - listTenants] Failed: ${err.message}`);
      throw err;
    }
  }

  async saveTenant(tenantId: string, rawData: any): Promise<any> {
    const prisma = getPrismaClient();
    const mappedPrisma = {
        storeName: rawData.storeName || 'My Coffee Shop',
        storeAddress: rawData.storeAddress || '',
        storePhone: rawData.storePhone || '',
        storeWifiName: rawData.storeWifiName || '',
        storeWifiPass: rawData.storeWifiPass || '',
        subscriptionPricePerMonth: Number(rawData.subscriptionPricePerMonth || 0),
        licenseKey: rawData.licenseKey || '',
        ownerPasswordHash: rawData.ownerPasswordHash || await bcrypt.hash(env.DEFAULT_OWNER_PASSWORD, 10),
        cashierEmail: rawData.cashierEmail || 'owner@ledgerline.local',
        ownerEmail: rawData.ownerEmail || 'admin@ledgerline.local',
        initialCapital: BigInt(rawData.initialCapital || 10000000),
        cashRegisterFund: Number(rawData.cashRegisterFund || 200000),
        theme: rawData.theme || 'slate',
        layoutMode: rawData.layoutMode || 'grid',
        cashierName: rawData.cashierName || 'Barista',
        cashierRole: rawData.cashierRole || 'Kasir Utama',
        cashierShift: rawData.cashierShift || 'Shift Pagi',
        cashierPin: rawData.cashierPin || '1234',
        activeOperatorRole: rawData.activeOperatorRole || 'Owner',
        driveConnected: !!rawData.driveConnected,
        taxType: rawData.taxType || 'PB1',
        taxRateCustom: parseFloat(String(rawData.taxRateCustom || 10.0)),
        receiptHeader: rawData.receiptHeader || '',
        receiptFooter: rawData.receiptFooter || ''
    };

    try {
      const tenant = await prisma.tenant.upsert({
        where: { id: tenantId },
        create: { id: tenantId, ...mappedPrisma },
        update: mappedPrisma
      });
      return serializeDbBigInts(tenant);
    } catch (err: any) {
      logger.error(`[Prisma - saveTenant] Failed: ${err.message}`);
      throw err;
    }
  }
}
