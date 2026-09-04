import { getPrismaClient } from './db.js';

export class ProductRepository {
    async getProducts(tenantId: string) { return await ((getPrismaClient() as any)).product.findMany({ where: { tenantId } }); }
    async getRawMaterials(tenantId: string) { return await ((getPrismaClient() as any)).rawMaterial.findMany({ where: { tenantId } }); }
    async getRecipes(tenantId: string) { return await ((getPrismaClient() as any)).recipe.findMany({ where: { product: { tenantId } } }); }
    async saveProduct(tenantId: string, data: any) { 
        if (data.id) {
            return await ((getPrismaClient() as any)).product.upsert({
                where: { id: data.id },
                update: { ...data, tenantId },
                create: { ...data, tenantId }
            });
        }
        return await ((getPrismaClient() as any)).product.create({ data: { ...data, tenantId } }); 
    }
    async saveRawMaterial(tenantId: string, data: any) { 
        if (data.id) {
            return await ((getPrismaClient() as any)).rawMaterial.upsert({
                where: { id: data.id },
                update: { ...data, tenantId },
                create: { ...data, tenantId }
            });
        }
        return await ((getPrismaClient() as any)).rawMaterial.create({ data: { ...data, tenantId } }); 
    }
    async saveRecipe(tenantId: string, productId: string, materialId: string, amount: number, notes?: string) {
        return await ((getPrismaClient() as any)).recipe.create({ data: { productId, materialId, amount, notes } });
    }
    async deleteProduct(tenantId: string, id: string) {
        return await ((getPrismaClient() as any)).product.deleteMany({ where: { id, tenantId } });
    }
    async deleteRawMaterial(tenantId: string, id: string) {
        return await ((getPrismaClient() as any)).rawMaterial.deleteMany({ where: { id, tenantId } });
    }
}

export class OrderRepository {
    async getOrders(tenantId: string) { return await ((getPrismaClient() as any)).order.findMany({ where: { tenantId }, include: { orderItems: true } }); }
    async createOrderTransaction(tenantId: string, data: any) {
        const { items, orderItems, ...orderData } = data;
        const finalItems = items || orderItems;
        const prisma = ((getPrismaClient() as any));

        // Validate IDOR: ensure all productIds belong to the tenant
        const productIds = finalItems.map((item: any) => item.productId);
        const products = await prisma.product.findMany({ where: { id: { in: productIds }, tenantId } });
        if (products.length !== new Set(productIds).size) {
            throw new Error('Keamanan: Beberapa produk tidak ditemukan atau bukan milik Anda.');
        }

        return await prisma.$transaction(async (tx) => {
            // 1. Create historic cost snapshot
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (const item of finalItems) {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    item.priceAtSale = product.price;
                    item.costAtSale = product.costPrice;
                    
                    let snapshot = await tx.inventoryCostSnapshot.findFirst({
                        where: { tenantId, productId: product.id, date: today }
                    });
                    if (!snapshot) {
                        snapshot = await tx.inventoryCostSnapshot.create({
                            data: {
                                tenantId,
                                date: today,
                                productId: product.id,
                                averageCost: product.costPrice
                            }
                        });
                    }
                    item.costSnapshotId = snapshot.id;
                    item.historicalUnitCost = product.costPrice;
                    item.historicalHpp = product.costPrice * item.quantity;
                    item.historicalMargin = (product.price - product.costPrice) * item.quantity;
                }
            }

            const createdOrder = await tx.order.create({
                data: {
                    ...orderData,
                    tenantId,
                    orderItems: {
                        create: finalItems
                    }
                },
                include: { orderItems: true }
            });

            // If Paid, deduct stock
            if (createdOrder.paymentStatus === 'Paid') {
                for (const item of createdOrder.orderItems) {
                    const recipes = await tx.recipe.findMany({ where: { productId: item.productId } });
                    for (const r of recipes) {
                        const used = Number(r.amount) * Number(item.quantity);
                        await tx.rawMaterial.update({
                            where: { id: r.materialId },
                            data: {
                                stockQuantity: { decrement: used }
                            }
                        });
                    }
                }
            }

            return createdOrder;
        });
    }

    async confirmPaymentTransaction(tenantId: string, id: string) {
        const prisma = ((getPrismaClient() as any));
        return await prisma.$transaction(async (tx) => {
            const order = await tx.order.findFirst({ where: { id, tenantId }, include: { orderItems: true } });
            if (!order) throw new Error('Order tidak ditemukan');
            if (order.paymentStatus === 'Paid') return order;

            const updatedOrder = await tx.order.update({
                where: { id },
                data: { paymentStatus: 'Paid' },
                include: { orderItems: true }
            });

            // Deduct stock
            for (const item of updatedOrder.orderItems) {
                const recipes = await tx.recipe.findMany({ where: { productId: item.productId } });
                for (const r of recipes) {
                    const used = Number(r.amount) * Number(item.quantity);
                    await tx.rawMaterial.update({
                        where: { id: r.materialId },
                        data: { stockQuantity: { decrement: used } }
                    });
                }
            }
            
            // Log finance
            await tx.financeLog.create({
                data: {
                    id: `fin-cp-${updatedOrder.id}`,
                    tenantId,
                    type: 'income',
                    logTime: new Date().toLocaleTimeString(),
                    logDate: new Date(),
                    category: 'Penjualan Smart Table/QR',
                    amount: updatedOrder.totalPrice,
                    description: `Pelunasan transaksi POS ID: ${updatedOrder.id}`
                }
            });

            // Audit log
            await tx.auditLog.create({
                data: {
                    tenantId,
                    userId: 'SYSTEM',
                    action: 'CONFIRM_PAYMENT',
                    entityName: 'Order',
                    entityId: updatedOrder.id,
                    newValue: 'Payment confirmed and stock deducted'
                }
            });

            return updatedOrder;
        });
    }
}

