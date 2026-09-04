import { pool, withRLS } from '../../db-pg.js';
import { logger } from '../../logger.js';
import { AverageCostEngine } from './average.engine.js';

export class TransferService {
  /**
   * Process a transfer between outlets including landed cost.
   * Landed Cost is absorbed into the receiving outlet's average cost.
   */
  static async processTransfer(
    tenantId: string,
    fromOutletId: string,
    toOutletId: string,
    ingredientId: string,
    qty: number,
    landedCost: number
  ) {
    return await withRLS(tenantId, fromOutletId, 'WAREHOUSE', null, async (client) => {
      // 1. Get sender's current average cost
      const res = await client.query(
        `SELECT current_average_cost
         FROM inventory_ledger
         WHERE ingredient_id = $1 AND outlet_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [ingredientId, fromOutletId]
      );

      if (res.rows.length === 0) {
        throw new Error('Ingredient not found in sender outlet.');
      }

      const avgCostSender = parseFloat(res.rows[0].current_average_cost);

      // 2. Deduct from sender (qty_change is negative)
      await client.query(
        `INSERT INTO inventory_ledger 
         (tenant_id, outlet_id, ingredient_id, qty_change, current_average_cost, mutation_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, fromOutletId, ingredientId, -qty, avgCostSender, 'TRANSFER_OUT']
      );

      // 3. Record the transfer
      const transferRes = await client.query(
        `INSERT INTO inventory_transfers 
         (tenant_id, from_outlet_id, to_outlet_id, ingredient_id, qty, avg_cost_sender, landed_cost, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [tenantId, fromOutletId, toOutletId, ingredientId, qty, avgCostSender, landedCost, 'COMPLETED']
      );

      const transferId = transferRes.rows[0].id;

      // 4. Calculate new average for receiver
      // We do this by treating the incoming transfer as a "purchase" with a unit price that includes landed cost
      const totalTransferValue = (qty * avgCostSender) + landedCost;
      const unitPriceForReceiver = totalTransferValue / qty;

      await AverageCostEngine.updateAverageCost(
        tenantId,
        toOutletId,
        ingredientId,
        qty,
        unitPriceForReceiver,
        transferId
      );

      logger.info(`[TRANSFER] Completed transfer of ${qty} for ${ingredientId} from ${fromOutletId} to ${toOutletId} with Landed Cost: ${landedCost}`);
      return transferId;
    });
  }
}
