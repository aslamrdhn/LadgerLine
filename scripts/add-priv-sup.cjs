const fs = require('fs');
let code = fs.readFileSync('server/routes/suppliers.ts', 'utf8');

const newEndpoint = `
router.get('/suppliers/tenant', authorizeRole(['owner', 'kasir', 'admin']), async (req: AuthenticatedRequest, res: Response) => {
  // We can return the array of suppliers they have ordered from!
  const tenantId = req.user?.tenantId;
  try {
    const prs = await prisma.purchaseRequest.findMany({
      where: { tenantId },
      include: { supplier: { include: { listings: true } } }
    });
    
    const supsMap = new Map();
    for(const pr of prs) {
       if(pr.supplier) {
          supsMap.set(pr.supplier.id, pr.supplier);
       }
    }
    
    // We can also allow them to add their own unverified suppliers in the future
    res.json(Array.from(supsMap.values()));
  } catch(err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
`;

code = code.replace("export const suppliersRouter = router;", newEndpoint + "\nexport const suppliersRouter = router;");

fs.writeFileSync('server/routes/suppliers.ts', code);
console.log('Added suppliers/tenant endpoint');
