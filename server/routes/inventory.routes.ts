import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { authenticateToken, enforceTenantBoundary } from '../middlewares/auth.ts';
import { StockOpnameService, WasteService } from '../services/inventory.service.ts';
import { LedgerError } from '../utils/errorCodes.ts';

const opnameService = new StockOpnameService();
const wasteService = new WasteService();

export const inventoryRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticateToken);
  fastify.addHook('preHandler', enforceTenantBoundary);

  // Stock Opname
  fastify.post('/opname', async (request, reply) => {
    try {
      const body = request.body as any;
      const tenantId = request.user!.tenantId!;

      const result = await opnameService.create({
        ...body,
        tenantId,
      });

      return reply.code(201).send({
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
        message: error.message,
      });
    }
  });

  fastify.post('/opname/:id/confirm', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = request.user!.userId;

      const result = await opnameService.confirm(id, userId);

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
        message: error.message,
      });
    }
  });

  fastify.get('/opname', async (request, reply) => {
    try {
      const { status } = request.query as { status?: string };
      const tenantId = request.user!.tenantId!;

      const result = await opnameService.list(tenantId, status);

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: 'SYS_001',
        message: error.message,
      });
    }
  });

  // Waste Management
  fastify.post('/waste', async (request, reply) => {
    try {
      const body = request.body as any;
      const tenantId = request.user!.tenantId!;
      const userId = request.user!.userId;

      const result = await wasteService.create({
        ...body,
        tenantId,
        createdBy: userId,
      });

      return reply.code(201).send({
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
        message: error.message,
      });
    }
  });

  fastify.post('/waste/:id/approve', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = request.user!.userId;

      const result = await wasteService.approve(id, userId);

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
        message: error.message,
      });
    }
  });

  fastify.get('/waste', async (request, reply) => {
    try {
      const { status } = request.query as { status?: string };
      const tenantId = request.user!.tenantId!;

      const result = await wasteService.list(tenantId, status);

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: 'SYS_001',
        message: error.message,
      });
    }
  });
};
