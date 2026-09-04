import { PrismaClient } from '@prisma/client';
import { LedgerError } from '../utils/errorCodes.js';

export async function validatePeriod(tx: any, tenantId: string, businessDate: Date) {
  const period = await tx.accountingPeriod.findFirst({
    where: {
      tenantId,
      startDate: { lte: businessDate },
      endDate: { gte: businessDate },
    },
  });
  
  if (!period) throw new LedgerError('PER_002', 'Period not found');
  if (period.status === 'HARD_CLOSED') {
    throw new LedgerError('PER_001', `Period ${period.period} is closed`);
  }
  return period;
}
