import { OrderService } from './order.service.ts';
import { OrderRepository, OrderData } from './order.repository.ts';

// Mock repository
class MockOrderRepository extends OrderRepository {
  async createOrder(data: OrderData): Promise<string> {
    return 'mock-order-123';
  }
}

describe('OrderService', () => {
  let orderService: OrderService;
  let mockRepository: MockOrderRepository;

  beforeEach(() => {
    mockRepository = new MockOrderRepository();
    orderService = new OrderService(mockRepository);
  });

  it('should successfully place a valid order', async () => {
    const validPayload: OrderData = {
      tenantId: 'tenant-demo',
      tableNumber: '1',
      paymentMethod: 'Cash',
      subtotal: 50000,
      tax: 5000,
      discount: 0,
      totalPrice: 55000,
      paymentStatus: 'completed',
      items: [
        { productId: 'p1', quantity: 2, priceAtSale: 25000, costAtSale: 10000, subtotal: 50000 }
      ]
    };

    const result = await orderService.placeOrder(validPayload);
    expect(result.success).toBe(true);
    expect(result.orderId).toBe('mock-order-123');
  });

  it('should fail if no items are provided', async () => {
    const invalidPayload: OrderData = {
      tenantId: 'tenant-demo',
      tableNumber: '1',
      paymentMethod: 'Qris',
      subtotal: 0,
      tax: 0,
      discount: 0,
      totalPrice: 0,
      paymentStatus: 'pending',
      items: []
    };

    const result = await orderService.placeOrder(invalidPayload);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Order must contain at least one item.');
  });

  it('should prevent order with tampered subtotal', async () => {
    const temperedPayload: OrderData = {
      tenantId: 'tenant-demo',
      tableNumber: '1',
      paymentMethod: 'Cash',
      subtotal: 10000, // Dimanipulasi menjadi murah
      tax: 1000,
      discount: 0,
      totalPrice: 11000,
      paymentStatus: 'pending',
      items: [
        { productId: 'p1', quantity: 1, priceAtSale: 50000, costAtSale: 10000, subtotal: 50000 }
      ]
    };

    const result = await orderService.placeOrder(temperedPayload);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/mismatch/i);
  });
});
