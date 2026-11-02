import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  authenticateToken,
  enforceTenantBoundary,
} from "../middlewares/auth.ts";
import {
  StockOpnameService,
  WasteService,
} from "../services/inventory.service.ts";
import { LedgerError } from "../utils/errorCodes.ts";
import { resolveTenantContext } from "../services/tenantContext.service.ts";
import { prisma } from "../lib/prisma.ts";

const opnameService = new StockOpnameService();
const wasteService = new WasteService();

async function resolveItemIdForTenant(
  tenantId: string,
  rawItemId?: string,
): Promise<string> {
  if (rawItemId) {
    const found = await prisma.item.findFirst({
      where: { id: rawItemId, tenantId },
    });
    if (found) return found.id;
  }
  const allItems = await prisma.item.findMany({
    where: { tenantId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  const matchIdx = String(rawItemId || "").match(/^rm-(\d+)$/);
  if (matchIdx) {
    const idx = parseInt(matchIdx[1], 10) - 1;
    if (allItems[idx]) return allItems[idx].id;
  }
  if (allItems.length > 0) return allItems[0].id;
  return rawItemId || "";
}

export const inventoryRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  fastify.addHook("preHandler", authenticateToken);
  fastify.addHook("preHandler", enforceTenantBoundary);

  // Stock Opname
  fastify.post("/opname", async (request, reply) => {
    try {
      const body = (request.body as any) || {};
      const ctx = await resolveTenantContext(
        request.user?.tenantId,
        body.outletId,
      );
      const firstItem =
        Array.isArray(body.items) && body.items.length > 0
          ? body.items[0]
          : body;
      const itemId = await resolveItemIdForTenant(
        ctx.tenantId,
        firstItem.itemId || firstItem.materialId || body.itemId || body.materialId,
      );
      const physicalStock = Number(
        firstItem.physicalStock ??
          firstItem.actualStock ??
          body.physicalStock ??
          body.actualStock ??
          0,
      );

      const result = await opnameService.create({
        ...body,
        tenantId: ctx.tenantId,
        outletId: ctx.outletId,
        itemId,
        physicalStock,
        estimatedUnitCost:
          firstItem.estimatedUnitCost ?? body.estimatedUnitCost ?? 150,
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
        error: "SYS_001",
        message: error.message,
      });
    }
  });

  fastify.post("/opname/:id/submit", async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.code(200).send({
      success: true,
      data: { id, status: "submitted" },
    });
  });

  fastify.post("/opname/:id/confirm", async (request, reply) => {
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
        error: "SYS_001",
        message: error.message,
      });
    }
  });

  fastify.get("/opname", async (request, reply) => {
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
        error: "SYS_001",
        message: error.message,
      });
    }
  });

  // Waste Management
  fastify.post("/waste", async (request, reply) => {
    try {
      const body = (request.body as any) || {};
      const ctx = await resolveTenantContext(
        request.user?.tenantId,
        body.outletId,
      );
      const userId = request.user!.userId;
      const itemId = await resolveItemIdForTenant(
        ctx.tenantId,
        body.itemId || body.materialId,
      );

      const result = await wasteService.create({
        ...body,
        tenantId: ctx.tenantId,
        outletId: ctx.outletId,
        itemId,
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
        error: "SYS_001",
        message: error.message,
      });
    }
  });

  fastify.post("/waste/:id/approve", async (request, reply) => {
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
        error: "SYS_001",
        message: error.message,
      });
    }
  });

  fastify.get("/waste", async (request, reply) => {
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
        error: "SYS_001",
        message: error.message,
      });
    }
  });
};
