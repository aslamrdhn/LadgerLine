import { pool, withRLS } from '../../db-pg.js';
import { logger } from '../../logger.js';
import { AverageCostEngine } from './average.engine.js';

export class OpnameService {
  /**
   * Submits a stock opname. Requires estimated_unit_cost if there is a surplus.
   */
  static async submitStockOpname(
    tenantId: string,
    outletId: string,
    ingredientId: string,
    systemQty: number,
    physicalQty: number,
    estimatedUnitCost?: number
  ) {
    return await withRLS(tenantId, outletId, 'WAREHOUSE', null, async (client) => {
      const variance = physicalQty - systemQty;
      let varianceType = 'MATCH';
      if (variance > 0) varianceType = 'SURPLUS';
      if (variance < 0) varianceType = 'DEFICIT';

      if (varianceType === 'SURPLUS' && (estimatedUnitCost === undefined || estimatedUnitCost <= 0)) {
        throw new Error('LL-INV-3001: Surplus stock opname requires a valid estimated_unit_cost for valuation.');
      }

      // Get last known average cost
      const avgRes = await client.query(
        `SELECT current_average_cost
         FROM inventory_ledger
         WHERE ingredient_id = $1 AND outlet_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [ingredientId, outletId]
      );
      
      const lastKnownAvg = avgRes.rows.length > 0 ? parseFloat(avgRes.rows[0].current_average_cost) : 0;

      const res = await client.query(
        `INSERT INTO stock_opnames 
         (tenant_id, outlet_id, ingredient_id, system_qty, physical_qty, variance_qty, variance_type, estimated_unit_cost, last_known_avg_cost, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'APPROVED') RETURNING id`,
        [tenantId, outletId, ingredientId, systemQty, physicalQty, variance, varianceType, estimatedUnitCost, lastKnownAvg]
      );
      
      const opnameId = res.rows[0].id;

      if (varianceType === 'SURPLUS' && estimatedUnitCost) {
          // Valuation changes average cost
          await AverageCostEngine.updateAverageCost(
              tenantId,
              outletId,
              ingredientId,
              variance,
              estimatedUnitCost,
              opnameId
          );
      } else if (varianceType === 'DEFICIT') {
          // Deficit just reduces stock at current average cost (doesn't change average)
          await client.query(
            `INSERT INTO inventory_ledger 
             (tenant_id, outlet_id, ingredient_id, qty_change, current_average_cost, mutation_type, reference_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [tenantId, outletId, ingredientId, variance, lastKnownAvg, 'OPNAME_DEFICIT', opnameId]
          );
      }

      logger.info(`[STOCK_OPNAME] Processed opname for ${ingredientId}. Variance: ${varianceType} (${variance})`);
      return opnameId;
    });
  }
}
