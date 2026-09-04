import { ProductService } from './product.service.ts';
import { ProductRepository, ProductData } from './product.repository.ts';
import { AppError } from '../../shared/middleware/error.middleware.ts';

// Mock repository
class MockProductRepository extends ProductRepository {
  async getProductsWithPagination(tenantId: string, params: any) {
    if (tenantId === 'empty-tenant') {
      return {
        data: [],
        meta: { totalItems: 0, itemCount: 0, itemsPerPage: params.limit, totalPages: 0, currentPage: params.page }
      };
    }
    
    const mockProducts: ProductData[] = [
      { id: '1', tenantId, name: 'Espresso', category: 'Coffee', price: 15000, stock: 100 },
      { id: '2', tenantId, name: 'Latte', category: 'Coffee', price: 20000, stock: 50 },
    ];

    return {
      data: mockProducts,
      meta: { totalItems: 2, itemCount: 2, itemsPerPage: params.limit, totalPages: 1, currentPage: params.page }
    };
  }
}

describe('ProductService', () => {
  let productService: ProductService;
  let mockRepo: MockProductRepository;

  beforeEach(() => {
    mockRepo = new MockProductRepository();
    productService = new ProductService(mockRepo);
  });

  it('should successfully fetch paginated products', async () => {
    const result = await productService.fetchProducts('tenant-1', 1, 10, '');
    
    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe('Espresso');
    expect(result.meta.totalItems).toBe(2);
    expect(result.meta.currentPage).toBe(1);
    expect(result.meta.itemsPerPage).toBe(10);
  });

  it('should return empty data if tenant has no products', async () => {
    const result = await productService.fetchProducts('empty-tenant', 1, 10);
    
    expect(result.data).toHaveLength(0);
    expect(result.meta.totalItems).toBe(0);
  });

  it('should throw an error if no tenantId is provided', async () => {
    await expect(productService.fetchProducts('', 1, 10)).rejects.toThrow(AppError);
    await expect(productService.fetchProducts('', 1, 10)).rejects.toThrow('Tenant ID is required');
  });

  it('should sanitize pagination parameters', async () => {
    // limit 999 should be capped to 100, page -5 should be floored to 1
    const spy = jest.spyOn(mockRepo, 'getProductsWithPagination');
    await productService.fetchProducts('tenant-1', -5, 999);
    
    expect(spy).toHaveBeenCalledWith('tenant-1', { page: 1, limit: 100, search: undefined });
  });
});
