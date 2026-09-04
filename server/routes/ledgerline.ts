import { Router, Response } from 'express';
import { AuthenticatedRequest, authorizeRole } from '../middlewares/auth.js';
import { getPrismaClient } from '../db.js';

export const ledgerlineRouter = Router();

// ==========================================
// 1. MANAGE ALL TENANTS (STORES)
// ==========================================
ledgerlineRouter.get('/admin/tenants', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prisma: any = getPrismaClient();
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        code: true,
        subscriptionPackage: true,
        subscriptionStatus: true,
        status: true,
        createdAt: true
      }
    });
    res.json(tenants.map((t: any) => ({ ...t, storeName: t.name })));
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Subscription Tier and Token Balance
ledgerlineRouter.post('/admin/tenants/:id/update-plan', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { subscriptionTier, tokenToAdd } = req.body;
  try {
    const prisma: any = getPrismaClient();
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
        return res.status(404).json({ success: false, message: 'Tenant not found.' });
    }

    const updateData: any = {};
    if (subscriptionTier) {
        updateData.subscriptionPackage = subscriptionTier;
    }
    
    if (Object.keys(updateData).length > 0) {
        await prisma.tenant.update({
            where: { id },
            data: updateData
        });
    }

    res.json({ success: true, message: 'Tenant plan/token updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. PURCHASE REQUESTS (POS -> SUPPLIER)
// ==========================================
ledgerlineRouter.get('/admin/purchase-requests', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prisma: any = getPrismaClient();
    const requests = await prisma.purchaseRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        Tenant: { select: { id: true, name: true, code: true } },
        Outlet: { select: { id: true, name: true } }
      }
    });

    res.json(requests);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default ledgerlineRouter;
