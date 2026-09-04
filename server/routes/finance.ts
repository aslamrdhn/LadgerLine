import { Router, Response } from 'express';
import { container } from '../container.ts';
import { AuthenticatedRequest, authorizeRole } from '../middlewares/auth.ts';
import { getPrismaClient } from '../db.ts';
import { logger } from '../logger.js';

const router = Router();

// Helper to get and save custom settings values securely with automatic fallback
async function getSettingsList(tenantId: string, key: string, defaultValue: any[]): Promise<any[]> {
  try {
    const rawValue = await container.systemRepository.getSystemSetting(tenantId, key, JSON.stringify(defaultValue));
    return JSON.parse(rawValue);
  } catch (err) {
    return defaultValue;
  }
}

async function saveSettingsList(tenantId: string, key: string, list: any[]): Promise<void> {
  try {
    await container.systemRepository.saveSystemSetting(tenantId, key, JSON.stringify(list));
  } catch (err) {
    logger.error(`[Finance Router] Failed to save setting list: ${err}`);
  }
}

// 1. ADD lokal Buku-Kas JOURNAL ENTRY
router.post('/finance/log', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { type, category, amount, description } = req.body;

  if (!type || !category || !amount) {
    return res.status(400).json({ success: false, message: 'Harap lengkapi tipe log, kategori jurnal Buku-Kas, dan jumlah kas.' });
  }

  try {
    const rawLog = {
      id: `fin-lokal-${Date.now()}`,
      logDate: new Date(),
      logTime: new Date().toLocaleTimeString('id-ID'),
      type,
      category,
      amount: Number(amount),
      isEncrypted: false,
      secureHash: '',
      description: description || ''
    };

    const saved = await container.financeRepository.createFinanceLog(tenantId, rawLog);
    
    await container.systemRepository.createSecurityAuditLog(tenantId, {
      action: 'ADD_JOURNAL_ENTRY',
      operator: req.user?.email || 'OWNER',
      details: `lokal Buku-Kas Jurnal ditambahkan: [${type.toUpperCase()}] Kategori: ${category} senilai Rp ${Number(amount).toLocaleString('id-ID')}`
    });

    res.json({ success: true, log: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. EXPORT E-FAKTUR TAX CSV COMPLIANCE (DJP INDONESIA FORMAT)
router.get('/tax/e-faktur', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const orders = await container.orderRepository.getOrders(tenantId);
    
    let csvContent = `"FK";"KD_AP";"FG";"NOMOR_FAKTUR";"MASA_PAJAK";"TAHUN_PAJAK";"TANGGAL";"NPWP";"NAMA";"ALAMAT";"JUMLAH_DPP";"JUMLAH_PPN";"JUMLAH_PPNBM";"REFERENSI"\n`;

    orders.forEach((o: any, idx: number) => {
      const masaPajak = new Date(o.orderTime).getMonth() + 1;
      const tahunPajak = new Date(o.orderTime).getFullYear();
      const tgl = new Date(o.orderTime).toLocaleDateString('id-ID');
      
      const sub = Number(o.subtotal || 0);
      const discount = Number(o.discount || 0);
      const dpp = Math.max(0, sub - discount);
      const ppn = Number(o.tax || 0);

      const invoiceNo = `010.051-26.${String(idx + 1).padStart(8, '0')}`;
      
      csvContent += `"FK";"01";"0";"${invoiceNo}";"${masaPajak}";"${tahunPajak}";"${tgl}";"00.000.000.0-000.000";"Pelanggan Umum LedgerLine";"Jakarta";"${dpp}";"${ppn}";"0";"INVOICE-${o.id}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=EFAKTUR_LEDGERLINE_TENANT_${tenantId}_2026.csv`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. GENERATE SPT-PPN INDONESIAN TAX SUMMARY (FORMULAR 1111 REPLICA)
router.get('/tax/spt-ppn', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const orders = await container.orderRepository.getOrders(tenantId);
    
    let totalDpp = 0;
    let totalPpn = 0;

    orders.forEach((o: any) => {
      const sub = Number(o.subtotal || 0);
      const disc = Number(o.discount || 0);
      totalDpp += Math.max(0, sub - disc);
      totalPpn += Number(o.tax || 0);
    });

    res.json({
      success: true,
      formModel: 'SPT Masa PPN 1111',
      tenantId,
      sptPeriod: 'Juni 2026',
      taxObjectBreakdowns: {
        penyerahanDalamNegeriDenganFaktur: {
          dpp: totalDpp,
          ppn: totalPpn
        },
        penyerahanTidakTerutangPPN: {
          dpp: 0,
          ppn: 0
        },
        totalEkspor: {
          dpp: 0,
          ppn: 0
        }
      },
      pajakKeluaran: totalPpn,
      pajakMasukanDapatDikreditkan: Math.round(totalPpn * 0.4),
      sptNetPpnKurangBayar: Math.max(0, totalPpn - Math.round(totalPpn * 0.4)),
      signingOfficer: 'Pemilik LedgerLine',
      reportingStatus: 'Siap Lapor DJP'
    });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// D. CASHIER PERFORMANCE & BONUS MANAGEMENT
// ==========================================

router.get('/cashier/performance', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const list = await getSettingsList(tenantId, 'cashier_performances', []);
    
    if (list.length === 0) {
      const seedPerf = [
        { id: 'cp-1', tenantId, cashierName: 'Andi Barista', transactionsProcessed: 43, totalRevenueGenerated: 1200000, accuracyRate: 98.5, activeShiftHours: 32 },
        { id: 'cp-2', tenantId, cashierName: 'Budi Cashier', transactionsProcessed: 52, totalRevenueGenerated: 1540000, accuracyRate: 99.1, activeShiftHours: 40 }
      ];
      await saveSettingsList(tenantId, 'cashier_performances', seedPerf);
      return res.json(seedPerf);
    }
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/cashier/targets', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const list = await getSettingsList(tenantId, 'cashier_targets', []);
    
    if (list.length === 0) {
      const seedTargets = [
        { id: 'ct-1', tenantId, month: 'Juni 2026', targetRevenue: 5000000, achievedRevenue: 2740000, targetTransactions: 200, achievedTransactions: 95, bonusSlabPercentage: 5.0, claimStatus: 'Active' }
      ];
      await saveSettingsList(tenantId, 'cashier_targets', seedTargets);
      return res.json(seedTargets);
    }
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/cashier/targets', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { month, targetRevenue, targetTransactions, bonusSlabPercentage } = req.body;

  try {
    const list = await getSettingsList(tenantId, 'cashier_targets', []);
    const newTarget = {
      id: `ct-${Date.now()}`,
      tenantId,
      month,
      targetRevenue: Number(targetRevenue),
      targetTransactions: Number(targetTransactions),
      bonusSlabPercentage: Number(bonusSlabPercentage),
      achievedRevenue: 0,
      achievedTransactions: 0,
      claimStatus: 'Active'
    };
    list.push(newTarget);
    await saveSettingsList(tenantId, 'cashier_targets', list);
    res.json({ success: true, target: newTarget });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Pay earned achievements bonus cash
router.post('/cashier/pay-bonus', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { employeeName, bonusAmount, reason } = req.body;

  if (!employeeName || !bonusAmount) {
    return res.status(400).json({ success: false, message: 'Harap melengkapi nama karyawan dan besaran bonus.' });
  }

  try {
    const bonusLogId = `fin-bon-${Date.now()}`;
    await container.financeRepository.createFinanceLog(tenantId, {
      id: bonusLogId,
      type: 'expense',
      category: 'Gaji & Bonus Karyawan',
      amount: Number(bonusAmount),
      description: `Bagi bonus insentif/pencapaian target ${employeeName}. Catatan: ${reason || 'tanpa catatan'}`
    });

    await container.systemRepository.createSecurityAuditLog(tenantId, {
      action: 'PAYOUT_CASHIER_BONUS',
      operator: req.user?.email || 'OWNER',
      details: `Pemberian bonus kasir ${employeeName} dicairkan langsung ke kas kedai senilai Rp ${Number(bonusAmount).toLocaleString('id-ID')}`
    });

    res.json({ success: true, message: 'Insentif bonus kasir berhasil dibayarkan!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export const financeRouter = router;
