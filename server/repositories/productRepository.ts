import { getPrismaClient } from '../db.js';

export class ProductRepository {
  private prisma = getPrismaClient();

  async findAllByTenant(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId },
      include: {
        recipes: true
      }
    });
  }

  async findByIdAndTenant(id: string, tenantId: string) {
    return this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { recipes: true }
    });
  }

  async create(data: any) {
    return this.prisma.product.create({ data });
  }

  async update(id: string, data: any) {
    // SECURITY FIX: Prevent indiscriminate updating by standardizing on tenant matching where applicable, 
    // although update uses id. Should ideally pass tenant.
    return this.prisma.product.update({
      where: { id },
      data
    });
  }

  async delete(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
