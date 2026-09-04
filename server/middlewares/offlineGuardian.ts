import { Request, Response, NextFunction } from 'express';
import { pool } from '../db-pg.js';
import { logger } from '../logger.js';

/**
 * Validates incoming offline sync payloads against the tenant's accounting_lock_date.
 */
export const offlineSyncGuardian = async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = (req as any).user?.tenantId || 'aslam-brew';
  const payload = req.body;

  // We expect payload to have an array of transactions or a single transaction with created_at
  const transactions = Array.isArray(payload) ? payload : [payload];
  
  if (transactions.length === 0 || !transactions[0].created_at) {
    return next(); // Not an offline sync payload or missing created_at, skip.
  }

  try {
    const client = await pool.connect();
    let lockDate: Date | null = null;
    try {
      const resLock = await client.query('SELECT accounting_lock_date FROM tenants WHERE id = $1', [tenantId]);
      if (resLock.rows.length > 0 && resLock.rows[0].accounting_lock_date) {
        lockDate = new Date(resLock.rows[0].accounting_lock_date);
      }
    } finally {
      client.release();
    }

    if (!lockDate) {
      return next(); // No lock date set, allow sync
    }

    const rejectedTransactions = [];
    const allowedTransactions = [];

    for (const tx of transactions) {
      const txDate = new Date(tx.created_at);
      if (txDate < lockDate) {
        rejectedTransactions.push(tx);
      } else {
        allowedTransactions.push(tx);
      }
    }

    if (rejectedTransactions.length > 0) {
      // Log rejected transactions to delayed_offline_sync_log
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const rTx of rejectedTransactions) {
          const outletId = rTx.outlet_id || 'outlet-1';
          await client.query(
            `INSERT INTO delayed_offline_sync_log 
             (tenant_id, outlet_id, payload, original_created_at, status, notes)
             VALUES ($1, $2, $3, $4, 'PENDING_REVIEW', 'Rejected by Offline Guardian: created_at < accounting_lock_date')`,
            [tenantId, outletId, JSON.stringify(rTx), new Date(rTx.created_at)]
          );
        }
        await client.query('COMMIT');
        logger.warn(`[OFFLINE_GUARDIAN] Rejected ${rejectedTransactions.length} transactions for tenant ${tenantId}`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      if (allowedTransactions.length === 0) {
        return res.status(409).json({ 
          success: false, 
          code: 'LL-FIN-4001', 
          message: 'Transaksi offline melewati Accounting Lock Date. Masuk antrean review Manager.' 
        });
      }
      
      // If mixed, override req.body with only allowed ones and continue
      req.body = Array.isArray(payload) ? allowedTransactions : allowedTransactions[0];
    }

    next();
  } catch (error: any) {
    logger.error(`[OFFLINE_GUARDIAN] Error validating lock date: ${error.message}`);
    res.status(500).json({ success: false, message: 'Internal validation error.' });
  }
};
