import { pool, withRLS } from '../../db-pg.js';
import { logger } from '../../logger.js';

export class HppEngine {
  /**
   * Calculates the True HPP for a menu item at a specific outlet based on the recipe and current average costs.
   */
  static async calculateDirectHpp(
    tenantId: string,
    outletId: string,
    menuId: string
  ): Promise<number> {
    return await withRLS(tenantId, outletId, 'FINANCE', null, async (client) => {
      // Assuming a `recipes` table exists which links menu_id to ingredient_id and qty
      const recipeRes = await client.query(
        `SELECT ingredient_id, amount 
         FROM recipes 
         WHERE product_id = $1`, // Assuming product_id maps to menu_id
        [menuId]
      );

      let totalHpp = 0;

      for (const item of recipeRes.rows) {
        const ingredientId = item.ingredient_id;
        const qty = parseFloat(item.amount);

        // Get current average cost for this ingredient at this outlet
        const avgRes = await client.query(
          `SELECT current_average_cost
           FROM inventory_ledger
           WHERE ingredient_id = $1 AND outlet_id = $2
           ORDER BY created_at DESC LIMIT 1`,
          [ingredientId, outletId]
        );

        const avgCost = avgRes.rows.length > 0 ? parseFloat(avgRes.rows[0].current_average_cost) : 0;
        totalHpp += (qty * avgCost);
      }

      // Note: Packaging cost and OPEX allocation would be added here as per True HPP pipeline
      return totalHpp;
    });
  }

  /**
   * Locks the HPP for an order detail when it's sent to the kitchen (Open Bill temporal lock).
   */
  static async lockHppForOrderItem(
    tenantId: string,
    outletId: string,
    orderDetailId: string,
    menuId: string
  ) {
    const hpp = await this.calculateDirectHpp(tenantId, outletId, menuId);
    
    await withRLS(tenantId, outletId, 'CASHIER', null, async (client) => {
       await client.query(
         `UPDATE sales_order_details 
          SET cogs_snapshot_per_item = $1, processed_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND tenant_id = $3 AND outlet_id = $4`,
         [hpp, orderDetailId, tenantId, outletId]
       );
    });

    return hpp;
  }
}
