import { Router, Request, Response } from 'express';
import { ProductRepository } from './product.repository.ts';
import { ProductService } from './product.service.ts';
import { authenticateToken } from '../../shared/middleware/auth.middleware.ts';
import { globalErrorHandler } from '../../shared/middleware/error.middleware.ts';

const router = Router();
const repository = new ProductRepository();
const service = new ProductService(repository);

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product management
 */

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: Retrieve a paginated list of products
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page (max 100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search keyword for product name
 *     responses:
 *       200:
 *         description: A paginated list of products.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     # Complete schema down here...
 *                 meta:
 *                   type: object
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateToken, async (req: any, res: Response, next: any) => {
  try {
    const { page, limit, search } = req.query;
    const tenantId = req.user?.tenantId;

    const result = await service.fetchProducts(
      tenantId,
      page ? parseInt(page as string, 10) : 1,
      limit ? parseInt(limit as string, 10) : 10,
      search as string
    );

    res.json({ success: true, data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

export default router;
