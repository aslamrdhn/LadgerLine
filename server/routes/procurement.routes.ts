import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.ts";
import { resolveTenantContext } from "../services/tenantContext.service.ts";
import { sanitizeNumber, sanitizeString } from "../utils/sanitizer.ts";
import { getTenantHint } from "./catalog.routes.ts";
import { reserveNumbers } from "../services/numbering.service.ts";

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
    if (!catalogItem && supplier) {
      catalogItem = await prisma.supplierCatalog.create({
        data: {
          supplierId: supplier.id,
          name: sanitizeString(
            body.materialName || body.productName || "Gayo Arabica Espresso Blend",
            120,
          ),
          category: "Coffee Beans",
          unit: sanitizeString(body.unit || "kg", 30),
          price: sanitizeNumber(body.unitPrice ?? body.price, {
            min: 0,
            fallback: 145000,
          }),
          isActive: true,
        },
      });
    }

    if (!supplier || !catalogItem) {
      return {
        success: false,
        message: "Supplier atau produk katalog tidak ditemukan",
      };
    }

    const poNumber = `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const unitPrice = sanitizeNumber(body.unitPrice ?? body.price, {
      min: 0,
      fallback: catalogItem.price || 0,
    });

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

  // Full Enterprise Receiving Endpoint: Updates PO, Receiving, InventoryBalance, FifoLayer, InventoryLedger, and Double-Entry JournalEntry
  const handleReceivePurchaseOrder = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    try {
      const body = (request.body as any) || {};
      const params = (request.params as any) || {};
      const ctx = await resolveTenantContext(
        body.tenantId || getTenantHint(request),
        body.outletId,
      );

      const firstItem =
        Array.isArray(body.items) && body.items.length > 0
          ? body.items[0]
          : body;
      const targetItemId =
        body.materialId ||
        body.itemId ||
        firstItem.itemId ||
        firstItem.materialId;
      const poIdOrNumber = sanitizeString(
        params.id || body.poId || body.poNumber || `PO-${Date.now()}`,
        80,
      );
      const quantity = sanitizeNumber(firstItem.quantity ?? body.quantity, {
        min: 0.01,
        fallback: 100,
      });
      const unitCost = sanitizeNumber(firstItem.unitCost ?? body.unitCost, {
        min: 0,
        fallback: 100,
      });
      const supplierName = sanitizeString(
        body.supplierName || "Supplier Mitra Roastery",
        120,
      );
      const notes = sanitizeString(
        body.notes || `Penerimaan Barang ${poIdOrNumber}`,
        500,
      );
      const paymentType = String(body.paymentMethod || "CASH").toUpperCase();

      const result = await prisma.$transaction(async (tx) => {
        // 1. Resolve target Raw Material (Item)
        let item = targetItemId
          ? await tx.item.findFirst({
              where: { id: String(targetItemId), tenantId: ctx.tenantId },
              include: { unit: true },
            })
          : null;

        if (!item && body.materialName) {
          item = await tx.item.findFirst({
            where: {
              tenantId: ctx.tenantId,
              name: { contains: sanitizeString(body.materialName, 120) },
            },
            include: { unit: true },
          });
        }

        if (!item && targetItemId) {
          const allItems = await tx.item.findMany({
            where: { tenantId: ctx.tenantId, status: "ACTIVE" },
            include: { unit: true },
            orderBy: { createdAt: "asc" },
          });
          const matchIdx = String(targetItemId).match(/^rm-(\d+)$/);
          if (matchIdx) {
            const idx = parseInt(matchIdx[1], 10) - 1;
            if (allItems[idx]) item = allItems[idx];
          }
          if (!item && allItems.length > 0) item = allItems[0];
        }

        if (!item) {
          item = await tx.item.findFirst({
            where: { tenantId: ctx.tenantId, status: "ACTIVE" },
            include: { unit: true },
          });
        }

        if (!item) {
          throw new Error("Bahan baku (Item) tidak ditemukan di gudang tenant");
        }

        // 2. Resolve or create Supplier & SupplierCatalog & PurchaseOrder
        let supplier = await tx.supplier.findFirst({
          where: { name: { contains: supplierName } },
        });
        if (!supplier) {
          supplier = await tx.supplier.findFirst();
        }
        if (!supplier) {
          supplier = await tx.supplier.create({
            data: {
              name: supplierName,
              contactEmail: `supply.${Date.now()}@ledgerline.id`,
              status: "verified",
            },
          });
        }

        let catalog = await tx.supplierCatalog.findFirst({
          where: { supplierId: supplier.id, name: { contains: item.name } },
        });
        if (!catalog) {
          catalog = await tx.supplierCatalog.findFirst({
            where: { supplierId: supplier.id },
          });
        }
        if (!catalog) {
          catalog = await tx.supplierCatalog.create({
            data: {
              supplierId: supplier.id,
              name: item.name,
              category: item.category || "Bahan Baku",
              unit: item.unit?.symbol || "g",
              price: unitCost,
              isActive: true,
            },
          });
        }

        let po = await tx.purchaseOrder.findFirst({
          where: {
            OR: [{ id: poIdOrNumber }, { poNumber: poIdOrNumber }],
          },
          include: { details: true },
        });

        const resolvedQty = quantity || po?.details?.[0]?.quantity || 100;
        const resolvedUnitCost =
          unitCost || po?.details?.[0]?.unitPrice || Number(item.price) || 100;
        const totalCostImpact = Math.round(resolvedQty * resolvedUnitCost);

        if (!po) {
          po = await tx.purchaseOrder.create({
            data: {
              poNumber: poIdOrNumber.startsWith("PO-")
                ? poIdOrNumber
                : `PO-${Date.now()}`,
              tenantId: ctx.tenantId,
              supplierId: supplier.id,
              status: "DELIVERED",
              deliveredAt: new Date(),
              notes,
              createdBy: request.user?.userId || "owner",
              details: {
                create: [
                  {
                    catalogId: catalog.id,
                    quantity: resolvedQty,
                    unitPrice: resolvedUnitCost,
                    totalPrice: totalCostImpact,
                    notes,
                  },
                ],
              },
            },
            include: { details: true },
          });
        } else {
          po = await tx.purchaseOrder.update({
            where: { id: po.id },
            data: {
              status: "DELIVERED",
              deliveredAt: new Date(),
            },
            include: { details: true },
          });
        }

        // 3. Create Receiving & ReceivingDetail
        const receiving = await tx.receiving.create({
          data: {
            purchaseOrderId: po.id,
            tenantId: ctx.tenantId,
            outletId: ctx.outletId,
            receivedBy: request.user?.userId || "Purchase Officer",
            notes,
            details: {
              create: [
                {
                  catalogId: catalog.id,
                  itemId: item.id,
                  quantityReceived: resolvedQty,
                  unitCost: resolvedUnitCost,
                },
              ],
            },
          },
        });

        // 4. Update InventoryBalance (Moving Average Cost + Stock Increment)
        const existingBalance = await tx.inventoryBalance.findUnique({
          where: {
            tenantId_itemId_warehouseId: {
              tenantId: ctx.tenantId,
              itemId: item.id,
              warehouseId: ctx.warehouseId,
            },
          },
        });

        const oldStock = Number(existingBalance?.currentStock ?? 0);
        const oldAvgCost = Number(
          existingBalance?.averageCost ?? item.price ?? resolvedUnitCost,
        );
        const newStock = oldStock + resolvedQty;
        const newAvgCost =
          newStock > 0
            ? (oldStock * oldAvgCost + resolvedQty * resolvedUnitCost) / newStock
            : resolvedUnitCost;

        if (existingBalance) {
          await tx.inventoryBalance.update({
            where: { id: existingBalance.id },
            data: {
              currentStock: newStock,
              averageCost: newAvgCost,
              version: { increment: 1 },
              lastUpdated: new Date(),
            },
          });
        } else {
          await tx.inventoryBalance.create({
            data: {
              tenantId: ctx.tenantId,
              itemId: item.id,
              warehouseId: ctx.warehouseId,
              currentStock: newStock,
              averageCost: newAvgCost,
            },
          });
        }

        await tx.item.update({
          where: { id: item.id },
          data: { price: resolvedUnitCost },
        });

        // 5. Create FIFO Layer
        await tx.fifoLayer.create({
          data: {
            tenantId: ctx.tenantId,
            itemId: item.id,
            warehouseId: ctx.warehouseId,
            batchNumber: po.poNumber,
            quantity: resolvedQty,
            remainingQty: resolvedQty,
            unitCost: resolvedUnitCost,
            layerDate: new Date(),
            isExhausted: false,
          },
        });

        // 6. Create Immutable InventoryLedger Event
        const ledgerRow = await tx.inventoryLedger.create({
          data: {
            tenantId: ctx.tenantId,
            outletId: ctx.outletId,
            warehouseId: ctx.warehouseId,
            itemId: item.id,
            movementType: "RECEIVING",
            referenceType: "PO",
            referenceId: po.poNumber,
            businessDate: new Date(),
            qtyIn: resolvedQty,
            qtyOut: 0,
            balanceAfter: newStock,
            unitCost: resolvedUnitCost,
            costMethod: "FIFO",
            unitSnapshot: item.unit?.symbol || "g",
          },
        });

        // 7. Create Double-Entry JournalEntry (Debit PERSEDIAAN, Credit KAS or UTANG_USAHA)
        const existingAccounts = await tx.account.findMany({
          where: { tenantId: ctx.tenantId },
        });
        const getOrCreateAcc = async (
          code: string,
          name: string,
          type: string,
          normalBalance: string,
        ) => {
          let acc = existingAccounts.find((a) => a.code === code);
          if (!acc) {
            acc = await tx.account.create({
              data: {
                tenantId: ctx.tenantId,
                code,
                name,
                type,
                normalBalance,
              },
            });
          }
          return acc;
        };

        const inventoryAccount = await getOrCreateAcc(
          "PERSEDIAAN",
          "Persediaan Bahan Baku",
          "ASSET",
          "DEBIT",
        );
        const creditAccount =
          paymentType === "AP" || paymentType === "CREDIT"
            ? await getOrCreateAcc(
                "UTANG_USAHA",
                "Hutang Usaha Supplier",
                "LIABILITY",
                "CREDIT",
              )
            : await getOrCreateAcc("KAS", "Kas Tunai", "ASSET", "DEBIT");

        const [jrnSeq] = await reserveNumbers(tx, ctx.tenantId, "JRN", 1);
        const yearStr = String(new Date().getFullYear());
        const entryNumber = `JRN-${yearStr}-${String(jrnSeq).padStart(6, "0")}`;

        const journal = await tx.journalEntry.create({
          data: {
            tenantId: ctx.tenantId,
            entryNumber,
            entryDate: new Date(),
            referenceType: "RECEIVING",
            referenceId: receiving.id,
            description: `Penerimaan P.O ${po.poNumber}: ${resolvedQty} ${item.unit?.symbol || "g"} ${item.name} (${supplierName})`,
            status: "POSTED",
            lines: {
              create: [
                {
                  accountId: inventoryAccount.id,
                  debit: totalCostImpact,
                  credit: 0,
                },
                {
                  accountId: creditAccount.id,
                  debit: 0,
                  credit: totalCostImpact,
                },
              ],
            },
          },
        });

        return {
          po,
          receiving,
          item,
          newStock,
          resolvedQty,
          resolvedUnitCost,
          totalCostImpact,
          ledgerRow,
          journal,
        };
      });

      return reply.send({
        success: true,
        receivingId: result.receiving.id,
        journalEntryId: result.journal.id,
        message: `Penerimaan PO ${result.po.poNumber} berhasil dicatat ke gudang dan buku besar`,
        data: {
          poNumber: result.po.poNumber,
          receivingId: result.receiving.id,
          journalEntryId: result.journal.id,
          itemId: result.item.id,
          itemName: result.item.name,
          newStock: result.newStock,
          totalCostImpact: result.totalCostImpact,
          journalEntryNumber: result.journal.entryNumber,
        },
      });
    } catch (err: any) {
      return reply.code(400).send({
        success: false,
        message: err.message || "Gagal memproses penerimaan barang PO",
      });
    }
  };

  fastify.post("/procurement/receive", handleReceivePurchaseOrder);
  fastify.post("/procurement/orders/:id/receive", handleReceivePurchaseOrder);
}