export class FinanceRepository {
    async getFinanceLogs(tenantId: string) { return await ((getPrismaClient() as any)).financeLog.findMany({ where: { tenantId } }); }
    async createFinanceLog(tenantId: string, data: any) { return await ((getPrismaClient() as any)).financeLog.create({ data: { ...data, tenantId } }); }
}

export class SystemRepository {
    async getSystemSetting(tenantId: string, key: string, defaultValue: string) {
        const setting = await ((getPrismaClient() as any)).systemSettings.findFirst({ where: { tenantId, key } });
        return setting ? setting.value : defaultValue;
    }
    async saveSystemSetting(tenantId: string, key: string, value: string) {
        const existing = await ((getPrismaClient() as any)).systemSettings.findFirst({ where: { tenantId, key } });
        if (existing) {
            return await ((getPrismaClient() as any)).systemSettings.update({
                where: { id: existing.id },
                data: { value }
            });
        }
        return await ((getPrismaClient() as any)).systemSettings.create({
            data: { tenantId, key, value }
        });
    }
    async createSecurityAuditLog(tenantId: string, data: any) {
        try {
            let finalUserId = data.userId || null;
            if (!finalUserId && (data.actor || data.operator)) {
              const email = data.actor || data.operator;
              if (email && email !== 'SYSTEM' && email !== 'Unknown') {
                 const user = await (getPrismaClient() as any).user.findFirst({ where: { email }});
                 if (user) { finalUserId = user.id; }
              }
            }

            return await ((getPrismaClient() as any)).auditLog.create({
                data: {
                    tenantId,
                    userId: finalUserId,
                    action: data.action || 'UNKNOWN',
                    metadata: {
                      entityName: data.entity || data.entityName || 'System',
                      entityId: data.entityId || 'N/A',
                      oldValue: data.oldValue || null,
                      newValue: data.newValue || data.details || null
                    },
                    ipAddress: data.ipAddress || null,
                    createdAt: new Date()
                }
            });
        } catch (err: any) {
            import('./logger.js').then(({ logger }) => {
                logger.error(`[AUDIT_LOG_FAILED] Failed to create audit log: ${err.message}`);
            });
        }
    }
    async getSecurityAuditLogs(tenantId: string) { return await ((getPrismaClient() as any)).auditLog.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }); }
    async findTenantByEmail(email: string) {
        const tenant = await ((getPrismaClient() as any)).tenant.findFirst({
            where: { email: email }
        });
        if (tenant) return tenant;
        const user = await ((getPrismaClient() as any)).user.findFirst({
            where: { email: email },
            include: { tenant: true }
        });
        return user?.tenant || null;
    }
    async getCustomers(tenantId: string) { return await ((getPrismaClient() as any)).customer.findMany({ where: { tenantId } }); }
}

export class TenantRepository {
    async getTenant(tenantId: string) { return await ((getPrismaClient() as any)).tenant.findUnique({ where: { id: tenantId } }); }
    async saveTenant(tenantId: string, data: any) { delete data.role; const prismaData = data;
        return await ((getPrismaClient() as any)).tenant.upsert({
            where: { id: tenantId },
            update: data,
            create: { ...data, id: tenantId }
        });
    }
    async getTables(tenantId: string) { const prisma: any = ((getPrismaClient() as any)); return await prisma.coffeeTable?.findMany({ where: { tenantId } }) || []; }
    async generateTables(tenantId: string, count: number) {
        const prisma: any = ((getPrismaClient() as any));
        const existingCount = await prisma.coffeeTable?.count({ where: { tenantId } }) || 0;
        const tables = [];
        for (let i = 1; i <= count; i++) {
            const tableNumber = existingCount + i;
            const id = Math.random().toString(36).substring(2, 12); // Use id as public token
            tables.push({ id, tenantId, name: `Meja ${tableNumber}`, status: 'Empty' });
        }
        await prisma.coffeeTable?.createMany({ data: tables });
        return await this.getTables(tenantId);
    }
    async getCustomerByPhone(tenantId: string, phone: string) {
        const prisma: any = ((getPrismaClient() as any));
        return await prisma.customer?.findFirst({ where: { tenantId, phone } });
    }
    async saveCustomer(tenantId: string, data: any) {
        const prisma: any = ((getPrismaClient() as any));
        if (data.id) {
            return await prisma.customer?.update({ where: { id: data.id }, data });
        }
        return await prisma.customer?.create({ data: { ...data, tenantId } });
    }
    async getTableByPublicToken(token: string) {
        const prisma: any = ((getPrismaClient() as any));
        return await prisma.coffeeTable?.findFirst({ where: { id: token } });
    }
    async listTenants() {
        const tenants: any[] = await ((getPrismaClient() as any)).tenant.findMany();
        return tenants.map(t => {
            const { ownerPasswordHash, cashierPin, storeWifiPass, ...safeTenant } = t;
            for (const key in safeTenant) {
              if (typeof (safeTenant as any)[key] === 'bigint') {
                (safeTenant as any)[key] = (safeTenant as any)[key].toString();
              }
            }
            return safeTenant;
        });
    }
    async deleteTenant(id: string) {
        return await ((getPrismaClient() as any)).tenant.delete({ where: { id } });
    }
}
