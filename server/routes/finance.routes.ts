import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  authenticateToken,
  enforceTenantBoundary,
} from "../middlewares/auth.ts";
import { TrueHppService } from "../services/finance.service.ts";
import { dailyClosing } from "../workers/dailyClosingWorker.ts";
import { LedgerError } from "../utils/errorCodes.ts";
import { exportToGoogleSheets } from "../lib/gdrive.ts";

const financeService = new TrueHppService();

export const financeRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  fastify.addHook("preHandler", authenticateToken);
  fastify.addHook("preHandler", enforceTenantBoundary);

  // POST /api/finance/export-drive
  fastify.post(
    "/export-drive",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { accessToken, rows, reportName } = request.body as any;
        if (!accessToken || !rows) {
          return reply
            .code(400)
            .send({ success: false, message: "Missing accessToken or rows" });
        }

        const result = await exportToGoogleSheets(
          accessToken,
          reportName || "Laporan Keuangan",
          rows,
        );

        return reply.code(200).send({
          success: true,
          data: result,
        });
      } catch (error: any) {
        return reply.code(500).send({
          success: false,
          message: error.message,
        });
      }
    },
  );

  // POST /api/finance/log
  fastify.post("/log", async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({ success: true, message: "Log saved (mock)" });
  });

  // POST /api/backup/restore
  fastify.post(
    "/backup/restore",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply
        .code(200)
        .send({ success: true, message: "Backup restored (mock)" });
    },
  );

  // GET /api/finance/true-hpp
  fastify.get("/true-hpp", async (request, reply) => {
    try {
      const tenantId = request.user!.tenantId!;
      const dateStr = (request.query as any)?.date;
      const date = dateStr ? new Date(dateStr) : new Date();

      const result = await financeService.getDashboardPerformance(
        tenantId,
        date,
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

  // GET /api/finance/profit-loss
  fastify.get("/profit-loss", async (request, reply) => {
    try {
      const tenantId = request.user!.tenantId!;
      const query = request.query as any;

      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date(new Date().setDate(1));
      const endDate = query.endDate ? new Date(query.endDate) : new Date();

      const result = await financeService.getProfitAndLoss(
        tenantId,
        startDate,
        endDate,
      );

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

  // POST /api/finance/daily-closing
  fastify.post("/daily-closing", async (request, reply) => {
    try {
      const tenantId = request.user!.tenantId!;

      await dailyClosing(tenantId);

      return reply.code(200).send({
        success: true,
        message: "Daily closing triggered and completed successfully",
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
