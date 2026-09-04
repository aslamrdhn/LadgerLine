const fs = require('fs');
let code = fs.readFileSync('server/routes/suppliers.ts', 'utf8');

const additionalEndpoints = `

// ==========================================
// 6. SUPPLIER PRODUCTS CATALOG (LISTINGS)
// ==========================================

router.get('/supplier/listings', async (req: AuthenticatedRequest, res: Response) => {
  const supplierId = req.headers['x-supplier-id'] as string;
  if (!supplierId) return res.status(401).json({ success: false, message: 'Unauth supplier' });

  try {
    const listings = await prisma.supplierListing.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(listings);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/supplier/listings', async (req: AuthenticatedRequest, res: Response) => {
  const supplierId = req.headers['x-supplier-id'] as string;
  const { title, description, price, stockUnit, specialPriceOffer } = req.body;
  if (!supplierId) return res.status(401).json({ success: false, message: 'Unauth supplier' });

  try {
    const listing = await prisma.supplierListing.create({
      data: {
        supplierId,
        title,
        description: description || '',
        price: Number(price),
        stockUnit: stockUnit || 'kg',
        specialPriceOffer
      }
    });
    res.json({ success: true, listing });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/supplier/listings/:id', async (req: AuthenticatedRequest, res: Response) => {
  const supplierId = req.headers['x-supplier-id'] as string;
  const { id } = req.params;
  if (!supplierId) return res.status(401).json({ success: false, message: 'Unauth supplier' });

  try {
    await prisma.supplierListing.updateMany({
      where: { id, supplierId },
      data: { isActive: false }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
`;

code = code.replace('export const suppliersRouter = router;', additionalEndpoints + '\nexport const suppliersRouter = router;\n');
fs.writeFileSync('server/routes/suppliers.ts', code);
console.log('Added listings endpoints');
