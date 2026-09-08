import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.userProfile.findMany({ take: 1 });
  console.log('Users:', users);
}
main().catch(console.error).finally(() => prisma.$disconnect());
