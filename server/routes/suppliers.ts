import { Router, Response } from 'express';
import { AuthenticatedRequest, authorizeRole, getJwtSecret } from '../middlewares/auth.js';
import { getPrismaClient } from '../db.js';
import { container } from '../container.ts';
import { securityLogger } from '../logger.js';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

// ==========================================
// 1. PUBLIC & ADMIN SUPPLIER ENDPOINTS
// ==========================================

router.get('/suppliers/public', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const prisma = getPrismaClient();
    const suppliers = await prisma.supplier.findMany({
      where: {
        OR: [
          { status: 'ACTIVE' },
          { verificationStatus: 'VERIFIED' }
        ],
        subscriptions: {
          some: {
            status: { in: ['TRIAL', 'ACTIVE'] },
            endDate: { gte: new Date() }
          }
        }
      },
      include: {
        products: {
          where: { approvalStatus: 'APPROVED' }
        }
      }
    });
    
    const mappedSuppliers = suppliers.map(s => ({
         ...s,
         listings: s.products.map(p => ({
             ...p,
             product_name: p.productName,
             price_offer: p.priceOffer,
             photo_url: p.photoUrl,
             approval_status: p.approvalStatus
         })),
         passwordHash: undefined,
         password_hash: undefined,
         createdAt: s.createdAt,
         company_name: s.companyName,
         owner_name: s.ownerName,
         verification_status: s.verificationStatus
    }));

    res.json(mappedSuppliers);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/suppliers', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } });
    const mapped = suppliers.map(s => ({
        ...s,
         company_name: s.companyName,
         owner_name: s.ownerName,
         verification_status: s.verificationStatus,
         created_at: s.createdAt
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/products/pending', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const products = await prisma.supplierProduct.findMany({
      where: { approvalStatus: 'SUBMITTED' },
      include: { supplier: { select: { companyName: true, ownerName: true } } }
    });
    const mapped = products.map(p => ({
       ...p,
       company_name: p.supplier.companyName,
       owner_name: p.supplier.ownerName,
       product_name: p.productName,
       price_offer: p.priceOffer,
       photo_url: p.photoUrl,
       approval_status: p.approvalStatus,
       rejection_reason: p.rejectionReason,
       supplier_id: p.supplierId
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/suppliers/:id/status', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status, verification_status } = req.body;
  try {
    const prisma = getPrismaClient();
    const data: any = {};
    if (status) data.status = status;
    if (verification_status) data.verificationStatus = verification_status;
    
    if (Object.keys(data).length > 0) {
        await prisma.supplier.update({
            where: { id },
            data
        });
    }
    res.json({ success: true, message: 'Supplier updated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/purchase-requests', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const prisma = getPrismaClient();
    const prs = await prisma.purchaseRequest.findMany({
      include: {
        supplier: { select: { companyName: true } },
        product: { select: { productName: true, priceOffer: true } },
        tenant: { select: { storeName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const mapped = prs.map(pr => ({
      ...pr,
      supplier_name: pr.supplier.companyName,
      product_name: pr.product.productName,
      store_name: pr.tenant.storeName,
      price_offer: pr.product.priceOffer
    }));
    
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/purchase-requests/:id/verify', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // usually VERIFIED or REJECTED

  try {
    const prisma = getPrismaClient();
    await prisma.purchaseRequest.update({
        where: { id },
        data: { status }
    });
    res.json({ success: true, message: 'Purchase request verified.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/products/:id/status', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;
  try {
    const prisma = getPrismaClient();
    await prisma.supplierProduct.update({
        where: { id },
        data: {
            approvalStatus: status,
            rejectionReason: rejection_reason || null
        }
    });
    res.json({ success: true, message: 'Product updated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 2. SUPPLIER PARTNER ROLE (REGISTRATION)
// ==========================================

router.post('/supplier/register', async (req: AuthenticatedRequest, res: Response) => {
  const { email, company_name, owner_name, password, phone, address, npwp, nib, warehouse_address, bank_account, warehouse_photo_url, product_photo_url, legal_document_url } = req.body;
  if (!email || !company_name || !password || !phone) {
    return res.status(400).json({ success: false, message: 'Harap melengkapi data pendaftaran supplier.' });
  }

  try {
    const prisma = getPrismaClient();
    const alreadyExists = await prisma.supplier.findFirst({ where: { email: email.toLowerCase() } });
    if (alreadyExists) {
      return res.status(400).json({ success: false, message: 'Email supplier tersebut sudah terdaftar.' });
    }

    const supId = `sup-${Date.now()}`;
    const hash = await bcrypt.hash(password, 10);

    const d = new Date();
    const st = new Date(d);
    d.setDate(d.getDate() + 30);
    const en = new Date(d);

    await prisma.$transaction(async (tx) => {
       await tx.supplier.create({
           data: {
               id: supId,
               companyName: company_name,
               ownerName: owner_name || company_name,
               phone,
               email: email.toLowerCase(),
               address: address || '',
               npwp: npwp || null,
               nib: nib || null,
               warehouseAddress: warehouse_address || null,
               bankAccount: bank_account || null,
               warehousePhotoUrl: warehouse_photo_url || null,
               productPhotoUrl: product_photo_url || null,
               legalDocumentUrl: legal_document_url || null,
               passwordHash: hash,
               status: 'PENDING',
               verificationStatus: 'STANDARD'
           }
       });

       await tx.supplierSubscription.create({
           data: {
               id: `sub-${Date.now()}`,
               supplierId: supId,
               package: 'TRIAL',
               status: 'TRIAL',
               startDate: st,
               endDate: en,
               paymentStatus: 'UNPAID'
           }
       });
    });

    res.json({ success: true, message: 'Pendaftaran berhasil. Menunggu approval Super Admin.', supplierId: supId });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/supplier/login', async (req: AuthenticatedRequest, res: Response) => {
  const { email, password } = req.body;
  try {
    const prisma = getPrismaClient();
    const sup = await prisma.supplier.findFirst({ where: { email: email.toLowerCase() } });
    if (!sup) {
      return res.status(401).json({ success: false, message: 'Sandi atau email salah.' });
    }

    const isMatch = sup.passwordHash && bcrypt.compareSync(password, sup.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Sandi atau email salah.' });
    }

    const token = jwt.sign(
      { id: sup.id, email: sup.email, role: 'SUPPLIER_PARTNER' },
      getJwtSecret(),
      { expiresIn: '7d' }
    );
    
    try {
       await container.systemRepository.createSecurityAuditLog('SUPPLIER_SYS', {
          action: 'LOGIN_SUPPLIER',
          operator: sup.email,
          details: `Supplier ${sup.email} logged in from IP ${req.ip}`,
          severity: 'info'
       });
    } catch (e) {
       securityLogger.error(`Failed to write login audit log`);
    }

    res.json({
      success: true,
      supplier: { id: sup.id, email: sup.email, companyName: sup.companyName, role: 'SUPPLIER_PARTNER', status: sup.status },
      token
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 3. PURCHASE REQUESTS (COFFEE SHOP SIDE)
// ==========================================

router.post('/purchase-request', authorizeRole(['owner', 'kasir', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { supplierId, productId, quantity, notes } = req.body; 

  if (!tenantId || !supplierId || !productId || !quantity) {
    return res.status(400).json({ success: false, message: 'Data Purchase Request tidak lengkap.' });
  }

  try {
    const prisma = getPrismaClient();
    // ENFORCEMENT: Validate subscription before allowing a Purchase Request
    const subCheck = await prisma.supplierSubscription.findFirst({
        where: { supplierId },
        orderBy: { endDate: 'desc' }
    });
    
    if (!subCheck || !['TRIAL', 'ACTIVE'].includes(subCheck.status) || subCheck.endDate < new Date()) {
       return res.status(403).json({ success: false, message: 'Supplier ini sedang tidak dapat menerima pesanan karena masalah subscription (EXPIRED/SUSPENDED).' });
    }

    const prId = `PR-${Date.now()}`;
    await prisma.purchaseRequest.create({
        data: {
            id: prId,
            tenantId,
            supplierId,
            productId,
            quantity: Number(quantity),
            notes: notes || '',
            status: 'PENDING_VERIFICATION'
        }
    });

    res.json({ success: true, message: 'Permintaan berhasil dikirim.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/purchase-requests/tenant', authorizeRole(['owner', 'kasir', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(401).json({ success: false, message: 'Unauth' });

  try {
    const prisma = getPrismaClient();
    const list = await prisma.purchaseRequest.findMany({
        where: { tenantId },
        include: {
            supplier: { select: { companyName: true } },
            product: { select: { productName: true, unit: true, priceOffer: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const mapped = list.map(pr => ({
        ...pr,
        supplier_name: pr.supplier.companyName,
        product_name: pr.product.productName,
        unit: pr.product.unit,
        price_offer: pr.product.priceOffer,
        supplier_id: pr.supplierId,
        product_id: pr.productId,
        tenant_id: pr.tenantId,
        created_at: pr.createdAt
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 4. SMART PROCUREMENT & DATA INTELLIGENCE
// ==========================================

router.get('/procurement/smart-suggestions', authorizeRole(['owner', 'kasir', 'admin', 'CASHIER', 'SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) return res.status(401).json({ success: false, message: 'Unauth' });

  try {
    const prisma = getPrismaClient();
    const materials = await prisma.rawMaterial.findMany({ where: { tenantId } });
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const txns = await prisma.inventoryTransaction.findMany({
        where: {
            tenantId,
            type: { in: ['OUT', 'WASTE'] },
            createdAt: { gte: thirtyDaysAgo }
        }
    });

    const suggestions = materials.map(mat => {
      const consumed = txns
        .filter(t => t.materialId === mat.id)
        .reduce((sum, t) => sum + Number(t.quantity), 0);
      
      const dailyUsage = consumed / 30;
      const currentStock = Number(mat.stockQuantity);
      
      let daysUntilDepletion = 999;
      if (dailyUsage > 0) {
        daysUntilDepletion = currentStock / dailyUsage;
      }

      return {
        materialId: mat.id,
        materialName: mat.name,
        currentStock,
        unit: mat.stockUnit,
        avgDailyUsage: dailyUsage,
        daysUntilDepletion: Math.floor(daysUntilDepletion),
        isCritical: Math.floor(daysUntilDepletion) <= 7 
      };
    }).filter(s => s.avgDailyUsage > 0);

    suggestions.sort((a, b) => a.daysUntilDepletion - b.daysUntilDepletion);
    res.json(suggestions);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 5. SUPPLIER PORTAL ENDPOINTS
// ==========================================

router.get('/supplier/purchase-requests', authorizeRole(['SUPPLIER_PARTNER']), async (req: AuthenticatedRequest, res: Response) => {
  const supplierId = req.user?.id || req.user?.supplierId; // accommodate logic if mapped as supplierId
  if (!supplierId) return res.status(401).json({ success: false, message: 'Unauth supplier' });

  try {
    const prisma = getPrismaClient();
    const list = await prisma.purchaseRequest.findMany({
        where: { supplierId },
        include: {
            tenant: { select: { storeName: true, storePhone: true, storeAddress: true } },
            product: { select: { productName: true, unit: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const mapped = list.map(pr => ({
        ...pr,
        storeName: pr.tenant?.storeName,
        storePhone: pr.tenant?.storePhone,
        storeAddress: pr.tenant?.storeAddress,
        product_name: pr.product?.productName,
        unit: pr.product?.unit,
        supplier_id: pr.supplierId,
        product_id: pr.productId,
        tenant_id: pr.tenantId,
        created_at: pr.createdAt
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/supplier/purchase-requests/:id/action', authorizeRole(['SUPPLIER_PARTNER']), async (req: AuthenticatedRequest, res: Response) => {
  const supplierId = req.user?.id || req.user?.supplierId;
  const { id } = req.params;
  const { action, tracking_resi } = req.body; 

  if (!supplierId) return res.status(401).json({ success: false, message: 'Unauth supplier' });

  try {
    let newStatus = 'VERIFIED';
    const dataToUpdate: any = {};
    if (action === 'PROCESS') newStatus = 'PROCESSING';
    if (action === 'SHIP') {
      newStatus = 'SHIPPED';
      if (tracking_resi) dataToUpdate.trackingResi = tracking_resi;
    }
    if (action === 'DELIVER') newStatus = 'DELIVERED';
    if (action === 'CANCEL') newStatus = 'CANCELLED';
    if (action === 'COMPLETE') newStatus = 'COMPLETED';

    dataToUpdate.status = newStatus;

    const prisma = getPrismaClient();
    await prisma.purchaseRequest.updateMany({
        where: { id, supplierId },
        data: dataToUpdate
    });

    res.json({ success: true, message: 'Status updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 6. SUPPLIER PRODUCTS CATALOG (LISTINGS)
// ==========================================

router.get('/supplier/products', authorizeRole(['SUPPLIER_PARTNER']), async (req: AuthenticatedRequest, res: Response) => {
  const supplierId = req.user?.id || req.user?.supplierId;
  if (!supplierId) return res.status(401).json({ success: false, message: 'Unauth supplier' });

  try {
    const prisma = getPrismaClient();
    const products = await prisma.supplierProduct.findMany({
        where: { supplierId },
        orderBy: { createdAt: 'desc' }
    });
    
    const mapped = products.map(p => ({
        ...p,
        product_name: p.productName,
        price_offer: p.priceOffer,
        photo_url: p.photoUrl,
        approval_status: p.approvalStatus,
        rejection_reason: p.rejectionReason,
        supplier_id: p.supplierId,
        created_at: p.createdAt
    }));
    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/supplier/products', authorizeRole(['SUPPLIER_PARTNER']), async (req: AuthenticatedRequest, res: Response) => {
  const supplierId = req.user?.id || req.user?.supplierId;
  const { product_name, category, price_offer, unit, photo_url } = req.body;
  if (!supplierId) return res.status(401).json({ success: false, message: 'Unauth supplier' });

  try {
    const prisma = getPrismaClient();

    // ENFORCEMENT: Check subscription limits
    const sub = await prisma.supplierSubscription.findFirst({
        where: { supplierId },
        orderBy: { endDate: 'desc' }
    });

    if (!sub || !['TRIAL', 'ACTIVE'].includes(sub.status) || sub.endDate < new Date()) {
       return res.status(403).json({ success: false, message: 'Langganan Anda telah habis atau ditangguhkan. Silakan perbarui paket Anda.' });
    }

    if (sub.package === 'TRIAL') {
       // Limit to 5 products for trial
       const currentProductsCount = await prisma.supplierProduct.count({
           where: { supplierId }
       });
       if (currentProductsCount >= 5) {
           return res.status(403).json({ success: false, message: 'Paket TRIAL hanya mengizinkan maksimal 5 produk. Silakan upgrade ke paket berbayar.' });
       }
    }

    const pId = `sp-${Date.now()}`;
    await prisma.supplierProduct.create({
        data: {
            id: pId,
            supplierId,
            productName: product_name,
            category,
            priceOffer: Number(price_offer),
            unit,
            photoUrl: photo_url || null,
            approvalStatus: 'SUBMITTED'
        }
    });
    
    res.json({ success: true, message: 'Produk diajukan untuk approval.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/supplier/products/:id', authorizeRole(['SUPPLIER_PARTNER']), async (req: AuthenticatedRequest, res: Response) => {
  const supplierId = req.user?.id || req.user?.supplierId;
  const { id } = req.params;
  if (!supplierId) return res.status(401).json({ success: false, message: 'Unauth supplier' });

  try {
    const prisma = getPrismaClient();
    await prisma.supplierProduct.deleteMany({
        where: { id, supplierId }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/suppliers/tenant', authorizeRole(['owner', 'kasir', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const prisma = getPrismaClient();
    const prs = await prisma.purchaseRequest.findMany({
      where: { tenantId },
      include: { 
        supplier: { 
           include: { products: true } 
        } 
      }
    });

    const supsMap = new Map();
    for (const pr of prs) {
       if (pr.supplier) {
          const s = pr.supplier;
          // Transform products to match the expected listings
          const listings = s.products.map((p: any) => ({
             ...p,
             product_name: p.productName,
             price_offer: p.priceOffer,
             photo_url: p.photoUrl,
             approval_status: p.approvalStatus
          }));
          supsMap.set(s.id, {
            ...s,
            listings,
            company_name: s.companyName,
            owner_name: s.ownerName,
            verification_status: s.verificationStatus
          });
       }
    }

    res.json(Array.from(supsMap.values()));
  } catch(err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export const suppliersRouter = router;
