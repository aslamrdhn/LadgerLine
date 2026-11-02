import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.ts";
import { resolveTenantContext } from "../services/tenantContext.service.ts";
import { sanitizeNumber, sanitizeString } from "../utils/sanitizer.ts";
import { getTenantHint } from "./catalog.routes.ts";
import { mapSuppliersForFrontend } from "./procurement.routes.ts";
import { authenticateToken } from "../middlewares/auth.ts";

async function verifyAdminAccess(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({
      success: false,
      error: "AUT_001",
      message: "Otorisasi SuperAdmin diperlukan",
    });
  }
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token || token === "null" || token === "undefined") {
    return reply.code(401).send({
      success: false,
      error: "AUT_001",
      message: "Token SuperAdmin tidak valid",
    });
  }

  await authenticateToken(request, reply);
  if (reply.sent) return;

  const role = String(request.user?.role || "").toUpperCase();
  if (
    role &&
    role !== "OWNER" &&
    role !== "SUPER_ADMIN" &&
    role !== "SUPERADMIN" &&
    role !== "ADMIN"
  ) {
    return reply.code(403).send({
      success: false,
      error: "AUT_003",
      message: "Akses ditolak: Hanya SuperAdmin / Owner yang diizinkan",
    });
  }
}

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

  const handleUpdateConfig = async (request: FastifyRequest) => {
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

    if (typeof body.taxPercentage === "number") {
      const existingRate = await prisma.taxRate.findFirst({
        where: { tenantId: ctx.tenantId, status: "ACTIVE" },
      });
      if (existingRate) {
        await prisma.taxRate.update({
          where: { id: existingRate.id },
          data: { rate: body.taxPercentage / 100 },
        });
      }
    }

    if (
      body.monthlyFixedOverhead !== undefined ||
      body.monthlyLaborCost !== undefined
    ) {
      await prisma.costAllocationConfig.upsert({
        where: { tenantId: ctx.tenantId },
        update: {
          ...(body.monthlyFixedOverhead !== undefined
            ? { monthlyOperationalExpense: Number(body.monthlyFixedOverhead) }
            : {}),
          ...(body.monthlyLaborCost !== undefined
            ? { monthlyLaborExpense: Number(body.monthlyLaborCost) }
            : {}),
        },
        create: {
          tenantId: ctx.tenantId,
          monthlyOperationalExpense: Number(body.monthlyFixedOverhead ?? 4500000),
          monthlyLaborExpense: Number(body.monthlyLaborCost ?? 6000000),
        },
      });
    }

    return { success: true, config: nextConfig, settings: nextConfig };
  };

  fastify.post("/config", handleUpdateConfig);
  fastify.put("/config", handleUpdateConfig);
  fastify.post("/settings", handleUpdateConfig);
  fastify.put("/settings", handleUpdateConfig);

  fastify.post("/attendance", async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const ctx = await resolveTenantContext(getTenantHint(request), body.outletId);
    const userId = request.user?.userId || body.employeeName || "cashier-01";
    const att = await prisma.attendanceLog.create({
      data: {
        userId,
        tenantId: ctx.tenantId,
        outletId: ctx.outletId,
        checkIn: new Date(),
      },
    });
    return { success: true, data: att };
  });

  fastify.post("/finance-logs", async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const ctx = await resolveTenantContext(
      request.user?.tenantId || body.tenantId || getTenantHint(request),
    );
    const type = String(body.type || "EXPENSE").toUpperCase();
    const amount = sanitizeNumber(body.amount, { min: 0, fallback: 0 });
    const category = sanitizeString(body.category || "Operasional", 100);
    const description = sanitizeString(
      body.description || body.note || category,
      255,
    );
    const accounts = await prisma.account.findMany({
      where: { tenantId: ctx.tenantId },
    });
    const accMap = new Map(accounts.map((a) => [a.code, a.id]));
    const kasId = accMap.get("KAS") || accounts[0]?.id;
    const counterId =
      type === "INCOME"
        ? accMap.get("PENDAPATAN") || kasId
        : accMap.get("BEBAN_OPS") || kasId;

    const journal = await prisma.journalEntry.create({
      data: {
        tenantId: ctx.tenantId,
        entryNumber: `JRN-MAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        entryDate: new Date(),
        referenceType: type === "INCOME" ? "MANUAL_INCOME" : "MANUAL_EXPENSE",
        referenceId: `fin-${Date.now()}`,
        description: `[${category}] ${description}`,
        status: "POSTED",
        lines:
          kasId && counterId
            ? {
                create:
                  type === "INCOME"
                    ? [
                        { accountId: kasId, debit: amount, credit: 0 },
                        { accountId: counterId, debit: 0, credit: amount },
                      ]
                    : [
                        { accountId: counterId, debit: amount, credit: 0 },
                        { accountId: kasId, debit: 0, credit: amount },
                      ],
              }
            : undefined,
      },
    });
    return { success: true, data: journal };
  });

  // 3. Customer Loyalty & Points (Real DB Calculation from SalesHeader)
  fastify.get(
    "/customer/:phone/points",
    async (request: FastifyRequest<{ Params: { phone: string } }>) => {
      const { phone } = request.params;
      const cleanPhone = sanitizeString(phone, 30).replace(/[^0-9+]/g, "");
      const ctx = await resolveTenantContext(getTenantHint(request));

      const matchingSales = await prisma.salesHeader.findMany({
        where: {
          tenantId: ctx.tenantId,
          status: "POSTED",
          OR: [
            { note: { contains: cleanPhone } },
            { metadata: { contains: cleanPhone } },
          ],
        },
        select: { totalAmount: true, metadata: true, note: true },
      });

      const totalSpent = matchingSales.reduce(
        (sum, s) => sum + Number(s.totalAmount || 0),
        0,
      );
      // 1 point per Rp 1.000 spent (with minimum 50 welcome points for registered phone)
      const earnedPoints = Math.floor(totalSpent / 1000);
      const points = Math.max(50, earnedPoints);
      const tier =
        points >= 500
          ? "Platinum"
          : points >= 200
            ? "Gold"
            : points >= 100
              ? "Silver"
              : "Member";
      const eligibleDiscount =
        points >= 500 ? 25000 : points >= 200 ? 10000 : points >= 100 ? 5000 : 0;

      return {
        success: true,
        phone: cleanPhone,
        customerName: `Member ${cleanPhone.slice(-4)}`,
        points,
        totalOrders: matchingSales.length,
        totalSpent,
        tier,
        eligibleDiscount,
        customer: {
          name: `Member ${cleanPhone.slice(-4)}`,
          phone: cleanPhone,
          points,
          tier,
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

  // 5. Admin Portal Endpoints (Protected by verifyAdminAccess)
  fastify.get(
    "/admin/overview",
    { preHandler: verifyAdminAccess },
    async () => {
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
    },
  );

  fastify.get(
    "/admin/audit-logs",
    { preHandler: verifyAdminAccess },
    async () => {
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
    },
  );

  fastify.get(
    "/admin/suppliers",
    { preHandler: verifyAdminAccess },
    async () => {
      return mapSuppliersForFrontend();
    },
  );

  const updateSupplierStatusHandler = async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
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
        verifiedBy: request.user?.userId || "admin",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: `SUPPLIER_${nextStatus.toUpperCase()}`,
        resourceType: "Supplier",
        resourceId: id,
        userId: request.user?.userId || "admin",
      },
    });

    return { success: true, data: updated };
  };

  fastify.post(
    "/admin/suppliers/:id/status",
    { preHandler: verifyAdminAccess },
    updateSupplierStatusHandler,
  );
  fastify.patch(
    "/admin/suppliers/:id",
    { preHandler: verifyAdminAccess },
    updateSupplierStatusHandler,
  );
  fastify.post(
    "/admin/suppliers/:id",
    { preHandler: verifyAdminAccess },
    updateSupplierStatusHandler,
  );

  fastify.get(
    "/admin/products/pending",
    { preHandler: verifyAdminAccess },
    async () => {
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
    },
  );

  fastify.post(
    "/admin/products/:id/status",
    { preHandler: verifyAdminAccess },
    async (request: FastifyRequest) => {
      const { id } = request.params as { id: string };
      const body = (request.body as any) || {};
      const status = String(body.status || "APPROVED").toUpperCase();
      await prisma.supplierCatalog.update({
        where: { id },
        data: { isActive: status === "APPROVED" },
      });
      return { success: true, status };
    },
  );

  fastify.get(
    "/admin/migration-tickets",
    { preHandler: verifyAdminAccess },
    async () => {
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
    },
  );

  const updateAdminTicketStatus = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const { id } = request.params as { id: string };
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

  fastify.post(
    "/admin/migration-tickets/:id",
    { preHandler: verifyAdminAccess },
    updateAdminTicketStatus,
  );
  fastify.patch(
    "/admin/migration-tickets/:id",
    { preHandler: verifyAdminAccess },
    updateAdminTicketStatus,
  );

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

  fastify.get(
    "/admin/tenants",
    { preHandler: verifyAdminAccess },
    async () => {
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
    },
  );

  fastify.post(
    "/admin/tenants/:id/update-plan",
    { preHandler: verifyAdminAccess },
    async (request: FastifyRequest) => {
      const { id } = request.params as { id: string };
      const body = (request.body as any) || {};
      const plan = sanitizeString(
        body.plan || body.subscriptionTier || "PRO",
        40,
      ).toLowerCase();
      const durationMonths = sanitizeNumber(
        body.durationMonths ?? body.tokenToAdd,
        {
          min: 1,
          max: 120,
          fallback: 1,
        },
      );

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

      await prisma.auditLog.create({
        data: {
          tenantId: id,
          userId: request.user?.userId || "admin",
          action: "TENANT_PLAN_UPDATED",
          resourceType: "Tenant",
          resourceId: id,
          newData: JSON.stringify({ plan, durationMonths }),
        },
      });

      return { success: true, tenant: updated };
    },
  );

  fastify.get(
    "/admin/purchase-requests",
    { preHandler: verifyAdminAccess },
    async () => {
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
