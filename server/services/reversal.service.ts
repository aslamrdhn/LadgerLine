import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { LedgerError } from '../utils/errorCodes.js';
import { roundMoney, balanceJournalLines } from '../utils/money.js';
import { generateNumber, markNumberUsed, cancelNumber } from './numbering.service.js';
import { validatePeriod } from './period.service.js';
import Decimal from 'decimal.js';

const ReversalPayloadSchema = z.object({
  tenantId: z.string().uuid(),
  salesId: z.string().uuid(),
  cashierId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

type TReversalPayload = z.infer<typeof ReversalPayloadSchema>;

export async function reversal(input: TReversalPayload) {
  const validated = ReversalPayloadSchema.parse(input);
  const prisma = new PrismaClient();

  return await prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${validated.tenantId}, TRUE)`;

    const original = await tx.salesHeader.findUnique({
      where: { id: validated.salesId, tenantId: validated.tenantId },
      include: { details: true, payments: true }
    });

    if (!original) throw new LedgerError('TEN_001');
    if (original.status === 'REFUNDED') {
      throw new LedgerError('REV_001', 'Transaksi sudah di-reversal');
    }
    if (original.status === 'LOCKED') {
      throw new LedgerError('REV_001', 'Transaksi sudah LOCKED, tidak bisa di-reversal langsung');
    }

    await validatePeriod(tx, validated.tenantId, new Date());

    const reversalNumber = await generateNumber(tx, validated.tenantId, 'INV');

    const reversal = await tx.salesHeader.create({
      data: {
        tenantId: validated.tenantId,
        outletId: original.outletId,
        invoiceNumber: reversalNumber,
        businessDate: new Date(),
        cashierId: validated.cashierId,
        subtotal: -original.subtotal,
        discount: -original.discount,
        tax: -original.tax,
        totalAmount: -original.totalAmount,
        status: 'POSTED',
        originalSalesId: original.id,
      }
    });

    for (const detail of original.details) {
      await tx.salesDetail.create({
        data: {
          salesId: reversal.id,
          menuId: detail.menuId,
          menuNameSnapshot: detail.menuNameSnapshot,
          unitPriceSnapshot: detail.unitPriceSnapshot,
          quantity: -detail.quantity,
          totalPrice: -detail.totalPrice,
          hpp: -detail.hpp,
          costingMethodSnapshot: detail.costingMethodSnapshot,
        }
      });
    }

    const consumptions = await tx.fIFOConsumption.findMany({
      where: { salesId: original.id }
    });

    for (const consumption of consumptions) {
      await tx.fIFOLayer.update({
        where: { id: consumption.layerId },
        data: { remainingQty: { increment: consumption.quantityConsumed } }
      });

      const layer = await tx.fIFOLayer.findUnique({ where: { id: consumption.layerId } });

      const balance = await tx.inventoryBalance.findFirst({
        where: {
          tenantId: validated.tenantId,
          itemId: layer.itemId,
        }
      });
      if (balance) {
        await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            currentStock: { increment: consumption.quantityConsumed },
            version: { increment: 1 }
          }
        });
      }

      await tx.inventoryLedger.create({
        data: {
          tenantId: validated.tenantId,
          outletId: original.outletId,
          warehouseId: layer.warehouseId,
          itemId: layer.itemId,
          movementType: 'REVERSAL',
          referenceType: 'REVERSAL',
          referenceId: reversal.id,
          businessDate: new Date(),
          qtyIn: consumption.quantityConsumed,
          qtyOut: 0,
          balanceAfter: 0,
          unitCost: consumption.unitCostAtTime,
          costMethod: 'FIFO',
          unitSnapshot: 'kg',
        }
      });
    }

    const originalJournal = await tx.journalEntry.findFirst({
      where: { referenceId: original.id, referenceType: 'SALE' },
      include: { lines: true }
    });

    if (originalJournal) {
      const journalNumber = await generateNumber(tx, validated.tenantId, 'JRN');

      const reversedLines = originalJournal.lines.map((l: any) => ({
        accountId: l.accountId,
        debit: new Decimal(-l.debit),
        credit: new Decimal(-l.credit),
      }));

      const balancedLines = balanceJournalLines(reversedLines);

      await tx.journalEntry.create({
        data: {
          tenantId: validated.tenantId,
          entryNumber: journalNumber,
          entryDate: new Date(),
          referenceType: 'REVERSAL',
          referenceId: reversal.id,
          description: `Reversal of ${original.invoiceNumber}: ${validated.reason}`,
          status: 'POSTED',
          lines: {
            create: balancedLines.map((l: any) => ({
              accountId: l.accountId,
              debit: l.debit.toNumber(),
              credit: l.credit.toNumber(),
            }))
          }
        }
      });
    }

    await tx.salesHeader.update({
      where: { id: original.id },
      data: { status: 'REFUNDED' }
    });

    await tx.auditLog.create({
      data: {
        tenantId: validated.tenantId,
        userId: validated.cashierId,
        action: 'REVERSAL',
        metadata: {
          originalId: original.id,
          reversalId: reversal.id,
          reason: validated.reason,
        },
      }
    });

    await markNumberUsed(tx, validated.tenantId, reversalNumber);

    return {
      reversalId: reversal.id,
      originalId: original.id,
      invoiceNumber: reversalNumber,
    };
  }, { maxWait: 5000, timeout: 10000 });
}
