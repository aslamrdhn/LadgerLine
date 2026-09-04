import { Router } from 'express';
import { AverageCostEngine } from '../modules/business/average.engine.js';
import { HppEngine } from '../modules/business/hpp.engine.js';
import { OpnameService } from '../modules/business/opname.service.js';
import { TransferService } from '../modules/business/transfer.service.js';

export const businessRouter = Router();

businessRouter.post('/transfer', async (req, res) => {
  try {
    // Assuming standard auth middleware sets tenantId and outletId
    const tenantId = (req as any).user?.tenantId || 'aslam-brew';
    const fromOutletId = req.body.fromOutletId || 'outlet-1';
    
    const { toOutletId, ingredientId, qty, landedCost } = req.body;

    const transferId = await TransferService.processTransfer(
      tenantId,
      fromOutletId,
      toOutletId,
      ingredientId,
      Number(qty),
      Number(landedCost || 0)
    );

    res.json({ success: true, data: { transferId } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

businessRouter.post('/opname', async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId || 'aslam-brew';
    const outletId = req.body.outletId || 'outlet-1';
    
    const { ingredientId, systemQty, physicalQty, estimatedUnitCost } = req.body;

    const opnameId = await OpnameService.submitStockOpname(
      tenantId,
      outletId,
      ingredientId,
      Number(systemQty),
      Number(physicalQty),
      estimatedUnitCost ? Number(estimatedUnitCost) : undefined
    );

    res.json({ success: true, data: { opnameId } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

businessRouter.post('/hpp/lock', async (req, res) => {
  try {
    const tenantId = (req as any).user?.tenantId || 'aslam-brew';
    const outletId = req.body.outletId || 'outlet-1';
    
    const { orderDetailId, menuId } = req.body;

    const lockedHpp = await HppEngine.lockHppForOrderItem(
      tenantId,
      outletId,
      orderDetailId,
      menuId
    );

    res.json({ success: true, data: { lockedHpp } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default businessRouter;

import { offlineSyncGuardian } from '../middlewares/offlineGuardian.js';

businessRouter.post('/offline/sync', offlineSyncGuardian, async (req, res) => {
  try {
    const transactions = Array.isArray(req.body) ? req.body : [req.body];
    // In a real scenario, this would persist the offline transactions to the DB.
    // Since we're demonstrating the Offline Guardian, we just acknowledge the allowed ones.
    res.json({ 
      success: true, 
      message: `Successfully synchronized ${transactions.length} allowed transactions.`,
      syncedCount: transactions.length 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
