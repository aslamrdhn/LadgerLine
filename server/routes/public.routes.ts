import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.ts";
import { checkout } from "../services/checkout.service.ts";
import { resolveTenantContext } from "../services/tenantContext.service.ts";

export async function publicRoutes(fastify: FastifyInstance) {
  // Get Menu by QR token/slug (supports both VisitorMenu and legacy QR menu format)
  fastify.get("/table-public/:token", async (request: FastifyRequest<{ Params: { token: string } }>) => {
    const { token } = request.params;
    const ctx = await resolveTenantContext();

    // Find QrMenu by slug or fallback to first QR menu for the tenant
    let qr = await prisma.qrMenu.findUnique({
      where: { slug: token },
      include: {
        outlet: true,
        tenant: true,
      },
    });

    if (!qr) {
      qr = await prisma.qrMenu.findFirst({
        where: { tenantId: ctx.tenantId },
        include: {
          outlet: true,
          tenant: true,
        },
      });
    }

    const tenantId = qr?.tenantId || ctx.tenantId;
    const outletId = qr?.outletId || ctx.outletId;
    const storeName = qr?.tenant?.name || ctx.tenant.name || "LedgerLine Coffee & Roastery";

    const items = await prisma.menu.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });

    const categoryMap = new Map<string, any[]>();
    for (const item of items) {
      const cat = item.category || "Coffee";
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        image: item.imageUrl,
        imageUrl: item.imageUrl,
        variants: [],
        modifiers: [],
      });
    }

    const products = items.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category || "Coffee",
      price: Number(m.price) || 0,
      costPrice: Math.round((Number(m.price) || 0) * 0.35),
      stock: 50,
      warningLimit: 5,
      imageUrl:
        m.imageUrl ||
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80",
      komposisi: m.description || "Racikan spesial barista",
    }));

    const tableNum = token.replace(/[^0-9]/g, "") || "01";
    const tableName = `Meja ${tableNum}`;

    return {
      success: true,
      storeName,
      outletId,
      tenantId,
      tableName,
      tableNumber: tableNum,
      qrMenuId: qr?.id || "qr-default",
      currency: "IDR",
      activeOrder: null,
      store: {
        id: tenantId,
        storeName,
        storeWifiName: "LedgerLine_Guest_5G",
        qrisMerchantName: storeName.toUpperCase(),
      },
      table: {
        id: qr?.id || `table-${tableNum}`,
        name: tableName,
        number: tableName,
        token,
      },
      products,
      categories: Array.from(categoryMap.entries()).map(
        ([name, catItems], idx) => ({
          id: "cat-" + idx,
          name,
          items: catItems,
        }),
      ),
    };
  });

  // Public Checkout (supports both VisitorMenu `{ tenantId, orderData }` and direct `{ qrMenuId, items }`)
  fastify.post("/table-public/checkout", async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = (request.body as any) || {};
    try {
      const ctx = await resolveTenantContext(payload.tenantId);
      const tenantId = ctx.tenantId;
      const outletId = payload.outletId || ctx.outletId;

      const sourceItems = Array.isArray(payload.orderData?.items)
        ? payload.orderData.items
        : Array.isArray(payload.items)
          ? payload.items
          : [];

      const tableNumber =
        payload.orderData?.tableNumber || payload.tableNumber || "Meja 01";
      const notes = payload.orderData?.notes || payload.note || "";

      if (sourceItems.length === 0) {
        return reply.code(400).send({
          success: false,
          message: "Keranjang pesanan kosong.",
        });
      }

      const allMenus = await prisma.menu.findMany({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: "asc" },
      });

      const checkoutItems = [];
      let estSubtotal = 0;

      for (const it of sourceItems) {
        const targetId = it.productId || it.menuId || it.id;
        let menu = allMenus.find((m) => m.id === targetId);
        if (!menu) {
          const matchIdx = String(targetId).match(/^prod-(\d+)$/);
          if (matchIdx) {
            const idx = parseInt(matchIdx[1], 10) - 1;
            if (allMenus[idx]) menu = allMenus[idx];
          }
        }
        if (!menu && allMenus.length > 0) {
          menu = allMenus[0];
        }
        if (menu) {
          const qty = Math.max(1, Number(it.quantity) || 1);
          estSubtotal += Number(menu.price) * qty;
          checkoutItems.push({
            menuId: menu.id,
            quantity: qty,
            discountAmount: 0,
            note: it.notes || it.note || "",
          });
        }
      }

      const estTotal = Math.round(estSubtotal * 1.11);

      const result = await checkout({
        tenantId,
        outletId,
        cashierId: "self-order",
        items: checkoutItems,
        payments: [
          {
            method: "QRIS",
            amount: String(estTotal),
          },
        ],
        discountPercent: 0,
        note: `[${tableNumber}] ${notes}`.trim(),
        forceStock: true,
        skipPeriodValidation: true,
        useHistoricalPrices: false,
      });

      const orderObj = {
        id: result.sale.invoiceNumber || result.sale.id,
        salesId: result.sale.id,
        invoiceNumber: result.sale.invoiceNumber,
        tableNumber,
        orderTime: result.sale.createdAt.toISOString(),
        subtotal: result.sale.subtotal,
        tax: result.sale.tax,
        totalPrice: result.sale.totalAmount,
        paymentMethod: "QRIS",
        paymentStatus: "Pending",
        prepStatus: "Pending",
      };

      return {
        success: true,
        orderId: orderObj.id,
        invoiceNumber: result.sale.invoiceNumber,
        totalAmount: result.sale.totalAmount,
        tableNumber,
        order: orderObj,
        message: "Pesanan meja berhasil dikirim ke kasir & kitchen!",
      };
    } catch (err: any) {
      return reply.code(400).send({
        success: false,
        message: err.message || "Gagal memproses pesanan meja",
      });
    }
  });
}
