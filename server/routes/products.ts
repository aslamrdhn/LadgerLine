import { Router, Response } from 'express';
import { container } from '../container.ts';
import { AuthenticatedRequest, authorizeRole } from '../middlewares/auth.ts';
import { validateBody, productSaveSchema, rawMaterialSaveSchema } from '../middlewares/validation.ts';
import { logger } from '../logger.js';

const router = Router();

// ==========================================
// A. PRODUCT ENDPOINTS
// ==========================================

router.get('/products', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const products = await container.productRepository.getProducts(tenantId);
    res.json(products);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/products', authorizeRole(['Owner', 'superadmin']), validateBody(productSaveSchema), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const saved = await container.productRepository.saveProduct(tenantId, req.body);
    res.json({ success: true, product: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/products/:id', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const data = { ...req.body, id: req.params.id };
    const saved = await container.productRepository.saveProduct(tenantId, data);
    res.json({ success: true, product: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/products/:id', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const success = await container.productRepository.deleteProduct(tenantId, req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/products/batch-save', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { products } = req.body;
  if (!Array.isArray(products)) {
    return res.status(400).json({ success: false, message: 'Daftar produk batch tidak valid.' });
  }
  try {
    const results = [];
    for (const p of products) {
      const saved = await container.productRepository.saveProduct(tenantId, p);
      results.push(saved);
    }
    res.json({ success: true, productsCount: results.length });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// B. RAW MATERIAL ENDPOINTS
// ==========================================

router.get('/raw-materials', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const materials = await container.productRepository.getRawMaterials(tenantId);
    res.json(materials);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/raw-materials', authorizeRole(['Owner', 'superadmin']), validateBody(rawMaterialSaveSchema), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const saved = await container.productRepository.saveRawMaterial(tenantId, req.body);
    res.json({ success: true, material: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/raw-materials/:id', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const data = { ...req.body, id: req.params.id };
    const saved = await container.productRepository.saveRawMaterial(tenantId, data);
    res.json({ success: true, material: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/raw-materials/:id', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const success = await container.productRepository.deleteRawMaterial(tenantId, req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Record raw material waste events
router.post('/raw-materials/:id/waste', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  const { amount, reason } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Jumlah waste pembuangan bahan wajib valid.' });
  }

  try {
    const materials = await container.productRepository.getRawMaterials(tenantId);
    const material = materials.find(m => m.id === id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Bahan baku tidak ditemukan.' });
    }

    (material as any).stockQuantity = Math.max(0, Number(material.stockQuantity || material.stockQuantity) - amount);
    
    await container.productRepository.saveRawMaterial(tenantId, material);

    // Audit trace log
    await container.systemRepository.createSecurityAuditLog(tenantId, {
      action: 'WASTE_RECORD',
      operator: req.user?.email || 'SYSTEM',
      details: `Bahan terbuang (waste) sebanyak ${amount} ${material.stockUnit} pada ${material.name} karena: ${reason || 'tanpa keterangan'}`
    });

    res.json({ success: true, material });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Restock Raw Material lokally
router.post('/raw-materials/:id/restock', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  const { amount, cost } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Tentukan kuantitas restock bahan.' });
  }

  try {
    const materials = await container.productRepository.getRawMaterials(tenantId);
    const material = materials.find(m => m.id === id);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Bahan baku tidak ditemukan.' });
    }

    const currentStock = Number(material.stockQuantity || material.stockQuantity || 0);
    const currentUnitCost = Number(material.unitCost || material.unitCost || 0);
    const newStockAmount = Number(amount);
    
    if (cost && cost > 0) {
      const newCostTotal = Number(cost);
      const totalCurrentValue = currentStock * currentUnitCost;
      const totalNewValue = newCostTotal;
      const finalStock = currentStock + newStockAmount;
      
      if (finalStock > 0) {
        (material as any).unitCost = (totalCurrentValue + totalNewValue) / finalStock;
        
      }
    }

    (material as any).stockQuantity = currentStock + newStockAmount;
    
    await container.productRepository.saveRawMaterial(tenantId, material);

    // [AVERAGE ACCOUNTING COMPLETION] Auto-sync COGS all products using this material
    // [AVERAGE ACCOUNTING COMPLETION] Auto-sync COGS all products using this material
    // try {
    //   const { getPrismaClient } = await import("../db.js");
    //   const prisma = getPrismaClient();
    //   const recipesUsing = await prisma.recipe.findMany({ where: { materialId: material.id } });
    //   for (const r of recipesUsing) {
    //     const allMatForProd = await prisma.recipe.findMany({ 
    //         where: { productId: r.productId },
    //         include: { material: true } 
    //     });
    //     const newCOGS = allMatForProd.reduce((sum, rec) => sum + (Number(rec.amount) * Number(rec.material.unitCost)), 0);
    //     await prisma.menu.update({ 
    //         where: { id: r.productId },
    //         data: { costPrice: newCOGS } 
    //     });
    //   }
    // } catch(err) {
    //   console.error("Failed to sync COGS:", err);
    // }
    // Write a finance log entry for raw stock purchased
    if (cost && cost > 0) {
      await container.financeRepository.createFinanceLog(tenantId, {
        id: `fin-pur-${Date.now()}`,
        type: 'expense',
        category: 'Belanja Bahan Baku',
        amount: cost,
        description: `Beli bahan baku ${amount} ${material.stockUnit} ${material.name}`
      });
    }

    res.json({ success: true, material });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// C. RECIPE ENDPOINTS
// ==========================================

router.get('/recipes', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const recipes = await container.productRepository.getRecipes(tenantId);
    res.json(recipes);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/recipes', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { productId, materialId, amount, notes } = req.body;
  if (!productId || !materialId || !amount) {
    return res.status(400).json({ success: false, message: 'Harap melengkapi link productId, materialId, dan takaran bahan.' });
  }

  try {
    const recipe = await container.productRepository.saveRecipe(tenantId, productId, materialId, amount, notes);
    res.json({ success: true, recipe });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export const productsRouter = router;
