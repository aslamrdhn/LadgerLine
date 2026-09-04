import { getPrismaClient } from '../../db.js';
import { logger } from '../../logger.js';
import { NotificationService } from './NotificationService.js';

export class ProfitLeakEngine {
  static async scanMarginDegradation(tenantId: string) {
    const prisma = getPrismaClient();
    const products = await prisma.product.findMany({ where: { tenantId } });

    for (const p of products) {
      if (p.price <= 0) continue;
      
      const currentMargin = ((p.price - p.costPrice) / p.price) * 100;
      
      // Use a standard healthy gross margin threshold for F&B (typically 60-70%)
      const standardMarginTarget = 60;

      if (currentMargin < (standardMarginTarget - 10)) { // 10% degradation
        const potentialLoss = ((standardMarginTarget - currentMargin) / 100) * p.price;
        
        await prisma.profitLeakEvent.create({
          data: {
            tenantId,
            leakType: 'MARGIN_DEGRADATION',
            sourceId: p.id,
            sourceName: p.name,
            potentialLoss: Math.round(potentialLoss),
            metrics: {
              sellingPrice: p.price,
              costPrice: p.costPrice,
              currentMargin,
              targetMargin: standardMarginTarget
            }
          }
        });

        // Generate Alert
        await NotificationService.sendAlert(
            tenantId, 
            `⚠ Margin Warning for ${p.name}`, 
            `Product margin decreased to ${currentMargin.toFixed(1)}%. Main reason: High cost price.`
        );
      }
    }
  }

  static async scanDeadMenu(tenantId: string) {
    const prisma = getPrismaClient();
    
    // Check products sold in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const orderItems = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      where: {
        order: {
          tenantId,
          orderTime: { gte: thirtyDaysAgo }
        }
      }
    });

    const soldProductIds = new Set(orderItems.map(oi => oi.productId));
    const allProducts = await prisma.product.findMany({ where: { tenantId } });

    for (const p of allProducts) {
      const soldQuantity = orderItems.find(oi => oi.productId === p.id)?._sum.quantity || 0;
      if (soldQuantity < 5) { // Hard threshold for dead menu
        const potentialLoss = p.stock * p.costPrice;
        if (potentialLoss > 0) {
          await prisma.profitLeakEvent.create({
            data: {
              tenantId,
              leakType: 'DEAD_MENU',
              sourceId: p.id,
              sourceName: p.name,
              potentialLoss: potentialLoss,
              metrics: {
                soldIn30Days: soldQuantity,
                currentStock: p.stock
              }
            }
          });
        }
      }
    }
  }

  static async scanInventoryLeakage(tenantId: string) {
    // Detect items with significant manual adjustments or waste
    const prisma = getPrismaClient();
    
    // Check adjustments and waste events
    const wasteEvents = await prisma.inventoryTransaction.findMany({
      where: {
        tenantId,
        type: { in: ['ADJUSTMENT', 'WASTE'] }
      },
      include: {
        material: true
      }
    });

    for (const event of wasteEvents) {
       // if waste/adjustment > 5 units
       const qty = Math.abs(Number(event.quantity));
       if (qty > 5) {
         const unitCost = Number(event.material?.unitCost || 0);
         const loss = qty * unitCost;
         if (loss > 0) {
             await prisma.profitLeakEvent.create({
               data: {
                 tenantId,
                 leakType: 'INVENTORY_LEAK',
                 sourceId: event.materialId,
                 sourceName: event.material?.name || 'Unknown Material',
                 potentialLoss: Math.round(loss),
                 metrics: { eventQty: qty, eventType: event.type }
               }
             });
         }
       }
    }
  }

  static async runFullScan(tenantId: string) {
    logger.info(`[ProfitLeakEngine] Starting full scan for tenant: ${tenantId}`);
    await this.scanMarginDegradation(tenantId);
    await this.scanDeadMenu(tenantId);
    await this.scanInventoryLeakage(tenantId);
    logger.info(`[ProfitLeakEngine] Full scan completed for tenant: ${tenantId}`);
  }
}
