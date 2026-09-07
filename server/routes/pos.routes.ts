import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authenticateToken, enforceTenantBoundary, crossOutletValidation } from '../middlewares/auth.ts';
import { checkout } from '../services/checkout.service.ts';
import { voidSale, voidFallback } from '../services/void.service.ts';
import { processRefund, getRefundableItems } from '../services/refund.service.ts';
import { LedgerError } from '../utils/errorCodes.ts';

export const posRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Apply auth and tenant boundary to all POS routes
  fastify.addHook('preHandler', authenticateToken);
  fastify.addHook('preHandler', enforceTenantBoundary);

  // POST /api/pos/checkout
  fastify.post('/checkout', async (request, reply) => {
    try {
      const body = request.body as any;
      const tenantId = request.user!.tenantId!;
      const cashierId = request.user!.userId;

      // Cross-outlet access validation
      if (body.outletId && !crossOutletValidation(body.outletId, request.user?.assignedOutlets)) {
        return reply.code(403).send({
          success: false,
          error: 'AUT_002',
          message: `Cashier not authorized for outlet ${body.outletId}`,
        });
      }

      const result = await checkout({
        ...body,
        tenantId,
        cashierId,
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
        error: 'SYS_001',
        message: error.message || 'Internal error during checkout',
      });
    }
  });

  // POST /api/pos/void
  fastify.post('/void', async (request, reply) => {
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
        error: 'SYS_001',
        message: error.message || 'Internal error during void',
      });
    }
  });

  // POST /api/pos/void-fallback
  fastify.post('/void-fallback', async (request, reply) => {
    try {
      const body = request.body as any;
      const tenantId = request.user!.tenantId!;
      const cashierId = request.user!.userId;

      const result = await voidFallback({
        tenantId,
        outletId: body.outletId,
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
        error: 'SYS_001',
        message: error.message || 'Internal error during void fallback',
      });
    }
  });

  // POST /api/pos/refund
  fastify.post('/refund', async (request, reply) => {
    try {
      const body = request.body as any;
      const tenantId = request.user!.tenantId!;
      const cashierId = request.user!.userId;

      const result = await processRefund({
        ...body,
        tenantId,
        cashierId,
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
        error: 'SYS_001',
        message: error.message || 'Internal error during refund',
      });
    }
  });

  // GET /api/pos/refund/items/:salesId
  fastify.get('/refund/items/:salesId', async (request, reply) => {
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
        error: 'SYS_001',
        message: error.message || 'Internal error fetching refundable items',
      });
    }
  });
};
