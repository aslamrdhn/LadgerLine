import { DatabaseModule } from '../../shared/database/database.module.ts';
import { PaginationParams, PaginatedResponse } from '../../shared/utils/apiResponse.ts';
import { logger } from '../../logger.js';

export interface ProductData {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  price: number;
  stock: number;
}

export class ProductRepository {
  async getProductsWithPagination(tenantId: string, params: PaginationParams): Promise<PaginatedResponse<ProductData>> {
    const prisma = DatabaseModule.getPrisma();
    const skip = (params.page - 1) * params.limit;

    const whereClause: any = { tenantId };
    if (params.search) {
      whereClause.name = { contains: params.search, mode: 'insensitive' };
    }

    const [data, totalItems] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        skip,
        take: params.limit,
        orderBy: { name: 'asc' },
      }) as any,
      prisma.product.count({ where: whereClause }),
    ]);

    return {
      data,
      meta: {
        totalItems,
        itemCount: data.length,
        itemsPerPage: params.limit,
        totalPages: Math.ceil(totalItems / params.limit),
        currentPage: params.page,
      },
    };
  }
}
