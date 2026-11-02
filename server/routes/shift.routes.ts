import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  authenticateToken,
  enforceTenantBoundary,
} from "../middlewares/auth.ts";
import { AttendanceService } from "../services/shift.service.ts";
import { LedgerError } from "../utils/errorCodes.ts";
import { resolveTenantContext } from "../services/tenantContext.service.ts";

const attendanceService = new AttendanceService();

export const shiftRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  fastify.addHook("preHandler", authenticateToken);
  fastify.addHook("preHandler", enforceTenantBoundary);

  // POST /api/shift/open
  fastify.post("/open", async (request, reply) => {
    try {
      const body = (request.body as { outletId?: string }) || {};
      const ctx = await resolveTenantContext(
        request.user?.tenantId,
        body.outletId,
      );
      const cashierId = request.user!.userId;

      const result = await attendanceService.openShift(cashierId, ctx.outletId);

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

  const handleCloseShift = async (request: any, reply: any) => {
    try {
      const params = (request.params as { id?: string }) || {};
      const body = (request.body as { shiftId?: string; actualCash?: number }) || {};
      const shiftId = params.id || body.shiftId || "";

      const result = await attendanceService.closeShift(
        shiftId,
        body.actualCash ?? 0,
      );

      return reply.code(200).send({
        success: true,
        data: {
          ...result,
          difference: result.variance ?? 0,
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
        message: error.message,
      });
    }
  };

  // POST /api/shift/close and POST /api/shift/:id/close
  fastify.post("/close", handleCloseShift);
  fastify.post("/:id/close", handleCloseShift);

  // GET /api/shift/current
  fastify.get("/current", async (request, reply) => {
    try {
      const cashierId = request.user!.userId;
      const shift = await attendanceService.getCurrentShift(cashierId);

      return reply.code(200).send({
        success: true,
        data: shift,
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: "SYS_001",
        message: error.message,
      });
    }
  });

  // POST /api/shift/attendance
  fastify.post("/attendance", async (request, reply) => {
    try {
      const body = (request.body as { outletId?: string }) || {};
      const ctx = await resolveTenantContext(
        request.user?.tenantId,
        body.outletId,
      );
      const userId = request.user!.userId;

      const result = await attendanceService.recordAttendance(
        userId,
        ctx.outletId,
      );

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
};
