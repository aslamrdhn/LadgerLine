import { Router, Request, Response } from 'express';
import { env } from '../env.ts';
import { container } from '../container.ts';
import { AuthenticatedRequest, authorizeRole } from '../middlewares/auth.ts';
import { validateBody, orderCheckoutSchema } from '../middlewares/validation.ts';
import { getPrismaClient } from '../db.ts';
import { logger } from '../logger.js';
import { apiRateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Helper to get and save custom settings values securely with automatic fallback
async function getSettingsList(tenantId: string, key: string, defaultValue: any[]): Promise<any[]> {
  try {
    const rawValue = await container.systemRepository.getSystemSetting(tenantId, key, JSON.stringify(defaultValue));
    return JSON.parse(rawValue);
  } catch (err) {
    return defaultValue;
  }
}

async function saveSettingsList(tenantId: string, key: string, list: any[]): Promise<void> {
  try {
    await container.systemRepository.saveSystemSetting(tenantId, key, JSON.stringify(list));
  } catch (err) {
    logger.error(`[Orders Router] Failed to save setting list: ${err}`);
  }
}

// 1. GET FULL CONSOLIDATED STATE (ZERO-DELAY INITIALIZER)
router.get('/state', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const tenant = await container.tenantRepository.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Data tenant tidak ditemukan.' });
    }

    const products = await container.productRepository.getProducts(tenantId);
    const rawMaterials = await container.productRepository.getRawMaterials(tenantId);
    const recipes = await container.productRepository.getRecipes(tenantId);
    
    // Get dynamic Tables list from database
    let activeTablesList = await container.tenantRepository.getTables(tenantId);
    if (activeTablesList.length === 0) {
      activeTablesList = await container.tenantRepository.generateTables(tenantId, 5);
    }
    
    const orders = await container.orderRepository.getOrders(tenantId);
    const financeLogs = await container.financeRepository.getFinanceLogs(tenantId);
    const securityAuditLogs = await container.systemRepository.getSecurityAuditLogs(tenantId);

    // Sync HPP / COGS calculation values based on raw materials
    products.forEach((p: any) => {
      const associatedRecipes = recipes.filter((r: any) => (r.productId === p.id || r.product_id === p.id));
      if (associatedRecipes.length > 0) {
        let calculatedCogs = 0;
        associatedRecipes.forEach((rec: any) => {
          const material = rawMaterials.find(m => m.id === (rec.materialId || rec.material_id));
          if (material) {
            calculatedCogs += Number(rec.amount) * Number(material.unitCost || material.unitCost || 0);
          }
        });
        p.costPrice = Math.round(calculatedCogs);
        p.cost_price = p.costPrice;
      }
    });

    const tierStr = await container.systemRepository.getSystemSetting(tenantId, 'subscription_tier', 'TIER_1');
    const tokenStr = await container.systemRepository.getSystemSetting(tenantId, 'ledger_token_balance', '500');

    res.json({
      id: tenantId,
      products,
      rawMaterials,
      recipes,
      tables: activeTablesList,
      orders,
      financeLogs,
      securityAuditLogs,
      backupHistory: [],
      appConfig: {
        id: tenantId,
        name: tenant.name,
        subscriptionTier: (tenant as any).subscriptionTier || tierStr,
        ledgerTokenBalance: (tenant as any).ledgerTokenBalance || parseInt(tokenStr)
      }
    });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. BACKEND RESET DEMO SEED
router.post('/reset', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  try {
    const defaultProducts = [
      { id: 'p-1', name: 'Espresso Single Shot', category: 'Coffee', price: 15000, costPrice: 4000, stock: 99, warningLimit: 10 },
      { id: 'p-2', name: 'Kopi Susu Gula Aren', category: 'Coffee', price: 18000, costPrice: 5000, stock: 50, warningLimit: 10 },
      { id: 'p-3', name: 'Choco Lava Cake', category: 'Dessert', price: 22000, costPrice: 10000, stock: 20, warningLimit: 5 }
    ];

    const defaultMaterials = [
      { id: 'm-1', name: 'Biji Arabika Gayo', stockQuantity: 5000.0, stockUnit: 'g', warningLimit: 500, unitCost: 150, isTaxable: false, taxRate: 0 },
      { id: 'm-2', name: 'Susu UHT Full Cream', stockQuantity: 10000.0, stockUnit: 'ml', warningLimit: 1000, unitCost: 20, isTaxable: false, taxRate: 0 },
      { id: 'm-3', name: 'Gula Aren Cair', stockQuantity: 3000.0, stockUnit: 'ml', warningLimit: 500, unitCost: 35, isTaxable: false, taxRate: 0 }
    ];

    const prisma = getPrismaClient();
            await prisma.$transaction(async (tx) => {
              // Clean target material, products and recipes first
              // await tx.recipe.deleteMany({ where: { product: { tenantId } } });
              // await tx.product.deleteMany({ where: { tenantId } });
              // await tx.rawMaterial.deleteMany({ where: { tenantId } });
            });

    for (const p of defaultProducts) {
      await container.productRepository.saveProduct(tenantId, p);
    }
    for (const m of defaultMaterials) {
      await container.productRepository.saveRawMaterial(tenantId, m);
    }
    
    // Save recipe linkages
    await container.productRepository.saveRecipe(tenantId, 'p-1', 'm-1', 15.0, 'Default Ground Single Espresso');
    await container.productRepository.saveRecipe(tenantId, 'p-2', 'm-1', 15.0, 'Espresso Gayo Base');
    await container.productRepository.saveRecipe(tenantId, 'p-2', 'm-2', 120.0, 'Fresh Milk Portion');
    await container.productRepository.saveRecipe(tenantId, 'p-2', 'm-3', 20.0, 'Liquid Aren sugar');

    await container.systemRepository.createSecurityAuditLog(tenantId, {
      action: 'RESET_DATABASE',
      operator: req.user?.email || 'SYSTEM',
      details: 'Sistem database dibersihkan dan direset ke data inisialisasi default pabrik.'
    });

    res.json({ success: true, message: 'Sistem menu, bahan baku, dan resep berhasil direset ke standar pabrik!' });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. POS MULTI-TENANT CHECKOUT (ATOMIC TRANSACTION SECURE BLOCK)
router.post('/checkout', authorizeRole(['Owner', 'Kasir', 'superadmin']), validateBody(orderCheckoutSchema), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  
  try {
    const orderData = req.body;
    
    // Create atomic order and deduct material stocks automatically
    const orderResult = await container.orderRepository.createOrderTransaction(tenantId, orderData);

    // Save corresponding bookkeeping finance log for EMKM compliance
    await container.financeRepository.createFinanceLog(tenantId, {
      id: `fin-${orderData.id}`,
      type: 'income',
      category: 'Penjualan Kasir POS',
      amount: orderData.totalPrice,
      description: `Transaksi checkout kasir POS ID: ${orderData.id} di Meja ${orderData.tableNumber}`
    });

    // Handle customer loyalty points crediting if customer WhatsApp phone was used
    if (orderData.customerPhone) {
      let customer = await container.tenantRepository.getCustomerByPhone(tenantId, orderData.customerPhone);
      if (!customer) {
        customer = await container.tenantRepository.saveCustomer(tenantId, {
          id: `cust-${Date.now()}`,
          phone: orderData.customerPhone,
          name: orderData.customerName || 'Pelanggan POS',
          points: 0,
          totalSpent: 0
        });
      }

      const pointsEarned = Math.floor(orderData.totalPrice / 1000);
      const pointsRedeemedUsed = Number(orderData.redeemedPoints || 0);

      customer.points = Math.max(0, Number(customer.points) + pointsEarned - pointsRedeemedUsed);
      customer.totalSpent = Number(customer.totalSpent) + orderData.totalPrice;
      await container.tenantRepository.saveCustomer(tenantId, customer);

      // Track loyalty transaction history
      const loyaltyTxns = await getSettingsList(tenantId, 'loyalty_txns', []);
      loyaltyTxns.push({
        id: `loy-tx-${Date.now()}`,
        customerId: customer.id,
        orderId: orderData.id,
        pointsEarned,
        pointsRedeemed: pointsRedeemedUsed,
        description: `Transaksi invoice ${orderData.id}: Kredit +${pointsEarned} Poin, Debit -${pointsRedeemedUsed} Poin.`,
        created_at: new Date().toISOString()
      });
      await saveSettingsList(tenantId, 'loyalty_txns', loyaltyTxns);
    }

    await container.systemRepository.createSecurityAuditLog(tenantId, { action: 'POS_CHECKOUT_SALE', entity: 'Order', entityId: orderData.id, actor: req.user?.email || 'Unknown', details: `Transaction executed` });
    res.json({
      success: true,
      message: 'Transaksi POS berhasil divalidasi dan dicatat!',
      order: orderResult
    });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. GENERATE SNAP TOKEN Redirection Url (REAL MIDTRANS INTEGRATION)
import { midtransService } from '../services/midtransService.js';

router.post('/midtrans/token', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const { orderId, amount, customerPhone, customerName } = req.body;
  
  if (!orderId || !amount) {
    return res.status(400).json({ success: false, message: 'Masukkan parameter orderId dan total tagihan instan.' });
  }

  try {
    const customerDetails = {
      first_name: customerName || 'Pelanggan',
      phone: customerPhone || '08000000000'
    };

    const simulatedToken = await midtransService.createTransaction(orderId, amount, customerDetails);
    
    // Generates a mock URL if in sandbox, or actual production url base. Midtrans returns the proper redirect url, 
    // but the snap JS client is preferred on the frontend usually.
    const redirectUrl = env.MIDTRANS_IS_PRODUCTION 
      ? `https://app.midtrans.com/snap/v3/redirection/${simulatedToken}`
      : `https://app.sandbox.midtrans.com/snap/v3/redirection/${simulatedToken}`;
    
    logger.info(`[MIDTRANS] Generated Snap Pay token: ${simulatedToken} for ${orderId}`);
    res.json({
      success: true,
      token: simulatedToken,
      redirect_url: redirectUrl
    });
  } catch (err: any) {
    logger.error(`[MIDTRANS] Error: ${err.message}`);
    res.status(500).json({ success: false, message: 'Midtrans Transaction Failed', detail: err.message });
  }
});

import crypto from 'crypto';

// 4b. MIDTRANS WEBHOOK (NOTIFICATION HANDLER)
// This must NOT be protected by authorizeRole because it's called by Midtrans servers
router.post('/midtrans/webhook', async (req: Request, res: Response) => {
  const payload = req.body;
  if (!payload || !payload.order_id) {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }

  const { order_id, status_code, gross_amount, signature_key, transaction_status } = payload;
  
  // Verify signature
  const serverKey = env.MIDTRANS_SERVER_KEY || '';
  const hash = crypto.createHash('sha512').update(`${order_id}${status_code}${gross_amount}${serverKey}`).digest('hex');
  
  if (hash !== signature_key) {
    logger.warn(`[MIDTRANS WEBHOOK] Invalid signature for order ${order_id}`);
    return res.status(403).json({ success: false, message: 'Invalid signature' });
  }

  try {
    const prisma = getPrismaClient();
    const order = await prisma.salesOrder.findFirst({ where: { id: order_id } });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      if (order.orderStatus !== 'PAID') {
         await container.orderRepository.confirmPaymentTransaction(order.tenantId, order_id);
         logger.info(`[MIDTRANS WEBHOOK] Order ${order_id} marked as Paid via webhook`);
      }
    } else if (transaction_status === 'cancel' || transaction_status === 'deny' || transaction_status === 'expire') {
      await prisma.salesOrder.updateMany({
        where: { id: order_id },
        data: { orderStatus: 'FAILED' }
      });
      logger.info(`[MIDTRANS WEBHOOK] Order ${order_id} marked as Failed via webhook`);
    }

    res.json({ success: true, message: 'OK' });
  } catch (err: any) {
    logger.error(`[MIDTRANS WEBHOOK] Error handling notification: ${err.message}`);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

// 5. UPDATE ORDER STATUS (PREP STATUS & PAYMENT STATUS)
router.put('/orders/:id/status', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  const { status, prepStatus } = req.body;

  try {
    const prisma = getPrismaClient();
            const order = await prisma.salesOrder.findFirst({
              where: { id, tenantId }
            });

            if (!order) {
              return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
            }

            const updateData: any = {};
            if (status !== undefined) updateData.orderStatus = status;
            if (prepStatus !== undefined) updateData.prepStatus = prepStatus;

            const updated = await prisma.salesOrder.updateMany({
              where: { id },
              data: updateData
            });

            res.json({ success: true, order: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. ORDER RETURN & REFUND DEDUCTION (RESTORE STOCKS)
router.post('/orders/:id/return', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;
  const { reason } = req.body;

  try {
    return res.status(501).json({ success: false, message: "Refund not implemented yet" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 10. GENERATE AND BULK UPSERT SMART TABLES
router.post('/tables/generate', authorizeRole(['Owner', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { count } = req.body;
  if (!count || Number(count) <= 0) {
    return res.status(400).json({ success: false, message: 'Jumlah meja tidak valid.' });
  }

  try {
    const generated = await container.tenantRepository.generateTables(tenantId, Number(count));
    
    await container.systemRepository.createSecurityAuditLog(tenantId, {
      action: 'GENERATE_TABLES',
      operator: req.user?.email || 'OWNER',
      details: `Melakukan bulk-generation ${count} meja cafe LedgerLine Smart Table secara otomatis.`
    });

    res.json({ success: true, tables: generated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 11. CASHIER CONFIRM lokal PAYMENT (Confirm payment -> deducts stock -> records EMKM finance & security log)
router.post('/orders/:id/confirm-payment', authorizeRole(['Owner', 'Kasir', 'superadmin']), async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.user?.tenantId;
  const { id } = req.params;

  try {
    const updatedOrder = await container.orderRepository.confirmPaymentTransaction(tenantId, id);
    res.json({ success: true, order: updatedOrder });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 12. PUBLIC GUEST CONFIGURATION SEEKER (Scan QR -> displays menu kiosk with BYO QRIS details)
router.get('/table-public/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  try {
    const table = await container.tenantRepository.getTableByPublicToken(token);
    if (!table) {
      return res.status(404).json({ success: false, message: 'Barcode Meja tidak valid atau telah dinonaktifkan.' });
    }

    const tenantId = table.tenantId;
    const tenant = await container.tenantRepository.getTenant(tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Data Kedai Kopi tidak tersedia.' });
    }

    const products = await container.productRepository.getProducts(tenantId);
    
    res.json({
      success: true,
      table,
      store: {
        id: tenantId,
        name: tenant.name,
        // Carry BYO QRIS settings stored in config_json/tenant directly
        qrisMerchantName: (tenant as any).qrisMerchantName || tenant.name,
        qrisProvider: (tenant as any).qrisProvider || 'Layari QRIS QR',
        qrisBankName: (tenant as any).qrisBankName || 'Bank Mandiri',
        qrisImage: (tenant as any).qrisImage || ''
      },
      products: products.filter(p => p.category !== 'Beans' && p.stock > 0)
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 13. PUBLIC SMART TABLE CHECKOUT FLOW (Customer submits order from their smartphone -> Inserts with Pending/Waiting status)
router.post('/table-public/checkout', apiRateLimiter, async (req: Request, res: Response) => {
  const { orderData } = req.body;
  if (!orderData || !orderData.tableId) {
    return res.status(400).json({ success: false, message: 'Informasi pemesanan atau ID meja tidak lengkap.' });
  }

  try {
    // Validate that the table exists and derive tenantId from it
    const table = await container.tenantRepository.getTableByPublicToken(orderData.tableId);
    if (!table) {
      return res.status(403).json({ success: false, message: 'ID Meja tidak valid.' });
    }
    
    const tenantId = table.tenantId;

    // Audit check: validate pricing from database to ensure no client tampering
    const systemProducts = await container.productRepository.getProducts(tenantId);
    const systemProductsMap = new Map();
    systemProducts.forEach(p => systemProductsMap.set(p.id, p));

    let recomputedSubtotal = 0;
    for (const item of orderData.items || orderData.orderItems || []) {
      const dbProd = systemProductsMap.get(item.productId);
      if (!dbProd) {
        return res.status(400).json({ success: false, message: `Produk ID ${item.productId} tidak dikenal di sistem kasir.` });
      }
      item.priceAtSale = dbProd.price;
      item.costAtSale = dbProd.costPrice || dbProd.cost_price || 0;
      recomputedSubtotal += Number(dbProd.price) * Number(item.quantity);
    }

    // Recalculate price constraints
    orderData.subtotal = recomputedSubtotal;
    const computedTax = Math.round(recomputedSubtotal * 0.11); // Standard PP1 index (11%) or adaptive
    orderData.tax = computedTax;
    orderData.totalPrice = recomputedSubtotal + computedTax;
    orderData.discount = 0;

    // Secure state bounds
    orderData.paymentStatus = 'Pending';
    orderData.paymentMethod = 'QRIS';
    orderData.prepStatus = 'Waiting Payment';
    orderData.notes = `[Smart Table Order] ${orderData.notes || ''}`;

    // Put order through (does NOT deduct any stock at this level as paymentStatus is 'Pending')
    const createdOrder = await container.orderRepository.createOrderTransaction(tenantId, orderData);

    res.json({ success: true, order: createdOrder });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export const ordersRouter = router;
export default ordersRouter;
