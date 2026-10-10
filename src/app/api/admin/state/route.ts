/**
 * GET /api/admin/state
 * Comprehensive data feed for Admin Dashboard
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { getTeamStates } from '@/lib/state';
import { computeFinalRanks, computeRanks } from '@/lib/engine';
import Decimal from 'decimal.js';
import { computeLeaderboardScores } from '@/lib/scoring';



export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const game = await prisma.game.findUnique({ where: { id: 1 } });
    if (!game) throw new Error('Game not initialized');

    const companies = await prisma.company.findMany({
      orderBy: { symbol: 'asc' },
    });

    const events = await prisma.eventDef.findMany({
      include: {
        eventCompanies: {
          include: { company: true },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    const teams = await prisma.team.findMany({
      include: {
        choices: true,
        trades: {
          include: { company: true },
        },
        eventResults: { include: { event: true } },
      },
      orderBy: { name: 'asc' },
    });

    // We also need live state to build the leaderboard
    // The admin sees the TRUE live state, not just snapshots
    const liveStates = await prisma.$transaction(async (tx) => {
      return getTeamStates(tx as any);
    });

    const ranks = computeRanks(liveStates.map(ts => ({ teamId: ts.teamId, netWorth: ts.netWorth })));

    const leaderboard = liveStates.map(ts => {
      const dbTeam = teams.find(t => t.id === ts.teamId)!;
      return {
        id: ts.teamId,
        name: ts.name,
        username: ts.username,
        rank: ranks.get(ts.teamId) || 0,
        netWorth: ts.netWorth.toString(),
        cash: ts.cash.toString(),
        holdings: ts.holdings.map(h => ({
          ...h,
          price: h.price.toString(),
          value: h.price.mul(h.shares).toString(),
        })),
        initialPortfolio: dbTeam.trades.reduce((acc: any[], t) => {
          const existing = acc.find(x => x.companyId === t.companyId);
          if (existing) {
            existing.shares += t.qty;
          } else {
            acc.push({ companyId: t.companyId, symbol: t.company.symbol, name: t.company.name, shares: t.qty });
          }
          return acc;
        }, []),
        choices: dbTeam.choices,
        eventResults: dbTeam.eventResults.map(er => ({
          ...er,
          feePaid: er.feePaid.toString(),
          netWorthDelta: er.netWorthDelta.toString(),
        })),
      };
    });

    // Sort leaderboard by rank
    leaderboard.sort((a, b) => a.rank - b.rank);

    return NextResponse.json({
      game,
      companies: companies.map(c => ({
        ...c,
        basePrice: c.basePrice.toString(),
      })),
      events: events.map(e => ({
        ...e,
        eventCompanies: e.eventCompanies.map(ec => ({
          ...ec,
          aggressiveMove: ec.aggressiveMove.toString(),
          moderateMove: ec.moderateMove.toString(),
          holdDrop: ec.holdDrop.toString(),
        })),
      })),
      leaderboard,
      scores: await computeLeaderboardScores(),
    });
  } catch (error: any) {
    console.error('Admin state error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
