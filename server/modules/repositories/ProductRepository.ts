import { getPrismaClient } from '../../db.ts';
import { logger } from '../../logger.js';
import bcrypt from 'bcryptjs';


function serializeDbBigInts(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (obj instanceof Date) return obj;
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') return obj.toNumber();
  if (Array.isArray(obj)) return obj.map(serializeDbBigInts);
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = serializeDbBigInts(obj[key]);
      }
    }
    return serialized;
  }
  return obj;
}

export class ProductRepository {
  async getProducts(tenantId: string): Promise<any[]> {
    const prisma = getPrismaClient();
    try {
      return await prisma.product.findMany({ 
        where: { tenantId },
        include: { recipes: true }
      });
    } catch (err: any) {
      logger.error(`[Prisma - getProducts] Failed: ${err.message}`);
      throw err;
    }
  }

  async saveProduct(tenantId: string, product: any): Promise<any> {
    const prisma = getPrismaClient();
    const cleanProductPrisma = {
      name: product.name,
      category: product.category,
      price: Number(product.price),
      costPrice: Number(product.costPrice || product.cost_price || 0),
      stock: Number(product.stock || 0),
      warningLimit: Number(product.warningLimit || product.warning_limit || 10),
      barcode: product.barcode || null,
      supplierName: product.supplierName || product.supplier_name || null,
      supplierContact: product.supplierContact || product.supplier_contact || null,
      imageUrl: product.imageUrl || product.image_url || product.image || null,
      komposisi: product.komposisi || null,
      promoActive: !!(product.promoActive || product.promo_active),
      promoDiscountPercent: Number(product.promoDiscountPercent || product.promo_discount_percent || 0)
    };

    try {
      const existing = await prisma.product.findUnique({ where: { id: product.id } });
      if (existing && existing.tenantId !== tenantId) {
        throw new Error('Unauthorized or cross-tenant modification detected');
      }

      return await prisma.product.upsert({
        where: { id: product.id },
        create: { id: product.id, tenantId, ...cleanProductPrisma },
        update: cleanProductPrisma
      });
    } catch (err: any) {
      logger.error(`[Prisma - saveProduct] Failed: ${err.message}`);
      throw err;
    }
  }

  async deleteProduct(tenantId: string, productId: string): Promise<boolean> {
    const prisma = getPrismaClient();
    try {
      await prisma.product.delete({ where: { id: productId, tenantId } });
      return true;
    } catch (err: any) {
      logger.error(`[Prisma - deleteProduct] Failed: ${err.message}`);
      return false;
    }
  }

  async getRawMaterials(tenantId: string): Promise<any[]> {
    const prisma = getPrismaClient();
    try {
      return await prisma.rawMaterial.findMany({ where: { tenantId } });
    } catch (err: any) {
      logger.error(`[Prisma - getRawMaterials] Failed: ${err.message}`);
      throw err;
    }
  }

  async saveRawMaterial(tenantId: string, material: any): Promise<any> {
    const prisma = getPrismaClient();
    const mappedPrisma = {
      name: material.name,
      stockQuantity: parseFloat(material.stockQuantity || material.stock_quantity || 0),
      stockUnit: material.stockUnit || material.stock_unit || 'g',
      warningLimit: Number(material.warningLimit || material.warning_limit || 500),
      supplierName: material.supplierName || material.supplier_name || null,
      supplierContact: material.supplierContact || material.supplier_contact || null,
      unitCost: parseFloat(material.unitCost || material.unit_cost || 0),
      isTaxable: !!(material.isTaxable || material.is_taxable),
      taxRate: parseFloat(material.taxRate || material.tax_rate || 0)
    };

    try {
      const existing = await prisma.rawMaterial.findUnique({ where: { id: material.id } });
      if (existing && existing.tenantId !== tenantId) {
        throw new Error('Unauthorized or cross-tenant modification detected');
      }

      return await prisma.rawMaterial.upsert({
        where: { id: material.id },
        create: { id: material.id, tenantId, ...mappedPrisma },
        update: mappedPrisma
      });
    } catch (err: any) {
      logger.error(`[Prisma - saveRawMaterial] Failed: ${err.message}`);
      throw err;
    }
  }

  async deleteRawMaterial(tenantId: string, materialId: string): Promise<boolean> {
    const prisma = getPrismaClient();
    try {
      await prisma.rawMaterial.delete({ where: { id: materialId, tenantId } });
      return true;
    } catch (err: any) {
      logger.error(`[Prisma - deleteRawMaterial] Failed: ${err.message}`);
      return false;
    }
  }

  async getRecipes(tenantId: string): Promise<any[]> {
    const prisma = getPrismaClient();
    try {
      return await prisma.recipe.findMany({
        where: { product: { tenantId } }
      });
    } catch (err: any) {
      logger.error(`[Prisma - getRecipes] Failed: ${err.message}`);
      throw err;
    }
  }

  async saveRecipe(tenantId: string, productId: string, materialId: string, amount: number, notes?: string): Promise<any> {
    const prisma = getPrismaClient();
    try {
      // FIX P0: Missing tenant boundary checking for creating/updating recipes.
      const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
      if (!product) throw new Error('Product not found for this tenant.');

      const material = await prisma.rawMaterial.findFirst({ where: { id: materialId, tenantId } });
      if (!material) throw new Error('Raw Material not found for this tenant.');

      return await prisma.recipe.upsert({
        where: { productId_materialId: { productId, materialId } },
        create: { productId, materialId, amount, notes },
        update: { amount, notes }
      });
    } catch (err: any) {
      logger.error(`[Prisma - saveRecipe] Failed: ${err.message}`);
      throw err;
    }
  }
}
