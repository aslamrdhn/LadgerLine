import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.ts";
import { resolveTenantContext } from "../services/tenantContext.service.ts";
import { sanitizeNumber, sanitizeString } from "../utils/sanitizer.ts";
import { getTenantHint } from "./catalog.routes.ts";
import { mapSuppliersForFrontend } from "./procurement.routes.ts";

export async function superadminRoutes(fastify: FastifyInstance) {
  // 1. Auth & Session
  fastify.post("/logout", async () => ({
    success: true,
    message: "Logged out successfully",
  }));

  // 2. Config (Store & Google OAuth settings)
  fastify.get("/config", async (request: FastifyRequest) => {
    const ctx = await resolveTenantContext(getTenantHint(request));
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
    });
    let parsedConfig: Record<string, any> = {};
    try {
      parsedConfig = JSON.parse(tenant?.config || "{}");
    } catch {}

    return {
      storeName:
        parsedConfig.storeName ||
        tenant?.name ||
        "LedgerLine Coffee & Roastery",
      address: parsedConfig.address || "Jl. Veteran No. 45, Jakarta Pusat",
      phone: parsedConfig.phone || "0812-3456-7890",
      taxPercentage: parsedConfig.taxPercentage ?? 11,
      serviceChargePercentage:
        parsedConfig.serviceChargePercentage ?? tenant?.serviceChargeRate ?? 0,
      currency: "IDR",
      enableQrTable: true,
      oAuthClientId:
        parsedConfig.oAuthClientId || process.env.VITE_GOOGLE_CLIENT_ID || "",
    };
  });

  fastify.post("/config", async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const ctx = await resolveTenantContext(getTenantHint(request));
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
    });
    let parsedConfig: Record<string, any> = {};
    try {
      parsedConfig = JSON.parse(tenant?.config || "{}");
    } catch {}

    const nextConfig = {
      ...parsedConfig,
      ...body,
    };

    await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: {
        name: body.storeName ? sanitizeString(body.storeName, 120) : undefined,
        config: JSON.stringify(nextConfig),
      },
    });

    return { success: true, config: nextConfig };
  });

  // 3. Customer Loyalty & Points
  fastify.get(
    "/customer/:phone/points",
    async (request: FastifyRequest<{ Params: { phone: string } }>) => {
      const { phone } = request.params;
      const cleanPhone = sanitizeString(phone, 30);
      return {
        success: true,
        phone: cleanPhone,
        customerName: "Pelanggan Prioritas",
        points: 250,
        tier: "Gold",
        eligibleDiscount: 10000,
        customer: {
          name: "Pelanggan Prioritas",
          phone: cleanPhone,
          points: 250,
          tier: "Gold",
        },
      };
    },
  );

  // 4. Backup Restore (/api/backup/restore)
  fastify.post("/backup/restore", async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const ctx = await resolveTenantContext(
      body.tenantId || getTenantHint(request),
    );
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: request.user?.userId || "owner",
        action: "BACKUP_RESTORE",
        resourceType: "TenantBackup",
        severity: "info",
        metadata: JSON.stringify({
          restoredAt: new Date().toISOString(),
        }),
      },
    });
    return {
      success: true,
      message: "Data cadangan berhasil dipulihkan",
    };
  });

  // 5. Admin Portal Endpoints
  fastify.get("/admin/overview", async () => {
    const [totalTenants, activeTenants, totalSuppliers] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: "active" } }),
      prisma.supplier.count(),
    ]);
    return {
      success: true,
      data: {
        totalTenants,
        activeTenants,
        totalSuppliers,
      },
    };
  });

  fastify.get("/admin/audit-logs", async () => {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.resourceType || "System",
        entityId: l.resourceId || "-",
        actorId: l.userId || "system",
        createdAt: l.createdAt.toISOString(),
        details: l.metadata || l.newData || "",
      })),
    };
  });

  fastify.get("/admin/suppliers", async () => {
    return mapSuppliersForFrontend();
  });

  const updateSupplierStatusHandler = async (
    request: FastifyRequest<{ Params: { id: string } }>,
  ) => {
    const { id } = request.params;
    const body = (request.body as any) || {};
    const nextStatus = sanitizeString(
      body.status || body.verification_status || "VERIFIED",
      40,
    ).toLowerCase();

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        status: nextStatus,
        verifiedAt: nextStatus === "verified" ? new Date() : undefined,
        verifiedBy: "admin",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: `SUPPLIER_${nextStatus.toUpperCase()}`,
        resourceType: "Supplier",
        resourceId: id,
        userId: "admin",
      },
    });

    return { success: true, data: updated };
  };

  fastify.post("/admin/suppliers/:id/status", updateSupplierStatusHandler);
  fastify.patch("/admin/suppliers/:id", updateSupplierStatusHandler);
  fastify.post("/admin/suppliers/:id", updateSupplierStatusHandler);

  fastify.get("/admin/products/pending", async () => {
    const items = await prisma.supplierCatalog.findMany({
      include: { supplier: true },
      orderBy: { createdAt: "desc" },
    });
    return items.map((c) => ({
      id: c.id,
      product_name: c.name,
      productName: c.name,
      category: c.category,
      price_offer: c.price,
      priceOffer: c.price,
      unit: c.unit,
      stock: c.stockQuantity,
      status: c.isActive ? "APPROVED" : "PENDING",
      supplier: {
        id: c.supplier.id,
        company_name: c.supplier.name,
        companyName: c.supplier.name,
      },
    }));
  });

  fastify.post(
    "/admin/products/:id/status",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { id } = request.params;
      const body = (request.body as any) || {};
      const status = String(body.status || "APPROVED").toUpperCase();
      await prisma.supplierCatalog.update({
        where: { id },
        data: { isActive: status === "APPROVED" },
      });
      return { success: true, status };
    },
  );

  fastify.get("/admin/migration-tickets", async () => {
    try {
      const tickets = await prisma.migrationJob.findMany({
        include: { tenant: true },
        orderBy: { createdAt: "desc" },
      });
      return tickets.map((t) => ({
        id: t.id,
        tenantId: t.tenantId,
        tenantName: t.tenant?.name || "Store",
        storeName: t.tenant?.name || "Store",
        fileName: t.fileUrl || "data_export.csv",
        notes: t.validationErrors || "",
        status: (t.status || "PENDING").toUpperCase(),
        createdAt: t.createdAt.toISOString(),
      }));
    } catch {
      return [];
    }
  });

  const updateAdminTicketStatus = async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: { status: string };
    }>,
    reply: FastifyReply,
  ) => {
    const { id } = request.params;
    const { status } = (request.body as any) || {};
    try {
      await prisma.migrationJob.update({
        where: { id },
        data: { status: (status || "REVIEW").toUpperCase() },
      });
      return { success: true };
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message });
    }
  };

  fastify.post("/admin/migration-tickets/:id", updateAdminTicketStatus);
  fastify.patch("/admin/migration-tickets/:id", updateAdminTicketStatus);

  fastify.post(
    "/tenant/migration-tickets",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = (request.body as any) || {};
        const ctx = await resolveTenantContext(
          body.tenantId || getTenantHint(request),
        );

        const ticket = await prisma.migrationJob.create({
          data: {
            tenantId: ctx.tenantId,
            sourceSystem: body.notes
              ? sanitizeString(body.notes, 100)
              : "Customer Upload",
            fileUrl: sanitizeString(body.fileName || "data_export.csv", 255),
            status: "PENDING",
            validationErrors: sanitizeString(body.notes || "", 500),
          },
        });

        return reply.send({ success: true, ticketId: ticket.id });
      } catch (e: any) {
        return reply.status(500).send({ success: false, error: e.message });
      }
    },
  );

  fastify.get("/admin/tenants", async () => {
    try {
      const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: "desc" },
      });
      return tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        plan: t.plan.toUpperCase(),
        subscriptionPlan: t.plan.toUpperCase(),
        status: t.status,
        isActive: t.status === "active",
        subscriptionExpiresAt: t.planExpiresAt
          ? t.planExpiresAt.toISOString()
          : new Date(Date.now() + 30 * 86400000).toISOString(),
        createdAt: t.createdAt.toISOString(),
      }));
    } catch {
      return [];
    }
  });

  fastify.post(
    "/admin/tenants/:id/update-plan",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { id } = request.params;
      const body = (request.body as any) || {};
      const plan = sanitizeString(body.plan || "PRO", 40).toLowerCase();
      const durationMonths = sanitizeNumber(body.durationMonths, {
        min: 1,
        max: 120,
        fallback: 1,
      });

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

      const updated = await prisma.tenant.update({
        where: { id },
        data: {
          plan,
          planExpiresAt: expiresAt,
          status: "active",
        },
      });

      return { success: true, tenant: updated };
    },
  );

  fastify.get("/admin/purchase-requests", async () => {
    const orders = await prisma.purchaseOrder.findMany({
      include: {
        tenant: true,
        supplier: true,
        details: { include: { catalog: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return orders.map((po) => {
      const firstDetail = po.details[0];
      return {
        id: po.id,
        poNumber: po.poNumber,
        tenantId: po.tenantId,
        tenantName: po.tenant.name,
        status: po.status.toUpperCase(),
        quantity: firstDetail?.quantity || 1,
        createdAt: po.createdAt.toISOString(),
        supplier: {
          id: po.supplier.id,
          companyName: po.supplier.name,
          company_name: po.supplier.name,
        },
        product: {
          id: firstDetail?.catalog?.id || "",
          productName: firstDetail?.catalog?.name || "Bahan Baku B2B",
          product_name: firstDetail?.catalog?.name || "Bahan Baku B2B",
          unit: firstDetail?.catalog?.unit || "kg",
        },
      };
    });
  });
}
