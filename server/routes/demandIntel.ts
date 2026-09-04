import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authorizeRole } from '../middlewares/auth.js';

const prisma = new PrismaClient();
export const demandIntelRouter = Router();

demandIntelRouter.get('/global-demand', authorizeRole(['SUPER_ADMIN', 'SUPPLIER_PARTNER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recentConsumption = await prisma.inventoryTransaction.groupBy({
      by: ['materialId'],
      where: {
        type: 'OUT',
        createdAt: { gte: thirtyDaysAgo }
      },
      _sum: {
        quantity: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: 10
    });

    // Populate material names and compute growth
    const topMaterials = await Promise.all(
      recentConsumption.map(async (agg) => {
         const mat = await prisma.rawMaterial.findFirst({
           where: { id: agg.materialId }
         });

         const pastConsumption = await prisma.inventoryTransaction.aggregate({
            where: {
                materialId: agg.materialId,
                type: 'OUT',
                createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }
            },
            _sum: {
                quantity: true
            }
         });

         const currentQty = Number(agg._sum.quantity) || 0;
         const pastQty = Number(pastConsumption._sum.quantity) || 0;
         let growth = 0;
         if (pastQty > 0) {
             growth = Math.round(((currentQty - pastQty) / pastQty) * 100);
         } else if (currentQty > 0) {
             growth = 100; // New item growing
         }

         return {
           id: agg.materialId,
           name: mat?.name || 'Unknown Material',
           totalConsumption: currentQty,
           unit: mat?.stockUnit || 'kg',
           avgPrice: mat?.unitCost || 0,
           growth: growth,
           monthlyDemand: currentQty
         };
      })
    );

    // Compute Geographic Data based on Tenants
    const transactions = await prisma.inventoryTransaction.findMany({
        where: {
            type: 'OUT',
            createdAt: { gte: thirtyDaysAgo }
        }
    });

    const tenantIds = [...new Set(transactions.map(t => t.tenantId))];
    const materialIds = [...new Set(transactions.map(t => t.materialId))];

    const [tenants, materials] = await Promise.all([
      prisma.tenant.findMany({ where: { id: { in: tenantIds } } }),
      prisma.rawMaterial.findMany({ where: { id: { in: materialIds } } })
    ]);

    const tenantMap = new Map(tenants.map(t => [t.id, t]));
    const materialMap = new Map(materials.map(m => [m.id, m]));

    const geoMap = new Map<string, { volume: number, topMaterial: string, materials: Map<string, number> }>();
    
    for (const tx of transactions) {
        const tenant = tenantMap.get(tx.tenantId);
        const area = tenant?.storeAddress || 'Unknown Region';
        if (!geoMap.has(area)) {
            geoMap.set(area, { volume: 0, topMaterial: '', materials: new Map() });
        }
        const geoData = geoMap.get(area)!;
        const qty = Number(tx.quantity);
        geoData.volume += qty;
        
        const mat = materialMap.get(tx.materialId);
        const matName = mat?.name || 'Unknown Material';
        const currentMatQty = geoData.materials.get(matName) || 0;
        geoData.materials.set(matName, currentMatQty + qty);
    }

    const geographic = Array.from(geoMap.entries()).map(([area, data]) => {
        let topMat = 'None';
        let maxQty = 0;
        for (const [mName, mQty] of data.materials.entries()) {
            if (mQty > maxQty) {
                maxQty = mQty;
                topMat = mName;
            }
        }
        return {
            area,
            volume: data.volume,
            topMaterial: topMat
        };
    }).sort((a, b) => b.volume - a.volume).slice(0, 5);

    res.json({
      success: true,
      data: {
        topMaterials: topMaterials,
        geographic: geographic,
        marketTrends: {
          season: 'Based on actual transactions',
          forecast: 'Demand derived from the last 30 days.'
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
