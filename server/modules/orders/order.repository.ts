import { DatabaseModule } from '../../shared/database/database.module.ts';
import { logger } from '../../logger.js';

export interface OrderData {
  tenantId: string;
  tableNumber: string;
  paymentMethod: string;
  subtotal: number;
  tax: number;
  discount: number;
  totalPrice: number;
  paymentStatus: string;
  items: Array<{
    productId: string;
    quantity: number;
    priceAtSale: number;
    costAtSale: number;
    subtotal?: number;
  }>;
}

export class OrderRepository {
  /**
   * Save an order. Uses Postgres via Prisma.
   */
  async createOrder(data: OrderData): Promise<string> {
    const prisma = DatabaseModule.getPrisma();
    // Gunakan transaksi untuk menjamin integritas data (Order + Items)
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          id: `ord-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          tenantId: data.tenantId,
          tableNumber: data.tableNumber,
          paymentMethod: data.paymentMethod,
          subtotal: data.subtotal,
          tax: data.tax,
          discount: data.discount,
          totalPrice: data.totalPrice,
          paymentStatus: data.paymentStatus,
          orderItems: {
            create: data.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              priceAtSale: item.priceAtSale,
              costAtSale: item.costAtSale
            }))
          }
        }
      });
      return order.id;
    });

    logger.info(`[PRISMA] Order created: ${result}`);
    return result;
  }
}
