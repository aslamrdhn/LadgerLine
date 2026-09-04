import { Router, Response } from 'express';
import { getPrismaClient } from '../db.js';
import { AuthenticatedRequest, authorizeRole } from '../middlewares/auth.js';

export const costEngineRouter = Router();

costEngineRouter.get('/true-cost/:productId', authorizeRole(['Owner', 'superadmin', 'Manager']), async (req: AuthenticatedRequest, res: Response) => {
  const prisma: any = getPrismaClient();
  try {
    const { productId } = req.params;
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant ID required' });
    }

    // 1. Get Product & Material Cost
    const product = await prisma.product?.findUnique({
      where: { id: productId },
      include: {
        recipes: {
          include: {
            material: true
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let materialCost = 0;
    const materialBreakdown: { name: string, amount: number }[] = [];
    
    product.recipes.forEach(recipe => {
      const cost = Number(recipe.material.unitCost) * Number(recipe.amount);
      materialCost += cost;
      materialBreakdown.push({ name: recipe.material.name, amount: cost });
    });

    // We can also just use product.costPrice if it's already calculated, 
    // but building it dynamically shows the "True Cost" engine at work.

    // 2. Calculate Total Sales Quantity across the tenant to do allocation
    // For BY_SALES_QUANTITY
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const allTenantOrderItems = await prisma.salesDetail.findMany({
      where: {
        order: {
          tenantId: tenantId,
          orderTime: { gte: startOfMonth }
        }
      },
      include: { order: true }
    });

    const totalCupSales = allTenantOrderItems.reduce((acc, item) => acc + item.quantity, 0) || 1; // avoid / 0
    const currentProductSales = allTenantOrderItems.filter(i => i.productId === productId).reduce((acc, item) => acc + item.quantity, 0);
    
    // Revenue Allocation
    const totalRevenue = allTenantOrderItems.reduce((acc, item) => acc + (item.priceAtSale * item.quantity), 0) || 1;
    const currentProductRevenue = allTenantOrderItems.filter(i => i.productId === productId).reduce((acc, item) => acc + (item.priceAtSale * item.quantity), 0);
    const revenuePercentage = currentProductRevenue / totalRevenue;

    // 3. Get Expenses
    const expenses = await prisma.expense.findMany({
      where: {
        tenantId: tenantId,
        date: { gte: startOfMonth }
      }
    });

    // Also get allocation rules configured for specific tracking
    const rules = await prisma.expenseAllocationRule.findMany({
      where: { tenantId: tenantId }
    });

    let operationalAllocation = 0;
    const operationalBreakdown: { category: string, amount: number }[] = [];

    // Aggregate expenses by category to avoid duplicate keys in breakdown
    const aggregatedExpenses: Record<string, any> = {};
    expenses.forEach(e => {
      if(!aggregatedExpenses[e.category]) {
        aggregatedExpenses[e.category] = { ...e, amount: 0 };
      }
      aggregatedExpenses[e.category].amount += e.amount;
    });

    Object.values(aggregatedExpenses).forEach(expense => {
      // For each expense category, check if there is a specific rule
      const matchingRule = rules.find(r => r.expenseCategory === expense.category);
      const method = matchingRule?.allocationMethod || expense.allocationMethod;
      
      let allocatedToProduct = 0;
      
      if (method === 'BY_SALES_QUANTITY') {
         const perCupCost = expense.amount / totalCupSales;
         allocatedToProduct = perCupCost;
      } else if (method === 'BY_REVENUE_PERCENTAGE') {
         if (currentProductSales > 0) {
            allocatedToProduct = (expense.amount * revenuePercentage) / currentProductSales;
         }
      } else if (method === 'FIXED_ALLOCATION') {
         if (matchingRule?.targetProductId === productId && matchingRule.fixedAmount) {
             allocatedToProduct = matchingRule.fixedAmount;
         }
      }
      
      if (allocatedToProduct > 0) {
        operationalAllocation += allocatedToProduct;
        operationalBreakdown.push({ category: expense.category, amount: allocatedToProduct });
      }
    });

    // 4. Tax and Maintenance Default Logic if not covered by expenses
    const taxAllocation = 0; // Simple assumption for demo if needed, or query from product DB
    
    // Sort breakdowns by amount descending
    materialBreakdown.sort((a,b) => b.amount - a.amount);
    operationalBreakdown.sort((a,b) => b.amount - a.amount);

    const trueCost = materialCost + operationalAllocation + taxAllocation;
    const realProfit = product.price - trueCost;
    const margin = product.price > 0 ? (realProfit / product.price) * 100 : 0;

    let recommendation = null;
    if (margin < 30) {
      recommendation = `⚠️ Produk ${product.name} memiliki margin terlalu kecil (${margin.toFixed(1)}%). Pertimbangkan evaluasi harga jual.`;
    }

    res.json({
      productId: product.id,
      name: product.name,
      sellingPrice: product.price,
      materialCost,
      materialBreakdown,
      operationalCost: operationalAllocation,
      operationalBreakdown,
      tax: taxAllocation,
      wasteCost: 0, // Placeholder
      totalTrueCost: trueCost,
      realProfit,
      margin: margin,
      recommendation
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Expense
costEngineRouter.post('/expenses', authorizeRole(['Owner', 'superadmin', 'Manager']), async (req: AuthenticatedRequest, res: Response) => {
  const prisma: any = getPrismaClient();
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Tenant ID required' });
    const { category, amount, date, description, allocationMethod } = req.body;
    const expense = await prisma.expense?.create({
      data: {
        tenantId,
        category,
        amount,
        date: new Date(date),
        description,
        allocationMethod
      }
    });
    res.json(expense);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Configure Rules
costEngineRouter.post('/rules', authorizeRole(['Owner', 'superadmin', 'Manager']), async (req: AuthenticatedRequest, res: Response) => {
  const prisma: any = getPrismaClient();
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ error: 'Tenant ID required' });
    const { expenseCategory, allocationMethod, targetProductId, fixedAmount } = req.body;
    const rule = await prisma.expenseAllocationRule?.create({
      data: {
        tenantId,
        expenseCategory,
        allocationMethod,
        targetProductId,
        fixedAmount
      }
    });
    res.json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
