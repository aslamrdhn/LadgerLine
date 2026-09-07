import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.ts';
import { checkout } from '../services/checkout.service.ts';

export async function publicRoutes(fastify: FastifyInstance) {
  // Get Menu by QR token/slug
  fastify.get('/table-public/:token', async (request, reply) => {
    const { token } = request.params as any;
    
    // Find QrMenu by slug
    const qr = await prisma.qrMenu.findUnique({
      where: { slug: token },
      include: {
         outlet: true,
         tenant: true
      }
    });

    if (!qr) {
       reply.status(404);
       return { error: 'QR Code tidak valid atau sudah kadaluarsa.' };
    }

    // Get items for this outlet
    const items = await prisma.menu.findMany({
       where: { tenantId: qr.tenantId, isActive: true },
       orderBy: { name: 'asc' }
    });

    // Group by category manually
    const categoryMap = new Map<string, any[]>();
    for (const item of items) {
       const cat = item.category || 'Uncategorized';
       if (!categoryMap.has(cat)) categoryMap.set(cat, []);
       categoryMap.get(cat)!.push({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image: item.imageUrl,
          variants: [],
          modifiers: []
       });
    }

    return {
      storeName: qr.tenant.name,
      outletId: qr.outletId,
      tenantId: qr.tenantId,
      tableName: qr.slug,
      qrMenuId: qr.id,
      categories: Array.from(categoryMap.entries()).map(([name, items], idx) => ({
         id: 'cat-' + idx,
         name,
         items
      }))
    };
  });

  // Public Checkout
  fastify.post('/table-public/checkout', async (request, reply) => {
    const payload = request.body as any;
    // payload should have: qrMenuId, tenantId, outletId, items (with id, quantity, selectedModifiers, note), customerName
    try {
       // get qr
       const qr = await prisma.qrMenu.findUnique({ where: { id: payload.qrMenuId } });
       if (!qr) return { success: false, message: 'Invalid QR' };

       // map items to rawItems format expected by checkout.service
       const rawItems = payload.items.map((it: any) => {
          let mod = [];
          if (it.selectedModifiers) {
             Object.values(it.selectedModifiers).forEach((arr: any) => {
                if (Array.isArray(arr)) mod.push(...arr);
                else if (typeof arr === 'string') mod.push(arr);
             });
          }
          return {
             menuId: it.id,
             quantity: it.quantity,
             variantId: it.variantId || null,
             modifierIds: mod,
             note: it.note || ''
          };
       });

       const checkoutPayload = {
          tenantId: payload.tenantId,
          outletId: payload.outletId,
          cashierId: 'self-order',
          items: rawItems.map((i: any) => ({
              menuId: i.menuId,
              quantity: i.quantity,
              discountAmount: 0,
              note: i.note
          })),
          payments: [{
              method: 'CASH',
              amount: 0
          }],
          discountPercent: 0,
          forceStock: false,
          skipPeriodValidation: true,
          useHistoricalPrices: false
       };

       const result = await checkout(checkoutPayload);

       return {
          success: true,
          invoiceNumber: result.sale.invoiceNumber,
          totalAmount: result.sale.totalAmount
       };
    } catch(err: any) {
       return { success: false, message: err.message };
    }
  });
}
