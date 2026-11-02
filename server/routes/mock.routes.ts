import { FastifyInstance } from "fastify";
import { catalogRoutes } from "./catalog.routes.ts";
import { qrTableRoutes } from "./qr-table.routes.ts";
import { paymentRoutes } from "./payment.routes.ts";
import { procurementRoutes } from "./procurement.routes.ts";
import { analyticsRoutes } from "./analytics.routes.ts";
import { superadminRoutes } from "./superadmin.routes.ts";
import { mediaRoutes } from "./media.routes.ts";

/**
 * Enterprise Domain Route Aggregator
 * Registers all modular domain route plugins under /api while preserving 100% route compatibility.
 */
export async function mockRoutes(fastify: FastifyInstance) {
  await fastify.register(mediaRoutes);
  await fastify.register(catalogRoutes);
  await fastify.register(qrTableRoutes);
  await fastify.register(paymentRoutes);
  await fastify.register(procurementRoutes);
  await fastify.register(analyticsRoutes);
  await fastify.register(superadminRoutes);
}
