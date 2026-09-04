import fs from 'fs';
import path from 'path';

const file = path.join(process.cwd(), 'server', 'routes', 'suppliers.ts');
let content = fs.readFileSync(file, 'utf8');

const additionalEndpoin = `
// ==========================================
// 5. SUPPLIER PORTAL ENDPOINTS
// ==========================================

router.get('/supplier/purchase-requests', async (req: AuthenticatedRequest, res: Response) => {
  // If we had JWT setup strictly for suppliers, we'd use req.user
  // For demo logic through X-Supplier-Id header
  const supplierId = req.headers['x-supplier-id'] as string;
  if (!supplierId) return res.status(401).json({ success: false, message: 'Unauth supplier' });

  try {
    const list = await prisma.purchaseRequest.findMany({
      where: { supplierId },
      include: { tenant: true, items: true },
      orderBy: { createdAt: 'desc' }
    });
    // Sanitize tenant info to maintain ecosystem privacy
    const sanitizedList = list.map(pr => ({
       ...pr,
       tenant: { storeName: pr.tenant?.storeName, storeAddress: pr.tenant?.storeAddress }
    }));
    res.json(sanitizedList);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/supplier/purchase-requests/:id/action', async (req: AuthenticatedRequest, res: Response) => {
  const supplierId = req.headers['x-supplier-id'] as string;
  const { id } = req.params;
  const { action, estimatedPrice } = req.body; // action: ACCEPT, REJECT

  if (!supplierId) return res.status(401).json({ success: false, message: 'Unauth supplier' });

  try {
    const pr = await prisma.purchaseRequest.findFirst({ where: { id, supplierId } });
    if (!pr) return res.status(404).json({ success: false, message: 'PR not found' });

    let newStatus = 'DRAFT';
    if (action === 'ACCEPT') newStatus = 'ACCEPTED';
    if (action === 'REJECT') newStatus = 'REJECTED';
    if (action === 'COMPLETE') newStatus = 'COMPLETED';

    const updated = await prisma.purchaseRequest.update({
      where: { id },
      data: { status: newStatus }
    });

    res.json({ success: true, request: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

`;

if (!content.includes('/supplier/purchase-requests')) {
  content = content + additionalEndpoin;
  fs.writeFileSync(file, content);
  console.log('Added supplier endpoint');
} else {
  console.log('Endpoint already exists');
}

