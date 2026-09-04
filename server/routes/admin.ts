import express, { Request, Response } from 'express';
import { getPrismaClient } from '../db.js';
import { authorizeRole, AuthenticatedRequest } from '../middlewares/auth.js';
import { container } from '../container.js';
import { logger } from '../logger.js';
import { sendBrevoEmail } from '../notification.ts';

const router = express.Router();
const prisma: any = getPrismaClient();

router.use(authorizeRole(['SUPER_ADMIN']));

// Audit Logs
router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const logs = await prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json({ success: true, data: logs });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// C-9. GET /api/admin/overview
router.get('/overview', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const totalTenants = await prisma.tenant.count();
        const activeTenants = await prisma.user.count({ where: { role: 'OWNER', isActive: true }}); // simple approximation
        const totalSuppliers = await prisma.supplier.count();
        const pendingSuppliers = await prisma.supplier.count({ where: { status: 'PENDING' }});
        
        // estimasi transaksi diproses
        const agg = await prisma.salesHeader.aggregate({ _sum: { totalAmount: true } });
        
        res.json({
            success: true,
            data: {
                totalTenants,
                activeTenants,
                totalSuppliers,
                pendingSuppliers,
                estimatedTotalProcessed: agg._sum.totalAmount || 0,
                expiringSubscriptions: 0 // placeholder
            }
        });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// C-1. GET /api/admin/tenants
router.get('/tenants', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string;
        
        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        const tenants = await prisma.tenant.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                name: true,
                email: true,
                subscriptionPackage: true,
                createdAt: true,
                // omit sensitive
            }
        });
        
        const total = await prisma.tenant.count({ where });
        
        const formattedTenants = tenants.map((t: any) => ({
             ...t,
             storeName: t.name,
             ownerEmail: t.email,
             subscriptionTier: t.subscriptionPackage
        }));
        
        res.json({ success: true, data: formattedTenants, total, page, limit });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// C-2. GET /api/admin/tenants/:id
router.get('/tenants/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenant = await prisma.tenant.findUnique({
            where: { id: req.params.id },
            select: {
                id: true, name: true,
                subscriptionPackage: true,
                email: true, createdAt: true
            }
        });
        if (!tenant) return res.status(404).json({ success: false, message: 'Not found' });
        
        const formattedTenant = {
             ...tenant,
             storeName: tenant.name,
             ownerEmail: tenant.email,
             subscriptionTier: tenant.subscriptionPackage,
             storePhone: '', storeAddress: '', ledgerTokenBalance: 0, taxType: 'exclude'
        };

        const orderAgg = await prisma.salesHeader.aggregate({
            where: { tenantId: req.params.id },
            _count: { id: true },
            _sum: { totalAmount: true }
        });

        res.json({ success: true, data: { ...formattedTenant, totalOrders: orderAgg._count.id, totalRevenue: orderAgg._sum.totalAmount || 0 }});
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// C-3. PATCH /api/admin/tenants/:id
router.patch('/tenants/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { storeName, subscriptionTier, ledgerTokenBalance, taxType } = req.body;
        const updated = await prisma.tenant.update({
            where: { id: req.params.id },
            data: { name: storeName, subscriptionPackage: subscriptionTier },
            select: { id: true, name: true, subscriptionPackage: true }
        });
        const formattedUpdated = {
            ...updated,
            storeName: updated.name,
            subscriptionTier: updated.subscriptionPackage
        };
        res.json({ success: true, data: formattedUpdated });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// C-4. POST /api/admin/tenants/:id/suspend
router.post('/tenants/:id/suspend', async (req: AuthenticatedRequest, res: Response) => {
    try {
        await prisma.tenant.update({
            where: { id: req.params.id },
            data: { accountStatus: 'SUSPENDED' }
        });
        res.json({ success: true, message: 'Tenant suspended' });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/tenants/:id/reactivate', async (req: AuthenticatedRequest, res: Response) => {
    try {
        await prisma.tenant.update({
            where: { id: req.params.id },
            data: { accountStatus: 'ACTIVE' }
        });
        res.json({ success: true, message: 'Tenant reactivated' });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// C-5. POST /api/admin/tenants/:id/reset-owner-password
router.post('/tenants/:id/reset-owner-password', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tenant: any = await prisma.tenant.findUnique({ where: { id: req.params.id } });
        const ownerEmail = tenant?.ownerEmail || tenant?.email;
        if (!tenant || !ownerEmail) return res.status(404).json({ success: false, message: 'Tenant owner not found' });
        
        // Simple logic similar to /forgot-password
        const calculatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        await prisma.otpCode?.create({
            data: { email: ownerEmail, otp: calculatedOtp, expiresAt: new Date(Date.now() + 5 * 60000) }
        });
        
        const storeName = tenant.storeName || tenant.name || 'Store';
        const htmlBody = `<h1>Reset password request for ${storeName} from Admin. OTP: ${calculatedOtp}</h1>`;
        await sendBrevoEmail(ownerEmail, 'Admin Triggered Reset', htmlBody).catch(e => console.error(e));
        
        res.json({ success: true, message: 'Reset email sent to owner' });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// C-6. DELETE /api/admin/tenants/:id
router.delete('/tenants/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { confirmationText } = req.body;
        const tenant: any = await prisma.tenant.findUnique({ where: { id: req.params.id } });
        if (!tenant) return res.status(404).json({ success: false, message: 'Not found' });
        const storeName = tenant.storeName || tenant.name || '';
        if (storeName !== confirmationText) return res.status(400).json({ success: false, message: 'Confirmation failed' });
        
        await prisma.tenant.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Tenant deleted' });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// C-7, C-8 for Suppliers
router.get('/suppliers', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const suppliers = await prisma.supplier.findMany();
        res.json({ success: true, data: suppliers });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/suppliers/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id }, include: { products: true } });
        res.json({ success: true, data: supplier });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.patch('/suppliers/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { name, contactEmail, phone, status, reason } = req.body;
        const updated = await prisma.supplier.update({
            where: { id: req.params.id },
            data: { companyName: name, email: contactEmail, phone, status }
        });
        res.json({ success: true, data: updated });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/suppliers/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
        await prisma.supplier.delete({ where: { id: req.params.id } });
        res.json({ success: true, message: 'Supplier deleted' });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
});

export const adminRouter = router;
