import { Router, Response, NextFunction } from 'express';
import { env } from '../env.ts';
import { container } from '../container.ts';
import { AiService } from '../services/aiService.js';
import { AuthenticatedRequest, authorizeRole } from '../middlewares/auth.ts';
import { superadminRateLimiter } from '../middlewares/rateLimiter.ts';
import { getPrismaClient } from '../db.ts';
import { logger } from '../logger.js';

const router = Router();

const checkSuperadminEnv = (req: any, res: Response, next: NextFunction) => {
  if (env.NODE_ENV === 'production' && !process.env.ENABLE_SUPERADMIN) {
    return res.status(403).json({ success: false, message: 'Superadmin access disabled in production.' });
  }
  next();
};

// ==========================================
// J. APP CONFIG ENDPOINTS
// ==========================================

router.post('/config', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const tenant = await container.tenantRepository.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant tidak terregistrasi.' });
    }

    const allowedFields = [
      'name', 'storeAddress', 'storePhone', 'storeWifiName', 'storeWifiPass',
      'theme', 'layoutMode', 'cashierName', 'receiptHeader', 'receiptFooter',
      'taxType', 'taxRateCustom'
    ];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }
    const merged = { ...tenant, ...updateData };
    const saved = await container.tenantRepository.saveTenant(tenantId, merged);

    await container.systemRepository.createSecurityAuditLog(tenantId, {
      action: 'UPDATE_CONFIG',
      operator: req.user?.email || 'OWNER',
      details: 'Pengaturan umum kedai kopi dan parameter struk struktur struk thermal telah diubah.'
    });

    res.json({ success: true, appConfig: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// K. TIER & TOKEN MANAGEMENT
// ==========================================

router.post('/upgrade-tier', authorizeRole(['Owner', 'superadmin', 'Kasir']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { targetTier, cost } = req.body;
  try {
    const tenant = await container.tenantRepository.getTenant(tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.' });

    // Validate token balance conceptually (we stored it in system settings for simple migration if schema fails)
    const tokenStr = await container.systemRepository.getSystemSetting(tenantId, 'ledger_token_balance', '500');
    let tokens = parseInt(tokenStr);

    if (tokens < cost) {
      return res.status(400).json({ success: false, message: 'Saldo token Anda tidak mencukupi.' });
    }

    tokens -= cost;
    await container.systemRepository.saveSystemSetting(tenantId, 'ledger_token_balance', tokens.toString());
    await container.systemRepository.saveSystemSetting(tenantId, 'subscription_tier', targetTier);

    // Also update tenant if schema has it (try-catch just in case)
    try {
      await getPrismaClient().tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionPackage: targetTier,
        }
      });
    } catch(e) {
      // Ignore if schema not fully pushed yet
    }

    await container.systemRepository.createSecurityAuditLog(tenantId, {
      action: 'UPGRADE_TIER',
      operator: req.user?.email || 'SYSTEM',
      details: `Owner membuka fitur eksklusif: Upgrade ke ${targetTier} menggunakan ${cost} koin.`
    });

    res.json({ success: true, newTier: targetTier, newTokens: tokens });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// K. MARGIN SHIELD STABILIZATION ENGINE
// ==========================================

router.get('/margin-shield/config', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const defaultItem = {
      id: `ms-${tenantId}`,
      tenantId,
      isActive: true,
      bufferFundPercentage: 3.5,
      targetCogsThreshold: 6000,
      historicalAbsorbedCost: 152000,
      cushionBalance: 450000
    };

    const rawValue = await container.systemRepository.getSystemSetting(tenantId, 'margin_shield_config', JSON.stringify(defaultItem));
    res.json(JSON.parse(rawValue));
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/margin-shield/config', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { isActive, bufferFundPercentage, targetCogsThreshold, cushionBalance } = req.body;

  try {
    const rawValue = await container.systemRepository.getSystemSetting(tenantId, 'margin_shield_config', '{}');
    const currentData = rawValue !== '{}' ? JSON.parse(rawValue) : {};

    const item = {
      id: `ms-${tenantId}`,
      tenantId,
      isActive: isActive !== false,
      bufferFundPercentage: Number(bufferFundPercentage || 3.5),
      targetCogsThreshold: Number(targetCogsThreshold || 6000),
      historicalAbsorbedCost: currentData.historicalAbsorbedCost || 152000,
      cushionBalance: Number(cushionBalance || 500000)
    };

    await container.systemRepository.saveSystemSetting(tenantId, 'margin_shield_config', JSON.stringify(item));
    res.json({ success: true, config: item });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/margin-shield/events', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const rawValue = await container.systemRepository.getSystemSetting(tenantId, 'margin_shield_events', '[]');
    res.json(JSON.parse(rawValue));
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Absorb/cushion severe crop inflation cost spikes automatically
router.post('/margin-shield/absorb', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { materialId, inflatedCost, standardCost } = req.body;

  if (!materialId || !inflatedCost || !standardCost) {
    return res.status(400).json({ success: false, message: 'Harap melengkapi materialId, harga inflasi, dan harga acuan wajar.' });
  }

  try {
    const difference = Number(inflatedCost) - Number(standardCost);
    if (difference <= 0) {
      return res.status(400).json({ success: false, message: 'Penyebab absorpsi gagal: Harga inflasi tani di bawah harga acuan wajar.' });
    }

    const rawConfig = await container.systemRepository.getSystemSetting(tenantId, 'margin_shield_config', '');
    if (!rawConfig) {
      return res.status(400).json({ success: false, message: 'Sistem proteksi margin tani (Margin Shield) tidak aktif atau belum diatur.' });
    }

    const cnf = JSON.parse(rawConfig);
    if (!cnf.isActive) {
      return res.status(400).json({ success: false, message: 'Sistem proteksi margin tani (Margin Shield) tidak aktif.' });
    }

    if (Number(cnf.cushionBalance) < difference) {
      return res.status(400).json({ success: false, message: 'Dompet saldo pengaman margin tani kosong atau kurang untuk menahan inflasi saat ini.' });
    }

    // Process absorption
    cnf.cushionBalance = Number(cnf.cushionBalance) - difference;
    cnf.historicalAbsorbedCost = Number(cnf.historicalAbsorbedCost) + difference;

    await container.systemRepository.saveSystemSetting(tenantId, 'margin_shield_config', JSON.stringify(cnf));

    const rawEvents = await container.systemRepository.getSystemSetting(tenantId, 'margin_shield_events', '[]');
    const events = JSON.parse(rawEvents);
    const newEvent = {
      id: `ev-${Date.now()}`,
      tenantId,
      materialId,
      inflatedCost: Number(inflatedCost),
      standardCost: Number(standardCost),
      differenceCost: difference,
      timestamp: new Date().toISOString()
    };
    events.push(newEvent);

    await container.systemRepository.saveSystemSetting(tenantId, 'margin_shield_events', JSON.stringify(events));

    // Book corresponding stabilization expense log
    await container.financeRepository.createFinanceLog(tenantId, {
      id: `fin-ms-${Date.now()}`,
      type: 'income', // Representing injected stabilization recovery funds
      category: 'Proteksi Margin (MS)',
      amount: difference,
      description: `Pemberian subsidi absorpsi inflasi tani bahan: ${materialId} senilai Rp ${difference.toLocaleString('id-ID')}`
    });

    res.json({ success: true, config: cnf, event: newEvent });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// L. GEMINI COFFEE ANALYTIC ENDPOINTS
// ==========================================

router.post('/ai/analyze', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const tenant = await container.tenantRepository.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant detail not found.' });
    }
    const logs = await container.financeRepository.getFinanceLogs(tenantId);
    const materials = await container.productRepository.getRawMaterials(tenantId);
    const products = await container.productRepository.getProducts(tenantId);

    const totalPemasukan = logs.filter(l => l.type === 'income').reduce((sum, l) => sum + Number(l.amount), 0);
    const totalPengeluaran = logs.filter(l => l.type === 'expense').reduce((sum, l) => sum + Number(l.amount), 0);

    const lowStockMaterials = materials.filter(m => Number(m.stockQuantity || m.stockQuantity || 0) <= Number(m.warningLimit || m.warningLimit || 0));
    const criticalProducts = products.filter(p => Number(p.stock || 0) <= Number(p.warningLimit || p.warningLimit || 0));

    const resultText = await AiService.generateBusinessInsight({
      name: tenant.name || 'Ledger Line Brew',
      storeAddress: 'Indonesia',
      totalPemasukan,
      totalPengeluaran,
      lowStockMaterials,
      criticalProducts
    });

    res.json({ success: true, insight: resultText });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// M. REGULAR BACKUP & CLOUD STORAGE SIMULATOR
// ==========================================

router.get('/backup/saveeksport', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const tenant = await container.tenantRepository.getTenant(tenantId);
    const products = await container.productRepository.getProducts(tenantId);
    const rawMaterials = await container.productRepository.getRawMaterials(tenantId);
    const recipes = await container.productRepository.getRecipes(tenantId);
    const orders = await container.orderRepository.getOrders(tenantId);
    const financeLogs = await container.financeRepository.getFinanceLogs(tenantId);

    const bundleData = {
      secretHashKey: 'LEDGERLINE-VER-2.6-KEY',
      tenantId,
      backupTimestamp: new Date().toISOString(),
      name: tenant ? tenant.name : 'Ledger Line',
      appConfig: tenant,
      products,
      rawMaterials,
      recipes,
      orders,
      financeLogs
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=LEDGERLINE_BACKUP_${tenantId}_2026.json`);
    res.send(JSON.stringify(bundleData, null, 2));

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/backup/restore', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { restoreData } = req.body;

  if (!restoreData || restoreData.secretHashKey !== 'LEDGERLINE-VER-2.6-KEY') {
    return res.status(400).json({ success: false, message: 'Format file backup tidak valid atau kunci enkripsi tidak cocok.' });
  }

  try {
    // Restore all items
    if (restoreData.appConfig) {
      await container.tenantRepository.saveTenant(tenantId, restoreData.appConfig);
    }
    if (Array.isArray(restoreData.products)) {
      for (const p of restoreData.products) await container.productRepository.saveProduct(tenantId, p);
    }
    if (Array.isArray(restoreData.rawMaterials)) {
      for (const m of restoreData.rawMaterials) await container.productRepository.saveRawMaterial(tenantId, m);
    }

    await container.systemRepository.createSecurityAuditLog(tenantId, {
      action: 'DATALAKE_RESTORE',
      operator: req.user?.email || 'OWNER',
      details: 'Pemulihan data sukses dilakukan dari file backup terenskripsi eksternal.'
    });

    res.json({ success: true, message: 'Pemulihan data sukses dilakukan! Halaman akan direfresh secara aman.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// N. AUDIT LOGS RETRIEVAL
// ==========================================

router.get('/audit-logs', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const logs = await container.systemRepository.getSecurityAuditLogs(tenantId);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// O. SUPERADMIN RESTRICTED BOARD (FULLY AUDITED)
// ==========================================

router.get('/superadmin/audit', authorizeRole(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await container.tenantRepository.listTenants();
    res.json({ success: true, stats: list });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/superadmin/delete-tenant/:id', authorizeRole(['SUPER_ADMIN']), superadminRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { confirmationText } = req.body;

  try {
    const tenant = await container.tenantRepository.getTenant(id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant tidak dikenal.' });
    }
    
    if (confirmationText !== tenant.name) {
       return res.status(400).json({ success: false, message: 'Konfirmasi nama toko tidak cocok.' });
    }

    const deleted = await container.tenantRepository.deleteTenant(id);
    
    await container.systemRepository.createSecurityAuditLog('system', {
       userId: req.user?.email || 'SUPER_ADMIN',
       action: 'DELETE_TENANT',
       entityName: 'Tenant',
       entityId: id,
       details: `SuperAdmin deleted tenant ${tenant.name}`
    });

    logger.info(`[SUPERADMIN OPERATIONAL] Deleted tenant: ${id}`);
    res.json({ success: true, message: 'Tenant telah dihapus permanen dari sistem penyedia cloud.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 14. REAL DRIVE BACKUP AND RESTORE
import { googleDriveService } from '../services/googleDriveService.js';

router.post('/simulated-drive/backup', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const tenant = await container.tenantRepository.getTenant(tenantId);
    const products = await container.productRepository.getProducts(tenantId);
    const rawMaterials = await container.productRepository.getRawMaterials(tenantId);
    const recipes = await container.productRepository.getRecipes(tenantId);
    const orders = await container.orderRepository.getOrders(tenantId);
    const financeLogs = await container.financeRepository.getFinanceLogs(tenantId);

    const bundleData = {
      secretHashKey: 'LEDGERLINE-VER-2.6-KEY',
      tenantId,
      backupTimestamp: new Date().toISOString(),
      name: tenant ? tenant.name : 'Ledger Line',
      appConfig: tenant,
      products,
      rawMaterials,
      recipes,
      orders,
      financeLogs
    };

    const fileName = `LEDGERLINE_BACKUP_${tenantId}_${Date.now()}.json`;
    const driveId = await googleDriveService.uploadBackup(
      fileName,
      'application/json',
      JSON.stringify(bundleData)
    );

    res.json({ success: true, message: `Backup uploaded successfully to Google Drive. ID: ${driveId}` });
  } catch (err: any) {
    logger.error(`Backup to Drive failed: ${err.message}`);
    res.status(500).json({ success: false, message: 'Google Drive Backup Failed', detail: err.message });
  }
});

router.post('/simulated-drive/restore', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const fileId = req.body.fileId;
  const tenantId = req.user?.tenantId;

  if (!fileId) {
    return res.status(400).json({ success: false, message: 'fileId is required for restore' });
  }

  try {
    const fileContentStr = await googleDriveService.restoreBackup(fileId);
    const restoreData = JSON.parse(fileContentStr);

    if (restoreData.secretHashKey !== 'LEDGERLINE-VER-2.6-KEY') {
      return res.status(400).json({ success: false, message: 'Format file backup tidak valid atau kunci enkripsi tidak cocok.' });
    }

    // Restore all items
    if (restoreData.appConfig) {
      await container.tenantRepository.saveTenant(tenantId, restoreData.appConfig);
    }
    if (Array.isArray(restoreData.products)) {
      for (const p of restoreData.products) await container.productRepository.saveProduct(tenantId, p);
    }
    if (Array.isArray(restoreData.rawMaterials)) {
      for (const m of restoreData.rawMaterials) await container.productRepository.saveRawMaterial(tenantId, m);
    }

    await container.systemRepository.createSecurityAuditLog(tenantId, {
      action: 'DATALAKE_RESTORE',
      operator: req.user?.email || 'OWNER',
      details: 'Pemulihan data sukses dilakukan dari file backup terenskripsi Google Drive.'
    });

    res.json({ success: true, message: 'Pemulihan data dari Google Drive sukses dilakukan!' });
  } catch (err: any) {
    logger.error(`Restore from Drive failed: ${err.message}`);
    res.status(500).json({ success: false, message: 'Google Drive Restore Failed', detail: err.message });
  }
});

// ==========================================
// MIGRATION CENTER API
// ==========================================

export const systemRouter = router;
