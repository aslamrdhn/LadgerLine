import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  authenticateToken,
  enforceTenantBoundary,
} from "../middlewares/auth.ts";
import { prisma } from "../lib/prisma.ts";
import { resolveTenantContext } from "../services/tenantContext.service.ts";

/**
 * Shared state builder that formats database entities into the exact shape
 * expected by `useAppSync`, `dataStore`, `Cashier`, `Inventory`, `TableOrders`, and `FinancialReports`.
 */
export async function buildEnterpriseAppState(tenantHint?: string) {
  const ctx = await resolveTenantContext(tenantHint);
  const tenantId = ctx.tenantId;

  const [
    menus,
    items,
    recipesInDb,
    salesInDb,
    qrMenus,
    journalsInDb,
    tenantRecord,
  ] = await Promise.all([
    prisma.menu.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.item.findMany({
      where: { tenantId, status: "ACTIVE" },
      include: {
        unit: true,
        balances: { where: { warehouseId: ctx.warehouseId } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.recipe.findMany({
      where: { tenantId },
      include: { details: true },
    }),
    prisma.salesHeader.findMany({
      where: {
        tenantId,
        status: { in: ["POSTED", "LATE_ENTRY", "PENDING_SYNC", "PENDING_PAYMENT"] },
      },
      include: { details: true, payments: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.qrMenu.findMany({
      where: { tenantId },
      orderBy: { slug: "asc" },
    }),
    prisma.journalEntry.findMany({
      where: { tenantId, status: "POSTED" },
      include: { lines: { include: { account: true } } },
      orderBy: { entryDate: "desc" },
      take: 100,
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { outlets: true },
    }),
  ]);

  const rawMaterials = items.map((item) => {
    const bal = item.balances?.[0];
    const stockVal = bal ? Number(bal.currentStock) : 50;
    const costVal = bal?.averageCost ? Number(bal.averageCost) : Number(item.price) || 100;
    const unitSym = item.unit?.symbol || "pcs";
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      stock: stockVal,
      stockQuantity: stockVal,
      unit: unitSym,
      stockUnit: unitSym,
      minStock: Number(item.minStock) || 5,
      warningLimit: Number(item.minStock) || 5,
      costPerUnit: costVal,
      unitCost: costVal,
      supplierName: "Supplier Terverifikasi",
      supplierContact: "0812-3456-7890",
    };
  });

  const recipes = recipesInDb.map((r) => ({
    id: r.id,
    productId: r.menuId,
    ingredients: r.details.map((d) => ({
      materialId: d.itemId,
      amount: Number(d.quantity),
    })),
    totalCost: r.details.reduce((sum, d) => {
      const mat = rawMaterials.find((rm) => rm.id === d.itemId);
      return sum + Number(d.quantity) * (mat?.unitCost || 0);
    }, 0),
  }));

  const products = menus.map((m, idx) => {
    const matchedRecipe = recipes.find((r) => r.productId === m.id);
    const bomCost =
      matchedRecipe && matchedRecipe.totalCost > 0
        ? Math.round(matchedRecipe.totalCost)
        : Math.round((Number(m.price) || 0) * 0.35);

    return {
      id: m.id,
      name: m.name,
      category: m.category || "Coffee",
      price: Number(m.price) || 0,
      costPrice: bomCost,
      stock: 85,
      warningLimit: 10,
      barcode: `89910${String(idx + 1).padStart(2, "0")}`,
      supplierName: "Koperasi Tani Gayo",
      supplierContact: "0812-3456-7890",
      imageUrl:
        m.imageUrl ||
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80",
      komposisi: m.description || "Racikan spesial roastery",
      isSync: true,
    };
  });

  const tables =
    qrMenus.length > 0
      ? qrMenus.map((q, idx) => {
          let parsed: any = {};
          try {
            parsed = q.menuData ? JSON.parse(q.menuData) : {};
          } catch {}
          const numStr = parsed.tableNumber || parsed.number || parsed.name || `Meja 0${idx + 1}`;
          return {
            id: q.id,
            name: numStr,
            number: numStr,
            token: q.slug,
            slug: q.slug,
            capacity: Number(parsed.capacity) || 4,
            status: parsed.status || "available",
          };
        })
      : [
          { id: "t1", name: "Meja 01", number: "Meja 01", token: "meja-01", capacity: 4, status: "available" },
          { id: "t2", name: "Meja 02", number: "Meja 02", token: "meja-02", capacity: 2, status: "available" },
          { id: "t3", name: "Meja 03", number: "Meja 03", token: "meja-03", capacity: 6, status: "available" },
          { id: "t4", name: "Meja 04", number: "Meja 04", token: "meja-04", capacity: 4, status: "available" },
        ];

  const orders = salesInDb.map((s) => {
    let parsedMeta: any = {};
    try {
      parsedMeta = s.metadata ? JSON.parse(s.metadata) : {};
    } catch {}
    const isPendingQr =
      s.status === "PENDING_PAYMENT" ||
      parsedMeta.paymentStatus === "PENDING" ||
      parsedMeta.paymentStatus === "UNPAID";

    return {
      id: s.invoiceNumber || s.id,
      salesId: s.id,
      invoiceNumber: s.invoiceNumber,
      orderTime: s.createdAt.toISOString(),
      tableNumber: parsedMeta.tableNumber || "Dine-In",
      customerName: parsedMeta.customerName || "Pelanggan",
      items: s.details.map((d) => ({
        productId: d.menuId,
        name: d.menuNameSnapshot,
        productName: d.menuNameSnapshot,
        quantity: d.quantity,
        priceAtSale: Number(d.unitPriceSnapshot),
        costAtSale: Number(d.hpp) || Math.round(Number(d.unitPriceSnapshot) * 0.35),
      })),
      subtotal: Number(s.subtotal),
      discount: Number(s.discount),
      tax: Number(s.tax),
      totalPrice: Number(s.totalAmount),
      paymentMethod: s.payments[0]?.method || "CASH",
      paymentStatus: isPendingQr ? "Pending_QR" : "Success",
      status: s.status,
      prepStatus: parsedMeta.prepStatus || (isPendingQr ? "Pending" : "Completed"),
      receiptPrinted: true,
      secureHash: `LL-SHA256-${s.id.slice(0, 10).toUpperCase()}`,
    };
  });

  const financeLogs = journalsInDb.map((j) => {
    const revLine = j.lines.find((l) => l.account.type === "REVENUE");
    const expLine = j.lines.find((l) => l.account.type === "EXPENSE" && l.account.code !== "HPP");
    const isIncome = !!revLine || j.referenceType === "SALE" || j.referenceType === "INCOME_LOG";
    const totalVal = j.lines.reduce((max, l) => Math.max(max, Number(l.debit), Number(l.credit)), 0);
    return {
      id: j.id,
      type: isIncome ? "income" : "expense",
      category: isIncome
        ? "Penjualan POS & Kas"
        : expLine?.account?.name || "Beban Operasional Lainnya",
      amount: totalVal,
      description: j.description,
      date: j.entryDate.toISOString().split("T")[0],
      time: j.createdAt.toTimeString().slice(0, 5),
    };
  });

  let parsedConfig: any = {};
  try {
    parsedConfig = tenantRecord?.config ? JSON.parse(tenantRecord.config) : {};
  } catch {}

  const appConfig = {
    storeName: parsedConfig.storeName || tenantRecord?.name || "LedgerLine Coffee & Roastery",
    address: parsedConfig.address || tenantRecord?.outlets?.[0]?.address || "Jl. Veteran No. 45, Jakarta Pusat",
    phone: parsedConfig.phone || tenantRecord?.outlets?.[0]?.phone || "0812-3456-7890",
    taxPercentage: parsedConfig.taxPercentage ?? 11,
    serviceChargePercentage: parsedConfig.serviceChargePercentage ?? 0,
    currency: parsedConfig.currency || "IDR",
    enableQrTable: parsedConfig.enableQrTable ?? true,
    storeWifiName: parsedConfig.storeWifiName || "LedgerLine_Guest_5G",
    qrisMerchantName: parsedConfig.qrisMerchantName || "LEDGERLINE ROASTERY ID",
    ...parsedConfig,
  };

  return {
    success: true,
    products,
    rawMaterials,
    recipes,
    tables,
    orders,
    financeLogs,
    appConfig,
  };
}

export const syncRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance,
) => {
  fastify.addHook("preHandler", authenticateToken);
  fastify.addHook("preHandler", enforceTenantBoundary);

  fastify.get("/state", async (request, reply) => {
    try {
      const tenantId = request.user?.tenantId;
      const state = await buildEnterpriseAppState(tenantId);
      return reply.code(200).send(state);
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: "SYS_001",
        message: error.message,
      });
    }
  });

  fastify.get("/history", async (request, reply) => {
    try {
      const query = (request.query as any) || {};
      const ctx = await resolveTenantContext(request.user?.tenantId);
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(250, Math.max(1, Number(query.limit) || 50));
      const skip = (page - 1) * limit;

      const [totalCount, sales] = await Promise.all([
        prisma.salesHeader.count({ where: { tenantId: ctx.tenantId } }),
        prisma.salesHeader.findMany({
          where: { tenantId: ctx.tenantId },
          include: { details: true, payments: true },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      const orders = sales.map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        orderTime: s.createdAt.toISOString(),
        subtotal: s.subtotal,
        tax: s.tax,
        totalPrice: s.totalAmount,
        status: s.status,
      }));

      return reply.code(200).send({
        success: true,
        page,
        limit,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        orders,
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
