import { getPrismaClient } from '../../db.ts';
import { logger } from '../../logger.js';
import bcrypt from 'bcryptjs';
import { env } from '../../env.ts';


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

export class TenantRepository {
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
      storeName: rawData.storeName || rawData.store_name || 'My Coffee Shop',
      storeAddress: rawData.storeAddress || rawData.store_address || '',
      storePhone: rawData.storePhone || rawData.store_phone || '',
      storeWifiName: rawData.storeWifiName || rawData.store_wifi_name || '',
      storeWifiPass: rawData.storeWifiPass || rawData.store_wifi_pass || '',
      subscriptionPricePerMonth: Number(rawData.subscriptionPricePerMonth || rawData.subscription_price_per_month || 0),
      licenseKey: rawData.licenseKey || rawData.license_key || '',
      ownerPasswordHash: rawData.ownerPasswordHash || rawData.owner_password_hash || await bcrypt.hash(env.DEFAULT_OWNER_PASSWORD, 10),
      cashierEmail: rawData.cashierEmail || rawData.cashier_email || 'owner@ledgerline.local',
      ownerEmail: rawData.ownerEmail || rawData.owner_email || rawData.cashierEmail || 'admin@ledgerline.local',
      initialCapital: BigInt(rawData.initialCapital || rawData.initial_capital || 10000000),
      cashRegisterFund: Number(rawData.cashRegisterFund || rawData.cash_register_fund || 200000),
      theme: rawData.theme || 'slate',
      layoutMode: rawData.layoutMode || rawData.layout_mode || 'grid',
      cashierName: rawData.cashierName || rawData.cashier_name || 'Barista',
      cashierRole: rawData.cashierRole || rawData.cashier_role || 'Kasir Utama',
      cashierShift: rawData.cashierShift || rawData.cashier_shift || 'Shift Pagi',
      cashierPin: rawData.cashierPin || rawData.cashier_pin || '1234',
      activeOperatorRole: rawData.activeOperatorRole || rawData.active_operator_role || 'Owner',
      driveConnected: !!(rawData.driveConnected || rawData.drive_connected),
      taxType: rawData.taxType || rawData.tax_type || 'PB1',
      taxRateCustom: parseFloat(String(rawData.taxRateCustom || rawData.tax_rate_custom || 10.0)),
      receiptHeader: rawData.receiptHeader || rawData.receipt_header || '',
      receiptFooter: rawData.receiptFooter || rawData.receipt_footer || ''
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

  async deleteTenant(tenantId: string): Promise<boolean> {
    const prisma = getPrismaClient();
    try {
      await prisma.tenant.delete({ where: { id: tenantId } });
      return true;
    } catch (err: any) {
      logger.error(`[Prisma - deleteTenant] Failed: ${err.message}`);
      return false;
    }
  }

  async getCustomerByPhone(tenantId: string, phone: string): Promise<any | null> {
    const cleanPhone = phone.replace(/\D/g, '');
    const prisma = getPrismaClient();
    try {
      return await prisma.customer.findUnique({
        where: { tenantId_phone: { tenantId, phone: cleanPhone } }
      });
    } catch (err: any) {
      logger.error(`[Prisma - getCustomerByPhone] Failed: ${err.message}`);
      throw err;
    }
  }

  async saveCustomer(tenantId: string, customer: any): Promise<any> {
    const cleanPhone = customer.phone.replace(/\D/g, '');
    const mapped = {
      name: customer.name,
      email: customer.email || '',
      points: Number(customer.points || 0),
      totalSpent: Number(customer.totalSpent || customer.total_spent || 0)
    };
    const prisma = getPrismaClient();
    try {
      return await prisma.customer.upsert({
        where: { tenantId_phone: { tenantId, phone: cleanPhone } },
        create: { id: customer.id || `cust-${Math.random().toString(36).substring(2, 9)}`, tenantId, phone: cleanPhone, ...mapped },
        update: mapped
      });
    } catch (err: any) {
      logger.error(`[Prisma - saveCustomer] Failed: ${err.message}`);
      throw err;
    }
  }

  async getTables(tenantId: string): Promise<any[]> {
    try {
      const prisma = getPrismaClient();
      const tables = await prisma.coffeeTable.findMany({
        where: { tenantId }
      });
      return tables.map((t: any) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        qrCodeUrl: t.qrCodeUrl,
        publicToken: t.publicToken || t.id,
        qrImage: t.qrImage || '',
        createdAt: t.createdAt || new Date(),
        updatedAt: t.updatedAt || new Date()
      }));
    } catch (err: any) {
      logger.error(`[Prisma - getTables] Failed: ${err.message}`);
      return [];
    }
  }

  async saveTable(tenantId: string, tableData: any): Promise<any> {
    const nowStr = new Date().toISOString();
    try {
      const prisma = getPrismaClient();
      return await prisma.coffeeTable.upsert({
        where: { tenantId_id: { tenantId, id: tableData.id } },
        create: {
          id: tableData.id,
          tenantId,
          name: tableData.name,
          status: tableData.status || 'Empty',
          qrCodeUrl: tableData.qrCodeUrl || `/table/${tableData.publicToken}`,
          // Pass dynamic fields safely
          ...({
            publicToken: tableData.publicToken,
            qrImage: tableData.qrImage || '',
            createdAt: tableData.createdAt ? new Date(tableData.createdAt) : new Date(),
            updatedAt: new Date()
          } as any)
        },
        update: {
          name: tableData.name,
          status: tableData.status || 'Empty',
          qrCodeUrl: tableData.qrCodeUrl || `/table/${tableData.publicToken}`,
          ...({
            publicToken: tableData.publicToken,
            qrImage: tableData.qrImage || '',
            updatedAt: new Date()
          } as any)
        }
      });
    } catch (err: any) {
      logger.error(`[Prisma - saveTable] Failed: ${err.message}`);
      throw err;
    }
  }

  async generateTables(tenantId: string, count: number): Promise<any[]> {
    const tables: any[] = [];
    const nowStr = new Date().toISOString();
    
    for (let i = 1; i <= count; i++) {
      const id = `T-${String(i).padStart(2, '0')}`;
      const name = `Meja ${String(i).padStart(2, '0')}`;
      // Generate standard random 8-character token
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let publicToken = '';
      for (let j = 0; j < 8; j++) {
        publicToken += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      tables.push({
        id,
        tenantId,
        name,
        status: 'Active',
        qrCodeUrl: `/table/${publicToken}`,
        publicToken,
        qrImage: '',
        createdAt: nowStr,
        updatedAt: nowStr
      });
    }
    try {
      const prisma = getPrismaClient();
      await prisma.$transaction(async (tx) => {
        await tx.coffeeTable.deleteMany({ where: { tenantId } });
        for (const t of tables) {
          await tx.coffeeTable.create({
            data: {
              id: t.id,
              tenantId,
              name: t.name,
              status: t.status,
              qrCodeUrl: t.qrCodeUrl
            }
          });
        }
      });
      return tables;
    } catch (err: any) {
      logger.error(`[Prisma - generateTables] Failed: ${err.message}`);
      throw err;
    }
  }

  async getTableByPublicToken(publicToken: string): Promise<any | null> {
    try {
      const prisma = getPrismaClient();
      const found = await prisma.coffeeTable.findFirst({
        where: { qrCodeUrl: `/table/${publicToken}` }
      });
      if (found) {
        return {
           ...found,
           publicToken
        };
      }
      return null;
    } catch (err: any) {
      logger.error(`[Prisma - getTableByPublicToken] Failed: ${err.message}`);
      return null;
    }
  }
}
