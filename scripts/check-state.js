const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const teams = await prisma.team.findMany({ include: { choices: true } });
  console.log("Teams:", JSON.stringify(teams, null, 2));
  
  const game = await prisma.game.findFirst();
  console.log("Game Phase:", game.phase);
}

check().then(() => prisma.$disconnect());
