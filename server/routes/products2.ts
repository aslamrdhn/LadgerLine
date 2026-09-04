import express from 'express';
import { ProductController } from '../controllers/productController.js';
import { authenticateToken, authorizeRole } from '../middlewares/auth.js';
import { validateBody, productSaveSchema } from '../middlewares/validation.js';

const router = express.Router();
const controller = new ProductController();

// Use the new cleanly separated architecture
router.get('/v2/products', authenticateToken, authorizeRole(['Owner', 'Kasir']), controller.getAllProducts);
router.post('/v2/products', authenticateToken, authorizeRole(['Owner']), validateBody(productSaveSchema), controller.createProduct);
router.put('/v2/products/:id', authenticateToken, authorizeRole(['Owner']), controller.updateProduct);
router.delete('/v2/products/:id', authenticateToken, authorizeRole(['Owner']), controller.deleteProduct);

export default router;
