import { getPrismaClient } from '../../db.ts';
import { logger } from '../../logger.js';
import bcrypt from 'bcryptjs';
import { container } from '../../container.ts';

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

export class OrderRepository {
  async getOrders(tenantId: string): Promise<any[]> {
    const prisma = getPrismaClient();
    try {
      const orders = await prisma.order.findMany({
        where: { tenantId },
        include: { orderItems: true },
        orderBy: { orderTime: 'desc' }
      });
      return orders.map(o => ({
        ...o,
        items: o.orderItems || []
      }));
    } catch (err: any) {
      logger.error(`[Prisma - getOrders] Failed: ${err.message}`);
      throw err;
    }
  }

  async createOrderTransaction(tenantId: string, orderData: any): Promise<any> {
    const prisma = getPrismaClient();
    try {
      return await prisma.$transaction(async (tx) => {
        // P0 FIX: Validate all ordered products belong to this specific tenant to prevent cross-tenant stock exhaustion attacks (IDOR)
        const productIds = Array.from(new Set(orderData.items.map((it: any) => it.productId || it.product_id))) as string[];
        const validProducts = await tx.product.findMany({
          where: {
            id: { in: productIds },
            tenantId: tenantId
          }
        });

        if (validProducts.length !== productIds.length) {
          throw new Error('Security Violation: Some products do not belong to the current tenant.');
        }

        const productMap = new Map();
        for (const p of validProducts) {
          productMap.set(p.id, p);
        }

        // Generate snapshots
        const todayStr = new Date().toISOString().split('T')[0];
        const todayDate = new Date(todayStr);

        const orderItemsData = await Promise.all(orderData.items.map(async (it: any) => {
          const prodId = it.productId || it.product_id;
          const product = productMap.get(prodId);
          const currentCost = Number(product.costPrice || 0);
          
          let snapshot = await tx.inventoryCostSnapshot.findFirst({
            where: { tenantId, date: todayDate, productId: prodId }
          });
          
          if (!snapshot) {
            snapshot = await tx.inventoryCostSnapshot.create({
              data: {
                tenantId,
                date: todayDate,
                productId: prodId,
                averageCost: currentCost
              }
            });
          }

          const priceAtSale = Number(it.priceAtSale || it.price_at_sale || it.price || product.price);
          const quantity = Number(it.quantity || it.qty || 1);

          return {
            productId: prodId,
            quantity: quantity,
            priceAtSale: priceAtSale,
            costAtSale: currentCost, // use DB cost
            costSnapshotId: snapshot.id,
            historicalUnitCost: currentCost,
            historicalHpp: currentCost * quantity,
            historicalMargin: (priceAtSale - currentCost) * quantity,
            variant: it.variant || null,
            notes: it.notes || ''
          };
        }));

        let totalCostCalc = 0;
        let totalPriceCalc = 0;
        for (const item of orderItemsData) {
          totalCostCalc += item.historicalHpp;
          totalPriceCalc += item.priceAtSale * item.quantity;
        }

        const discount = Number(orderData.discount || 0);
        const tax = Number(orderData.tax || 0);
        const finalPrice = totalPriceCalc - discount + tax;

        const crypto = await import('crypto');
        const orderId = orderData.id || `ord-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        const created = await tx.order.create({
          data: {
            id: orderId,
            tenantId,
            orderTime: orderData.orderTime ? new Date(orderData.orderTime) : new Date(),
            tableNumber: orderData.tableNumber || orderData.table_number || '',
            subtotal: totalPriceCalc,
            discount: discount,
            tax: tax,
            totalPrice: finalPrice,
            totalCost: totalCostCalc,
            paymentMethod: orderData.paymentMethod || orderData.payment_method || 'Tunai',
            paymentStatus: orderData.paymentStatus || orderData.payment_status || 'Success',
            receiptPrinted: !!(orderData.receiptPrinted || orderData.receipt_printed),
            notes: orderData.notes || '',
            secureHash: orderData.secureHash || orderData.secure_hash || '',
            orderItems: {
              create: orderItemsData
            }
          },
          include: { orderItems: true }
        });

        if (orderData.paymentStatus === 'Success' || orderData.paymentStatus === 'Paid') {
          for (const item of orderData.items) {
            const prodId = item.productId || item.product_id;
            const recipes = await tx.recipe.findMany({ where: { productId: prodId } });
            
            for (const r of recipes) {
              const totalUsed = Number(r.amount) * Number(item.quantity);
              await tx.rawMaterial.update({
                where: { id: r.materialId },
                data: {
                  stockQuantity: {
                    decrement: totalUsed
                  }
                }
              });

              await tx.inventoryTransaction.create({
                data: {
                  tenantId,
                  materialId: r.materialId,
                  type: 'OUT',
                  quantity: totalUsed,
                  reason: 'Sale / Checkout Order ' + orderId,
                  referenceId: orderId,
                  operator: 'SYSTEM'
                }
              });
            }
          }
        }

        return {
          ...created,
          items: created.orderItems || []
        };
      });
    } catch (err: any) {
      logger.error(`[ACID TRANSACTION FAIL] Rolling back. Order checkout failed: ${err.message}`);
      throw new Error(`Transaksi POS Gagal: ${err.message}`);
    }
  }

  async confirmPaymentTransaction(tenantId: string, orderId: string): Promise<any> {
    try {
      const prisma = getPrismaClient();
      return await prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: { id: orderId, tenantId },
          include: { orderItems: true }
        });

        if (!order) {
          throw new Error('Pesanan tidak ditemukan.');
        }

        if (order.paymentStatus === 'Success' || order.paymentStatus === 'Paid') {
          return {
            ...order,
            items: order.orderItems || []
          };
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'Paid' },
          include: { orderItems: true }
        });

        for (const item of order.orderItems) {
          const recipes = await tx.recipe.findMany({ where: { productId: item.productId } });
          for (const r of recipes) {
            const totalUsed = Number(r.amount) * Number(item.quantity);
            await tx.rawMaterial.update({
              where: { id: r.materialId },
              data: {
                stockQuantity: {
                  decrement: totalUsed
                }
              }
            });

            await tx.inventoryTransaction.create({
                data: {
                  tenantId,
                  materialId: r.materialId,
                  type: 'OUT',
                  quantity: totalUsed,
                  reason: 'Payment Confirmed Order ' + orderId,
                  referenceId: orderId,
                  operator: 'SYSTEM'
                }
            });
          }
        }

        const finId = `fin-smart-${Date.now()}`;
        await tx.financeLog.create({
          data: {
            id: finId,
            tenantId,
            logDate: new Date(),
            logTime: new Date().toLocaleTimeString('id-ID'),
            type: 'income',
            category: 'Table Order QRIS',
            amount: order.totalPrice,
            description: `Penerimaan Bayar Smart Table ID: ${orderId} di Meja ${order.tableNumber}`
          }
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            action: 'PAYMENT_CONFIRMATION',
            userId: 'CASHIER',
            entityName: 'Order',
            entityId: orderId,
            oldValue: 'UNPAID',
            newValue: 'PAID',
            ipAddress: '0.0.0.0',
            createdAt: new Date()
          }
        });

        return {
          ...updated,
          items: updated.orderItems || []
        };
      });
    } catch (err: any) {
      logger.error(`[Prisma - confirmPaymentTransaction] Failed: ${err.message}`);
      throw err;
    }
  }
}
