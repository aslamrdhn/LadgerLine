import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma.ts";
import { resolveTenantContext } from "../services/tenantContext.service.ts";
import { sanitizeNumber, sanitizeString } from "../utils/sanitizer.ts";
import { getTenantHint } from "./catalog.routes.ts";

export async function mapSuppliersForFrontend() {
  const suppliers = await prisma.supplier.findMany({
    include: { catalog: { where: { isActive: true } } },
    orderBy: { createdAt: "desc" },
  });

  return suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    company_name: s.name,
    companyName: s.name,
    owner_name: s.legalName || "Budi Santoso",
    ownerName: s.legalName || "Budi Santoso",
    email: s.contactEmail,
    contactEmail: s.contactEmail,
    phone: s.phone || "0812-3456-7890",
    address:
      s.address || `${s.city || "Jakarta"}, ${s.province || "Indonesia"}`,
    city: s.city || "Jakarta",
    category: s.catalog[0]?.category || "Raw Materials",
    rating: 4.9,
    minOrder: `${s.catalog[0]?.moq || 5} ${s.catalog[0]?.unit || "kg"}`,
    status: s.status.toUpperCase(),
    verification_status: s.status.toUpperCase(),
    verificationStatus: s.status.toUpperCase(),
    listings: s.catalog.map((c) => ({
      id: c.id,
      product_name: c.name,
      productName: c.name,
      category: c.category,
      price_offer: c.price,
      priceOffer: c.price,
      unit: c.unit,
      stock: c.stockQuantity,
      moq: c.moq,
      status: c.isActive ? "APPROVED" : "PENDING",
    })),
  }));
}

export async function procurementRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/procurement/smart-suggestions",
    async (request: FastifyRequest) => {
      const ctx = await resolveTenantContext(getTenantHint(request));
      const items = await prisma.item.findMany({
        where: { tenantId: ctx.tenantId, status: "ACTIVE" },
        include: { unit: true, balances: true },
        orderBy: { name: "asc" },
      });

      return items.map((item, idx) => {
        const currentStock =
          item.balances.reduce((acc, b) => acc + Number(b.currentStock), 0) ||
          0;
        const minStock = Number(item.minStock) || 100;
        const avgDailyUsage = Math.max(
          1,
          Math.round((minStock / 5) * 10) / 10,
        );
        const daysUntilDepletion = Math.max(
          1,
          Math.round(currentStock / avgDailyUsage),
        );
        const isCritical =
          currentStock <= minStock * 1.2 || daysUntilDepletion <= 7 || idx === 0;

        return {
          id: `sug-${item.id}`,
          materialId: item.id,
          materialName: item.name,
          currentStock,
          avgDailyUsage,
          recommendedOrder: Math.max(minStock * 2, 10),
          unit: item.unit.symbol,
          daysUntilDepletion,
          isCritical,
          supplierName: "Koperasi Tani Gayo Highland",
          estCost: Math.max(minStock * 2, 10) * (item.price || 150),
          urgency: isCritical ? "HIGH" : "MEDIUM",
        };
      });
    },
  );

  fastify.get("/suppliers/public", async () => {
    return mapSuppliersForFrontend();
  });

  fastify.get("/suppliers/tenant", async () => {
    return mapSuppliersForFrontend();
  });

  fastify.get("/purchase-requests/tenant", async (request: FastifyRequest) => {
    const ctx = await resolveTenantContext(getTenantHint(request));
    const orders = await prisma.purchaseOrder.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
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
        createdAt: po.createdAt.toISOString(),
        date: po.createdAt.toISOString().slice(0, 10),
        status: po.status.toUpperCase(),
        quantity: firstDetail?.quantity || 1,
        notes: po.notes || "",
        materialName: firstDetail?.catalog?.name || "Bahan Baku B2B",
        supplier: {
          id: po.supplier.id,
          companyName: po.supplier.name,
          company_name: po.supplier.name,
          phone: po.supplier.phone || "0812-3456-7890",
        },
        product: {
          id: firstDetail?.catalog?.id || "",
          productName: firstDetail?.catalog?.name || "Bahan Baku B2B",
          product_name: firstDetail?.catalog?.name || "Bahan Baku B2B",
          unit: firstDetail?.catalog?.unit || "kg",
          priceOffer: firstDetail?.unitPrice || 0,
        },
      };
    });
  });

  fastify.post("/purchase-request", async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const ctx = await resolveTenantContext(
      body.tenantId || getTenantHint(request),
    );

    const supplierId = body.supplierId;
    const productId = body.productId || body.catalogId;
    const quantity = sanitizeNumber(body.quantity, { min: 1, fallback: 1 });
    const notes = sanitizeString(body.notes || "", 500);

    let supplier = supplierId
      ? await prisma.supplier.findUnique({ where: { id: supplierId } })
      : null;
    if (!supplier) {
      supplier = await prisma.supplier.findFirst();
    }

    let catalogItem = productId
      ? await prisma.supplierCatalog.findUnique({ where: { id: productId } })
      : null;
    if (!catalogItem && supplier) {
      catalogItem = await prisma.supplierCatalog.findFirst({
        where: { supplierId: supplier.id },
      });
    }

    if (!supplier || !catalogItem) {
      return {
        success: false,
        message: "Supplier atau produk katalog tidak ditemukan",
      };
    }

    const poNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const unitPrice = catalogItem.price || 0;

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        tenantId: ctx.tenantId,
        supplierId: supplier.id,
        status: "PENDING",
        notes,
        createdBy: request.user?.userId || "owner",
        details: {
          create: [
            {
              catalogId: catalogItem.id,
              quantity,
              unitPrice,
              totalPrice: quantity * unitPrice,
              notes,
            },
          ],
        },
      },
      include: {
        supplier: true,
        details: { include: { catalog: true } },
      },
    });

    return {
      success: true,
      message: "Purchase Order berhasil dikirim ke Supplier!",
      data: po,
    };
  });
}
