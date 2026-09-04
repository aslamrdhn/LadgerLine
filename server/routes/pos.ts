import { Router } from 'express';
import { checkout } from '../services/checkout.service.js';
import { reversal } from '../services/reversal.service.js';

export const posRouter = Router();

posRouter.post('/pos/checkout', async (req: any, res: any) => {
  try {
    const result = await checkout({
      tenantId: req.user.tenantId,
      ...req.body,
      cashierId: req.user.userId,
    });
    res.json({
      success: true,
      data: {
        id: result.id,
        invoiceNumber: result.invoiceNumber,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'SYS-001',
        message: err.message,
        category: err.category || 'SYSTEM',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

posRouter.post('/sales/reversal', async (req: any, res: any) => {
  try {
    const result = await reversal({
      tenantId: req.user.tenantId,
      cashierId: req.user.userId,
      salesId: req.body.salesId,
      reason: req.body.reason,
    });
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'SYS-001',
        message: err.message,
        category: err.category || 'SYSTEM',
      },
      timestamp: new Date().toISOString(),
    });
  }
});
