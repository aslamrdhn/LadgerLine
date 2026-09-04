import { Request, Response, NextFunction } from 'express';
import { ZodSchema, z } from 'zod';
import { logger } from '../logger.js';

export const validateBody = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = schema.parse(req.body);
    req.body = parsed;
    next();
  } catch (err: any) {
    logger.warn(`[VALIDATION FAILED] ${req.method} ${req.path}: ${err.message}`);
    res.status(400).json({
      success: false,
      message: 'Invalid request data',
      errors: err.errors
    });
  }
};

export const orderCheckoutSchema = z.object({
  tableNumber: z.string().min(1),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().optional().default(0),
  tax: z.number().nonnegative().optional().default(0),
  totalPrice: z.number().nonnegative(),
  paymentMethod: z.string().min(1),
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    qty: z.number().positive(),
    price: z.number().nonnegative()
  })).min(1),
  cashAmount: z.number().optional()
});

export const productSaveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  category: z.string().min(1),
  price: z.number().nonnegative(),
  costPrice: z.number().nonnegative().optional().default(0),
  stock: z.number().nonnegative().optional().default(0),
  warningLimit: z.number().nonnegative().optional().default(10),
  komposisi: z.string().optional()
});

export const rawMaterialSaveSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  stockQuantity: z.number().nonnegative(),
  stockUnit: z.string().default('g'),
  warningLimit: z.number().nonnegative().default(100),
  unitCost: z.number().nonnegative().default(0)
});
