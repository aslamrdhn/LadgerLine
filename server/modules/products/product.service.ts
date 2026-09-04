import { ProductRepository, ProductData } from './product.repository.ts';
import { PaginationParams, PaginatedResponse } from '../../shared/utils/apiResponse.ts';
import { AppError } from '../../shared/middleware/error.middleware.ts';

export class ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  async fetchProducts(tenantId: string, rawPage: number = 1, rawLimit: number = 10, search?: string): Promise<PaginatedResponse<ProductData>> {
    // Validasi & Sanitasi Parameter Pagination
    const page = Math.max(1, Math.floor(rawPage));
    const limit = Math.min(100, Math.max(1, Math.floor(rawLimit))); // Caps max 100 baris per query

    if (!tenantId) {
      throw new AppError('Tenant ID is required', 400);
    }

    const params: PaginationParams = { page, limit, search };

    const result = await this.productRepository.getProductsWithPagination(tenantId, params);
    
    return result;
  }
}
