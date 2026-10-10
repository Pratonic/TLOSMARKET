/**
 * Prisma seed script.
 * Seeds: Game singleton, companies, event definitions with per-company params.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create singleton Game row
  await prisma.game.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      phase: 'PORTFOLIO',
      marketOpen: false,
      gameVersion: 1,
    },
  });
  console.log('  ✓ Game singleton created');

  // 2. Create companies
  const companies = [
    { name: 'NOVA', symbol: 'NOVA', sector: 'Enterprise AI' },
    { name: 'VOLT', symbol: 'VOLT', sector: 'EV' },
    { name: 'SHIPX', symbol: 'SHIPX', sector: 'Logistics' },
    { name: 'FINCO', symbol: 'FINCO', sector: 'Banking' },
    { name: 'FRESH', symbol: 'FRESH', sector: 'Food and FMCG' },
    { name: 'MEDIX', symbol: 'MEDIX', sector: 'Healthcare' },
  ];

  const companyMap: Record<string, string> = {};
  for (const c of companies) {
    const company = await prisma.company.upsert({
      where: { symbol: c.symbol },
      update: { name: c.name, sector: c.sector },
      create: {
        name: c.name,
        symbol: c.symbol,
        sector: c.sector,
        basePrice: 1000,
        poolSize: 2000,
        poolSold: 0,
      },
    });
    companyMap[c.symbol] = company.id;
  }
  console.log('  ✓ 6 companies created');

  // 3. Create event definitions
  const events = [
    {
      code: 'G1',
      kind: 'GOOD' as const,
      orderIndex: 1,
      title: 'Enterprise AI Expansion',
      questionText: 'A major enterprise AI platform is expanding globally. How does your team want to respond to this opportunity?',
      companies: [
        { symbol: 'NOVA', aggressiveMove: 0.30, moderateMove: 0.15, holdDrop: 0 },
      ],
    },
    {
      code: 'G2',
      kind: 'GOOD' as const,
      orderIndex: 2,
      title: 'National EV Subsidy',
      questionText: 'The government has announced a massive EV subsidy program. How does your team want to position?',
      companies: [
        { symbol: 'VOLT', aggressiveMove: 0.22, moderateMove: 0.11, holdDrop: 0 },
        { symbol: 'SHIPX', aggressiveMove: 0.14, moderateMove: 0.07, holdDrop: 0 },
      ],
    },
    {
      code: 'G3',
      kind: 'GOOD' as const,
      orderIndex: 3,
      title: 'Banking Rate Cut',
      questionText: 'The central bank has cut interest rates significantly. How does your team want to react?',
      companies: [
        { symbol: 'FINCO', aggressiveMove: 0.18, moderateMove: 0.09, holdDrop: 0 },
        { symbol: 'FRESH', aggressiveMove: 0.10, moderateMove: 0.05, holdDrop: 0 },
      ],
    },
    {
      code: 'B1',
      kind: 'BAD' as const,
      orderIndex: 4,
      title: 'Privacy and Regulatory Crackdown',
      questionText: 'A major regulatory crackdown on data privacy is underway. How does your team want to handle the situation?',
      companies: [
        { symbol: 'NOVA', aggressiveMove: 0, moderateMove: 0, holdDrop: 0.10 },
        { symbol: 'FINCO', aggressiveMove: 0, moderateMove: 0, holdDrop: 0.04 },
      ],
    },
    {
      code: 'B2',
      kind: 'BAD' as const,
      orderIndex: 5,
      title: 'Supply Chain and Tariff Spike',
      questionText: 'Global supply chains are disrupted by new tariffs. How does your team want to respond?',
      companies: [
        { symbol: 'VOLT', aggressiveMove: 0, moderateMove: 0, holdDrop: 0.09 },
        { symbol: 'SHIPX', aggressiveMove: 0, moderateMove: 0, holdDrop: 0.06 },
      ],
    },
    {
      code: 'B3',
      kind: 'BAD' as const,
      orderIndex: 6,
      title: 'Raw Material and Price Caps',
      questionText: 'Governments impose price caps on raw materials. How does your team want to deal with this?',
      companies: [
        { symbol: 'FRESH', aggressiveMove: 0, moderateMove: 0, holdDrop: 0.04 },
        { symbol: 'MEDIX', aggressiveMove: 0, moderateMove: 0, holdDrop: 0.06 },
      ],
    },
  ];

  for (const evt of events) {
    const eventDef = await prisma.eventDef.upsert({
      where: { code: evt.code },
      update: { title: evt.title, questionText: evt.questionText },
      create: {
        code: evt.code,
        kind: evt.kind,
        orderIndex: evt.orderIndex,
        title: evt.title,
        questionText: evt.questionText,
      },
    });

    for (const ec of evt.companies) {
      const companyId = companyMap[ec.symbol];
      if (!companyId) throw new Error(`Company ${ec.symbol} not found`);

      await prisma.eventCompany.upsert({
        where: {
          eventId_companyId: { eventId: eventDef.id, companyId },
        },
        update: {
          aggressiveMove: ec.aggressiveMove,
          moderateMove: ec.moderateMove,
          holdDrop: ec.holdDrop,
        },
        create: {
          eventId: eventDef.id,
          companyId,
          aggressiveMove: ec.aggressiveMove,
          moderateMove: ec.moderateMove,
          holdDrop: ec.holdDrop,
        },
      });
    }
  }
  console.log('  ✓ 6 events with company params created');

  console.log('✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
