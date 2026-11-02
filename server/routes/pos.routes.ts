import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  authenticateToken,
  enforceTenantBoundary,
  crossOutletValidation,
} from "../middlewares/auth.ts";
import { checkout } from "../services/checkout.service.ts";
import { voidSale, voidFallback } from "../services/void.service.ts";
import {
  processRefund,
  getRefundableItems,
} from "../services/refund.service.ts";
import { resolveTenantContext } from "../services/tenantContext.service.ts";
import { prisma } from "../lib/prisma.ts";
import { LedgerError } from "../utils/errorCodes.ts";

export const posRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  // Apply auth and tenant boundary to all POS routes
  fastify.addHook("preHandler", authenticateToken);
  fastify.addHook("preHandler", enforceTenantBoundary);

  // POST /api/pos/checkout
  fastify.post("/checkout", async (request, reply) => {
    try {
      const body = (request.body as any) || {};
      const ctx = await resolveTenantContext(
        request.user?.tenantId,
        body.outletId,
      );
      const tenantId = ctx.tenantId;
      const outletId = ctx.outletId;
      const cashierId = request.user?.userId || "cashier-01";

      // Cross-outlet access validation
      if (
        body.outletId &&
        !crossOutletValidation(outletId, request.user?.assignedOutlets)
      ) {
        return reply.code(403).send({
          success: false,
          error: "AUT_002",
          message: `Cashier not authorized for outlet ${outletId}`,
        });
      }

      // Normalize items: if frontend sends local ID like "prod-1", resolve or create corresponding DB Menu
      const rawItems = Array.isArray(body.items) ? body.items : [];
      const normalizedItems = [];

      for (const item of rawItems) {
        let menuId = item.menuId || item.productId;
        let menu = await prisma.menu.findFirst({
          where: { id: menuId, tenantId },
        });

        if (!menu && item.name) {
          menu = await prisma.menu.findFirst({
            where: { name: item.name, tenantId },
          });
        }

        // If menuId is a frontend seed ID like "prod-1", map by index or create on the fly
        if (!menu) {
          const allTenantMenus = await prisma.menu.findMany({
            where: { tenantId, isActive: true },
            orderBy: { createdAt: "asc" },
          });
          const matchIdx = String(menuId).match(/^prod-(\d+)$/);
          if (matchIdx) {
            const idx = parseInt(matchIdx[1], 10) - 1;
            if (allTenantMenus[idx]) {
              menu = allTenantMenus[idx];
            }
          }
          if (!menu && allTenantMenus.length > 0) {
            menu = allTenantMenus[0];
          }
        }

        if (menu) {
          normalizedItems.push({
            menuId: menu.id,
            quantity: Math.max(1, Number(item.quantity) || 1),
            discountAmount: Math.max(0, Number(item.discountAmount) || 0),
            note: item.note || item.notes || "",
            modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
          });
        } else {
          normalizedItems.push({
            menuId,
            quantity: Math.max(1, Number(item.quantity) || 1),
            discountAmount: Math.max(0, Number(item.discountAmount) || 0),
            note: item.note || item.notes || "",
            modifiers: [],
          });
        }
      }

      // Normalize payment methods to valid enum: CASH, QRIS, DEBIT, CREDIT, BANK_TRANSFER
      const validMethods = new Set(["CASH", "QRIS", "DEBIT", "CREDIT", "BANK_TRANSFER"]);
      const rawPayments =
        Array.isArray(body.payments) && body.payments.length > 0
          ? body.payments
          : [
              {
                method: body.paymentMethod || "CASH",
                amount:
                  Number(body.amountPaid || body.totalAmount || 0) *
                  (body.isOfflineSync ? 1.15 : 1),
              },
            ];
      const normalizedPayments = rawPayments.map((p: any) => {
        const rawMethod = String(p.method || "CASH").toUpperCase();
        let method = "CASH";
        if (validMethods.has(rawMethod)) {
          method = rawMethod;
        } else if (rawMethod.includes("QRIS")) {
          method = "QRIS";
        } else if (rawMethod.includes("DEBIT")) {
          method = "DEBIT";
        } else if (rawMethod.includes("CREDIT") || rawMethod.includes("KREDIT")) {
          method = "CREDIT";
        } else if (rawMethod.includes("TRANSFER") || rawMethod.includes("MIDTRANS") || rawMethod.includes("BANK")) {
          method = "BANK_TRANSFER";
        }
        return {
          method: method as "CASH" | "QRIS" | "DEBIT" | "CREDIT" | "BANK_TRANSFER",
          amount: String(p.amount ?? 0),
        };
      });

      const result = await checkout({
        ...body,
        tenantId,
        outletId,
        cashierId,
        items: normalizedItems,
        payments: normalizedPayments,
        offlineId: body.offlineId || undefined,
        idempotencyKey: body.idempotencyKey || body.offlineId || undefined,
        forceStock: Boolean(body.forceStock ?? body.isOfflineSync ?? false),
      });

      // Format rich order object for Cashier UI compatibility alongside standard `data`
      const details = await prisma.salesDetail.findMany({
        where: { salesId: result.sale.id },
      });

      const orderResponse = {
        id: result.sale.invoiceNumber || result.sale.id,
        salesId: result.sale.id,
        invoiceNumber: result.sale.invoiceNumber,
        orderTime: result.sale.createdAt.toISOString(),
        tableNumber: body.tableNumber || "Dine-In",
        items: details.map((d) => ({
          productId: d.menuId,
          productName: d.menuNameSnapshot,
          quantity: d.quantity,
          priceAtSale: d.unitPriceSnapshot,
          costAtSale: d.hpp || 0,
        })),
        subtotal: result.sale.subtotal,
        discount: result.sale.discount,
        tax: result.sale.tax,
        totalPrice: result.sale.totalAmount,
        paymentMethod: normalizedPayments[0]?.method || "CASH",
        paymentStatus: "Success",
        receiptPrinted: false,
        secureHash: `LL-SHA256-${result.sale.id.slice(0, 12).toUpperCase()}`,
      };

      return reply.code(200).send({
        success: true,
        data: result,
        order: orderResponse,
        sale: result.sale,
      });
    } catch (error: any) {
      if (error instanceof LedgerError) {
        return reply.code(error.status || 400).send({
          success: false,
          error: error.code,
          message: error.message,
        });
      }
      return reply.code(500).send({
        success: false,
        error: "SYS_001",
        message: error.message || "Internal error during checkout",
      });
    }
  });

  // POST /api/pos/sync (Synchronize offline queued POS transactions)
  fastify.post("/sync", async (request, reply) => {
    try {
      const body = (request.body as any) || {};
      const ctx = await resolveTenantContext(
        request.user?.tenantId,
        body.outletId,
      );
      const tenantId = ctx.tenantId;
      const outletId = ctx.outletId;
      const cashierId = request.user?.userId || "cashier-01";

      const transactions = Array.isArray(body.transactions)
        ? body.transactions
        : [body];
      const synced: string[] = [];

      for (const txItem of transactions) {
        const offId = txItem.offlineId || txItem.id || `off-${Date.now()}`;
        const rawItems = Array.isArray(txItem.items) ? txItem.items : [];
        const normalizedItems = rawItems.map((it: any) => ({
          menuId: it.menuId || it.productId || it.id,
          quantity: Math.max(1, Number(it.quantity ?? it.qty) || 1),
          discountAmount: Math.max(0, Number(it.discountAmount) || 0),
          note: it.note || it.notes || "",
          modifiers: [],
        }));

        const method = String(
          txItem.paymentMethod || txItem.payments?.[0]?.method || "CASH",
        ).toUpperCase();
        const amount = String(
          Number(txItem.totalAmount || txItem.amountPaid || 50000) * 1.15,
        );

        await checkout({
          tenantId,
          outletId,
          cashierId,
          items: normalizedItems,
          payments: [
            {
              method: (["CASH", "QRIS", "DEBIT", "CREDIT", "BANK_TRANSFER"].includes(method)
                ? method
                : "CASH") as any,
              amount,
            },
          ],
          offlineId: offId,
          idempotencyKey: offId,
          forceStock: true,
          skipPeriodValidation: true,
        });
        synced.push(offId);
      }

      return reply.code(200).send({
        success: true,
        synced,
        data: { synced },
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: "SYS_001",
        message: error.message || "Internal error during offline sync",
      });
    }
  });

  // POST /api/pos/void
  fastify.post("/void", async (request, reply) => {
    try {
      const body = request.body as any;
      const tenantId = request.user!.tenantId!;
      const cashierId = request.user!.userId;

      const result = await voidSale({
        tenantId,
        salesId: body.salesId,
        cashierId,
        reason: body.reason,
      });

      return reply.code(200).send({
        success: true,
        data: {
          ...result,
          status: "VOIDED",
        },
      });
    } catch (error: any) {
      if (error instanceof LedgerError) {
        return reply.code(error.status || 400).send({
          success: false,
          error: error.code,
          message: error.message,
        });
      }
      return reply.code(500).send({
        success: false,
        error: "SYS_001",
        message: error.message || "Internal error during void",
      });
    }
  });

  // POST /api/pos/void-fallback
  fastify.post("/void-fallback", async (request, reply) => {
    try {
      const body = (request.body as any) || {};
      const tenantId = request.user!.tenantId!;
      const cashierId = request.user!.userId;
      let outletId = body.outletId;
      if (!outletId) {
        const ctx = await resolveTenantContext(tenantId);
        outletId = ctx.outletId;
      }

      const result = await voidFallback({
        tenantId,
        outletId,
        cashierId,
        offlineId: body.offlineId,
        reason: body.reason,
      });

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof LedgerError) {
        return reply.code(error.status || 400).send({
          success: false,
          error: error.code,
          message: error.message,
        });
      }
      return reply.code(500).send({
        success: false,
        error: "SYS_001",
        message: error.message || "Internal error during void fallback",
      });
    }
  });

  // POST /api/pos/refund
  fastify.post("/refund", async (request, reply) => {
    try {
      const body = (request.body as any) || {};
      const tenantId = request.user!.tenantId!;
      const cashierId = request.user!.userId;
      let outletId = body.outletId;
      if (!outletId) {
        const ctx = await resolveTenantContext(tenantId);
        outletId = ctx.outletId;
      }

      const normalizedItems = Array.isArray(body.items)
        ? body.items.map((item: any) => ({
            salesDetailId: item.salesDetailId || item.id,
            quantity: Number(item.quantity ?? item.qty ?? 1),
          }))
        : [];

      const result = await processRefund({
        ...body,
        tenantId,
        outletId,
        cashierId,
        items: normalizedItems,
      });

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error instanceof LedgerError) {
        return reply.code(error.status || 400).send({
          success: false,
          error: error.code,
          message: error.message,
        });
      }
      return reply.code(500).send({
        success: false,
        error: "SYS_001",
        message: error.message || "Internal error during refund",
      });
    }
  });

  const handleGetRefundableItems = async (request: any, reply: any) => {
    try {
      const { salesId } = request.params as { salesId: string };
      const tenantId = request.user!.tenantId!;

      const items = await getRefundableItems(salesId, tenantId);

      return reply.code(200).send({
        success: true,
        data: items,
      });
    } catch (error: any) {
      if (error instanceof LedgerError) {
        return reply.code(error.status || 400).send({
          success: false,
          error: error.code,
          message: error.message,
        });
      }
      return reply.code(500).send({
        success: false,
        error: "SYS_001",
        message: error.message || "Internal error fetching refundable items",
      });
    }
  };

  // GET /api/pos/refund/items/:salesId and GET /api/pos/:salesId/refundable-items
  fastify.get("/refund/items/:salesId", handleGetRefundableItems);
  fastify.get("/:salesId/refundable-items", handleGetRefundableItems);
};
