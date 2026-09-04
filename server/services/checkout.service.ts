import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { z } from 'zod';
import { LedgerError } from '../utils/errorCodes.js';
import { roundMoney, balanceJournalLines } from '../utils/money.js';
import { generateNumber, markNumberUsed, cancelNumber } from './numbering.service.js';
import { validatePeriod } from './period.service.js';

const MoneyStringSchema = z.string().regex(/^\d+(\.\d{1,2})?$/);

const CheckoutItemSchema = z.object({
  menuId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const PaymentDetailSchema = z.object({
  method: z.enum(['CASH', 'QRIS', 'DEBIT', 'CREDIT', 'BANK_TRANSFER']),
  amount: MoneyStringSchema,
});

const CheckoutPayloadSchema = z.object({
  tenantId: z.string().uuid(),
  outletId: z.string().uuid(),
  cashierId: z.string().uuid(),
  items: z.array(CheckoutItemSchema).min(1),
  payments: z.array(PaymentDetailSchema).min(1),
  discountPercent: z.number().min(0).max(100).default(0),
  idempotencyKey: z.string().uuid().optional(),
});

type TCheckoutPayload = z.infer<typeof CheckoutPayloadSchema>;

export async function checkout(input: TCheckoutPayload) {
  const validated = CheckoutPayloadSchema.parse(input);
  const prisma = new PrismaClient();

  return await prisma.$transaction(async (tx: any) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${validated.tenantId}, TRUE)`;
    const businessDate = new Date();
    await validatePeriod(tx, validated.tenantId, businessDate);

    const menuIds = validated.items.map(i => i.menuId);
    const menus = await tx.menu.findMany({
      where: {
        id: { in: menuIds },
        tenantId: validated.tenantId,
        isActive: true,
      },
      include: {
        recipes: {
          where: {
            effectiveFrom: { lte: businessDate },
            OR: [
              { effectiveUntil: { gte: businessDate } },
              { effectiveUntil: null }
            ]
          },
          include: {
            details: { include: { item: true } }
          }
        }
      }
    });

    if (menus.length !== validated.items.length) {
      throw new LedgerError('VAL_002');
    }

    let subtotal = new Decimal(0);
    const rawItems: { itemId: string; quantity: Decimal }[] = [];

    for (const item of validated.items) {
      const menu = menus.find((m: any) => m.id === item.menuId);
      if (!menu) throw new LedgerError('VAL_002');

      subtotal = subtotal.plus(new Decimal(menu.price).times(item.quantity));

      const recipe = menu.recipes[0];
      if (!recipe) throw new Error('Recipe not found for menu');

      for (const detail of recipe.details) {
        rawItems.push({
          itemId: detail.itemId,
          quantity: new Decimal(detail.quantity).times(item.quantity)
        });
      }
    }

    const itemIds = rawItems.map(r => r.itemId);
    const sortedIds = [...new Set(itemIds)].sort();

    for (const id of sortedIds) {
      await tx.$queryRaw`
        SELECT * FROM inventory_balance 
        WHERE item_id = ${id} AND tenant_id = ${validated.tenantId}
        FOR UPDATE
      `;
    }

    const balances = await tx.inventoryBalance.findMany({
      where: {
        tenantId: validated.tenantId,
        itemId: { in: itemIds }
      }
    });

    for (const raw of rawItems) {
      const balance = balances.find((b: any) => b.itemId === raw.itemId);
      if (!balance || new Decimal(balance.currentStock).lessThan(raw.quantity)) {
        throw new LedgerError('INV_001', `Stok tidak cukup untuk item ${raw.itemId}`);
      }
    }

    const discountAmount = roundMoney(subtotal.times(validated.discountPercent / 100));
    const afterDiscount = roundMoney(subtotal.minus(discountAmount));
    const tax = roundMoney(afterDiscount.times(0.11));
    const total = roundMoney(afterDiscount.plus(tax));

    const invoiceNumber = await generateNumber(tx, validated.tenantId, 'INV');

    const sale = await tx.salesHeader.create({
      data: {
        tenantId: validated.tenantId,
        outletId: validated.outletId,
        invoiceNumber,
        businessDate,
        cashierId: validated.cashierId,
        subtotal: subtotal.toNumber(),
        discount: discountAmount.toNumber(),
        tax: tax.toNumber(),
        totalAmount: total.toNumber(),
        status: 'POSTED',
        idempotencyKey: validated.idempotencyKey,
      }
    });

    let totalHpp = new Decimal(0);

    for (const item of validated.items) {
      const menu = menus.find((m: any) => m.id === item.menuId);
      if (!menu) throw new LedgerError('VAL_002');

      let menuHpp = new Decimal(0);
      const recipe = menu.recipes[0];
      if (recipe) {
        for (const detail of recipe.details) {
          const layer = await tx.fIFOLayer.findFirst({
            where: {
              tenantId: validated.tenantId,
              itemId: detail.itemId,
              remainingQty: { gt: 0 },
              isExhausted: false,
            },
            orderBy: { layerDate: 'asc' }
          });

          if (!layer) throw new LedgerError('INV_003');

          const consumeQty = new Decimal(detail.quantity).times(item.quantity);
          const cost = new Decimal(layer.unitCost).times(consumeQty);
          menuHpp = menuHpp.plus(cost);
          totalHpp = totalHpp.plus(cost);

          await tx.fIFOLayer.update({
            where: { id: layer.id },
            data: { remainingQty: { decrement: consumeQty.toNumber() } }
          });

          await tx.fIFOConsumption.create({
            data: {
              tenantId: validated.tenantId,
              layerId: layer.id,
              salesId: sale.id,
              quantityConsumed: consumeQty.toNumber(),
              unitCostAtTime: layer.unitCost.toNumber(),
              consumptionDate: new Date(),
            }
          });
        }
      }

      await tx.salesDetail.create({
        data: {
          salesId: sale.id,
          menuId: menu.id,
          menuNameSnapshot: menu.name,
          unitPriceSnapshot: menu.price.toNumber(),
          quantity: item.quantity,
          totalPrice: menu.price.toNumber() * item.quantity,
          hpp: menuHpp.toNumber(),
          costingMethodSnapshot: 'FIFO',
        }
      });
    }

    for (const raw of rawItems) {
      const balance = balances.find((b: any) => b.itemId === raw.itemId);
      if (!balance) throw new LedgerError('INV_001');

      const consumeQty = raw.quantity;
      const newStock = new Decimal(balance.currentStock).minus(consumeQty);

      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          currentStock: newStock.toNumber(),
          version: { increment: 1 }
        }
      });

      await tx.inventoryLedger.create({
        data: {
          tenantId: validated.tenantId,
          outletId: validated.outletId,
          warehouseId: balance.warehouseId,
          itemId: raw.itemId,
          movementType: 'POS_SALE',
          referenceType: 'SALES_ORDER',
          referenceId: sale.id,
          businessDate: new Date(),
          qtyIn: 0,
          qtyOut: consumeQty.toNumber(),
          balanceAfter: newStock.toNumber(),
          unitCost: 0,
          costMethod: 'FIFO',
          unitSnapshot: 'kg',
        }
      });
    }

    const cashAccount = await tx.account.findFirst({ where: { tenantId: validated.tenantId, code: 'KAS' } });
    const revenueAccount = await tx.account.findFirst({ where: { tenantId: validated.tenantId, code: 'PENDAPATAN' } });
    const hppAccount = await tx.account.findFirst({ where: { tenantId: validated.tenantId, code: 'HPP' } });
    const inventoryAccount = await tx.account.findFirst({ where: { tenantId: validated.tenantId, code: 'PERSEDIAAN' } });
    const taxAccount = await tx.account.findFirst({ where: { tenantId: validated.tenantId, code: 'PAJAK' } });

    if (!cashAccount || !revenueAccount || !hppAccount || !inventoryAccount) {
      throw new LedgerError('SYS_001', 'Account not found');
    }

    const journalNumber = await generateNumber(tx, validated.tenantId, 'JRN');

    let lines = [
      { accountId: cashAccount.id, debit: total, credit: new Decimal(0) },
      { accountId: revenueAccount.id, debit: new Decimal(0), credit: afterDiscount },
      { accountId: hppAccount.id, debit: totalHpp, credit: new Decimal(0) },
      { accountId: inventoryAccount.id, debit: new Decimal(0), credit: totalHpp },
    ];

    if (tax.greaterThan(0) && taxAccount) {
      lines.push({ accountId: taxAccount.id, debit: tax, credit: new Decimal(0) });
    }

    lines = balanceJournalLines(lines);

    await tx.journalEntry.create({
      data: {
        tenantId: validated.tenantId,
        entryNumber: journalNumber,
        entryDate: new Date(),
        referenceType: 'SALE',
        referenceId: sale.id,
        description: `Penjualan ${invoiceNumber}`,
        status: 'POSTED',
        lines: {
          create: lines.map((l: any) => ({
            accountId: l.accountId,
            debit: l.debit.toNumber(),
            credit: l.credit.toNumber(),
          }))
        }
      }
    });

    for (const payment of validated.payments) {
      await tx.payment.create({
        data: {
          salesId: sale.id,
          method: payment.method,
          amount: new Decimal(payment.amount).toNumber(),
          status: 'PAID',
        }
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId: validated.tenantId,
        userId: validated.cashierId,
        action: 'SALE',
        metadata: { invoiceNumber, total: total.toNumber() },
      }
    });

    await markNumberUsed(tx, validated.tenantId, invoiceNumber);

    return sale;
  }, { maxWait: 5000, timeout: 10000 });
}
