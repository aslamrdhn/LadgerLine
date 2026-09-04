import { PrismaClient } from '@prisma/client';
import { LedgerError } from '../utils/errorCodes.js';

export async function generateNumber(tx: any, tenantId: string, prefix: string): Promise<string> {
  const year = new Date().getFullYear().toString();
  
  // upsert is not fully atomic on high concurrency without serializable, but we do it inside a transaction 
  // lock ordering in checkout service makes sure we don't dead-lock, but it doesn't lock NumberSequence.
  // for safety, we could just rely on Prisma
  const seq = await tx.numberSequence.upsert({
    where: { tenantId_prefix_year: { tenantId, prefix, year } },
    update: {},
    create: { tenantId, prefix, year, lastNumber: 0 },
  });
  
  const nextNumber = seq.lastNumber + 1;
  await tx.numberSequence.update({
    where: { id: seq.id },
    data: { lastNumber: nextNumber },
  });
  
  const formatted = `${prefix}-${year}-${String(nextNumber).padStart(6, '0')}`;
  
  await tx.numberStatus.create({
    data: {
      tenantId,
      number: formatted,
      status: 'RESERVED',
    },
  });
  
  return formatted;
}

export async function markNumberUsed(tx: any, tenantId: string, number: string) {
  await tx.numberStatus.update({
    where: { tenantId_number: { tenantId, number } },
    data: { status: 'USED' },
  });
}

export async function cancelNumber(tx: any, tenantId: string, number: string, reason: string) {
  await tx.numberStatus.update({
    where: { tenantId_number: { tenantId, number } },
    data: { status: 'CANCELLED', note: reason },
  });
}
