import { Router, Response } from 'express';
import { container } from '../container.ts';
import { AuthenticatedRequest, authorizeRole } from '../middlewares/auth.ts';
import { triggerWhatsAppNotification } from '../notification.js';
import { getPrismaClient } from '../db.ts';


const router = Router();

// 1. GET ALL LOYAL CUSTOMERS
router.get('/customer/loyalty', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const list = await container.systemRepository.getCustomers(tenantId);
    res.json({ success: true, customers: list });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. REGISTER LOYAL CUSTOMER WITH WHATSAPP ALERT
router.post('/customer/register', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { name, phone, email } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Harap lengkapi nama dan nomor handphone.' });
  }

  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const existing = await container.tenantRepository.getCustomerByPhone(tenantId, cleanPhone);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Nomor telepon ini sudah terdaftar sebagai loyalti.' });
    }

    const saved = await container.tenantRepository.saveCustomer(tenantId, {
      name,
      phone: cleanPhone,
      email: email || '',
      points: 0,
      totalSpent: 0
    });

    const tenant = await container.tenantRepository.getTenant(tenantId);
    // Dispatch instant welcome WhatsApp greeting
    await triggerWhatsAppNotification(
      cleanPhone, 
      `Selamat bergabung di ${(tenant as any)?.storeName || tenant?.name || 'LedgerLine'}! Nomor Anda telah terdaftar dalam sistem loyalti kami.`
    );

    res.status(201).json({ success: true, message: 'Registrasi Loyalti Sukses!', customer: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. RETRIEVE REPUTATION POINT BALANCES
router.get('/customer/:phone/points', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const cleanPhone = req.params.phone.replace(/\D/g, '');
  try {
    const customer = await container.tenantRepository.getCustomerByPhone(tenantId, cleanPhone);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Registrasi keanggotaan loyalti tidak ditemukan.' });
    }
    res.json({ success: true, customer });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. GET LOYALTY REWARDS CONFIGURATIONS
router.get('/customer/rewards', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  
  try {
    let list: any[] = [];
    
    const prisma: any = getPrismaClient();
            list = await prisma.loyaltyReward?.findMany({
              where: { tenantId }
            }) || [];
            
            if (list.length === 0) {
              const defaultRewards = [
                { id: `rew-1-${tenantId}`, tenantId, name: 'Espresso Cangkir Gratis Baru', pointsRequired: 15, discountPercent: 100, validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
                { id: `rew-2-${tenantId}`, tenantId, name: 'Diskon 50% All Desserts', pointsRequired: 25, discountPercent: 50, validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }
              ];
              await prisma.loyaltyReward.createMany({
                data: defaultRewards
              });
              list = await prisma.loyaltyReward.findMany({
                where: { tenantId }
              });
            }

    // Map database properties (handling either camelCase or snake_case database schema seamlessly!)
    const mapped = list.map((r: any) => ({
      id: r.id,
      tenantId: r.tenantId || r.tenant_id,
      title: r.name,
      pointsRequired: r.pointsRequired !== undefined ? r.pointsRequired : r.points_required,
      giftItem: r.name,
      activeStatus: true
    }));

    res.json({ success: true, rewards: mapped });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export const customerRouter = router;
export default customerRouter;
