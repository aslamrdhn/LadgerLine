require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const INITIAL_SUPPLIERS = [
    {
      id: 'sup-1',
      name: 'Kopi Gayo Mandiri Ltd',
      contactPerson: 'Bpk. Ahmad Gayo',
      phone: '+62 812-4455-6677',
      address: 'Jl. Takengon-Gayo No. 12, Aceh',
      email: 'gayo@mandiricoffee.co.id',
      npwp: '01.234.567.8-011.000',
      isVerified: true,
      approvalStatus: 'APPROVED',
      subscriptionTier: 'premium',
      monthlyFeePaidUntil: new Date('2026-10-15'),
      bankAccount: 'Mandiri 137-0022-1144-55'
    },
    {
      id: 'sup-2',
      name: 'Es Kristal Jakarta Sejahtera',
      contactPerson: 'Ibu Ratna',
      phone: '+62 821-8899-0011',
      address: 'Kawasan Industri Pulogadung Blok B, Jakarta',
      email: 'info@eskristaljakarta.com',
      npwp: '02.456.789.0-022.000',
      isVerified: true,
      approvalStatus: 'APPROVED',
      subscriptionTier: 'free',
      monthlyFeePaidUntil: new Date('2026-07-01'),
      bankAccount: 'BCA 522-0943-221'
    }
  ];

  for (const s of INITIAL_SUPPLIERS) {
    const existing = await prisma.supplier.findUnique({ where: { id: s.id } });
    if (!existing) {
      await prisma.supplier.create({ data: s });
      console.log('Seeded supplier:', s.name);
    }
  }

  // Seed listings
  const LISTINGS = [
    {
      supplierId: 'sup-1',
      title: 'Biji Kopi Arabica Gayo Premium',
      description: 'Roasted medium, cocok untuk espresso',
      price: 150000,
      stockUnit: 'kg'
    },
    {
      supplierId: 'sup-1',
      title: 'Biji Kopi Robusta Gayo',
      description: 'Dark roast, strong body',
      price: 90000,
      stockUnit: 'kg'
    },
    {
      supplierId: 'sup-2',
      title: 'Es Kristal Tube (10 Kg)',
      description: 'Es kristal siap pakai',
      price: 18000,
      stockUnit: 'pack'
    }
  ];

  for(const l of LISTINGS) {
    const ex = await prisma.supplierListing.findFirst({ where: { supplierId: l.supplierId, title: l.title } });
    if(!ex) {
      await prisma.supplierListing.create({ data: l });
      console.log('Seeded listing:', l.title);
    }
  }

}

main().catch(err => console.error(err)).finally(() => prisma.$disconnect());
