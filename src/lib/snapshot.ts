/**
 * Helper to take snapshots of teams at milestone phases.
 */
import { Prisma } from '@prisma/client';
import { getTeamStates } from '@/lib/state';

type Tx = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function createSnapshots(milestone: 'PORTFOLIO' | 'REVEAL_GOOD' | 'REVEAL_BAD' | 'END', tx: Tx) {
  const teamStates = await getTeamStates(tx);

  // 1. Upsert all snapshots
  const snapshots = await Promise.all(teamStates.map(async (team) => {
    return await tx.snapshot.upsert({
      where: { teamId_milestone: { teamId: team.teamId, milestone } },
      update: { cash: team.cash, netWorth: team.netWorth },
      create: { teamId: team.teamId, milestone, cash: team.cash, netWorth: team.netWorth },
    });
  }));

  // 2. Prepare bulk insert for holdings
  // Delete existing snapshot holdings for this milestone to allow clean bulk insert
  const snapshotIds = snapshots.map(s => s.id);
  await tx.snapshotHolding.deleteMany({
    where: { snapshotId: { in: snapshotIds } }
  });

  const holdingData: any[] = [];
  for (let i = 0; i < teamStates.length; i++) {
    const team = teamStates[i];
    const snapId = snapshots.find(s => s.teamId === team.teamId)?.id;
    if (!snapId) continue;
    
    for (const holding of team.holdings) {
      holdingData.push({
        snapshotId: snapId,
        companyId: holding.companyId,
        shares: holding.shares,
        price: holding.price,
      });
    }
  }

  // 3. Bulk insert holdings in ONE query
  if (holdingData.length > 0) {
    await tx.snapshotHolding.createMany({
      data: holdingData
    });
  }
}
