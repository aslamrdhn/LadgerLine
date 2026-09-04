import { ProductRepository } from '../repositories/productRepository.js';

export class ProductService {
  private repository = new ProductRepository();

  async getProductsForTenant(tenantId: string) {
    if (!tenantId) throw new Error('Tenant ID required');
    return this.repository.findAllByTenant(tenantId);
  }

  async getProduct(id: string, tenantId: string) {
    return this.repository.findByIdAndTenant(id, tenantId);
  }

  async createProduct(tenantId: string, payload: any) {
    // Business logic validation
    if (payload.price < 0) throw new Error('Price cannot be negative');
    
    return this.repository.create({
      tenantId,
      name: payload.name,
      category: payload.category || 'LAINNYA',
      price: payload.price,
      costPrice: payload.costPrice || 0,
      stock: payload.stock || 0,
      warningLimit: payload.warningLimit || 10,
      komposisi: payload.komposisi || null,
    });
  }

  async updateProduct(id: string, tenantId: string, payload: any) {
    const existing = await this.repository.findByIdAndTenant(id, tenantId);
    if (!existing) throw new Error('Product not found');

    return this.repository.update(id, {
      name: payload.name,
      price: payload.price,
      costPrice: payload.costPrice,
      stock: payload.stock,
    });
  }

  async deleteProduct(id: string, tenantId: string) {
    const existing = await this.repository.findByIdAndTenant(id, tenantId);
    if (!existing) throw new Error('Product not found');
    return this.repository.delete(id);
  }
}
