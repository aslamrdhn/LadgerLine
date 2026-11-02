import { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma.ts";
import {
  resolveTenantContext,
  DEFAULT_MENU_IMAGE,
} from "../services/tenantContext.service.ts";
import { buildEnterpriseAppState } from "./sync.routes.ts";
import { sanitizeNumber, sanitizeString } from "../utils/sanitizer.ts";

export function getTenantHint(request: FastifyRequest): string | undefined {
  const headerTenant = request.headers["x-tenant-id"] as string | undefined;
  const queryTenant = (request.query as any)?.tenantId as string | undefined;
  const bodyTenant = (request.body as any)?.tenantId as string | undefined;
  return request.user?.tenantId || headerTenant || queryTenant || bodyTenant;
}

export async function catalogRoutes(fastify: FastifyInstance) {
  // 1. Products & Menu Management (Supports both flat and { product, recipes } payloads)
  fastify.get("/products", async (request: FastifyRequest) => {
    const state = await buildEnterpriseAppState(getTenantHint(request));
    return state.products;
  });

  const upsertMenuRecipes = async (
    tenantId: string,
    menuId: string,
    recipesPayload: any,
  ) => {
    if (!recipesPayload) return;
    let detailsList: Array<{ materialId: string; amountRequired: number }> = [];
    if (Array.isArray(recipesPayload)) {
      detailsList = recipesPayload;
    } else if (typeof recipesPayload === "object") {
      const firstVariant =
        recipesPayload.HOT ||
        recipesPayload.NORMAL ||
        Object.values(recipesPayload)[0];
      if (Array.isArray(firstVariant)) {
        detailsList = firstVariant;
      }
    }

    if (detailsList.length === 0) return;

    let recipe = await prisma.recipe.findFirst({
      where: { tenantId, menuId },
      orderBy: { version: "desc" },
    });

    if (!recipe) {
      recipe = await prisma.recipe.create({
        data: {
          tenantId,
          menuId,
          version: 1,
          effectiveFrom: new Date(Date.now() - 86400000),
        },
      });
    } else {
      await prisma.recipeDetail.deleteMany({
        where: { recipeId: recipe.id },
      });
    }

    const defaultUnit = await prisma.unit.findFirst({ where: { tenantId } });

    for (const det of detailsList) {
      const itemId = det.materialId || (det as any).itemId;
      const qty = sanitizeNumber(det.amountRequired ?? (det as any).quantity, {
        min: 0.0001,
        fallback: 1,
      });
      if (!itemId) continue;

      const item = await prisma.item.findUnique({ where: { id: itemId } });
      if (item) {
        await prisma.recipeDetail.create({
          data: {
            tenantId,
            recipeId: recipe.id,
            itemId: item.id,
            unitId: item.unitId || defaultUnit!.id,
            quantity: qty,
          },
        });
      }
    }
  };

  fastify.post("/products", async (request: FastifyRequest) => {
    const rawBody = (request.body as any) || {};
    const productData = rawBody.product || rawBody;
    const recipesData = rawBody.recipes || productData.recipes;

    const ctx = await resolveTenantContext(
      productData.tenantId || getTenantHint(request),
    );

    const name = sanitizeString(productData.name || "Menu Baru", 120);
    const price = sanitizeNumber(productData.price, { min: 0, fallback: 0 });
    const category = sanitizeString(productData.category || "Coffee", 80);
    const description = sanitizeString(
      productData.komposisi || productData.description || "",
      500,
    );
    const imageUrl =
      productData.imageUrl && String(productData.imageUrl).trim() !== ""
        ? String(productData.imageUrl).trim()
        : DEFAULT_MENU_IMAGE;

    const created = await prisma.menu.create({
      data: {
        tenantId: ctx.tenantId,
        name,
        price,
        category,
        description,
        imageUrl,
        isActive: true,
      },
    });

    await upsertMenuRecipes(ctx.tenantId, created.id, recipesData);

    const responseProduct = {
      ...productData,
      id: created.id,
      name: created.name,
      price: created.price,
      category: created.category,
      komposisi: created.description || "",
      description: created.description || "",
      imageUrl: created.imageUrl || DEFAULT_MENU_IMAGE,
      stock: sanitizeNumber(productData.stock ?? productData.stockQuantity, {
        min: 0,
        fallback: 50,
      }),
      stockQuantity: sanitizeNumber(
        productData.stockQuantity ?? productData.stock,
        { min: 0, fallback: 50 },
      ),
      isSync: true,
    };

    return { success: true, product: responseProduct, data: responseProduct };
  });

  fastify.all(
    "/products/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { id } = request.params;
      const rawBody = (request.body as any) || {};
      const productData = rawBody.product || rawBody;
      const recipesData = rawBody.recipes || productData.recipes;
      const ctx = await resolveTenantContext(
        productData.tenantId || getTenantHint(request),
      );

      if (request.method === "DELETE") {
        await prisma.menu.updateMany({
          where: { id },
          data: { isActive: false },
        });
        return { success: true, id };
      }

      if (request.method === "PUT" || request.method === "PATCH") {
        const existing = await prisma.menu.findUnique({ where: { id } });
        const updateData: any = {};
        if (productData.name !== undefined) {
          updateData.name = sanitizeString(productData.name, 120);
        }
        if (productData.price !== undefined) {
          updateData.price = sanitizeNumber(productData.price, {
            min: 0,
            fallback: existing?.price || 0,
          });
        }
        if (productData.category !== undefined) {
          updateData.category = sanitizeString(productData.category, 80);
        }
        if (
          productData.komposisi !== undefined ||
          productData.description !== undefined
        ) {
          updateData.description = sanitizeString(
            productData.komposisi ?? productData.description ?? "",
            500,
          );
        }
        if (
          productData.imageUrl !== undefined &&
          String(productData.imageUrl).trim() !== ""
        ) {
          updateData.imageUrl = String(productData.imageUrl).trim();
        }

        if (existing) {
          await prisma.menu.update({
            where: { id },
            data: updateData,
          });
          await upsertMenuRecipes(ctx.tenantId, id, recipesData);
        }

        return {
          success: true,
          product: {
            ...productData,
            id,
            imageUrl:
              updateData.imageUrl || existing?.imageUrl || DEFAULT_MENU_IMAGE,
          },
        };
      }

      return { success: true, id };
    },
  );

  // 2. Raw Materials Management (Full CRUD backed by Prisma Item & InventoryBalance)
  fastify.get("/raw-materials", async (request: FastifyRequest) => {
    const state = await buildEnterpriseAppState(getTenantHint(request));
    return state.rawMaterials;
  });

  fastify.post("/raw-materials", async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const ctx = await resolveTenantContext(
      body.tenantId || getTenantHint(request),
    );

    const name = sanitizeString(body.name || "Bahan Baku Baru", 120);
    const unitSymbol = sanitizeString(
      body.unit || body.stockUnit || "gram",
      30,
    );
    const stock = sanitizeNumber(body.stock ?? body.stockQuantity, {
      min: 0,
      fallback: 0,
    });
    const minStock = sanitizeNumber(body.minStock ?? body.warningLimit, {
      min: 0,
      fallback: 10,
    });
    const unitCost = sanitizeNumber(
      body.costPerUnit ?? body.unitCost ?? body.pricePerUnit,
      { min: 0, fallback: 0 },
    );

    let unit = await prisma.unit.findFirst({
      where: { tenantId: ctx.tenantId, symbol: unitSymbol },
    });
    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          tenantId: ctx.tenantId,
          name: unitSymbol.toUpperCase(),
          symbol: unitSymbol,
        },
      });
    }

    const sku = sanitizeString(body.sku || `SKU-${Date.now()}`, 50);
    const item = await prisma.item.create({
      data: {
        tenantId: ctx.tenantId,
        sku,
        name,
        price: unitCost,
        category: sanitizeString(body.category || "Raw Material", 80),
        unitId: unit.id,
        minStock,
        status: "ACTIVE",
      },
    });

    await prisma.inventoryBalance.create({
      data: {
        tenantId: ctx.tenantId,
        itemId: item.id,
        warehouseId: ctx.warehouseId,
        currentStock: stock,
        averageCost: unitCost,
      },
    });

    if (stock > 0) {
      await prisma.fifoLayer.create({
        data: {
          tenantId: ctx.tenantId,
          itemId: item.id,
          warehouseId: ctx.warehouseId,
          batchNumber: `INIT-${Date.now()}`,
          quantity: stock,
          remainingQty: stock,
          unitCost,
          layerDate: new Date(),
        },
      });
    }

    const formatted = {
      id: item.id,
      name: item.name,
      stock,
      stockQuantity: stock,
      unit: unitSymbol,
      stockUnit: unitSymbol,
      minStock,
      warningLimit: minStock,
      costPerUnit: unitCost,
      unitCost,
      pricePerUnit: unitCost,
      supplierName: body.supplierName || "Supplier Utama",
      supplierContact: body.supplierContact || "0812-3456-7890",
    };

    return { success: true, item: formatted, data: formatted };
  });

  fastify.all(
    "/raw-materials/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>) => {
      const { id } = request.params;
      const body = (request.body as any) || {};
      const ctx = await resolveTenantContext(
        body.tenantId || getTenantHint(request),
      );

      if (request.method === "DELETE") {
        await prisma.item.updateMany({
          where: { id },
          data: { status: "INACTIVE" },
        });
        return { success: true, id };
      }

      if (request.method === "PUT" || request.method === "PATCH") {
        const existing = await prisma.item.findUnique({
          where: { id },
          include: { unit: true },
        });
        if (!existing) {
          return { success: true, id };
        }

        let unitId = existing.unitId;
        const unitSymbol = sanitizeString(
          body.unit || body.stockUnit || existing.unit.symbol,
          30,
        );
        if (unitSymbol !== existing.unit.symbol) {
          let unit = await prisma.unit.findFirst({
            where: { tenantId: ctx.tenantId, symbol: unitSymbol },
          });
          if (!unit) {
            unit = await prisma.unit.create({
              data: {
                tenantId: ctx.tenantId,
                name: unitSymbol.toUpperCase(),
                symbol: unitSymbol,
              },
            });
          }
          unitId = unit.id;
        }

        const unitCost = sanitizeNumber(
          body.costPerUnit ?? body.unitCost ?? body.pricePerUnit,
          { min: 0, fallback: existing.price },
        );
        const minStock = sanitizeNumber(body.minStock ?? body.warningLimit, {
          min: 0,
          fallback: existing.minStock ?? 10,
        });

        await prisma.item.update({
          where: { id },
          data: {
            name: body.name ? sanitizeString(body.name, 120) : existing.name,
            price: unitCost,
            minStock,
            unitId,
          },
        });

        if (body.stock !== undefined || body.stockQuantity !== undefined) {
          const newStock = sanitizeNumber(body.stock ?? body.stockQuantity, {
            min: 0,
            fallback: 0,
          });
          await prisma.inventoryBalance.upsert({
            where: {
              tenantId_itemId_warehouseId: {
                tenantId: ctx.tenantId,
                itemId: id,
                warehouseId: ctx.warehouseId,
              },
            },
            update: {
              currentStock: newStock,
              averageCost: unitCost,
              lastUpdated: new Date(),
            },
            create: {
              tenantId: ctx.tenantId,
              itemId: id,
              warehouseId: ctx.warehouseId,
              currentStock: newStock,
              averageCost: unitCost,
            },
          });
        }

        return {
          success: true,
          item: {
            ...body,
            id,
          },
        };
      }

      return { success: true, id };
    },
  );

  // 3. Inventory Waste Recording
  fastify.post("/inventory-waste", async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const ctx = await resolveTenantContext(
      body.tenantId || getTenantHint(request),
    );
    const materialId = body.materialId || body.itemId;
    const amount = sanitizeNumber(body.amount ?? body.quantity, {
      min: 0.01,
      fallback: 1,
    });
    const reason = sanitizeString(body.reason || "Rusak / Tumpah", 255);

    if (materialId) {
      const item = await prisma.item.findUnique({
        where: { id: materialId },
        include: { unit: true },
      });

      if (item) {
        const balance = await prisma.inventoryBalance.findFirst({
          where: { tenantId: ctx.tenantId, itemId: item.id },
        });
        const prevStock = balance?.currentStock ?? 0;
        const nextStock = Math.max(0, prevStock - amount);

        if (balance) {
          await prisma.inventoryBalance.update({
            where: { id: balance.id },
            data: {
              currentStock: nextStock,
              lastUpdated: new Date(),
            },
          });
        }

        const wasteRecord = await prisma.waste.create({
          data: {
            tenantId: ctx.tenantId,
            outletId: ctx.outletId,
            itemId: item.id,
            quantity: amount,
            reason,
            status: "approved",
            createdBy: request.user?.userId || "staff",
            approvedBy: "system",
            approvedAt: new Date(),
          },
        });

        await prisma.inventoryLedger.create({
          data: {
            tenantId: ctx.tenantId,
            outletId: ctx.outletId,
            warehouseId: balance?.warehouseId || ctx.warehouseId,
            itemId: item.id,
            movementType: "OUT",
            referenceType: "WASTE",
            referenceId: wasteRecord.id,
            businessDate: new Date(),
            qtyIn: 0,
            qtyOut: amount,
            balanceAfter: nextStock,
            unitCost: item.price || 0,
            costMethod: "AVERAGE",
            unitSnapshot: item.unit.symbol,
          },
        });
      }
    }

    return {
      success: true,
      message:
        "Pencatatan limbah/waste berhasil disimpan dan stok telah diperbarui",
    };
  });

  // 4. Explicit Recipe / BOM Management Endpoints
  const handleUpsertRecipe = async (request: FastifyRequest) => {
    const body = (request.body as any) || {};
    const ctx = await resolveTenantContext(
      body.tenantId || getTenantHint(request),
    );
    const menuId = body.menuId || body.productId;
    const items = body.items || body.recipes || body.details || [];

    if (!menuId) {
      return { success: false, message: "menuId atau productId wajib diisi" };
    }

    await upsertMenuRecipes(ctx.tenantId, menuId, items);
    const recipe = await prisma.recipe.findFirst({
      where: { tenantId: ctx.tenantId, menuId },
      include: { details: { include: { item: true, unit: true } } },
      orderBy: { version: "desc" },
    });

    return {
      success: true,
      recipe,
      data: recipe,
    };
  };

  fastify.get("/recipes", async (request: FastifyRequest) => {
    const ctx = await resolveTenantContext(getTenantHint(request));
    const recipes = await prisma.recipe.findMany({
      where: { tenantId: ctx.tenantId },
      include: { details: { include: { item: true, unit: true } } },
    });
    return { success: true, data: recipes, recipes };
  });

  fastify.post("/recipes", handleUpsertRecipe);
  fastify.post("/product-recipes", handleUpsertRecipe);
}
