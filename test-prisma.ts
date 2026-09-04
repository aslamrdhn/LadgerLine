import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
prisma.tenant.findFirst().then(console.log).catch(console.error).finally(()=>prisma.$disconnect())
