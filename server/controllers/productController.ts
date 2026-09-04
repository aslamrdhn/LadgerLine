import { Request, Response } from 'express';
import { ProductService } from '../services/productService2.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { logger } from '../logger.js';

export class ProductController {
  private service = new ProductService();

  getAllProducts = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false, message: 'Invalid tenant' });
      
      const products = await this.service.getProductsForTenant(tenantId);
      res.json(products);
    } catch (err: any) {
      logger.error(`Product list failed: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  };

  createProduct = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false });

      const newProduct = await this.service.createProduct(tenantId, req.body);
      res.json({ success: true, item: newProduct });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  updateProduct = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false });
      
      const updated = await this.service.updateProduct(req.params.id, tenantId, req.body);
      res.json({ success: true, item: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };

  deleteProduct = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(400).json({ success: false });
      
      await this.service.deleteProduct(req.params.id, tenantId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  };
}
