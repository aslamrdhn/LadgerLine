import { pool, withRLS } from '../../db-pg.js';
import { logger } from '../../logger.js';

export class AverageCostEngine {
  /**
   * Recalculates and updates the average cost of an ingredient for a specific outlet.
   * Formula: ((Qty Lama × Average Lama) + (Qty Baru × Harga Baru)) / (Qty Lama + Qty Baru)
   */
  static async updateAverageCost(
    tenantId: string,
    outletId: string,
    ingredientId: string,
    newQty: number,
    newPrice: number,
    referenceId: string
  ) {
    return await withRLS(tenantId, outletId, 'FINANCE', null, async (client) => {
      // 1. Get current average and qty
      const res = await client.query(
        `SELECT SUM(qty_change) as total_qty, current_average_cost
         FROM inventory_ledger
         WHERE ingredient_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [ingredientId]
      );

      let oldAvg = 0;
      let oldQty = 0;

      if (res.rows.length > 0 && res.rows[0].total_qty) {
        oldQty = parseFloat(res.rows[0].total_qty);
        oldAvg = parseFloat(res.rows[0].current_average_cost);
      }

      // 2. Calculate new average
      const totalOldValue = oldQty * oldAvg;
      const totalNewValue = newQty * newPrice;
      const newTotalQty = oldQty + newQty;

      let newAvg = 0;
      if (newTotalQty > 0) {
        newAvg = (totalOldValue + totalNewValue) / newTotalQty;
      }

      // 3. Insert into inventory_ledger
      await client.query(
        `INSERT INTO inventory_ledger 
         (tenant_id, outlet_id, ingredient_id, qty_change, current_average_cost, mutation_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, outletId, ingredientId, newQty, newAvg, 'PURCHASE_RECEIPT', referenceId]
      );

      logger.info(`[AVERAGE_COST] Updated for ${ingredientId} at outlet ${outletId}. Old: ${oldAvg}, New: ${newAvg}`);
      return newAvg;
    });
  }
}
