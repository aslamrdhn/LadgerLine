import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Sprint 0 Minimal Data...');

  const plan = await prisma.plan.upsert({
    where: { name: 'STARTER' },
    update: {},
    create: {
      name: 'STARTER',
      maxOutlets: 1,
      maxUsers: 5,
      price: 200000,
      features: { fifo: true, average: false, supplierNetwork: false, aiAdvisor: false }
    }
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'test-tenant' },
    update: {},
    create: {
      name: 'Test Tenant',
      slug: 'test-tenant',
      email: 'test@tenant.com',
      status: 'ACTIVE',
    }
  });

  const outlet = await prisma.outlet.create({
    data: {
      tenantId: tenant.id,
      name: 'Outlet Utama',
      isDefault: true,
      address: 'Jl. Test No. 1',
      phone: '08123456789',
    }
  });

  const warehouse = await prisma.warehouse.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      name: 'Main Storage',
      isDefault: true,
    }
  });

  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      planId: plan.id,
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    }
  });

  await prisma.tenantSetting.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      timezone: 'Asia/Jakarta',
      autoCloseHour: 0,
      softCloseDays: 7,
    }
  });

  const now = new Date();
  const periodStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  await prisma.accountingPeriod.create({
    data: {
      tenantId: tenant.id,
      period: periodStr,
      startDate,
      endDate,
      status: 'OPEN',
      createdBy: 'system',
    }
  });

  const prefixes = ['INV', 'PO', 'RCV', 'JRN'];
  for (const prefix of prefixes) {
    await prisma.numberSequence.upsert({
      where: { tenantId_prefix_year: { tenantId: tenant.id, prefix, year: String(now.getFullYear()) } },
      update: {},
      create: {
        tenantId: tenant.id,
        prefix,
        year: String(now.getFullYear()),
        lastNumber: 0,
      }
    });
  }

  const unitKg = await prisma.unit.create({
    data: { tenantId: tenant.id, name: 'Kilogram', symbol: 'kg', category: 'WEIGHT', isBase: true, conversionToBase: 1 }
  });
  const unitPcs = await prisma.unit.create({
    data: { tenantId: tenant.id, name: 'Piece', symbol: 'pcs', category: 'COUNT', isBase: true, conversionToBase: 1 }
  });

  const accounts = [
    { code: 'KAS', name: 'Kas', type: 'ASSET', isDefault: true },
    { code: 'PENDAPATAN', name: 'Pendapatan Penjualan', type: 'REVENUE', isDefault: true },
    { code: 'HPP', name: 'Harga Pokok Penjualan', type: 'EXPENSE', isDefault: true },
    { code: 'PERSEDIAAN', name: 'Persediaan Barang', type: 'ASSET', isDefault: true },
    { code: 'PAJAK', name: 'Pajak Keluaran', type: 'LIABILITY', isDefault: true },
  ];
  for (const acc of accounts) {
    await prisma.account.create({
      data: { tenantId: tenant.id, ...acc }
    });
  }

  const coffee = await prisma.item.create({
    data: {
      tenantId: tenant.id,
      warehouseId: warehouse.id,
      sku: 'COF-001',
      name: 'Kopi Arabica',
      category: 'Bahan Baku',
      unitId: unitKg.id,
      purchasePrice: 120000,
      sellPrice: 150000,
      isMenu: false,
      currentStock: 10,
      status: 'ACTIVE',
    }
  });

  const cup = await prisma.item.create({
    data: {
      tenantId: tenant.id,
      warehouseId: warehouse.id,
      sku: 'PKG-001',
      name: 'Gelas Paper',
      category: 'Packaging',
      unitId: unitPcs.id,
      purchasePrice: 1200,
      sellPrice: 1500,
      isMenu: false,
      currentStock: 200,
      status: 'ACTIVE',
    }
  });

  await prisma.inventoryBalance.create({
    data: {
      tenantId: tenant.id,
      warehouseId: warehouse.id,
      itemId: coffee.id,
      currentStock: 10,
      version: 1,
    }
  });
  await prisma.inventoryBalance.create({
    data: {
      tenantId: tenant.id,
      warehouseId: warehouse.id,
      itemId: cup.id,
      currentStock: 200,
      version: 1,
    }
  });

  await prisma.fIFOLayer.create({
    data: {
      tenantId: tenant.id,
      itemId: coffee.id,
      warehouseId: warehouse.id,
      quantity: 10,
      unitCost: 100000,
      layerDate: new Date('2026-07-20'),
      remainingQty: 10,
      sourceReference: 'OPENING',
    }
  });

  await prisma.inventoryLedger.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      warehouseId: warehouse.id,
      itemId: coffee.id,
      movementType: 'OPENING',
      referenceType: 'OPENING',
      referenceId: 'OPEN-001',
      businessDate: new Date('2026-07-20'),
      qtyIn: 10,
      qtyOut: 0,
      balanceAfter: 10,
      unitCost: 100000,
      costMethod: 'FIFO',
      unitSnapshot: 'kg',
    }
  });

  const americano = await prisma.menu.create({
    data: {
      tenantId: tenant.id,
      name: 'Americano',
      price: 25000,
      isActive: true,
    }
  });

  await prisma.item.create({
    data: {
      tenantId: tenant.id,
      warehouseId: warehouse.id,
      sku: 'MNU-AME',
      name: 'Americano',
      category: 'Menu',
      unitId: unitPcs.id,
      purchasePrice: 0,
      sellPrice: 25000,
      isMenu: true,
      currentStock: 0,
      status: 'ACTIVE',
    }
  });

  await prisma.recipe.create({
    data: {
      tenantId: tenant.id,
      menuId: americano.id,
      yieldQty: 1,
      version: 1,
      effectiveFrom: new Date('2026-01-01'),
      effectiveUntil: null,
      details: {
        create: [
          { tenantId: tenant.id, itemId: coffee.id, quantity: 0.018, unitId: unitKg.id },
          { tenantId: tenant.id, itemId: cup.id, quantity: 1, unitId: unitPcs.id },
        ]
      }
    }
  });

  const demoHash = await bcrypt.hash('demo123', 10);
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'cashier@test.com',
      passwordHash: demoHash,
      name: 'Test Cashier',
      role: 'CASHIER',
    }
  });

  console.log('✅ Sprint 0 Seed selesai!');
  console.log('📋 Tenant ID:', tenant.id);
  console.log('📋 Outlet ID:', outlet.id);
  console.log('📋 Menu ID (Americano):', americano.id);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
