import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.ts";

export async function migrationRoutes(fastify: FastifyInstance) {
  // Helper to ensure at least one sample migration request exists for demo/testing
  const ensureSampleRequest = async () => {
    try {
      const count = await prisma.migrationJob.count();
      if (count === 0) {
        const tenant = await prisma.tenant.findFirst();
        if (tenant) {
          await prisma.migrationJob.create({
            data: {
              tenantId: tenant.id,
              sourceSystem: "Moka POS",
              fileUrl: "export_menu_moka.csv",
              status: "WAITING_FILE",
              validationErrors: "Permintaan migrasi katalog produk dari Moka POS.",
            },
          });
        }
      }
    } catch (e) {
      console.warn("Could not seed initial migration job:", e);
    }
  };

  // GET /requests or GET /
  const getRequestsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    await ensureSampleRequest();

    try {
      const jobs = await prisma.migrationJob.findMany({
        include: {
          tenant: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const formatted = jobs.map((job) => ({
        id: job.id,
        tenantId: job.tenantId,
        tenant: {
          id: job.tenant?.id || job.tenantId,
          name: job.tenant?.name || "Store",
          storeName: job.tenant?.name || "Store",
        },
        previousPos: job.sourceSystem || "Moka POS",
        status: (job.status || "PENDING").toUpperCase(),
        files: job.fileUrl
          ? [
              {
                name: job.fileUrl.split("/").pop() || "export_data.csv",
                url: job.fileUrl,
              },
            ]
          : [],
        notes: job.validationErrors || "",
        createdAt: job.createdAt.toISOString(),
      }));

      return reply.send(formatted);
    } catch (error: any) {
      console.error("Error fetching migration requests:", error);
      return reply.send([]);
    }
  };

  fastify.get("/requests", getRequestsHandler);
  fastify.get("/", getRequestsHandler);

  // PATCH or POST /requests/:id/status
  const updateStatusHandler = async (
    request: FastifyRequest<{ Params: { id: string }; Body: { status: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = request.params;
    const { status } = request.body || {};

    if (!status) {
      return reply.status(400).send({ success: false, error: "Status is required" });
    }

    try {
      const updated = await prisma.migrationJob.update({
        where: { id },
        data: {
          status: status.toUpperCase(),
        },
      });
      return reply.send({ success: true, request: updated });
    } catch (error: any) {
      console.error(`Error updating migration request ${id}:`, error);
      return reply.status(500).send({ success: false, error: error.message });
    }
  };

  fastify.patch("/requests/:id/status", updateStatusHandler);
  fastify.post("/requests/:id/status", updateStatusHandler);

  // POST /requests/:id/import
  fastify.post(
    "/requests/:id/import",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          tenantId: string;
          mappedProducts: Array<{
            name: string;
            category?: string;
            price?: number;
            costPrice?: number;
          }>;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const { tenantId, mappedProducts } = request.body || {};

      if (!mappedProducts || !Array.isArray(mappedProducts)) {
        return reply
          .status(400)
          .send({ success: false, error: "mappedProducts array is required" });
      }

      try {
        let targetTenantId = tenantId;
        if (!targetTenantId) {
          const job = await prisma.migrationJob.findUnique({ where: { id } });
          targetTenantId = job?.tenantId || (await prisma.tenant.findFirst())?.id || "";
        }

        let importedCount = 0;
        for (const item of mappedProducts) {
          if (!item.name) continue;
          await prisma.menu.create({
            data: {
              tenantId: targetTenantId,
              name: item.name,
              category: item.category || "General",
              price: Number(item.price) || 0,
              isActive: true,
            },
          });
          importedCount++;
        }

        await prisma.migrationJob.update({
          where: { id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });

        return reply.send({
          success: true,
          imported: importedCount,
          message: `Successfully imported ${importedCount} products into database.`,
        });
      } catch (error: any) {
        console.error(`Error importing migration data for ${id}:`, error);
        return reply.status(500).send({ success: false, error: error.message });
      }
    },
  );
}
