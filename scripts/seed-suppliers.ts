import { getPrismaClient } from '../server/db.js';

const prisma = getPrismaClient();

async function main() {
  const INITIAL_SUPPLIERS = [
    {
      id: 'sup-1',
      companyName: 'Kopi Gayo Mandiri Ltd',
      ownerName: 'Bpk. Ahmad Gayo',
      phone: '+62 812-4455-6677',
      address: 'Jl. Takengon-Gayo No. 12, Aceh',
      email: 'gayo@mandiricoffee.co.id',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED'
    },
    {
      id: 'sup-2',
      companyName: 'Es Kristal Jakarta Sejahtera',
      ownerName: 'Ibu Ratna',
      phone: '+62 821-8899-0011',
      address: 'Kawasan Industri Pulogadung Blok B, Jakarta',
      email: 'info@eskristaljakarta.com',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED'
    }
  ];

  for (const s of INITIAL_SUPPLIERS) {
    const existing = await prisma.supplier.findUnique({ where: { id: s.id } });
    if (!existing) {
      await prisma.supplier.create({ data: s });
      console.log('Seeded supplier:', s.companyName);
      
      // Also give them an active subscription
      await prisma.supplierSubscription.create({
        data: {
          id: `sub-${s.id}`,
          supplierId: s.id,
          package: 'PREMIUM',
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date('2029-12-31'),
          paymentStatus: 'PAID'
        }
      });
    }
  }

  // Seed listings (SupplierProduct)
  const LISTINGS = [
    {
      id: 'prod-1',
      supplierId: 'sup-1',
      productName: 'Biji Kopi Arabica Gayo Premium',
      category: 'Coffee Beans',
      priceOffer: 150000,
      unit: 'kg',
      approvalStatus: 'APPROVED'
    },
    {
      id: 'prod-2',
      supplierId: 'sup-1',
      productName: 'Biji Kopi Robusta Gayo',
      category: 'Coffee Beans',
      priceOffer: 90000,
      unit: 'kg',
      approvalStatus: 'APPROVED'
    },
    {
      id: 'prod-3',
      supplierId: 'sup-2',
      productName: 'Es Kristal Tube (10 Kg)',
      category: 'Ice',
      priceOffer: 18000,
      unit: 'pack',
      approvalStatus: 'APPROVED'
    }
  ];

  for (const p of LISTINGS) {
    const ex = await prisma.supplierProduct.findUnique({ where: { id: p.id } });
    if (!ex) {
      await prisma.supplierProduct.create({ data: p });
      console.log('Seeded supplier product:', p.productName);
    }
  }

}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
