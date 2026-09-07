import re

with open("server/routes/public.routes.ts", "r") as f:
    text = f.read()

bad = """    if (!qr || qr.status !== 'active') {
       reply.status(404);
       return { error: 'QR Code tidak valid atau sudah kadaluarsa.' };
    }

    // Get categories and items for this outlet
    const categories = await prisma.menuCategory.findMany({
       where: { tenantId: qr.tenantId },
       include: {
          items: {
             where: { status: 'active', isAvailable: true },
             include: {
                variants: { include: { options: true } },
                modifiers: { include: { modifier: { include: { items: true } } } }
             }
          }
       },
       orderBy: { sortOrder: 'asc' }
    });

    return {
      storeName: qr.tenant.name,
      outletId: qr.outletId,
      tenantId: qr.tenantId,
      tableName: qr.tableName,
      qrMenuId: qr.id,
      categories: categories.map(c => ({
         id: c.id,
         name: c.name,
         items: c.items.map(i => ({
            id: i.id,
            name: i.name,
            description: i.description,
            price: i.price,
            image: i.imageUrl,
            variants: i.variants,
            modifiers: i.modifiers.map(m => m.modifier)
         }))
      }))
    };"""

good = """    if (!qr) {
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
    };"""

text = text.replace(bad, good)

bad_checkout = """       const checkoutPayload = {
          tenantId: payload.tenantId,
          outletId: payload.outletId,
          cashierId: 'self-order',
          rawItems,
          paymentMethod: 'PAY_AT_CASHIER',
          paymentAmount: 0,
          customerName: payload.customerName || `Meja ${qr.tableName}`,
          tableName: qr.tableName,
          orderType: 'DINE_IN',
          note: `Self Order - Meja ${qr.tableName}`
       };"""

good_checkout = """       const checkoutPayload = {
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
          forceStock: false
       };"""

text = text.replace(bad_checkout, good_checkout)

with open("server/routes/public.routes.ts", "w") as f:
    f.write(text)
