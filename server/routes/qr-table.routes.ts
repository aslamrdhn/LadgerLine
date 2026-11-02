import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma.ts";
import {
  resolveTenantContext,
  DEFAULT_MENU_IMAGE,
} from "../services/tenantContext.service.ts";
import { buildEnterpriseAppState } from "./sync.routes.ts";
import { sanitizeNumber, sanitizeString } from "../utils/sanitizer.ts";
import { getTenantHint } from "./catalog.routes.ts";
import { broadcastKitchenEvent } from "./ssot.routes.ts";

export async function qrTableRoutes(fastify: FastifyInstance) {
  // 1. Generate QR Tables
  fastify.post("/tables/generate", async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const ctx = await resolveTenantContext(
      body.tenantId || getTenantHint(request),
    );
    const count = sanitizeNumber(body.count ?? body.tableCount, {
      min: 1,
      max: 100,
      fallback: 6,
    });

    const generatedTables = [];
    for (let i = 1; i <= count; i++) {
      const numStr = String(i).padStart(2, "0");
      const slug = `${ctx.tenantSlug}-table-${numStr}`;
      const qr = await prisma.qrMenu.upsert({
        where: { slug },
        update: {
          menuData: JSON.stringify({
            tableNumber: `Meja ${numStr}`,
            capacity: i % 2 === 0 ? 2 : 4,
            status: "available",
          }),
        },
        create: {
          tenantId: ctx.tenantId,
          outletId: ctx.outletId,
          slug,
          menuData: JSON.stringify({
            tableNumber: `Meja ${numStr}`,
            capacity: i % 2 === 0 ? 2 : 4,
            status: "available",
          }),
        },
      });
      generatedTables.push({
        id: qr.id,
        name: `Meja ${numStr}`,
        tableNumber: `Meja ${numStr}`,
        number: `Meja ${numStr}`,
        qrToken: qr.slug,
        capacity: i % 2 === 0 ? 2 : 4,
        status: "available",
        isActive: true,
      });
    }

    return {
      success: true,
      message: `${count} QR Meja berhasil diperbarui`,
      tables: generatedTables,
    };
  });

  // 2. Public Table Menu by Token (Supports VisitorMenu & Storefront)
  fastify.get(
    "/orders/table-public/:token",
    async (request: FastifyRequest<{ Params: { token: string } }>) => {
      const { token } = request.params;
      const qrMenu = await prisma.qrMenu.findFirst({
        where: {
          OR: [{ slug: token }, { id: token }],
        },
        include: { tenant: true, outlet: true },
      });

      const ctx = await resolveTenantContext(qrMenu?.tenantId);
      const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
      });
      const menus = await prisma.menu.findMany({
        where: { tenantId: ctx.tenantId, isActive: true },
        orderBy: { name: "asc" },
      });

      let parsedData: any = {};
      try {
        parsedData = JSON.parse(qrMenu?.menuData || "{}");
      } catch {}

      const tableNumber =
        parsedData.tableNumber ||
        `Meja ${token.replace(/[^0-9]/g, "") || "01"}`;
      const storeName =
        qrMenu?.tenant?.name || tenant?.name || "LedgerLine Coffee & Roastery";

      const recipes = await prisma.recipe.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        details: {
          include: {
            item: {
              include: {
                balances: { where: { warehouseId: ctx.warehouseId } },
              },
            },
          },
        },
      },
    });
    const recipeCostMap = new Map<string, number>();
    for (const r of recipes) {
      const cost = r.details.reduce((sum, d) => {
        const unitCost =
          Number(d.item.balances?.[0]?.averageCost) ||
          Number(d.item.price) ||
          100;
        return sum + Number(d.quantity) * unitCost;
      }, 0);
      recipeCostMap.set(r.menuId, Math.round(cost));
    }

    return {
      success: true,
      storeName,
      store: {
        id: ctx.tenantId,
        storeName,
        qrisMerchantName: storeName.toUpperCase(),
        storeWifiName: "LedgerLine_Guest_5G",
      },
      table: {
        id: qrMenu?.id || `tbl-${token}`,
        name: tableNumber,
        tableNumber,
        qrToken: token,
        outletId: qrMenu?.outletId || ctx.outletId,
        tenantId: ctx.tenantId,
      },
      tableNumber,
      products: menus.map((m) => ({
        id: m.id,
        name: m.name,
        price: m.price,
        costPrice: recipeCostMap.get(m.id) || Math.round(m.price * 0.35),
        stock: 50,
        warningLimit: 10,
        category: m.category,
        description: m.description || "",
        komposisi: m.description || "",
        imageUrl: m.imageUrl || DEFAULT_MENU_IMAGE,
        hasVariants: m.category.toLowerCase().includes("coffee"),
      })),
      activeOrder: null,
      currency: "IDR",
    };
  });

  // 3. Public Table Self-Order Checkout (Zero-Client-Price Trust & Atomic Inventory BOM Transaction)
  const handlePublicTableCheckout = async (request: FastifyRequest, reply: any) => {
    const rawBody = (request.body as any) || {};
    const body = rawBody.orderData
      ? { ...rawBody, ...rawBody.orderData }
      : rawBody;
    const ctx = await resolveTenantContext(
      body.tenantId || getTenantHint(request),
    );

    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (rawItems.length === 0) {
      return reply.code(400).send({
        success: false,
        error: "VAL_002",
        message: "Keranjang pesanan meja tidak boleh kosong",
      });
    }

    // 1. Fetch valid menus strictly from database (ZERO client price trust)
    const allTenantMenus = await prisma.menu.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
    });

    const validatedItems: Array<{
      menu: (typeof allTenantMenus)[0];
      qty: number;
      notes: string;
    }> = [];

    for (const item of rawItems) {
      const targetId = item.productId || item.menuId || item.id || "";
      const targetName = String(item.name || "").trim().toLowerCase();

      let matchedMenu = allTenantMenus.find((m) => m.id === targetId);
      if (!matchedMenu && targetName) {
        matchedMenu = allTenantMenus.find(
          (m) => m.name.toLowerCase() === targetName,
        );
      }

      if (!matchedMenu) {
        return reply.code(400).send({
          success: false,
          error: "MENU_NOT_FOUND",
          message: `Menu '${item.name || targetId}' tidak terdaftar atau sedang tidak aktif`,
        });
      }

      const qty = sanitizeNumber(item.qty ?? item.quantity, {
        min: 1,
        max: 50,
        fallback: 1,
      });
      validatedItems.push({
        menu: matchedMenu,
        qty,
        notes: sanitizeString(item.notes || item.note || "", 120),
      });
    }

    // 2. Fetch actual BOM recipes for cost price calculation & inventory deduction
    const menuIds = Array.from(new Set(validatedItems.map((vi) => vi.menu.id)));
    const recipes = await prisma.recipe.findMany({
      where: { tenantId: ctx.tenantId, menuId: { in: menuIds } },
      include: {
        details: {
          include: {
            item: {
              include: {
                balances: { where: { warehouseId: ctx.warehouseId } },
              },
            },
          },
        },
      },
    });

    const recipeMap = new Map<string, (typeof recipes)[0]>();
    for (const r of recipes) {
      recipeMap.set(r.menuId, r);
    }

    let subtotal = 0;
    const detailsData: any[] = [];
    const ingredientDeductions = new Map<string, number>();

    for (const vi of validatedItems) {
      const price = Number(vi.menu.price);
      const lineTotal = price * vi.qty;
      subtotal += lineTotal;

      const recipe = recipeMap.get(vi.menu.id);
      let calculatedUnitHpp = 0;
      let hppStatus = "ESTIMATED";

      if (recipe && recipe.details.length > 0) {
        for (const detail of recipe.details) {
          const itemCost =
            Number(detail.item.balances?.[0]?.averageCost) ||
            Number(detail.item.price) ||
            100;
          calculatedUnitHpp += Number(detail.quantity) * itemCost;

          // Accumulate ingredient usage for atomic stock deduction
          const totalIngredientNeeded = Number(detail.quantity) * vi.qty;
          const currentNeeded = ingredientDeductions.get(detail.itemId) || 0;
          ingredientDeductions.set(
            detail.itemId,
            currentNeeded + totalIngredientNeeded,
          );
        }
        hppStatus = "CALCULATED";
      } else {
        calculatedUnitHpp = Math.round(price * 0.35);
      }

      const noteSuffix = vi.notes ? ` (${vi.notes})` : "";
      detailsData.push({
        menuId: vi.menu.id,
        menuNameSnapshot: `${vi.menu.name}${noteSuffix}`,
        unitPriceSnapshot: price,
        quantity: vi.qty,
        totalPrice: lineTotal,
        hpp: Math.round(calculatedUnitHpp),
        hppStatus,
      });
    }

    // 3. Financial Totals (Calculated strictly on server)
    const tax = Math.round(subtotal * 0.11);
    const totalAmount = subtotal + tax;
    const totalHpp = detailsData.reduce(
      (sum, d) => sum + Number(d.hpp || 0) * Number(d.quantity || 1),
      0,
    );

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const paymentMethod = String(body.paymentMethod || "QRIS").toUpperCase();
    const isQris = paymentMethod === "QRIS";

    // QRIS orders must wait for settlement before kitchen prepares them
    // CASHIER orders go to kitchen immediately marked 'Bayar di Kasir'
    const saleStatus = isQris ? "PENDING_PAYMENT" : "POSTED";
    const paymentStatus = isQris ? "PENDING" : "UNPAID";
    const kitchenStatus = isQris ? "PENDING_PAYMENT" : "NEW";

    const tableLabel = sanitizeString(body.tableNumber || "Meja 01", 30);
    const customerLabel = sanitizeString(
      body.customerName || "Pelanggan Meja",
      50,
    );

    // 4. Atomic Execution in Database Transaction (Sale + Kitchen + Inventory Balance + Inventory Ledger + Double-Entry Journal)
    const { sale, kitchenOrder } = await prisma.$transaction(async (tx) => {
      const createdSale = await tx.salesHeader.create({
        data: {
          tenantId: ctx.tenantId,
          outletId: ctx.outletId,
          warehouseId: ctx.warehouseId,
          invoiceNumber,
          businessDate: new Date(),
          cashierId: "qr-self-order",
          subtotal,
          discount: 0,
          tax,
          serviceCharge: 0,
          totalAmount,
          totalHpp,
          isHppCalculated: true,
          status: saleStatus,
          note: `${tableLabel} - ${customerLabel}${body.notes ? ` (${body.notes})` : ""}`,
          metadata: JSON.stringify({
            orderType: "TABLE_QR",
            tableNumber: tableLabel,
            customerName: customerLabel,
            orderStatus: isQris ? "PENDING_PAYMENT" : "IN_QUEUE",
            paymentStatus,
            paymentMethod,
            notes: body.notes || "",
          }),
          details: { create: detailsData },
          payments: {
            create: {
              method: paymentMethod,
              amount: totalAmount,
              status: paymentStatus,
            },
          },
        },
      });

      const createdKitchen = await tx.kitchenOrder.create({
        data: {
          salesId: createdSale.id,
          outletId: ctx.outletId,
          orderNumber: invoiceNumber,
          items: JSON.stringify(
            validatedItems.map((vi) => ({
              menu_name: vi.menu.name,
              quantity: vi.qty,
              notes: vi.notes,
            })),
          ),
          status: kitchenStatus,
        },
      });

      // Deduct warehouse ingredient balances & record immutable InventoryLedger atomically
      for (const [itemId, qtyToDeduct] of ingredientDeductions.entries()) {
        const itemRecord = await tx.item.findUnique({
          where: { id: itemId },
          include: { unit: true },
        });
        const bal = await tx.inventoryBalance.upsert({
          where: {
            tenantId_itemId_warehouseId: {
              tenantId: ctx.tenantId,
              itemId,
              warehouseId: ctx.warehouseId,
            },
          },
          update: {
            currentStock: { decrement: qtyToDeduct },
            version: { increment: 1 },
            lastUpdated: new Date(),
          },
          create: {
            tenantId: ctx.tenantId,
            itemId,
            warehouseId: ctx.warehouseId,
            currentStock: -qtyToDeduct,
          },
        });

        await tx.inventoryLedger.create({
          data: {
            tenantId: ctx.tenantId,
            outletId: ctx.outletId,
            warehouseId: ctx.warehouseId,
            itemId,
            movementType: "QR_TABLE_SALE",
            referenceType: "SALES_ORDER",
            referenceId: createdSale.id,
            businessDate: new Date(),
            qtyIn: 0,
            qtyOut: qtyToDeduct,
            balanceAfter: bal.currentStock,
            unitCost: Number(bal.averageCost || itemRecord?.price || 0),
            costMethod: "AVERAGE",
            unitSnapshot: itemRecord?.unit?.symbol || "pcs",
          },
        });
      }

      // Post Double-Entry Journal Entry (Debit Asset, Credit Revenue & Tax; Debit HPP, Credit Inventory)
      const accounts = await tx.account.findMany({
        where: { tenantId: ctx.tenantId },
      });
      const accByCode = new Map(accounts.map((a) => [a.code, a]));
      const assetAcc = isQris
        ? accByCode.get("BANK") || accByCode.get("KAS")
        : accByCode.get("KAS");
      const revAcc = accByCode.get("PENDAPATAN");
      const taxAcc = accByCode.get("PPN_KELUARAN");
      const hppAcc = accByCode.get("HPP");
      const invAcc = accByCode.get("PERSEDIAAN");

      if (assetAcc && revAcc) {
        const journalLinesData: Array<{
          accountId: string;
          debit: number;
          credit: number;
        }> = [
          { accountId: assetAcc.id, debit: totalAmount, credit: 0 },
          { accountId: revAcc.id, debit: 0, credit: subtotal },
        ];
        if (taxAcc && tax > 0) {
          journalLinesData.push({ accountId: taxAcc.id, debit: 0, credit: tax });
        }
        if (hppAcc && invAcc && totalHpp > 0) {
          journalLinesData.push(
            { accountId: hppAcc.id, debit: totalHpp, credit: 0 },
            { accountId: invAcc.id, debit: 0, credit: totalHpp },
          );
        }

        await tx.journalEntry.create({
          data: {
            tenantId: ctx.tenantId,
            entryNumber: `JRN-QR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
            entryDate: new Date(),
            referenceType: "SALE",
            referenceId: createdSale.id,
            description: `Penjualan QR ${tableLabel} (${invoiceNumber})`,
            status: "POSTED",
            lines: { create: journalLinesData },
          },
        });
      }

      return { sale: createdSale, kitchenOrder: createdKitchen };
    });

    // 5. Broadcast to KDS immediately only if already paid / cashier order
    if (!isQris) {
      broadcastKitchenEvent(ctx.outletId, {
        type: "NEW_ORDER",
        order: {
          id: kitchenOrder.id,
          orderNumber: kitchenOrder.orderNumber,
          status: kitchenOrder.status,
          items: validatedItems.map((vi) => ({
            menu_name: vi.menu.name,
            quantity: vi.qty,
            notes: vi.notes,
          })),
        },
      });
    }

    return {
      success: true,
      orderId: sale.id,
      invoiceNumber,
      tableNumber: tableLabel,
      order: {
        id: sale.id,
        salesId: sale.id,
        invoiceNumber,
        tableNumber: tableLabel,
        totalPrice: totalAmount,
        subtotal,
        tax,
        paymentStatus: isQris ? "Pending_QR" : "Success",
        status: saleStatus,
      },
      message: isQris
        ? "Pesanan meja berhasil dibuat, silakan selesaikan pembayaran QRIS"
        : "Pesanan meja berhasil dikirim ke kasir & kitchen!",
    };
  };

  fastify.post("/orders/table-public/checkout", handlePublicTableCheckout);
  fastify.post("/table-public/checkout", handlePublicTableCheckout);

  // 4. Pending QR Orders for TableOrders dashboard
  fastify.get("/orders/pending-qr", async (request: FastifyRequest) => {
    const state = await buildEnterpriseAppState(getTenantHint(request));
    const pendingOrders = (state.orders || []).filter(
      (o: any) =>
        o.paymentStatus === "Pending_QR" ||
        o.status === "PENDING" ||
        o.status === "PENDING_PAYMENT" ||
        String(o.tableNumber || "")
          .toLowerCase()
          .includes("meja"),
    );
    return {
      success: true,
      orders: pendingOrders,
    };
  });

  // 5. Confirm / Reject / Update Status for QR & POS Orders
  fastify.all(
    "/orders/:orderId/confirm-payment",
    async (request: FastifyRequest<{ Params: { orderId: string } }>) => {
      const { orderId } = request.params;
      try {
        const sale = await prisma.salesHeader.findFirst({
          where: {
            OR: [{ id: orderId }, { invoiceNumber: orderId }],
          },
          include: { kitchenOrder: true },
        });
        if (sale) {
          let meta: any = {};
          try {
            meta = JSON.parse(sale.metadata || "{}");
          } catch {}
          meta.paymentStatus = "PAID";
          meta.orderStatus = "COMPLETED";
          await prisma.salesHeader.update({
            where: { id: sale.id },
            data: { status: "POSTED", metadata: JSON.stringify(meta) },
          });
          await prisma.payment.updateMany({
            where: { salesId: sale.id },
            data: { status: "PAID" },
          });

          if (sale.kitchenOrder && sale.kitchenOrder.status === "PENDING_PAYMENT") {
            const updatedKo = await prisma.kitchenOrder.update({
              where: { id: sale.kitchenOrder.id },
              data: { status: "NEW" },
            });
            let items = [];
            try {
              items = JSON.parse(updatedKo.items || "[]");
            } catch {}
            broadcastKitchenEvent(sale.outletId, {
              type: "NEW_ORDER",
              order: {
                id: updatedKo.id,
                orderNumber: updatedKo.orderNumber,
                status: "NEW",
                items,
              },
            });
          }
        }
      } catch {}
      return { success: true, status: "PAID" };
    },
  );

  fastify.all(
    "/orders/:orderId/reject",
    async (request: FastifyRequest<{ Params: { orderId: string } }>) => {
      const { orderId } = request.params;
      try {
        const sale = await prisma.salesHeader.findFirst({
          where: {
            OR: [{ id: orderId }, { invoiceNumber: orderId }],
          },
          include: { kitchenOrder: true },
        });
        if (sale) {
          let meta: any = {};
          try {
            meta = JSON.parse(sale.metadata || "{}");
          } catch {}
          meta.paymentStatus = "CANCELLED";
          meta.orderStatus = "CANCELLED";
          await prisma.salesHeader.update({
            where: { id: sale.id },
            data: { status: "VOID", metadata: JSON.stringify(meta) },
          });
          if (sale.kitchenOrder) {
            await prisma.kitchenOrder.update({
              where: { id: sale.kitchenOrder.id },
              data: { status: "CANCELLED" },
            });
          }
        }
      } catch {}
      return { success: true, status: "CANCELLED" };
    },
  );

  fastify.all(
    "/orders/:orderId/status",
    async (request: FastifyRequest<{ Params: { orderId: string } }>) => {
      const { orderId } = request.params;
      const body = (request.body as any) || {};
      const nextStatus = sanitizeString(body.status || "COMPLETED", 40);
      try {
        const sale = await prisma.salesHeader.findFirst({
          where: {
            OR: [{ id: orderId }, { invoiceNumber: orderId }],
          },
        });
        if (sale) {
          let meta: any = {};
          try {
            meta = JSON.parse(sale.metadata || "{}");
          } catch {}
          meta.orderStatus = nextStatus;
          await prisma.salesHeader.update({
            where: { id: sale.id },
            data: { metadata: JSON.stringify(meta) },
          });
        }
      } catch {}
      return { success: true, status: nextStatus };
    },
  );

  // 6. Full App Sync State (/api/orders/state) — GET & Idempotent Delta POST
  fastify.get("/orders/state", async (request: FastifyRequest) => {
    return buildEnterpriseAppState(getTenantHint(request));
  });

  fastify.post("/orders/state", async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const ctx = await resolveTenantContext(
      body.tenantId || getTenantHint(request),
    );

    // Idempotent Delta Merge for appConfig if provided
    if (body.appConfig && typeof body.appConfig === "object") {
      const tenant = await prisma.tenant.findUnique({
        where: { id: ctx.tenantId },
      });
      if (tenant) {
        let currentCfg: Record<string, any> = {};
        try {
          currentCfg = JSON.parse(tenant.config || "{}");
        } catch {}
        const mergedCfg = { ...currentCfg, ...body.appConfig };
        await prisma.tenant.update({
          where: { id: ctx.tenantId },
          data: { config: JSON.stringify(mergedCfg) },
        });
      }
    }

    return buildEnterpriseAppState(ctx.tenantId);
  });

  // 7. Paginated Order History (/api/orders/history?page=1&limit=50&startDate=...&endDate=...)
  fastify.get("/orders/history", async (request: FastifyRequest) => {
    const query = (request.query as any) || {};
    const ctx = await resolveTenantContext(getTenantHint(request));

    const page = sanitizeNumber(query.page, { min: 1, max: 10000, fallback: 1 });
    const limit = sanitizeNumber(query.limit, {
      min: 1,
      max: 250,
      fallback: 50,
    });
    const skip = (page - 1) * limit;

    const whereClause: any = {
      tenantId: ctx.tenantId,
    };

    if (query.status) {
      whereClause.status = sanitizeString(query.status, 30).toUpperCase();
    }

    if (query.startDate || query.endDate) {
      whereClause.businessDate = {};
      if (query.startDate) {
        const start = new Date(String(query.startDate));
        if (!Number.isNaN(start.getTime())) {
          whereClause.businessDate.gte = start;
        }
      }
      if (query.endDate) {
        const end = new Date(String(query.endDate));
        if (!Number.isNaN(end.getTime())) {
          whereClause.businessDate.lte = end;
        }
      }
    }

    const [totalCount, sales] = await Promise.all([
      prisma.salesHeader.count({ where: whereClause }),
      prisma.salesHeader.findMany({
        where: whereClause,
        include: {
          details: true,
          payments: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const orders = sales.map((s) => {
      let meta: any = {};
      try {
        meta = JSON.parse(s.metadata || "{}");
      } catch {}

      const rawMethod = (s.payments[0]?.method || "CASH").toUpperCase();
      const paymentMethod =
        rawMethod === "QRIS"
          ? "QRIS"
          : rawMethod === "DEBIT"
            ? "Debit"
            : rawMethod === "BANK_TRANSFER"
              ? "Midtrans"
              : "Tunai";

      const isPendingQr =
        meta.paymentStatus === "PENDING" || meta.paymentStatus === "UNPAID";

      return {
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        orderTime: s.createdAt.toISOString(),
        tableNumber: meta.tableNumber || s.note || "Takeaway",
        customerName: meta.customerName || "Walk-in Guest",
        items: s.details.map((d) => ({
          productId: d.menuId,
          name: d.menuNameSnapshot,
          quantity: d.quantity,
          priceAtSale: d.unitPriceSnapshot,
          costAtSale: d.hpp || Math.round(d.unitPriceSnapshot * 0.35),
        })),
        subtotal: s.subtotal,
        discount: s.discount,
        tax: s.tax,
        totalPrice: s.totalAmount,
        paymentMethod,
        paymentStatus: isPendingQr ? "Pending_QR" : "Success",
        receiptPrinted: true,
        isSync: true,
      };
    });

    return {
      success: true,
      page,
      limit,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      orders,
    };
  });
}
