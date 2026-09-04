import { OrderRepository, OrderData } from './order.repository.ts';

export class OrderService {
  constructor(private readonly orderRepository: OrderRepository) {}

  /**
   * Validate parameters and create a new order
   */
  async placeOrder(payload: OrderData): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      // 1. Business Logic Validation
      if (!payload.tenantId) {
        throw new Error('Tenant ID is required.');
      }
      if (!payload.items || payload.items.length === 0) {
        throw new Error('Order must contain at least one item.');
      }
      if (payload.totalPrice <= 0) {
        throw new Error('Order total must be greater than zero.');
      }

      // 2. Kalkulasi ulang total (Security Check)
      const calculatedSubtotal = payload.items.reduce((acc, item) => acc + ((item.priceAtSale || 0) * item.quantity), 0);
      if (Math.abs(calculatedSubtotal - payload.subtotal) > 1.0) { // Toleransi presisi float
        throw new Error('Subtotal calculation mismatch. Data tempered.');
      }

      // 3. Persistensi Data
      const orderId = await this.orderRepository.createOrder(payload);

      // (Akan ditambahkan di iterasi selanjutnya: pengurangan stok via ProductService, event message queue, dll.)

      return {
        success: true,
        orderId
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'An error occurred while placing the order.'
      };
    }
  }
}
