import { getPrismaClient } from '../../db.js';
import { logger } from '../../logger.js';
import { NotificationService } from './NotificationService.js';

export class BusinessAuditorService {
  static async generateDailySummary(tenantId: string) {
    logger.info(`[BusinessAuditorService] Generating daily summary for tenant: ${tenantId}`);
    const prisma = getPrismaClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    // Fetch Yesterday's Orders
    const yesterdayOrders = await prisma.order.findMany({
      where: {
        tenantId,
        orderTime: {
          gte: yesterdayStart,
          lt: todayStart
        }
      }
    });

    const revenue = yesterdayOrders.reduce((sum, order) => sum + order.totalPrice, 0);
    const cost = yesterdayOrders.reduce((sum, order) => sum + order.totalCost, 0);
    const tax = yesterdayOrders.reduce((sum, order) => sum + order.tax, 0);

    // Fetch True Expenses for yesterday
    const yesterdayExpenses = await prisma.financeLog.findMany({
        where: {
            tenantId,
            type: 'expense',
            logDate: {
                gte: yesterdayStart,
                lt: todayStart
            }
        }
    });

    const expenseCost = yesterdayExpenses.reduce((sum, log) => sum + Number(log.amount), 0);
    
    const realProfit = revenue - cost - tax - expenseCost;
    const transactionCount = yesterdayOrders.length;
    const averageValue = transactionCount > 0 ? revenue / transactionCount : 0;

    const summaryText = `Daily Ledger Report: Revenue Rp${revenue.toLocaleString('id-ID')}, Transactions: ${transactionCount}, Avg Tx: Rp${averageValue.toLocaleString('id-ID')}, Est. Net Profit: Rp${realProfit.toLocaleString('id-ID')}.`;

    // Save Insight
    await prisma.businessInsight.create({
      data: {
        tenantId,
        insightType: 'DAILY_AUDIT',
        summary: summaryText,
        details: {
          revenue,
          cost,
          tax,
          realProfit,
          transactionCount,
          averageValue
        },
        actionable: false
      }
    });

    // Notify Owner
    await NotificationService.sendAlert(
      tenantId,
      'LedgerLine Daily Business Audit',
      summaryText,
      'IN_APP' 
    );
  }
}
