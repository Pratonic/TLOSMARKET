/**
 * POST /api/admin/reset
 * Wipes trades, choices, results, snapshots. Keeps teams, companies, events. Resets to PORTFOLIO.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resetSchema } from '@/lib/schemas';



export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    // Delete transactional data
    await tx.trade.deleteMany();
    await tx.choice.deleteMany();
    await tx.eventResult.deleteMany();
    await tx.snapshotHolding.deleteMany();
    await tx.snapshot.deleteMany();
    await tx.judgeScore.deleteMany();
    await tx.teamNotes.deleteMany();

    // Reset teams to starting cash
    await tx.team.updateMany({
      data: { cash: 1000000 },
    });

    // Reset company pools
    await tx.company.updateMany({
      data: { poolSold: 0 },
    });

    // Reset event resolution status
    await tx.eventDef.updateMany({
      data: { resolved: false },
    });

    // Reset game state
    await tx.game.update({
      where: { id: 1 },
      data: {
        phase: 'PORTFOLIO',
        marketOpen: false,
        gameVersion: { increment: 1 },
      },
    });
  }, {
    timeout: 60000,
    maxWait: 60000
  });

  return NextResponse.json({ success: true });
}
