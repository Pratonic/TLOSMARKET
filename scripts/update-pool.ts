import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.company.updateMany({
    data: { poolSize: 3000 }
  });
  console.log(`Updated ${result.count} companies to poolSize 3000.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
